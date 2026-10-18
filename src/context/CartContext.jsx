import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const CartContext = createContext(null);
const CART_STORAGE_KEY = "saltlyne-cart";
const itemKey = (item) => `${item.id || item.name}::${item.size || ""}`;

function readCart() {
    try {
        const stored = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || "[]");
        return Array.isArray(stored) ? stored : [];
    } catch {
        return [];
    }
}

const supportedCurrencies = ["LKR", "USD", "GBP", "AUD"];

function currencyForLocale() {
    try {
        const region = new Intl.Locale(navigator.language).region;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (region === "LK" || timezone === "Asia/Colombo") return "LKR";
        if (region === "AU" || timezone.startsWith("Australia/")) return "AUD";
        if (region === "GB" || timezone === "Europe/London") return "GBP";
    } catch {}
    return "USD";
}

function readCurrency() {
    try {
        const stored = window.localStorage.getItem("saltlyne-currency");
        return supportedCurrencies.includes(stored) ? stored : currencyForLocale();
    } catch {
        return currencyForLocale();
    }
}

export function CartProvider({ children }) {
    const [items, setItems] = useState(readCart);
    const [currency, setCurrencyState] = useState(readCurrency);
    const [exchangeRates, setExchangeRates] = useState({ USD: 1 });
    const [exchangeRateUpdatedAt, setExchangeRateUpdatedAt] = useState("");
    const [exchangeRatesStale, setExchangeRatesStale] = useState(false);
    const [exchangeRateError, setExchangeRateError] = useState("");

    useEffect(() => {
        let active = true;
        api("/exchange-rates").then((result) => {
            if (!active) return;
            if (!result || typeof result.rates !== "object" || result.rates === null) {
                setExchangeRateError("Exchange rates are unavailable.");
                return;
            }
            setExchangeRates(result.rates);
            setExchangeRateUpdatedAt(result.updatedAt || "");
            setExchangeRatesStale(Boolean(result.stale));
        }).catch((error) => {
            if (active) setExchangeRateError(error.message);
        });
        return () => { active = false; };
    }, []);

    const setCurrency = useCallback((nextCurrency) => {
        if (!supportedCurrencies.includes(nextCurrency)) throw new Error("Unsupported currency.");
        setCurrencyState(nextCurrency);
        try { window.localStorage.setItem("saltlyne-currency", nextCurrency); } catch {}
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
        } catch {
            // The in-memory cart remains usable when storage is unavailable.
        }
    }, [items]);

    const value = useMemo(() => {
        const addItem = (product) => setItems((current) => {
            const existing = current.find((item) => itemKey(item) === itemKey(product));
            return existing
                ? current.map((item) => itemKey(item) === itemKey(product) ? { ...item, quantity: item.quantity + 1 } : item)
                : [...current, { ...product, quantity: 1 }];
        });
        const matchesItem = (item, target) => typeof target === "string" ? item.name === target : itemKey(item) === itemKey(target);
        const changeQuantity = (target, amount) => setItems((current) => current
            .map((item) => matchesItem(item, target) ? { ...item, quantity: item.quantity + amount } : item)
            .filter((item) => item.quantity > 0));
        const removeItem = (target) => setItems((current) => current.filter((item) => !matchesItem(item, target)));
        const clearCart = () => setItems([]);
        const count = items.reduce((sum, item) => sum + item.quantity, 0);
        const total = items.reduce((sum, item) => sum + item.priceValue * item.quantity, 0);
        const configuredRate = Number(exchangeRates[currency]);
        const hasCurrencyRate = Number.isFinite(configuredRate) && configuredRate > 0;
        const exchangeRate = hasCurrencyRate ? configuredRate : 1;
        const displayCurrency = hasCurrencyRate ? currency : "USD";
        const formatMoney = (amount) => new Intl.NumberFormat(undefined, { style: "currency", currency: displayCurrency }).format(Number(amount || 0) * exchangeRate);
        return { items, addItem, changeQuantity, removeItem, clearCart, count, total, currency, setCurrency, exchangeRate, exchangeRates, exchangeRateUpdatedAt, exchangeRatesStale, exchangeRateError, formatMoney };
    }, [items, currency, setCurrency, exchangeRates, exchangeRateUpdatedAt, exchangeRatesStale, exchangeRateError]);

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
    const cart = useContext(CartContext);
    if (!cart) throw new Error("useCart must be used inside CartProvider");
    return cart;
}

export const formatPrice = (value) => `$${Number(value).toFixed(2)}`;
