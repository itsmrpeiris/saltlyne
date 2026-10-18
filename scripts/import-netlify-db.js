import { readFile } from "node:fs/promises";
import { getDatabase } from "@netlify/database";
import { createDefaultStoreContent, mergeStoreContent } from "../shared/storeContent.js";
import { pointsForUsd } from "../shared/loyalty.js";

const file = new URL("../server/data/store.json", import.meta.url);
let store;
try { store = JSON.parse(await readFile(file, "utf8")); }
catch (error) {
    console.error("Could not read server/data/store.json. Run this from a checkout containing the local store export.");
    process.exitCode = 1;
    throw error;
}

const connectionString = process.env.NETLIFY_DB_URL || process.env.NETLIFY_DATABASE_URL;

if (!connectionString) {
    console.error("Set NETLIFY_DB_URL (or NETLIFY_DATABASE_URL) to the Netlify Database connection string before importing.");
    process.exitCode = 1;
} else {
    const database = getDatabase({ connectionString });
    const products = (store.products || []).filter((product) => product.id !== "coastline-leggings");
    const client = await database.pool.connect();
    let importedProducts = 0;
    let importedOrders = 0;
    let importedCustomers = 0;
    let importedSubscribers = 0;
    try {
        await client.query("BEGIN");
        const marker = await client.query("INSERT INTO store_imports (id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id", ["infinityfree-json-v2"]);
        if (!marker.rowCount) {
            await client.query("ROLLBACK");
            console.log("The InfinityFree JSON import has already run; no records were changed.");
        } else {
            for (const product of products) {
                const { isTrending: _isTrending, isBestSeller: _isBestSeller, ...data } = product;
                const result = await client.query(
                    "INSERT INTO products (id, created_at, data) VALUES ($1, $2, $3::jsonb) ON CONFLICT (id) DO UPDATE SET created_at = EXCLUDED.created_at, data = EXCLUDED.data RETURNING id",
                    [data.id, data.createdAt || new Date().toISOString(), JSON.stringify(data)],
                );
                importedProducts += result.rowCount;
            }
            const importedCustomersData = (store.customers || []).map((customer) => ({ ...customer, addresses: customer.addresses || [], loyaltyPoints: Math.max(0, Number(customer.loyaltyPoints) || 0) }));
            const importedOrdersData = (store.orders || []).map((order) => ({ ...order, status: order.status || "pending" }));
            for (const customer of importedCustomersData) {
                if (customer.loyaltyInitialized) continue;
                for (const order of importedOrdersData) {
                    if (order.status === "cancelled" || order.loyaltyPointsEarned || (order.customerId !== customer.id && String(order.customer?.email || "").toLowerCase() !== String(customer.email).toLowerCase())) continue;
                    order.loyaltyPointsEarned = pointsForUsd(order.baseTotal ?? order.total);
                    customer.loyaltyPoints += order.loyaltyPointsEarned;
                }
                customer.loyaltyInitialized = true;
            }
            for (const order of importedOrdersData) {
                const data = order;
                const result = await client.query(
                    "INSERT INTO orders (id, created_at, status, total, data) VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT (id) DO NOTHING RETURNING id",
                    [data.id, data.createdAt || new Date().toISOString(), data.status, Number(data.total) || 0, JSON.stringify(data)],
                );
                importedOrders += result.rowCount;
            }
            for (const customer of importedCustomersData) {
                if (!customer.id || !customer.email || !customer.passwordHash) continue;
                const result = await client.query(
                    "INSERT INTO customers (id, email, name, phone, password_hash, session_version, created_at, addresses, loyalty_points, loyalty_initialized, last_login_at) VALUES ($1, $2, $3, $4, $5, 0, $6, $7::jsonb, $8, $9, $10) ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, password_hash = EXCLUDED.password_hash, addresses = EXCLUDED.addresses, loyalty_points = EXCLUDED.loyalty_points, loyalty_initialized = EXCLUDED.loyalty_initialized, last_login_at = EXCLUDED.last_login_at RETURNING id",
                    [customer.id, customer.email, customer.name || "", customer.phone || "", customer.passwordHash, customer.createdAt || new Date().toISOString(), JSON.stringify(customer.addresses || []), customer.loyaltyPoints, Boolean(customer.loyaltyInitialized), customer.lastLoginAt || null],
                );
                importedCustomers += result.rowCount;
            }
            for (const coupon of store.coupons || []) {
                if (!coupon.code) continue;
                await client.query("INSERT INTO coupons (code, data) VALUES ($1, $2::jsonb) ON CONFLICT (code) DO NOTHING", [coupon.code, JSON.stringify(coupon)]);
            }
            for (const subscriber of store.newsletterSubscribers || []) {
                if (!subscriber.email) continue;
                const result = await client.query(
                    "INSERT INTO newsletter_subscribers (email, name, created_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING email",
                    [subscriber.email, subscriber.name || "", subscriber.createdAt || new Date().toISOString()],
                );
                importedSubscribers += result.rowCount;
            }
            const content = mergeStoreContent(createDefaultStoreContent(), store.siteContent || {});
            await client.query(
                "INSERT INTO site_content (id, data) VALUES (1, $1::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()",
                [JSON.stringify(content)],
            );
            await client.query("COMMIT");
            console.log(`Imported ${importedProducts} products, ${importedOrders} orders, ${importedCustomers} customers, ${importedSubscribers} newsletter subscribers and the storefront content. This one-time import is now marked complete.`);
        }
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
