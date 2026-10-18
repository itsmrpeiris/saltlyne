ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';

UPDATE customers
SET first_name = split_part(trim(name), ' ', 1),
    last_name = trim(substr(trim(name), length(split_part(trim(name), ' ', 1)) + 1))
WHERE first_name = '' AND last_name = '';
