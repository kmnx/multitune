


import './env';
import express from 'express';
import cors from 'cors';
import pool from './db';
import passport from 'passport';


import authRouter from './auth';
import apiYouTubeRouter from './api_youtube';
import apiDbRouter from './api_db';
import apiSpotifyRouter from './api_spotify';


const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(passport.initialize());

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.use('/auth', authRouter);
app.use('/auth', apiYouTubeRouter);
app.use('/auth', apiDbRouter);
app.use('/auth', apiSpotifyRouter);

app.get('/', (req, res) => {
  res.send('Multitune backend is running!');
});

// Test DB connection endpoint
app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: 'Database connection failed', details: err });
  }
});

app.listen(port, '0.0.0.0',() => {
  console.log(`Server listening on port ${port}`);
});
