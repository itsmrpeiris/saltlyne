import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { verifyPassword } from "../../shared/customerAuth.js";
import { hashPasswordResetToken, isPasswordResetRequestAllowed, isPasswordResetTokenValid, PASSWORD_RESET_REQUEST_COOLDOWN_MS, PASSWORD_RESET_TOKEN_TTL_MS } from "../../shared/passwordReset.js";
import { apiRequest, startTestApp } from "./helpers.js";

function resetTokenFrom(email) {
    const decodedEmail = email.replace(/=\r?\n/g, "").replace(/=([A-F\d]{2})/gi, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
    const link = decodedEmail.match(/https?:\/\/[^\s<]+\/account\/reset-password\?token=[A-Za-z0-9_-]{43}/)?.[0];
    assert.ok(link, "reset email contains a tokenized reset link");
    return new URL(link).searchParams.get("token");
}

test("password reset email uses a hashed, expiring one-time token and revokes existing sessions", async (t) => {
    const app = await startTestApp();
    t.after(() => app.close());
    const page = await app.browser.newPage();
    t.after(() => page.close());

    const email = `reset-${Date.now()}@example.test`;
    const originalPassword = "Original-Runtime-Password-482!";
    const newPassword = "Replacement-Runtime-Password-482!";
    const registration = await apiRequest(app.apiUrl, "/account/register", {
        method: "POST",
        body: { name: "Reset Test Customer", email, password: originalPassword },
    });
    assert.equal(registration.status, 201);

    await page.goto(`${app.url}/account`);
    await page.getByRole("link", { name: "Forgot your password?" }).click();
    await page.getByRole("button", { name: "Send reset link" }).waitFor();
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await page.getByRole("status").getByText("If an account exists for that email").waitFor();
    assert.equal(app.sentEmails.length, 1, "existing account receives one reset email");

    const beforeReset = JSON.parse(await readFile(app.storeFile, "utf8"));
    const savedReset = beforeReset.passwordResetTokens.find((entry) => entry.customerId === registration.data.id);
    const token = resetTokenFrom(app.sentEmails[0]);
    assert.ok(savedReset);
    assert.equal(savedReset.tokenHash, hashPasswordResetToken(token));
    assert.notEqual(savedReset.tokenHash, token, "the raw reset token is never persisted");
    assert.ok(Date.parse(savedReset.expiresAt) > Date.now());
    assert.ok(Date.parse(savedReset.expiresAt) <= Date.now() + 31 * 60 * 1000);

    const sameMessage = "If an account exists for that email, password reset instructions will be sent.";
    const repeatedRequest = await apiRequest(app.apiUrl, "/account/password-reset/request", {
        method: "POST",
        body: { email },
    });
    assert.equal(repeatedRequest.status, 200);
    assert.equal(repeatedRequest.data.message, sameMessage);
    assert.equal(app.sentEmails.length, 1, "repeated requests do not trigger a reset-email flood");
    assert.equal(isPasswordResetRequestAllowed(savedReset.createdAt, Date.parse(savedReset.createdAt) + PASSWORD_RESET_REQUEST_COOLDOWN_MS - 1), false);
    assert.equal(isPasswordResetRequestAllowed(savedReset.createdAt, Date.parse(savedReset.createdAt) + PASSWORD_RESET_REQUEST_COOLDOWN_MS), true);
    const unknownRequest = await apiRequest(app.apiUrl, "/account/password-reset/request", {
        method: "POST",
        body: { email: `missing-${Date.now()}@example.test` },
    });
    assert.equal(unknownRequest.status, 200);
    assert.equal(unknownRequest.data.message, sameMessage);
    assert.equal(app.sentEmails.length, 1, "unknown email does not disclose account existence");

    await page.goto(`${app.url}/account/reset-password?token=${encodeURIComponent(token)}`);
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password", { exact: true }).fill("A-different-password-482!");
    await page.getByRole("button", { name: "Update password" }).click();
    await page.getByRole("alert").getByText("The passwords do not match.").waitFor();
    await page.getByLabel("Confirm new password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Update password" }).click();
    await page.getByText("Your password reset is complete.").waitFor();
    assert.equal(new URL(page.url()).searchParams.has("token"), false, "successful reset removes the token from the address bar");

    const invalidatedSession = await apiRequest(app.apiUrl, "/account/me", { cookie: registration.cookie });
    assert.equal(invalidatedSession.status, 401, "password reset revokes the old customer session");
    const replay = await apiRequest(app.apiUrl, "/account/password-reset/complete", {
        method: "POST",
        body: { token, password: "Second-Replay-Password-482!" },
    });
    assert.equal(replay.status, 400, "reset token is single-use");
    const oldLogin = await apiRequest(app.apiUrl, "/account/login", {
        method: "POST",
        body: { email, password: originalPassword },
    });
    assert.equal(oldLogin.status, 401);
    const newLogin = await apiRequest(app.apiUrl, "/account/login", {
        method: "POST",
        body: { email, password: newPassword },
    });
    assert.equal(newLogin.status, 200);

    const afterReset = JSON.parse(await readFile(app.storeFile, "utf8"));
    const savedCustomer = afterReset.customers.find((entry) => entry.id === registration.data.id);
    assert.ok(verifyPassword(newPassword, savedCustomer.passwordHash));
    assert.equal(afterReset.passwordResetTokens.some((entry) => entry.customerId === registration.data.id), false);

    const mailFailureEmail = `mail-failure-${Date.now()}@example.test`;
    const mailFailureAccount = await apiRequest(app.apiUrl, "/account/register", {
        method: "POST",
        body: { name: "Mail Failure Test", email: mailFailureEmail, password: originalPassword },
    });
    assert.equal(mailFailureAccount.status, 201);
    app.failNextEmail();
    const failedDelivery = await apiRequest(app.apiUrl, "/account/password-reset/request", {
        method: "POST",
        body: { email: mailFailureEmail },
    });
    assert.equal(failedDelivery.status, 200, "request response stays account-enumeration-safe during mail failure");
    const afterMailFailure = JSON.parse(await readFile(app.storeFile, "utf8"));
    assert.equal(afterMailFailure.passwordResetTokens.some((entry) => entry.customerId === mailFailureAccount.data.id), false, "failed email delivery invalidates the unusable reset token");

    const now = Date.now();
    assert.equal(PASSWORD_RESET_TOKEN_TTL_MS, 30 * 60 * 1000);
    assert.equal(isPasswordResetTokenValid(new Date(now + 1000).toISOString(), now), true);
    assert.equal(isPasswordResetTokenValid(new Date(now).toISOString(), now), false);
    assert.equal(isPasswordResetTokenValid("not-a-date", now), false);
    assert.match(app.logs(), /Saltlyne server listening/);
});
