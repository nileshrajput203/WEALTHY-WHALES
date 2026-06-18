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
  numeric,
  serial,
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
  telegramChatId: varchar("telegram_chat_id", { length: 255 }),
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
  imageUrl: varchar("image_url"),
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

// Screener Cache
export const screenerCache = pgTable("screener_cache", {
  id: serial("id").primaryKey(),
  symbol: varchar("symbol", { length: 20 }).notNull().unique(),
  data: jsonb("data").notNull(),
  scrapedAt: timestamp("scraped_at").defaultNow(),
});

export type ScreenerCache = typeof screenerCache.$inferSelect;

// General Market Data Cache
export const marketDataCache = pgTable("market_data_cache", {
  key: varchar("key").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type MarketDataCache = typeof marketDataCache.$inferSelect;


// Signal Outcome Log (Phase 3A)
export const signalLog = pgTable("signal_log", {
  id: serial("id").primaryKey(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  signalType: varchar("signal_type", { length: 50 }).notNull(),
  direction: varchar("direction", { length: 5 }).notNull(), // 'BUY' | 'SELL'
  confidence: integer("confidence"),
  priceAtSignal: numeric("price_at_signal", { precision: 10, scale: 2 }).notNull(),
  rsi: numeric("rsi", { precision: 5, scale: 2 }),
  macdHistogram: numeric("macd_histogram", { precision: 8, scale: 4 }),
  adx: numeric("adx", { precision: 5, scale: 2 }),
  rvol: numeric("rvol", { precision: 5, scale: 2 }),
  emaAlignment: integer("ema_alignment"),
  sector: varchar("sector", { length: 50 }),
  marketCap: varchar("market_cap", { length: 10 }), // 'LARGE' | 'MID' | 'SMALL'
  marketCondition: varchar("market_condition", { length: 10 }), // 'TRENDING' | 'RANGING'
  price5d: numeric("price_5d", { precision: 10, scale: 2 }),
  price10d: numeric("price_10d", { precision: 10, scale: 2 }),
  price20d: numeric("price_20d", { precision: 10, scale: 2 }),
  return5d: numeric("return_5d", { precision: 6, scale: 2 }),
  return10d: numeric("return_10d", { precision: 6, scale: 2 }),
  return20d: numeric("return_20d", { precision: 6, scale: 2 }),
  outcome: varchar("outcome", { length: 10 }), // 'WIN' | 'LOSS' | 'NEUTRAL'
  outcomeCheckedAt: timestamp("outcome_checked_at"),
  firedAt: timestamp("fired_at").defaultNow(),
});

export type SignalLog = typeof signalLog.$inferSelect;
export type InsertSignalLog = typeof signalLog.$inferInsert;

// ══════════════════════════════════════════════════════════════
// HERMES AI — Self-Learning Stock Intelligence Tables
// ══════════════════════════════════════════════════════════════

// Daily snapshot of every scanned stock with all indicators
export const hermesSnapshots = pgTable("hermes_snapshots", {
  id: serial("id").primaryKey(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  scanDate: timestamp("scan_date").notNull().defaultNow(),

  // Price & volume
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  volume: numeric("volume", { precision: 15, scale: 0 }),
  volumeAvg20d: numeric("volume_avg_20d", { precision: 15, scale: 0 }),
  rvol: numeric("rvol", { precision: 5, scale: 2 }),

  // Technical indicators
  rsi14: numeric("rsi_14", { precision: 5, scale: 2 }),
  sma20: numeric("sma_20", { precision: 10, scale: 2 }),
  sma50: numeric("sma_50", { precision: 10, scale: 2 }),
  ema12: numeric("ema_12", { precision: 10, scale: 2 }),
  ema26: numeric("ema_26", { precision: 10, scale: 2 }),
  macdHistogram: numeric("macd_histogram", { precision: 8, scale: 4 }),
  adx: numeric("adx", { precision: 5, scale: 2 }),
  atr14: numeric("atr_14", { precision: 10, scale: 2 }),

  // Fundamentals
  pe: numeric("pe", { precision: 8, scale: 2 }),
  roe: numeric("roe", { precision: 6, scale: 2 }),
  debtToEquity: numeric("debt_to_equity", { precision: 6, scale: 2 }),
  opm: numeric("opm", { precision: 6, scale: 2 }),
  roce: numeric("roce", { precision: 6, scale: 2 }),
  peg: numeric("peg", { precision: 6, scale: 2 }),
  marketCapValue: numeric("market_cap_value", { precision: 15, scale: 0 }),
  dividendYield: numeric("dividend_yield", { precision: 5, scale: 2 }),

  // Momentum
  return1w: numeric("return_1w", { precision: 6, scale: 2 }),
  return1m: numeric("return_1m", { precision: 6, scale: 2 }),
  return3m: numeric("return_3m", { precision: 6, scale: 2 }),
  return6m: numeric("return_6m", { precision: 6, scale: 2 }),
  proximity52wHigh: numeric("proximity_52w_high", { precision: 5, scale: 2 }),

  // StockIQ sub-scores (from existing engine)
  iqTotal: integer("iq_total"),
  iqFundamentals: integer("iq_fundamentals"),
  iqTechnicals: integer("iq_technicals"),
  iqMomentum: integer("iq_momentum"),
  iqInsider: integer("iq_insider"),

  // Pattern detection
  patternDetected: varchar("pattern_detected", { length: 50 }),
  patternStage: varchar("pattern_stage", { length: 30 }),

  // Classification
  sector: varchar("sector", { length: 50 }),
  marketCapBucket: varchar("market_cap_bucket", { length: 10 }), // LARGE | MID | SMALL

  // HERMES adaptive score (computed from learned weights)
  hermesScore: numeric("hermes_score", { precision: 5, scale: 2 }),
  hermesVerdict: varchar("hermes_verdict", { length: 10 }), // BUY | HOLD | AVOID

  // Metadata
  weightVersion: integer("weight_version"), // which weight set was used
}, (table) => [
  index("idx_hermes_snapshots_symbol").on(table.symbol),
  index("idx_hermes_snapshots_scan_date").on(table.scanDate),
  index("idx_hermes_snapshots_score").on(table.hermesScore),
]);

export type HermesSnapshot = typeof hermesSnapshots.$inferSelect;
export type InsertHermesSnapshot = typeof hermesSnapshots.$inferInsert;

// Forward return tracking — links back to a snapshot
export const hermesOutcomes = pgTable("hermes_outcomes", {
  id: serial("id").primaryKey(),
  snapshotId: integer("snapshot_id").notNull().references(() => hermesSnapshots.id),
  symbol: varchar("symbol", { length: 20 }).notNull(),

  // Forward prices
  price5d: numeric("price_5d", { precision: 10, scale: 2 }),
  price10d: numeric("price_10d", { precision: 10, scale: 2 }),
  price20d: numeric("price_20d", { precision: 10, scale: 2 }),

  // Forward returns (%)
  return5d: numeric("return_5d", { precision: 6, scale: 2 }),
  return10d: numeric("return_10d", { precision: 6, scale: 2 }),
  return20d: numeric("return_20d", { precision: 6, scale: 2 }),

  // Outcome classification
  outcome5d: varchar("outcome_5d", { length: 10 }), // WIN | LOSS | NEUTRAL
  outcome10d: varchar("outcome_10d", { length: 10 }),
  outcome20d: varchar("outcome_20d", { length: 10 }),

  // Fill timestamps
  filled5dAt: timestamp("filled_5d_at"),
  filled10dAt: timestamp("filled_10d_at"),
  filled20dAt: timestamp("filled_20d_at"),
}, (table) => [
  index("idx_hermes_outcomes_snapshot").on(table.snapshotId),
  index("idx_hermes_outcomes_symbol").on(table.symbol),
]);

export type HermesOutcome = typeof hermesOutcomes.$inferSelect;
export type InsertHermesOutcome = typeof hermesOutcomes.$inferInsert;

// Versioned scoring weights — the "brain" of HERMES
export const hermesWeights = pgTable("hermes_weights", {
  id: serial("id").primaryKey(),
  version: integer("version").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),

  // Full weight vector as JSON
  weights: jsonb("weights").notNull(), // { rsi14: 0.12, sma20_cross: 0.08, roe: 0.15, ... }

  // Performance metrics of this weight set
  accuracy: numeric("accuracy", { precision: 5, scale: 2 }), // overall hit rate %
  sampleSize: integer("sample_size"), // how many outcomes were used
  winRate5d: numeric("win_rate_5d", { precision: 5, scale: 2 }),
  winRate10d: numeric("win_rate_10d", { precision: 5, scale: 2 }),
  winRate20d: numeric("win_rate_20d", { precision: 5, scale: 2 }),

  notes: text("notes"), // human-readable change log
  isActive: boolean("is_active").notNull().default(false),
});

export type HermesWeight = typeof hermesWeights.$inferSelect;
export type InsertHermesWeight = typeof hermesWeights.$inferInsert;

// Market regime classification log
export const hermesRegimeLog = pgTable("hermes_regime_log", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull().defaultNow(),

  // Regime classification
  regime: varchar("regime", { length: 20 }).notNull(), // TRENDING_UP | TRENDING_DOWN | RANGING | VOLATILE

  // Market context
  niftyPrice: numeric("nifty_price", { precision: 10, scale: 2 }),
  niftyChange1w: numeric("nifty_change_1w", { precision: 6, scale: 2 }),
  niftyChange1m: numeric("nifty_change_1m", { precision: 6, scale: 2 }),
  advanceDeclineRatio: numeric("advance_decline_ratio", { precision: 5, scale: 2 }),
  marketBreadth: varchar("market_breadth", { length: 10 }), // STRONG | WEAK | NEUTRAL

  // Optional Gemini reasoning
  geminiAnalysis: text("gemini_analysis"),
});

export type HermesRegimeLog = typeof hermesRegimeLog.$inferSelect;
export type InsertHermesRegimeLog = typeof hermesRegimeLog.$inferInsert;


// ══════════════════════════════════════════════════════════
// FUGU SCORE — Self-Learning Stock Intelligence Tables
// ══════════════════════════════════════════════════════════

// Daily stock snapshots collected from active scanners
export const fuguSnapshots = pgTable("fugu_snapshots", {
  id: serial("id").primaryKey(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  scannerSource: varchar("scanner_source", { length: 50 }).notNull(), // SWING | IPO | PATTERN | SMART_SCREENER
  scanDate: timestamp("scan_date").notNull().defaultNow(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  technicalScore: integer("technical_score").notNull().default(0),
  patternScore: integer("pattern_score").notNull().default(0),
  patternConfidence: integer("pattern_confidence").notNull().default(0),
  candlestickScore: integer("candlestick_score").notNull().default(0),
  fundamentalScore: integer("fundamental_score").notNull().default(0),
  sectorScore: integer("sector_score").notNull().default(0),
  macroScore: integer("macro_score").notNull().default(0),
  fuguScore: numeric("fugu_score", { precision: 5, scale: 2 }).notNull().default("0"),
  similarityToWinners: numeric("similarity_to_winners", { precision: 5, scale: 2 }).notNull().default("50"),
  similarityToLosers: numeric("similarity_to_losers", { precision: 5, scale: 2 }).notNull().default("50"),
  features: jsonb("features").notNull().default({}), // raw metrics like rsi, pe, etc.
  weightVersion: integer("weight_version").notNull().default(1),
  eliteReasoning: text("elite_reasoning"),
}, (table) => [
  index("idx_fugu_snapshots_symbol").on(table.symbol),
  index("idx_fugu_snapshots_scan_date").on(table.scanDate),
  index("idx_fugu_snapshots_fugu_score").on(table.fuguScore),
]);

export type FuguSnapshot = typeof fuguSnapshots.$inferSelect;
export type InsertFuguSnapshot = typeof fuguSnapshots.$inferInsert;

// Forward outcome tracker for FUGU recommendations (5, 10, 20, 30, 60, 90 days)
export const fuguOutcomes = pgTable("fugu_outcomes", {
  id: serial("id").primaryKey(),
  snapshotId: integer("snapshot_id").notNull().references(() => fuguSnapshots.id, { onDelete: 'cascade' }),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  
  price5d: numeric("price_5d", { precision: 10, scale: 2 }),
  price10d: numeric("price_10d", { precision: 10, scale: 2 }),
  price20d: numeric("price_20d", { precision: 10, scale: 2 }),
  price30d: numeric("price_30d", { precision: 10, scale: 2 }),
  price60d: numeric("price_60d", { precision: 10, scale: 2 }),
  price90d: numeric("price_90d", { precision: 10, scale: 2 }),

  return5d: numeric("return_5d", { precision: 6, scale: 2 }),
  return10d: numeric("return_10d", { precision: 6, scale: 2 }),
  return20d: numeric("return_20d", { precision: 6, scale: 2 }),
  return30d: numeric("return_30d", { precision: 6, scale: 2 }),
  return60d: numeric("return_60d", { precision: 6, scale: 2 }),
  return90d: numeric("return_90d", { precision: 6, scale: 2 }),

  maxDrawdown: numeric("max_drawdown", { precision: 5, scale: 2 }),
  volatility: numeric("volatility", { precision: 5, scale: 2 }),
  benchmarkPerformance: numeric("benchmark_performance", { precision: 6, scale: 2 }), // relative nifty performance

  outcome5d: varchar("outcome_5d", { length: 10 }), // WIN | LOSS | NEUTRAL
  outcome10d: varchar("outcome_10d", { length: 10 }),
  outcome20d: varchar("outcome_20d", { length: 10 }),
  outcome30d: varchar("outcome_30d", { length: 10 }),
  outcome60d: varchar("outcome_60d", { length: 10 }),
  outcome90d: varchar("outcome_90d", { length: 10 }),

  filledAt5d: timestamp("filled_at_5d"),
  filledAt10d: timestamp("filled_at_10d"),
  filledAt20d: timestamp("filled_at_20d"),
  filledAt30d: timestamp("filled_at_30d"),
  filledAt60d: timestamp("filled_at_60d"),
  filledAt90d: timestamp("filled_at_90d"),
}, (table) => [
  index("idx_fugu_outcomes_snapshot").on(table.snapshotId),
  index("idx_fugu_outcomes_symbol").on(table.symbol),
]);

export type FuguOutcome = typeof fuguOutcomes.$inferSelect;
export type InsertFuguOutcome = typeof fuguOutcomes.$inferInsert;

// Dynamic factor weights configurations (versioned)
export const fuguFactorWeights = pgTable("fugu_factor_weights", {
  id: serial("id").primaryKey(),
  version: integer("version").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  weights: jsonb("weights").notNull(), // { technical: 0.20, pattern: 0.15, ... }
  accuracy: numeric("accuracy", { precision: 5, scale: 2 }),
  sampleSize: integer("sample_size"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(false),
});

export type FuguFactorWeight = typeof fuguFactorWeights.$inferSelect;
export type InsertFuguFactorWeight = typeof fuguFactorWeights.$inferInsert;

// Success statistics of chart patterns
export const fuguPatternStats = pgTable("fugu_pattern_stats", {
  id: serial("id").primaryKey(),
  patternName: varchar("pattern_name", { length: 50 }).notNull().unique(),
  totalOccurrences: integer("total_occurrences").notNull().default(0),
  winRate5d: numeric("win_rate_5d", { precision: 5, scale: 2 }).notNull().default("0"),
  winRate20d: numeric("win_rate_20d", { precision: 5, scale: 2 }).notNull().default("0"),
  winRate60d: numeric("win_rate_60d", { precision: 5, scale: 2 }).notNull().default("0"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export type FuguPatternStat = typeof fuguPatternStats.$inferSelect;
export type InsertFuguPatternStat = typeof fuguPatternStats.$inferInsert;

// Success statistics of candlestick patterns
export const fuguCandlestickStats = pgTable("fugu_candlestick_stats", {
  id: serial("id").primaryKey(),
  candlestickName: varchar("candlestick_name", { length: 50 }).notNull().unique(),
  totalOccurrences: integer("total_occurrences").notNull().default(0),
  winRate5d: numeric("win_rate_5d", { precision: 5, scale: 2 }).notNull().default("0"),
  winRate20d: numeric("win_rate_20d", { precision: 5, scale: 2 }).notNull().default("0"),
  winRate60d: numeric("win_rate_60d", { precision: 5, scale: 2 }).notNull().default("0"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export type FuguCandlestickStat = typeof fuguCandlestickStats.$inferSelect;
export type InsertFuguCandlestickStat = typeof fuguCandlestickStats.$inferInsert;

// Success statistics of sectors
export const fuguSectorStats = pgTable("fugu_sector_stats", {
  id: serial("id").primaryKey(),
  sectorName: varchar("sector_name", { length: 50 }).notNull().unique(),
  totalOccurrences: integer("total_occurrences").notNull().default(0),
  winRate5d: numeric("win_rate_5d", { precision: 5, scale: 2 }).notNull().default("0"),
  winRate20d: numeric("win_rate_20d", { precision: 5, scale: 2 }).notNull().default("0"),
  winRate60d: numeric("win_rate_60d", { precision: 5, scale: 2 }).notNull().default("0"),
  momentumScore: numeric("momentum_score", { precision: 5, scale: 2 }).notNull().default("50"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export type FuguSectorStat = typeof fuguSectorStats.$inferSelect;
export type InsertFuguSectorStat = typeof fuguSectorStats.$inferInsert;

// Success statistics of market regimes
export const fuguRegimeStats = pgTable("fugu_regime_stats", {
  id: serial("id").primaryKey(),
  regimeType: varchar("regime_type", { length: 30 }).notNull().unique(), // TRENDING_UP | TRENDING_DOWN | RANGING | VOLATILE
  winRate5d: numeric("win_rate_5d", { precision: 5, scale: 2 }).notNull().default("0"),
  winRate20d: numeric("win_rate_20d", { precision: 5, scale: 2 }).notNull().default("0"),
  winRate60d: numeric("win_rate_60d", { precision: 5, scale: 2 }).notNull().default("0"),
  averageReturn5d: numeric("average_return_5d", { precision: 6, scale: 2 }).notNull().default("0"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export type FuguRegimeStat = typeof fuguRegimeStats.$inferSelect;
export type InsertFuguRegimeStat = typeof fuguRegimeStats.$inferInsert;

// Fugu Learning Memory - insights logs from successes/failures
export const fuguLearningMemory = pgTable("fugu_learning_memory", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  insightType: varchar("insight_type", { length: 50 }).notNull(), // WINNER_PATTERN | LOSER_PATTERN | REGIME_CORRELATION | GENERAL
  findings: text("findings").notNull(),
  rawData: jsonb("raw_data"),
  geminiReasoning: text("gemini_reasoning"),
});

export type FuguLearningMemory = typeof fuguLearningMemory.$inferSelect;
export type InsertFuguLearningMemory = typeof fuguLearningMemory.$inferInsert;

// Fugu Elite Picks - Top ranked stocks
export const fuguElitePicks = pgTable("fugu_elite_picks", {
  id: serial("id").primaryKey(),
  snapshotId: integer("snapshot_id").notNull().references(() => fuguSnapshots.id, { onDelete: 'cascade' }),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  pickDate: timestamp("pick_date").notNull().defaultNow(),
  fuguScore: numeric("fugu_score", { precision: 5, scale: 2 }).notNull(),
  reasoning: text("reasoning").notNull(),
  verdict: varchar("verdict", { length: 15 }).notNull(), // TOP_5 | TOP_10 | TOP_20
  isActive: boolean("is_active").notNull().default(true),
}, (table) => [
  index("idx_fugu_elite_picks_symbol").on(table.symbol),
  index("idx_fugu_elite_picks_date").on(table.pickDate),
]);

export type FuguElitePick = typeof fuguElitePicks.$inferSelect;
export type InsertFuguElitePick = typeof fuguElitePicks.$inferInsert;


// ══════════════════════════════════════════════════════════
// APEX — Revolutionary Intraday Intelligence System Tables
// ══════════════════════════════════════════════════════════

// Persistent job scheduler (replaces fragile setInterval timers)
export const jobLedger = pgTable("job_ledger", {
  id: serial("id").primaryKey(),
  jobName: text("job_name").notNull().unique(),
  lastRanAt: timestamp("last_ran_at"),
  nextRunAt: timestamp("next_run_at"),
  status: text("status").notNull().default("idle"), // 'idle' | 'running' | 'failed' | 'completed'
  runCount: integer("run_count").notNull().default(0),
  lastError: text("last_error"),
  lastDurationMs: integer("last_duration_ms"),
});

export type JobLedger = typeof jobLedger.$inferSelect;
export type InsertJobLedger = typeof jobLedger.$inferInsert;

// Daily intraday predictions with same-day outcome tracking
export const apexPredictions = pgTable("apex_predictions", {
  id: serial("id").primaryKey(),
  predictionDate: timestamp("prediction_date").notNull(),
  symbol: text("symbol").notNull(),
  direction: text("direction").notNull(), // 'UP' | 'DOWN'
  confidenceScore: numeric("confidence_score", { precision: 5, scale: 2 }),
  momentumScore: numeric("momentum_score", { precision: 5, scale: 2 }),
  gapScore: numeric("gap_score", { precision: 5, scale: 2 }),
  newsScore: numeric("news_score", { precision: 5, scale: 2 }),
  foScore: numeric("fo_score", { precision: 5, scale: 2 }),
  sectorScore: numeric("sector_score", { precision: 5, scale: 2 }),
  reasoning: text("reasoning"),
  // Filled at EOD
  openPrice: numeric("open_price", { precision: 10, scale: 2 }),
  closePrice: numeric("close_price", { precision: 10, scale: 2 }),
  actualReturnPct: numeric("actual_return_pct", { precision: 8, scale: 4 }),
  actualDirection: text("actual_direction"), // 'UP' | 'DOWN'
  isCorrect: boolean("is_correct"),
  filledAt: timestamp("filled_at"),
  weightVersion: integer("weight_version"),
  features: jsonb("features").default({}), // raw feature values for learning
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_apex_predictions_date").on(table.predictionDate),
  index("idx_apex_predictions_symbol").on(table.symbol),
]);

export type ApexPrediction = typeof apexPredictions.$inferSelect;
export type InsertApexPrediction = typeof apexPredictions.$inferInsert;

// RSS news items mapped to stocks/sectors with sentiment scores
export const apexNewsSignals = pgTable("apex_news_signals", {
  id: serial("id").primaryKey(),
  signalDate: timestamp("signal_date").notNull(),
  symbol: text("symbol"), // NULL if sector-level news
  sector: text("sector"),
  headline: text("headline").notNull(),
  source: text("source"),
  url: text("url"),
  sentimentScore: numeric("sentiment_score", { precision: 5, scale: 2 }), // -100 to +100
  catalystType: text("catalyst_type"), // 'RESULT_BEAT' | 'ORDER_WIN' | 'EXPANSION' | etc.
  entityType: text("entity_type"), // 'STOCK' | 'SECTOR' | 'MACRO'
  processedAt: timestamp("processed_at").notNull().defaultNow(),
}, (table) => [
  index("idx_apex_news_date").on(table.signalDate),
  index("idx_apex_news_symbol").on(table.symbol),
]);

export type ApexNewsSignal = typeof apexNewsSignals.$inferSelect;
export type InsertApexNewsSignal = typeof apexNewsSignals.$inferInsert;

// F&O option chain signals (PCR, OI direction, max pain)
export const apexFoSignals = pgTable("apex_fo_signals", {
  id: serial("id").primaryKey(),
  signalDate: timestamp("signal_date").notNull(),
  symbol: text("symbol").notNull(),
  isFoStock: boolean("is_fo_stock").notNull().default(false),
  pcr: numeric("pcr", { precision: 8, scale: 4 }),
  callOi: numeric("call_oi", { precision: 15, scale: 0 }),
  putOi: numeric("put_oi", { precision: 15, scale: 0 }),
  oiChangePct: numeric("oi_change_pct", { precision: 8, scale: 4 }),
  oiDirection: text("oi_direction"), // 'LONG_BUILDUP' | 'SHORT_BUILDUP' | 'LONG_UNWINDING' | 'SHORT_COVERING'
  maxPain: numeric("max_pain", { precision: 10, scale: 2 }),
  ivRank: numeric("iv_rank", { precision: 5, scale: 2 }),
  signal: text("signal"), // 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  signalStrength: numeric("signal_strength", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_apex_fo_date").on(table.signalDate),
  index("idx_apex_fo_symbol").on(table.symbol),
]);

export type ApexFoSignal = typeof apexFoSignals.$inferSelect;
export type InsertApexFoSignal = typeof apexFoSignals.$inferInsert;

// Versioned 30-feature weight vectors — the "brain" of APEX
export const apexWeights = pgTable("apex_weights", {
  id: serial("id").primaryKey(),
  version: integer("version").notNull().unique(),
  weights: jsonb("weights").notNull(), // {feature_name: weight, ...} summing to 1.0
  accuracyRate: numeric("accuracy_rate", { precision: 5, scale: 4 }), // e.g., 0.68 = 68%
  sampleSize: integer("sample_size"),
  learningNotes: text("learning_notes"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ApexWeight = typeof apexWeights.$inferSelect;
export type InsertApexWeight = typeof apexWeights.$inferInsert;

// Structured error logging — every failure is logged, never silently swallowed
export const jobErrorLog = pgTable("job_error_log", {
  id: serial("id").primaryKey(),
  jobName: text("job_name").notNull(),
  errorMessage: text("error_message").notNull(),
  symbol: text("symbol"),
  stackTrace: text("stack_trace"),
  retried: boolean("retried").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_job_error_log_job").on(table.jobName),
]);

export type JobErrorLog = typeof jobErrorLog.$inferSelect;
export type InsertJobErrorLog = typeof jobErrorLog.$inferInsert;

