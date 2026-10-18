import { createDefaultIconLinks, migrateIconCollection, paymentIconDefinitions, safeExternalUrl, socialIconDefinitions } from "./iconLinks.js";

const defaultStory = [
    {
        title: "Purpose",
        blocks: [
            { type: "paragraph", text: "Saltlyne was born from a powerful message in the Sermon on the Mount: “You are the salt of the earth.” To us, salt represents purpose, identity, and the impact we can have on the world around us." },
            { type: "paragraph", text: "But Saltlyne is also a story of losing yourself and finding your way back." },
        ],
    },
    {
        title: "Losing your way",
        blocks: [
            { type: "paragraph", text: "Our founder was once deeply connected to an athletic lifestyle. It was more than a passion; it was part of who he was. But life took him away from that identity, and it took him ten years to rediscover the person he once knew and return to what he loved." },
        ],
    },
    {
        title: "Finding your way back",
        blocks: [
            { type: "paragraph", text: "Saltlyne was born from that journey." },
            { type: "paragraph", text: "This collection represents the belief that, no matter how chaotic life becomes or how far we drift from ourselves, we can always find our way back." },
        ],
    },
    {
        title: "Your journey",
        blocks: [
            { type: "quote", text: "Just as the salt water finds its way to the shore, we believe we can find our way back to who we truly are." },
            { type: "paragraph", text: "Saltlyne is for everyone on that journey. A reminder to embrace who you are, trust your own timing, and never lose sight of what makes you, you." },
            { type: "closing", text: "Saltlyne Label — More than what you wear. A reminder of who you are." },
        ],
    },
];

export function createDefaultStoreContent(now = Date.now()) {
    return {
        settings: {
            logoUrl: "/images/saltlyne-logo-black.png",
            announcementActive: true,
            announcementIntervalMs: 5000,
            social: createDefaultIconLinks(socialIconDefinitions, "social"),
            siteAnnouncement: { label: "SALTLYNE LABEL", text: "CLOTHES FOR WHEREVER LIFE TAKES YOU" },
            announcements: [
                { audience: "WOMEN’S EDIT", text: "A little something for your next move.", linkText: "shop the new drop", link: "#new" },
                { audience: "MEN’S EDIT", text: "Made to move. Built for more.", linkText: "shop the new drop", link: "#new" },
            ],
        },
        payments: {
            currencies: ["LKR", "USD", "GBP", "AUD"],
            wiseTransfer: {
                enabled: false,
                accountHolder: "",
                bankName: "",
                accountDetails: "",
                swiftBic: "",
                instructions: "Use your order number as the transfer reference. Your order will be confirmed once payment is received.",
            },
            cashOnDelivery: {
                enabled: true,
                instructions: "Pay in cash when your order is delivered.",
            },
        },
        paymentIcons: createDefaultIconLinks(paymentIconDefinitions, "payment"),
        categories: [
            { slug: "women", label: "WOMEN", title: "Women", eyebrow: "THE COASTAL MOVEMENT EDIT", headlineLines: ["Find your", "own current."], emphasis: "own current.", description: "Made for coastal miles, studio hours and everything that feels like you.", imageUrl: "/images/women-galle-hero.jpg", imageAlt: "Saltlyne activewear on the Galle coastline", active: true, displayOrder: 0 },
            { slug: "men", label: "MEN", title: "Men", eyebrow: "MADE FOR THE MILES AHEAD", headlineLines: ["Move with", "intent."], emphasis: "intent.", description: "Built for the work, the recovery and every mile in between.", imageUrl: "/images/men-galle-run.jpg", imageAlt: "Saltlyne training on the Galle Fort coast", active: true, displayOrder: 1 },
            { slug: "accessories", label: "ACCESSORIES", title: "Accessories", eyebrow: "THE FINISHING DETAILS", headlineLines: ["Ready for", "what’s next."], emphasis: "what’s next.", description: "The useful little details for wherever the day takes you.", imageUrl: "/images/coastal-training-accessories.jpg", imageAlt: "Saltlyne essentials for training and coastal escapes", active: true, displayOrder: 2 },
        ],
        home: {
            slides: [
                { eyebrow: "SRI LANKA, BY THE COAST — DROP 04", headlineLines: ["Move with", "your own current."], emphasis: "current.", descriptionLines: ["Coastal air. Open roads. Room to move.", "Active essentials for wherever the day takes you."], imageUrl: "/images/women-galle-hero.jpg", imageAlt: "Saltlyne by the coast", videoUrl: "", primaryButtonText: "SHOP THE COLLECTION", primaryButtonLink: "/collections/women", secondaryButtonText: "EXPLORE", secondaryButtonLink: "/explore" },
                { eyebrow: "NEW SEASON — FIND YOUR FLOW", headlineLines: ["Find your", "element."], emphasis: "element.", descriptionLines: ["Light layers, easy comfort.", "Made for wherever today takes you."], imageUrl: "/images/women-solo-teal-coast.jpg", imageAlt: "The Saltlyne movement edit", videoUrl: "", primaryButtonText: "SHOP THE COLLECTION", primaryButtonLink: "/collections/women", secondaryButtonText: "EXPLORE", secondaryButtonLink: "/explore" },
                { eyebrow: "THE SOFT SIDE OF STRONG", headlineLines: ["Feel good", "doing you."], emphasis: "doing you.", descriptionLines: ["Your everyday uniform, reimagined.", "Considered essentials for every kind of day."], imageUrl: "/images/women-solo-pink-studio.jpg", imageAlt: "Everyday Saltlyne essentials", videoUrl: "", primaryButtonText: "SHOP THE COLLECTION", primaryButtonLink: "/collections/women", secondaryButtonText: "EXPLORE", secondaryButtonLink: "/explore" },
            ],
            manifesto: { eyebrow: "SALTLYNE IS A STATE OF MIND", headlineLines: ["MADE TO MOVE.", "MADE TO FEEL", "LIKE YOU."], emphasis: "LIKE YOU.", body: "Some days are for the long way home. Some are for showing up. Find pieces that feel right for all of it.", buttonText: "EXPLORE SALTLYNE", buttonLink: "/explore" },
            story: defaultStory,
            membership: { imageUrl: "/images/women-training.jpg", imageAlt: "Saltlyne athlete training with dumbbells", eyebrow: "A PLACE TO MOVE YOUR WAY", headlineLines: ["Join the", "Saltlyne Club."], emphasis: "Saltlyne Club.", body: "For every pace, every path, and every version of you. Get thoughtful notes, first word on new drops, and a little inspiration for wherever life takes you.", buttonText: "Join the club", note: "No noise. Just the good stuff, now and then." },
            newsletter: { eyebrow: "LETTERS FROM THE SLOW LANE", headlineLines: ["A little room", "in your inbox."], body: "New drops, thoughtful notes and 10% off your first order.", buttonText: "Sign me up", consentText: "By signing up, you agree to receive the occasional note from us." },
        },
        explore: {
            launchAt: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
            videoUrl: "/new-collection-campaign.mp4",
            posterUrl: "/images/new-collection-campaign-poster.jpg",
            teaserImageUrl: "/images/men-galle-run.jpg",
            drops: [
                { label: "WOMEN", title: "NEW IN: WOMEN’S POWERHOUSE", imageUrl: "/images/women-training.jpg", imageAlt: "Saltlyne women’s training collection", videoUrl: "", link: "/collections/women" },
                { label: "MEN", title: "NEW IN: MEN’S HYBRID", imageUrl: "/images/men-training.jpg", imageAlt: "Saltlyne men’s hybrid collection", videoUrl: "", link: "/collections/men" },
                { label: "ACCESSORIES", title: "NEW IN: ACCESSORIES LOAD", imageUrl: "/images/coastal-training-accessories.jpg", imageAlt: "Saltlyne training accessories for coastal movement", videoUrl: "", link: "/collections/accessories" },
            ],
        },
        pages: [
            { slug: "faq", title: "Frequently asked questions", eyebrow: "HELP", intro: "Find answers to common questions about shopping with Saltlyne.", sections: [{ heading: "Orders and delivery", body: "For help with an order, use the order tracking form with your order number and email address, or contact us." }, { heading: "Returns and exchanges", body: "Contact us with your order number and we’ll help with your return or exchange." }] },
            { slug: "delivery", title: "Delivery information", eyebrow: "HELP", intro: "Delivery details for your Saltlyne order.", sections: [{ heading: "Track your order", body: "Use your order number and email address to check the latest order status." }] },
            { slug: "returns", title: "Returns and exchanges", eyebrow: "HELP", intro: "Need a different size or fit? Get in touch and we’ll help.", sections: [{ heading: "Start a return", body: "Contact us with your order number and the items you’d like to return or exchange." }] },
            { slug: "contact", title: "Get in touch", eyebrow: "CONTACT", intro: "We’re here to help with your order, fit, or anything else.", sections: [{ heading: "Customer care", body: "Email support@saltlyne.com and include your order number if you’re contacting us about an order." }] },
        ],
    };
}

export function mergeStoreContent(current, changes) {
    if (!changes || typeof changes !== "object" || Array.isArray(changes)) throw new Error("Site content must be a JSON object.");
    if (!current || typeof current !== "object" || Array.isArray(current)) throw new Error("Current site content must be a JSON object.");
    const allowed = ["settings", "payments", "paymentIcons", "categories", "home", "explore", "pages"];
    if (Object.keys(changes).some((key) => !allowed.includes(key))) throw new Error("Site content contains an unsupported top-level section.");
    for (const key of ["settings", "payments", "paymentIcons", "home", "explore"]) {
        if (changes[key] !== undefined && (!changes[key] || typeof changes[key] !== "object" || (key !== "paymentIcons" && Array.isArray(changes[key])))) throw new Error(`${key} must be an object.`);
    }
    for (const key of ["categories", "pages"]) {
        if (changes[key] !== undefined && !Array.isArray(changes[key])) throw new Error(`${key} must be a list.`);
    }
    const defaults = createDefaultStoreContent();
    const next = {
        ...defaults,
        ...current,
        ...changes,
        settings: {
            ...defaults.settings,
            ...current.settings,
            ...(changes.settings || {}),
            social: migrateIconCollection(
                changes.settings?.social ?? current.settings?.social,
                socialIconDefinitions,
                "social",
            ),
        },
        payments: { ...defaults.payments, ...current.payments, ...(changes.payments || {}) },
        paymentIcons: migrateIconCollection(changes.paymentIcons ?? current.paymentIcons, paymentIconDefinitions, "payment"),
        home: { ...defaults.home, ...current.home, ...(changes.home || {}) },
        explore: { ...defaults.explore, ...current.explore, ...(changes.explore || {}) },
    };
    next.pages = next.pages.map((page) => page.slug === "contact"
        ? { ...page, sections: page.sections.map((section) => ({ ...section, body: section.body.replaceAll("hello@saltlynelabel.com", "support@saltlyne.com") })) }
        : page);
    if (!Array.isArray(next.settings.announcements) || next.settings.announcements.length > 4) throw new Error("Provide up to four announcement messages.");
    if (!Array.isArray(next.categories) || next.categories.length > 30) throw new Error("Provide up to 30 categories.");
    if (!Array.isArray(next.home.slides) || next.home.slides.length > 12) throw new Error("Provide up to 12 home hero slides.");
    if (!Array.isArray(next.home.story) || next.home.story.length > 30) throw new Error("Story content must be a list of up to 30 chapters.");
    if (!Array.isArray(next.explore.drops) || next.explore.drops.length > 30) throw new Error("Provide up to 30 Explore drops.");
    if (!Array.isArray(next.pages) || next.pages.length > 100) throw new Error("Provide up to 100 content pages.");
    if (Buffer.byteLength(JSON.stringify(next), "utf8") > 3_000_000) throw new Error("Store content cannot exceed 3 MB.");
    const isText = (value) => typeof value === "string" && value.length <= 5000;
    const isTextList = (value) => Array.isArray(value) && value.length <= 12 && value.every(isText);
    for (const [section, definitions, configs] of [
        ["settings.social", socialIconDefinitions, next.settings.social],
        ["paymentIcons", paymentIconDefinitions, next.paymentIcons],
    ]) {
        if (!Array.isArray(configs) || configs.length > 16) throw new Error(`${section} must be a list of up to 16 icons.`);
        const ids = new Set();
        const orders = new Set();
        for (const icon of configs) {
            const knownKey = definitions.some(({ key }) => key === icon?.key);
            const isCustom = icon?.key === undefined || icon?.key === null || icon?.key === "";
            if (!icon || typeof icon !== "object" || Array.isArray(icon) ||
                typeof icon.id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(icon.id) ||
                ids.has(icon.id) || typeof icon.name !== "string" || !icon.name.trim() || icon.name.length > 80 ||
                typeof icon.enabled !== "boolean" || !isText(icon.url) || (icon.url && !safeExternalUrl(icon.url)) ||
                !Number.isSafeInteger(icon.order) || icon.order < 1 || orders.has(icon.order) ||
                typeof icon.image !== "string" || icon.image.length > 80_000 || (icon.image && !/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(icon.image)) ||
                (!knownKey && !isCustom)) {
                throw new Error(`${section} icons need unique IDs and order, a name, an enabled setting, and a valid HTTPS URL or blank URL. Uploaded images must be WebP and no larger than 80 KB.`);
            }
            ids.add(icon.id);
            orders.add(icon.order);
        }
    }
    if (typeof next.settings.announcementActive !== "boolean") throw new Error("announcementActive must be true or false.");
    if (!Number.isFinite(Number(next.settings.announcementIntervalMs)) || Number(next.settings.announcementIntervalMs) < 1000 || Number(next.settings.announcementIntervalMs) > 60000) throw new Error("Announcement interval must be between 1 and 60 seconds.");
    if (typeof next.settings.logoUrl !== "string" || next.settings.logoUrl.length > 2048) throw new Error("Logo URL must be text.");
    if (!Array.isArray(next.payments.currencies) || !next.payments.currencies.length || next.payments.currencies.some((currency) => !["LKR", "USD", "GBP", "AUD"].includes(currency)) || new Set(next.payments.currencies).size !== next.payments.currencies.length) throw new Error("Choose one or more supported checkout currencies: LKR, USD, GBP or AUD.");
    if (!next.payments.currencies.includes("USD")) throw new Error("USD must remain available as the store's base price currency.");
    for (const key of ["wiseTransfer", "cashOnDelivery"]) {
        const method = next.payments[key];
        if (!method || typeof method !== "object" || Array.isArray(method) || typeof method.enabled !== "boolean" || !isText(method.instructions)) throw new Error(`Payment method ${key} needs an enabled setting and instructions.`);
    }
    for (const key of ["accountHolder", "bankName", "accountDetails", "swiftBic"]) if (!isText(next.payments.wiseTransfer[key])) throw new Error(`Wise transfer ${key} must be text.`);
    if (next.payments.wiseTransfer.enabled && (!next.payments.wiseTransfer.accountHolder || !next.payments.wiseTransfer.accountDetails || !next.payments.wiseTransfer.instructions)) throw new Error("Add the Wise account holder, account details and transfer instructions before enabling bank transfer.");
    if (!next.payments.wiseTransfer.enabled && !next.payments.cashOnDelivery.enabled) throw new Error("Enable at least one payment method.");
    if (!next.settings.siteAnnouncement || typeof next.settings.siteAnnouncement !== "object" || !isText(next.settings.siteAnnouncement.label) || !isText(next.settings.siteAnnouncement.text)) throw new Error("Store announcement needs a label and text.");
    for (const announcement of next.settings.announcements) {
        if (!announcement || !["audience", "text", "linkText", "link"].every((key) => isText(announcement[key]))) throw new Error("Each announcement needs audience, text, link text and link values.");
    }
    for (const category of next.categories) {
        if (!category || typeof category.slug !== "string" || !/^[a-z0-9-]{1,60}$/.test(category.slug) || !isText(category.label)) throw new Error("Each category needs a valid slug and label.");
        if (category.headlineLines !== undefined && !isTextList(category.headlineLines)) throw new Error(`Category ${category.slug} has invalid headline lines.`);
        for (const key of ["title", "eyebrow", "emphasis", "description", "imageUrl", "imageAlt"]) if (category[key] !== undefined && !isText(category[key])) throw new Error(`Category ${category.slug} has invalid ${key}.`);
        if (category.active !== undefined && typeof category.active !== "boolean") throw new Error(`Category ${category.slug} active must be true or false.`);
    }
    for (const slide of next.home.slides) {
        if (!slide || !isText(slide.eyebrow) || !isTextList(slide.headlineLines) || !isTextList(slide.descriptionLines) || !isText(slide.imageUrl)) throw new Error("Each home slide needs an eyebrow, headline, description and image URL.");
        for (const key of ["emphasis", "imageAlt", "videoUrl", "primaryButtonText", "primaryButtonLink", "secondaryButtonText", "secondaryButtonLink"]) if (slide[key] !== undefined && !isText(slide[key])) throw new Error(`Home slide has invalid ${key}.`);
    }
    for (const key of ["manifesto", "membership", "newsletter"]) {
        const block = next.home[key];
        if (!block || typeof block !== "object" || Array.isArray(block)) throw new Error(`Home ${key} must be an object.`);
    }
    for (const block of [next.home.manifesto, next.home.membership, next.home.newsletter]) {
        for (const [key, value] of Object.entries(block)) {
            if (Array.isArray(value) ? !isTextList(value) : !isText(value)) throw new Error(`Home content has invalid ${key}.`);
        }
    }
    for (const chapter of next.home.story) {
        if (!chapter || !isText(chapter.title) || !Array.isArray(chapter.blocks) || chapter.blocks.length > 40) throw new Error("Each story chapter needs a title and a list of text blocks.");
        for (const block of chapter.blocks) if (!block || !["paragraph", "quote", "closing"].includes(block.type) || !isText(block.text)) throw new Error("Story blocks must contain valid paragraph, quote or closing text.");
    }
    if (!Number.isFinite(Date.parse(next.explore.launchAt))) throw new Error("Explore launchAt must be a valid date.");
    for (const key of ["videoUrl", "posterUrl", "teaserImageUrl"]) if (!isText(next.explore[key])) throw new Error(`Explore ${key} must be text.`);
    for (const drop of next.explore.drops) {
        if (!drop || !["label", "title", "imageUrl", "imageAlt", "videoUrl", "link"].every((key) => isText(drop[key]))) throw new Error("Each Explore drop needs a label, title, media, alt text and link.");
    }
    for (const page of next.pages) {
        if (!page || typeof page.slug !== "string" || !/^[a-z0-9-]{1,80}$/.test(page.slug) || !isText(page.title) || !Array.isArray(page.sections) || page.sections.length > 40) throw new Error("Each content page needs a valid slug, title and section list.");
        for (const section of page.sections) if (!section || !isText(section.heading) || !isText(section.body)) throw new Error("Help page sections need a heading and body.");
    }
    return next;
}
