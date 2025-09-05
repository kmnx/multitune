import express, { Request, Response, NextFunction } from 'express';
import pool from './db';
import axios from 'axios';
import { authenticateJWT, refreshAccessToken } from './auth';

const router = express.Router();

// --- YouTube linked status endpoint ---
router.get('/api/youtube/linked', authenticateJWT, async (req: any, res: Response) => {
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
router.get('/api/youtube/playlists', authenticateJWT, async (req: any, res: Response) => {
  const userId = req.user.userId;
  console.log(`[YouTube Playlists] Endpoint called.`);
  console.log(`[YouTube Playlists] JWT userId:`, userId);
  console.log(`[YouTube Playlists] Request headers:`, req.headers);

  async function fetchNewPlaylistsWithToken(accessToken: string, existingIds: Set<string>) {
    type YTPlaylist = { id: string; snippet?: any; contentDetails?: any };
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
      playlists = playlists.concat(ytRes.data.items.filter(pl => !existingIds.has(pl.id)));
      nextPageToken = ytRes.data.nextPageToken;
    } while (nextPageToken);
    return playlists;
  }

  async function fetchVideoDetails(videoIds: string[], accessToken: string) {
    if (videoIds.length === 0) return [];
    const details: any[] = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const resp = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: {
          part: 'snippet,contentDetails',
          id: batch.join(',')
        },
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      details.push(...resp.data.items);
    }
    return details;
  }

  try {
    console.log(`[YouTube Playlists] Querying user_services for userId: ${userId}`);
    const result = await pool.query('SELECT access_token, refresh_token FROM user_services WHERE user_id = $1 AND service = $2', [userId, 'youtube']);
    console.log(`[YouTube Playlists] DB query result:`, result.rows);
    if (!result.rows.length) {
      console.log(`[YouTube Playlists] No YouTube link found for userId: ${userId}`);
      return res.status(400).json({ error: 'YouTube not linked' });
    }
    let accessToken = result.rows[0].access_token;
    const refreshToken = result.rows[0].refresh_token;

    const existingPlaylistsRes = await pool.query('SELECT yt_playlist_id, id FROM playlists_youtube WHERE user_id = $1', [userId]);
    console.log(`[YouTube Playlists] Existing playlists DB result:`, existingPlaylistsRes.rows);
    const existingPlaylistIds = new Set(existingPlaylistsRes.rows.map((row: any) => row.yt_playlist_id));
    const playlistIdMap: { [yt_playlist_id: string]: number } = {};
    for (const row of existingPlaylistsRes.rows) {
      playlistIdMap[row.yt_playlist_id] = row.id;
    }

    let newPlaylists;
    try {
      console.log(`[YouTube Playlists] Fetching new playlists with accessToken.`);
      newPlaylists = await fetchNewPlaylistsWithToken(accessToken, existingPlaylistIds);
    } catch (err: any) {
      if (err.response && err.response.status === 401 && refreshToken) {
        try {
          console.log(`[YouTube Playlists] Access token expired, refreshing...`);
          const tokenData = await refreshAccessToken(refreshToken);
          accessToken = tokenData.access_token;
          await pool.query('UPDATE user_services SET access_token = $1, updated_at = NOW() WHERE user_id = $2 AND service = $3', [accessToken, userId, 'youtube']);
          console.log(`[YouTube Playlists] Retrying fetch with new accessToken.`);
          newPlaylists = await fetchNewPlaylistsWithToken(accessToken, existingPlaylistIds);
        } catch (refreshErr) {
          console.error('[YouTube Playlists] Token refresh failed:', refreshErr);
          return res.status(401).json({ error: 'YouTube authentication expired. Please re-link your account.' });
        }
      } else {
        const errorData = err?.response?.data || err?.message || err;
        console.error(`[YouTube Playlists] Error for userId: ${userId}:`, errorData);
        return res.status(500).json({ error: 'Failed to fetch YouTube playlists', details: errorData });
      }
    }

    for (const pl of newPlaylists) {
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

    type YTPlaylistItem = { snippet?: any; contentDetails?: any };
    for (const yt_playlist_id of Object.keys(playlistIdMap)) {
      const playlist_db_id = playlistIdMap[yt_playlist_id];
      const existingItemsRes = await pool.query('SELECT yt_video_id FROM playlist_items_youtube WHERE playlist_id = $1', [playlist_db_id]);
      console.log(`[YouTube Playlists] Existing items for playlist ${yt_playlist_id}:`, existingItemsRes.rows);
      const existingVideoIds = new Set(existingItemsRes.rows.map((row: any) => row.yt_video_id));
      const isInitialSync = existingVideoIds.size === 0;
      const part = isInitialSync ? 'snippet,contentDetails' : 'contentDetails';
      let nextItemPage: string | undefined = undefined;
      const newVideoIds: string[] = [];
      const newItems: any[] = [];
      do {
        const itemsRes: { data: { items: YTPlaylistItem[]; nextPageToken?: string } } = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
          params: {
            part,
            playlistId: yt_playlist_id,
            maxResults: 50,
            pageToken: nextItemPage
          },
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        for (const item of itemsRes.data.items) {
          const yt_video_id = item.contentDetails?.videoId;
          if (yt_video_id && !existingVideoIds.has(yt_video_id)) {
            newVideoIds.push(yt_video_id);
            newItems.push(item);
          }
        }
        nextItemPage = itemsRes.data.nextPageToken;
      } while (nextItemPage);

      let videoDetailsMap: { [videoId: string]: any } = {};
      if (!isInitialSync && newVideoIds.length > 0) {
        const details = await fetchVideoDetails(newVideoIds, accessToken);
        for (const vid of details) {
          videoDetailsMap[vid.id] = vid;
        }
      }

      for (const item of newItems) {
        const yt_video_id = item.contentDetails?.videoId || null;
        if (!yt_video_id) continue;
        let snippet = item.snippet;
        if (!isInitialSync && videoDetailsMap[yt_video_id]) {
          snippet = videoDetailsMap[yt_video_id].snippet;
        }
        const title = snippet?.title || null;
        const description = snippet?.description || null;
        const published_at = snippet?.publishedAt ? new Date(snippet.publishedAt) : null;
        const channel_title = snippet?.videoOwnerChannelTitle || snippet?.channelTitle || null;
        const channel_id = snippet?.videoOwnerChannelId || snippet?.channelId || null;
        const thumbnail_url = snippet?.thumbnails?.default?.url || null;
        const position = snippet?.position ?? null;
        await pool.query(
          `INSERT INTO playlist_items_youtube (playlist_id, yt_video_id, title, description, published_at, channel_title, channel_id, thumbnail_url, position, added_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           ON CONFLICT (playlist_id, yt_video_id) DO UPDATE SET title = $3, description = $4, published_at = $5, channel_title = $6, channel_id = $7, thumbnail_url = $8, position = $9, added_at = NOW()`,
          [playlist_db_id, yt_video_id, title, description, published_at, channel_title, channel_id, thumbnail_url, position]
        );
      }
    }

    console.log(`[YouTube Playlists] Returning playlists for userId: ${userId}`);
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





export default router;
