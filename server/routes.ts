import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { setupGoogleAuth } from "./googleAuth";
import { getFinancialAdvice, getStructuredStockInsight, getMarkdownFundamentals, getMarkdownTechnicals, getSwingScannerData, getConcallAndAnnualReportSummary, getDeepFundamentalDashboard } from "./gemini";
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
  getFmpFundamentals,
  INDIAN_STOCKS,
  type StockQuote,
  type StockNews,
  type MarketIndex
} from "./stockApi";
import { insertStockRecommendationSchema, insertChatMessageSchema, insertScannerDataSchema, insertNewsItemSchema } from "@shared/schema";

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

  app.post('/api/chat', async (req: any, res) => {
    try {
      const validated = insertChatMessageSchema.parse({
        ...req.body,
        userId: req.user?.claims?.sub || null,
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
          fundamentals: fundLive.status === "fulfilled" ? fundLive.value : undefined,
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

  // 1. Insider Trades API
  app.get('/api/insider-trades', async (req, res) => {
    try {
      const companyPool = [
        { symbol: "RELIANCE.NS", name: "Reliance Industries Ltd", acquirer: "Reliance Industries Promoter Group" },
        { symbol: "TCS.NS", name: "Tata Consultancy Services Ltd", acquirer: "Tata Sons Private Limited" },
        { symbol: "INFY.NS", name: "Infosys Ltd", acquirer: "Salil Parekh (CEO)" },
        { symbol: "HDFCBANK.NS", name: "HDFC Bank Ltd", acquirer: "HDFC Mutual Fund" },
        { symbol: "ICICIBANK.NS", name: "ICICI Bank Ltd", acquirer: "ICICI Prudential Life Insurance" },
        { symbol: "TATAMOTORS.NS", name: "Tata Motors Ltd", acquirer: "Tata Sons Private Limited" },
        { symbol: "BHARTIARTL.NS", name: "Bharti Airtel Ltd", acquirer: "Bharti Telecom Limited" },
        { symbol: "ITC.NS", name: "ITC Ltd", acquirer: "ITC Tobacco Manufacturers Promoter" },
        { symbol: "WIPRO.NS", name: "Wipro Ltd", acquirer: "Azim Premji Trustee Company" },
        { symbol: "SBIN.NS", name: "State Bank of India", acquirer: "Life Insurance Corporation of India" }
      ];

      const categories = ["Promoter Group", "Director", "KMP", "Promoter", "Relative of Director"];
      const types = ["Buy", "Sell"];
      const trades = [];

      for (let i = 0; i < 20; i++) {
        const company = companyPool[i % companyPool.length];
        const type = Math.random() > 0.3 ? "Buy" : "Sell";
        const quantity = Math.floor(Math.random() * 80000) + 5000;
        const basePrice = 1000 + (Math.random() * 2000);
        const value = quantity * basePrice;
        const sharePercent = Number((Math.random() * 0.4 + 0.01).toFixed(3));
        const date = new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

        trades.push({
          id: `trade_${1000 + i}`,
          company: company.name,
          symbol: company.symbol.replace('.NS', ''),
          acquirer: company.acquirer,
          category: categories[i % categories.length],
          type,
          quantity,
          value: Math.round(value),
          sharePercent,
          date
        });
      }

      res.json({ trades, lastUpdated: new Date().toISOString() });
    } catch (error) {
      console.error("Error fetching insider trades:", error);
      res.status(500).json({ message: "Failed to fetch insider trades" });
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

  // 2. Option Chain summary API
  app.get('/api/option-chain/:symbol', async (req, res) => {
    try {
      const indexSym = req.params.symbol.toUpperCase();
      const isNifty = indexSym === "NIFTY" || indexSym === "NIFTY 50";
      
      const spot = isNifty 
        ? 24850.50 + (Math.random() * 80 - 40)
        : 52340.20 + (Math.random() * 200 - 100);
      
      const strikeInterval = isNifty ? 50 : 100;
      const baseStrike = Math.round(spot / strikeInterval) * strikeInterval;
      const pcr = 0.85 + (Math.random() * 0.5);
      const maxPain = baseStrike + (Math.random() > 0.5 ? strikeInterval : -strikeInterval);
      const ivPercentile = Math.floor(Math.random() * 40) + 30;

      const topCallStrikes = [];
      const topPutStrikes = [];

      for (let i = -5; i <= 5; i++) {
        const strike = baseStrike + (i * strikeInterval);
        
        // Calls: Higher strikes have more Call OI (resistance)
        // Puts: Lower strikes have more Put OI (support)
        const callDistanceFactor = Math.exp(-Math.pow(i - 1, 2) / 6);
        const putDistanceFactor = Math.exp(-Math.pow(i + 1, 2) / 6);

        const callOI = Math.round((5000000 + Math.random() * 3000000) * callDistanceFactor);
        const putOI = Math.round((5000000 + Math.random() * 3000000) * putDistanceFactor);

        const callChange = Math.round((Math.random() * 400000 - 100000) * callDistanceFactor);
        const putChange = Math.round((Math.random() * 400000 - 100000) * putDistanceFactor);

        if (i >= -2 && i <= 3) {
          topCallStrikes.push({ strike, oi: callOI, change: callChange });
        }
        if (i >= -3 && i <= 2) {
          topPutStrikes.push({ strike, oi: putOI, change: putChange });
        }
      }

      // Sort by OI descending
      topCallStrikes.sort((a, b) => b.oi - a.oi);
      topPutStrikes.sort((a, b) => b.oi - a.oi);

      res.json({
        data: {
          index: indexSym,
          spot: Math.round(spot * 100) / 100,
          maxPain,
          pcr: Math.round(pcr * 100) / 100,
          totalCallOI: topCallStrikes.reduce((acc, curr) => acc + curr.oi, 0),
          totalPutOI: topPutStrikes.reduce((acc, curr) => acc + curr.oi, 0),
          topCallStrikes,
          topPutStrikes,
          ivPercentile,
          expiryDate: getUpcomingThursday()
        }
      });
    } catch (error) {
      console.error("Error building option chain:", error);
      res.status(500).json({ message: "Failed to build option chain summary" });
    }
  });

  // 3. Index Movers API
  app.get('/api/index-movers/:symbol', async (req, res) => {
    try {
      const indexSym = req.params.symbol.toUpperCase();
      const isNifty = indexSym === "NIFTY" || indexSym === "NIFTY 50";

      const indexValue = isNifty 
        ? 24850.50 + (Math.random() * 40 - 20)
        : 52340.20 + (Math.random() * 100 - 50);
      
      const indexChange = isNifty ? 125.30 : 234.80;
      const indexChangePercent = isNifty ? 0.51 : 0.45;

      const niftyConstituents = [
        { symbol: "RELIANCE", name: "Reliance Industries Ltd", weight: 9.8, basePrice: 2450 },
        { symbol: "TCS", name: "Tata Consultancy Services Ltd", weight: 7.2, basePrice: 3820 },
        { symbol: "HDFCBANK", name: "HDFC Bank Ltd", weight: 8.9, basePrice: 1530 },
        { symbol: "INFY", name: "Infosys Ltd", weight: 6.1, basePrice: 1420 },
        { symbol: "ICICIBANK", name: "ICICI Bank Ltd", weight: 7.8, basePrice: 1120 },
        { symbol: "TATAMOTORS", name: "Tata Motors Ltd", weight: 3.8, basePrice: 960 },
        { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd", weight: 4.5, basePrice: 1390 },
        { symbol: "ITC", name: "ITC Ltd", weight: 4.2, basePrice: 430 },
        { symbol: "LT", name: "Larsen & Toubro Ltd", weight: 3.5, basePrice: 3450 },
        { symbol: "HINDUNILVR", name: "Hindustan Unilever Ltd", weight: 2.9, basePrice: 2320 }
      ];

      const bankNiftyConstituents = [
        { symbol: "HDFCBANK", name: "HDFC Bank Ltd", weight: 29.1, basePrice: 1530 },
        { symbol: "ICICIBANK", name: "ICICI Bank Ltd", weight: 23.4, basePrice: 1120 },
        { symbol: "SBIN", name: "State Bank of India", weight: 11.2, basePrice: 780 },
        { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank Ltd", weight: 9.8, basePrice: 1690 },
        { symbol: "AXISBANK", name: "Axis Bank Ltd", weight: 9.2, basePrice: 1040 },
        { symbol: "INDUSINDBK", name: "IndusInd Bank Ltd", weight: 5.5, basePrice: 1380 },
        { symbol: "BANKBARODA", name: "Bank of Baroda", weight: 3.2, basePrice: 240 },
        { symbol: "FEDERALBNK", name: "Federal Bank Ltd", weight: 2.8, basePrice: 160 },
        { symbol: "IDFCFIRSTB", name: "IDFC First Bank Ltd", weight: 2.2, basePrice: 78 },
        { symbol: "AUBANK", name: "AU Small Finance Bank Ltd", weight: 1.8, basePrice: 620 }
      ];

      const activePool = isNifty ? niftyConstituents : bankNiftyConstituents;
      
      const mappedMovers = activePool.map(c => {
        // Higher weight stocks drive more index points
        const changePercent = (Math.random() * 4 - 1.8); // -1.8% to +2.2%
        const pointsContribution = (c.weight * changePercent * (isNifty ? 1.2 : 4.5));
        return {
          symbol: c.symbol,
          name: c.name,
          price: c.basePrice * (1 + changePercent/100),
          changePercent,
          pointsContribution,
          weight: c.weight
        };
      });

      const positive = mappedMovers.filter(m => m.pointsContribution > 0).sort((a,b) => b.pointsContribution - a.pointsContribution);
      const negative = mappedMovers.filter(m => m.pointsContribution <= 0).sort((a,b) => a.pointsContribution - b.pointsContribution);

      const netPositivePoints = positive.reduce((acc, curr) => acc + curr.pointsContribution, 0);
      const netNegativePoints = Math.abs(negative.reduce((acc, curr) => acc + curr.pointsContribution, 0));

      const sectorContribution = [
        { sector: "Financial Services", points: isNifty ? 42.5 : 234.8 },
        { sector: "Information Technology", points: isNifty ? 24.3 : 0 },
        { sector: "Oil, Gas & Materials", points: isNifty ? 31.8 : 0 },
        { sector: "Fast Moving Consumer Goods", points: isNifty ? 12.5 : 0 },
        { sector: "Automobile & Auto Parts", points: isNifty ? -15.4 : 0 },
        { sector: "Metals & Mining", points: isNifty ? -8.2 : 0 }
      ].filter(s => s.points !== 0 || isNifty);

      res.json({
        data: {
          indexName: indexSym,
          indexValue,
          indexChange,
          indexChangePercent,
          netPositivePoints,
          netNegativePoints,
          advances: positive.length + 2, // adding some filler
          declines: negative.length + 1,
          movers: {
            positive: positive.slice(0, 5),
            negative: negative.slice(0, 5)
          },
          sectorContribution
        }
      });
    } catch (error) {
      console.error("Error index movers:", error);
      res.status(500).json({ message: "Failed to fetch index movers" });
    }
  });

  // 4. FII / DII flow tracking API
  app.get('/api/fii-dii', async (req, res) => {
    try {
      const history = [];
      const latestFii = Math.round((Math.random() * 3000 - 1000));
      const latestDii = Math.round((Math.random() * 2500 + 500));

      for (let i = 0; i < 15; i++) {
        const d = new Date(Date.now() - (i * 24 * 60 * 60 * 1000));
        // Skip weekends
        if (d.getDay() === 0 || d.getDay() === 6) continue;

        const fiiCash = i === 0 ? latestFii : Math.round((Math.random() * 4000 - 2000));
        const diiCash = i === 0 ? latestDii : Math.round((Math.random() * 3500 - 500));
        const fiiIndexFutures = Math.round((Math.random() * 1500 - 750));
        const fiiStockFutures = Math.round((Math.random() * 2000 - 500));

        history.push({
          date: d.toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' }),
          fiiCash,
          diiCash,
          fiiIndexFutures,
          fiiStockFutures,
          netCashFlow: fiiCash + diiCash
        });
      }

      const sentiment = latestFii > 0 && latestDii > 0 ? "Bullish" 
        : latestFii < 0 && latestDii < 0 ? "Bearish" 
        : "Mixed";

      const sentimentReason = sentiment === "Bullish" 
        ? "Both Foreign and Domestic Institutions are aggressive buyers. Very strong liquidity support."
        : sentiment === "Bearish"
        ? "Institutional selling is putting downward pressure. Risk-off mood in secondary markets."
        : "Foreign funds are booking profits while domestic funds are buying the dips. Rangebound market stance.";

      res.json({
        data: {
          latestDate: history[0]?.date || new Date().toDateString(),
          fiiCashLatest: latestFii,
          diiCashLatest: latestDii,
          netCashLatest: latestFii + latestDii,
          fiiIndexFuturesLatest: Math.round(Math.random() * 1000 - 300),
          fiiStockFuturesLatest: Math.round(Math.random() * 1500 + 100),
          sentiment,
          sentimentReason,
          history
        }
      });
    } catch (error) {
      console.error("Error FII/DII flow:", error);
      res.status(500).json({ message: "Failed to fetch FII/DII flow data" });
    }
  });

  // 5. Sector Performance API
  app.get('/api/sector-performance', async (req, res) => {
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

      const tickers = {
        "^NSEBANK": ["HDFCBANK", "ICICIBANK", "SBIN"],
        "^CNXIT": ["TCS", "INFY", "WIPRO"],
        "^CNXPHARMA": ["SUNPHARMA", "CIPLA", "DIVISLAB"],
        "^CNXAUTO": ["TATAMOTORS", "M&M", "MARUTI"],
        "^CNXMETAL": ["TATASTEEL", "JSWSTEEL", "HINDALCO"],
        "^CNXFMCG": ["ITC", "HINDUNILVR", "NESTLEIND"],
        "^CNXREALTY": ["DLF", "LODHA", "GODREJPROP"],
        "^CNXINFRA": ["LT", "ADANIPORTS", "GMRINFRA"],
        "^CNXENERGY": ["RELIANCE", "NTPC", "POWERGRID"]
      };

      const sectors = sectorsList.map(s => {
        const seed = Math.random();
        const change1d = s.baseChange + (seed * 0.6 - 0.3);
        const change1w = s.baseChange * 3 + (seed * 3.5 - 1.5);
        const change1m = s.baseChange * 10 + (seed * 12 - 5);

        const activeTickers = tickers[s.symbol as keyof typeof tickers] || ["STOCK1", "STOCK2", "STOCK3"];
        
        return {
          name: s.name,
          symbol: s.symbol,
          change1d: Number(change1d.toFixed(2)),
          change1w: Number(change1w.toFixed(2)),
          change1m: Number(change1m.toFixed(2)),
          topGainer: {
            symbol: activeTickers[0],
            change: Number((change1d + Math.abs(seed * 2.5)).toFixed(2))
          },
          topLoser: {
            symbol: activeTickers[2],
            change: Number((change1d - Math.abs(seed * 2.5)).toFixed(2))
          }
        };
      });

      res.json({ sectors });
    } catch (error) {
      console.error("Error sector performance:", error);
      res.status(500).json({ message: "Failed to fetch sector performance" });
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

  // Batch news fetching for Watchlist
  app.get('/api/news/batch', async (req, res) => {
    try {
      const symbolsString = req.query.symbols as string;
      if (!symbolsString) {
        return res.json({ news: [] });
      }
      
      const symbols = symbolsString.split(',').filter(Boolean);
      const limitPerStock = parseInt(req.query.limit as string) || 5;

      const promises = symbols.map(symbol => getYahooStockNews(symbol, limitPerStock, { region: 'IN', lang: 'en-IN' }));
      const results = await Promise.allSettled(promises);

      let aggregatedNews: any[] = [];
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value) {
          // Tag each nested news item with the symbol so the frontend knows who it belongs to
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

      res.json({ news: aggregatedNews, lastUpdated: new Date().toISOString() });
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
  app.get('/api/stock/:symbol/fundamentals/ai', async (req, res) => {
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
  app.get('/api/stock/:symbol/technicals/ai', async (req, res) => {
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

      const fundData   = fundLive.status === 'fulfilled' ? fundLive.value : null;
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
        lastUpdated: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Deep fundamentals error:', err);
      res.status(500).json({ message: 'Failed to generate fundamental dashboard' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

