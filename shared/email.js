import nodemailer from "nodemailer";

const defaultSupportEmail = "support@saltlyne.com";

export function supportEmail() {
    return process.env.SUPPORT_EMAIL || defaultSupportEmail;
}

export function publicSiteUrl(fallback = "https://saltlyne.com") {
    return (process.env.PUBLIC_SITE_URL || fallback).replace(/\/+$/, "");
}

export async function sendEmail({ to, subject, text, html, attachments, replyTo }) {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER || "";
    const pass = process.env.SMTP_PASS || "";
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SMTP_PORT must be a valid port number.");
    if (Boolean(user) !== Boolean(pass)) throw new Error("Configure both SMTP_USER and SMTP_PASS, or neither when using an IP-authorized Workspace relay.");
    if (!user && process.env.SMTP_ALLOW_UNAUTHENTICATED !== "true") {
        throw new Error("Email delivery is not configured. Set SMTP_USER and SMTP_PASS or explicitly enable an IP-authorized Workspace relay.");
    }

    const transport = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        requireTLS: process.env.SMTP_REQUIRE_TLS === "true" || port === 587,
        ...(user ? { auth: { user, pass } } : {}),
    });
    return transport.sendMail({
        from: process.env.EMAIL_FROM || `Saltlyne Label <${supportEmail()}>`,
        to,
        subject,
        text,
        ...(html ? { html } : {}),
        ...(attachments?.length ? { attachments } : {}),
        ...(replyTo ? { replyTo } : {}),
    });
}

export async function sendEmailBatch(messages, concurrency = 3) {
    const results = [];
    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(concurrency, messages.length) }, async () => {
        while (nextIndex < messages.length) {
            const index = nextIndex++;
            try {
                await sendEmail(messages[index]);
                results[index] = { sent: true };
            } catch (error) {
                results[index] = { sent: false, error };
            }
        }
    });
    await Promise.all(workers);
    const failed = results.filter((result) => !result.sent);
    if (failed.length) {
        const codes = [...new Set(failed.map(({ error }) => error.code || "email_delivery_error"))];
        console.error(`Email delivery failed for ${failed.length} message(s): ${codes.join(", ")}`);
    }
    return { sent: messages.length - failed.length, failed: failed.length, statuses: results.map((result) => result.sent) };
}

export function escapeEmailText(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character]);
}
