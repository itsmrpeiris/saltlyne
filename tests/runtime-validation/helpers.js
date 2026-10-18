import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SMTPServer } from "smtp-server";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function availablePort() {
    const server = net.createServer();
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    const { port } = server.address();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    return port;
}

async function waitForApi(apiUrl, child, getLogs) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error(`Test API exited early.\n${getLogs()}`);
        try {
            const response = await fetch(`${apiUrl}/api/health`, { signal: AbortSignal.timeout(500) });
            if (response.ok) return;
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Test API did not become ready.\n${getLogs()}`);
}

export async function startTestApp({ initialStore } = {}) {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "saltlyne-runtime-validation-"));
    const storeFile = path.join(tempDir, "store.json");
    if (initialStore) await writeFile(storeFile, JSON.stringify(initialStore));
    const apiPort = await availablePort();
    const smtpPort = await availablePort();
    const apiUrl = `http://127.0.0.1:${apiPort}`;
    const sentEmails = [];
    let smtpFailuresRemaining = 0;
    const smtp = new SMTPServer({
        authOptional: true,
        disabledCommands: ["AUTH"],
        hideSTARTTLS: true,
        logger: false,
        onData(stream, _session, callback) {
            const chunks = [];
            stream.on("data", (chunk) => chunks.push(chunk));
            stream.on("end", () => {
                if (smtpFailuresRemaining) {
                    smtpFailuresRemaining -= 1;
                    callback(new Error("Test SMTP rejected the message."));
                } else {
                    sentEmails.push(Buffer.concat(chunks).toString("utf8"));
                    callback(null);
                }
            });
        },
    });
    await new Promise((resolve, reject) => {
        smtp.once("error", reject);
        smtp.listen(smtpPort, "127.0.0.1", resolve);
    });
    let logs = "";
    const apiProcess = spawn(process.execPath, ["server/index.js"], {
        cwd: projectRoot,
        env: {
            ...process.env,
            PORT: String(apiPort),
            STORE_DATA_FILE: storeFile,
            ADMIN_EMAIL: "owner@saltlynelabel.com",
            ADMIN_PASSWORD: "test-only-admin-password",
            SMTP_HOST: "127.0.0.1",
            SMTP_PORT: String(smtpPort),
            SMTP_ALLOW_UNAUTHENTICATED: "true",
            SUPPORT_EMAIL: "support@saltlyne.com",
            EMAIL_FROM: "Saltlyne Label <support@saltlyne.com>",
            PUBLIC_SITE_URL: "http://127.0.0.1:5173",
            NODE_ENV: "test",
        },
        stdio: ["ignore", "pipe", "pipe"],
    });
    const capture = (chunk) => { logs = `${logs}${chunk}`.slice(-12000); };
    apiProcess.stdout.setEncoding("utf8").on("data", capture);
    apiProcess.stderr.setEncoding("utf8").on("data", capture);

    let vite;
    let browser;
    try {
        await waitForApi(apiUrl, apiProcess, () => logs);
        vite = await createViteServer({
            configFile: path.join(projectRoot, "vite.config.js"),
            server: {
                host: "127.0.0.1",
                port: 0,
                proxy: { "/api": { target: apiUrl, changeOrigin: true } },
            },
        });
        await vite.listen();
        const vitePort = vite.httpServer.address().port;
        browser = await chromium.launch({ headless: true });
        return {
            apiUrl,
            browser,
            logs: () => logs,
            sentEmails,
            failNextEmail() { smtpFailuresRemaining += 1; },
            storeFile,
            url: `http://127.0.0.1:${vitePort}`,
            async close() {
                await browser.close();
                await vite.close();
                if (apiProcess.exitCode === null) {
                    const exited = new Promise((resolve) => apiProcess.once("exit", resolve));
                    apiProcess.kill("SIGTERM");
                    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
                }
                await new Promise((resolve) => smtp.close(resolve));
                await rm(tempDir, { recursive: true, force: true });
            },
        };
    } catch (error) {
        if (browser) await browser.close();
        if (vite) await vite.close();
        if (apiProcess.exitCode === null) apiProcess.kill("SIGTERM");
        await new Promise((resolve) => smtp.close(resolve));
        await rm(tempDir, { recursive: true, force: true });
        throw new Error(`${error.message}\n${logs}`);
    }
}

export async function apiRequest(baseUrl, route, { method = "GET", body, cookie } = {}) {
    const response = await fetch(`${baseUrl}/api${route}`, {
        method,
        headers: {
            ...(body === undefined ? {} : { "content-type": "application/json" }),
            ...(cookie ? { cookie } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    const sessionCookie = response.headers.getSetCookie?.()[0]?.split(";")[0];
    return { cookie: sessionCookie, data, status: response.status };
}

export function assertNoStoredCredentials(value) {
    const serialized = JSON.stringify(value);
    assert.doesNotMatch(serialized, /passwordHash|password_hash|unsubscribeToken|session_version/i);
}
