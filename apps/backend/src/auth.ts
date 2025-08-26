import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from './db';
import passport from 'passport';
import axios from 'axios';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { Request, Response, NextFunction } from 'express';

// Extend Express Request to include user property
interface AuthenticatedRequest extends Request {
  user?: any;
}
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';


// Middleware to authenticate requests using JWT in Authorization header
function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });
  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}


// --- YouTube linked status endpoint ---
router.get('/api/youtube/linked', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user.userId;
    const result = await pool.query('SELECT 1 FROM user_services WHERE user_id = $1 AND service = $2', [userId, 'youtube']);
    const isLinked = result.rows.length > 0;
    console.log(`[YouTube Linked Check] userId: ${userId}, linked: ${isLinked}`);
    res.json({ linked: isLinked });
  } catch (err) {
    console.error('[YouTube Linked Check] Error:', err);
    res.status(500).json({ error: 'Failed to check YouTube link status' });
  }
});

// Fetch YouTube playlists for the authenticated user
router.get('/api/youtube/playlists', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {

// Fetch items for a specific playlist from our own database (generic DB API)
router.get('/api/db/playlist/:id/items', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user.userId;
  const playlistId = req.params.id;
  try {
    // Ensure the playlist belongs to the user
    const playlistRes = await pool.query('SELECT * FROM playlists_youtube WHERE id = $1 AND user_id = $2', [playlistId, userId]);
    if (!playlistRes.rows.length) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    // Fetch items ordered by position (or upload date as fallback)
    const itemsRes = await pool.query(
      `SELECT * FROM playlist_items_youtube WHERE playlist_id = $1 ORDER BY position ASC, published_at DESC`,
      [playlistId]
    );
    res.json({ items: itemsRes.rows });
  } catch (err) {
    console.error('[DB Playlist Items] Error:', err);
    res.status(500).json({ error: 'Failed to fetch playlist items' });
  }
});
  const userId = req.user.userId;
  console.log(`[YouTube Playlists] Called for userId: ${userId}`);
  try {
    // Get YouTube access token from user_services
    const result = await pool.query('SELECT access_token FROM user_services WHERE user_id = $1 AND service = $2', [userId, 'youtube']);
    if (!result.rows.length) {
      console.log(`[YouTube Playlists] No YouTube link found for userId: ${userId}`);
      return res.status(400).json({ error: 'YouTube not linked' });
    }
    const accessToken = result.rows[0].access_token;

    // Fetch playlists from YouTube Data API
    type YTPlaylist = {
      id: string;
      snippet?: any;
      contentDetails?: any;
    };
    let playlists: YTPlaylist[] = [];
    let nextPageToken: string | undefined = undefined;
    do {
      const ytRes: { data: { items: YTPlaylist[]; nextPageToken?: string } } = await axios.get('https://www.googleapis.com/youtube/v3/playlists', {
        params: {
          part: 'snippet,contentDetails',
          mine: true,
          maxResults: 50,
          pageToken: nextPageToken
        },
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      playlists = playlists.concat(ytRes.data.items);
      nextPageToken = ytRes.data.nextPageToken;
    } while (nextPageToken);

    // Upsert playlists into DB and collect their DB ids
    const playlistIdMap: { [yt_playlist_id: string]: number } = {};
    for (const pl of playlists) {
      const { id: yt_playlist_id, snippet, contentDetails } = pl;
      const title = snippet?.title || null;
      const description = snippet?.description || null;
      const thumbnail_url = snippet?.thumbnails?.default?.url || null;
      const upsert = await pool.query(
        `INSERT INTO playlists_youtube (user_id, yt_playlist_id, title, description, thumbnail_url, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id, yt_playlist_id) DO UPDATE SET title = $3, description = $4, thumbnail_url = $5, updated_at = NOW()
         RETURNING id`,
        [userId, yt_playlist_id, title, description, thumbnail_url]
      );
      playlistIdMap[yt_playlist_id] = upsert.rows[0].id;
    }

    // Fetch and upsert playlist items for each playlist
    type YTPlaylistItem = {
      snippet?: any;
      contentDetails?: any;
    };
    for (const pl of playlists) {
      const yt_playlist_id = pl.id;
      const playlist_db_id = playlistIdMap[yt_playlist_id];
      let items: YTPlaylistItem[] = [];
      let nextItemPage: string | undefined = undefined;
      do {
        const itemsRes: { data: { items: YTPlaylistItem[]; nextPageToken?: string } } = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
          params: {
            part: 'snippet,contentDetails',
            playlistId: yt_playlist_id,
            maxResults: 50,
            pageToken: nextItemPage
          },
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        items = items.concat(itemsRes.data.items);
        nextItemPage = itemsRes.data.nextPageToken;
      } while (nextItemPage);

      for (const item of items) {
        const { snippet, contentDetails } = item;
        const yt_video_id = contentDetails?.videoId || null;
        if (!yt_video_id) continue;
        const title = snippet?.title || null;
        const description = snippet?.description || null;
        const published_at = snippet?.publishedAt ? new Date(snippet.publishedAt) : null;
        const channel_title = snippet?.videoOwnerChannelTitle || snippet?.channelTitle || null;
        const channel_id = snippet?.videoOwnerChannelId || snippet?.channelId || null;
        const thumbnail_url = snippet?.thumbnails?.default?.url || null;
        const position = snippet?.position ?? null;
        // Upsert item
        await pool.query(
          `INSERT INTO playlist_items_youtube (playlist_id, yt_video_id, title, description, published_at, channel_title, channel_id, thumbnail_url, position, added_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           ON CONFLICT (playlist_id, yt_video_id) DO UPDATE SET title = $3, description = $4, published_at = $5, channel_title = $6, channel_id = $7, thumbnail_url = $8, position = $9, added_at = NOW()`,
          [playlist_db_id, yt_video_id, title, description, published_at, channel_title, channel_id, thumbnail_url, position]
        );
      }
    }

    // Return playlists and items from DB
    const dbPlaylistsRes = await pool.query(
      `SELECT p.*, (
         SELECT json_agg(pi) FROM (
           SELECT * FROM playlist_items_youtube WHERE playlist_id = p.id ORDER BY position
         ) pi
       ) AS items
       FROM playlists_youtube p WHERE user_id = $1 ORDER BY p.title`,
      [userId]
    );
    res.json({ playlists: dbPlaylistsRes.rows });
  } catch (err) {
    const errorData = (err as any)?.response?.data || (err as any)?.message || err;
    console.error(`[YouTube Playlists] Error for userId: ${userId}:`, errorData);
    res.status(500).json({ error: 'Failed to fetch YouTube playlists', details: errorData });
  }
});










// YouTube OAuth setup
passport.use('youtube', new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callbackURL: process.env.YOUTUBE_CALLBACK_URL || 'http://localhost:4000/auth/youtube/callback',
  scope: [
    'https://www.googleapis.com/auth/youtube.readonly',
    'profile',
    'email'
  ],
  passReqToCallback: true
}, async (req: any, accessToken: string, refreshToken: string, profile: Profile, done: any) => {
  try {
    // Find user by email (assume already logged in)
    const email = profile.emails && profile.emails[0]?.value;
    let userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user = userRes.rows[0];
    if (!user) {
      // Optionally, create user if not found
      const username = profile.displayName || email || `yt_${profile.id}`;
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
      [user.id, 'youtube', accessToken, refreshToken]
    );
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

// Fetch YouTube playlists for the authenticated user
router.get('/api/youtube/playlists', authenticateJWT, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    // Get YouTube access token from user_services
    const result = await pool.query('SELECT access_token FROM user_services WHERE user_id = $1 AND service = $2', [userId, 'youtube']);
    if (!result.rows.length) return res.status(400).json({ error: 'YouTube not linked' });
    const accessToken = result.rows[0].access_token;
    // Fetch playlists from YouTube Data API
    const ytRes = await axios.get('https://www.googleapis.com/youtube/v3/playlists', {
      params: {
        part: 'snippet,contentDetails',
        mine: true,
        maxResults: 50
      },
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    res.json({ playlists: ytRes.data.items });
  } catch (err: any) {
    console.error('YouTube playlist fetch error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to fetch YouTube playlists', details: err?.response?.data || err.message });
  }
});

// YouTube OAuth routes
router.get('/youtube', passport.authenticate('youtube', { scope: [
  'https://www.googleapis.com/auth/youtube.readonly',
  'profile',
  'email'
] }));

router.get('/youtube/callback', passport.authenticate('youtube', { session: false, failureRedirect: '/' }), (req, res) => {
  // Issue JWT and redirect or respond
  const user = req.user as any;
  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(`${frontendUrl}/?token=${token}&linked=youtube`);
});

// Google OAuth setup
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Find or create user
    const email = profile.emails && profile.emails[0]?.value;
    const googleId = profile.id;
    let userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user = userRes.rows[0];
    if (!user) {
      // Create user with Google profile
      const username = profile.displayName || email || `google_${googleId}`;
      const insertRes = await pool.query(
        'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING *',
        [username, email]
      );
      user = insertRes.rows[0];
    }
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

router.use(passport.initialize());

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/' }), (req, res) => {
  // Issue JWT and redirect or respond
  const user = req.user as any;
  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  // For SPA, you might want to redirect with token in query or respond with HTML/JS
  // Here, redirect to frontend with token in query
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(`${frontendUrl}/?token=${token}`);
});

// Signup
router.post('/signup', async (req: Request, res: Response) => {
  const { username, password, email } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, hash, email || null]
    );
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err: any) {
    console.error('Signup error:', err);
    if (err.code === '23505') {
      res.status(409).json({ error: 'Username or email already exists.' });
    } else {
      res.status(500).json({ error: 'Signup failed', details: err.message });
    }
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials.' });
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});




// --- YouTube OAuth (placeholder) ---
// These must be after 'const router = express.Router();'
router.get('/youtube', (req, res) => {
  // TODO: Implement YouTube OAuth flow
  res.status(501).send('YouTube OAuth not implemented yet.');
});

router.get('/youtube/callback', (req, res) => {
  // TODO: Handle YouTube OAuth callback
  res.status(501).send('YouTube OAuth callback not implemented yet.');
});



// Google OAuth setup
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Find or create user
    const email = profile.emails && profile.emails[0]?.value;
    const googleId = profile.id;
    let userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user = userRes.rows[0];
    if (!user) {
      // Create user with Google profile
      const username = profile.displayName || email || `google_${googleId}`;
      const insertRes = await pool.query(
        'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING *',
        [username, email]
      );
      user = insertRes.rows[0];
    }
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

router.use(passport.initialize());

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/' }), (req, res) => {
  // Issue JWT and redirect or respond
  const user = req.user as any;
  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  // For SPA, you might want to redirect with token in query or respond with HTML/JS
  // Here, redirect to frontend with token in query
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(`${frontendUrl}/?token=${token}`);
});

// --- YouTube OAuth (placeholder) ---
router.get('/youtube', (req, res) => {
  // TODO: Implement YouTube OAuth flow
  res.status(501).send('YouTube OAuth not implemented yet.');
});

router.get('/youtube/callback', (req, res) => {
  // TODO: Handle YouTube OAuth callback
  res.status(501).send('YouTube OAuth callback not implemented yet.');
});

// Signup
router.post('/signup', async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, hash, email || null]
    );
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err: any) {
    console.error('Signup error:', err);
    if (err.code === '23505') {
      res.status(409).json({ error: 'Username or email already exists.' });
    } else {
      res.status(500).json({ error: 'Signup failed', details: err.message });
    }
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials.' });
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});


export default router;
