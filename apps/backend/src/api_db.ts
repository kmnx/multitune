import express, { Request, Response, NextFunction } from "express";
import pool from "./db";
import { authenticateJWT } from "./auth";

const router = express.Router();

// Fetch items for a specific playlist from our own database (generic DB API)
router.get(
  "/api/db/playlist/:id/items",
  authenticateJWT,
  async (req: any, res: Response) => {
    const userId = req.user.userId;
    const playlistId = req.params.id;
    try {
      // Ensure the playlist belongs to the user
      const playlistRes = await pool.query(
        "SELECT * FROM playlists_youtube WHERE id = $1 AND user_id = $2",
        [playlistId, userId]
      );
      if (!playlistRes.rows.length) {
        return res.status(404).json({ error: "Playlist not found" });
      }
      // Fetch items ordered by position (or upload date as fallback)
      const itemsRes = await pool.query(
        `SELECT * FROM playlist_items_youtube WHERE playlist_id = $1 ORDER BY position ASC, published_at DESC`,
        [playlistId]
      );
      res.json({ items: itemsRes.rows });
    } catch (err) {
      console.error("[DB Playlist Items] Error:", err);
      res.status(500).json({ error: "Failed to fetch playlist items" });
    }
  }
);

export default router;
