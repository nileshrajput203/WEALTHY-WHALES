import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - Required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - Required for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Stock Recommendations - Admin posted stock picks
export const stockRecommendations = pgTable("stock_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stockSymbol: varchar("stock_symbol").notNull(),
  stockName: varchar("stock_name").notNull(),
  exchange: varchar("exchange").notNull(), // NSE or BSE
  recommendationType: varchar("recommendation_type").notNull(), // BUY, SELL, HOLD
  reasonToBuy: text("reason_to_buy").notNull(),
  targetPrice: varchar("target_price").notNull(),
  stopLoss: varchar("stop_loss").notNull(),
  currentPrice: varchar("current_price").notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStockRecommendationSchema = createInsertSchema(stockRecommendations).omit({
  id: true,
  createdAt: true,
});

export type InsertStockRecommendation = z.infer<typeof insertStockRecommendationSchema>;
export type StockRecommendation = typeof stockRecommendations.$inferSelect;

// AI Chat Messages
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  sessionId: varchar("session_id").notNull(),
  message: text("message").notNull(),
  role: varchar("role").notNull(), // user or assistant
  stockContext: varchar("stock_context"), // optional stock symbol for context
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Scanner Data - For swing scanner and IPO base
export const scannerData = pgTable("scanner_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scannerType: varchar("scanner_type").notNull(), // swing or ipo
  stockSymbol: varchar("stock_symbol").notNull(),
  stockName: varchar("stock_name").notNull(),
  exchange: varchar("exchange").notNull(),
  price: varchar("price").notNull(),
  change: varchar("change").notNull(),
  changePercent: varchar("change_percent").notNull(),
  volume: varchar("volume"),
  marketCap: varchar("market_cap"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertScannerDataSchema = createInsertSchema(scannerData).omit({
  id: true,
  createdAt: true,
});

export type InsertScannerData = z.infer<typeof insertScannerDataSchema>;
export type ScannerData = typeof scannerData.$inferSelect;

// News items
export const newsItems = pgTable("news_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  source: varchar("source"),
  url: varchar("url"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNewsItemSchema = createInsertSchema(newsItems).omit({
  id: true,
  createdAt: true,
});

export type InsertNewsItem = z.infer<typeof insertNewsItemSchema>;
export type NewsItem = typeof newsItems.$inferSelect;
