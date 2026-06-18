import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import { db } from "./db";
import { apexNewsSignals } from "@shared/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getNowIST } from "./istUtils";
import { markJobStart, markJobDone, markJobFailed, logError } from "./jobLedger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load company name map JSON dynamically
let companyNameMap: Record<string, string> = {};
try {
  const mapPath = join(__dirname, "companyNameMap.json");
  companyNameMap = JSON.parse(readFileSync(mapPath, "utf8"));
} catch (err) {
  console.error("[NewsEngine] Failed to load companyNameMap.json:", err);
}

const RSS_FEEDS = [
  { url: "https://www.moneycontrol.com/rss/marketoutlook.xml", source: "MoneyControl" },
  { url: "https://www.moneycontrol.com/rss/business.xml", source: "MoneyControl" },
  { url: "https://www.moneycontrol.com/rss/buzzingstocks.xml", source: "MoneyControl" },
  { url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms", source: "ET Markets" },
  { url: "https://www.business-standard.com/rss/markets-106.rss", source: "Business Standard" }
];

const POSITIVE_KEYWORDS = [
  'beat', 'exceed', 'profit', 'surpass', 'growth', 'gain', 'rise', 'winning', 'wins', 'up', 'bullish', 
  'expansion', 'partnership', 'acquisition', 'record', 'dividend', 'deal', 'bonus', 'approved', 'invest', 
  'higher', 'positive', 'order', 'orders', 'jump', 'jumps', 'surge', 'surges', 'recovery', 'strong', 
  'upgrade', 'upgraded', 'outperform', 'profitable', 'revenue increase', 'revenue jump'
];

const NEGATIVE_KEYWORDS = [
  'miss', 'decline', 'drop', 'fall', 'loss', 'down', 'bearish', 'cut', 'slashed', 'deficit', 'negative', 
  'investigation', 'probe', 'fraud', 'fine', 'penalty', 'regulatory', 'tax notice', 'tax dispute', 
  'dispute', 'layoff', 'debt', 'warns', 'warning', 'weak', 'lower', 'plunge', 'plunges', 'slump', 'slumps',
  'downgrade', 'downgraded', 'underperform', 'deficit', 'default', 'defaulted', 'bankrupt'
];

/**
 * Maps company name keywords in headline to their NSE tickers.
 */
export function extractStockTicker(headline: string): string | null {
  const cleanHeadline = headline.toLowerCase();
  const keys = Object.keys(companyNameMap).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (cleanHeadline.includes(key)) {
      return companyNameMap[key];
    }
  }
  return null;
}

/**
 * Keyword-based sentiment scoring (-100 to +100).
 */
export function scoreSentiment(headline: string): number {
  const cleanHeadline = headline.toLowerCase();
  let score = 0;
  
  for (const word of POSITIVE_KEYWORDS) {
    if (cleanHeadline.includes(word)) score += 15;
  }
  for (const word of NEGATIVE_KEYWORDS) {
    if (cleanHeadline.includes(word)) score -= 15;
  }
  
  return Math.max(-100, Math.min(100, score));
}

/**
 * Classifies headline news catalyst type.
 */
export function classifyCatalyst(headline: string): string {
  const cleanHeadline = headline.toLowerCase();
  if (cleanHeadline.includes("beat") || cleanHeadline.includes("profit jump") || cleanHeadline.includes("net profit beats") || cleanHeadline.includes("exceeds estimate")) {
    return "RESULT_BEAT";
  }
  if (cleanHeadline.includes("wins order") || cleanHeadline.includes("awarded contract") || cleanHeadline.includes("secures order") || cleanHeadline.includes("order win") || cleanHeadline.includes("deal win")) {
    return "ORDER_WIN";
  }
  if (cleanHeadline.includes("expand") || cleanHeadline.includes("expansion") || cleanHeadline.includes("acquisition") || cleanHeadline.includes("acquires") || cleanHeadline.includes("new plant")) {
    return "EXPANSION";
  }
  if (cleanHeadline.includes("sebi") || cleanHeadline.includes("rbi") || cleanHeadline.includes("penalty") || cleanHeadline.includes("tax notice") || cleanHeadline.includes("probe") || cleanHeadline.includes("investigation") || cleanHeadline.includes("fine")) {
    return "REGULATORY_NEGATIVE";
  }
  if (cleanHeadline.includes("dividend") || cleanHeadline.includes("bonus share") || cleanHeadline.includes("stock split") || cleanHeadline.includes("special dividend")) {
    return "DIVIDEND_BONUS";
  }
  if (cleanHeadline.includes("ceo") || cleanHeadline.includes("cfo") || cleanHeadline.includes("resigns") || cleanHeadline.includes("appoints") || cleanHeadline.includes("management change")) {
    return "MANAGEMENT_CHANGE";
  }
  return "MARKET_MACRO";
}

/**
 * Maps a stock symbol to its respective sector.
 */
export function getSectorForSymbol(symbol: string): string {
  const symbolToSector: Record<string, string> = {
    "HDFCBANK": "BANKING", "ICICIBANK": "BANKING", "SBIN": "BANKING", "KOTAKBANK": "BANKING", "AXISBANK": "BANKING", "INDUSINDBK": "BANKING",
    "BANDHANBNK": "BANKING", "RBLBANK": "BANKING", "FEDERALBNK": "BANKING", "IDFCFIRSTB": "BANKING", "AUBANK": "BANKING", "BANKBARODA": "BANKING",
    "CANARABNK": "BANKING", "UNIONBANK": "BANKING", "INDIANB": "BANKING", "PNB": "BANKING",
    
    "TCS": "IT", "INFY": "IT", "WIPRO": "IT", "HCLTECH": "IT", "TECHM": "IT", "LTIM": "IT", "PERSISTENT": "IT", "COFORGE": "IT", "MPHASIS": "IT",
    
    "SUNPHARMA": "PHARMA", "DRREDDY": "PHARMA", "CIPLA": "PHARMA", "DIVISLAB": "PHARMA", "APOLLOHOSP": "PHARMA", "ZYDUSLIFE": "PHARMA", "LUPIN": "PHARMA",
    
    "TATAMOTORS": "AUTO", "MARUTI": "AUTO", "M&M": "AUTO", "BAJAJ-AUTO": "AUTO", "EICHERMOT": "AUTO", "HEROMOTOCO": "AUTO", "ASHOKLEY": "AUTO", "TVSMOTOR": "AUTO",
    
    "HINDUNILVR": "FMCG", "ITC": "FMCG", "NESTLEIND": "FMCG", "BRITANNIA": "FMCG", "TATACONSUM": "FMCG", "DABUR": "FMCG", "MARICO": "FMCG",
    
    "TATASTEEL": "METALS", "JSWSTEEL": "METALS", "HINDALCO": "METALS", "COALINDIA": "METALS", "VEDL": "METALS", "SAIL": "METALS",
    
    "RELIANCE": "OIL_GAS", "ONGC": "OIL_GAS", "BPCL": "OIL_GAS", "IOC": "OIL_GAS", "HPCL": "OIL_GAS", "GAIL": "OIL_GAS",
    
    "NTPC": "POWER", "POWERGRID": "POWER", "TATAPOWER": "POWER", "ADANIGREEN": "POWER", "SUZLON": "POWER",
    
    "LT": "INFRA", "ADANIPORTS": "INFRA", "ADANIENT": "INFRA",
    
    "BHARTIARTL": "TELECOM", "IDEA": "TELECOM"
  };
  return symbolToSector[symbol] || "GENERAL";
}

/**
 * Fetches RSS news feeds and parses items.
 */
export async function fetchRSSFeeds(): Promise<any[]> {
  const parser = new XMLParser();
  const allSignals: any[] = [];
  const now = getNowIST();
  
  for (const feed of RSS_FEEDS) {
    try {
      console.log(`[NewsEngine] Fetching ${feed.source} RSS feed: ${feed.url}`);
      const response = await axios.get(feed.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        },
        timeout: 8000
      });
      
      const xmlData = response.data;
      const parsed = parser.parse(xmlData);
      const items = parsed.rss?.channel?.item || [];
      const itemArray = Array.isArray(items) ? items : [items];
      
      for (const item of itemArray) {
        if (!item) continue;
        const headline = item.title || item.description || "";
        if (!headline) continue;
        
        const sentiment = scoreSentiment(headline);
        const ticker = extractStockTicker(headline);
        const catalyst = classifyCatalyst(headline);
        const sector = ticker ? getSectorForSymbol(ticker) : "GENERAL";
        const link = item.link || "";
        const pubDate = item.pubDate ? new Date(item.pubDate) : now;
        
        allSignals.push({
          signalDate: pubDate,
          symbol: ticker,
          sector: sector,
          headline: headline.substring(0, 1000), // safety trim
          source: feed.source,
          url: link.substring(0, 1000),
          sentimentScore: String(sentiment),
          catalystType: catalyst,
          entityType: ticker ? "STOCK" : "MACRO",
        });
      }
    } catch (error: any) {
      console.error(`[NewsEngine] Failed to fetch feed ${feed.url}:`, error.message);
      await logError("news_ingest", error, feed.source);
    }
  }
  return allSignals;
}

/**
 * Aggregates stock-level news to build sector-level updates.
 */
export async function propagateSectorSentiment(todaySignals: any[]): Promise<any[]> {
  const sectorScores: Record<string, { total: number; count: number }> = {};
  
  for (const sig of todaySignals) {
    if (sig.symbol && sig.sector && sig.sector !== "GENERAL") {
      const score = parseFloat(sig.sentimentScore);
      if (!isNaN(score)) {
        if (!sectorScores[sig.sector]) {
          sectorScores[sig.sector] = { total: 0, count: 0 };
        }
        sectorScores[sig.sector].total += score;
        sectorScores[sig.sector].count += 1;
      }
    }
  }
  
  const sectorSignals: any[] = [];
  const now = getNowIST();
  for (const [sector, stats] of Object.entries(sectorScores)) {
    if (stats.count > 0) {
      const avgScore = stats.total / stats.count;
      sectorSignals.push({
        signalDate: now,
        symbol: null,
        sector: sector,
        headline: `Sector sentiment for ${sector} aggregated from ${stats.count} news items.`,
        source: "APEX Sector Aggregator",
        url: "",
        sentimentScore: String(avgScore.toFixed(2)),
        catalystType: avgScore > 20 ? "RESULT_BEAT" : avgScore < -20 ? "REGULATORY_NEGATIVE" : "MARKET_MACRO",
        entityType: "SECTOR",
      });
    }
  }
  return sectorSignals;
}

/**
 * Orchestrator job for full news ingestion.
 */
export async function runNewsIngestJob(): Promise<void> {
  const startTime = Date.now();
  await markJobStart("news_ingest");
  
  try {
    const stockNews = await fetchRSSFeeds();
    const sectorNews = await propagateSectorSentiment(stockNews);
    const combined = [...stockNews, ...sectorNews];
    
    // De-duplicate headlines from today to prevent bloating
    const startOfDay = getNowIST();
    startOfDay.setHours(0, 0, 0, 0);
    const existing = await db.select({ headline: apexNewsSignals.headline })
      .from(apexNewsSignals)
      .where(gte(apexNewsSignals.signalDate, startOfDay));
    
    const existingSet = new Set(existing.map(n => n.headline));
    const toInsert = combined.filter(n => !existingSet.has(n.headline));
    
    if (toInsert.length > 0) {
      await db.insert(apexNewsSignals).values(toInsert);
      console.log(`[NewsEngine] Inserted ${toInsert.length} new news signals.`);
    } else {
      console.log(`[NewsEngine] No new news signals to insert.`);
    }
    
    const duration = Date.now() - startTime;
    await markJobDone("news_ingest", duration);
  } catch (error: any) {
    console.error(`[NewsEngine] Error in runNewsIngestJob:`, error);
    await markJobFailed("news_ingest", error);
  }
}

/**
 * Computes a news composite score for a symbol on a specific date.
 */
export async function getNewsScoreForSymbol(symbol: string, date: Date = getNowIST()): Promise<number> {
  const lookback = new Date(date);
  lookback.setHours(lookback.getHours() - 24);
  
  const sector = getSectorForSymbol(symbol);
  
  try {
    const news = await db.select()
      .from(apexNewsSignals)
      .where(
        and(
          gte(apexNewsSignals.signalDate, lookback),
          sql`(${apexNewsSignals.symbol} = ${symbol} OR (${apexNewsSignals.sector} = ${sector} AND ${apexNewsSignals.entityType} = 'SECTOR'))`
        )
      );
      
    const stockNews = news.filter(n => n.symbol === symbol);
    const sectorNews = news.filter(n => n.entityType === "SECTOR");
    
    let stockScore = 0;
    if (stockNews.length > 0) {
      const total = stockNews.reduce((acc, curr) => acc + parseFloat(curr.sentimentScore || "0"), 0);
      stockScore = total / stockNews.length;
    }
    
    let sectorScore = 0;
    if (sectorNews.length > 0) {
      const total = sectorNews.reduce((acc, curr) => acc + parseFloat(curr.sentimentScore || "0"), 0);
      sectorScore = total / sectorNews.length;
    }
    
    if (stockNews.length > 0) {
      return 0.7 * stockScore + 0.3 * sectorScore;
    } else if (sectorNews.length > 0) {
      return sectorScore;
    }
    return 0;
  } catch (error) {
    console.error(`[NewsEngine] Failed to calculate news score for ${symbol}:`, error);
    return 0;
  }
}
