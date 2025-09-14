-- 003_playlists_youtube.sql

CREATE TABLE IF NOT EXISTS playlists_youtube (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    yt_playlist_id VARCHAR(64) NOT NULL,
    title TEXT,
    description TEXT,
    thumbnail_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, yt_playlist_id)
);

CREATE TABLE IF NOT EXISTS playlist_items_youtube (
    id SERIAL PRIMARY KEY,
    playlist_id INTEGER NOT NULL REFERENCES playlists_youtube(id) ON DELETE CASCADE,
    yt_video_id VARCHAR(32) NOT NULL,
    title TEXT,
    description TEXT,
    published_at TIMESTAMP,
    channel_title TEXT,
    channel_id VARCHAR(64),
    thumbnail_url TEXT,
    position INTEGER,
    duration VARCHAR(16),
    added_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(playlist_id, yt_video_id)
);
