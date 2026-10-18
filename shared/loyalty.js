export const POINTS_PER_USD = 1;
export const REDEEM_POINTS_PER_USD = 20;
export const MINIMUM_REDEMPTION_POINTS = 100;

export function pointsForUsd(amount) {
    return Math.max(0, Math.floor(Number(amount) * POINTS_PER_USD));
}

export function discountForPoints(points) {
    const count = Math.max(0, Math.floor(Number(points) || 0));
    return Math.round((count / REDEEM_POINTS_PER_USD + Number.EPSILON) * 100) / 100;
}

export function normalizeAddresses(addresses) {
    if (!Array.isArray(addresses)) throw new Error("Addresses must be a list.");
    if (addresses.length > 10) throw new Error("You can save up to 10 addresses.");
    const seen = new Set();
    return addresses.map((address) => {
        if (!address || typeof address !== "object" || Array.isArray(address)) throw new Error("Each address must be a valid address record.");
        const id = String(address.id || "");
        const label = String(address.label || "").trim().slice(0, 40);
        const fullName = String(address.fullName || "").trim().slice(0, 120);
        const line1 = String(address.line1 || "").trim().slice(0, 180);
        const line2 = String(address.line2 || "").trim().slice(0, 180);
        const city = String(address.city || "").trim().slice(0, 100);
        const region = String(address.region || "").trim().slice(0, 100);
        const postcode = String(address.postcode || "").trim().slice(0, 30);
        const country = String(address.country || "").trim().slice(0, 80);
        const phone = String(address.phone || "").trim().slice(0, 40);
        if (!/^[\w-]{1,80}$/.test(id) || seen.has(id) || !label || !fullName || !line1 || !city || !country) {
            throw new Error("Each address needs a unique ID, label, name, street address, city, and country.");
        }
        seen.add(id);
        return { id, label, fullName, line1, line2, city, region, postcode, country, phone, isDefault: Boolean(address.isDefault) };
    });
}
