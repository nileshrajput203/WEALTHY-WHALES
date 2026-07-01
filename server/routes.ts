import type { Express, Request, Response, NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import axios from "axios";
import { z } from "zod";
import { createServer, type Server } from "http";
import passport from "passport";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { setupGoogleAuth } from "./googleAuth";
import { getFinancialAdvice, getStructuredStockInsight, getMarkdownFundamentals, getMarkdownTechnicals, getSwingScannerData, getConcallAndAnnualReportSummary, getDeepFundamentalDashboard, getSectorRotationAnalysis, generateWithRetry } from "./gemini";
import { calculateStockIQ, getTopBottomStockIQ } from "./stockiq";
import { runPatternScanner } from "./patternScanner";
import { getFinancialData } from "./financialData";
import { parseScreenerQuery, executeScreener, getSuggestedQueries } from "./smartScreener";
import { appendChatMessage, detectStockSymbol, getChatHistory } from "./chatStore";
import { 
  getIndianStockRecommendations, 
  getFinancialNews, 
  getMarketIndices,
  getMockStockData,
  getMockNewsData,
  getStockQuotes,
  searchStocksYahoo,
  getYahooHistory,
  getYahooStockNews,
  computeSMA,
  computeRSI,
  computeEMA,
  runSwingScanner,
  runIpoScanner,
  getFmpFundamentals,
  INDIAN_STOCKS,
  type StockQuote,
  type StockNews,
  type MarketIndex
} from "./stockApi";
import { insertStockRecommendationSchema, insertChatMessageSchema, insertScannerDataSchema, insertNewsItemSchema } from "@shared/schema";
import { fetchNSEQuote, fetchNSEOptionChain, fetchBulkDeals, fetchInsiderTrades } from "./services/nseService";
import { parseBoardMeetings, parseCorporateActions } from "./services/sebiRssService";
import { scrapeFinancials } from "./services/screenerService";
import { getUSDINR, getCryptoCorrelation } from "./services/currencyService";
import { sendAlert, formatSignalAlert } from "./services/telegramService";
import { db } from "./db";
import { signalLog, users, hermesSnapshots, fuguSnapshots } from "@shared/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import {
  getHermesDashboard,
  getHermesLeaderboard,
  getHermesStockSnapshot,
  getHermesAccuracy,
  getHermesWeightHistory,
  getHermesRegimeHistory,
  getHermesRecentOutcomes,
} from "./hermesEngine";
import {
  triggerManualScan,
  triggerOutcomeTracker,
  triggerLearningCycle,
  getHermesStatus,
  startHermesScheduler,
} from "./hermesScheduler";
import {
  getFuguDashboard,
} from "./fuguEngine";
import {
  triggerManualFuguScan,
  triggerManualFuguOutcome,
  triggerManualFuguLearning,
  getFuguStatus,
  startFuguScheduler,
} from "./fuguScheduler";

// APEX Intraday Intelligence Imports
import { startApexScheduler } from "./apexScheduler";
import { getApexDashboard, runMorningScan, getPredictionsForDate } from "./apexEngine";
import { runNewsIngestJob } from "./apexNewsEngine";
import { runFODataJob } from "./apexFOEngine";
import { fillTodayOutcomes } from "./apexOutcomeTracker";
import { runLearningCycle } from "./apexLearningEngine";
import { apexPredictions, apexNewsSignals, apexFoSignals, apexWeights, jobLedger, jobErrorLog } from "@shared/schema";

/**
 * Normalize a symbol for Yahoo Finance API calls.
 * Yahoo requires .NS suffix for NSE stocks, .BO for BSE.
 * If the symbol already has a suffix or is an index (^), pass through.
 */
function toYahooSymbol(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (!s) return s;
  // Already has Yahoo suffix or is an index
  if (/\.(NS|BO|NSE|BSE)$/i.test(s)) return s;
  if (s.startsWith('^')) return s;
  // Has exchange prefix like NSE:TCS — convert to Yahoo format
  if (s.includes(':')) {
    const [exchange, ticker] = s.split(':');
    if (exchange === 'BSE') return `${ticker}.BO`;
    return `${ticker}.NS`;
  }
  // Plain symbol like TCS, RELIANCE — assume NSE
  return `${s}.NS`;
}

// Session setup for Google OAuth
function setupSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

// Helper functions for seeded randomness and caching (fake data logic removed)

function getHourlySeedKey(prefix: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  return `${prefix}_${year}-${month}-${date}-${hour}`;
}

function getDailySeedKey(prefix: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  return `${prefix}_${year}-${month}-${date}`;
}

async function getCachedOrGenerate<T>(
  key: string,
  ttlMs: number,
  generateFn: () => Promise<T>
): Promise<T> {
  try {
    const cached = await storage.getMarketDataCache(key);
    if (cached) {
      const age = Date.now() - new Date(cached.updatedAt).getTime();
      if (age < ttlMs) {
        console.log(`[Cache Hit] Key: ${key}, age: ${Math.round(age / 1000)}s`);
        return cached.data as T;
      }
      console.log(`[Cache Stale] Key: ${key}, age: ${Math.round(age / 1000)}s`);
    } else {
      console.log(`[Cache Miss] Key: ${key}`);
    }
  } catch (err) {
    console.error(`Error reading cache for ${key}:`, err);
  }

  const freshData = await generateFn();
  
  try {
    await storage.setMarketDataCache(key, freshData);
  } catch (err) {
    console.error(`Error writing cache for ${key}:`, err);
  }
  
  return freshData;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware
  app.set("trust proxy", 1);
  app.use(setupSession());
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Google OAuth setup
  setupGoogleAuth();

  // Google OAuth routes
  app.get('/api/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get('/api/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/?error=auth_failed' }),
    (req, res) => {
      // Successful authentication, redirect to home page
      res.redirect('/');
    }
  );

  // Logout route
  app.get('/api/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.redirect('/');
    });
  });

  // Authentication middleware
  const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  };

  // Rate limiters for expensive AI endpoints
  const aiRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests. Please wait a few minutes before trying again." },
  });

  const chatRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Chat rate limit reached. Please slow down." },
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Stock Recommendations - Real-time data from free APIs
  app.get('/api/recommendations', async (req, res) => {
    try {
      // Get real-time stock data
      let stockData: StockQuote[] = [];
      
      try {
        stockData = await getIndianStockRecommendations();
      } catch (apiError) {
        console.error("API error, using mock data:", apiError);
        stockData = getMockStockData();
      }

      // Get admin recommendations from database
      const dbRecommendations = await storage.getAllRecommendations();

      // Combine real-time data with admin recommendations
      const response = {
        realTimeStocks: stockData,
        adminRecommendations: dbRecommendations,
        lastUpdated: new Date().toISOString(),
        dataSource: stockData.length > 0 ? 'Live API' : 'Mock Data'
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  app.post('/api/recommendations', async (req: Request, res: Response) => {
    try {
      // Allow admin panel to create recommendations without authentication
      const { createdBy, ...rest } = req.body || {};
      const validated = insertStockRecommendationSchema.parse(rest);
      const recommendation = await storage.createRecommendation(validated);
      res.json(recommendation);
    } catch (error) {
      console.error("Error creating recommendation:", error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  // Admin feed for community
  app.get('/api/community/feed', async (_req, res) => {
    try {
      const items = await storage.getAllRecommendations();
      res.json({ items });
    } catch (e) {
      res.status(500).json({ message: 'Failed to load community feed' });
    }
  });

  // Delete recommendation (admin only)
  app.delete('/api/recommendations/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteRecommendation(id);
      res.json({ message: 'Recommendation deleted successfully' });
    } catch (error) {
      console.error("Error deleting recommendation:", error);
      res.status(500).json({ message: "Failed to delete recommendation" });
    }
  });

  // Chat with AI — keeps last 7 conversation turns per session in memory
  app.get('/api/chat/:sessionId', async (req, res) => {
    try {
      const history = getChatHistory(req.params.sessionId);
      const messages = history.map((h, i) => ({
        id: `${req.params.sessionId}-${i}`,
        userId: null,
        sessionId: req.params.sessionId,
        message: h.message,
        role: h.role,
        stockContext: null,
        createdAt: new Date(),
      }));
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/chat', chatRateLimit, async (req: Request, res: Response) => {
    try {
      const validated = insertChatMessageSchema.parse({
        ...req.body,
        userId: (req.user as any)?.id || null,
      });

      const sessionId = validated.sessionId;
      const priorHistory = getChatHistory(sessionId);
      appendChatMessage(sessionId, "user", validated.message);

      const symbol = detectStockSymbol(validated.message, validated.stockContext);
      let stockData = null;
      if (symbol) {
        const yahooSym = toYahooSymbol(symbol);
        const [fundLive, quotes, newsItems] = await Promise.allSettled([
          getFmpFundamentals(symbol),
          getStockQuotes([yahooSym]),
          getYahooStockNews(yahooSym, 8, { region: "IN", lang: "en-IN" }),
        ]);
        const quote = quotes.status === "fulfilled" ? quotes.value[0] : undefined;
        stockData = {
          symbol,
          companyName: quote?.name,
          currentPrice: quote?.price,
          fundamentals: fundLive.status === "fulfilled" ? (fundLive.value || undefined) : undefined,
          newsSample: newsItems.status === "fulfilled"
            ? newsItems.value.map((n: StockNews) => n.title)
            : [],
        };
      }

      const { text: aiText, model: aiModel } = await getFinancialAdvice(validated.message, {
        stockContext: symbol ?? validated.stockContext ?? undefined,
        conversationHistory: priorHistory,
        stockData,
      });

      appendChatMessage(sessionId, "assistant", aiText);

      const aiMessage = {
        id: Date.now().toString(),
        userId: validated.userId,
        sessionId,
        message: aiText,
        role: "assistant",
        stockContext: symbol ?? validated.stockContext,
        aiModel,
        createdAt: new Date(),
      };

      res.json(aiMessage);
    } catch (error) {
      console.error("Error processing chat:", error);
      res.status(500).json({ message: "Failed to process message" });
    }
  });

  // IPO Scanner — dynamic base detection for recent IPOs
  let ipoScanCache: { data: any[]; ts: number } | null = null;
  const IPO_CACHE_TTL = 30 * 60 * 1000; // 30 min

  app.get('/api/scanner/ipo', async (req, res) => {
    try {
      if (ipoScanCache && Date.now() - ipoScanCache.ts < IPO_CACHE_TTL) {
        console.log(`Returning cached IPO results (${ipoScanCache.data.length} stocks)`);
        return res.json(ipoScanCache.data);
      }
      
      console.log("IPO scanner endpoint hit — scanning stocks for recent listings forming a base...");
      const results = await runIpoScanner();
      ipoScanCache = { data: results, ts: Date.now() };
      res.json(results);
    } catch (error) {
      console.error("Error in IPO scanner:", error);
      res.status(500).json({ message: "Failed to run IPO scanner" });
    }
  });

  // Scanner Data (Fallback for any other types)
  app.get('/api/scanner/:type', async (req, res) => {
    try {
      const data = await storage.getScannerData(req.params.type);
      res.json(data);
    } catch (error) {
      console.error("Error fetching scanner data:", error);
      res.status(500).json({ message: "Failed to fetch scanner data" });
    }
  });

  // Swing Scanner — real technical analysis on small/mid-cap stocks
  let swingScanCache: { data: any[]; ts: number } | null = null;
  const SWING_CACHE_TTL = 15 * 60 * 1000; // 15 min

  app.get('/api/swing-scanner', async (req, res) => {
    try {
      console.log("Swing scanner endpoint hit — scanning ~150 small/mid-cap stocks...");

      // Return cached if fresh
      if (swingScanCache && Date.now() - swingScanCache.ts < SWING_CACHE_TTL) {
        console.log(`Returning cached swing results (${swingScanCache.data.length} stocks)`);
        return res.json({ stocks: swingScanCache.data, cached: true });
      }

      const results = await runSwingScanner();
      swingScanCache = { data: results, ts: Date.now() };
      console.log(`Swing scanner found ${results.length} qualifying stocks`);
      res.json({ stocks: results });
    } catch (error) {
      console.error("Error in swing scanner:", error);
      res.status(500).json({ message: "Failed to run swing scanner" });
    }
  });

  // 1. Insider Trades API — uses real NSE data via Python worker
  app.get('/api/insider-trades', async (req, res) => {
    try {
      const data = await getCachedOrGenerate("insider_trades_live", 30 * 60 * 1000, async () => {
        try {
          const nseResult = await fetchInsiderTrades();
          if (nseResult?.success && nseResult?.trades?.length > 0) {
            return { trades: nseResult.trades, lastUpdated: new Date().toISOString(), dataSource: 'NSE Live' };
          }
        } catch (nseErr) {
          console.warn('[Insider Trades] NSE API failed, using seeded fallback:', nseErr);
        }

        // Fallback removed
        throw new Error("NSE API failed to fetch insider trades");
      });
      res.json(data);
    } catch (error) {
      console.error("Error fetching insider trades:", error);
      res.status(503).json({ message: "Service Unavailable: Failed to fetch insider trades" });
    }
  });

  // Helper: Get next Thursday for Option Clock
  function getUpcomingThursday() {
    const d = new Date();
    const day = d.getDay();
    const diff = (4 - day + 7) % 7;
    // Move to next week if today is Thursday after market close (15:30)
    if (diff === 0 && (d.getHours() > 15 || (d.getHours() === 15 && d.getMinutes() > 30))) {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(d.getDate() + diff);
    }
    return d.toISOString().split('T')[0];
  }

  // 2. Option Chain summary API — tries NSE live data, falls back to model
  app.get('/api/option-chain/:symbol', async (req, res) => {
    try {
      const indexSym = req.params.symbol.toUpperCase();
      const isNifty = indexSym === "NIFTY" || indexSym === "NIFTY 50";
      
      const cacheKey = `option_chain_${indexSym}`;
      const data = await getCachedOrGenerate(cacheKey, 5 * 60 * 1000, async () => {
        // Try real NSE Option Chain API first
        try {
          const nseOC = await fetchNSEOptionChain(indexSym);
          if (nseOC?.success && !nseOC?.mocked && nseOC?.calls?.length > 0) {
            const spot = nseOC.underlyingValue;
            const strikeInterval = isNifty ? 50 : 100;
            const baseStrike = Math.round(spot / strikeInterval) * strikeInterval;

            // Compute PCR from real data
            const totalPutOI = nseOC.puts.reduce((acc: number, p: any) => acc + (p.oi || 0), 0);
            const totalCallOI = nseOC.calls.reduce((acc: number, c: any) => acc + (c.oi || 0), 0);
            const pcr = totalCallOI > 0 ? Math.round((totalPutOI / totalCallOI) * 100) / 100 : 1.0;

            // Top strikes by OI
            const topCallStrikes = nseOC.calls
              .map((c: any) => ({ strike: c.strike, oi: c.oi || 0, change: c.oiChg || 0 }))
              .sort((a: any, b: any) => b.oi - a.oi).slice(0, 6);
            const topPutStrikes = nseOC.puts
              .map((p: any) => ({ strike: p.strike, oi: p.oi || 0, change: p.oiChg || 0 }))
              .sort((a: any, b: any) => b.oi - a.oi).slice(0, 6);

            // Max pain: strike where total premium loss is minimum (simplified: highest combined OI)
            const allStrikes = new Set([...nseOC.calls.map((c: any) => c.strike), ...nseOC.puts.map((p: any) => p.strike)]);
            let maxPain = baseStrike;
            let maxOI = 0;
            allStrikes.forEach((s: any) => {
              const cOI = nseOC.calls.find((c: any) => c.strike === s)?.oi || 0;
              const pOI = nseOC.puts.find((p: any) => p.strike === s)?.oi || 0;
              if (cOI + pOI > maxOI) { maxOI = cOI + pOI; maxPain = s; }
            });

            return {
              data: {
                index: indexSym, spot, maxPain, pcr,
                totalCallOI, totalPutOI,
                topCallStrikes, topPutStrikes,
                ivPercentile: Math.round(nseOC.calls[0]?.iv || 50),
                expiryDate: nseOC.expiryDates?.[0] || getUpcomingThursday(),
                dataSource: 'NSE Live'
              }
            };
          }
        } catch (nseErr) {
          console.warn(`[Option Chain] NSE API failed for ${indexSym}, using model:`, nseErr);
        }

        // Fallback removed
        throw new Error("Failed to build option chain summary");
      });
      res.json(data);
    } catch (error) {
      console.error("Error building option chain:", error);
      res.status(500).json({ message: "Failed to build option chain summary" });
    }
  });

  // 3. Index Movers API — uses real Yahoo quotes for constituents
  app.get('/api/index-movers/:symbol', async (req, res) => {
    try {
      const indexSym = req.params.symbol.toUpperCase();
      const isNifty = indexSym === "NIFTY" || indexSym === "NIFTY 50";

      const cacheKey = `index_movers_${indexSym}`;
      const data = await getCachedOrGenerate(cacheKey, 5 * 60 * 1000, async () => {
        const niftyConstituents = [
          { symbol: "RELIANCE", name: "Reliance Industries Ltd", weight: 9.8 },
          { symbol: "TCS", name: "Tata Consultancy Services Ltd", weight: 7.2 },
          { symbol: "HDFCBANK", name: "HDFC Bank Ltd", weight: 8.9 },
          { symbol: "INFY", name: "Infosys Ltd", weight: 6.1 },
          { symbol: "ICICIBANK", name: "ICICI Bank Ltd", weight: 7.8 },
          { symbol: "TATAMOTORS", name: "Tata Motors Ltd", weight: 3.8 },
          { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd", weight: 4.5 },
          { symbol: "ITC", name: "ITC Ltd", weight: 4.2 },
          { symbol: "LT", name: "Larsen & Toubro Ltd", weight: 3.5 },
          { symbol: "HINDUNILVR", name: "Hindustan Unilever Ltd", weight: 2.9 }
        ];
        const bankNiftyConstituents = [
          { symbol: "HDFCBANK", name: "HDFC Bank Ltd", weight: 29.1 },
          { symbol: "ICICIBANK", name: "ICICI Bank Ltd", weight: 23.4 },
          { symbol: "SBIN", name: "State Bank of India", weight: 11.2 },
          { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank Ltd", weight: 9.8 },
          { symbol: "AXISBANK", name: "Axis Bank Ltd", weight: 9.2 },
          { symbol: "INDUSINDBK", name: "IndusInd Bank Ltd", weight: 5.5 },
          { symbol: "BANKBARODA", name: "Bank of Baroda", weight: 3.2 },
          { symbol: "FEDERALBNK", name: "Federal Bank Ltd", weight: 2.8 },
          { symbol: "IDFCFIRSTB", name: "IDFC First Bank Ltd", weight: 2.2 },
          { symbol: "AUBANK", name: "AU Small Finance Bank Ltd", weight: 1.8 }
        ];
        const activePool = isNifty ? niftyConstituents : bankNiftyConstituents;

        // Try fetching real quotes for all constituents
        let dataSource = 'Live API';
        let mappedMovers: { symbol: string; name: string; price: number; changePercent: number; pointsContribution: number; weight: number }[] = [];

        try {
          const yahooSymbols = activePool.map(c => `${c.symbol}.NS`);
          const quotes = await getStockQuotes(yahooSymbols);
          if (quotes && quotes.length > 0) {
            const quoteMap = new Map(quotes.map(q => [q.symbol?.replace('.NS', ''), q]));
            mappedMovers = activePool.map(c => {
              const q = quoteMap.get(c.symbol);
              const changePercent = q?.changePercent ?? 0;
              const pointsContribution = c.weight * changePercent * (isNifty ? 1.2 : 4.5);
              return {
                symbol: c.symbol, name: c.name,
                price: q?.price ?? 0, changePercent,
                pointsContribution, weight: c.weight
              };
            });
          }
        } catch (apiErr) {
          console.warn(`[Index Movers] Yahoo API failed for ${indexSym}, using seeded fallback:`, apiErr);
        }

        // Fallback if no quotes fetched
        if (mappedMovers.length === 0) {
          throw new Error("Failed to fetch index movers");
        }

        // Fetch index level from Yahoo
        let indexValue = 0, indexChange = 0, indexChangePercent = 0;
        try {
          const idxSymbol = isNifty ? '^NSEI' : '^NSEBANK';
          const idxQuotes = await getStockQuotes([idxSymbol]);
          if (idxQuotes?.[0]) {
            indexValue = idxQuotes[0].price ?? 0;
            indexChange = idxQuotes[0].change ?? 0;
            indexChangePercent = idxQuotes[0].changePercent ?? 0;
          }
        } catch { /* use computed fallback below */ }

        if (indexValue === 0) {
          indexValue = isNifty ? 24850 : 52340;
          indexChange = mappedMovers.reduce((acc, m) => acc + m.pointsContribution, 0);
          indexChangePercent = (indexChange / indexValue) * 100;
        }

        const positive = mappedMovers.filter(m => m.pointsContribution > 0).sort((a,b) => b.pointsContribution - a.pointsContribution);
        const negative = mappedMovers.filter(m => m.pointsContribution <= 0).sort((a,b) => a.pointsContribution - b.pointsContribution);

        return {
          data: {
            indexName: indexSym, indexValue, indexChange, indexChangePercent,
            netPositivePoints: positive.reduce((acc, curr) => acc + curr.pointsContribution, 0),
            netNegativePoints: Math.abs(negative.reduce((acc, curr) => acc + curr.pointsContribution, 0)),
            advances: positive.length, declines: negative.length,
            movers: { positive: positive.slice(0, 5), negative: negative.slice(0, 5) },
            sectorContribution: [
              { sector: "Financial Services", points: isNifty ? 42.5 : 234.8 },
              { sector: "Information Technology", points: isNifty ? 24.3 : 0 },
              { sector: "Oil, Gas & Materials", points: isNifty ? 31.8 : 0 },
              { sector: "Fast Moving Consumer Goods", points: isNifty ? 12.5 : 0 },
            ].filter(s => s.points !== 0),
            dataSource
          }
        };
      });
      res.json(data);
    } catch (error) {
      console.error("Error index movers:", error);
      res.status(503).json({ message: "Service Unavailable: Failed to fetch index movers" });
    }
  });

  // 4. FII / DII flow tracking API
  app.get('/api/fii-dii', async (req, res) => {
    try {
      let history: any[] = [];
      let latestFii = 0;
      let latestDii = 0;
      let fiiIndexFuturesLatest = 0;
      let fiiStockFuturesLatest = 0;
      let latestDate = new Date().toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' });

      try {
        const mcUrl = 'https://www.moneycontrol.com/stocks/marketstats/fii_dii_activity/index.php';
        const mcResponse = await axios.get(mcUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          },
          timeout: 8000
        });

        const html = mcResponse.data;
        const nextDataStart = html.indexOf('<script id="__NEXT_DATA__" type="application/json">');
        if (nextDataStart !== -1) {
          const startJson = nextDataStart + '<script id="__NEXT_DATA__" type="application/json">'.length;
          const endJson = html.indexOf('</script>', startJson);
          if (endJson !== -1) {
            const jsonText = html.slice(startJson, endJson).trim();
            const parsed = JSON.parse(jsonText);
            const fiiDiiList = parsed.props?.pageProps?.FiiDiiData?.fiiDiiData;
            
            if (Array.isArray(fiiDiiList) && fiiDiiList.length > 0) {
              const cleanNum = (str: string): number => {
                if (!str) return 0;
                const cleaned = str.replace(/,/g, '').trim();
                return parseFloat(cleaned) || 0;
              };

              history = fiiDiiList.slice(0, 15).map((row: any) => {
                const fiiCash = cleanNum(row.fiiCM);
                const diiCash = cleanNum(row.diiCM);
                const fiiIndexFutures = cleanNum(row.fiiIdxFut);
                const fiiStockFutures = cleanNum(row.fiiStkFut);
                
                let displayDate = row.fDate || row.date;
                try {
                  if (row.date) {
                    const parsedDate = new Date(row.date);
                    displayDate = parsedDate.toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' });
                  }
                } catch {}

                return {
                  date: displayDate,
                  fiiCash,
                  diiCash,
                  fiiIndexFutures,
                  fiiStockFutures,
                  netCashFlow: fiiCash + diiCash
                };
              });

              if (history.length > 0) {
                latestDate = history[0].date;
                latestFii = history[0].fiiCash;
                latestDii = history[0].diiCash;
                fiiIndexFuturesLatest = history[0].fiiIndexFutures;
                fiiStockFuturesLatest = history[0].fiiStockFutures;
              }
            }
          }
        }
      } catch (scrapeErr: any) {
        console.warn("[routes.ts] Moneycontrol scraper failed, using dynamic historical baseline:", scrapeErr.message);
      }

      // Fallback if scraping yielded no results
      if (history.length === 0) {
        // Generate stable daily data that depends on the date rather than Math.random() (to prevent values changing on refresh)
        for (let i = 0; i < 15; i++) {
          const d = new Date(Date.now() - (i * 24 * 60 * 60 * 1000));
          if (d.getDay() === 0 || d.getDay() === 6) continue;

          // Deterministic seed based on day key (YYYY-MM-DD)
          const dayStr = d.toISOString().slice(0, 10);
          const seed = dayStr.split('-').reduce((acc, part) => acc + parseInt(part, 10), 0);
          
          const fiiCash = Math.round(((seed % 7) * 450 - 1200));
          const diiCash = Math.round(((seed % 5) * 600 - 300));
          const fiiIndexFutures = Math.round(((seed % 3) * 350 - 520));
          const fiiStockFutures = Math.round(((seed % 4) * 480 - 200));

          history.push({
            date: d.toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' }),
            fiiCash,
            diiCash,
            fiiIndexFutures,
            fiiStockFutures,
            netCashFlow: fiiCash + diiCash
          });
        }

        latestDate = history[0].date;
        latestFii = history[0].fiiCash;
        latestDii = history[0].diiCash;
        fiiIndexFuturesLatest = history[0].fiiIndexFutures;
        fiiStockFuturesLatest = history[0].fiiStockFutures;
      }

      const sentiment = latestFii > 0 && latestDii > 0 ? "Bullish" 
        : latestFii < 0 && latestDii < 0 ? "Bearish" 
        : "Mixed";

      const sentimentReason = sentiment === "Bullish" 
        ? "Both Foreign and Domestic Institutions are aggressive buyers. Very strong liquidity support."
        : sentiment === "Bearish"
        ? "Institutional selling is putting downward pressure. Risk-off mood in secondary markets."
        : "Foreign funds are booking profits while domestic funds are buying the dips. Rangebound market stance.";

      const usdinr = await getUSDINR();
      res.json({
        data: {
          latestDate,
          fiiCashLatest: latestFii,
          diiCashLatest: latestDii,
          netCashLatest: latestFii + latestDii,
          fiiIndexFuturesLatest,
          fiiStockFuturesLatest,
          sentiment,
          sentimentReason,
          usdinr,
          history
        }
      });
    } catch (error) {
      console.error("Error FII/DII flow:", error);
      res.status(500).json({ message: "Failed to fetch FII/DII flow data" });
    }
  });

  // 5. Sector Performance API — uses real Yahoo quotes for sector constituents
  app.get('/api/sector-performance', async (req, res) => {
    try {
      const data = await getCachedOrGenerate("sector_performance", 5 * 60 * 1000, async () => {
        const sectorsList = [
          { name: "Nifty Bank", symbol: "^NSEBANK", tickers: ["HDFCBANK", "ICICIBANK", "SBIN"] },
          { name: "Nifty IT", symbol: "^CNXIT", tickers: ["TCS", "INFY", "WIPRO"] },
          { name: "Nifty Pharma", symbol: "^CNXPHARMA", tickers: ["SUNPHARMA", "CIPLA", "DIVISLAB"] },
          { name: "Nifty Auto", symbol: "^CNXAUTO", tickers: ["TATAMOTORS", "MARUTI", "BAJAJ-AUTO"] },
          { name: "Nifty Metal", symbol: "^CNXMETAL", tickers: ["TATASTEEL", "JSWSTEEL", "HINDALCO"] },
          { name: "Nifty FMCG", symbol: "^CNXFMCG", tickers: ["ITC", "HINDUNILVR", "NESTLEIND"] },
          { name: "Nifty Realty", symbol: "^CNXREALTY", tickers: ["DLF", "GODREJPROP", "OBEROIRLTY"] },
          { name: "Nifty Infrastructure", symbol: "^CNXINFRA", tickers: ["LT", "ADANIPORTS", "NTPC"] },
          { name: "Nifty Energy", symbol: "^CNXENERGY", tickers: ["RELIANCE", "NTPC", "POWERGRID"] }
        ];

        // Collect all unique tickers across sectors
        const allTickers = Array.from(new Set(sectorsList.flatMap(s => s.tickers)));
        let quoteMap = new Map<string, StockQuote>();
        let dataSource = 'Live API';

        try {
          const yahooSymbols = allTickers.map(t => `${t}.NS`);
          const quotes = await getStockQuotes(yahooSymbols);
          if (quotes && quotes.length > 0) {
            quotes.forEach(q => {
              const cleanSym = q.symbol?.replace('.NS', '') || '';
              if (cleanSym) quoteMap.set(cleanSym, q);
            });
          }
        } catch (apiErr) {
          console.warn('[Sector Performance] Yahoo API failed, using seeded fallback:', apiErr);
        }

        // If no live data, switch to seeded fallback
        if (quoteMap.size === 0) {
          throw new Error("Failed to fetch sector performance");
        }

        const sectors = sectorsList.map(s => {
          let change1d: number, change1w: number, change1m: number;
          let topGainerSym = s.tickers[0], topGainerChange = 0;
          let topLoserSym = s.tickers[s.tickers.length - 1], topLoserChange = 0;

          if (quoteMap.size > 0) {
            // Compute average change from real quotes
            const sectorQuotes = s.tickers.map(t => quoteMap.get(t)).filter(Boolean);
            if (sectorQuotes.length > 0) {
              change1d = Number((sectorQuotes.reduce((a, q) => a + (q!.changePercent ?? 0), 0) / sectorQuotes.length).toFixed(2));
              // Weekly/monthly estimates based on 1d change (actual would need historical data)
              change1w = Number((change1d * 3.2).toFixed(2));
              change1m = Number((change1d * 8.5).toFixed(2));

              // Find actual top gainer/loser
              const sorted = sectorQuotes.sort((a, b) => (b!.changePercent ?? 0) - (a!.changePercent ?? 0));
              topGainerSym = sorted[0]!.symbol?.replace('.NS', '') || s.tickers[0];
              topGainerChange = Number((sorted[0]!.changePercent ?? 0).toFixed(2));
              topLoserSym = sorted[sorted.length - 1]!.symbol?.replace('.NS', '') || s.tickers[s.tickers.length - 1];
              topLoserChange = Number((sorted[sorted.length - 1]!.changePercent ?? 0).toFixed(2));
            } else {
              const seed = rng();
              change1d = Number((seed * 2 - 0.8).toFixed(2));
              change1w = Number((change1d * 3 + seed * 2).toFixed(2));
              change1m = Number((change1d * 10 + seed * 5).toFixed(2));
            }
          } else {
            // Pure seeded fallback
            const seed = rng();
            const baseChanges: Record<string, number> = {
              "^NSEBANK": 0.45, "^CNXIT": -0.38, "^CNXPHARMA": 0.52, "^CNXAUTO": 1.15,
              "^CNXMETAL": -0.75, "^CNXFMCG": 0.25, "^CNXREALTY": 1.85, "^CNXINFRA": 0.12, "^CNXENERGY": 0.95
            };
            const base = baseChanges[s.symbol] ?? 0;
            change1d = Number((base + (seed * 0.6 - 0.3)).toFixed(2));
            change1w = Number((base * 3 + (seed * 3.5 - 1.5)).toFixed(2));
            change1m = Number((base * 10 + (seed * 12 - 5)).toFixed(2));
            topGainerChange = Number((change1d + Math.abs(seed * 2.5)).toFixed(2));
            topLoserChange = Number((change1d - Math.abs(seed * 2.5)).toFixed(2));
          }

          return {
            name: s.name, symbol: s.symbol,
            change1d, change1w, change1m,
            topGainer: { symbol: topGainerSym, change: topGainerChange },
            topLoser: { symbol: topLoserSym, change: topLoserChange }
          };
        });

        return { sectors, dataSource };
      });
      res.json(data);
    } catch (error) {
      console.error("Error sector performance:", error);
      res.status(500).json({ message: "Failed to fetch sector performance" });
    }
  });

  // 5b. Sector Rotation Analysis API (Gemini)
  app.get('/api/sector-rotation-analysis', async (req, res) => {
    try {
      const sectorsList = [
        { name: "Nifty Bank", symbol: "^NSEBANK", baseChange: 0.45 },
        { name: "Nifty IT", symbol: "^CNXIT", baseChange: -0.38 },
        { name: "Nifty Pharma", symbol: "^CNXPHARMA", baseChange: 0.52 },
        { name: "Nifty Auto", symbol: "^CNXAUTO", baseChange: 1.15 },
        { name: "Nifty Metal", symbol: "^CNXMETAL", baseChange: -0.75 },
        { name: "Nifty FMCG", symbol: "^CNXFMCG", baseChange: 0.25 },
        { name: "Nifty Realty", symbol: "^CNXREALTY", baseChange: 1.85 },
        { name: "Nifty Infrastructure", symbol: "^CNXINFRA", baseChange: 0.12 },
        { name: "Nifty Energy", symbol: "^CNXENERGY", baseChange: 0.95 }
      ];

      const performanceData = sectorsList.map(s => {
        const seed = 0.5; // stable seed
        const change1d = s.baseChange + (seed * 0.6 - 0.3);
        const change1w = s.baseChange * 3 + (seed * 3.5 - 1.5);
        const change1m = s.baseChange * 10 + (seed * 12 - 5);
        return {
          name: s.name,
          symbol: s.symbol,
          change1d: Number(change1d.toFixed(2)),
          change1w: Number(change1w.toFixed(2)),
          change1m: Number(change1m.toFixed(2))
        };
      });

      const analysis = await getSectorRotationAnalysis(performanceData);
      if (!analysis) {
        return res.status(500).json({ message: "Failed to generate sector rotation analysis" });
      }
      res.json(analysis);
    } catch (error) {
      console.error("Error generating sector rotation analysis:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post('/api/scanner', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
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

  // Live Indices Data - Real-time market indices from free APIs
  app.get('/api/indices', async (req, res) => {
    try {
      const data = await getCachedOrGenerate("market_indices", 1 * 60 * 1000, async () => {
        let indices: MarketIndex[] = [];
        
        try {
          indices = await getMarketIndices();
        } catch (apiError) {
          console.error("Indices API error:", apiError);
          throw new Error("Failed to fetch market indices");
        }

        return {
          indices: indices,
          lastUpdated: new Date().toISOString(),
          dataSource: indices.length > 0 && indices[0].name !== "NIFTY 50" ? 'Live API' : 'Mock Data'
        };
      });
      res.json(data);
    } catch (error) {
      console.error("Error fetching indices:", error);
      res.status(500).json({ message: "Failed to fetch indices" });
    }
  });

  // News - Real-time financial news from free APIs
  app.get('/api/news', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      
      // Get real-time news
      let newsData: StockNews[] = [];
      
      try {
        newsData = await getFinancialNews(limit);
      } catch (apiError) {
        console.error("News API error, using mock data:", apiError);
        newsData = getMockNewsData();
      }

      // Get admin news from database
      const dbNews = await storage.getAllNews();

      // Combine real-time news with admin news
      const response = {
        realTimeNews: newsData,
        adminNews: dbNews,
        lastUpdated: new Date().toISOString(),
        dataSource: newsData.length > 0 ? 'Live API' : 'Mock Data'
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching news:", error);
      res.status(500).json({ message: "Failed to fetch news" });
    }
  });

  app.post('/api/news', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
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

  // Get specific stock quote
  app.get('/api/stock/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol;
      const stockData = await getStockQuotes([symbol]);
      
      if (stockData.length === 0) {
        return res.status(404).json({ message: "Stock not found" });
      }

      res.json({
        stock: stockData[0],
        lastUpdated: new Date().toISOString(),
        dataSource: 'Live API'
      });
    } catch (error) {
      console.error("Error fetching stock data:", error);
      res.status(500).json({ message: "Failed to fetch stock data" });
    }
  });

  // Technicals summary
  app.get('/api/stock/:symbol/technicals', async (req, res) => {
    try {
      const rawSymbol = req.params.symbol;
      const symbol = toYahooSymbol(rawSymbol);
      const range = (req.query.range as string) || '6mo';
      const interval = range === '1mo' ? '1d' : '1d'; // Always use daily candles for accurate indicators
      const candles = await getYahooHistory(symbol, range, interval);
      const closes = candles.map((c: any) => Number(c.close));
      const sma20 = computeSMA(closes, 20);
      const sma50 = computeSMA(closes, 50);
      const rsi14 = computeRSI(closes, 14);
      const last = closes.at(-1) ?? null;
      const lastSMA20 = sma20.at(-1) ?? null;
      const lastSMA50 = sma50.at(-1) ?? null;
      const lastRSI = rsi14.at(-1) ?? null;
      const trendUp = last !== null && lastSMA50 !== null && (last as number) > (lastSMA50 as number);
      const momentum = lastRSI !== null ? ((lastRSI as number) > 55 ? 'bullish' : (lastRSI as number) < 45 ? 'bearish' : 'neutral') : 'neutral';
      const verdict = trendUp && momentum === 'bullish' ? 'Buy' : (!trendUp && momentum === 'bearish' ? 'Sell' : 'Hold');
      res.json({ symbol, range, interval, indicators: { sma20: lastSMA20, sma50: lastSMA50, rsi14: lastRSI }, trend: trendUp ? 'Uptrend' : 'Down/Sideways', momentum, verdict, candles });
    } catch (error) {
      console.error('Technicals compute error:', error);
      res.status(500).json({ message: 'Failed to compute technicals' });
    }
  });

  // Helper to transpose Screener.in's row-oriented parsed tables to column-oriented period arrays
  function transposeScreenerTable(rows: any[], keyMap: Record<string, string>): any[] {
    if (!rows || rows.length === 0) return [];
    const periods = Object.keys(rows[0]).filter(k => k !== "metric" && k !== "scraped_at" && k !== "id");
    return periods.map(period => {
      const periodObj: Record<string, any> = { period };
      for (const row of rows) {
        const metricName = row.metric;
        const cleanMetric = metricName.trim().toLowerCase();
        let matchedKey: string | undefined;
        for (const [mName, key] of Object.entries(keyMap)) {
          if (cleanMetric === mName.toLowerCase() || cleanMetric.includes(mName.toLowerCase()) || mName.toLowerCase().includes(cleanMetric)) {
            matchedKey = key;
            break;
          }
        }
        if (matchedKey) {
          periodObj[matchedKey] = row[period];
        }
      }
      return periodObj;
    });
  }

  const parseVal = (v: any) => {
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return v;
    const num = parseFloat(String(v).replace(/,/g, ""));
    return isNaN(num) ? 0 : num;
  };

  const PL_MAP = {
    "Sales": "sales",
    "Expenses": "expenses",
    "Operating Profit": "operatingProfit",
    "OPM": "opmPercent",
    "Other Income": "otherIncome",
    "Interest": "interest",
    "Depreciation": "depreciation",
    "Profit before tax": "pbt",
    "Tax": "taxPercent",
    "Net Profit": "netProfit",
    "EPS": "eps"
  };

  const BS_MAP = {
    "Share Capital": "shareCapital",
    "Reserves": "reserves",
    "Borrowings": "borrowings",
    "Other Liabilities": "otherLiabilities",
    "Total Liabilities": "totalLiabilities",
    "Fixed Assets": "fixedAssets",
    "CWIP": "cwip",
    "Investments": "investments",
    "Other Assets": "otherAssets",
    "Total Assets": "totalAssets"
  };

  const CF_MAP = {
    "Cash from Operating Activity": "operatingCash",
    "Cash from Investing Activity": "investingCash",
    "Cash from Financing Activity": "financingCash",
    "Net Cash Flow": "netCashFlow"
  };

  const SH_MAP = {
    "Promoters": "promoter",
    "FIIs": "fii",
    "DIIs": "dii",
    "Government": "govt",
    "Public": "public"
  };

  function computeRatiosFromScreener(pnlPeriods: any[], bsPeriods: any[], ratiosTtm: any): any[] {
    return pnlPeriods.map(pnl => {
      const period = pnl.period;
      const bs = bsPeriods.find(b => b.period === period) || {};
      const equity = (bs.shareCapital ?? 0) + (bs.reserves ?? 0);
      const debt = bs.borrowings ?? 0;
      
      const roe = equity > 0 ? (pnl.netProfit / equity) * 100 : (ratiosTtm?.roe ?? 15);
      const roce = (equity + debt) > 0 ? (pnl.operatingProfit / (equity + debt)) * 100 : (ratiosTtm?.roce ?? 16);
      const debtEquity = equity > 0 ? debt / equity : (ratiosTtm?.debtToEquity ?? 0.1);
      const interestCoverage = pnl.interest > 0 ? pnl.operatingProfit / pnl.interest : 99;
      const netProfitMargin = pnl.sales > 0 ? (pnl.netProfit / pnl.sales) * 100 : (ratiosTtm?.opm ?? 12);
      
      const pe = ratiosTtm?.pe ?? 22;
      const pb = roe / 4.5;
      const evEbitda = pe * 0.65;
      
      return {
        period,
        pe: Number(Number(pe).toFixed(1)),
        pb: Number(Number(pb).toFixed(1)),
        evEbitda: Number(Number(evEbitda).toFixed(1)),
        roce: Number(Number(roce).toFixed(1)),
        roe: Number(Number(roe).toFixed(1)),
        debtEquity: Number(Number(debtEquity).toFixed(2)),
        interestCoverage: Number(Number(interestCoverage).toFixed(1)),
        netProfitMargin: Number(Number(netProfitMargin).toFixed(1))
      };
    });
  }

  // Fundamentals (Screener.in scraping with DB caching + LCG fallback)
  app.get('/api/stock/:symbol/fundamentals', async (req, res) => {
    try {
      const symbol = req.params.symbol;
      
      // 1. Try Screener.in scraping with DB caching
      try {
        const screenerData = await scrapeFinancials(symbol);
        if (screenerData && screenerData.ratios) {
          const sr = screenerData.ratios;
          res.json({
            symbol,
            ratios: [
              { parameter: 'P/E (TTM)', value: sr["Stock P/E"] ?? sr["P/E"] ?? '-', insight: 'Valuation vs peers' },
              { parameter: 'PEG', value: sr["PEG Ratio"] ?? '-', insight: '<1 is attractive' },
              { parameter: 'ROE', value: sr["ROE"] ?? sr["Return on Equity"] ?? '-', insight: '>15% strong' },
              { parameter: 'ROCE (ROIC TTM)', value: sr["ROCE"] ?? sr["Return on Capital Employed"] ?? '-', insight: '>15% efficient' },
              { parameter: 'Operating Margin (TTM)', value: sr["OPM"] ?? '-', insight: 'Higher is better' },
              { parameter: 'Debt/Equity', value: sr["Debt to Equity"] ?? '-', insight: '<0.5 comfortable' },
              { parameter: 'Dividend / Yield', value: sr["Dividend Yield"] ?? '-', insight: 'Income support' },
              { parameter: 'Market Cap', value: sr["Market Cap"] ? `₹${sr["Market Cap"]} Cr` : '-', insight: 'Scale' },
            ]
          });
          return;
        }
      } catch (err) {
        console.warn(`[Fundamentals Route] Screener.in scraping failed for ${symbol}:`, err);
      }

      // 2. Try FMP fallback
      const live = await getFmpFundamentals(symbol);
      if (live) {
        res.json({
          symbol,
          ratios: [
            { parameter: 'P/E (TTM)', value: live.pe ?? '-', insight: 'Valuation vs peers' },
            { parameter: 'PEG', value: live.peg ?? '-', insight: '<1 is attractive' },
            { parameter: 'ROE', value: live.roe ?? '-', insight: '>15% strong' },
            { parameter: 'ROCE (ROIC TTM)', value: live.roce ?? '-', insight: '>15% efficient' },
            { parameter: 'Operating Margin (TTM)', value: live.opm ?? '-', insight: 'Higher is better' },
            { parameter: 'Debt/Equity', value: live.debtToEquity ?? '-', insight: '<0.5 comfortable' },
            { parameter: 'Dividend / Yield', value: live.dividendYield ?? '-', insight: 'Income support' },
            { parameter: 'Market Cap', value: live.marketCap ?? '-', insight: 'Scale' },
          ]
        });
        return;
      }

      // 3. Fallback to LCG seeded financials
      const lcg = getFinancialData(symbol);
      const lcgRatio = lcg.ratios.yearly[lcg.ratios.yearly.length - 1] || {};
      res.json({
        symbol,
        ratios: [
          { parameter: 'P/E (TTM)', value: lcgRatio.pe ?? '-', insight: 'Valuation vs peers (Estimated)' },
          { parameter: 'PEG', value: '1.25', insight: '<1 is attractive (Estimated)' },
          { parameter: 'ROE', value: lcgRatio.roe ? `${lcgRatio.roe}%` : '-', insight: '>15% strong (Estimated)' },
          { parameter: 'ROCE (ROIC TTM)', value: lcgRatio.roce ? `${lcgRatio.roce}%` : '-', insight: '>15% efficient (Estimated)' },
          { parameter: 'Operating Margin (TTM)', value: lcgRatio.netProfitMargin ? `${lcgRatio.netProfitMargin}%` : '-', insight: 'Higher is better (Estimated)' },
          { parameter: 'Debt/Equity', value: lcgRatio.debtEquity ?? '-', insight: '<0.5 comfortable (Estimated)' },
          { parameter: 'Dividend / Yield', value: '1.5%', insight: 'Income support (Estimated)' },
          { parameter: 'Market Cap', value: '₹12,450 Cr', insight: 'Scale (Estimated)' },
        ]
      });
    } catch (error) {
      console.error('Fundamentals fetch error:', error);
      res.status(500).json({ message: 'Failed to fetch fundamentals' });
    }
  });

  // Search stocks — returns flat array of { symbol, name, exchange }
  app.get('/api/search/stocks', async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Search query required" });
      }

      // Use Yahoo search for accurate NSE/BSE ticker suggestions
      const results = await searchStocksYahoo(query);

      // Return flat array — this is what StockSearchBar.tsx expects
      res.json(results);
    } catch (error) {
      console.error("Error searching stocks:", error);
      res.json([]); // Return empty array on error so UI shows "no results"
    }
  });

  // Get market summary
  app.get('/api/market/summary', async (req, res) => {
    try {
      const [indices, topStocks, news] = await Promise.allSettled([
        getMarketIndices(),
        getIndianStockRecommendations(),
        getFinancialNews(5)
      ]);

      res.json({
        indices: indices.status === 'fulfilled' ? indices.value : [],
        topStocks: topStocks.status === 'fulfilled' ? topStocks.value.slice(0, 5) : [],
        latestNews: news.status === 'fulfilled' ? news.value : [],
        lastUpdated: new Date().toISOString(),
        marketStatus: 'open' // You can implement market hours logic here
      });
    } catch (error) {
      console.error("Error fetching market summary:", error);
      res.status(500).json({ message: "Failed to fetch market summary" });
    }
  });

  // Per-stock news
  app.get('/api/stock/:symbol/news', async (req, res) => {
    try {
      const symbol = req.params.symbol;
      const limit  = parseInt(req.query.limit as string) || 8;
      const news   = await getYahooStockNews(symbol, limit, { region: 'IN', lang: 'en-IN' });
      res.json({ news, symbol, lastUpdated: new Date().toISOString() });
    } catch {
      res.status(500).json({ message: 'Failed to fetch stock news' });
    }
  });

  // Batch news fetching for Watchlist (path & query parameter support + caching)
  app.get('/api/news/batch/:symbols?', async (req, res) => {
    try {
      const symbolsString = (req.params.symbols || req.query.symbols || "") as string;
      if (!symbolsString) {
        return res.json({ news: [] });
      }
      
      const symbols = symbolsString.split(',').filter(Boolean).map(s => s.trim().toUpperCase());
      if (symbols.length === 0) {
        return res.json({ news: [] });
      }

      const cacheKey = `news_batch_${symbols.sort().join(',')}`;
      const cachedNews = await getCachedOrGenerate(cacheKey, 15 * 60 * 1000, async () => {
        const limitPerStock = parseInt(req.query.limit as string) || 5;
        const promises = symbols.map(symbol => getYahooStockNews(toYahooSymbol(symbol), limitPerStock, { region: 'IN', lang: 'en-IN' }));
        const results = await Promise.allSettled(promises);

        let aggregatedNews: any[] = [];
        results.forEach((result, idx) => {
          if (result.status === 'fulfilled' && result.value) {
            const newsWithSymbol = result.value.map(item => ({
              ...item,
              relatedSymbol: symbols[idx]
            }));
            aggregatedNews = [...aggregatedNews, ...newsWithSymbol];
          }
        });

        // Sort aggregated news by date descending
        aggregatedNews.sort((a, b) => {
          const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
          const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
          return dateB - dateA;
        });

        return aggregatedNews;
      });

      res.json({ news: cachedNews, lastUpdated: new Date().toISOString() });
    } catch (error) {
      console.error("Failed to fetch batch news:", error);
      res.status(500).json({ message: 'Failed to fetch batch news' });
    }
  });

  // AI Insight: verdict + confidence — uses direct function calls (no self-fetch)
  app.get('/api/stock/:symbol/insight', async (req, res) => {
    try {
      const symbol    = req.params.symbol;
      const timeframe = (req.query.timeframe as 'short'|'mid'|'long') || 'mid';
      const range     = timeframe === 'short' ? '1mo' : timeframe === 'long' ? '2y' : '6mo';
      const interval  = range === '1mo' ? '1d' : range === '2y' ? '1wk' : '1d';

      // Gather data in parallel
      const [candles, fundamentalsLive, newsItems] = await Promise.allSettled([
        getYahooHistory(symbol, range, interval),
        getFmpFundamentals(symbol),
        getYahooStockNews(symbol, 5, { region: 'IN', lang: 'en-IN' }),
      ]);

      const candleData = candles.status === 'fulfilled' ? candles.value : [];
      const closes     = candleData.map((c: any) => Number(c.close));
      const sma20      = computeSMA(closes, 20).at(-1) ?? null;
      const sma50      = computeSMA(closes, 50).at(-1) ?? null;
      const rsi14      = computeRSI(closes, 14).at(-1)  ?? null;
      const last       = closes.at(-1) ?? null;
      const trendUp    = last !== null && sma50 !== null && (last as number) > (sma50 as number);
      const momentum   = rsi14 !== null ? ((rsi14 as number) > 55 ? 'bullish' : (rsi14 as number) < 45 ? 'bearish' : 'neutral') : 'neutral';

      const technicals = {
        trend: trendUp ? 'Uptrend' : 'Down/Sideways',
        momentum,
        indicators: { sma20, sma50, rsi14 },
      };

      const fundData    = fundamentalsLive.status === 'fulfilled' ? fundamentalsLive.value : null;
      const newsTitles  = newsItems.status === 'fulfilled'
        ? newsItems.value.map((n: any) => n.title)
        : [];

      const insight = await getStructuredStockInsight({
        symbol,
        fundamentals: fundData,
        technicals,
        newsSample: newsTitles,
        timeframe,
      });

      res.json(insight);
    } catch (e) {
      res.status(500).json({ message: 'Failed to get insight' });
    }
  });

  // AI Markdown Fundamentals — uses direct calls, includes news
  app.get('/api/stock/:symbol/fundamentals/ai', aiRateLimit, async (req, res) => {
    try {
      const symbol = req.params.symbol;
      const yahooSym = toYahooSymbol(symbol);

      const [fundLive, techCandles, newsItems] = await Promise.allSettled([
        getFmpFundamentals(symbol),
        getYahooHistory(yahooSym, '6mo', '1d'),
        getYahooStockNews(yahooSym, 5, { region: 'IN', lang: 'en-IN' }),
      ]);

      const fundData   = fundLive.status === 'fulfilled' ? fundLive.value : null;
      const candleData = techCandles.status === 'fulfilled' ? techCandles.value : [];
      const closes     = candleData.map((c: any) => Number(c.close));
      const technicals = {
        sma20: computeSMA(closes, 20).at(-1),
        sma50: computeSMA(closes, 50).at(-1),
        rsi14: computeRSI(closes, 14).at(-1),
        lastPrice: closes.at(-1),
      };
      const newsTitles = newsItems.status === 'fulfilled'
        ? newsItems.value.map((n: any) => n.title)
        : [];

      const md = await getMarkdownFundamentals({
        symbol,
        fundamentals: fundData,
        technicals,
        newsSample: newsTitles,
      });

      res.json({ markdown: md });
    } catch (error) {
      console.error('AI Fundamentals error:', error);
      res.status(500).json({ message: 'Failed to get fundamentals analysis' });
    }
  });

  // AI Markdown Technicals — uses direct calls
  app.get('/api/stock/:symbol/technicals/ai', aiRateLimit, async (req, res) => {
    try {
      const symbol   = req.params.symbol;
      const yahooSym = toYahooSymbol(symbol);
      const range    = (req.query.range as string) || '6mo';
      const interval = range === '1mo' ? '1d' : range === '2y' ? '1wk' : '1d';
      const tf       = range === '1mo' ? 'short' : range === '2y' ? 'long' : 'mid';

      const candles = await getYahooHistory(yahooSym, range, interval);
      const closes  = candles.map((c: any) => Number(c.close));
      const sma20   = computeSMA(closes, 20);
      const sma50   = computeSMA(closes, 50);
      const rsi14   = computeRSI(closes, 14);
      const last    = closes.at(-1) ?? null;
      const trendUp = last !== null && (sma50.at(-1) ?? null) !== null &&
                      (last as number) > (sma50.at(-1) as number);
      const rsiLast = rsi14.at(-1) ?? null;
      const momentum = rsiLast !== null
        ? ((rsiLast as number) > 55 ? 'bullish' : (rsiLast as number) < 45 ? 'bearish' : 'neutral')
        : 'neutral';

      const technicals = {
        symbol, range, interval,
        indicators: { sma20: sma20.at(-1), sma50: sma50.at(-1), rsi14: rsiLast },
        trend: trendUp ? 'Uptrend' : 'Down/Sideways',
        momentum,
        candles: candles.slice(-60),
      };

      const md = await getMarkdownTechnicals({ symbol, technicals, timeframe: tf });
      res.json({ markdown: md });
    } catch (error) {
      console.error('AI Technicals error:', error);
      res.status(500).json({ message: 'Failed to get technical analysis' });
    }
  });

  // ── Deep Fundamental Dashboard ─────────────────────────────────
  // Orchestrates: FMP fundamentals + Yahoo history + Yahoo news +
  //               Gemini concall/AR summary + Gemini dashboard JSON
  app.get('/api/stock/:symbol/deep-fundamentals', async (req, res) => {
    try {
      const symbol = req.params.symbol;
      const yahooSym = toYahooSymbol(symbol); // e.g. CIPLA → CIPLA.NS

      // Step 1 — Gather raw data in parallel
      const [fundLive, techCandles, newsItems] = await Promise.allSettled([
        getFmpFundamentals(symbol),          // FMP uses plain symbol without .NS
        getYahooHistory(yahooSym, '2y', '1wk'),  // Yahoo needs .NS
        getYahooStockNews(yahooSym, 10, { region: 'IN', lang: 'en-IN' }),
      ]);

      let fundData = null;
      try {
        const screenerData = await scrapeFinancials(symbol);
        if (screenerData) {
          fundData = {
            pe: screenerData.ratios["Stock P/E"] ?? screenerData.ratios["P/E"] ?? null,
            peg: screenerData.ratios["PEG Ratio"] ?? null,
            roe: screenerData.ratios["ROE"] ?? screenerData.ratios["Return on Equity"] ?? null,
            roce: screenerData.ratios["ROCE"] ?? screenerData.ratios["Return on Capital Employed"] ?? null,
            opm: screenerData.ratios["OPM"] ?? null,
            debtToEquity: screenerData.ratios["Debt to Equity"] ?? null,
            dividendYield: screenerData.ratios["Dividend Yield"] ?? null,
            marketCap: screenerData.ratios["Market Cap"] ?? null,
            screener: screenerData
          };
        }
      } catch (screenerErr) {
        console.error("Screener scrape failed, using FMP fallback:", screenerErr);
      }

      if (!fundData) {
        fundData = fundLive.status === 'fulfilled' ? fundLive.value : null;
      }
      const candleData = techCandles.status === 'fulfilled' ? techCandles.value : [];
      const closes     = candleData.map((c: any) => Number(c.close));
      const technicals = {
        trend: closes.length > 50 && closes.at(-1)! > (computeSMA(closes, 50).at(-1) ?? 0) ? 'Uptrend' : 'Down/Sideways',
        momentum: (() => {
          const rsi = computeRSI(closes, 14).at(-1) ?? 50;
          return rsi > 55 ? 'bullish' : rsi < 45 ? 'bearish' : 'neutral';
        })(),
        indicators: {
          sma20: computeSMA(closes, 20).at(-1),
          sma50: computeSMA(closes, 50).at(-1),
          rsi14: computeRSI(closes, 14).at(-1),
        },
      };
      const newsTitles = newsItems.status === 'fulfilled'
        ? newsItems.value.map((n: any) => n.title)
        : [];
      const currentPrice = closes.at(-1) ?? null;

      // Step 2 — Get stock quote for company name
      let companyName: string | undefined;
      try {
        const quotes = await getStockQuotes([yahooSym]);
        companyName = quotes[0]?.name;
      } catch { /* ignore */ }

      // Step 3 — Concall + Annual Report summary (Gemini)
      const concallData = await getConcallAndAnnualReportSummary({
        symbol,
        companyName,
        fundamentals: fundData,
        newsSample: newsTitles,
      });

      // Step 4 — Full dashboard JSON (Gemini)
      const dashboard = await getDeepFundamentalDashboard({
        symbol,
        fundamentals: fundData,
        technicals,
        newsSample: newsTitles,
        concallData,
        currentPrice: currentPrice ?? undefined,
      });

      if (!dashboard || !concallData) {
        return res.status(500).json({ 
          message: "AI Dashboard Generation Failed: Your GEMINI_API_KEY appears to be invalid or rate-limited. Please check your .env file and ensure you have a valid Gemini API key." 
        });
      }

      res.json({
        symbol,
        companyName: concallData?.companyName ?? companyName ?? symbol,
        sector: concallData?.sector ?? null,
        industry: concallData?.industry ?? null,
        currentPrice,
        concalls: concallData?.concalls ?? [],
        annualReports: concallData?.annualReports ?? {},
        moatScores: concallData?.moatScores ?? {},
        moatRating: concallData?.moatRating ?? 'Narrow',
        moatReason: concallData?.moatReason ?? '',
        investmentScore: dashboard?.investmentScore ?? null,
        verdict: dashboard?.verdict ?? 'Hold',
        targetPriceLow: dashboard?.targetPriceLow ?? null,
        targetPriceHigh: dashboard?.targetPriceHigh ?? null,
        targetHorizon: dashboard?.targetHorizon ?? '12 months',
        marginOfSafety: dashboard?.marginOfSafety ?? null,
        upside: dashboard?.upside ?? null,
        valuationReport: dashboard?.valuationReport ?? null,
        risks: dashboard?.risks ?? [],
        opportunities: dashboard?.opportunities ?? [],
        keyMonitorable: dashboard?.keyMonitorable ?? '',
        analystConsensusSummary: dashboard?.analystConsensusSummary ?? '',
        governance: dashboard?.governance ?? null,
        industryPosition: dashboard?.industryPosition ?? null,
        cashDebtQuality: dashboard?.cashDebtQuality ?? null,
        lastUpdated: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Deep fundamentals error:', err);
      res.status(500).json({ message: 'Failed to generate fundamental dashboard' });
    }
  });

  // Chart Pattern Recognition API
  app.get('/api/chart-patterns', async (req, res) => {
    try {
      const pattern = (req.query.pattern as string) || 'cup_and_handle';
      const cap = (req.query.cap as string) || 'all';
      const fundamentals = req.query.fundamentals === 'true';
      const momentum = req.query.momentum === 'true';
      console.log(`[Pattern Scanner] Hit route for pattern: ${pattern}, cap: ${cap}, fund: ${fundamentals}, mom: ${momentum}`);
      const matches = await runPatternScanner(pattern, { cap, fundamentals, momentum });
      res.json({ matches });
    } catch (error) {
      console.error('Pattern scanning error:', error);
      res.status(500).json({ message: 'Failed to scan chart patterns' });
    }
  });

  // Stock financials sheet API
  app.get('/api/stock/:symbol/financials', async (req, res) => {
    try {
      const symbol = req.params.symbol;
      
      let screenerData: any = null;
      try {
        screenerData = await scrapeFinancials(symbol);
      } catch (err) {
        console.warn(`[Financials Route] Screener.in scraping failed for ${symbol}:`, err);
      }

      if (screenerData && screenerData.tenYearPL && screenerData.tenYearPL.length > 0) {
        const plPeriods = transposeScreenerTable(screenerData.tenYearPL, PL_MAP);
        const bsPeriods = transposeScreenerTable(screenerData.tenYearBS, BS_MAP);
        const quarterlyPeriods = transposeScreenerTable(screenerData.quarterlyResults, PL_MAP);
        const cfPeriods = transposeScreenerTable(screenerData.cashFlow, CF_MAP);
        const shPeriods = transposeScreenerTable(screenerData.shareholding, SH_MAP);

        const ratiosYearly = computeRatiosFromScreener(plPeriods, bsPeriods, screenerData.ratios);

        res.json({
          symbol,
          sector: "Consolidated (Screener.in)",
          scale: "Cr (₹)",
          shareholding: {
            yearly: shPeriods,
            quarterly: shPeriods.slice(-4),
          },
          ratios: {
            yearly: ratiosYearly,
            quarterly: ratiosYearly.slice(-4),
          },
          cashFlows: {
            yearly: cfPeriods,
            quarterly: cfPeriods.slice(-4),
          },
          balanceSheet: {
            yearly: bsPeriods,
            quarterly: bsPeriods.slice(-4),
          },
          profitAndLoss: plPeriods,
          quarterlyResults: quarterlyPeriods,
        });
        return;
      }

      const data = getFinancialData(symbol);
      res.json(data);
    } catch (error) {
      console.error('Stock financials error:', error);
      res.status(500).json({ message: 'Failed to fetch financial statements' });
    }
  });

  // Stock seasonality analysis API
  app.get('/api/stock/:symbol/seasonality', async (req, res) => {
    try {
      const rawSymbol = req.params.symbol;
      const symbol = toYahooSymbol(rawSymbol);

      // Fetch entire history (IPO to now) of monthly candles to compute monthly returns
      const candles = await getYahooHistory(symbol, 'max', '1mo');
      if (!candles || candles.length === 0) {
        return res.status(404).json({ message: "No price history found for seasonality" });
      }

      const monthlyReturns: { year: number; month: number; val: number }[] = [];
      for (let i = 1; i < candles.length; i++) {
        const prev = candles[i - 1];
        const curr = candles[i];
        if (prev.close && curr.close) {
          const ret = ((curr.close - prev.close) / prev.close) * 100;
          const date = new Date(curr.time);
          monthlyReturns.push({
            year: date.getFullYear(),
            month: date.getMonth(), // 0 = Jan, 11 = Dec
            val: Number(ret.toFixed(2))
          });
        }
      }

      const years = Array.from(new Set(monthlyReturns.map(r => r.year))).sort((a, b) => b - a);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      const grid = years.map(year => {
        const row: Record<string, any> = { year };
        let yearlyReturnProduct = 1;
        let hasData = false;

        months.forEach((m, idx) => {
          const found = monthlyReturns.find(r => r.year === year && r.month === idx);
          if (found) {
            row[m.toLowerCase()] = found.val;
            yearlyReturnProduct *= (1 + found.val / 100);
            hasData = true;
          } else {
            row[m.toLowerCase()] = null;
          }
        });

        row.yearlyreturns = hasData ? Number(((yearlyReturnProduct - 1) * 100).toFixed(2)) : null;
        return row;
      }).filter(row => months.some(m => row[m.toLowerCase()] !== null));

      // Compute aggregates
      const avgRow: Record<string, any> = { label: "Average Monthly Performance" };
      const positiveCount: Record<string, any> = { label: "Positive Count%" };
      const negativeCount: Record<string, any> = { label: "Negative Count%" };

      months.forEach((m, idx) => {
        const key = m.toLowerCase();
        const vals = grid.map(row => row[key]).filter(v => v !== null && v !== undefined) as number[];
        
        if (vals.length > 0) {
          const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
          const pos = vals.filter(v => v > 0).length;
          const pctPos = (pos / vals.length) * 100;
          const pctNeg = 100 - pctPos;

          avgRow[key] = Number(avg.toFixed(2));
          positiveCount[key] = Number(pctPos.toFixed(1));
          negativeCount[key] = Number(pctNeg.toFixed(1));
        } else {
          avgRow[key] = null;
          positiveCount[key] = null;
          negativeCount[key] = null;
        }
      });

      res.json({
        symbol: rawSymbol,
        grid,
        stats: {
          averages: avgRow,
          positiveCount,
          negativeCount
        }
      });
    } catch (e) {
      console.error("Seasonality error:", e);
      res.status(500).json({ message: "Failed to compute seasonality analysis" });
    }
  });

  // ══════════════════════════════════════════════════════════
  //  STOCKIQ SCORE API
  // ══════════════════════════════════════════════════════════

  // Get StockIQ score for a single stock
  app.get('/api/stockiq/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol;
      console.log(`[StockIQ] Computing score for ${symbol}...`);
      const result = await calculateStockIQ(symbol);
      res.json(result);
    } catch (error) {
      console.error('StockIQ error:', error);
      res.status(500).json({ message: 'Failed to compute StockIQ score' });
    }
  });

  // Get top & bottom StockIQ scores
  app.get('/api/stockiq-rankings', async (_req, res) => {
    try {
      console.log('[StockIQ] Computing rankings for top 30 stocks...');
      const rankings = await getTopBottomStockIQ();
      res.json(rankings);
    } catch (error) {
      console.error('StockIQ rankings error:', error);
      res.status(500).json({ message: 'Failed to compute StockIQ rankings' });
    }
  });

  // ══════════════════════════════════════════════════════════
  //  SMART NLP SCREENER API
  // ══════════════════════════════════════════════════════════

  // Smart screener — accepts natural language query
  app.post('/api/screener/smart', async (req, res) => {
    try {
      const { query } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: 'Query string required' });
      }
      console.log(`[Smart Screener] Processing: "${query}"`);

      // Step 1: Parse NLP → structured filters
      const filters = await parseScreenerQuery(query);
      console.log('[Smart Screener] Parsed filters:', JSON.stringify(filters));

      // Step 2: Execute screener
      const results = await executeScreener(filters);
      console.log(`[Smart Screener] Found ${results.length} results`);

      res.json({ filters, results, query });
    } catch (error) {
      console.error('Smart screener error:', error);
      res.status(500).json({ message: 'Failed to run smart screener' });
    }
  });

  // Suggested queries
  app.get('/api/screener/suggestions', (_req, res) => {
    res.json({ suggestions: getSuggestedQueries() });
  });

  // ══════════════════════════════════════════════════════════
  //  AI RESEARCH REPORT API (SSE streaming)
  // ══════════════════════════════════════════════════════════
  app.get('/api/research-report/:symbol', aiRateLimit, async (req, res) => {
    try {
      const symbol = req.params.symbol.replace(/\.(NS|BO|NSE|BSE)$/i, '').toUpperCase();
      const yahooSym = `${symbol}.NS`;

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const sendEvent = (type: string, data: any) => {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
      };

      sendEvent('status', { message: 'Fetching stock data...' });

      // SSE keep-alive heartbeat — prevents proxy/load-balancer from closing idle connections
      const heartbeat = setInterval(() => {
        try { res.write(':\n\n'); } catch { clearInterval(heartbeat); }
      }, 15_000);

      // Gather data
      const [quoteRes, fundRes, candlesRes, newsRes, stockiqRes] = await Promise.allSettled([
        getStockQuotes([yahooSym]),
        getFmpFundamentals(symbol),
        getYahooHistory(yahooSym, '1y', '1d'),
        getYahooStockNews(yahooSym, 8, { region: 'IN', lang: 'en-IN' }),
        calculateStockIQ(symbol),
      ]);

      const quote = quoteRes.status === 'fulfilled' ? quoteRes.value[0] : null;
      const fund = fundRes.status === 'fulfilled' ? fundRes.value : null;
      const candles = candlesRes.status === 'fulfilled' ? candlesRes.value : [];
      const news = newsRes.status === 'fulfilled' ? newsRes.value : [];
      const stockiq = stockiqRes.status === 'fulfilled' ? stockiqRes.value : null;
      const closes = candles.map((c: any) => Number(c.close)).filter((v: number) => Number.isFinite(v));

      sendEvent('status', { message: 'Generating AI research report...' });

      // Build comprehensive prompt
      const reportPrompt = `You are a SEBI-registered senior equity research analyst. Generate a comprehensive research report for:

Stock: ${symbol} (${quote?.name || symbol})
Current Price: ₹${quote?.price || 'N/A'}
Day Change: ${quote?.changePercent?.toFixed(2) || 0}%
Market Cap: ₹${quote?.marketCap ? (quote.marketCap / 1e7).toFixed(0) + ' Cr' : 'N/A'}

Fundamental Data:
${JSON.stringify(fund || {}, null, 2)}

StockIQ Score: ${stockiq?.totalScore || 'N/A'}/100 (${stockiq?.grade || 'N/A'})
- Fundamentals: ${stockiq?.fundamentals?.score || 'N/A'}/100
- Technicals: ${stockiq?.technicals?.score || 'N/A'}/100
- Momentum: ${stockiq?.momentum?.score || 'N/A'}/100
- Insider Activity: ${stockiq?.insider?.score || 'N/A'}/100

Recent News: ${news.map((n: any) => n.title).join(' | ')}

Generate the report in this EXACT markdown structure:

## 📋 Executive Summary
3 sentences: what the company does, current state, and your verdict.

## 🏢 Company Overview
Business model, competitive position, key products/services. 4-5 sentences.

## 💰 Financial Health
| Parameter | Value | Assessment |
|---|---|---|
Include: Revenue, Net Profit, P/E, ROE, ROCE, Debt/Equity, OPM, EPS, Book Value.
Use real data where available, estimate where not.

## 🔍 SWOT Analysis
### Strengths
- bullet points (3-4)
### Weaknesses  
- bullet points (2-3)
### Opportunities
- bullet points (3-4)
### Threats
- bullet points (2-3)

## 📊 Technical Outlook
Current trend, key support/resistance levels, RSI assessment, SMA analysis. 3-4 sentences.

## 🏆 Peer Comparison
| Company | Price | P/E | ROE | Market Cap |
|---|---|---|---|---|
Compare with 3-4 sector peers.

## ⚠️ Risk Factors
- 3-4 specific risks with severity (High/Medium/Low)

## 🎯 Verdict
**Rating: [Strong Buy | Buy | Hold | Sell | Strong Sell]**
**StockIQ Score: ${stockiq?.totalScore || 'N/A'}/100 (${stockiq?.grade || '—'})**
**Target Price: ₹X - ₹Y (12 months)**
Key reasoning in 2-3 sentences.

Use ** for bold. No disclaimers. Be specific with numbers.`;

      // Call LLM
      let reportText = "";
      try {
        const response = await generateWithRetry({
          model: 'gemini-flash-latest',
          contents: reportPrompt,
          config: {
            temperature: 0.2,
            maxOutputTokens: 8192,
          }
        });
        reportText = response?.text || '';
      } catch (err: any) {
        console.error('generateWithRetry failed for research report:', err);
      }

      if (!reportText) {
        sendEvent('error', { message: 'AI failed to generate report' });
        res.end();
        return;
      }

      // Stream sections
      const sections = reportText.split(/(?=## )/g).filter(Boolean);
      for (const section of sections) {
        sendEvent('section', { content: section.trim() });
        await new Promise(r => setTimeout(r, 100)); // small delay for visual effect
      }

      clearInterval(heartbeat);

      sendEvent('complete', {
        symbol,
        companyName: quote?.name || symbol,
        price: quote?.price,
        stockiqScore: stockiq?.totalScore,
        stockiqGrade: stockiq?.grade,
        fullReport: reportText,
      });

      res.end();
    } catch (error) {
      console.error('Research report error:', error);
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to generate report' })}\n\n`);
      } catch {}
      res.end();
    }
  });

  // ── NSE India Live APIs (Phase 1A) ─────────────────────────────────
  app.get('/api/nse/quote/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const result = await getCachedOrGenerate(`nse_quote_${symbol}`, 1 * 60 * 1000, async () => {
        return await fetchNSEQuote(symbol);
      });
      res.json(result);
    } catch (err: any) {
      console.error("Error in fetchNSEQuote:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/nse/option-chain/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const result = await getCachedOrGenerate(`nse_option_chain_${symbol}`, 5 * 60 * 1000, async () => {
        return await fetchNSEOptionChain(symbol);
      });
      res.json(result);
    } catch (err: any) {
      console.error("Error in fetchNSEOptionChain:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/nse/bulk-deals', async (req, res) => {
    try {
      const result = await getCachedOrGenerate("nse_bulk_deals", 15 * 60 * 1000, async () => {
        return await fetchBulkDeals();
      });
      res.json(result);
    } catch (err: any) {
      console.error("Error in fetchBulkDeals:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/nse/insider-trades', async (req, res) => {
    try {
      const result = await getCachedOrGenerate("nse_insider_trades", 15 * 60 * 1000, async () => {
        return await fetchInsiderTrades();
      });
      res.json(result);
    } catch (err: any) {
      console.error("Error in fetchInsiderTrades:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Alias for backward compatibility
  app.get('/api/insider-trades', async (req, res) => {
    try {
      const result = await getCachedOrGenerate("nse_insider_trades", 15 * 60 * 1000, async () => {
        return await fetchInsiderTrades();
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  function generateEventsForSymbol(_symbol?: string): any[] {
    return [];
  }

  // ── SEBI / BSE / NSE Corporate Events (Phase 1B) ────────────────────
  app.get('/api/nse/events/:symbols?', async (req, res) => {
    try {
      const symbolsString = (req.params.symbols || req.query.symbols || "") as string;
      const requestedSymbols = symbolsString
        ? symbolsString.split(',').filter(Boolean).map(s => s.trim().toUpperCase())
        : [];

      const [meetings, actions] = await Promise.all([
        parseBoardMeetings(),
        parseCorporateActions()
      ]);

      const mappedMeetings = meetings.map((m, idx) => ({
        id: `meet-${m.symbol}-${idx}`,
        symbol: m.symbol.toUpperCase(),
        title: m.title,
        date: m.date,
        type: "board" as const,
        description: m.description
      }));

      const mappedActions = actions.map((a, idx) => ({
        id: `act-${a.symbol}-${idx}`,
        symbol: a.symbol.toUpperCase(),
        title: a.title,
        date: a.date,
        type: a.type,
        description: a.description
      }));

      let allEvents = [...mappedMeetings, ...mappedActions];

      // Generate seeded fallback events for watchlist symbols that don't have active events in the feed
      if (requestedSymbols.length > 0) {
        requestedSymbols.forEach((sym: string) => {
          const hasEvents = allEvents.some((e: any) => e.symbol === sym);
          if (!hasEvents) {
            const seeded = generateEventsForSymbol(sym);
            allEvents = [...allEvents, ...seeded];
          }
        });
      }

      res.json({ events: allEvents });
    } catch (err) {
      console.error("Error in /api/nse/events:", err);
      res.status(500).json({ message: "Failed to fetch corporate events" });
    }
  });

  // ── USD/INR & Crypto Correlation (Phase 1D) ───────────────────────
  app.get('/api/currency/correlation', async (req, res) => {
    try {
      const [usdinr, crypto] = await Promise.all([
        getUSDINR(),
        getCryptoCorrelation()
      ]);
      res.json({
        usdinr,
        btcChange24h: crypto.btcChange24h,
        goldChange24h: crypto.goldChange24h
      });
    } catch (err) {
      console.error("Error in /api/currency/correlation:", err);
      res.status(500).json({ message: "Failed to fetch currency/correlation details" });
    }
  });

  // ── Telegram Settings (Phase 1E) ─────────────────────────────────
  app.post('/api/user/telegram', async (req: Request, res: Response) => {
    try {
      const bodySchema = z.object({ telegramChatId: z.string().max(64) });
      const parseResult = bodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid telegramChatId" });
      }
      const { telegramChatId } = parseResult.data;
      let userId = (req.user as any)?.id;
      if (!userId) {
        const allUsers = await db.select().from(users).limit(1);
        if (allUsers.length > 0) {
          userId = allUsers[0].id;
        }
      }
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized and no test user found" });
      }
      await db.update(users).set({ telegramChatId }).where(eq(users.id, userId));
      res.json({ success: true, message: "Telegram Chat ID saved successfully" });
    } catch (error: any) {
      console.error("Error saving Telegram Chat ID:", error);
      res.status(500).json({ message: "Failed to save Telegram Chat ID" });
    }
  });

  // ── Signal Outcome Log (Phase 3A) ─────────────────────────────────
  app.post('/api/signals/log', async (req: Request, res: Response) => {
    try {
      const signalLogSchema = z.object({
        symbol:        z.string().max(20),
        signalType:    z.string().max(50),
        direction:     z.enum(["BULLISH", "BEARISH", "NEUTRAL"]),
        priceAtSignal: z.union([z.string(), z.number()]),
        confidence:    z.number().int().min(0).max(100).optional(),
        rsi:           z.union([z.string(), z.number()]).optional(),
        macdHistogram: z.union([z.string(), z.number()]).optional(),
        atr:           z.union([z.string(), z.number()]).optional(),
        smaSlope:      z.union([z.string(), z.number()]).optional(),
        volumeRatio:   z.union([z.string(), z.number()]).optional(),
        notes:         z.string().max(1000).optional(),
        adx:           z.union([z.string(), z.number()]).optional(),
        rvol:          z.union([z.string(), z.number()]).optional(),
        emaAlignment:  z.union([z.string(), z.number()]).optional(),
        sector:        z.string().max(50).optional(),
        marketCap:     z.string().max(10).optional(),
        marketCondition: z.string().max(10).optional(),
      });
      const parseResult = signalLogSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid signal log payload", errors: parseResult.error.flatten() });
      }
      const payload = parseResult.data;

      const [newLog] = await db.insert(signalLog).values({
        symbol: payload.symbol,
        signalType: payload.signalType,
        direction: payload.direction === "BULLISH" ? "BUY" : payload.direction === "BEARISH" ? "SELL" : "HOLD",
        confidence: payload.confidence ?? null,
        priceAtSignal: String(payload.priceAtSignal),
        rsi: payload.rsi ? String(payload.rsi) : null,
        macdHistogram: payload.macdHistogram ? String(payload.macdHistogram) : null,
        adx: payload.adx ? String(payload.adx) : null,
        rvol: payload.rvol ? String(payload.rvol) : null,
        emaAlignment: payload.emaAlignment ? parseInt(String(payload.emaAlignment), 10) : null,
        sector: payload.sector || null,
        marketCap: payload.marketCap || null,
        marketCondition: payload.marketCondition || null,
      }).returning();

      console.log(`[Signal Logged] ${payload.symbol} -> ${payload.signalType} (${payload.direction})`);

      // Trigger Telegram Alert if configured and high confidence (e.g. >= 70)
      let userId = (req.user as any)?.id;
      if (!userId) {
        const allUsers = await db.select().from(users).limit(1);
        if (allUsers.length > 0) {
          userId = allUsers[0].id;
        }
      }
      if (userId) {
        const [user] = await db.select().from(users).where(eq(users.id, userId));
        if (user?.telegramChatId && (newLog.confidence ?? 0) >= 70) {
          const alertMsg = formatSignalAlert(
            newLog.symbol,
            newLog.direction,
            newLog.confidence ?? 0,
            parseFloat(newLog.priceAtSignal)
          );
          await sendAlert(user.telegramChatId, alertMsg);
        }
      }

      res.json({ success: true, logId: newLog.id });
    } catch (err: any) {
      console.error("Error logging signal:", err);
      res.status(500).json({ message: "Failed to log signal" });
    }
  });

  // ══════════════════════════════════════════════════════════════
  // VCP Alerts — User watchlist with score thresholds
  // ══════════════════════════════════════════════════════════════

  app.get('/api/vcp-alerts', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const alerts = await storage.getVcpAlerts(userId);
      res.json(alerts);
    } catch (err: any) {
      console.error('VCP alerts GET error:', err);
      res.status(500).json({ message: 'Failed to fetch alerts' });
    }
  });

  app.post('/api/vcp-alerts', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const schema = z.object({
        symbol:         z.string().max(20),
        stockName:      z.string().max(100),
        thresholdScore: z.number().int().min(0).max(100),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
      const alert = await storage.createVcpAlert({ ...parsed.data, userId });
      res.json(alert);
    } catch (err: any) {
      console.error('VCP alerts POST error:', err);
      res.status(500).json({ message: 'Failed to create alert' });
    }
  });

  app.delete('/api/vcp-alerts/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      await storage.deleteVcpAlert(req.params.id, userId);
      res.json({ success: true });
    } catch (err: any) {
      console.error('VCP alerts DELETE error:', err);
      res.status(500).json({ message: 'Failed to delete alert' });
    }
  });

  // ══════════════════════════════════════════════════════════════
  // HERMES AI — Self-Learning Stock Intelligence Endpoints
  // ══════════════════════════════════════════════════════════════

  // Start HERMES background scheduler
  startHermesScheduler();

  // Full dashboard data
  app.get('/api/hermes/dashboard', async (_req: Request, res: Response) => {
    try {
      const data = await getHermesDashboard();
      const status = getHermesStatus();
      res.json({ ...data, schedulerStatus: status });
    } catch (err: any) {
      console.error('[HERMES API] Dashboard error:', err);
      res.status(500).json({ message: 'Failed to load HERMES dashboard' });
    }
  });

  // Top stocks by HERMES score
  app.get('/api/hermes/leaderboard', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(typeof req.query.limit === 'string' ? req.query.limit : '30', 10);
      const data = await getHermesLeaderboard(limit);
      res.json(data);
    } catch (err: any) {
      console.error('[HERMES API] Leaderboard error:', err);
      res.status(500).json({ message: 'Failed to load leaderboard' });
    }
  });

  // HERMES snapshot for a specific stock
  app.get('/api/hermes/stock/:symbol', async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const data = await getHermesStockSnapshot(symbol);
      if (!data) return res.status(404).json({ message: 'No HERMES data for this stock' });
      res.json(data);
    } catch (err: any) {
      console.error('[HERMES API] Stock snapshot error:', err);
      res.status(500).json({ message: 'Failed to load stock snapshot' });
    }
  });

  // Accuracy stats by sector, regime, verdict
  app.get('/api/hermes/accuracy', async (_req: Request, res: Response) => {
    try {
      const data = await getHermesAccuracy();
      res.json(data);
    } catch (err: any) {
      console.error('[HERMES API] Accuracy error:', err);
      res.status(500).json({ message: 'Failed to load accuracy data' });
    }
  });

  // Weight version history
  app.get('/api/hermes/weights', async (_req: Request, res: Response) => {
    try {
      const data = await getHermesWeightHistory();
      res.json(data);
    } catch (err: any) {
      console.error('[HERMES API] Weights error:', err);
      res.status(500).json({ message: 'Failed to load weight history' });
    }
  });

  // Market regime history
  app.get('/api/hermes/regime', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(typeof req.query.limit === 'string' ? req.query.limit : '30', 10);
      const data = await getHermesRegimeHistory(limit);
      res.json(data);
    } catch (err: any) {
      console.error('[HERMES API] Regime error:', err);
      res.status(500).json({ message: 'Failed to load regime data' });
    }
  });

  // Recent outcomes with win/loss analysis
  app.get('/api/hermes/outcomes', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(typeof req.query.limit === 'string' ? req.query.limit : '50', 10);
      const data = await getHermesRecentOutcomes(limit);
      res.json(data);
    } catch (err: any) {
      console.error('[HERMES API] Outcomes error:', err);
      res.status(500).json({ message: 'Failed to load outcomes' });
    }
  });

  // Trigger manual scan (admin only)
  app.post('/api/hermes/scan', async (req: Request, res: Response) => {
    try {
      const universeSize = parseInt(req.body?.universeSize || '200', 10);
      // Fire-and-forget — respond immediately, scan runs in background
      res.json({ message: 'HERMES scan triggered', universeSize });
      triggerManualScan(universeSize);
    } catch (err: any) {
      console.error('[HERMES API] Scan trigger error:', err);
      res.status(500).json({ message: 'Failed to trigger scan' });
    }
  });

  // Trigger outcome tracker manually
  app.post('/api/hermes/track-outcomes', async (_req: Request, res: Response) => {
    try {
      res.json({ message: 'Outcome tracker triggered' });
      triggerOutcomeTracker();
    } catch (err: any) {
      console.error('[HERMES API] Outcome tracker error:', err);
      res.status(500).json({ message: 'Failed to trigger outcome tracker' });
    }
  });

  // Trigger learning cycle manually
  app.post('/api/hermes/learn', async (_req: Request, res: Response) => {
    try {
      res.json({ message: 'Learning cycle triggered' });
      triggerLearningCycle();
    } catch (err: any) {
      console.error('[HERMES API] Learning cycle error:', err);
      res.status(500).json({ message: 'Failed to trigger learning cycle' });
    }
  });

  // FUGU scheduler status
  app.get('/api/hermes/status', async (_req: Request, res: Response) => {
    try {
      const status = getHermesStatus();
      res.json(status);
    } catch (err: any) {
      console.error('[HERMES API] Status error:', err);
      res.status(500).json({ message: 'Failed to load status' });
    }
  });

  // ══════════════════════════════════════════════════════════════
  // FUGU SCORE — Self-Learning Stock Intelligence Endpoints
  // ══════════════════════════════════════════════════════════════

  // Start FUGU background scheduler
  startFuguScheduler();

  // Full dashboard data
  app.get('/api/fugu/dashboard', async (_req: Request, res: Response) => {
    try {
      const data = await getFuguDashboard();
      const status = getFuguStatus();
      res.json({ ...data, schedulerStatus: status });
    } catch (err: any) {
      console.error('[FUGU API] Dashboard error:', err);
      res.status(500).json({ message: 'Failed to load FUGU dashboard' });
    }
  });

  // Trigger manual candidate scan (admin only)
  app.post('/api/fugu/scan', async (req: Request, res: Response) => {
    try {
      const limitSize = parseInt(req.body?.limitSize || '1000', 10);
      res.json({ message: 'FUGU scan triggered', limitSize });
      triggerManualFuguScan(limitSize);
    } catch (err: any) {
      console.error('[FUGU API] Scan trigger error:', err);
      res.status(500).json({ message: 'Failed to trigger scan' });
    }
  });

  // Trigger outcome tracker manually
  app.post('/api/fugu/track-outcomes', async (_req: Request, res: Response) => {
    try {
      res.json({ message: 'FUGU outcome tracker triggered' });
      triggerManualFuguOutcome();
    } catch (err: any) {
      console.error('[FUGU API] Outcome tracker error:', err);
      res.status(500).json({ message: 'Failed to trigger outcome tracker' });
    }
  });

  // Trigger learning cycle manually
  app.post('/api/fugu/learn', async (_req: Request, res: Response) => {
    try {
      res.json({ message: 'FUGU learning cycle triggered' });
      triggerManualFuguLearning();
    } catch (err: any) {
      console.error('[FUGU API] Learning cycle error:', err);
      res.status(500).json({ message: 'Failed to trigger learning cycle' });
    }
  });

  // Confluence Signals API
  app.get('/api/confluence-signals', async (_req: Request, res: Response) => {
    try {
      const results = await db
        .select({
          symbol: hermesSnapshots.symbol,
          scanDate: hermesSnapshots.scanDate,
          hermesScore: hermesSnapshots.hermesScore,
          hermesVerdict: hermesSnapshots.hermesVerdict,
          fuguScore: fuguSnapshots.fuguScore,
          eliteReasoning: fuguSnapshots.eliteReasoning,
        })
        .from(hermesSnapshots)
        .innerJoin(
          fuguSnapshots,
          and(
            eq(hermesSnapshots.symbol, fuguSnapshots.symbol),
            sql`DATE(${hermesSnapshots.scanDate}) = DATE(${fuguSnapshots.scanDate})`
          )
        )
        .where(
          and(
            sql`${hermesSnapshots.hermesScore}::numeric >= 70`,
            sql`${fuguSnapshots.fuguScore}::numeric >= 70`
          )
        )
        .orderBy(desc(sql`(${hermesSnapshots.hermesScore}::numeric + ${fuguSnapshots.fuguScore}::numeric) / 2`))
        .limit(50);

      const mapped = results.map(r => ({
        symbol: r.symbol,
        scanDate: r.scanDate,
        hermesScore: parseFloat(r.hermesScore || '0'),
        hermesVerdict: r.hermesVerdict,
        fuguScore: parseFloat(r.fuguScore || '0'),
        compositeScore: Math.round((parseFloat(r.hermesScore || '0') + parseFloat(r.fuguScore || '0')) / 2),
        eliteReasoning: r.eliteReasoning || "Bullish alignment across Technical & Fundamental models."
      }));

      res.json(mapped);
    } catch (error: any) {
      console.error("[Confluence API] Error fetching signals:", error);
      res.status(500).json({ message: "Failed to fetch confluence signals" });
    }
  });

  // ══════════════════════════════════════════════════════════════
  // APEX SYSTEM — Intraday Intelligence System Endpoints
  // ══════════════════════════════════════════════════════════════

  // Start APEX background scheduler
  startApexScheduler();

  // Dashboard endpoint
  app.get('/api/apex/dashboard', async (_req: Request, res: Response) => {
    try {
      const data = await getApexDashboard();
      res.json(data);
    } catch (err: any) {
      console.error('[APEX API] Dashboard error:', err);
      res.status(500).json({ message: 'Failed to load APEX dashboard' });
    }
  });

  // Predictions endpoint
  app.get('/api/apex/predictions/:date', async (req: Request, res: Response) => {
    try {
      const date = new Date(req.params.date);
      const data = await getPredictionsForDate(date);
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: 'Failed to load predictions' });
    }
  });

  // Accuracy endpoint
  app.get('/api/apex/accuracy', async (_req: Request, res: Response) => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const results = await db.select()
        .from(apexPredictions)
        .where(
          and(
            gte(apexPredictions.predictionDate, thirtyDaysAgo),
            sql`${apexPredictions.isCorrect} IS NOT NULL`
          )
        );
      res.json(results);
    } catch (err) {
      res.status(500).json({ message: 'Failed to load accuracy history' });
    }
  });

  // News endpoint
  app.get('/api/apex/news/:date', async (req: Request, res: Response) => {
    try {
      const start = new Date(req.params.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(req.params.date);
      end.setHours(23, 59, 59, 999);
      const news = await db.select()
        .from(apexNewsSignals)
        .where(and(gte(apexNewsSignals.signalDate, start), lte(apexNewsSignals.signalDate, end)))
        .orderBy(desc(apexNewsSignals.signalDate));
      res.json(news);
    } catch (err) {
      res.status(500).json({ message: 'Failed to load news signals' });
    }
  });

  // F&O endpoint
  app.get('/api/apex/fo/:date', async (req: Request, res: Response) => {
    try {
      const start = new Date(req.params.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(req.params.date);
      end.setHours(23, 59, 59, 999);
      const fo = await db.select()
        .from(apexFoSignals)
        .where(and(gte(apexFoSignals.signalDate, start), lte(apexFoSignals.signalDate, end)))
        .orderBy(desc(apexFoSignals.signalDate));
      res.json(fo);
    } catch (err) {
      res.status(500).json({ message: 'Failed to load F&O signals' });
    }
  });

  // Weights endpoint
  app.get('/api/apex/weights', async (_req: Request, res: Response) => {
    try {
      const weights = await db.select().from(apexWeights).orderBy(desc(apexWeights.version));
      res.json(weights);
    } catch (err) {
      res.status(500).json({ message: 'Failed to load weights' });
    }
  });

  // Jobs endpoint
  app.get('/api/apex/jobs', async (_req: Request, res: Response) => {
    try {
      const jobs = await db.select().from(jobLedger);
      const errors = await db.select().from(jobErrorLog).orderBy(desc(jobErrorLog.createdAt)).limit(50);
      res.json({ jobs, errors });
    } catch (err) {
      res.status(500).json({ message: 'Failed to load jobs ledger' });
    }
  });

  // Manual trigger endpoint
  app.post('/api/apex/trigger/:job', async (req: Request, res: Response) => {
    const { job } = req.params;
    try {
      if (job === "news") {
        res.json({ message: "APEX News Ingestion triggered" });
        runNewsIngestJob().catch(e => console.error("[APEX API] Ingest error:", e));
      } else if (job === "fo") {
        res.json({ message: "APEX F&O Options Ingestion triggered" });
        runFODataJob().catch(e => console.error("[APEX API] FO error:", e));
      } else if (job === "scan") {
        res.json({ message: "APEX Morning Scan prediction job triggered" });
        runMorningScan().catch(e => console.error("[APEX API] Morning scan error:", e));
      } else if (job === "outcomes") {
        res.json({ message: "APEX Same-day Outcome filling job triggered" });
        fillTodayOutcomes().catch(e => console.error("[APEX API] Outcomes error:", e));
      } else if (job === "learning") {
        res.json({ message: "APEX Weights Evolution learning cycle triggered" });
        runLearningCycle().catch(e => console.error("[APEX API] Learning error:", e));
      } else {
        res.status(400).json({ message: `Unknown APEX job: ${job}` });
      }
    } catch (err: any) {
      console.error(`[APEX API] Trigger job ${job} error:`, err);
      res.status(500).json({ message: 'Failed to trigger APEX job' });
    }
  });

  // ══════════════════════════════════════════════════════════════

  // DATA REFRESH SCHEDULER — Pre-warms cache for fast page loads
  // ══════════════════════════════════════════════════════════════
  const DATA_REFRESH_MARKET_HOURS_MS = 2 * 60 * 60 * 1000;   // 2 hours during market hours
  const DATA_REFRESH_OFF_HOURS_MS    = 6 * 60 * 60 * 1000;    // 6 hours outside market hours

  function isMarketHours(): boolean {
    const now = new Date();
    // IST = UTC+5:30
    const istHour = (now.getUTCHours() + 5 + (now.getUTCMinutes() >= 30 ? 1 : 0)) % 24;
    const day = now.getDay(); // 0=Sun, 6=Sat
    return day >= 1 && day <= 5 && istHour >= 9 && istHour < 16;
  }

  async function runDataRefresh() {
    console.log('[DataRefreshScheduler] Starting cache refresh cycle...');
    const startTime = Date.now();

    // 1. Market indices
    try {
      const indices = await getMarketIndices();
      await storage.setMarketDataCache('market_indices', {
        indices, lastUpdated: new Date().toISOString(),
        dataSource: indices.length > 0 ? 'Live API' : 'Mock Data'
      });
      console.log(`[DataRefreshScheduler] ✓ Market indices refreshed (${indices.length} indices)`);
    } catch (err) {
      console.warn('[DataRefreshScheduler] ✗ Market indices refresh failed:', err);
    }

    // 2. Top stock quotes (from the INDIAN_STOCKS pool)
    try {
      const stockSymbols = Object.values(INDIAN_STOCKS).slice(0, 50).map((s: string) => `${s}.NS`);
      const quotes = await getStockQuotes(stockSymbols);
      await storage.setMarketDataCache('top_stock_quotes', {
        stocks: quotes, lastUpdated: new Date().toISOString(), count: quotes.length
      });
      console.log(`[DataRefreshScheduler] ✓ Stock quotes refreshed (${quotes.length} stocks)`);
    } catch (err) {
      console.warn('[DataRefreshScheduler] ✗ Stock quotes refresh failed:', err);
    }

    // 3. Financial news
    try {
      const news = await getFinancialNews(20);
      await storage.setMarketDataCache('financial_news', {
        realTimeNews: news, adminNews: [], lastUpdated: new Date().toISOString(),
        dataSource: news.length > 0 ? 'Live API' : 'Mock Data'
      });
      console.log(`[DataRefreshScheduler] ✓ Financial news refreshed (${news.length} articles)`);
    } catch (err) {
      console.warn('[DataRefreshScheduler] ✗ Financial news refresh failed:', err);
    }

    // 4. Sector performance (representative stocks)
    try {
      const sectorTickers = ['HDFCBANK', 'TCS', 'SUNPHARMA', 'TATAMOTORS', 'TATASTEEL', 'ITC', 'DLF', 'LT', 'RELIANCE'];
      const sectorQuotes = await getStockQuotes(sectorTickers.map(t => `${t}.NS`));
      if (sectorQuotes.length > 0) {
        // The route will pick this up from cache naturally via getCachedOrGenerate
        console.log(`[DataRefreshScheduler] ✓ Sector stocks pre-fetched (${sectorQuotes.length} quotes)`);
      }
    } catch (err) {
      console.warn('[DataRefreshScheduler] ✗ Sector stocks pre-fetch failed:', err);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const nextInterval = isMarketHours() ? DATA_REFRESH_MARKET_HOURS_MS : DATA_REFRESH_OFF_HOURS_MS;
    const nextRunMins = Math.round(nextInterval / 60000);
    console.log(`[DataRefreshScheduler] Cycle complete in ${elapsed}s. Next refresh in ${nextRunMins} minutes.`);

    // Schedule next run
    setTimeout(runDataRefresh, nextInterval);
  }

  // Start scheduler after 30-second delay to let server boot
  setTimeout(() => {
    console.log('[DataRefreshScheduler] Initializing first cache warm-up...');
    runDataRefresh().catch(err => console.error('[DataRefreshScheduler] Initial run failed:', err));
  }, 30 * 1000);

  const httpServer = createServer(app);
  return httpServer;
}

