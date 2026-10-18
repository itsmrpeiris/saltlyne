import { createHash } from "node:crypto";

export const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
export const PASSWORD_RESET_REQUEST_COOLDOWN_MS = 60 * 1000;

export function hashPasswordResetToken(token) {
    return createHash("sha256").update(String(token)).digest("hex");
}

export function isPasswordResetTokenValid(expiresAt, now = Date.now()) {
    const expiry = Date.parse(expiresAt);
    return Number.isFinite(expiry) && expiry > now;
}

export function isPasswordResetRequestAllowed(createdAt, now = Date.now()) {
    const created = Date.parse(createdAt);
    return !Number.isFinite(created) || now - created >= PASSWORD_RESET_REQUEST_COOLDOWN_MS;
}
