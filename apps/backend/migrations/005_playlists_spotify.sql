-- Migration: Create playlists_spotify table for Spotify playlists
CREATE TABLE playlists_spotify (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  spotify_playlist_id VARCHAR(128) NOT NULL,
  name TEXT,
  description TEXT,
  thumbnail_url TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, spotify_playlist_id)
);
