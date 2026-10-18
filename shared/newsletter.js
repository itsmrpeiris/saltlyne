import { safeExternalUrl } from "./iconLinks.js";

const MAX_CAMPAIGN_BLOCKS = 40;
const MAX_INLINE_IMAGE_LENGTH = 800_000;
const DEFAULT_NEWSLETTER_DESIGN = {
    pageColor: "#f4f5f1",
    cardColor: "#ffffff",
    textColor: "#414941",
    accentColor: "#303b39",
};

function isInlineWebp(value) {
    return typeof value === "string" &&
        value.length <= MAX_INLINE_IMAGE_LENGTH &&
        /^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

export function normalizeNewsletterBlocks(value) {
    if (!Array.isArray(value) || !value.length || value.length > MAX_CAMPAIGN_BLOCKS) {
        throw new Error(`Add between 1 and ${MAX_CAMPAIGN_BLOCKS} newsletter content blocks.`);
    }
    return value.map((block) => {
        if (!block || typeof block !== "object" || Array.isArray(block)) throw new Error("Newsletter content has an invalid block.");
        if (block.type === "divider") return { type: "divider" };
        if (block.type === "heading" || block.type === "paragraph") {
            const text = typeof block.text === "string" ? block.text.trim() : "";
            const maxLength = block.type === "heading" ? 160 : 4000;
            if (!text || text.length > maxLength) throw new Error(`Each newsletter ${block.type} must contain 1-${maxLength} characters.`);
            return { type: block.type, text };
        }
        if (block.type === "image") {
            const image = block.image;
            const alt = typeof block.alt === "string" ? block.alt.trim().slice(0, 180) : "";
            if (!isInlineWebp(image)) throw new Error("Newsletter images must be optimized WebP files no larger than 600 KB.");
            return { type: "image", image, alt };
        }
        if (block.type === "button") {
            const text = typeof block.text === "string" ? block.text.trim().slice(0, 80) : "";
            const url = typeof block.url === "string" ? block.url.trim() : "";
            if (!text || !safeExternalUrl(url)) throw new Error("Newsletter buttons need text and a valid HTTPS destination.");
            return { type: "button", text, url: safeExternalUrl(url) };
        }
        throw new Error("Newsletter content supports heading, paragraph, image, button, or divider blocks.");
    });
}

export function newsletterBlocksPlainText(blocks) {
    return blocks.map((block) => {
        if (block.type === "image" || block.type === "divider") return "";
        if (block.type === "button") return `${block.text}: ${block.url}`;
        return block.text;
    }).filter(Boolean).join("\n\n");
}

export function normalizeNewsletterDesign(value) {
    const design = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return Object.fromEntries(Object.entries(DEFAULT_NEWSLETTER_DESIGN).map(([key, fallback]) => {
        const color = typeof design[key] === "string" ? design[key] : fallback;
        if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error("Newsletter design colors must be six-digit hex values.");
        return [key, color.toLowerCase()];
    }));
}
