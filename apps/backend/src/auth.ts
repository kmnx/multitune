import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from './db';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

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
