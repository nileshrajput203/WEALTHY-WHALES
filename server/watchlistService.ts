import { db } from "./db";
import { userWatchlists, watchlistAlerts } from "@shared/watchlist-schema";
import { and, eq, desc, gte, lte } from "drizzle-orm";
import { getNowIST } from "./istUtils";

/**
 * Watchlist Service — manages user watchlist persistence and alerts.
 */

export async function addToWatchlist(
  userId: string,
  symbol: string,
  stockName: string,
  sector?: string
) {
  const existing = await db.select()
    .from(userWatchlists)
    .where(and(
      eq(userWatchlists.userId, userId),
      eq(userWatchlists.symbol, symbol)
    ))
    .limit(1);

  if (existing.length > 0) {
    // Reactivate if soft-deleted
    await db.update(userWatchlists)
      .set({ isActive: true })
      .where(eq(userWatchlists.id, existing[0].id));
    return existing[0];
  }

  const [newItem] = await db.insert(userWatchlists).values({
    userId,
    symbol,
    stockName,
    sector,
    trackNews: true,
    trackEvents: true,
    trackTechnicals: true,
  }).returning();

  return newItem;
}

export async function removeFromWatchlist(watchlistId: string) {
  // Soft delete
  await db.update(userWatchlists)
    .set({ isActive: false })
    .where(eq(userWatchlists.id, watchlistId));
}

export async function getUserWatchlist(userId: string) {
  return db.select()
    .from(userWatchlists)
    .where(and(
      eq(userWatchlists.userId, userId),
      eq(userWatchlists.isActive, true)
    ))
    .orderBy(desc(userWatchlists.addedAt));
}

export async function updateWatchlistItem(
  watchlistId: string,
  updates: {
    trackNews?: boolean;
    trackEvents?: boolean;
    trackTechnicals?: boolean;
    alertThreshold?: number;
  }
) {
  await db.update(userWatchlists)
    .set(updates)
    .where(eq(userWatchlists.id, watchlistId));
}

export async function updateWatchlistPrice(
  symbol: string,
  price: string
) {
  const now = getNowIST();
  await db.update(userWatchlists)
    .set({
      lastPrice: price,
      lastPriceUpdatedAt: now,
    })
    .where(eq(userWatchlists.symbol, symbol));
}

export async function updateWatchlistNewsScore(
  symbol: string,
  newsScore: number
) {
  const now = getNowIST();
  await db.update(userWatchlists)
    .set({
      lastNewsScore: newsScore,
      lastNewsUpdatedAt: now,
    })
    .where(eq(userWatchlists.symbol, symbol));
}

export async function createWatchlistAlert(
  userId: string,
  watchlistId: string,
  symbol: string,
  alertType: string,
  title: string,
  description?: string,
  severity: 'info' | 'warning' | 'critical' = 'info',
  metadata?: Record<string, any>
) {
  const [alert] = await db.insert(watchlistAlerts).values({
    userId,
    watchlistId,
    symbol,
    alertType,
    title,
    description,
    severity,
    metadata: metadata || {},
  }).returning();

  return alert;
}

export async function getUserWatchlistAlerts(userId: string, limit = 50) {
  return db.select()
    .from(watchlistAlerts)
    .where(eq(watchlistAlerts.userId, userId))
    .orderBy(desc(watchlistAlerts.firedAt))
    .limit(limit);
}

export async function getUnreadAlertsCount(userId: string) {
  const result = await db.select({ count: db.sql<number>`count(*)` })
    .from(watchlistAlerts)
    .where(and(
      eq(watchlistAlerts.userId, userId),
      eq(watchlistAlerts.isRead, false)
    ));

  return result[0]?.count || 0;
}

export async function markAlertAsRead(alertId: string) {
  const now = getNowIST();
  await db.update(watchlistAlerts)
    .set({
      isRead: true,
      readAt: now,
    })
    .where(eq(watchlistAlerts.id, alertId));
}

export async function archiveAlert(alertId: string) {
  await db.update(watchlistAlerts)
    .set({ isArchived: true })
    .where(eq(watchlistAlerts.id, alertId));
}

export async function getWatchlistSymbols(userId: string): Promise<string[]> {
  const items = await getUserWatchlist(userId);
  return items.map(item => item.symbol);
}

/**
 * Batch update prices for all watchlist stocks (called by price update job)
 */
export async function batchUpdateWatchlistPrices(
  priceMap: Record<string, string>
) {
  const now = getNowIST();
  
  for (const [symbol, price] of Object.entries(priceMap)) {
    await db.update(userWatchlists)
      .set({
        lastPrice: price,
        lastPriceUpdatedAt: now,
      })
      .where(eq(userWatchlists.symbol, symbol));
  }
}

/**
 * Batch update news scores for all watchlist stocks (called by news job)
 */
export async function batchUpdateWatchlistNewsScores(
  newsScoreMap: Record<string, number>
) {
  const now = getNowIST();
  
  for (const [symbol, score] of Object.entries(newsScoreMap)) {
    await db.update(userWatchlists)
      .set({
        lastNewsScore: score,
        lastNewsUpdatedAt: now,
      })
      .where(eq(userWatchlists.symbol, symbol));
  }
}
