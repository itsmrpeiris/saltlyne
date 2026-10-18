import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path, { extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seedProducts, slugify } from "../shared/catalog.js";
import { convertUsdAmount, getUsdExchangeRates } from "../shared/exchangeRates.js";
import { hashPassword, isValidEmail, normalizeEmail, validatePassword, verifyPassword } from "../shared/customerAuth.js";
import { normalizeCustomerName, splitCustomerName } from "../shared/customerNames.js";
import { createDefaultStoreContent, mergeStoreContent } from "../shared/storeContent.js";
import { publicSiteUrl, sendEmailBatch, supportEmail } from "../shared/email.js";
import { newsletterCampaignEmail, newsletterWelcomeEmail, orderConfirmationEmail, orderUpdateEmail, passwordResetEmail, supportNotificationEmail, supportReceiptEmail } from "../shared/emailTemplates.js";
import { normalizeNewsletterBlocks, normalizeNewsletterDesign } from "../shared/newsletter.js";
import { couponDiscount, normalizeCoupon } from "../shared/coupons.js";
import { discountForPoints, MINIMUM_REDEMPTION_POINTS, normalizeAddresses, pointsForUsd, REDEEM_POINTS_PER_USD } from "../shared/loyalty.js";
import { hashPasswordResetToken, isPasswordResetRequestAllowed, isPasswordResetTokenValid, PASSWORD_RESET_TOKEN_TTL_MS } from "../shared/passwordReset.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(root, "data");
const dbFile = resolve(process.env.STORE_DATA_FILE || path.join(dataDir, "store.json"));
const port = Number(process.env.PORT || process.env.API_PORT || 3001);
const staticDir = resolve(root, "../dist");
const adminEmail = process.env.ADMIN_EMAIL || "owner@saltlynelabel.com";
const adminPassword = process.env.ADMIN_PASSWORD;
const corsOrigins = new Set((process.env.CORS_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean));
const sessions = new Map();
const dummyCustomerPasswordHash = hashPassword(randomBytes(32).toString("hex"));

const seed = {
    products: seedProducts,
    orders: [],
    customers: [],
    passwordResetTokens: [],
    coupons: [],
    newsletterSubscribers: [],
    siteContent: createDefaultStoreContent(),
};

await mkdir(path.dirname(dbFile), { recursive: true });
let database;
try { database = JSON.parse(await readFile(dbFile, "utf8")); }
catch { database = seed; await save(); }
const storedSiteContent = JSON.stringify(database.siteContent || {});
database = {
    ...seed,
    ...database,
    customers: Array.isArray(database.customers) ? database.customers : [],
    passwordResetTokens: Array.isArray(database.passwordResetTokens) ? database.passwordResetTokens : [],
    coupons: Array.isArray(database.coupons) ? database.coupons : [],
    newsletterSubscribers: Array.isArray(database.newsletterSubscribers) ? database.newsletterSubscribers : [],
    siteContent: mergeStoreContent(seed.siteContent, database.siteContent || {}),
};
if (JSON.stringify(database.siteContent) !== storedSiteContent) await save();

for (const customer of database.customers) {
    customer.addresses = Array.isArray(customer.addresses) ? customer.addresses : [];
    customer.loyaltyPoints = Math.max(0, Number(customer.loyaltyPoints) || 0);
    if (customer.loyaltyInitialized) continue;
    for (const order of database.orders) {
        if (order.status === "cancelled" || order.loyaltyPointsEarned || (order.customerId !== customer.id && normalizeEmail(order.customer?.email) !== customer.email)) continue;
        const earned = pointsForUsd(order.baseTotal ?? order.total);
        customer.loyaltyPoints += earned;
        order.loyaltyPointsEarned = earned;
    }
    customer.loyaltyInitialized = true;
}

const seededById = new Map(seedProducts.map((product) => [product.id, product]));
const retiredProductIds = new Set(["coastline-leggings"]);
database.products = (database.products || []).filter((product) => !retiredProductIds.has(product.id));
const existingIds = new Set(database.products.map((product) => product.id));
const salesByProduct = new Map();
for (const order of database.orders || []) {
    if (order.status === "cancelled") continue;
    for (const line of order.items || []) salesByProduct.set(line.id, (salesByProduct.get(line.id) || 0) + Math.max(0, Number(line.quantity) || 0));
}
database.products = [
    ...(database.products || []).map((product) => {
        const defaults = seededById.get(product.id) || {};
        return {
            ...defaults,
            ...product,
            image: !product.gender && String(product.image || "").startsWith("photo-") && defaults.image ? defaults.image : product.image || defaults.image,
            createdAt: product.createdAt || defaults.createdAt || new Date().toISOString(),
            gender: product.gender || defaults.gender || "women",
            category: product.category || defaults.category || "tops",
            subcategory: product.subcategory || defaults.subcategory || "essentials",
            collection: product.collection || defaults.collection || "Everyday Essentials",
            activity: product.activity || defaults.activity || "everyday",
            sizes: Array.isArray(product.sizes) ? product.sizes : defaults.sizes || [],
            colors: Array.isArray(product.colors) ? product.colors : defaults.colors || [product.tone || "Black"],
            images: Array.isArray(product.images) ? product.images.filter((image) => typeof image === "string").slice(0, 20) : defaults.images || [],
            featured: Boolean(product.featured ?? defaults.featured),
            bestSeller: Boolean(product.bestSeller ?? defaults.bestSeller),
            trendingMode: ["auto", "on", "off"].includes(product.trendingMode) ? product.trendingMode : defaults.trendingMode || "auto",
            unitsSold: Math.max(0, Number(product.unitsSold ?? defaults.unitsSold) || 0, salesByProduct.get(product.id) || 0),
            onSale: Boolean(product.onSale ?? defaults.onSale),
            salePrice: Number(product.salePrice ?? defaults.salePrice) || undefined,
        };
    }),
    ...seedProducts.filter((product) => !existingIds.has(product.id)),
];
await save();

function productsWithMerchandising(products) {
    const topIdsByDepartment = (eligible) => {
        const departments = new Map();
        for (const product of products) {
            if (!product.active || !eligible(product)) continue;
            const departmentProducts = departments.get(product.gender) || [];
            departmentProducts.push(product);
            departments.set(product.gender, departmentProducts);
        }
        return new Set([...departments.values()].flatMap((departmentProducts) => departmentProducts
            .sort((a, b) => Number(b.unitsSold) - Number(a.unitsSold))
            .slice(0, 3)
            .map((product) => product.id)));
    };
    const autoTrendingIds = topIdsByDepartment((product) => product.trendingMode === "auto" && Number(product.unitsSold) > 0);
    const bestSellerIds = topIdsByDepartment((product) => Number(product.unitsSold) > 0);
    return products.map((product) => ({
        ...product,
        isTrending: product.trendingMode === "on" || (product.trendingMode === "auto" && autoTrendingIds.has(product.id)),
        isBestSeller: Boolean(product.bestSeller || bestSellerIds.has(product.id)),
    }));
}

async function save() { await writeFile(dbFile, JSON.stringify(database, null, 2)); }
function send(res, status, value, headers = {}) { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer", ...headers }); res.end(JSON.stringify(value)); }
async function body(req) {
    let value = "";
    for await (const part of req) { value += part; if (value.length > 3_500_000) throw new Error("Request too large"); }
    return value ? JSON.parse(value) : {};
}
function cookie(req, name) { return (req.headers.cookie || "").split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1); }
function authenticated(req) {
    const token = cookie(req, "saltlyne_session");
    const session = token && sessions.get(token);
    if (!session || session.scope !== "admin") return false;
    if (session.expires < Date.now()) { sessions.delete(token); return false; }
    return true;
}
function customerForRequest(req) {
    const token = cookie(req, "saltlyne_customer_session");
    const session = token && sessions.get(token);
    if (!session || session.scope !== "customer" || !session.customerId) return null;
    if (session.expires < Date.now()) { sessions.delete(token); return null; }
    return database.customers.find((customer) => customer.id === session.customerId) || null;
}
function publicCustomer(customer) {
    const nameParts = splitCustomerName(customer.name);
    return { id: customer.id, email: customer.email, name: customer.name, firstName: customer.firstName || nameParts.firstName, lastName: customer.lastName ?? nameParts.lastName, phone: customer.phone || "", createdAt: customer.createdAt, lastLoginAt: customer.lastLoginAt || null, addresses: customer.addresses || [], loyaltyPoints: Math.max(0, Number(customer.loyaltyPoints) || 0) };
}
function setCustomerSession(res, customer, clear = false) {
    if (clear) return res.setHeader("set-cookie", "saltlyne_customer_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    const token = randomBytes(32).toString("hex");
    sessions.set(token, { scope: "customer", customerId: customer.id, expires: Date.now() + 1000 * 60 * 60 * 24 * 30 });
    return res.setHeader("set-cookie", `saltlyne_customer_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
}
const authAttempts = new Map();
function authRateLimited(req, scope) {
    const key = `${scope}:${req.socket.remoteAddress || "unknown"}`;
    const now = Date.now();
    const recent = (authAttempts.get(key) || []).filter((time) => now - time < 60_000);
    recent.push(now);
    authAttempts.set(key, recent);
    return recent.length > 10;
}
function safeEqual(left, right) {
    const a = Buffer.from(left); const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
}

const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
        const route = url.pathname;
        const origin = req.headers.origin;
        if (origin && corsOrigins.has(origin)) {
            res.setHeader("access-control-allow-origin", origin);
            res.setHeader("access-control-allow-credentials", "true");
            res.setHeader("access-control-allow-methods", "GET, POST, PATCH, DELETE, OPTIONS");
            res.setHeader("access-control-allow-headers", "content-type");
            res.setHeader("vary", "Origin");
        }
        if (req.method === "OPTIONS" && route.startsWith("/api/")) {
            if (!origin || !corsOrigins.has(origin)) return send(res, 403, { error: "Origin is not allowed." });
            res.writeHead(204); return res.end();
        }
        if (route === "/api/health" && req.method === "GET") return send(res, 200, { ok: true });
        if (route === "/api/exchange-rates" && req.method === "GET") {
            try { return send(res, 200, await getUsdExchangeRates()); }
            catch (error) { return send(res, 503, { error: error.message }); }
        }
        if (route === "/api/products" && req.method === "GET") return send(res, 200, productsWithMerchandising(database.products).filter((item) => item.active));
        if (route.startsWith("/api/products/") && req.method === "GET") {
            const slug = decodeURIComponent(route.slice("/api/products/".length));
            const product = productsWithMerchandising(database.products).find((item) => item.active && (item.id === slug || slugify(item.name) === slug));
            return product ? send(res, 200, product) : send(res, 404, { error: "Product not found." });
        }
        if (route === "/api/store-content" && req.method === "GET") return send(res, 200, database.siteContent);
        if (route === "/api/coupons/validate" && req.method === "POST") {
            const requestData = await body(req);
            const code = String(requestData.code || "").trim().toUpperCase();
            if (!Array.isArray(requestData.items) || !requestData.items.length || requestData.items.length > 100) return send(res, 400, { error: "Your bag is empty or invalid." });
            let subtotalUsd = 0;
            for (const line of requestData.items) {
                const product = database.products.find((item) => item.id === line.id && item.active);
                if (!product) return send(res, 400, { error: "A product in your bag is no longer available." });
                const price = product.onSale && Number(product.salePrice) > 0 && Number(product.salePrice) < Number(product.price) ? Number(product.salePrice) : Number(product.price);
                subtotalUsd += price * Math.max(1, Math.min(20, Number(line.quantity) || 1));
            }
            const coupon = database.coupons.find((item) => item.code === code);
            const redemptionCount = database.orders.filter((item) => item.status !== "cancelled" && item.couponCode === code).length;
            let discountUsd;
            try { discountUsd = couponDiscount(coupon, subtotalUsd, { redemptionCount }); }
            catch (error) { return send(res, 400, { error: error.message }); }
            const customer = customerForRequest(req);
            if (customer && database.orders.some((item) => item.status !== "cancelled" && item.couponCode === code && (item.customerId === customer.id || normalizeEmail(item.customer?.email) === customer.email))) {
                return send(res, 400, { error: "This discount code has already been used on your account." });
            }
            return send(res, 200, { code, subtotalUsd, discountUsd });
        }
        if (route === "/api/newsletter" && req.method === "POST") {
            if (authRateLimited(req, "newsletter")) return send(res, 429, { error: "Too many signup attempts. Please try again shortly." });
            const submission = await body(req);
            const email = normalizeEmail(submission.email);
            if (!isValidEmail(email)) return send(res, 400, { error: "Enter a valid email address." });
            if (submission.consent !== true) return send(res, 400, { error: "Please confirm you want to receive Saltlyne email updates." });
            const existing = database.newsletterSubscribers.find((subscriber) => subscriber.email === email);
            if (existing && !existing.unsubscribedAt) return send(res, 200, { ok: true, alreadySubscribed: true });
            const subscriber = existing || { email, createdAt: new Date().toISOString() };
            subscriber.name = String(submission.name || subscriber.name || "").trim().slice(0, 120);
            subscriber.unsubscribeToken = randomBytes(32).toString("base64url");
            subscriber.consentAt = new Date().toISOString();
            delete subscriber.unsubscribedAt;
            if (!existing) database.newsletterSubscribers.unshift(subscriber);
            await save();
            const origin = publicSiteUrl(process.env.NODE_ENV === "production" ? "https://saltlyne.com" : "http://localhost:5173");
            const delivery = await sendEmailBatch([newsletterWelcomeEmail({
                email,
                name: subscriber.name,
                unsubscribeUrl: `${origin}/newsletter/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribeToken)}`,
            })]);
            return send(res, 201, { ok: true, emailSent: delivery.failed === 0 });
        }
        if (route === "/api/newsletter/unsubscribe" && req.method === "POST") {
            const { token } = await body(req);
            const subscriber = database.newsletterSubscribers.find((entry) => entry.unsubscribeToken === token);
            if (!subscriber) return send(res, 404, { error: "That unsubscribe link is invalid or expired." });
            subscriber.unsubscribedAt = new Date().toISOString();
            await save();
            return send(res, 200, { ok: true });
        }
        if (route === "/api/support" && req.method === "POST") {
            if (authRateLimited(req, "support")) return send(res, 429, { error: "Too many messages sent. Please try again shortly." });
            const submission = await body(req);
            const name = String(submission.name || "").trim().slice(0, 120);
            const email = normalizeEmail(submission.email);
            const subject = String(submission.subject || "").trim().slice(0, 160);
            const message = String(submission.message || "").trim().slice(0, 5000);
            if (!name || !isValidEmail(email) || !subject || /[\r\n]/.test(subject) || message.length < 10) {
                return send(res, 400, { error: "Enter your name, a valid email, a subject, and a message of at least 10 characters." });
            }
            const supportAddress = supportEmail();
            const delivery = await sendEmailBatch([
                supportNotificationEmail({ name, email, subject, message, supportEmail: supportAddress }),
                supportReceiptEmail({ name, email, subject, supportEmail: supportAddress }),
            ]);
            return send(res, 200, { ok: delivery.failed === 0, supportEmailSent: delivery.statuses[0], customerReceiptSent: delivery.statuses[1] });
        }
        if (route === "/api/account/register" && req.method === "POST") {
            if (authRateLimited(req, "register")) return send(res, 429, { error: "Too many attempts. Please try again shortly." });
            const details = await body(req);
            const email = normalizeEmail(details.email);
            if (!isValidEmail(email)) return send(res, 400, { error: "Enter a valid email address." });
            try { validatePassword(details.password); }
            catch (error) { return send(res, 400, { error: error.message }); }
            let nameParts;
            try { nameParts = normalizeCustomerName(details); }
            catch (error) { return send(res, 400, { error: error.message }); }
            const { name, firstName, lastName } = nameParts;
            if (database.customers.some((customer) => customer.email === email)) return send(res, 409, { error: "An account with that email already exists." });
            const createdAt = new Date().toISOString();
            const customer = { id: `customer-${randomBytes(12).toString("hex")}`, email, name, firstName, lastName, phone: "", addresses: [], loyaltyPoints: 0, loyaltyInitialized: false, passwordHash: hashPassword(details.password), createdAt, lastLoginAt: createdAt };
            for (const order of database.orders) {
                if (order.status === "cancelled" || order.loyaltyPointsEarned || normalizeEmail(order.customer?.email) !== email) continue;
                const earned = pointsForUsd(order.baseTotal ?? order.total);
                customer.loyaltyPoints += earned;
                order.loyaltyPointsEarned = earned;
            }
            customer.loyaltyInitialized = true;
            database.customers.push(customer);
            for (const order of database.orders) {
                if (normalizeEmail(order.customer?.email) === email) order.customerId = customer.id;
            }
            await save();
            setCustomerSession(res, customer);
            return send(res, 201, publicCustomer(customer));
        }
        if (route === "/api/account/login" && req.method === "POST") {
            if (authRateLimited(req, "login")) return send(res, 429, { error: "Too many attempts. Please try again shortly." });
            const credentials = await body(req);
            const email = normalizeEmail(credentials.email);
            const password = typeof credentials.password === "string" && credentials.password.length <= 128 ? credentials.password : "";
            const customer = database.customers.find((entry) => entry.email === email);
            if (!verifyPassword(password, customer?.passwordHash || dummyCustomerPasswordHash)) return send(res, 401, { error: "Email or password is incorrect." });
            customer.lastLoginAt = new Date().toISOString();
            await save();
            setCustomerSession(res, customer);
            return send(res, 200, publicCustomer(customer));
        }
        if (route === "/api/account/password-reset/request" && req.method === "POST") {
            if (authRateLimited(req, "password-reset")) return send(res, 429, { error: "Too many attempts. Please try again shortly." });
            const email = normalizeEmail((await body(req)).email);
            const customer = isValidEmail(email) ? database.customers.find((entry) => entry.email === email) : null;
            if (customer) {
                const existing = database.passwordResetTokens.find((entry) => entry.customerId === customer.id);
                if (isPasswordResetRequestAllowed(existing?.createdAt)) {
                    const token = randomBytes(32).toString("base64url");
                    const tokenHash = hashPasswordResetToken(token);
                    const createdAt = new Date().toISOString();
                    database.passwordResetTokens = database.passwordResetTokens.filter((entry) => entry.customerId !== customer.id);
                    database.passwordResetTokens.push({
                        customerId: customer.id,
                        tokenHash,
                        createdAt,
                        expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS).toISOString(),
                    });
                    await save();
                    const siteUrl = publicSiteUrl(process.env.NODE_ENV === "production" ? "https://saltlyne.com" : "http://localhost:5173");
                    const delivery = await sendEmailBatch([passwordResetEmail({
                        name: customer.name,
                        email: customer.email,
                        resetUrl: `${siteUrl}/account/reset-password?token=${encodeURIComponent(token)}`,
                    })]);
                    if (delivery.failed) {
                        database.passwordResetTokens = database.passwordResetTokens.filter((entry) => entry.tokenHash !== tokenHash);
                        await save();
                    }
                }
            }
            return send(res, 200, { ok: true, message: "If an account exists for that email, password reset instructions will be sent." });
        }
        if (route === "/api/account/password-reset/complete" && req.method === "POST") {
            if (authRateLimited(req, "password-reset-complete")) return send(res, 429, { error: "Too many attempts. Please try again shortly." });
            const changes = await body(req);
            try { validatePassword(changes.password); }
            catch (error) { return send(res, 400, { error: error.message }); }
            const token = typeof changes.token === "string" && /^[A-Za-z0-9_-]{43}$/.test(changes.token) ? changes.token : "";
            const tokenHash = hashPasswordResetToken(token);
            const reset = database.passwordResetTokens.find((entry) => entry.tokenHash === tokenHash && isPasswordResetTokenValid(entry.expiresAt));
            const customer = reset && database.customers.find((entry) => entry.id === reset.customerId);
            if (!customer) return send(res, 400, { error: "That password reset link is invalid or expired. Request a new one." });
            customer.passwordHash = hashPassword(changes.password);
            database.passwordResetTokens = database.passwordResetTokens.filter((entry) => entry.customerId !== customer.id);
            for (const [sessionToken, session] of sessions) {
                if (session.scope === "customer" && session.customerId === customer.id) sessions.delete(sessionToken);
            }
            await save();
            return send(res, 200, { ok: true });
        }
        if (route === "/api/account/logout" && req.method === "POST") {
            const token = cookie(req, "saltlyne_customer_session");
            if (token) sessions.delete(token);
            return send(res, 200, { ok: true }, { "set-cookie": "saltlyne_customer_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" });
        }
        if (route.startsWith("/api/account/")) {
            const customer = customerForRequest(req);
            if (!customer) return send(res, 401, { error: "Sign in required." });
            if (route === "/api/account/me" && req.method === "GET") return send(res, 200, publicCustomer(customer));
            if (route === "/api/account/profile" && req.method === "PATCH") {
                const changes = await body(req);
                let nameParts;
                try {
                    nameParts = normalizeCustomerName(
                        changes.firstName !== undefined || changes.lastName !== undefined
                            ? changes
                            : changes.name !== undefined ? { name: changes.name } : { firstName: customer.firstName, lastName: customer.lastName },
                    );
                } catch (error) { return send(res, 400, { error: error.message }); }
                const phone = String(changes.phone ?? customer.phone ?? "").trim().slice(0, 40);
                Object.assign(customer, nameParts);
                customer.phone = phone;
                await save();
                return send(res, 200, publicCustomer(customer));
            }
            if (route === "/api/account/addresses" && req.method === "PUT") {
                try {
                    const addresses = normalizeAddresses((await body(req)).addresses);
                    const defaults = addresses.filter((address) => address.isDefault);
                    if (defaults.length > 1) return send(res, 400, { error: "Choose only one default address." });
                    customer.addresses = addresses.map((address, index) => ({ ...address, isDefault: defaults.length ? address.isDefault : index === 0 }));
                    await save();
                    return send(res, 200, { addresses: customer.addresses });
                } catch (error) { return send(res, 400, { error: error.message }); }
            }
            if (route === "/api/account/rewards" && req.method === "GET") {
                const orders = database.orders.filter((order) => order.customerId === customer.id || normalizeEmail(order.customer?.email) === customer.email);
                return send(res, 200, {
                    points: Math.max(0, Number(customer.loyaltyPoints) || 0),
                    pointsPerUsd: 1,
                    redemption: { points: MINIMUM_REDEMPTION_POINTS, discountUsd: 5 },
                    history: orders.flatMap((order) => [
                        ...(order.loyaltyPointsEarned ? [{ orderId: order.id, type: "earned", points: order.loyaltyPointsEarned, date: order.createdAt }] : []),
                        ...(order.loyaltyPointsRedeemed ? [{ orderId: order.id, type: "redeemed", points: -order.loyaltyPointsRedeemed, date: order.createdAt }] : []),
                        ...(order.loyaltyPointsEarnedReversed ? [{ orderId: order.id, type: "earning_reversed", points: -order.loyaltyPointsEarnedReversed, date: order.updatedAt || order.createdAt }] : []),
                        ...(order.loyaltyPointsRedeemedRestored ? [{ orderId: order.id, type: "redemption_refunded", points: order.loyaltyPointsRedeemedRestored, date: order.updatedAt || order.createdAt }] : []),
                        ...(order.couponCode ? [{ orderId: order.id, type: "discount", code: order.couponCode, amountUsd: order.couponDiscountUsd, date: order.createdAt }] : []),
                    ]).sort((a, b) => String(b.date).localeCompare(String(a.date))),
                });
            }
            if (route === "/api/account/password" && req.method === "POST") {
                const changes = await body(req);
                if (!verifyPassword(String(changes.currentPassword || ""), customer.passwordHash)) return send(res, 401, { error: "Current password is incorrect." });
                try { validatePassword(changes.password); }
                catch (error) { return send(res, 400, { error: error.message }); }
                customer.passwordHash = hashPassword(changes.password);
                for (const [token, session] of sessions) {
                    if (session.scope === "customer" && session.customerId === customer.id) sessions.delete(token);
                }
                setCustomerSession(res, customer);
                await save();
                return send(res, 200, { ok: true });
            }
            if (route === "/api/account/orders" && req.method === "GET") {
                const orders = database.orders.filter((order) => order.customerId === customer.id || normalizeEmail(order.customer?.email) === customer.email);
                return send(res, 200, orders.map(({ customer: orderCustomer, ...order }) => ({ ...order, customer: { name: orderCustomer?.name || "", email: orderCustomer?.email || "" } })));
            }
            return send(res, 404, { error: "Not found." });
        }
        if (route === "/api/orders/track" && req.method === "POST") {
            const lookup = await body(req);
            const email = normalizeEmail(lookup.email);
            const order = database.orders.find((item) => item.id === String(lookup.orderId || "").trim() && normalizeEmail(item.customer?.email) === email && isValidEmail(email));
            return order
                ? send(res, 200, { id: order.id, createdAt: order.createdAt, status: order.status, total: order.total, currency: order.currency || "USD", paymentMethod: order.paymentMethod || "", paymentStatus: order.paymentStatus || "", items: order.items })
                : send(res, 404, { error: "We couldn't find an order with those details." });
        }
        if (route === "/api/auth/login" && req.method === "POST") {
            if (!adminPassword) return send(res, 503, { error: "Admin login is not configured. Set ADMIN_PASSWORD in .env." });
            const credentials = await body(req);
            const valid = String(credentials.email || "").toLowerCase() === adminEmail.toLowerCase() && safeEqual(String(credentials.password || ""), adminPassword);
            if (!valid) return send(res, 401, { error: "Email or password is incorrect." });
            const token = randomBytes(32).toString("hex");
            sessions.set(token, { scope: "admin", expires: Date.now() + 1000 * 60 * 60 * 12 });
            return send(res, 200, { email: adminEmail }, { "set-cookie": `saltlyne_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${process.env.NODE_ENV === "production" ? "; Secure" : ""}` });
        }
        if (route === "/api/auth/me" && req.method === "GET") return authenticated(req) ? send(res, 200, { email: adminEmail }) : send(res, 401, { error: "Sign in required." });
        if (route === "/api/auth/logout" && req.method === "POST") { const token = cookie(req, "saltlyne_session"); if (token) sessions.delete(token); return send(res, 200, { ok: true }, { "set-cookie": "saltlyne_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" }); }

        if (route.startsWith("/api/admin/") && !authenticated(req)) return send(res, 401, { error: "Sign in required." });
        if (route === "/api/admin/store-content" && req.method === "GET") return send(res, 200, database.siteContent);
        if (route === "/api/admin/store-content" && req.method === "PUT") {
            database.siteContent = mergeStoreContent(database.siteContent, await body(req));
            await save();
            return send(res, 200, database.siteContent);
        }
        if (route === "/api/admin/coupons" && req.method === "GET") return send(res, 200, database.coupons);
        if (route === "/api/admin/coupons" && req.method === "POST") {
            let coupon;
            try { coupon = normalizeCoupon(await body(req)); }
            catch (error) { return send(res, 400, { error: error.message }); }
            if (database.coupons.some((item) => item.code === coupon.code)) return send(res, 409, { error: "A coupon with that code already exists." });
            coupon.redemptions = 0;
            database.coupons.unshift(coupon);
            await save();
            return send(res, 201, coupon);
        }
        if (route.startsWith("/api/admin/coupons/") && req.method === "PATCH") {
            const code = decodeURIComponent(route.split("/").at(-1)).toUpperCase();
            const index = database.coupons.findIndex((item) => item.code === code);
            if (index < 0) return send(res, 404, { error: "Coupon not found." });
            let coupon;
            try { coupon = normalizeCoupon({ ...database.coupons[index], ...await body(req), id: database.coupons[index].id }); }
            catch (error) { return send(res, 400, { error: error.message }); }
            if (database.coupons.some((item, itemIndex) => itemIndex !== index && item.code === coupon.code)) return send(res, 409, { error: "A coupon with that code already exists." });
            coupon.redemptions = Number(database.coupons[index].redemptions) || 0;
            database.coupons[index] = coupon;
            await save();
            return send(res, 200, coupon);
        }
        if (route.startsWith("/api/admin/coupons/") && req.method === "DELETE") {
            const code = decodeURIComponent(route.split("/").at(-1)).toUpperCase();
            database.coupons = database.coupons.filter((item) => item.code !== code);
            await save();
            return send(res, 200, { ok: true });
        }
        if (route === "/api/admin/customers" && req.method === "GET") {
            const customers = database.customers.map((customer) => {
                const orders = database.orders.filter((order) => order.customerId === customer.id || normalizeEmail(order.customer?.email) === customer.email);
                const activeOrders = orders.filter((order) => order.status !== "cancelled");
                const subscriber = database.newsletterSubscribers.find((entry) => normalizeEmail(entry.email) === customer.email);
                return {
                    id: customer.id,
                    name: customer.name,
                    email: customer.email,
                    phone: customer.phone || "",
                    createdAt: customer.createdAt,
                    lastLoginAt: customer.lastLoginAt || null,
                    loyaltyPoints: Math.max(0, Number(customer.loyaltyPoints) || 0),
                    orderCount: orders.length,
                    totalSpentUsd: Math.round(activeOrders.reduce((sum, order) => sum + (Number(order.baseTotal ?? order.total) || 0), 0) * 100) / 100,
                    lastOrderAt: orders.map((order) => order.createdAt).filter(Boolean).sort().at(-1) || null,
                    newsletter: subscriber ? { subscribedAt: subscriber.consentAt || subscriber.createdAt || null, unsubscribedAt: subscriber.unsubscribedAt || null } : null,
                };
            }).sort((left, right) => String(right.lastLoginAt || right.createdAt || "").localeCompare(String(left.lastLoginAt || left.createdAt || "")));
            return send(res, 200, customers);
        }
        if (route.startsWith("/api/admin/customers/") && req.method === "GET") {
            const id = decodeURIComponent(route.slice("/api/admin/customers/".length));
            const customer = database.customers.find((entry) => entry.id === id);
            if (!customer) return send(res, 404, { error: "Customer profile not found." });
            const orders = database.orders.filter((order) => order.customerId === customer.id || normalizeEmail(order.customer?.email) === customer.email)
                .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")))
                .map((order) => ({
                    id: order.id,
                    createdAt: order.createdAt,
                    status: order.status,
                    total: order.total,
                    currency: order.currency || "USD",
                    baseTotal: order.baseTotal ?? order.total,
                    baseSubtotal: order.baseSubtotal ?? order.baseTotal ?? order.total,
                    paymentMethod: order.paymentMethod || "",
                    paymentStatus: order.paymentStatus || "",
                    deliveryAddress: order.customer?.address || "",
                    items: order.items || [],
                    couponCode: order.couponCode || "",
                    couponDiscountUsd: Number(order.couponDiscountUsd) || 0,
                    pointsDiscountUsd: Number(order.pointsDiscountUsd) || 0,
                    loyaltyPointsEarned: Number(order.loyaltyPointsEarned) || 0,
                    loyaltyPointsRedeemed: Number(order.loyaltyPointsRedeemed) || 0,
                }));
            const subscriber = database.newsletterSubscribers.find((entry) => normalizeEmail(entry.email) === customer.email);
            return send(res, 200, {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone || "",
                createdAt: customer.createdAt,
                lastLoginAt: customer.lastLoginAt || null,
                addresses: Array.isArray(customer.addresses) ? customer.addresses : [],
                loyaltyPoints: Math.max(0, Number(customer.loyaltyPoints) || 0),
                newsletter: subscriber ? { subscribedAt: subscriber.consentAt || subscriber.createdAt || null, unsubscribedAt: subscriber.unsubscribedAt || null } : null,
                orders,
            });
        }
        if (route === "/api/admin/newsletter" && req.method === "GET") return send(res, 200, database.newsletterSubscribers.map(({ unsubscribeToken: _unsubscribeToken, ...subscriber }) => subscriber));
        if (route === "/api/admin/newsletter/campaign" && req.method === "POST") {
            const campaign = await body(req);
            const subject = String(campaign.subject || "").trim().slice(0, 160);
            if (!subject || /[\r\n]/.test(subject)) return send(res, 400, { error: "Enter a valid campaign subject." });
            let blocks;
            let design;
            try {
                blocks = normalizeNewsletterBlocks(campaign.blocks);
                design = normalizeNewsletterDesign(campaign.design);
            } catch (err) { return send(res, 400, { error: err.message }); }
            if (blocks.reduce((total, block) => total + (block.type === "image" ? block.image.length : 0), 0) > 1_600_000) return send(res, 400, { error: "Newsletter images exceed the combined 1.2 MB limit." });
            if (!Array.isArray(campaign.selectedEmails) || campaign.selectedEmails.length > 5000) return send(res, 400, { error: "Select up to 5,000 newsletter recipients." });
            const selectedEmails = [...new Set(campaign.selectedEmails.filter((email) => typeof email === "string").map((email) => email.trim().toLowerCase()))];
            if (!selectedEmails.length) return send(res, 400, { error: "Select at least one subscribed recipient." });
            const selectedEmailSet = new Set(selectedEmails);
            const recipients = database.newsletterSubscribers.filter((subscriber) => !subscriber.unsubscribedAt && selectedEmailSet.has(String(subscriber.email).toLowerCase()));
            if (!recipients.length) return send(res, 400, { error: "No selected recipients are currently subscribed. Refresh the subscriber list." });
            const offset = Number(campaign.offset ?? 0);
            if (!Number.isInteger(offset) || offset < 0 || offset >= selectedEmails.length) return send(res, 400, { error: "Invalid campaign batch position." });
            const batchEmails = new Set(selectedEmails.slice(offset, offset + 20));
            const batch = recipients.filter((subscriber) => batchEmails.has(String(subscriber.email).toLowerCase()));
            for (const subscriber of batch) {
                if (!subscriber.unsubscribeToken) subscriber.unsubscribeToken = randomBytes(32).toString("base64url");
            }
            await save();
            const origin = publicSiteUrl(process.env.NODE_ENV === "production" ? "https://saltlyne.com" : "http://localhost:5173");
            const delivery = await sendEmailBatch(batch.map((subscriber) => newsletterCampaignEmail({
                email: subscriber.email,
                subject,
                blocks,
                design,
                unsubscribeUrl: `${origin}/newsletter/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribeToken)}`,
            })));
            const nextOffset = offset + batchEmails.size;
            return send(res, 200, { total: recipients.length, offset, nextOffset: nextOffset < selectedEmails.length ? nextOffset : null, ...delivery });
        }
        if (route === "/api/admin/summary" && req.method === "GET") {
            const revenue = database.orders.filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + Number(order.baseTotal ?? order.total), 0);
            return send(res, 200, { products: database.products.length, activeProducts: database.products.filter((item) => item.active).length, orders: database.orders.length, revenue, lowStock: database.products.filter((item) => item.stock < 10).length });
        }
        if (route === "/api/admin/products" && req.method === "GET") return send(res, 200, productsWithMerchandising(database.products));
        if (route === "/api/admin/products" && req.method === "POST") {
            const product = await body(req);
            const images = Array.isArray(product.images) ? product.images.filter((image) => typeof image === "string" && image.length <= 2048).slice(0, 20) : [];
            const item = { ...product, id: `product-${randomBytes(5).toString("hex")}`, createdAt: new Date().toISOString(), name: String(product.name || "New product").trim(), price: Number(product.price) || 0, tag: String(product.tag || "NEW"), tone: String(product.tone || "sand"), image: String(images[0] || product.image || "/images/women-training.jpg"), images, description: String(product.description || ""), gender: String(product.gender || "women"), category: String(product.category || "tops"), subcategory: String(product.subcategory || "essentials"), collection: String(product.collection || "Everyday Essentials"), activity: String(product.activity || "everyday"), sizes: Array.isArray(product.sizes) ? product.sizes : [], colors: Array.isArray(product.colors) ? product.colors : [], featured: Boolean(product.featured), bestSeller: Boolean(product.bestSeller), trendingMode: ["auto", "on", "off"].includes(product.trendingMode) ? product.trendingMode : "auto", unitsSold: 0, onSale: Boolean(product.onSale), salePrice: Number(product.salePrice) || undefined, active: Boolean(product.active), stock: Math.max(0, Number(product.stock) || 0) };
            database.products.unshift(item); await save(); return send(res, 201, item);
        }
        if (route.startsWith("/api/admin/products/") && req.method === "PATCH") {
            const id = decodeURIComponent(route.split("/").at(-1)); const index = database.products.findIndex((item) => item.id === id);
            if (index < 0) return send(res, 404, { error: "Product not found." });
            const changes = await body(req); delete changes.isTrending; delete changes.isBestSeller; const current = database.products[index];
            const images = Array.isArray(changes.images) ? changes.images.filter((image) => typeof image === "string" && image.length <= 2048).slice(0, 20) : current.images;
            database.products[index] = { ...current, ...changes, id, image: images?.[0] || changes.image || current.image, images, name: String(changes.name ?? current.name).trim(), price: Number(changes.price ?? current.price), stock: Math.max(0, Number(changes.stock ?? current.stock)), active: Boolean(changes.active ?? current.active), featured: Boolean(changes.featured ?? current.featured), bestSeller: Boolean(changes.bestSeller ?? current.bestSeller), trendingMode: ["auto", "on", "off"].includes(changes.trendingMode) ? changes.trendingMode : current.trendingMode, unitsSold: current.unitsSold, sizes: Array.isArray(changes.sizes) ? changes.sizes : current.sizes, colors: Array.isArray(changes.colors) ? changes.colors : current.colors, onSale: Boolean(changes.onSale ?? current.onSale), salePrice: Number(changes.salePrice ?? current.salePrice) || undefined };
            await save(); return send(res, 200, database.products[index]);
        }
        if (route.startsWith("/api/admin/products/") && req.method === "DELETE") { const id = decodeURIComponent(route.split("/").at(-1)); database.products = database.products.filter((item) => item.id !== id); await save(); return send(res, 200, { ok: true }); }
        if (route === "/api/admin/orders" && req.method === "GET") return send(res, 200, database.orders);
        if (route.startsWith("/api/admin/orders/") && req.method === "PATCH") {
            const order = database.orders.find((item) => item.id === decodeURIComponent(route.split("/").at(-1)));
            if (!order) return send(res, 404, { error: "Order not found." });
            const changes = await body(req);
            const validStatuses = ["pending", "processing", "shipped", "completed", "cancelled"];
            const validPaymentStatuses = ["awaiting_transfer", "due_on_delivery", "paid"];
            if (changes.status !== undefined && !validStatuses.includes(changes.status)) return send(res, 400, { error: "Invalid order status." });
            if (changes.paymentStatus !== undefined && !validPaymentStatuses.includes(changes.paymentStatus)) return send(res, 400, { error: "Invalid payment status." });
            if (changes.status === undefined && changes.paymentStatus === undefined) return send(res, 400, { error: "Provide an order or payment status." });
            const nextStatus = changes.status ?? order.status;
            const nextPaymentStatus = changes.paymentStatus ?? order.paymentStatus;
            if (order.status === "cancelled" && nextStatus !== "cancelled") return send(res, 409, { error: "Cancelled orders cannot be reopened." });
            if (nextStatus === "cancelled" && order.status !== "cancelled") for (const line of order.items) { const product = database.products.find((item) => item.id === line.id); if (product) { product.stock += line.quantity; product.unitsSold = Math.max(0, Number(product.unitsSold || 0) - line.quantity); } }
            const changed = order.status !== nextStatus || order.paymentStatus !== nextPaymentStatus;
            const orderCustomer = database.customers.find((entry) => entry.id === order.customerId);
            if (nextStatus === "completed" && order.status !== "completed" && orderCustomer && !order.loyaltyPointsEarned) {
                order.loyaltyPointsEarned = pointsForUsd(order.baseTotal ?? order.total);
                orderCustomer.loyaltyPoints = Math.max(0, Number(orderCustomer.loyaltyPoints) || 0) + order.loyaltyPointsEarned;
            }
            if (nextStatus === "cancelled" && order.status !== "cancelled") {
                if (orderCustomer) orderCustomer.loyaltyPoints = Math.max(0, Number(orderCustomer.loyaltyPoints) || 0) - Number(order.loyaltyPointsEarned || 0) + Number(order.loyaltyPointsRedeemed || 0);
                order.loyaltyPointsEarnedReversed = Number(order.loyaltyPointsEarned) || 0;
                order.loyaltyPointsRedeemedRestored = Number(order.loyaltyPointsRedeemed) || 0;
                const coupon = database.coupons.find((entry) => entry.code === order.couponCode);
                if (coupon) coupon.redemptions = Math.max(0, Number(coupon.redemptions || 0) - 1);
            }
            if (changed) order.updatedAt = new Date().toISOString();
            order.status = nextStatus;
            order.paymentStatus = nextPaymentStatus;
            await save();
            const delivery = changed && order.customer?.email
                ? await sendEmailBatch([orderUpdateEmail(order, publicSiteUrl(process.env.NODE_ENV === "production" ? "https://saltlyne.com" : "http://localhost:5173"))])
                : { sent: 0, failed: 0 };
            return send(res, 200, { ...order, emailSent: !changed || delivery.sent > 0 });
        }
        if (route === "/api/orders" && req.method === "POST") {
            const orderData = await body(req);
            const customerSession = customerForRequest(req);
            const email = normalizeEmail(customerSession?.email || orderData.email);
            const name = String(customerSession?.name || orderData.name || "").trim();
            if (!Array.isArray(orderData.items) || !orderData.items.length || !isValidEmail(email) || !name) return send(res, 400, { error: "Add items and complete your contact and delivery details." });
            const currency = String(orderData.currency || "USD").toUpperCase();
            const paymentMethod = String(orderData.paymentMethod || "");
            const paymentConfig = database.siteContent.payments;
            if (!paymentConfig.currencies.includes(currency)) return send(res, 400, { error: "That checkout currency is not available." });
            if (paymentMethod === "wise_transfer" && !paymentConfig.wiseTransfer.enabled) return send(res, 400, { error: "Wise bank transfer is not currently available." });
            if (paymentMethod === "cash_on_delivery" && !paymentConfig.cashOnDelivery.enabled) return send(res, 400, { error: "Cash on delivery is not currently available." });
            if (!["wise_transfer", "cash_on_delivery"].includes(paymentMethod)) return send(res, 400, { error: "Choose an available payment method." });
            let rates;
            try { rates = await getUsdExchangeRates(); }
            catch (error) { return send(res, 503, { error: error.message }); }
            const lines = orderData.items.map((line) => {
                const product = database.products.find((item) => item.id === line.id && item.active);
                if (!product) throw new Error("A product in this order is no longer available.");
                const requestedSize = typeof line.size === "string" ? line.size.trim() : "";
                if (requestedSize && Array.isArray(product.sizes) && !product.sizes.includes(requestedSize)) throw new Error(`${requestedSize} is not available for ${product.name}.`);
                const quantity = Math.max(1, Math.min(20, Number(line.quantity) || 1));
                const basePrice = product.onSale && Number(product.salePrice) > 0 && Number(product.salePrice) < Number(product.price) ? Number(product.salePrice) : Number(product.price);
                return { id: product.id, name: product.name, size: requestedSize || undefined, basePrice, price: convertUsdAmount(basePrice, currency, rates), quantity };
            });
            const requested = new Map();
            for (const line of lines) requested.set(line.id, (requested.get(line.id) || 0) + line.quantity);
            for (const [productId, quantity] of requested) { const product = database.products.find((item) => item.id === productId); if (product.stock < quantity) throw new Error(`${product.name} does not have enough stock for this order.`); }
            const baseSubtotal = Math.round(lines.reduce((sum, line) => sum + line.basePrice * line.quantity, 0) * 100) / 100;
            const couponCode = String(orderData.couponCode || "").trim().toUpperCase();
            let coupon;
            let couponDiscountUsd = 0;
            if (couponCode) {
                coupon = database.coupons.find((item) => item.code === couponCode);
                const redemptionCount = database.orders.filter((item) => item.status !== "cancelled" && item.couponCode === couponCode).length;
                couponDiscountUsd = couponDiscount(coupon, baseSubtotal, { redemptionCount });
                if (customerSession && database.orders.some((item) => item.status !== "cancelled" && item.couponCode === couponCode && (item.customerId === customerSession.id || normalizeEmail(item.customer?.email) === email))) {
                    return send(res, 400, { error: "This discount code has already been used on your account." });
                }
            }
            let loyaltyPointsRedeemed = 0;
            if (orderData.redeemPoints) {
                if (!customerSession) return send(res, 401, { error: "Sign in to redeem loyalty points." });
                const requestedPoints = Math.floor(Number(orderData.redeemPoints));
                if (requestedPoints % MINIMUM_REDEMPTION_POINTS !== 0) return send(res, 400, { error: `Redeem points in increments of ${MINIMUM_REDEMPTION_POINTS}.` });
                const remainingUsd = Math.max(0, baseSubtotal - couponDiscountUsd);
                const maxAffordablePoints = Math.floor(remainingUsd * REDEEM_POINTS_PER_USD / MINIMUM_REDEMPTION_POINTS) * MINIMUM_REDEMPTION_POINTS;
                loyaltyPointsRedeemed = Math.min(Math.floor(Number(customerSession.loyaltyPoints) || 0), requestedPoints, maxAffordablePoints);
                if (loyaltyPointsRedeemed < MINIMUM_REDEMPTION_POINTS || loyaltyPointsRedeemed % MINIMUM_REDEMPTION_POINTS !== 0) return send(res, 400, { error: `Redeem points in increments of ${MINIMUM_REDEMPTION_POINTS}, starting at ${MINIMUM_REDEMPTION_POINTS}.` });
            }
            const pointsDiscountUsd = discountForPoints(loyaltyPointsRedeemed);
            const baseTotal = Math.round(Math.max(0, baseSubtotal - couponDiscountUsd - pointsDiscountUsd) * 100) / 100;
            const order = { id: `SL-${Date.now().toString(36).toUpperCase()}-${randomBytes(8).toString("hex").toUpperCase()}`, customerId: customerSession?.id, createdAt: new Date().toISOString(), customer: { email, name, address: String(orderData.address || "") }, items: lines, baseCurrency: "USD", baseSubtotal, baseTotal, couponId: coupon?.id, couponCode: coupon?.code, couponDiscountUsd, pointsDiscountUsd, loyaltyPointsRedeemed, loyaltyPointsEarned: 0, currency, exchangeRate: rates.rates[currency], exchangeRateUpdatedAt: rates.updatedAt, paymentMethod, paymentStatus: paymentMethod === "wise_transfer" ? "awaiting_transfer" : "due_on_delivery", total: convertUsdAmount(baseTotal, currency, rates), status: "pending" };
            if (customerSession && loyaltyPointsRedeemed) customerSession.loyaltyPoints -= loyaltyPointsRedeemed;
            if (coupon) coupon.redemptions = Number(coupon.redemptions || 0) + 1;
            for (const [productId, quantity] of requested) { const product = database.products.find((item) => item.id === productId); product.stock -= quantity; product.unitsSold = Number(product.unitsSold || 0) + quantity; }
            database.orders.unshift(order);
            await save();
            const siteUrl = publicSiteUrl(process.env.NODE_ENV === "production" ? "https://saltlyne.com" : "http://localhost:5173");
            const delivery = await sendEmailBatch([
                orderConfirmationEmail(order, siteUrl),
                {
                    to: supportEmail(),
                    subject: `New Saltlyne order ${order.id}`,
                    text: `A new order was placed.\n\nCustomer: ${name} <${email}>\nOrder: ${order.id}\nAmount due for items: ${new Intl.NumberFormat("en", { style: "currency", currency }).format(order.total)}\nPayment: ${paymentMethod} (${order.paymentStatus})\n\n${siteUrl}/admin/orders`,
                },
            ]);
            return send(res, 201, { id: order.id, status: order.status, total: order.total, currency, exchangeRate: order.exchangeRate, exchangeRateUpdatedAt: order.exchangeRateUpdatedAt, paymentMethod, paymentStatus: order.paymentStatus, emailSent: delivery.failed === 0 });
        }
        if (!route.startsWith("/api/") && (req.method === "GET" || req.method === "HEAD")) {
            const requestedPath = decodeURIComponent(route === "/" ? "/index.html" : route);
            let file = resolve(staticDir, `.${requestedPath}`);
            const relativePath = relative(staticDir, file);
            if (relativePath.startsWith("..") || isAbsolute(relativePath)) return send(res, 403, { error: "Forbidden." });
            let fileContents;
            try { fileContents = await readFile(file); }
            catch {
                if (extname(requestedPath)) return send(res, 404, { error: "Not found." });
                file = resolve(staticDir, "index.html");
                try { fileContents = await readFile(file); }
                catch { return send(res, 503, { error: "Build the storefront before starting the production server." }); }
            }
            const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".mp4": "video/mp4", ".ico": "image/x-icon" };
            res.writeHead(200, { "content-type": types[extname(file).toLowerCase()] || "application/octet-stream", "cache-control": extname(file) === ".html" ? "no-cache" : "public, max-age=86400", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" });
            return res.end(req.method === "HEAD" ? undefined : fileContents);
        }
        return send(res, 404, { error: "Not found." });
    } catch (error) { return send(res, 400, { error: error.message || "Invalid request." }); }
});

const host = process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";
server.listen(port, host, () => console.log(`Saltlyne server listening on ${host}:${port}`));
