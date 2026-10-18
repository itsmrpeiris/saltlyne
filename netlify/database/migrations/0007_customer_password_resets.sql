CREATE TABLE IF NOT EXISTS customer_password_reset_tokens (
    customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS customer_password_reset_expiry_idx
    ON customer_password_reset_tokens (expires_at);
