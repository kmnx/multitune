-- 004_create_user_services.sql
-- Table to store linked services and tokens for each user

CREATE TABLE IF NOT EXISTS user_services (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    service VARCHAR(50) NOT NULL, -- e.g. 'youtube', 'spotify'
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX user_service_unique ON user_services(user_id, service);
