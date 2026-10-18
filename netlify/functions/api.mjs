import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getDatabase } from "@netlify/database";
import { seedProducts, slugify } from "../../shared/catalog.js";
import { convertUsdAmount, getUsdExchangeRates } from "../../shared/exchangeRates.js";
import { hashPassword, isValidEmail, normalizeEmail, validatePassword, verifyPassword } from "../../shared/customerAuth.js";
import { normalizeCustomerName, splitCustomerName } from "../../shared/customerNames.js";
import { createDefaultStoreContent, mergeStoreContent } from "../../shared/storeContent.js";
import { publicSiteUrl, sendEmailBatch, supportEmail } from "../../shared/email.js";
import { newsletterCampaignEmail, newsletterWelcomeEmail, orderConfirmationEmail, orderUpdateEmail, passwordResetEmail, supportNotificationEmail, supportReceiptEmail } from "../../shared/emailTemplates.js";
import { normalizeNewsletterBlocks, normalizeNewsletterDesign } from "../../shared/newsletter.js";
import { hashPasswordResetToken } from "../../shared/passwordReset.js";
import { couponDiscount, normalizeCoupon } from "../../shared/coupons.js";
import { discountForPoints, MINIMUM_REDEMPTION_POINTS, normalizeAddresses, pointsForUsd, REDEEM_POINTS_PER_USD } from "../../shared/loyalty.js";

const database = getDatabase();
const adminEmail = process.env.ADMIN_EMAIL || "owner@saltlynelabel.com";
const sessionSecret = process.env.ADMIN_SESSION_SECRET || "";
const customerSessionSecret = process.env.CUSTOMER_SESSION_SECRET || "";
const sessionCookie = "saltlyne_session";
const customerSessionCookie = "saltlyne_customer_session";
const retiredProductIds = new Set(["coastline-leggings"]);
const authAttempts = new Map();
const dummyCustomerPasswordHash = hashPassword(randomBytes(32).toString("hex"));

class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function json(status, value, headers = {}) {
    return new Response(JSON.stringify(value), {
        status,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer", ...headers },
    });
}

async function readBody(request) {
    const text = await request.text();
    if (text.length > 3_500_000) throw new ApiError(413, "Request too large.");
    try { return text ? JSON.parse(text) : {}; }
    catch { throw new ApiError(400, "Invalid JSON request."); }
}

function constantTimeEqual(left, right) {
    const a = Buffer.from(String(left));
    const b = Buffer.from(String(right));
    return a.length === b.length && timingSafeEqual(a, b);
}

function signSession(payload, secret = sessionSecret) {
    return createHmac("sha256", secret).update(payload).digest("base64url");
}

function getSessionToken(request) {
    return (request.headers.get("cookie") || "").split(";").map((part) => part.trim())
        .find((part) => part.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1) || "";
}

function isAuthenticated(request) {
    if (!sessionSecret) return false;
    const [payload, signature] = getSessionToken(request).split(".");
    if (!payload || !signature) return false;
    const expected = signSession(payload);
    if (!constantTimeEqual(signature, expected)) return false;
    try {
        const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        return session.scope === "admin" && session.expires > Date.now();
    }
    catch { return false; }
}

function createSignedSession(scope, customerId = "", sessionVersion = 0) {
    const secret = scope === "customer" ? customerSessionSecret : sessionSecret;
    if (!secret) throw new ApiError(503, "Customer account sessions are not configured. Set CUSTOMER_SESSION_SECRET.");
    const payload = Buffer.from(JSON.stringify({ scope, customerId, sessionVersion, expires: Date.now() + 30 * 24 * 60 * 60 * 1000, nonce: randomBytes(16).toString("hex") })).toString("base64url");
    return `${payload}.${signSession(payload, secret)}`;
}

function sessionFromRequest(request, cookieName, scope) {
    const secret = scope === "customer" ? customerSessionSecret : sessionSecret;
    if (!secret) return null;
    const token = (request.headers.get("cookie") || "").split(";").map((part) => part.trim())
        .find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || "";
    const [payload, signature] = token.split(".");
    if (!payload || !signature || !constantTimeEqual(signature, signSession(payload, secret))) return null;
    try {
        const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        return session.scope === scope && session.expires > Date.now() ? session : null;
    } catch { return null; }
}

function authRateLimited(request, scope) {
    const key = `${scope}:${request.headers.get("x-nf-client-connection-ip") || request.headers.get("x-forwarded-for") || "unknown"}`;
    const now = Date.now();
    const recent = (authAttempts.get(key) || []).filter((time) => now - time < 60_000);
    recent.push(now);
    authAttempts.set(key, recent);
    return recent.length > 10;
}

async function customerForRequest(request) {
    const session = sessionFromRequest(request, customerSessionCookie, "customer");
    if (!session?.customerId) return null;
    const rows = await database.sql`SELECT id, email, name, first_name, last_name, phone, password_hash, session_version, created_at, addresses, loyalty_points, loyalty_initialized, last_login_at FROM customers WHERE id = ${session.customerId}`;
    const customer = rows[0];
    return customer && Number(customer.session_version) === Number(session.sessionVersion) ? customer : null;
}

function publicCustomer(customer) {
    const nameParts = splitCustomerName(customer.name);
    return { id: customer.id, email: customer.email, name: customer.name, firstName: customer.first_name || nameParts.firstName, lastName: customer.last_name ?? nameParts.lastName, phone: customer.phone || "", createdAt: customer.created_at, lastLoginAt: customer.last_login_at || null, addresses: customer.addresses || [], loyaltyPoints: Math.max(0, Number(customer.loyalty_points) || 0) };
}

function customerCookieHeader(token, maxAge, secure) {
    return `${customerSessionCookie}=${token}; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function requireAdmin(request) {
    if (!isAuthenticated(request)) throw new ApiError(401, "Sign in required.");
}

function cookieHeader(token, maxAge, secure) {
    return `${sessionCookie}=${token}; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

function normalizeProduct(product) {
    const { isTrending: _isTrending, isBestSeller: _isBestSeller, ...record } = product;
    return record;
}

async function seedIfEmpty() {
    const counts = await database.sql`SELECT (SELECT COUNT(*) FROM products) AS count`;
    if (Number(counts[0]?.count) > 0) return;
    const values = seedProducts.filter((product) => !retiredProductIds.has(product.id)).map((product) => [product.id, product.createdAt || new Date().toISOString(), JSON.stringify(normalizeProduct(product))]);
    if (values.length) {
        const rows = database.sql.values(values);
        await database.sql`INSERT INTO products (id, created_at, data) VALUES ${rows} ON CONFLICT (id) DO NOTHING`;
    }
}

async function productRecords(activeOnly = false) {
    await seedIfEmpty();
    return activeOnly
        ? database.sql`SELECT data FROM products WHERE COALESCE((data->>'active')::boolean, false) = true ORDER BY created_at DESC`
        : database.sql`SELECT data FROM products ORDER BY created_at DESC`;
}

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
            .sort((a, b) => Number(b.unitsSold) - Number(a.unitsSold)).slice(0, 3).map((product) => product.id)));
    };
    const autoTrendingIds = topIdsByDepartment((product) => product.trendingMode === "auto" && Number(product.unitsSold) > 0);
    const bestSellerIds = topIdsByDepartment((product) => Number(product.unitsSold) > 0);
    return products.map((product) => ({
        ...product,
        isTrending: product.trendingMode === "on" || (product.trendingMode === "auto" && autoTrendingIds.has(product.id)),
        isBestSeller: Boolean(product.bestSeller || bestSellerIds.has(product.id)),
    }));
}

function parsePath(pathname) {
    const functionPrefix = "/.netlify/functions/api";
    if (pathname.startsWith(functionPrefix)) return `/api${pathname.slice(functionPrefix.length)}`;
    return pathname;
}

async function handle(request) {
    const url = new URL(request.url);
    const route = parsePath(url.pathname);
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS", "access-control-allow-headers": "content-type" } });
    if (route === "/api/health" && method === "GET") return json(200, { ok: true });
    if (route === "/api/exchange-rates" && method === "GET") {
        try { return json(200, await getUsdExchangeRates());         }
        catch (error) { throw new ApiError(503, error.message); }
    }
    if (route === "/api/products" && method === "GET") {
        const rows = await productRecords(true);
        return json(200, productsWithMerchandising(rows.map((row) => row.data)));
    }
    const publicProductMatch = route.match(/^\/api\/products\/([^/]+)$/);
    if (publicProductMatch && method === "GET") {
        const slug = decodeURIComponent(publicProductMatch[1]);
        const rows = await productRecords(true);
        const product = productsWithMerchandising(rows.map((row) => row.data)).find((item) => item.id === slug || slugify(item.name) === slug);
        return product ? json(200, product) : json(404, { error: "Product not found." });
    }
    if (route === "/api/store-content" && method === "GET") {
        const rows = await database.sql`SELECT data FROM site_content WHERE id = 1`;
        if (rows[0]) {
            const content = mergeStoreContent(createDefaultStoreContent(), rows[0].data);
            if (!Array.isArray(rows[0].data?.settings?.social) ||
                JSON.stringify(content.settings.social) !== JSON.stringify(rows[0].data.settings.social) ||
                !Array.isArray(rows[0].data?.paymentIcons) ||
                JSON.stringify(content.paymentIcons) !== JSON.stringify(rows[0].data.paymentIcons)) {
                await database.sql`UPDATE site_content SET data = ${JSON.stringify(content)}::jsonb, updated_at = NOW() WHERE id = 1`;
            }
            return json(200, content);
        }
        const content = createDefaultStoreContent();
        await database.sql`INSERT INTO site_content (id, data) VALUES (1, ${JSON.stringify(content)}::jsonb) ON CONFLICT (id) DO NOTHING`;
        return json(200, content);
    }
    if (route === "/api/coupons/validate" && method === "POST") {
        const requestData = await readBody(request);
        const code = String(requestData.code || "").trim().toUpperCase();
        if (!Array.isArray(requestData.items) || !requestData.items.length || requestData.items.length > 100) throw new ApiError(400, "Your bag is empty or invalid.");
        const productIds = [...new Set(requestData.items.map((item) => String(item.id || "")))];
        const productRows = await database.sql`SELECT id, data FROM products WHERE id = ANY(${productIds}::text[])`;
        const productMap = new Map(productRows.map((row) => [row.id, row.data]));
        let subtotalUsd = 0;
        for (const line of requestData.items) {
            const product = productMap.get(line.id);
            if (!product || !product.active) throw new ApiError(400, "A product in your bag is no longer available.");
            const price = product.onSale && Number(product.salePrice) > 0 && Number(product.salePrice) < Number(product.price) ? Number(product.salePrice) : Number(product.price);
            subtotalUsd += price * Math.max(1, Math.min(20, Number(line.quantity) || 1));
        }
        const couponRows = await database.sql`SELECT data FROM coupons WHERE code = ${code}`;
        const coupon = couponRows[0]?.data;
        const countRows = await database.sql`SELECT COUNT(*)::int AS count FROM orders WHERE status <> 'cancelled' AND data->>'couponCode' = ${code}`;
        let discountUsd;
        try { discountUsd = couponDiscount(coupon, subtotalUsd, { redemptionCount: Number(countRows[0]?.count || 0) }); }
        catch (error) { throw new ApiError(400, error.message); }
        const signedInCustomer = await customerForRequest(request);
        if (signedInCustomer) {
            const prior = await database.sql`SELECT id FROM orders WHERE status <> 'cancelled' AND data->>'couponCode' = ${code} AND (data->>'customerId' = ${signedInCustomer.id} OR lower(data->'customer'->>'email') = ${signedInCustomer.email}) LIMIT 1`;
            if (prior.length) throw new ApiError(400, "This discount code has already been used on your account.");
        }
        return json(200, { code, subtotalUsd, discountUsd });
    }
    if (route === "/api/newsletter" && method === "POST") {
        if (authRateLimited(request, "newsletter")) throw new ApiError(429, "Too many signup attempts. Please try again shortly.");
        const submission = await readBody(request);
        const email = normalizeEmail(submission.email);
        if (!isValidEmail(email)) throw new ApiError(400, "Enter a valid email address.");
        if (submission.consent !== true) throw new ApiError(400, "Please confirm you want to receive Saltlyne email updates.");
        const existing = await database.sql`SELECT email, unsubscribed_at FROM newsletter_subscribers WHERE email = ${email}`;
        if (existing[0] && !existing[0].unsubscribed_at) return json(200, { ok: true, alreadySubscribed: true });
        const token = randomBytes(32).toString("base64url");
        const name = String(submission.name || "").trim().slice(0, 120);
        await database.sql`INSERT INTO newsletter_subscribers (email, name, unsubscribe_token, consent_at, unsubscribed_at) VALUES (${email}, ${name}, ${token}, NOW(), NULL) ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, unsubscribe_token = EXCLUDED.unsubscribe_token, consent_at = NOW(), unsubscribed_at = NULL`;
        const siteUrl = publicSiteUrl(process.env.URL || process.env.DEPLOY_PRIME_URL || "https://saltlyne.com");
        const delivery = await sendEmailBatch([newsletterWelcomeEmail({
            email,
            name,
            unsubscribeUrl: `${siteUrl}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`,
        })]);
        return json(201, { ok: true, emailSent: delivery.failed === 0 });
    }
    if (route === "/api/newsletter/unsubscribe" && method === "POST") {
        const { token } = await readBody(request);
        if (typeof token !== "string" || token.length > 128) throw new ApiError(400, "Invalid unsubscribe link.");
        const rows = await database.sql`UPDATE newsletter_subscribers SET unsubscribed_at = NOW() WHERE unsubscribe_token = ${token} RETURNING email`;
        if (!rows.length) throw new ApiError(404, "That unsubscribe link is invalid or expired.");
        return json(200, { ok: true });
    }
    if (route === "/api/support" && method === "POST") {
        if (authRateLimited(request, "support")) throw new ApiError(429, "Too many messages sent. Please try again shortly.");
        const submission = await readBody(request);
        const name = String(submission.name || "").trim().slice(0, 120);
        const email = normalizeEmail(submission.email);
        const subject = String(submission.subject || "").trim().slice(0, 160);
        const message = String(submission.message || "").trim().slice(0, 5000);
        if (!name || !isValidEmail(email) || !subject || /[\r\n]/.test(subject) || message.length < 10) {
            throw new ApiError(400, "Enter your name, a valid email, a subject, and a message of at least 10 characters.");
        }
        const supportAddress = supportEmail();
        const delivery = await sendEmailBatch([
            supportNotificationEmail({ name, email, subject, message, supportEmail: supportAddress }),
            supportReceiptEmail({ name, email, subject, supportEmail: supportAddress }),
        ]);
        return json(200, { ok: delivery.failed === 0, supportEmailSent: delivery.statuses[0], customerReceiptSent: delivery.statuses[1] });
    }
    if (route === "/api/account/register" && method === "POST") {
        if (!customerSessionSecret) throw new ApiError(503, "Customer account sessions are not configured. Set CUSTOMER_SESSION_SECRET.");
        if (authRateLimited(request, "register")) throw new ApiError(429, "Too many attempts. Please try again shortly.");
        const details = await readBody(request);
        const email = normalizeEmail(details.email);
        if (!isValidEmail(email)) throw new ApiError(400, "Enter a valid email address.");
        try { validatePassword(details.password); }
        catch (error) { throw new ApiError(400, error.message); }
        let nameParts;
        try { nameParts = normalizeCustomerName(details); }
        catch (error) { throw new ApiError(400, error.message); }
        const { name, firstName, lastName } = nameParts;
        const id = `customer-${randomBytes(12).toString("hex")}`;
        const createdAt = new Date().toISOString();
        const client = await database.pool.connect();
        let initialPoints = 0;
        try {
            await client.query("BEGIN");
            const guestOrders = await client.query("SELECT id, data FROM orders WHERE status <> 'cancelled' AND lower(data->'customer'->>'email') = $1 AND COALESCE((data->>'loyaltyPointsEarned')::integer, 0) = 0 FOR UPDATE", [email]);
            initialPoints = guestOrders.rows.reduce((sum, row) => sum + pointsForUsd(row.data.baseTotal ?? row.data.total), 0);
            for (const row of guestOrders.rows) {
                row.data.loyaltyPointsEarned = pointsForUsd(row.data.baseTotal ?? row.data.total);
                await client.query("UPDATE orders SET data = $2::jsonb WHERE id = $1", [row.id, JSON.stringify(row.data)]);
            }
            await client.query("INSERT INTO customers (id, email, name, first_name, last_name, password_hash, created_at, loyalty_points, loyalty_initialized, last_login_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $7)", [id, email, name, firstName, lastName, hashPassword(details.password), createdAt, initialPoints]);
            await client.query("COMMIT");
        } catch (error) {
            await client.query("ROLLBACK");
            if (error.code === "23505") throw new ApiError(409, "An account with that email already exists.");
            throw error;
        } finally { client.release(); }
        const customer = { id, email, name, first_name: firstName, last_name: lastName, phone: "", addresses: [], loyalty_points: initialPoints, session_version: 0, created_at: createdAt, last_login_at: createdAt };
        return json(201, publicCustomer(customer), { "set-cookie": customerCookieHeader(createSignedSession("customer", id), 2592000, url.protocol === "https:") });
    }
    if (route === "/api/account/login" && method === "POST") {
        if (!customerSessionSecret) throw new ApiError(503, "Customer account sessions are not configured. Set CUSTOMER_SESSION_SECRET.");
        if (authRateLimited(request, "login")) throw new ApiError(429, "Too many attempts. Please try again shortly.");
        const credentials = await readBody(request);
        const email = normalizeEmail(credentials.email);
        const password = typeof credentials.password === "string" && credentials.password.length <= 128 ? credentials.password : "";
        const rows = await database.sql`SELECT id, email, name, first_name, last_name, phone, password_hash, session_version, created_at, addresses, loyalty_points, loyalty_initialized, last_login_at FROM customers WHERE email = ${email}`;
        let customer = rows[0];
        if (!verifyPassword(password, customer?.password_hash || dummyCustomerPasswordHash)) throw new ApiError(401, "Email or password is incorrect.");
        const updated = await database.sql`UPDATE customers SET last_login_at = NOW() WHERE id = ${customer.id} RETURNING last_login_at`;
        customer = { ...customer, last_login_at: updated[0].last_login_at };
        return json(200, publicCustomer(customer), { "set-cookie": customerCookieHeader(createSignedSession("customer", customer.id), 2592000, url.protocol === "https:") });
    }
    if (route === "/api/account/password-reset/request" && method === "POST") {
        if (authRateLimited(request, "password-reset")) throw new ApiError(429, "Too many attempts. Please try again shortly.");
        const email = normalizeEmail((await readBody(request)).email);
        if (isValidEmail(email)) {
            const rows = await database.sql`SELECT id, email, name FROM customers WHERE email = ${email}`;
            const customer = rows[0];
            if (customer) {
                const token = randomBytes(32).toString("base64url");
                const tokenHash = hashPasswordResetToken(token);
                const issued = await database.sql`
                    INSERT INTO customer_password_reset_tokens (customer_id, token_hash, expires_at)
                    VALUES (${customer.id}, ${tokenHash}, NOW() + INTERVAL '30 minutes')
                    ON CONFLICT (customer_id) DO UPDATE
                    SET token_hash = EXCLUDED.token_hash, created_at = NOW(), expires_at = EXCLUDED.expires_at
                    WHERE customer_password_reset_tokens.created_at <= NOW() - INTERVAL '1 minute'
                    RETURNING customer_id
                `;
                if (issued.length) {
                    const siteUrl = publicSiteUrl(process.env.URL || process.env.DEPLOY_PRIME_URL || "https://saltlyne.com");
                    const delivery = await sendEmailBatch([passwordResetEmail({
                        name: customer.name,
                        email: customer.email,
                        resetUrl: `${siteUrl}/account/reset-password?token=${encodeURIComponent(token)}`,
                    })]);
                    if (delivery.failed) {
                        await database.sql`DELETE FROM customer_password_reset_tokens WHERE customer_id = ${customer.id} AND token_hash = ${tokenHash}`;
                    }
                }
            }
        }
        return json(200, { ok: true, message: "If an account exists for that email, password reset instructions will be sent." });
    }
    if (route === "/api/account/password-reset/complete" && method === "POST") {
        if (authRateLimited(request, "password-reset-complete")) throw new ApiError(429, "Too many attempts. Please try again shortly.");
        const changes = await readBody(request);
        try { validatePassword(changes.password); }
        catch (error) { throw new ApiError(400, error.message); }
        const token = typeof changes.token === "string" && /^[A-Za-z0-9_-]{43}$/.test(changes.token) ? changes.token : "";
        const tokenHash = hashPasswordResetToken(token);
        const client = await database.pool.connect();
        let customerId;
        try {
            await client.query("BEGIN");
            const result = await client.query(
                "SELECT customer_id FROM customer_password_reset_tokens WHERE token_hash = $1 AND expires_at > NOW() FOR UPDATE",
                [tokenHash],
            );
            customerId = result.rows[0]?.customer_id;
            if (!customerId) throw new ApiError(400, "That password reset link is invalid or expired. Request a new one.");
            await client.query(
                "UPDATE customers SET password_hash = $2, session_version = session_version + 1 WHERE id = $1",
                [customerId, hashPassword(changes.password)],
            );
            await client.query("DELETE FROM customer_password_reset_tokens WHERE customer_id = $1", [customerId]);
            await client.query("COMMIT");
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally { client.release(); }
        return json(200, { ok: true });
    }
    if (route === "/api/account/logout" && method === "POST") {
        return json(200, { ok: true }, { "set-cookie": customerCookieHeader("", 0, url.protocol === "https:") });
    }
    if (route.startsWith("/api/account/")) {
        const customer = await customerForRequest(request);
        if (!customer) throw new ApiError(401, "Sign in required.");
        if (route === "/api/account/me" && method === "GET") return json(200, publicCustomer(customer));
        if (route === "/api/account/profile" && method === "PATCH") {
            const changes = await readBody(request);
            let nameParts;
            try {
                nameParts = normalizeCustomerName(
                    changes.firstName !== undefined || changes.lastName !== undefined
                        ? changes
                        : changes.name !== undefined ? { name: changes.name } : { firstName: customer.first_name, lastName: customer.last_name },
                );
            } catch (error) { throw new ApiError(400, error.message); }
            const { firstName, lastName, name } = nameParts;
            const phone = String(changes.phone ?? customer.phone ?? "").trim().slice(0, 40);
            const rows = await database.sql`UPDATE customers SET name = ${name}, first_name = ${firstName}, last_name = ${lastName}, phone = ${phone} WHERE id = ${customer.id} RETURNING id, email, name, first_name, last_name, phone, created_at, addresses, loyalty_points, last_login_at`;
            return json(200, publicCustomer(rows[0]));
        }
        if (route === "/api/account/addresses" && method === "PUT") {
            let addresses;
            try { addresses = normalizeAddresses((await readBody(request)).addresses); }
            catch (error) { throw new ApiError(400, error.message); }
            const defaults = addresses.filter((address) => address.isDefault);
            if (defaults.length > 1) throw new ApiError(400, "Choose only one default address.");
            const normalized = addresses.map((address, index) => ({ ...address, isDefault: defaults.length ? address.isDefault : index === 0 }));
            await database.sql`UPDATE customers SET addresses = ${JSON.stringify(normalized)}::jsonb WHERE id = ${customer.id}`;
            return json(200, { addresses: normalized });
        }
        if (route === "/api/account/password" && method === "POST") {
            const changes = await readBody(request);
            if (!verifyPassword(String(changes.currentPassword || ""), customer.password_hash)) throw new ApiError(401, "Current password is incorrect.");
            try { validatePassword(changes.password); }
            catch (error) { throw new ApiError(400, error.message); }
            const rows = await database.sql`UPDATE customers SET password_hash = ${hashPassword(changes.password)}, session_version = session_version + 1 WHERE id = ${customer.id} RETURNING session_version`;
            const token = createSignedSession("customer", customer.id, Number(rows[0].session_version));
            return json(200, { ok: true }, { "set-cookie": customerCookieHeader(token, 2592000, url.protocol === "https:") });
        }
        if (route === "/api/account/orders" && method === "GET") {
            const rows = await database.sql`SELECT data, status FROM orders WHERE data->>'customerId' = ${customer.id} OR lower(data->'customer'->>'email') = ${customer.email} ORDER BY created_at DESC`;
            return json(200, rows.map((row) => ({ ...row.data, status: row.status })));
        }
        if (route === "/api/account/rewards" && method === "GET") {
            const rows = await database.sql`SELECT data, status FROM orders WHERE data->>'customerId' = ${customer.id} OR lower(data->'customer'->>'email') = ${customer.email} ORDER BY created_at DESC`;
            const history = rows.flatMap((row) => [
                ...(row.data.loyaltyPointsEarned ? [{ orderId: row.data.id, type: "earned", points: row.data.loyaltyPointsEarned, date: row.data.createdAt }] : []),
                ...(row.data.loyaltyPointsRedeemed ? [{ orderId: row.data.id, type: "redeemed", points: -row.data.loyaltyPointsRedeemed, date: row.data.createdAt }] : []),
                ...(row.data.loyaltyPointsEarnedReversed ? [{ orderId: row.data.id, type: "earning_reversed", points: -row.data.loyaltyPointsEarnedReversed, date: row.data.updatedAt || row.data.createdAt }] : []),
                ...(row.data.loyaltyPointsRedeemedRestored ? [{ orderId: row.data.id, type: "redemption_refunded", points: row.data.loyaltyPointsRedeemedRestored, date: row.data.updatedAt || row.data.createdAt }] : []),
                ...(row.data.couponCode ? [{ orderId: row.data.id, type: "discount", code: row.data.couponCode, amountUsd: row.data.couponDiscountUsd, date: row.data.createdAt }] : []),
            ]).sort((a, b) => String(b.date).localeCompare(String(a.date)));
            return json(200, { points: Math.max(0, Number(customer.loyalty_points) || 0), pointsPerUsd: 1, redemption: { points: MINIMUM_REDEMPTION_POINTS, discountUsd: 5 }, history });
        }
        throw new ApiError(404, "Not found.");
    }
    if (route === "/api/orders/track" && method === "POST") {
        const lookup = await readBody(request);
        const email = normalizeEmail(lookup.email);
        if (!isValidEmail(email)) throw new ApiError(404, "We couldn't find an order with those details.");
        const rows = await database.sql`SELECT data, status FROM orders WHERE id = ${String(lookup.orderId || "").trim()} AND lower(data->'customer'->>'email') = ${email}`;
        if (!rows.length) throw new ApiError(404, "We couldn't find an order with those details.");
        const order = rows[0].data;
        return json(200, { id: order.id, createdAt: order.createdAt, status: rows[0].status, total: order.total, currency: order.currency || "USD", paymentMethod: order.paymentMethod || "", paymentStatus: order.paymentStatus || "", items: order.items });
    }
    if (route === "/api/auth/login" && method === "POST") {
        const password = process.env.ADMIN_PASSWORD;
        if (!password || !sessionSecret) throw new ApiError(503, "Admin login is not configured. Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET.");
        const credentials = await readBody(request);
        if (String(credentials.email || "").toLowerCase() !== adminEmail.toLowerCase() || !constantTimeEqual(credentials.password || "", password)) {
            throw new ApiError(401, "Email or password is incorrect.");
        }
        const payload = Buffer.from(JSON.stringify({ scope: "admin", expires: Date.now() + 12 * 60 * 60 * 1000, nonce: randomBytes(16).toString("hex") })).toString("base64url");
        return json(200, { email: adminEmail }, { "set-cookie": cookieHeader(`${payload}.${signSession(payload)}`, 43200, url.protocol === "https:") });
    }
    if (route === "/api/auth/me" && method === "GET") return isAuthenticated(request) ? json(200, { email: adminEmail }) : json(401, { error: "Sign in required." });
    if (route === "/api/auth/logout" && method === "POST") return json(200, { ok: true }, { "set-cookie": cookieHeader("", 0, url.protocol === "https:") });

    if (route.startsWith("/api/admin/")) requireAdmin(request);
    if (route === "/api/admin/store-content" && method === "GET") {
        const rows = await database.sql`SELECT data FROM site_content WHERE id = 1`;
        if (rows[0]) {
            const content = mergeStoreContent(createDefaultStoreContent(), rows[0].data);
            if (!Array.isArray(rows[0].data?.settings?.social) ||
                JSON.stringify(content.settings.social) !== JSON.stringify(rows[0].data.settings.social) ||
                !Array.isArray(rows[0].data?.paymentIcons) ||
                JSON.stringify(content.paymentIcons) !== JSON.stringify(rows[0].data.paymentIcons)) {
                await database.sql`UPDATE site_content SET data = ${JSON.stringify(content)}::jsonb, updated_at = NOW() WHERE id = 1`;
            }
            return json(200, content);
        }
        const content = createDefaultStoreContent();
        await database.sql`INSERT INTO site_content (id, data) VALUES (1, ${JSON.stringify(content)}::jsonb) ON CONFLICT (id) DO NOTHING`;
        return json(200, content);
    }
    if (route === "/api/admin/store-content" && method === "PUT") {
        const changes = await readBody(request);
        const existing = await database.sql`SELECT data FROM site_content WHERE id = 1`;
        const content = mergeStoreContent(existing[0]?.data || createDefaultStoreContent(), changes);
        await database.sql`INSERT INTO site_content (id, data) VALUES (1, ${JSON.stringify(content)}::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
        return json(200, content);
    }
    if (route === "/api/admin/coupons" && method === "GET") {
        const rows = await database.sql`SELECT data FROM coupons ORDER BY created_at DESC`;
        return json(200, rows.map((row) => row.data));
    }
    if (route === "/api/admin/coupons" && method === "POST") {
        let coupon;
        try { coupon = normalizeCoupon(await readBody(request)); }
        catch (error) { throw new ApiError(400, error.message); }
        try { await database.sql`INSERT INTO coupons (code, data) VALUES (${coupon.code}, ${JSON.stringify({ ...coupon, redemptions: 0 })}::jsonb)`; }
        catch (error) {
            if (error.code === "23505") throw new ApiError(409, "A coupon with that code already exists.");
            throw error;
        }
        return json(201, { ...coupon, redemptions: 0 });
    }
    if (route.startsWith("/api/admin/coupons/") && method === "PATCH") {
        const code = decodeURIComponent(route.split("/").at(-1)).toUpperCase();
        const rows = await database.sql`SELECT data FROM coupons WHERE code = ${code}`;
        if (!rows.length) throw new ApiError(404, "Coupon not found.");
        const changes = await readBody(request);
        let coupon;
        try { coupon = normalizeCoupon({ ...rows[0].data, ...changes, id: rows[0].data.id, createdAt: rows[0].data.createdAt }); }
        catch (error) { throw new ApiError(400, error.message); }
        coupon.redemptions = Number(rows[0].data.redemptions) || 0;
        try { await database.sql`UPDATE coupons SET code = ${coupon.code}, data = ${JSON.stringify(coupon)}::jsonb WHERE code = ${code}`; }
        catch (error) {
            if (error.code === "23505") throw new ApiError(409, "A coupon with that code already exists.");
            throw error;
        }
        return json(200, coupon);
    }
    if (route.startsWith("/api/admin/coupons/") && method === "DELETE") {
        const code = decodeURIComponent(route.split("/").at(-1)).toUpperCase();
        const rows = await database.sql`DELETE FROM coupons WHERE code = ${code} RETURNING code`;
        if (!rows.length) throw new ApiError(404, "Coupon not found.");
        return json(200, { ok: true });
    }
    if (route === "/api/admin/customers" && method === "GET") {
        const [customerRows, orderRows, subscriberRows] = await Promise.all([
            database.sql`SELECT id, email, name, phone, created_at, addresses, loyalty_points, last_login_at FROM customers ORDER BY COALESCE(last_login_at, created_at) DESC`,
            database.sql`SELECT id, status, created_at, data FROM orders`,
            database.sql`SELECT email, created_at, consent_at, unsubscribed_at FROM newsletter_subscribers`,
        ]);
        const ordersByCustomer = new Map();
        for (const row of orderRows) {
            const order = { ...row.data, id: row.id, status: row.status, createdAt: row.created_at };
            const email = normalizeEmail(order.customer?.email);
            const keys = new Set([order.customerId, email].filter(Boolean));
            for (const key of keys) ordersByCustomer.set(key, [...(ordersByCustomer.get(key) || []), order]);
        }
        const subscribers = new Map(subscriberRows.map((row) => [normalizeEmail(row.email), row]));
        const customers = customerRows.map((customer) => {
            const orders = [...new Map([
                ...(ordersByCustomer.get(customer.id) || []),
                ...(ordersByCustomer.get(normalizeEmail(customer.email)) || []),
            ].map((order) => [order.id, order])).values()];
            const activeOrders = orders.filter((order) => order.status !== "cancelled");
            const subscriber = subscribers.get(normalizeEmail(customer.email));
            return {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone || "",
                createdAt: customer.created_at,
                lastLoginAt: customer.last_login_at || null,
                loyaltyPoints: Math.max(0, Number(customer.loyalty_points) || 0),
                orderCount: orders.length,
                totalSpentUsd: Math.round(activeOrders.reduce((sum, order) => sum + (Number(order.baseTotal ?? order.total) || 0), 0) * 100) / 100,
                lastOrderAt: orders.map((order) => order.createdAt).filter(Boolean).sort().at(-1) || null,
                newsletter: subscriber ? { subscribedAt: subscriber.consent_at || subscriber.created_at || null, unsubscribedAt: subscriber.unsubscribed_at || null } : null,
            };
        });
        return json(200, customers);
    }
    if (route.startsWith("/api/admin/customers/") && method === "GET") {
        const id = decodeURIComponent(route.slice("/api/admin/customers/".length));
        const [customerRows, orderRows] = await Promise.all([
            database.sql`SELECT id, email, name, phone, created_at, addresses, loyalty_points, last_login_at FROM customers WHERE id = ${id}`,
            database.sql`SELECT id, status, created_at, data FROM orders WHERE data->>'customerId' = ${id} OR lower(data->'customer'->>'email') = (SELECT lower(email) FROM customers WHERE id = ${id}) ORDER BY created_at DESC`,
        ]);
        const customer = customerRows[0];
        if (!customer) throw new ApiError(404, "Customer profile not found.");
        const subscribers = await database.sql`SELECT created_at, consent_at, unsubscribed_at FROM newsletter_subscribers WHERE email = ${customer.email}`;
        const subscriber = subscribers[0];
        const orders = orderRows.map((row) => ({
            id: row.id,
            createdAt: row.created_at,
            status: row.status,
            total: row.data.total,
            currency: row.data.currency || "USD",
            baseTotal: row.data.baseTotal ?? row.data.total,
            baseSubtotal: row.data.baseSubtotal ?? row.data.baseTotal ?? row.data.total,
            paymentMethod: row.data.paymentMethod || "",
            paymentStatus: row.data.paymentStatus || "",
            deliveryAddress: row.data.customer?.address || "",
            items: row.data.items || [],
            couponCode: row.data.couponCode || "",
            couponDiscountUsd: Number(row.data.couponDiscountUsd) || 0,
            pointsDiscountUsd: Number(row.data.pointsDiscountUsd) || 0,
            loyaltyPointsEarned: Number(row.data.loyaltyPointsEarned) || 0,
            loyaltyPointsRedeemed: Number(row.data.loyaltyPointsRedeemed) || 0,
        }));
        return json(200, {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone || "",
            createdAt: customer.created_at,
            lastLoginAt: customer.last_login_at || null,
            addresses: customer.addresses || [],
            loyaltyPoints: Math.max(0, Number(customer.loyalty_points) || 0),
            newsletter: subscriber ? { subscribedAt: subscriber.consent_at || subscriber.created_at || null, unsubscribedAt: subscriber.unsubscribed_at || null } : null,
            orders,
        });
    }
    if (route === "/api/admin/newsletter" && method === "GET") {
        const rows = await database.sql`SELECT email, name, created_at AS "createdAt", unsubscribed_at AS "unsubscribedAt" FROM newsletter_subscribers ORDER BY created_at DESC`;
        return json(200, rows);
    }
    if (route === "/api/admin/newsletter/campaign" && method === "POST") {
        const campaign = await readBody(request);
        const subject = String(campaign.subject || "").trim().slice(0, 160);
        if (!subject || /[\r\n]/.test(subject)) throw new ApiError(400, "Enter a valid campaign subject.");
        let blocks;
        let design;
        try {
            blocks = normalizeNewsletterBlocks(campaign.blocks);
            design = normalizeNewsletterDesign(campaign.design);
        } catch (error) { throw new ApiError(400, error.message); }
        if (blocks.reduce((total, block) => total + (block.type === "image" ? block.image.length : 0), 0) > 1_600_000) throw new ApiError(400, "Newsletter images exceed the combined 1.2 MB limit.");
        if (!Array.isArray(campaign.selectedEmails) || campaign.selectedEmails.length > 5000) throw new ApiError(400, "Select up to 5,000 newsletter recipients.");
        const selectedEmails = [...new Set(campaign.selectedEmails.filter((email) => typeof email === "string").map((email) => email.trim().toLowerCase()))];
        if (!selectedEmails.length) throw new ApiError(400, "Select at least one subscribed recipient.");
        const selectedEmailSet = new Set(selectedEmails);
        const activeRows = await database.sql`SELECT email, unsubscribe_token AS "unsubscribeToken" FROM newsletter_subscribers WHERE unsubscribed_at IS NULL ORDER BY created_at, email`;
        const recipients = activeRows.filter((subscriber) => selectedEmailSet.has(String(subscriber.email).toLowerCase()));
        if (!recipients.length) throw new ApiError(400, "No selected recipients are currently subscribed. Refresh the subscriber list.");
        const offset = Number(campaign.offset ?? 0);
        if (!Number.isInteger(offset) || offset < 0 || offset >= selectedEmails.length) throw new ApiError(400, "Invalid campaign batch position.");
        const batchEmails = new Set(selectedEmails.slice(offset, offset + 20));
        const batch = recipients.filter((subscriber) => batchEmails.has(String(subscriber.email).toLowerCase()));
        const siteUrl = publicSiteUrl(process.env.URL || process.env.DEPLOY_PRIME_URL || "https://saltlyne.com");
        const delivery = await sendEmailBatch(batch.map((subscriber) => newsletterCampaignEmail({
            email: subscriber.email,
            subject,
            blocks,
            design,
            unsubscribeUrl: `${siteUrl}/newsletter/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribeToken)}`,
        })));
        const nextOffset = offset + batchEmails.size;
        return json(200, { total: recipients.length, offset, nextOffset: nextOffset < selectedEmails.length ? nextOffset : null, ...delivery });
    }
    if (route === "/api/admin/summary" && method === "GET") {
        const [products, orders] = await Promise.all([productRecords(), database.sql`SELECT status, total FROM orders`]);
        const allProducts = products.map((row) => row.data);
        return json(200, {
            products: allProducts.length,
            activeProducts: allProducts.filter((product) => product.active).length,
            orders: orders.length,
            revenue: orders.filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + Number(order.baseTotal ?? order.total), 0),
            lowStock: allProducts.filter((product) => product.stock < 10).length,
        });
    }
    if (route === "/api/admin/products" && method === "GET") {
        const rows = await productRecords();
        return json(200, productsWithMerchandising(rows.map((row) => row.data)));
    }
    if (route === "/api/admin/products" && method === "POST") {
        const product = await readBody(request);
        const item = normalizeProduct({
            ...product,
            id: `product-${randomBytes(5).toString("hex")}`,
            createdAt: new Date().toISOString(),
            name: String(product.name || "New product").trim(),
            price: Number(product.price) || 0,
            tag: String(product.tag || "NEW"),
            tone: String(product.tone || "sand"),
            image: String(product.image || "/images/women-training.jpg"),
            images: Array.isArray(product.images) ? product.images.filter((image) => typeof image === "string" && image.length <= 2048).slice(0, 20) : [],
            description: String(product.description || ""),
            gender: String(product.gender || "women"),
            category: String(product.category || "tops"),
            subcategory: String(product.subcategory || "essentials"),
            collection: String(product.collection || "Everyday Essentials"),
            activity: String(product.activity || "everyday"),
            sizes: Array.isArray(product.sizes) ? product.sizes : [],
            colors: Array.isArray(product.colors) ? product.colors : [],
            featured: Boolean(product.featured),
            bestSeller: Boolean(product.bestSeller),
            trendingMode: ["auto", "on", "off"].includes(product.trendingMode) ? product.trendingMode : "auto",
            unitsSold: 0,
            onSale: Boolean(product.onSale),
            salePrice: Number(product.salePrice) || undefined,
            active: Boolean(product.active),
            stock: Math.max(0, Number(product.stock) || 0),
        });
        await database.sql`INSERT INTO products (id, created_at, data) VALUES (${item.id}, ${item.createdAt}, ${JSON.stringify(item)}::jsonb)`;
        return json(201, item);
    }
    const productMatch = route.match(/^\/api\/admin\/products\/([^/]+)$/);
    if (productMatch && method === "PATCH") {
        const id = decodeURIComponent(productMatch[1]);
        const changes = await readBody(request);
        const rows = await database.sql`SELECT data FROM products WHERE id = ${id}`;
        if (!rows.length) throw new ApiError(404, "Product not found.");
        const current = rows[0].data;
        delete changes.isTrending;
        delete changes.isBestSeller;
        const item = normalizeProduct({
            ...current, ...changes, id,
            name: String(changes.name ?? current.name).trim(),
            price: Number(changes.price ?? current.price),
            stock: Math.max(0, Number(changes.stock ?? current.stock)),
            active: Boolean(changes.active ?? current.active),
            featured: Boolean(changes.featured ?? current.featured),
            bestSeller: Boolean(changes.bestSeller ?? current.bestSeller),
            trendingMode: ["auto", "on", "off"].includes(changes.trendingMode) ? changes.trendingMode : current.trendingMode,
            unitsSold: current.unitsSold,
            sizes: Array.isArray(changes.sizes) ? changes.sizes : current.sizes,
            colors: Array.isArray(changes.colors) ? changes.colors : current.colors,
            images: Array.isArray(changes.images) ? changes.images.filter((image) => typeof image === "string" && image.length <= 2048).slice(0, 20) : current.images,
            image: Array.isArray(changes.images) ? changes.images.find((image) => typeof image === "string" && image.length <= 2048) || changes.image || current.image : changes.image ?? current.image,
            onSale: Boolean(changes.onSale ?? current.onSale),
            salePrice: Number(changes.salePrice ?? current.salePrice) || undefined,
        });
        const updated = await database.sql`UPDATE products SET data = ${JSON.stringify(item)}::jsonb WHERE id = ${id} RETURNING data`;
        return json(200, updated[0].data);
    }
    if (productMatch && method === "DELETE") {
        const id = decodeURIComponent(productMatch[1]);
        await database.sql`DELETE FROM products WHERE id = ${id}`;
        return json(200, { ok: true });
    }
    if (route === "/api/admin/orders" && method === "GET") {
        const rows = await database.sql`SELECT data, status FROM orders ORDER BY created_at DESC`;
        return json(200, rows.map((row) => ({ ...row.data, status: row.status })));
    }
    const orderMatch = route.match(/^\/api\/admin\/orders\/([^/]+)$/);
    if (orderMatch && method === "PATCH") {
        const id = decodeURIComponent(orderMatch[1]);
        const changes = await readBody(request);
        const validStatuses = ["pending", "processing", "shipped", "completed", "cancelled"];
        const validPaymentStatuses = ["awaiting_transfer", "due_on_delivery", "paid"];
        if (changes.status !== undefined && !validStatuses.includes(changes.status)) throw new ApiError(400, "Invalid order status.");
        if (changes.paymentStatus !== undefined && !validPaymentStatuses.includes(changes.paymentStatus)) throw new ApiError(400, "Invalid payment status.");
        if (changes.status === undefined && changes.paymentStatus === undefined) throw new ApiError(400, "Provide an order or payment status.");
        const nextStatus = changes.status ?? null;
        const client = await database.pool.connect();
        try {
            await client.query("BEGIN");
            const result = await client.query("SELECT data, status FROM orders WHERE id = $1 FOR UPDATE", [id]);
            if (!result.rows.length) throw new ApiError(404, "Order not found.");
            const order = result.rows[0].data;
            const previousStatus = result.rows[0].status;
            const nextOrderStatus = nextStatus || previousStatus;
            if (previousStatus === "cancelled" && nextOrderStatus !== "cancelled") throw new ApiError(409, "Cancelled orders cannot be reopened.");
            if (nextOrderStatus === "cancelled" && previousStatus !== "cancelled") {
                for (const line of order.items) {
                    const productResult = await client.query("SELECT data FROM products WHERE id = $1 FOR UPDATE", [line.id]);
                    if (productResult.rows.length) {
                        const product = productResult.rows[0].data;
                        product.stock = Number(product.stock || 0) + line.quantity;
                        product.unitsSold = Math.max(0, Number(product.unitsSold || 0) - line.quantity);
                        await client.query("UPDATE products SET data = $2::jsonb WHERE id = $1", [line.id, JSON.stringify(product)]);
                    }
                }
                if (nextOrderStatus === "completed" && previousStatus !== "completed" && order.customerId && !order.loyaltyPointsEarned) {
                    const customerResult = await client.query("SELECT loyalty_points FROM customers WHERE id = $1 FOR UPDATE", [order.customerId]);
                    if (customerResult.rows.length) {
                        order.loyaltyPointsEarned = pointsForUsd(order.baseTotal ?? order.total);
                        await client.query("UPDATE customers SET loyalty_points = loyalty_points + $2 WHERE id = $1", [order.customerId, order.loyaltyPointsEarned]);
                    }
                }
                if (nextOrderStatus === "cancelled" && previousStatus !== "cancelled") {
                    if (order.customerId) {
                        await client.query(
                            "UPDATE customers SET loyalty_points = GREATEST(0, loyalty_points - $2 + $3) WHERE id = $1",
                            [order.customerId, Number(order.loyaltyPointsEarned) || 0, Number(order.loyaltyPointsRedeemed) || 0],
                        );
                    }
                    order.loyaltyPointsEarnedReversed = Number(order.loyaltyPointsEarned) || 0;
                    order.loyaltyPointsRedeemedRestored = Number(order.loyaltyPointsRedeemed) || 0;
                    if (order.couponCode) {
                        const couponResult = await client.query("SELECT data FROM coupons WHERE code = $1 FOR UPDATE", [order.couponCode]);
                        if (couponResult.rows.length) {
                            const coupon = couponResult.rows[0].data;
                            coupon.redemptions = Math.max(0, Number(coupon.redemptions || 0) - 1);
                            await client.query("UPDATE coupons SET data = $2::jsonb WHERE code = $1", [order.couponCode, JSON.stringify(coupon)]);
                        }
                    }
                }
            }
            const changed = order.status !== nextOrderStatus || order.paymentStatus !== changes.paymentStatus && changes.paymentStatus !== undefined;
            order.status = nextOrderStatus;
            order.updatedAt = new Date().toISOString();
            if (changes.paymentStatus) order.paymentStatus = changes.paymentStatus;
            await client.query("UPDATE orders SET status = $2, data = $3::jsonb WHERE id = $1", [id, nextOrderStatus, JSON.stringify(order)]);
            await client.query("COMMIT");
            const delivery = changed && order.customer?.email
                ? await sendEmailBatch([orderUpdateEmail(order, publicSiteUrl(process.env.URL || process.env.DEPLOY_PRIME_URL || "https://saltlyne.com"))])
                : { sent: 0, failed: 0 };
            return json(200, { ...order, emailSent: !changed || delivery.sent > 0 });
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally { client.release(); }
    }
    if (route === "/api/orders" && method === "POST") {
        const orderData = await readBody(request);
        const signedInCustomer = await customerForRequest(request);
        const email = normalizeEmail(signedInCustomer?.email || orderData.email);
        const name = String(signedInCustomer?.name || orderData.name || "").trim();
        if (!Array.isArray(orderData.items) || !orderData.items.length || !isValidEmail(email) || !name) {
            throw new ApiError(400, "Add items and complete your contact and delivery details.");
        }
        const currency = String(orderData.currency || "USD").toUpperCase();
        const paymentMethod = String(orderData.paymentMethod || "");
        const siteRows = await database.sql`SELECT data FROM site_content WHERE id = 1`;
        const siteContent = mergeStoreContent(createDefaultStoreContent(), siteRows[0]?.data || {});
        const paymentConfig = siteContent.payments;
        if (!paymentConfig.currencies.includes(currency)) throw new ApiError(400, "That checkout currency is not available.");
        if (paymentMethod === "wise_transfer" && !paymentConfig.wiseTransfer.enabled) throw new ApiError(400, "Wise bank transfer is not currently available.");
        if (paymentMethod === "cash_on_delivery" && !paymentConfig.cashOnDelivery.enabled) throw new ApiError(400, "Cash on delivery is not currently available.");
        if (!["wise_transfer", "cash_on_delivery"].includes(paymentMethod)) throw new ApiError(400, "Choose an available payment method.");
        let rates;
        try { rates = await getUsdExchangeRates(); }
        catch (error) { throw new ApiError(503, error.message); }
        const requested = new Map();
        for (const line of orderData.items) {
            const quantity = Math.max(1, Math.min(20, Number(line.quantity) || 1));
            requested.set(line.id, (requested.get(line.id) || 0) + quantity);
        }
        const client = await database.pool.connect();
        try {
            await client.query("BEGIN");
            const productIds = [...requested.keys()].sort();
            const productResult = await client.query("SELECT id, data FROM products WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE", [productIds]);
            const products = new Map(productResult.rows.map((row) => [row.id, row.data]));
            const lines = orderData.items.map((line) => {
                const product = products.get(line.id);
                if (!product || !product.active) throw new ApiError(400, "A product in this order is no longer available.");
                const requestedSize = typeof line.size === "string" ? line.size.trim() : "";
                if (requestedSize && Array.isArray(product.sizes) && !product.sizes.includes(requestedSize)) throw new ApiError(400, `${requestedSize} is not available for ${product.name}.`);
                const price = product.onSale && Number(product.salePrice) > 0 && Number(product.salePrice) < Number(product.price) ? Number(product.salePrice) : Number(product.price);
                return { id: product.id, name: product.name, size: requestedSize || undefined, basePrice: price, price: convertUsdAmount(price, currency, rates), quantity: Math.max(1, Math.min(20, Number(line.quantity) || 1)) };
            });
            for (const [productId, quantity] of requested) {
                const product = products.get(productId);
                if (Number(product.stock) < quantity) throw new ApiError(400, `${product.name} does not have enough stock for this order.`);
            }
            const baseSubtotal = Math.round(lines.reduce((sum, line) => sum + line.basePrice * line.quantity, 0) * 100) / 100;
            const couponCode = String(orderData.couponCode || "").trim().toUpperCase();
            let coupon;
            let couponDiscountUsd = 0;
            if (couponCode) {
                const couponResult = await client.query("SELECT data FROM coupons WHERE code = $1 FOR UPDATE", [couponCode]);
                coupon = couponResult.rows[0]?.data;
                const countResult = await client.query("SELECT COUNT(*)::int AS count FROM orders WHERE status <> 'cancelled' AND data->>'couponCode' = $1", [couponCode]);
                try { couponDiscountUsd = couponDiscount(coupon, baseSubtotal, { redemptionCount: Number(countResult.rows[0]?.count || 0) }); }
                catch (error) { throw new ApiError(400, error.message); }
                if (signedInCustomer) {
                    const priorUse = await client.query("SELECT 1 FROM orders WHERE status <> 'cancelled' AND data->>'couponCode' = $1 AND (data->>'customerId' = $2 OR lower(data->'customer'->>'email') = $3) LIMIT 1", [couponCode, signedInCustomer.id, email]);
                    if (priorUse.rows.length) throw new ApiError(400, "This discount code has already been used on your account.");
                }
            }
            let loyaltyPointsRedeemed = 0;
            if (orderData.redeemPoints) {
                if (!signedInCustomer) throw new ApiError(401, "Sign in to redeem loyalty points.");
                const requestedPoints = Math.floor(Number(orderData.redeemPoints));
                if (requestedPoints < MINIMUM_REDEMPTION_POINTS || requestedPoints % MINIMUM_REDEMPTION_POINTS !== 0) {
                    throw new ApiError(400, `Redeem points in increments of ${MINIMUM_REDEMPTION_POINTS}, starting at ${MINIMUM_REDEMPTION_POINTS}.`);
                }
                const customerResult = await client.query("SELECT loyalty_points FROM customers WHERE id = $1 FOR UPDATE", [signedInCustomer.id]);
                const pointsAvailable = Number(customerResult.rows[0]?.loyalty_points || 0);
                const remainingUsd = Math.max(0, baseSubtotal - couponDiscountUsd);
                const affordablePoints = Math.floor(remainingUsd * REDEEM_POINTS_PER_USD / MINIMUM_REDEMPTION_POINTS) * MINIMUM_REDEMPTION_POINTS;
                loyaltyPointsRedeemed = Math.min(pointsAvailable, requestedPoints, affordablePoints);
                if (loyaltyPointsRedeemed < MINIMUM_REDEMPTION_POINTS) throw new ApiError(400, "There is not enough eligible spend or points to redeem.");
            }
            const pointsDiscountUsd = discountForPoints(loyaltyPointsRedeemed);
            const baseTotal = Math.round(Math.max(0, baseSubtotal - couponDiscountUsd - pointsDiscountUsd) * 100) / 100;
            for (const [productId, quantity] of requested) {
                const product = products.get(productId);
                product.stock = Number(product.stock) - quantity;
                product.unitsSold = Number(product.unitsSold || 0) + quantity;
                await client.query("UPDATE products SET data = $2::jsonb WHERE id = $1", [productId, JSON.stringify(product)]);
            }
            const order = {
                id: `SL-${Date.now().toString(36).toUpperCase()}-${randomBytes(8).toString("hex").toUpperCase()}`,
                createdAt: new Date().toISOString(),
                customerId: signedInCustomer?.id,
                customer: { email, name, address: String(orderData.address || "") },
                items: lines,
                baseCurrency: "USD",
                baseSubtotal,
                baseTotal,
                couponId: coupon?.id,
                couponCode: coupon?.code,
                couponDiscountUsd,
                pointsDiscountUsd,
                loyaltyPointsRedeemed,
                loyaltyPointsEarned: 0,
                currency,
                exchangeRate: rates.rates[currency],
                exchangeRateUpdatedAt: rates.updatedAt,
                paymentMethod,
                paymentStatus: paymentMethod === "wise_transfer" ? "awaiting_transfer" : "due_on_delivery",
                total: convertUsdAmount(baseTotal, currency, rates),
                status: "pending",
            };
            if (loyaltyPointsRedeemed) await client.query("UPDATE customers SET loyalty_points = loyalty_points - $2 WHERE id = $1", [signedInCustomer.id, loyaltyPointsRedeemed]);
            if (coupon) {
                coupon.redemptions = Number(coupon.redemptions || 0) + 1;
                await client.query("UPDATE coupons SET data = $2::jsonb WHERE code = $1", [couponCode, JSON.stringify(coupon)]);
            }
            await client.query("INSERT INTO orders (id, created_at, status, total, data) VALUES ($1, $2, $3, $4, $5::jsonb)", [order.id, order.createdAt, order.status, order.baseTotal, JSON.stringify(order)]);
            await client.query("COMMIT");
            const siteUrl = publicSiteUrl(process.env.URL || process.env.DEPLOY_PRIME_URL || "https://saltlyne.com");
            const delivery = await sendEmailBatch([
                orderConfirmationEmail(order, siteUrl),
                {
                    to: supportEmail(),
                    subject: `New Saltlyne order ${order.id}`,
                    text: `A new order was placed.\n\nCustomer: ${name} <${email}>\nOrder: ${order.id}\nAmount due for items: ${new Intl.NumberFormat("en", { style: "currency", currency }).format(order.total)}\nPayment: ${paymentMethod} (${order.paymentStatus})\n\n${siteUrl}/admin/orders`,
                },
            ]);
            return json(201, { id: order.id, status: order.status, total: order.total, currency, exchangeRate: order.exchangeRate, exchangeRateUpdatedAt: order.exchangeRateUpdatedAt, paymentMethod, paymentStatus: order.paymentStatus, emailSent: delivery.failed === 0 });
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally { client.release(); }
    }
    if (route.startsWith("/api/")) throw new ApiError(404, "Not found.");
    return json(404, { error: "Not found." });
}

export default async function handler(request) {
    try { return await handle(request); }
    catch (error) {
        if (error instanceof ApiError) return json(error.status, { error: error.message });
        console.error("Netlify API error:", error);
        return json(500, { error: "The store service is temporarily unavailable." });
    }
}
