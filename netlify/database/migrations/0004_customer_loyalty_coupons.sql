ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS loyalty_initialized BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS coupons (
    code TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

UPDATE orders AS o
SET data = jsonb_set(
    o.data,
    '{loyaltyPointsEarned}',
    to_jsonb(GREATEST(0, FLOOR(COALESCE((o.data->>'baseTotal')::numeric, (o.data->>'total')::numeric, 0))::integer)),
    TRUE
)
WHERE o.status <> 'cancelled'
  AND COALESCE((o.data->>'loyaltyPointsEarned')::integer, 0) = 0
  AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = o.data->>'customerId'
         OR lower(c.email) = lower(o.data->'customer'->>'email')
  );

UPDATE customers AS c
SET loyalty_points = COALESCE((
        SELECT SUM((o.data->>'loyaltyPointsEarned')::integer)
        FROM orders o
        WHERE o.data->>'customerId' = c.id
           OR lower(o.data->'customer'->>'email') = lower(c.email)
    ), 0),
    loyalty_initialized = TRUE;
