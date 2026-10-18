import { newsletterBlocksPlainText, normalizeNewsletterDesign } from "./newsletter.js";

const formatMoney = (amount, currency = "USD") => new Intl.NumberFormat("en", {
    style: "currency",
    currency,
}).format(Number(amount) || 0);

function itemLines(order) {
    return (order.items || []).map((item) =>
        `${item.quantity} × ${item.name}${item.size ? ` · ${item.size}` : ""} — ${formatMoney(item.price * item.quantity, order.currency)}`,
    ).join("\n");
}

export function orderConfirmationEmail(order, siteUrl) {
    const subtotal = (order.items || []).reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
    const conversionRate = Number(order.exchangeRate) || 1;
    return {
        to: order.customer.email,
        subject: `Saltlyne order ${order.id} received`,
        text: [
            `Hi ${order.customer.name},`,
            "",
            `Thank you for your order ${order.id}.`,
            itemLines(order),
            "",
            `Items subtotal: ${formatMoney(subtotal, order.currency)}.`,
            ...(order.couponDiscountUsd ? [`Coupon${order.couponCode ? ` ${order.couponCode}` : ""}: −${formatMoney(order.couponDiscountUsd * conversionRate, order.currency)}`] : []),
            ...(order.pointsDiscountUsd ? [`Loyalty points: −${formatMoney(order.pointsDiscountUsd * conversionRate, order.currency)}`] : []),
            `Amount due for items: ${formatMoney(order.total, order.currency)} (delivery quoted separately).`,
            `Payment: ${order.paymentMethod === "wise_transfer" ? "Wise / bank transfer" : "Cash on delivery"} — ${String(order.paymentStatus || "").replaceAll("_", " ")}.`,
            `Track your order: ${siteUrl}/orders/track?orderId=${encodeURIComponent(order.id)}`,
            "",
            "Saltlyne Label",
        ].join("\n"),
    };
}

export function orderUpdateEmail(order, siteUrl) {
    return {
        to: order.customer.email,
        subject: `Update on Saltlyne order ${order.id}`,
        text: [
            `Hi ${order.customer.name},`,
            "",
            `Your order ${order.id} has been updated.`,
            `Order status: ${order.status}.`,
            `Payment status: ${String(order.paymentStatus || "not recorded").replaceAll("_", " ")}.`,
            `Track your order: ${siteUrl}/orders/track?orderId=${encodeURIComponent(order.id)}`,
            "",
            "Saltlyne Label",
        ].join("\n"),
    };
}

export function passwordResetEmail({ name, email, resetUrl }) {
    return {
        to: email,
        subject: "Reset your Saltlyne account password",
        text: [
            `Hi ${name || "there"},`,
            "",
            "We received a request to reset your Saltlyne account password.",
            `Use this one-time link within 30 minutes: ${resetUrl}`,
            "",
            "If you did not request this change, you can ignore this email. Your password will not change unless the link is used.",
            "",
            "Saltlyne Label",
        ].join("\n"),
    };
}

export function supportNotificationEmail({ name, email, subject, message, supportEmail = "support@saltlyne.com" }) {
    return {
        to: supportEmail,
        replyTo: email,
        subject: `Website enquiry: ${subject}`,
        text: `From: ${name} <${email}>\n\n${message}`,
    };
}

export function supportReceiptEmail({ name, email, subject, supportEmail = "support@saltlyne.com" }) {
    return {
        to: email,
        subject: "We received your Saltlyne message",
        text: `Hi ${name},\n\nThanks for contacting Saltlyne about “${subject}”. Your message has been sent to our customer-care team at ${supportEmail}. We’ll get back to you as soon as we can.\n\nSaltlyne Label`,
    };
}

export function newsletterWelcomeEmail({ email, name, unsubscribeUrl }) {
    return {
        to: email,
        subject: "Welcome to Saltlyne notes",
        text: `Hi ${name || "there"},\n\nYou’re on the Saltlyne list for thoughtful notes and new-drop updates.\n\nYou can unsubscribe at any time: ${unsubscribeUrl}\n\nSaltlyne Label`,
    };
}

export function newsletterCampaignEmail({ email, subject, blocks, design, unsubscribeUrl }) {
    const palette = normalizeNewsletterDesign(design);
    const imageAttachments = blocks.flatMap((block, index) => block.type === "image" ? [{
        filename: `saltlyne-newsletter-${index + 1}.webp`,
        content: Buffer.from(block.image.slice("data:image/webp;base64,".length), "base64"),
        contentType: "image/webp",
        cid: `newsletter-image-${index}@saltlyne`,
    }] : []);
    const footer = `<p style="margin:28px 0 0;color:${palette.textColor};font:12px/1.6 Arial,sans-serif">Saltlyne Label</p><p style="margin:12px 0 0;font:12px/1.6 Arial,sans-serif"><a href="${escapeHtml(unsubscribeUrl)}" style="color:${palette.accentColor}">Unsubscribe from these emails</a></p>`;
    return {
        to: email,
        subject,
        text: `${newsletterBlocksPlainText(blocks)}\n\nSaltlyne Label\n\nUnsubscribe from these emails: ${unsubscribeUrl}`,
        html: `<!doctype html><html><body style="margin:0;padding:24px;background:${palette.pageColor}"><main style="box-sizing:border-box;max-width:640px;margin:0 auto;padding:32px;background:${palette.cardColor}">${renderNewsletterBlocks(blocks, palette)}${footer}</main></body></html>`,
        attachments: imageAttachments,
    };
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character]);
}

function renderNewsletterBlocks(blocks, design) {
    return blocks.map((block, index) => {
        if (block.type === "heading") return `<h1 style="margin:0 0 18px;color:${design.textColor};font:600 26px/1.25 Arial,sans-serif">${escapeHtml(block.text)}</h1>`;
        if (block.type === "paragraph") return `<p style="margin:0 0 18px;color:${design.textColor};font:16px/1.65 Arial,sans-serif;white-space:pre-line">${escapeHtml(block.text)}</p>`;
        if (block.type === "image") return `<img src="cid:newsletter-image-${index}@saltlyne" alt="${escapeHtml(block.alt)}" style="display:block;width:100%;max-width:600px;height:auto;margin:20px auto;border:0"/>`;
        if (block.type === "button") return `<p style="margin:22px 0;text-align:center"><a href="${escapeHtml(block.url)}" style="display:inline-block;padding:14px 24px;color:#fff;background:${design.accentColor};font:600 13px Arial,sans-serif;text-decoration:none">${escapeHtml(block.text)}</a></p>`;
        return '<hr style="margin:24px 0;border:0;border-top:1px solid #e4e7e1"/>';
    }).join("");
}
