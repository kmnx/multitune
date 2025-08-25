-- 003_password_hash_nullable.sql
-- Allow password_hash to be NULL for OAuth users

ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL;
