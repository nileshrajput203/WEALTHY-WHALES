// Database storage implementation - referenced from javascript_database and javascript_log_in_with_replit blueprints
import {
  users,
  stockRecommendations,
  chatMessages,
  scannerData,
  newsItems,
  marketDataCache,
  vcpAlerts,
  type User,
  type UpsertUser,
  type StockRecommendation,
  type InsertStockRecommendation,
  type ChatMessage,
  type InsertChatMessage,
  type ScannerData,
  type InsertScannerData,
  type NewsItem,
  type InsertNewsItem,
  type MarketDataCache,
  type VcpAlert,
  type InsertVcpAlert,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

// ════════════════════════════════════════════════════════════════════════════════
// RAM-First Memory Cache Layer
// ─────────────────────────────────────────────────────────────────────────────
// Purpose: Eliminate ECONNREFUSED / Postgres timeout stalls for market data
// caching. All getMarketDataCache/setMarketDataCache calls first hit an
// in-memory Map. If Postgres is offline, caching operates entirely in RAM.
// When Postgres is available, data is written through asynchronously.
// LRU eviction at MAX_ENTRIES prevents unbounded memory growth.
// ════════════════════════════════════════════════════════════════════════════════

interface MemCacheEntry {
  data: any;
  updatedAt: Date;
  /** Tracks recency for LRU eviction */
  accessedAt: number;
}

const MAX_ENTRIES = 500;

class MemoryCacheLayer {
  private cache: Map<string, MemCacheEntry> = new Map();
  private pgHealthy: boolean = true;
  private lastPgCheck: number = 0;
  private readonly PG_RECHECK_MS = 30_000; // Re-check Postgres health every 30s

  /** Get from RAM first; only fall back to Postgres if RAM misses */
  get(key: string): MarketDataCache | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      entry.accessedAt = Date.now();
      return {
        id: 0,
        key,
        data: entry.data,
        updatedAt: entry.updatedAt,
      } as MarketDataCache;
    }
    return undefined;
  }

  /** Write to RAM immediately; write-through to Postgres in background */
  set(key: string, data: any): MarketDataCache {
    const now = new Date();

    // Evict oldest entry if at capacity
    if (this.cache.size >= MAX_ENTRIES && !this.cache.has(key)) {
      this._evictLRU();
    }

    this.cache.set(key, { data, updatedAt: now, accessedAt: Date.now() });
    return { id: 0, key, data, updatedAt: now } as MarketDataCache;
  }

  /** Check if we should attempt Postgres operations */
  shouldTryPostgres(): boolean {
    if (this.pgHealthy) return true;
    // After failure, wait PG_RECHECK_MS before retrying
    if (Date.now() - this.lastPgCheck > this.PG_RECHECK_MS) {
      return true;
    }
    return false;
  }

  markPgHealthy() {
    this.pgHealthy = true;
  }

  markPgUnhealthy() {
    this.pgHealthy = false;
    this.lastPgCheck = Date.now();
  }

  get isPostgresHealthy(): boolean {
    return this.pgHealthy;
  }

  get size(): number {
    return this.cache.size;
  }

  /** Seed RAM from a Postgres read */
  seed(key: string, data: any, updatedAt: Date) {
    if (this.cache.size >= MAX_ENTRIES && !this.cache.has(key)) {
      this._evictLRU();
    }
    this.cache.set(key, { data, updatedAt, accessedAt: Date.now() });
  }

  private _evictLRU() {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [k, v] of this.cache) {
      if (v.accessedAt < oldestTime) {
        oldestTime = v.accessedAt;
        oldestKey = k;
      }
    }
    if (oldestKey) this.cache.delete(oldestKey);
  }
}

/** Singleton RAM cache — shared across all storage operations */
export const memCache = new MemoryCacheLayer();

// Interface for storage operations
export interface IStorage {
  // User operations - MANDATORY for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Stock Recommendations
  getAllRecommendations(): Promise<StockRecommendation[]>;
  getRecommendation(id: string): Promise<StockRecommendation | undefined>;
  createRecommendation(rec: InsertStockRecommendation): Promise<StockRecommendation>;
  
  // Chat Messages
  getChatMessages(sessionId: string): Promise<ChatMessage[]>;
  createChatMessage(msg: InsertChatMessage): Promise<ChatMessage>;
  
  // Scanner Data
  getScannerData(scannerType: string): Promise<ScannerData[]>;
  createScannerData(data: InsertScannerData): Promise<ScannerData>;
  
  // News
  getAllNews(): Promise<NewsItem[]>;
  createNewsItem(news: InsertNewsItem): Promise<NewsItem>;
  
  // Delete operations
  deleteRecommendation(id: string): Promise<void>;

  // Market Data Caching
  getMarketDataCache(key: string): Promise<MarketDataCache | undefined>;
  setMarketDataCache(key: string, data: any): Promise<MarketDataCache>;

  // VCP Alerts
  getVcpAlerts(userId: string): Promise<VcpAlert[]>;
  createVcpAlert(alert: InsertVcpAlert): Promise<VcpAlert>;
  deleteVcpAlert(id: string, userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Stock Recommendations
  async getAllRecommendations(): Promise<StockRecommendation[]> {
    return await db.select().from(stockRecommendations).orderBy(desc(stockRecommendations.createdAt));
  }

  async getRecommendation(id: string): Promise<StockRecommendation | undefined> {
    const [rec] = await db.select().from(stockRecommendations).where(eq(stockRecommendations.id, id));
    return rec;
  }

  async createRecommendation(rec: InsertStockRecommendation): Promise<StockRecommendation> {
    const [created] = await db.insert(stockRecommendations).values({
      ...rec,
      recommendationType: rec.recommendationType as "BUY" | "SELL" | "HOLD"
    }).returning();
    return created;
  }

  // Chat Messages
  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt);
  }

  async createChatMessage(msg: InsertChatMessage): Promise<ChatMessage> {
    const [created] = await db.insert(chatMessages).values({
      ...msg,
      role: msg.role as "user" | "assistant"
    }).returning();
    return created;
  }

  async getScannerData(scannerType: string): Promise<ScannerData[]> {
    return await db
      .select()
      .from(scannerData)
      .where(eq(scannerData.scannerType, scannerType as "swing" | "ipo"))
      .orderBy(desc(scannerData.createdAt));
  }

  async createScannerData(data: InsertScannerData): Promise<ScannerData> {
    const [created] = await db.insert(scannerData).values({
      ...data,
      scannerType: data.scannerType as "swing" | "ipo"
    }).returning();
    return created;
  }

  // News
  async getAllNews(): Promise<NewsItem[]> {
    return await db.select().from(newsItems).orderBy(desc(newsItems.publishedAt));
  }

  async createNewsItem(news: InsertNewsItem): Promise<NewsItem> {
    const [created] = await db.insert(newsItems).values(news).returning();
    return created;
  }

  // Delete operations
  async deleteRecommendation(id: string): Promise<void> {
    console.log(`Attempting to delete recommendation with id: ${id}`);
    const result = await db.delete(stockRecommendations).where(eq(stockRecommendations.id, id));
    console.log(`Delete result:`, result);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Market Data Caching — RAM-first with Postgres write-through
  // ═══════════════════════════════════════════════════════════════════════════

  async getMarketDataCache(key: string): Promise<MarketDataCache | undefined> {
    // 1. Always check RAM first (sub-microsecond)
    const ramHit = memCache.get(key);
    if (ramHit) return ramHit;

    // 2. If Postgres is known-dead, skip the network call entirely
    if (!memCache.shouldTryPostgres()) {
      return undefined;
    }

    // 3. Try Postgres — seed RAM on success, mark unhealthy on failure
    try {
      const [cached] = await db.select().from(marketDataCache).where(eq(marketDataCache.key, key));
      if (cached) {
        memCache.seed(key, cached.data, cached.updatedAt);
        memCache.markPgHealthy();
      }
      return cached;
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("ECONNREFUSED") || msg.includes("timeout") || msg.includes("Connection terminated")) {
        memCache.markPgUnhealthy();
        console.warn(`[MemCache] Postgres offline — operating in RAM-only mode (${memCache.size} entries cached)`);
      }
      return undefined;
    }
  }

  async setMarketDataCache(key: string, data: any): Promise<MarketDataCache> {
    // 1. Always write to RAM immediately (never blocks)
    const ramResult = memCache.set(key, data);

    // 2. Write-through to Postgres in background (non-blocking)
    if (memCache.shouldTryPostgres()) {
      // Fire-and-forget: don't await, don't block the caller
      this._writeThroughPostgres(key, data).catch(() => {});
    }

    return ramResult;
  }

  /** Background write-through to Postgres — never throws to caller */
  private async _writeThroughPostgres(key: string, data: any): Promise<void> {
    try {
      await db
        .insert(marketDataCache)
        .values({
          key,
          data,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: marketDataCache.key,
          set: {
            data,
            updatedAt: new Date(),
          },
        });
      memCache.markPgHealthy();
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("ECONNREFUSED") || msg.includes("timeout") || msg.includes("Connection terminated")) {
        memCache.markPgUnhealthy();
        console.warn(`[MemCache] Postgres write-through failed — data safe in RAM (${memCache.size} entries)`);
      }
    }
  }

  // VCP Alerts
  async getVcpAlerts(userId: string): Promise<VcpAlert[]> {
    return await db.select().from(vcpAlerts).where(eq(vcpAlerts.userId, userId)).orderBy(desc(vcpAlerts.createdAt));
  }

  async createVcpAlert(alert: InsertVcpAlert): Promise<VcpAlert> {
    const [created] = await db.insert(vcpAlerts).values(alert).returning();
    return created;
  }

  async deleteVcpAlert(id: string, userId: string): Promise<void> {
    await db.delete(vcpAlerts).where(and(eq(vcpAlerts.id, id), eq(vcpAlerts.userId, userId)));
  }
}

export const storage = new DatabaseStorage();
