import { Express, Request, Response } from "express";
import {
  addToWatchlist,
  removeFromWatchlist,
  getUserWatchlist,
  updateWatchlistItem,
  getUserWatchlistAlerts,
  markAlertAsRead,
  archiveAlert,
  getUnreadAlertsCount,
} from "./watchlistService";
import { getNewsScoreForSymbol } from "./apexNewsEngine";
import { getYahooStockQuote } from "./stockApi";

/**
 * Register watchlist API routes
 */
export function registerWatchlistRoutes(app: Express) {
  // ── GET /api/watchlist ────────────────────────────────────
  // Fetch user's watchlist with latest prices and news scores
  app.get("/api/watchlist", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const watchlist = await getUserWatchlist(req.user.id);

      // Enrich with latest prices and news scores (async, non-blocking)
      const enriched = await Promise.all(
        watchlist.map(async (item) => {
          try {
            const quote = await getYahooStockQuote(`${item.symbol}.NS`);
            const newsScore = await getNewsScoreForSymbol(item.symbol);
            return {
              ...item,
              currentPrice: quote?.price,
              change: quote?.change,
              changePercent: quote?.changePercent,
              newsScore,
            };
          } catch (err) {
            return item;
          }
        })
      );

      res.json({ watchlist: enriched });
    } catch (err: any) {
      console.error("[WatchlistAPI] GET /api/watchlist error:", err);
      res.status(500).json({ message: "Failed to fetch watchlist" });
    }
  });

  // ── POST /api/watchlist ────────────────────────────────────
  // Add stock to watchlist
  app.post("/api/watchlist", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { symbol, stockName, sector } = req.body;
      if (!symbol || !stockName) {
        return res.status(400).json({ message: "Missing symbol or stockName" });
      }

      const item = await addToWatchlist(req.user.id, symbol, stockName, sector);
      res.json({ success: true, watchlistItem: item });
    } catch (err: any) {
      console.error("[WatchlistAPI] POST /api/watchlist error:", err);
      res.status(500).json({ message: "Failed to add to watchlist" });
    }
  });

  // ── DELETE /api/watchlist/:id ──────────────────────────────
  // Remove stock from watchlist
  app.delete("/api/watchlist/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      await removeFromWatchlist(id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[WatchlistAPI] DELETE /api/watchlist/:id error:", err);
      res.status(500).json({ message: "Failed to remove from watchlist" });
    }
  });

  // ── PATCH /api/watchlist/:id ───────────────────────────────
  // Update watchlist item preferences
  app.patch("/api/watchlist/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const { trackNews, trackEvents, trackTechnicals, alertThreshold } = req.body;

      await updateWatchlistItem(id, {
        trackNews,
        trackEvents,
        trackTechnicals,
        alertThreshold,
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("[WatchlistAPI] PATCH /api/watchlist/:id error:", err);
      res.status(500).json({ message: "Failed to update watchlist item" });
    }
  });

  // ── GET /api/watchlist/alerts ──────────────────────────────
  // Fetch user's watchlist alerts
  app.get("/api/watchlist/alerts", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const alerts = await getUserWatchlistAlerts(req.user.id);
      const unreadCount = await getUnreadAlertsCount(req.user.id);

      res.json({ alerts, unreadCount });
    } catch (err: any) {
      console.error("[WatchlistAPI] GET /api/watchlist/alerts error:", err);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  // ── POST /api/watchlist/alerts/:id/read ────────────────────
  // Mark alert as read
  app.post("/api/watchlist/alerts/:id/read", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      await markAlertAsRead(id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[WatchlistAPI] POST /api/watchlist/alerts/:id/read error:", err);
      res.status(500).json({ message: "Failed to mark alert as read" });
    }
  });

  // ── POST /api/watchlist/alerts/:id/archive ─────────────────
  // Archive alert
  app.post("/api/watchlist/alerts/:id/archive", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      await archiveAlert(id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[WatchlistAPI] POST /api/watchlist/alerts/:id/archive error:", err);
      res.status(500).json({ message: "Failed to archive alert" });
    }
  });
}
