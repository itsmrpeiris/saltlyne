ALTER TABLE newsletter_subscribers
    ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_unsubscribe_token_idx
    ON newsletter_subscribers (unsubscribe_token);
