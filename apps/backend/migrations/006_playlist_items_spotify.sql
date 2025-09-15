-- 006_playlist_items_spotify.sql
-- Table for items (tracks) in Spotify playlists

CREATE TABLE IF NOT EXISTS playlist_items_spotify (
    id SERIAL PRIMARY KEY,
    playlist_id INTEGER NOT NULL REFERENCES playlists_spotify(id) ON DELETE CASCADE,
    spotify_track_id VARCHAR(128) NOT NULL,
    title TEXT,
    artist TEXT,
    album TEXT,
    duration_ms INTEGER,
    spotify_url TEXT,
    preview_url TEXT,
    position INTEGER,
    added_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(playlist_id, spotify_track_id)
);
