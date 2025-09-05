
import express, { Request, Response } from 'express';
import pool from './db';
import { authenticateJWT } from './auth';
import passport from 'passport';
import axios from 'axios';
import { Strategy as SpotifyStrategy } from 'passport-spotify';

const router = express.Router();

// --- Spotify OAuth setup ---
passport.use('spotify', new SpotifyStrategy({
  clientID: process.env.SPOTIFY_CLIENT_ID || '',
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
  callbackURL: process.env.SPOTIFY_CALLBACK_URL || 'http://127.0.0.1:4000/auth/spotify/callback',
  scope: ['user-read-email', 'playlist-read-private', 'playlist-read-collaborative'],
  passReqToCallback: true
}, async (req: any, accessToken: string, refreshToken: string, expires_in: number, profile: any, done: any) => {
  try {
    // Find user by email (assume already logged in)
    const email = profile.emails && profile.emails[0]?.value;
    let userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user = userRes.rows[0];
    if (!user) {
      // Optionally, create user if not found
      const username = profile.displayName || email || `spotify_${profile.id}`;
      const insertRes = await pool.query(
        'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING *',
        [username, email]
      );
      user = insertRes.rows[0];
    }
    // Upsert user_services
    await pool.query(
      `INSERT INTO user_services (user_id, service, access_token, refresh_token, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 hour')
       ON CONFLICT (user_id, service) DO UPDATE SET access_token = $3, refresh_token = $4, updated_at = NOW()`,
      [user.id, 'spotify', accessToken, refreshToken]
    );
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

router.use(passport.initialize());

// --- Spotify OAuth routes ---
router.get('/spotify', passport.authenticate('spotify', { scope: [
  'user-read-email',
  'playlist-read-private',
  'playlist-read-collaborative'
] }));

router.get('/spotify/callback', passport.authenticate('spotify', { session: false, failureRedirect: '/' }), (req, res) => {
  // Issue JWT and redirect or respond
  const user = req.user as any;
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(`${frontendUrl}/?token=${token}&linked=spotify`);
});

// --- Spotify linked status endpoint ---
router.get('/api/spotify/linked', authenticateJWT, async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const result = await pool.query('SELECT 1 FROM user_services WHERE user_id = $1 AND service = $2', [userId, 'spotify']);
    const isLinked = result.rows.length > 0;
    console.log(`[Spotify Linked Check] userId: ${userId}, linked: ${isLinked}`);
    res.json({ linked: isLinked });
  } catch (err) {
    console.error('[Spotify Linked Check] Error:', err);
    res.status(500).json({ error: 'Failed to check Spotify link status' });
  }
});

// --- Fetch Spotify playlists for the authenticated user ---
router.get('/api/spotify/playlists', authenticateJWT, async (req: any, res: Response) => {
  const userId = req.user.userId;
  try {
    // Get Spotify access token from user_services
    const result = await pool.query('SELECT access_token FROM user_services WHERE user_id = $1 AND service = $2', [userId, 'spotify']);
    if (!result.rows.length) return res.status(400).json({ error: 'Spotify not linked' });
    const accessToken = result.rows[0].access_token;
    // Fetch playlists from Spotify API
    const playlistsRes = await axios.get('https://api.spotify.com/v1/me/playlists', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { limit: 50 }
    });
    const playlists = playlistsRes.data.items;
    // Upsert playlists into DB
    for (const pl of playlists) {
      const { id: spotify_playlist_id, name, description, images } = pl;
      const thumbnail_url = images && images[0]?.url || null;
      const upsert = await pool.query(
        `INSERT INTO playlists_spotify (user_id, spotify_playlist_id, name, description, thumbnail_url, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id, spotify_playlist_id) DO UPDATE SET name = $3, description = $4, thumbnail_url = $5, updated_at = NOW()
         RETURNING id`,
        [userId, spotify_playlist_id, name, description, thumbnail_url]
      );
    }
    res.json({ playlists });
  } catch (err) {
    console.error('[Spotify Playlists] Error:', err);
    res.status(500).json({ error: 'Failed to fetch Spotify playlists' });
  }
});

// --- Fetch items for a specific Spotify playlist from our own database ---
router.get('/api/db/spotify/playlist/:id/items', authenticateJWT, async (req: any, res: Response) => {
  const userId = req.user.userId;
  const playlistId = req.params.id;
  try {
    // Ensure the playlist belongs to the user
    const playlistRes = await pool.query('SELECT * FROM playlists_spotify WHERE id = $1 AND user_id = $2', [playlistId, userId]);
    if (!playlistRes.rows.length) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    // Fetch items ordered by track number
    const itemsRes = await pool.query(
      `SELECT * FROM playlist_items_spotify WHERE playlist_id = $1 ORDER BY track_number ASC`,
      [playlistId]
    );
    res.json({ items: itemsRes.rows });
  } catch (err) {
    console.error('[DB Spotify Playlist Items] Error:', err);
    res.status(500).json({ error: 'Failed to fetch playlist items' });
  }
});

export default router;
