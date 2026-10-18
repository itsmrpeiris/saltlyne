export const socialIconDefinitions = [
    { key: "facebook", label: "Facebook", order: 1 },
    { key: "pinterest", label: "Pinterest", order: 5 },
    { key: "instagram", label: "Instagram", order: 6 },
    { key: "twitter", label: "Twitter", order: 4 },
    { key: "x", label: "X", order: 3 },
    { key: "threads", label: "Threads", order: 2 },
];

export const paymentIconDefinitions = [
    { key: "visa", label: "Visa", order: 5 },
    { key: "mastercard", label: "Mastercard", order: 4 },
    { key: "amex", label: "American Express", order: 3 },
    { key: "paypal", label: "PayPal", order: 2 },
    { key: "applePay", label: "Apple Pay", order: 1 },
];

const defaultSocialIds = Object.fromEntries(socialIconDefinitions.map(({ key }) => [key, `social-${key}`]));
const defaultPaymentIds = Object.fromEntries(paymentIconDefinitions.map(({ key }) => [key, `payment-${key}`]));

export function createDefaultIconLinks(definitions, prefix) {
    return definitions.map(({ key, label, order }) => ({
        id: `${prefix}-${key}`,
        key,
        name: label,
        enabled: true,
        url: "",
        order,
        image: "",
    }));
}

export function migrateIconCollection(value, definitions, kind) {
    const defaultIds = kind === "social" ? defaultSocialIds : defaultPaymentIds;
    const defaults = createDefaultIconLinks(definitions, kind);

    if (Array.isArray(value)) return value.filter((icon) => icon && typeof icon === "object" && !Array.isArray(icon));

    return definitions.map(({ key, label }, index) => {
        const legacy = value && typeof value === "object" ? value[key] : null;
        return {
            ...defaults[index],
            id: defaultIds[key],
            name: label,
            enabled: legacy?.enabled !== false,
            url: safeExternalUrl(typeof legacy === "string"
                ? legacy
                : typeof legacy?.url === "string" ? legacy.url : typeof legacy?.href === "string" ? legacy.href : ""),
            image: typeof legacy?.image === "string" && /^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(legacy.image)
                ? legacy.image
                : typeof legacy?.imageUrl === "string" && /^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(legacy.imageUrl) ? legacy.imageUrl : "",
        };
    });
}

export function normalizeStoreContentIcons(content) {
    const source = content && typeof content === "object" && !Array.isArray(content) ? content : {};
    const settings = source.settings && typeof source.settings === "object" && !Array.isArray(source.settings)
        ? source.settings
        : {};
    return {
        ...source,
        settings: {
            ...settings,
            social: migrateIconCollection(settings.social, socialIconDefinitions, "social"),
        },
        paymentIcons: migrateIconCollection(source.paymentIcons, paymentIconDefinitions, "payment"),
    };
}

export function safeExternalUrl(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
        const url = new URL(value.trim());
        return url.protocol === "https:" ? url.href : "";
    } catch {
        return "";
    }
}
