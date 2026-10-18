import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const envFile = new URL("../.env", import.meta.url);
let content = "";
try { content = await readFile(envFile, "utf8"); } catch {}
const existingEmail = content.match(/^ADMIN_EMAIL=(.*)$/m)?.[1]?.trim();
const email = process.env.ADMIN_EMAIL || existingEmail || "owner@saltlynelabel.com";
const password = randomBytes(18).toString("base64url");
const next = content
    .replace(/^ADMIN_EMAIL=.*$/m, "")
    .replace(/^ADMIN_PASSWORD=.*$/m, "")
    .trim();
await writeFile(envFile, `${next}${next ? "\n" : ""}ADMIN_EMAIL=${email}\nADMIN_PASSWORD=${password}\n`);
console.log("Saltlyne admin login created");
console.log(`Email: ${email}`);
console.log(`Password: ${password}`);
console.log("Keep these credentials private. They are stored in the ignored local .env file.");
