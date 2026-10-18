import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}

export function isValidEmail(value) {
    return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validatePassword(value) {
    if (typeof value !== "string" || value.length < 10 || value.length > 128) {
        throw new Error("Password must be between 10 and 128 characters.");
    }
}

export function hashPassword(password) {
    const salt = randomBytes(16);
    const digest = scryptSync(password, salt, 64);
    return `scrypt$${salt.toString("hex")}$${digest.toString("hex")}`;
}

export function verifyPassword(password, storedHash) {
    const [algorithm, saltHex, digestHex] = String(storedHash || "").split("$");
    if (algorithm !== "scrypt" || !/^[\da-f]{32}$/i.test(saltHex || "") || !/^[\da-f]{128}$/i.test(digestHex || "")) return false;
    const expected = Buffer.from(digestHex, "hex");
    const actual = scryptSync(String(password || ""), Buffer.from(saltHex, "hex"), expected.length);
    return timingSafeEqual(actual, expected);
}
