import { sql } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

/**
 * User watchlist table — persistent, server-side watchlist with metadata.
 * Replaces localStorage-only approach with rich data model.
 */
export const userWatchlists = pgTable("user_watchlists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  stockName: varchar("stock_name", { length: 100 }),
  sector: varchar("sector", { length: 50 }),
  
  // Entry metadata
  addedAt: timestamp("added_at").defaultNow(),
  
  // User preferences for this stock
  alertThreshold: integer("alert_threshold").default(70), // min VCP score to alert
  trackNews: boolean("track_news").default(true),
  trackEvents: boolean("track_events").default(true),
  trackTechnicals: boolean("track_technicals").default(true),
  
  // Last cached price and sentiment
  lastPrice: varchar("last_price"),
  lastPriceUpdatedAt: timestamp("last_price_updated_at"),
  lastNewsScore: integer("last_news_score"), // -100 to +100
  lastNewsUpdatedAt: timestamp("last_news_updated_at"),
  
  // Metadata blob for future expansion
  metadata: jsonb("metadata").default({}), // { customLabel, color, notes, etc. }
  
  // Soft delete
  isActive: boolean("is_active").default(true),
}, (table) => [
  index("idx_watchlist_user").on(table.userId),
  index("idx_watchlist_symbol").on(table.symbol),
  index("idx_watchlist_active").on(table.isActive),
]);

export type UserWatchlist = typeof userWatchlists.$inferSelect;
export type InsertUserWatchlist = typeof userWatchlists.$inferInsert;

/**
 * Watchlist alerts — triggered when a stock meets user-defined criteria.
 */
export const watchlistAlerts = pgTable("watchlist_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  watchlistId: varchar("watchlist_id").notNull().references(() => userWatchlists.id, { onDelete: 'cascade' }),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  
  // Alert type
  alertType: varchar("alert_type", { length: 30 }).notNull(), // VCP_BREAKOUT | NEWS_CATALYST | EVENT_UPCOMING | PRICE_ALERT
  
  // Alert data
  title: varchar("title").notNull(),
  description: varchar("description"),
  severity: varchar("severity", { length: 10 }).default("info"), // info | warning | critical
  
  // Metadata
  metadata: jsonb("metadata").default({}), // { score, catalyst, pattern, etc. }
  
  // Status
  isRead: boolean("is_read").default(false),
  isArchived: boolean("is_archived").default(false),
  
  // Timestamps
  firedAt: timestamp("fired_at").defaultNow(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_alert_user").on(table.userId),
  index("idx_alert_symbol").on(table.symbol),
  index("idx_alert_fired").on(table.firedAt),
]);

export type WatchlistAlert = typeof watchlistAlerts.$inferSelect;
export type InsertWatchlistAlert = typeof watchlistAlerts.$inferInsert;
