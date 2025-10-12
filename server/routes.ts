import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { getFinancialAdvice } from "./gemini";
import { insertStockRecommendationSchema, insertChatMessageSchema, insertScannerDataSchema, insertNewsItemSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Stock Recommendations
  app.get('/api/recommendations', async (req, res) => {
    try {
      const recommendations = await storage.getAllRecommendations();
      res.json(recommendations);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  app.post('/api/recommendations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const validated = insertStockRecommendationSchema.parse({
        ...req.body,
        createdBy: userId,
      });
      const recommendation = await storage.createRecommendation(validated);
      res.json(recommendation);
    } catch (error) {
      console.error("Error creating recommendation:", error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  // Chat with AI
  app.get('/api/chat/:sessionId', async (req, res) => {
    try {
      const messages = await storage.getChatMessages(req.params.sessionId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/chat', async (req: any, res) => {
    try {
      const validated = insertChatMessageSchema.parse({
        ...req.body,
        userId: req.user?.claims?.sub || null,
      });

      // Save user message
      await storage.createChatMessage(validated);

      // Get AI response
      const aiResponse = await getFinancialAdvice(
        validated.message,
        validated.stockContext || undefined
      );

      // Save AI response
      const aiMessage = await storage.createChatMessage({
        userId: validated.userId,
        sessionId: validated.sessionId,
        message: aiResponse,
        role: "assistant",
        stockContext: validated.stockContext,
      });

      res.json(aiMessage);
    } catch (error) {
      console.error("Error processing chat:", error);
      res.status(500).json({ message: "Failed to process message" });
    }
  });

  // Scanner Data
  app.get('/api/scanner/:type', async (req, res) => {
    try {
      const data = await storage.getScannerData(req.params.type);
      res.json(data);
    } catch (error) {
      console.error("Error fetching scanner data:", error);
      res.status(500).json({ message: "Failed to fetch scanner data" });
    }
  });

  app.post('/api/scanner', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const validated = insertScannerDataSchema.parse(req.body);
      const data = await storage.createScannerData(validated);
      res.json(data);
    } catch (error) {
      console.error("Error creating scanner data:", error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  // Live Indices Data
  app.get('/api/indices', async (req, res) => {
    try {
      // Mock live data - in production, this would fetch from a real API
      const indices = [
        { name: "NIFTY 50", symbol: "NIFTY", value: 24850.50 + (Math.random() * 100 - 50), change: 125.30 + (Math.random() * 20 - 10), changePercent: 0.51 + (Math.random() * 0.2 - 0.1) },
        { name: "SENSEX", symbol: "SENSEX", value: 82456.75 + (Math.random() * 100 - 50), change: -89.45 + (Math.random() * 20 - 10), changePercent: -0.11 + (Math.random() * 0.2 - 0.1) },
        { name: "BANK NIFTY", symbol: "BANKNIFTY", value: 52340.20 + (Math.random() * 100 - 50), change: 234.80 + (Math.random() * 20 - 10), changePercent: 0.45 + (Math.random() * 0.2 - 0.1) },
        { name: "NIFTY IT", symbol: "NIFTYIT", value: 41234.60 + (Math.random() * 100 - 50), change: -156.20 + (Math.random() * 20 - 10), changePercent: -0.38 + (Math.random() * 0.2 - 0.1) },
        { name: "NIFTY PHARMA", symbol: "NIFTYPHARMA", value: 18976.45 + (Math.random() * 100 - 50), change: 98.30 + (Math.random() * 20 - 10), changePercent: 0.52 + (Math.random() * 0.2 - 0.1) },
      ];
      res.json(indices);
    } catch (error) {
      console.error("Error fetching indices:", error);
      res.status(500).json({ message: "Failed to fetch indices" });
    }
  });

  // News
  app.get('/api/news', async (req, res) => {
    try {
      const news = await storage.getAllNews();
      res.json(news);
    } catch (error) {
      console.error("Error fetching news:", error);
      res.status(500).json({ message: "Failed to fetch news" });
    }
  });

  app.post('/api/news', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const validated = insertNewsItemSchema.parse(req.body);
      const news = await storage.createNewsItem(validated);
      res.json(news);
    } catch (error) {
      console.error("Error creating news:", error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
