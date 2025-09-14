-- 002_user_auth.sql
-- Add username (unique, required) and make email optional

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE NOT NULL DEFAULT '',
    ALTER COLUMN email DROP NOT NULL;

-- Set username to a placeholder for existing rows (if any)
UPDATE users SET username = 'user_' || id WHERE username = '' OR username IS NULL;

-- Remove default for future inserts
ALTER TABLE users
    ALTER COLUMN IF NOT EXISTS username DROP DEFAULT;
