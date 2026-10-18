import { getDatabase } from "@netlify/database";

const connectionString = process.env.NETLIFY_DB_URL || process.env.NETLIFY_DATABASE_URL;
if (!connectionString) {
    console.error("Set NETLIFY_DB_URL or NETLIFY_DATABASE_URL to the intended Netlify Database connection string.");
    process.exit(1);
}

const requiredRelations = [
    "products",
    "orders",
    "store_imports",
    "site_content",
    "customers",
    "newsletter_subscribers",
    "coupons",
    "customer_password_reset_tokens",
];
const database = getDatabase({ connectionString });
const client = await database.pool.connect();
try {
    const result = await client.query(
        "SELECT name, to_regclass('public.' || name) IS NOT NULL AS present FROM unnest($1::text[]) AS name",
        [requiredRelations],
    );
    const missing = result.rows.filter((row) => !row.present).map((row) => row.name);
    if (missing.length) {
        console.error(`Database connection succeeded, but required relations are missing: ${missing.join(", ")}. Deploy after attaching the database so Netlify can apply migrations 0001–0006.`);
        process.exitCode = 1;
    } else {
        const columns = await client.query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = ANY($1::text[])",
            [["addresses", "loyalty_points", "last_login_at", "session_version"]],
        );
        const presentColumns = new Set(columns.rows.map((row) => row.column_name));
        const missingColumns = ["addresses", "loyalty_points", "last_login_at", "session_version"].filter((column) => !presentColumns.has(column));
        if (missingColumns.length) {
            console.error(`Database connection succeeded, but customer columns are missing: ${missingColumns.join(", ")}.`);
            process.exitCode = 1;
        } else {
            console.log("Netlify Database connection succeeded; required storefront tables and customer columns, including password reset tokens, are present.");
        }
    }
} catch (error) {
    console.error(`Database verification failed (${error.code || "database_error"}). Check the connection string, permissions, and migration deployment.`);
    process.exitCode = 1;
} finally {
    client.release();
    await database.pool.end();
}
