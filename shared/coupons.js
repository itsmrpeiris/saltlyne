export function normalizeCoupon(input) {
    const code = String(input.code || "").trim().toUpperCase();
    const type = input.type;
    const value = Number(input.value);
    const minimumSpendUsd = Number(input.minimumSpendUsd || 0);
    const maxRedemptions = input.maxRedemptions === "" || input.maxRedemptions == null ? null : Number(input.maxRedemptions);
    const expiresAt = input.expiresAt ? new Date(input.expiresAt).toISOString() : null;
    if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code)) throw new Error("Coupon codes must be 3–40 letters, numbers, hyphens or underscores.");
    if (!["percentage", "fixed"].includes(type)) throw new Error("Choose a percentage or fixed-amount coupon.");
    if (!Number.isFinite(value) || value <= 0 || (type === "percentage" && value > 100)) throw new Error("Enter a valid discount value.");
    if (!Number.isFinite(minimumSpendUsd) || minimumSpendUsd < 0) throw new Error("Minimum spend must be zero or more.");
    if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1)) throw new Error("Maximum redemptions must be a positive whole number.");
    if (expiresAt && !Number.isFinite(Date.parse(expiresAt))) throw new Error("Enter a valid coupon expiration date.");
    return {
        id: String(input.id || code),
        code,
        type,
        value: Math.round(value * 100) / 100,
        minimumSpendUsd: Math.round(minimumSpendUsd * 100) / 100,
        maxRedemptions,
        expiresAt,
        active: input.active !== false,
        createdAt: input.createdAt || new Date().toISOString(),
    };
}

export function couponDiscount(coupon, subtotalUsd, { redemptionCount = 0, now = Date.now() } = {}) {
    if (!coupon || !coupon.active) throw new Error("That discount code is not active.");
    if (coupon.expiresAt && Date.parse(coupon.expiresAt) <= now) throw new Error("That discount code has expired.");
    if (coupon.maxRedemptions !== null && coupon.maxRedemptions !== undefined && redemptionCount >= coupon.maxRedemptions) throw new Error("That discount code has reached its redemption limit.");
    if (subtotalUsd < Number(coupon.minimumSpendUsd || 0)) throw new Error(`This code requires a minimum spend of $${Number(coupon.minimumSpendUsd).toFixed(2)} USD.`);
    const raw = coupon.type === "percentage" ? subtotalUsd * Number(coupon.value) / 100 : Number(coupon.value);
    return Math.round((Math.min(subtotalUsd, raw) + Number.EPSILON) * 100) / 100;
}
