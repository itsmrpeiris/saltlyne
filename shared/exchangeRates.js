const SUPPORTED_CURRENCIES = ["LKR", "USD", "GBP", "AUD"];
const RATE_ENDPOINT = "https://open.er-api.com/v6/latest/USD";
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const STALE_MAX_AGE_MS = 48 * 60 * 60 * 1000;

let cachedRates;

export async function getUsdExchangeRates() {
    if (cachedRates && Date.now() - cachedRates.fetchedAt < CACHE_MAX_AGE_MS) {
        return publicRates(cachedRates, false);
    }

    try {
        const response = await fetch(RATE_ENDPOINT, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error(`Exchange-rate service returned ${response.status}.`);
        const payload = await response.json();
        if (payload.result !== "success" || payload.base_code !== "USD" || !payload.rates) {
            throw new Error("Exchange-rate service returned invalid USD rates.");
        }
        const rates = Object.fromEntries(SUPPORTED_CURRENCIES.map((currency) => {
            const rate = Number(payload.rates[currency]);
            if (!Number.isFinite(rate) || rate <= 0) throw new Error(`Exchange rate unavailable for ${currency}.`);
            return [currency, rate];
        }));
        cachedRates = {
            base: "USD",
            rates,
            updatedAt: payload.time_last_update_utc ? new Date(payload.time_last_update_utc).toISOString() : new Date().toISOString(),
            fetchedAt: Date.now(),
        };
        return publicRates(cachedRates, false);
    } catch (error) {
        if (cachedRates && Date.now() - cachedRates.fetchedAt <= STALE_MAX_AGE_MS) {
            return publicRates(cachedRates, true);
        }
        throw new Error(`Daily currency conversion is temporarily unavailable. ${error.message}`);
    }
}

function publicRates(rates, stale) {
    return { base: rates.base, rates: rates.rates, updatedAt: rates.updatedAt, stale };
}

export function convertUsdAmount(amount, currency, rates) {
    if (!SUPPORTED_CURRENCIES.includes(currency)) throw new Error("Choose LKR, USD, GBP or AUD.");
    const rate = Number(rates?.rates?.[currency]);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error(`Exchange rate unavailable for ${currency}.`);
    return Math.round((Number(amount) * rate + Number.EPSILON) * 100) / 100;
}
