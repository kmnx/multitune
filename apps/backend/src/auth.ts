import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from './db';
import passport from 'passport';
import axios from 'axios';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { Request, Response, NextFunction } from 'express';
const host = process.env.FRONTEND_HOST || 'localhost';
const port = process.env.FRONTEND_PORT || '3000';

// If port is 80 (default for HTTP), omit it from the URL
const frontendUrl =
  port === '80'
    ? `http://${host}`
    : `http://${host}:${port}`;

// Helper to refresh Google OAuth 2.0 access token (works for both Google and YouTube)
export async function refreshAccessToken(refreshToken: string) {
  const params = new URLSearchParams();
  params.append('client_id', process.env.GOOGLE_CLIENT_ID || '');
  params.append('client_secret', process.env.GOOGLE_CLIENT_SECRET || '');
  params.append('refresh_token', refreshToken);
  params.append('grant_type', 'refresh_token');
  const resp = await axios.post('https://oauth2.googleapis.com/token', params);
  return resp.data;
}

// Extend Express Request to include user property
export interface AuthenticatedRequest extends Request {
  user?: any;
}
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';


// Middleware to authenticate requests using JWT in Authorization header
export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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


// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/' }), (req, res) => {
  // Issue JWT and redirect or respond
  const user = req.user as any;
  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  // For SPA, you might want to redirect with token in query or respond with HTML/JS
  // Here, redirect to frontend with token in query
  res.redirect(`${frontendUrl}/?token=${token}`);
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
  passReqToCallback: true,
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


// YouTube OAuth routes
router.get('/youtube', passport.authenticate('youtube', Object.assign({
  scope: [
    'https://www.googleapis.com/auth/youtube.readonly',
    'profile',
    'email'
  ]
}, {
  accessType: 'offline',
  prompt: 'consent'
}) as any));

router.get('/youtube/callback', passport.authenticate('youtube', { session: false, failureRedirect: '/' }), (req, res) => {
  // Issue JWT and redirect or respond
  const user = req.user as any;
  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.redirect(`${frontendUrl}/?token=${token}&linked=youtube`);
});


// Main Site Signup
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


// router.use(passport.initialize());


// Main Site Login
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
