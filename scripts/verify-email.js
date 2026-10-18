import { sendEmail, supportEmail } from "../shared/email.js";

const hasSmtpUser = Boolean(process.env.SMTP_USER);
const hasSmtpPassword = Boolean(process.env.SMTP_PASS);
const allowsWorkspaceRelay = process.env.SMTP_ALLOW_UNAUTHENTICATED === "true";
if (hasSmtpUser !== hasSmtpPassword) {
    console.error("SMTP verification cannot start: set both SMTP_USER and SMTP_PASS, or remove both and configure an authorized Workspace relay.");
    process.exit(1);
}
if (!hasSmtpUser && !allowsWorkspaceRelay) {
    console.error("SMTP verification cannot start: configure SMTP_USER and SMTP_PASS, or explicitly enable an IP-authorized Workspace relay.");
    process.exit(1);
}

try {
    const recipient = supportEmail();
    const result = await sendEmail({
        to: recipient,
        subject: "Saltlyne email delivery test",
        text: `This is a manually initiated SMTP verification message sent at ${new Date().toISOString()}.`,
    });
    console.log(`SMTP accepted the verification message for ${recipient} (message ID: ${result.messageId}). Check the mailbox to confirm delivery.`);
} catch (error) {
    const code = error?.code || "smtp_verification_failed";
    console.error(`SMTP verification failed (${code}). Check the Workspace mailbox, SMTP host/port, app password or relay policy, and hosting environment variables.`);
    process.exitCode = 1;
}
