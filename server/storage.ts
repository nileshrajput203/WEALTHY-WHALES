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

  // Market Data Caching
  async getMarketDataCache(key: string): Promise<MarketDataCache | undefined> {
    const [cached] = await db.select().from(marketDataCache).where(eq(marketDataCache.key, key));
    return cached;
  }

  async setMarketDataCache(key: string, data: any): Promise<MarketDataCache> {
    const [updated] = await db
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
      })
      .returning();
    return updated;
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
