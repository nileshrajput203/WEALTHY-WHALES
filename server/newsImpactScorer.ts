/**
 * NEWS IMPACT SCORER — Deep News Analysis Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides Gemini-powered deep news sentiment analysis with:
 *  - Impact magnitude scoring (1-5 scale)
 *  - Catalyst classification (RESULT_BEAT, ORDER_WIN, etc.)
 *  - News freshness decay (recent news weighted higher)
 *  - Cross-stock/sector correlation
 *  - Self-learning: compares predictions vs actual moves
 *
 * Used by ALL engines: HERMES, APEX, FUGU, Swing, IPO
 */

import { db } from "./db";
import { apexNewsSignals, newsImpactLog, stockNewsCache } from "@shared/schema";
import { and, eq, gte, desc, sql } from "drizzle-orm";
import { generateWithRetry } from "./gemini";
import { getNewsScoreForSymbol, getSectorForSymbol, extractStockTicker, scoreSentiment, classifyCatalyst } from "./apexNewsEngine";
import { getYahooStockQuote } from "./stockApi";
import { getNowIST } from "./istUtils";

// ─── Impact Magnitude Scale ───────────────────────────────────────────────────
// 1 = Minimal impact (<1% expected move)
// 2 = Low impact (1-2% expected move)
// 3 = Moderate impact (2-5% expected move)
// 4 = High impact (5-10% expected move)
// 5 = Extreme impact (>10% expected move)

export interface NewsImpactResult {
  symbol: string;
  sentiment: number;           // -100 to +100
  magnitude: number;           // 1-5 scale
  catalyst: string;            // RESULT_BEAT | ORDER_WIN | EXPANSION | etc.
  freshness: number;           // 0.0-1.0 (1.0 = just happened)
  relatedStocks: string[];     // peers that may be affected
  geminiSummary: string;       // AI-generated analysis
  headlines: string[];         // top relevant headlines
  sectorSentiment: number;     // -100 to +100 sector-level sentiment
  compositeScore: number;      // -100 to +100 final composite
}

// ─── Keyword magnitude hints ─────────────────────────────────────────────────
const HIGH_IMPACT_KEYWORDS = [
  'acquisition', 'merger', 'takeover', 'buyback', 'demerger', 'delisting',
  'fraud', 'scam', 'default', 'bankrupt', 'insolvency',
  'block deal', 'bulk deal', 'open offer',
  'record profit', 'profit surges', 'revenue doubles', 'revenue triples',
  'stock split', 'bonus issue', 'rights issue',
  'fda approval', 'patent win', 'patent loss',
  'ban', 'sanctions', 'embargo',
  'rate cut', 'rate hike', 'policy change',
];

const MODERATE_IMPACT_KEYWORDS = [
  'beat', 'exceed', 'profit jump', 'revenue jump', 'order win',
  'expansion', 'new plant', 'capacity addition',
  'upgrade', 'downgrade', 'target price',
  'dividend', 'special dividend',
  'management change', 'ceo resign', 'cfo appoint',
  'sebi', 'rbi', 'penalty', 'tax notice', 'probe',
  'partnership', 'joint venture', 'mou signed',
];

/**
 * Estimates impact magnitude from headline keywords (1-5 scale).
 */
function estimateMagnitudeFromKeywords(headline: string): number {
  const lower = headline.toLowerCase();

  for (const kw of HIGH_IMPACT_KEYWORDS) {
    if (lower.includes(kw)) return 4; // High impact minimum
  }

  let moderateHits = 0;
  for (const kw of MODERATE_IMPACT_KEYWORDS) {
    if (lower.includes(kw)) moderateHits++;
  }

  if (moderateHits >= 2) return 3;
  if (moderateHits === 1) return 2;
  return 1;
}

/**
 * Computes freshness decay: exponential decay based on hours since publication.
 * Half-life = 12 hours (news from 12h ago has 50% weight).
 */
function computeFreshness(publishedAt: Date, now: Date = new Date()): number {
  const hoursAgo = (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60);
  const halfLife = 12;
  return Math.exp(-0.693 * hoursAgo / halfLife); // ln(2)/halfLife * t
}

/**
 * Gets related stocks in the same sector (peers).
 */
function getRelatedStocks(symbol: string): string[] {
  const sector = getSectorForSymbol(symbol);
  const SECTOR_PEERS: Record<string, string[]> = {
    "BANKING": ["HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "AXISBANK", "INDUSINDBK", "BANKBARODA", "PNB"],
    "IT": ["TCS", "INFY", "WIPRO", "HCLTECH", "TECHM", "LTIM", "PERSISTENT", "COFORGE"],
    "PHARMA": ["SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "LUPIN", "ZYDUSLIFE"],
    "AUTO": ["TATAMOTORS", "MARUTI", "M&M", "BAJAJ-AUTO", "EICHERMOT", "HEROMOTOCO", "TVSMOTOR"],
    "FMCG": ["HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA", "TATACONSUM", "DABUR", "MARICO"],
    "METALS": ["TATASTEEL", "JSWSTEEL", "HINDALCO", "COALINDIA", "VEDL", "SAIL"],
    "OIL_GAS": ["RELIANCE", "ONGC", "BPCL", "IOC", "HPCL", "GAIL"],
    "POWER": ["NTPC", "POWERGRID", "TATAPOWER", "ADANIGREEN"],
  };

  const peers = SECTOR_PEERS[sector] || [];
  return peers.filter(p => p !== symbol).slice(0, 5);
}

/**
 * Deep news analysis using Gemini AI for a single stock.
 * Returns structured impact assessment with sentiment, magnitude, and AI reasoning.
 */
export async function analyzeNewsImpact(symbol: string): Promise<NewsImpactResult> {
  const now = getNowIST();
  const lookback24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. Fetch recent news from DB
  const sector = getSectorForSymbol(symbol);
  let news: any[] = [];
  try {
    news = await db.select()
      .from(apexNewsSignals)
      .where(
        and(
          gte(apexNewsSignals.signalDate, lookback24h),
          sql`(${apexNewsSignals.symbol} = ${symbol} OR (${apexNewsSignals.sector} = ${sector} AND ${apexNewsSignals.entityType} = 'SECTOR'))`
        )
      )
      .orderBy(desc(apexNewsSignals.signalDate))
      .limit(20);
  } catch (_) {}

  const stockNews = news.filter(n => n.symbol === symbol);
  const sectorNews = news.filter(n => n.entityType === "SECTOR");

  // 2. Compute basic scores
  let baseSentiment = 0;
  if (stockNews.length > 0) {
    baseSentiment = stockNews.reduce((s, n) => s + parseFloat(n.sentimentScore || "0"), 0) / stockNews.length;
  }

  let sectorSentiment = 0;
  if (sectorNews.length > 0) {
    sectorSentiment = sectorNews.reduce((s, n) => s + parseFloat(n.sentimentScore || "0"), 0) / sectorNews.length;
  }

  // 3. Compute freshness-weighted sentiment
  let freshnessWeightedSentiment = 0;
  let totalFreshnessWeight = 0;
  for (const n of stockNews) {
    const freshness = computeFreshness(new Date(n.signalDate), now);
    freshnessWeightedSentiment += parseFloat(n.sentimentScore || "0") * freshness;
    totalFreshnessWeight += freshness;
  }
  if (totalFreshnessWeight > 0) {
    freshnessWeightedSentiment /= totalFreshnessWeight;
  }

  // 4. Estimate magnitude from keywords
  let maxMagnitude = 1;
  for (const n of stockNews) {
    const mag = estimateMagnitudeFromKeywords(n.headline || "");
    if (mag > maxMagnitude) maxMagnitude = mag;
  }

  // 5. Determine catalyst type
  let catalyst = "MARKET_MACRO";
  if (stockNews.length > 0) {
    catalyst = classifyCatalyst(stockNews[0].headline || "");
  }

  // 6. Get top headlines
  const headlines = stockNews.slice(0, 5).map(n => n.headline || "").filter(Boolean);

  // 7. Freshness of most recent news
  const freshness = stockNews.length > 0
    ? computeFreshness(new Date(stockNews[0].signalDate), now)
    : 0;

  // 8. Gemini deep analysis (for stocks with significant news)
  let geminiSummary = "";
  if (stockNews.length > 0 && Math.abs(baseSentiment) > 10) {
    try {
      const headlinesText = headlines.join("\n");
      const prompt = `You are an expert Indian stock market analyst. Analyze these recent news headlines for ${symbol} and provide:
1. Overall sentiment direction (bullish/bearish/neutral)
2. Expected price impact magnitude (1-5 scale):
   - 1: Minimal (<1% move)
   - 2: Low (1-2% move)
   - 3: Moderate (2-5% move)
   - 4: High (5-10% move)
   - 5: Extreme (>10% move)
3. Key catalyst and reasoning (1-2 sentences)
4. Whether this news is already priced in or a fresh catalyst

Headlines:
${headlinesText}

Sector sentiment: ${sectorSentiment > 0 ? "Positive" : sectorSentiment < 0 ? "Negative" : "Neutral"}

Respond in JSON format: {"sentiment": number(-100 to 100), "magnitude": number(1-5), "reasoning": "string", "pricedIn": boolean}`;

      const res = await generateWithRetry({
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          systemInstruction: "You are a concise Indian stock market news analyst. Respond only in valid JSON.",
        },
      });

      const rawText = res?.text ?? "";
      geminiSummary = rawText;

      // Try to parse Gemini's structured response
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (typeof parsed.magnitude === "number") {
            maxMagnitude = Math.max(maxMagnitude, Math.min(5, parsed.magnitude));
          }
          if (typeof parsed.sentiment === "number") {
            baseSentiment = parsed.sentiment;
          }
        }
      } catch (_) {}
    } catch (err: any) {
      console.warn(`[NewsImpact] Gemini analysis failed for ${symbol}:`, err.message);
    }
  }

  // 9. Compute composite score
  // Composite = 60% stock news + 25% sector sentiment + 15% freshness-adjusted
  const compositeSentiment = stockNews.length > 0
    ? (0.6 * baseSentiment + 0.25 * sectorSentiment + 0.15 * freshnessWeightedSentiment)
    : sectorSentiment;

  const compositeScore = Math.max(-100, Math.min(100, compositeSentiment));

  // 10. Log impact for future learning
  if (stockNews.length > 0 && Math.abs(compositeScore) > 15) {
    try {
      const quote = await getYahooStockQuote(`${symbol}.NS`);
      if (quote?.price) {
        await db.insert(newsImpactLog).values({
          symbol,
          predictedSentiment: String(compositeScore.toFixed(2)),
          predictedMagnitude: maxMagnitude,
          catalystType: catalyst,
          headline: headlines[0] || "",
          geminiAnalysis: geminiSummary.substring(0, 2000),
          priceAtAnalysis: String(quote.price.toFixed(2)),
        });
      }
    } catch (_) {}
  }

  return {
    symbol,
    sentiment: Math.round(baseSentiment),
    magnitude: maxMagnitude,
    catalyst,
    freshness,
    relatedStocks: getRelatedStocks(symbol),
    geminiSummary,
    headlines,
    sectorSentiment: Math.round(sectorSentiment),
    compositeScore: Math.round(compositeScore),
  };
}

/**
 * Batch analysis for multiple symbols — used by scanners.
 * Returns a map of symbol → NewsImpactResult.
 */
export async function batchAnalyzeNewsImpact(
  symbols: string[],
  options: { skipGemini?: boolean } = {},
): Promise<Map<string, NewsImpactResult>> {
  const results = new Map<string, NewsImpactResult>();
  const now = getNowIST();
  const lookback24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Pre-fetch all news for the batch in one query
  let allNews: any[] = [];
  try {
    allNews = await db.select()
      .from(apexNewsSignals)
      .where(gte(apexNewsSignals.signalDate, lookback24h))
      .orderBy(desc(apexNewsSignals.signalDate));
  } catch (_) {}

  // Build per-symbol news map
  const newsMap = new Map<string, any[]>();
  const sectorNewsMap = new Map<string, any[]>();

  for (const n of allNews) {
    if (n.symbol) {
      const arr = newsMap.get(n.symbol) || [];
      arr.push(n);
      newsMap.set(n.symbol, arr);
    }
    if (n.entityType === "SECTOR" && n.sector) {
      const arr = sectorNewsMap.get(n.sector) || [];
      arr.push(n);
      sectorNewsMap.set(n.sector, arr);
    }
  }

  for (const symbol of symbols) {
    const stockNews = newsMap.get(symbol) || [];
    const sector = getSectorForSymbol(symbol);
    const sectorNews = sectorNewsMap.get(sector) || [];

    let baseSentiment = 0;
    if (stockNews.length > 0) {
      baseSentiment = stockNews.reduce((s: number, n: any) => s + parseFloat(n.sentimentScore || "0"), 0) / stockNews.length;
    }

    let sectorSentiment = 0;
    if (sectorNews.length > 0) {
      sectorSentiment = sectorNews.reduce((s: number, n: any) => s + parseFloat(n.sentimentScore || "0"), 0) / sectorNews.length;
    }

    let maxMagnitude = 1;
    for (const n of stockNews) {
      maxMagnitude = Math.max(maxMagnitude, estimateMagnitudeFromKeywords(n.headline || ""));
    }

    const catalyst = stockNews.length > 0 ? classifyCatalyst(stockNews[0].headline || "") : "MARKET_MACRO";
    const freshness = stockNews.length > 0 ? computeFreshness(new Date(stockNews[0].signalDate), now) : 0;
    const headlines = stockNews.slice(0, 3).map((n: any) => n.headline || "").filter(Boolean);

    const compositeScore = stockNews.length > 0
      ? Math.round(0.7 * baseSentiment + 0.3 * sectorSentiment)
      : Math.round(sectorSentiment);

    results.set(symbol, {
      symbol,
      sentiment: Math.round(baseSentiment),
      magnitude: maxMagnitude,
      catalyst,
      freshness,
      relatedStocks: getRelatedStocks(symbol),
      geminiSummary: "",
      headlines,
      sectorSentiment: Math.round(sectorSentiment),
      compositeScore: Math.max(-100, Math.min(100, compositeScore)),
    });
  }

  return results;
}

/**
 * Fill news impact outcomes — called by scheduler to track prediction accuracy.
 */
export async function fillNewsImpactOutcomes(): Promise<{ filled: number }> {
  const now = getNowIST();
  let filled = 0;

  // Fill 1-day outcomes: entries older than 1 calendar day
  const oneDayAgo = new Date(now.getTime() - 26 * 60 * 60 * 1000);
  try {
    const pending = await db.select()
      .from(newsImpactLog)
      .where(
        and(
          sql`${newsImpactLog.actualReturn1d} IS NULL`,
          sql`${newsImpactLog.analysisDate} < ${oneDayAgo}`,
        )
      )
      .limit(50);

    for (const entry of pending) {
      try {
        const quote = await getYahooStockQuote(`${entry.symbol}.NS`);
        if (quote?.price && entry.priceAtAnalysis) {
          const entryPrice = parseFloat(entry.priceAtAnalysis);
          const returnPct = ((quote.price - entryPrice) / entryPrice) * 100;
          const predictedDir = parseFloat(entry.predictedSentiment || "0") >= 0;
          const actualDir = returnPct >= 0;
          const directionCorrect = predictedDir === actualDir;

          // Magnitude accuracy: check if the actual move fell in the predicted bracket
          const absMag = Math.abs(returnPct);
          const predictedMag = entry.predictedMagnitude || 1;
          const actualMagBracket = absMag > 10 ? 5 : absMag > 5 ? 4 : absMag > 2 ? 3 : absMag > 1 ? 2 : 1;
          const magnitudeAccurate = Math.abs(actualMagBracket - predictedMag) <= 1;

          await db.update(newsImpactLog)
            .set({
              priceAfter1d: String(quote.price.toFixed(2)),
              actualReturn1d: String(returnPct.toFixed(2)),
              predictionAccurate: directionCorrect,
              magnitudeAccurate,
              filledAt: now,
            })
            .where(eq(newsImpactLog.id, entry.id));
          filled++;
        }
      } catch (_) {}
    }
  } catch (_) {}

  if (filled > 0) {
    console.log(`[NewsImpact] Filled ${filled} news impact outcomes`);
  }
  return { filled };
}

/**
 * Get news prediction accuracy stats (for learning/dashboard).
 */
export async function getNewsAccuracyStats(): Promise<{
  totalPredictions: number;
  directionAccuracy: number;
  magnitudeAccuracy: number;
  avgSentimentError: number;
}> {
  try {
    const filled = await db.select()
      .from(newsImpactLog)
      .where(sql`${newsImpactLog.predictionAccurate} IS NOT NULL`)
      .limit(500);

    if (filled.length === 0) {
      return { totalPredictions: 0, directionAccuracy: 0.5, magnitudeAccuracy: 0.5, avgSentimentError: 50 };
    }

    const dirCorrect = filled.filter(f => f.predictionAccurate === true).length;
    const magCorrect = filled.filter(f => f.magnitudeAccurate === true).length;

    return {
      totalPredictions: filled.length,
      directionAccuracy: dirCorrect / filled.length,
      magnitudeAccuracy: magCorrect / filled.length,
      avgSentimentError: 0, // could compute later
    };
  } catch (_) {
    return { totalPredictions: 0, directionAccuracy: 0.5, magnitudeAccuracy: 0.5, avgSentimentError: 50 };
  }
}
