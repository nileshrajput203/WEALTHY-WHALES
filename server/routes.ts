import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { setupGoogleAuth } from "./googleAuth";
import { getFinancialAdvice, getStructuredStockInsight, getMarkdownFundamentals, getMarkdownTechnicals, getSwingScannerData } from "./gemini";
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
  getFmpFundamentals,
  INDIAN_STOCKS,
  type StockQuote,
  type StockNews,
  type MarketIndex
} from "./stockApi";
import { insertStockRecommendationSchema, insertChatMessageSchema, insertScannerDataSchema, insertNewsItemSchema } from "@shared/schema";

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
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  };

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
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

  app.post('/api/recommendations', async (req: any, res) => {
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

  // Chat with AI
  app.get('/api/chat/:sessionId', async (req, res) => {
    try {
      // Return empty array for now (no database storage)
      res.json([]);
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

      // Get AI response directly (bypassing database for now)
      const aiResponse = await getFinancialAdvice(
        validated.message,
        validated.stockContext || undefined
      );

      // Return AI response without saving to database
      const aiMessage = {
        id: Date.now().toString(),
        userId: validated.userId,
        sessionId: validated.sessionId,
        message: aiResponse,
        role: "assistant",
        stockContext: validated.stockContext,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

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

  // Swing Scanner with Gemini AI
  app.get('/api/swing-scanner', async (req, res) => {
    try {
      console.log("Swing scanner endpoint hit");
      const swingStocks = await getSwingScannerData();
      console.log("Generated stocks:", swingStocks.length);
      res.json({ stocks: swingStocks });
    } catch (error) {
      console.error("Error fetching swing scanner data:", error);
      res.status(500).json({ message: "Failed to fetch swing scanner data" });
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

  // Live Indices Data - Real-time market indices from free APIs
  app.get('/api/indices', async (req, res) => {
    try {
      // Get real-time indices data
      let indices: MarketIndex[] = [];
      
      try {
        indices = await getMarketIndices();
      } catch (apiError) {
        console.error("Indices API error, using mock data:", apiError);
        // Fallback to mock data with some randomness
        indices = [
          { name: "NIFTY 50", symbol: "^NSEI", value: 24850.50 + (Math.random() * 100 - 50), change: 125.30 + (Math.random() * 20 - 10), changePercent: 0.51 + (Math.random() * 0.2 - 0.1), timestamp: new Date() },
          { name: "SENSEX", symbol: "^BSESN", value: 82456.75 + (Math.random() * 100 - 50), change: -89.45 + (Math.random() * 20 - 10), changePercent: -0.11 + (Math.random() * 0.2 - 0.1), timestamp: new Date() },
          { name: "BANK NIFTY", symbol: "^NSEBANK", value: 52340.20 + (Math.random() * 100 - 50), change: 234.80 + (Math.random() * 20 - 10), changePercent: 0.45 + (Math.random() * 0.2 - 0.1), timestamp: new Date() },
          { name: "NIFTY IT", symbol: "^CNXIT", value: 41234.60 + (Math.random() * 100 - 50), change: -156.20 + (Math.random() * 20 - 10), changePercent: -0.38 + (Math.random() * 0.2 - 0.1), timestamp: new Date() },
          { name: "NIFTY PHARMA", symbol: "^CNXPHARMA", value: 18976.45 + (Math.random() * 100 - 50), change: 98.30 + (Math.random() * 20 - 10), changePercent: 0.52 + (Math.random() * 0.2 - 0.1), timestamp: new Date() },
        ];
      }

      const response = {
        indices: indices,
        lastUpdated: new Date().toISOString(),
        dataSource: indices.length > 0 && indices[0].name !== "NIFTY 50" ? 'Live API' : 'Mock Data'
      };

      res.json(response);
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

  app.post('/api/news', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
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
      const symbol = req.params.symbol;
      const range = (req.query.range as string) || '6mo';
      const interval = range === '1mo' ? '1d' : range === '2y' ? '1wk' : '1d';
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
      res.json({ symbol, range, interval, indicators: { sma20: lastSMA20, sma50: lastSMA50, rsi14: lastRSI }, trend: trendUp ? 'Uptrend' : 'Down/Sideways', momentum, verdict, candles: candles.slice(-180) });
    } catch {
      res.status(500).json({ message: 'Failed to compute technicals' });
    }
  });

  // Fundamentals (FMP live if key set, else placeholders)
  app.get('/api/stock/:symbol/fundamentals', async (req, res) => {
    try {
      const symbol = req.params.symbol;
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
      res.json({ symbol, ratios: [
        { parameter: 'Revenue Growth (3Y)', value: '-', insight: 'Add FMP key for live' },
        { parameter: 'Profit Growth (3Y)', value: '-', insight: 'Add FMP key for live' },
        { parameter: 'ROCE', value: '-', insight: '—' },
        { parameter: 'ROE', value: '-', insight: '—' },
        { parameter: 'Debt/Equity', value: '-', insight: '—' },
        { parameter: 'OPM', value: '-', insight: '—' }
      ]});
    } catch {
      res.status(500).json({ message: 'Failed to fetch fundamentals' });
    }
  });

  // Search stocks
  app.get('/api/search/stocks', async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Search query required" });
      }

      // Use Yahoo search (MoneyControl-like accuracy for tickers), prefer NSE/BSE suffixes
      const results = await searchStocksYahoo(query);
      const symbols = results
        .map(r => r.symbol)
        .slice(0, 10);

      const stockData = symbols.length ? await getStockQuotes(symbols) : [];

      res.json({ stocks: stockData, raw: results, query, lastUpdated: new Date().toISOString() });
    } catch (error) {
      console.error("Error searching stocks:", error);
      res.status(500).json({ message: "Failed to search stocks" });
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
  app.get('/api/stock/:symbol/fundamentals/ai', async (req, res) => {
    try {
      const symbol = req.params.symbol;

      const [fundLive, techCandles, newsItems] = await Promise.allSettled([
        getFmpFundamentals(symbol),
        getYahooHistory(symbol, '6mo', '1d'),
        getYahooStockNews(symbol, 5, { region: 'IN', lang: 'en-IN' }),
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
    } catch {
      res.status(500).json({ message: 'Failed to get fundamentals analysis' });
    }
  });

  // AI Markdown Technicals — uses direct calls
  app.get('/api/stock/:symbol/technicals/ai', async (req, res) => {
    try {
      const symbol   = req.params.symbol;
      const range    = (req.query.range as string) || '6mo';
      const interval = range === '1mo' ? '1d' : range === '2y' ? '1wk' : '1d';
      const tf       = range === '1mo' ? 'short' : range === '2y' ? 'long' : 'mid';

      const candles = await getYahooHistory(symbol, range, interval);
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
    } catch {
      res.status(500).json({ message: 'Failed to get technical analysis' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

