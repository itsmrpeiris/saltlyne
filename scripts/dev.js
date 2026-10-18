import { spawn } from "node:child_process";

const children = [];
let shuttingDown = false;
function stop(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
    setTimeout(() => process.exit(code), 200).unref();
}

const api = spawn(process.execPath, ["--env-file-if-exists=.env", "server/index.js"], { stdio: "inherit", env: process.env });
children.push(api);
api.on("error", (error) => { console.error("Could not start Saltlyne API:", error.message); stop(1); });
api.on("exit", (code) => { if (!shuttingDown) { console.error(`Saltlyne API stopped (${code ?? "signal"}).`); stop(code || 1); } });

let ready = false;
for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
        const response = await fetch("http://127.0.0.1:3001/api/health");
        if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
}
if (!ready) { console.error("Saltlyne API did not become ready. Check that port 3001 is available."); stop(1); }
else {
    console.log("Saltlyne API ready. Starting storefront…");
    const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js"], { stdio: "inherit", env: process.env });
    children.push(vite);
    vite.on("error", (error) => { console.error("Could not start Vite:", error.message); stop(1); });
    vite.on("exit", (code) => { if (!shuttingDown) stop(code || 0); });
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
