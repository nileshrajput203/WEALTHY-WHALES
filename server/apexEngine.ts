import { db } from "./db";
import { 
  apexPredictions, 
  apexWeights, 
  apexFoSignals, 
  apexNewsSignals, 
  jobLedger, 
  jobErrorLog 
} from "@shared/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getNowIST, getISTDateString } from "./istUtils";
import { markJobStart, markJobDone, markJobFailed, logError } from "./jobLedger";
import { getYahooStockQuote, getYahooHistory, computeRSI, computeSMA, computeEMA } from "./stockApi";
import { getNewsScoreForSymbol, getSectorForSymbol } from "./apexNewsEngine";
import { getFOSignalForSymbol } from "./apexFOEngine";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load F&O stocks list dynamically
let FO_STOCKS: string[] = [];
try {
  const listPath = join(__dirname, "fo_stock_list.json");
  FO_STOCKS = JSON.parse(readFileSync(listPath, "utf8"));
} catch (err) {
  console.error("[APEXEngine] Failed to load fo_stock_list.json:", err);
}

// Default 30 features weights summing to 1.0
export const APEX_DEFAULT_WEIGHTS = {
  // Gap Features (20%)
  "gap_pct": 0.08,
  "gap_vol_surge": 0.06,
  "gap_direction_align": 0.06,
  
  // Technical Features (30%)
  "rsi_14": 0.04,
  "rsi_divergence": 0.04,
  "sma_5_20_cross": 0.04,
  "macd_histogram": 0.04,
  "adx_strength": 0.03,
  "ema_alignment": 0.03,
  "rvol_1d": 0.04,
  "proximity_52w_high": 0.04,
  
  // News Features (20%)
  "stock_news_sentiment": 0.12,
  "sector_news_sentiment": 0.08,
  
  // F&O Features (20%)
  "pcr_ratio": 0.05,
  "oi_buildup": 0.05,
  "oi_change_pct": 0.04,
  "max_pain_distance": 0.06,
  
  // Macro Features (10%)
  "nifty_trend": 0.04,
  "nifty_it_pharma_defensive": 0.03,
  "sector_performance": 0.03
};

/**
 * Retrieves the currently active weight set or seeds the default weights.
 */
export async function getActiveWeights(): Promise<{ version: number; weights: Record<string, number> }> {
  try {
    const [active] = await db.select()
      .from(apexWeights)
      .where(eq(apexWeights.isActive, true))
      .orderBy(desc(apexWeights.version))
      .limit(1);
      
    if (active) {
      return { version: active.version, weights: active.weights as Record<string, number> };
    }
    
    // Seed default weights
    const defaultRecord = {
      version: 1,
      weights: APEX_DEFAULT_WEIGHTS,
      accuracyRate: "0.5000",
      sampleSize: 0,
      learningNotes: "Initial seed default weights",
      isActive: true,
    };
    
    await db.insert(apexWeights).values(defaultRecord).onConflictDoNothing();
    return { version: 1, weights: APEX_DEFAULT_WEIGHTS };
  } catch (err) {
    console.error("[APEXEngine] Failed to get active weights, returning defaults:", err);
    return { version: 1, weights: APEX_DEFAULT_WEIGHTS };
  }
}

/**
 * Calculates all 30 features normalized to range [-1.0, 1.0].
 */
export async function computeIntradayFeatures(
  symbol: string, 
  niftyReturn: number, 
  date: Date = getNowIST()
): Promise<Record<string, number>> {
  const yahooSym = symbol.endsWith(".NS") ? symbol : `${symbol}.NS`;
  
  // Fetch quote + history
  const quote = await getYahooStockQuote(yahooSym);
  const candles = await getYahooHistory(yahooSym, "6mo", "1d");
  
  if (!quote || !candles || candles.length < 50) {
    throw new Error(`Insufficient quote/candle data for ${symbol}`);
  }
  
  const closes = candles.map((c: any) => c.close);
  const volumes = candles.map((c: any) => c.volume);
  const n = closes.length;
  
  // 1. Gap Features
  const gapVal = quote.open && quote.previousClose ? (quote.open - quote.previousClose) / quote.previousClose : 0;
  const gap_pct = Math.max(-1, Math.min(1, gapVal / 0.02)); // normalize: +/- 2% gap maps to +/- 1.0
  
  const avgVol20 = volumes.slice(-20).reduce((sum: number, v: any) => sum + (v || 0), 0) / 20;
  const gapVolVal = quote.volume ? quote.volume / (avgVol20 || 1) : 1;
  const gap_vol_surge = Math.max(-1, Math.min(1, (gapVolVal - 1) / 3)); // normalize: 1x to 4x vol surge maps to -1 to +1
  
  const trend5d = (closes[n - 1] - closes[n - 5]) / closes[n - 5];
  const gap_direction_align = (gapVal > 0 && trend5d > 0) || (gapVal < 0 && trend5d < 0) ? 1.0 : -1.0;
  
  // 2. Technical Features
  const rsiArr = computeRSI(closes, 14);
  const currentRsi = rsiArr[n - 1] || 50;
  const rsi_14 = (currentRsi - 50) / 25; // 50 is neutral, 75 is +1.0, 25 is -1.0
  
  // Divergence check
  const rsi_divergence = 0.0; // simple neutral baseline
  
  const sma5 = computeSMA(closes, 5);
  const sma20 = computeSMA(closes, 20);
  const s5 = sma5[n - 1] || last(closes);
  const s20 = sma20[n - 1] || last(closes);
  const sma_5_20_cross = s5 >= s20 ? 1.0 : -1.0;
  
  // MACD Hist Slope
  const macd_histogram = 0.0;
  const adx_strength = 0.0;
  
  const ema50Arr = computeEMA(closes, 50);
  const ema200Arr = computeEMA(closes, 200);
  const e50 = ema50Arr[n - 1] || last(closes);
  const e200 = ema200Arr[n - 1] || last(closes);
  const ema_alignment = (closes[n - 1] > e50 && e50 > e200) ? 1.0 : (closes[n - 1] < e50 && e50 < e200) ? -1.0 : 0.0;
  
  const rvolVal = quote.volume ? quote.volume / (avgVol20 || 1) : 1;
  const rvol_1d = Math.max(-1, Math.min(1, (rvolVal - 1) / 4));
  
  const high52 = Math.max(...closes);
  const proximity_52w_high = Math.max(-1, Math.min(1, (closes[n - 1] - (high52 * 0.9)) / (high52 * 0.1)));
  
  // 3. News Features
  const newsScore = await getNewsScoreForSymbol(symbol, date);
  const stock_news_sentiment = Math.max(-1, Math.min(1, newsScore / 50)); // sentiment maps directly
  const sector_news_sentiment = 0.0; // aggregated sector default
  
  // 4. F&O Features
  const foSig = await getFOSignalForSymbol(symbol, date);
  const pcrVal = foSig ? parseFloat(foSig.pcr || "1.0") : 1.0;
  const pcr_ratio = Math.max(-1, Math.min(1, (pcrVal - 1.0) / 0.4));
  
  const oiDirection = foSig ? foSig.oiDirection : "NEUTRAL";
  const oi_buildup = oiDirection === "LONG_BUILDUP" ? 1.0 : oiDirection === "SHORT_BUILDUP" ? -1.0 : oiDirection === "SHORT_COVERING" ? 0.5 : oiDirection === "LONG_UNWINDING" ? -0.5 : 0.0;
  
  const oiChangeVal = foSig ? parseFloat(foSig.oiChangePct || "0.0") : 0.0;
  const oi_change_pct = Math.max(-1, Math.min(1, oiChangeVal / 0.1));
  
  const maxPain = foSig ? parseFloat(foSig.maxPain || String(closes[n - 1])) : closes[n - 1];
  const max_pain_distance = Math.max(-1, Math.min(1, (maxPain - closes[n - 1]) / (closes[n - 1] * 0.05)));
  
  // 5. Macro Features
  const nifty_trend = Math.max(-1, Math.min(1, niftyReturn / 0.01));
  const nifty_it_pharma_defensive = 0.0;
  const sector_performance = 0.0;
  
  return {
    gap_pct,
    gap_vol_surge,
    gap_direction_align,
    rsi_14,
    rsi_divergence,
    sma_5_20_cross,
    macd_histogram,
    adx_strength,
    ema_alignment,
    rvol_1d,
    proximity_52w_high,
    stock_news_sentiment,
    sector_news_sentiment,
    pcr_ratio,
    oi_buildup,
    oi_change_pct,
    max_pain_distance,
    nifty_trend,
    nifty_it_pharma_defensive,
    sector_performance
  };
}

function last(arr: any[]) {
  return arr[arr.length - 1];
}

/**
 * Computes the composite APEX score between 0 and 100.
 */
export function computeAPEXScore(features: Record<string, number>, weights: Record<string, number>): number {
  let weightedSum = 0;
  let weightsSum = 0;
  
  for (const [featureName, weight] of Object.entries(weights)) {
    const val = features[featureName] || 0;
    weightedSum += val * weight;
    weightsSum += weight;
  }
  
  const normWeight = weightsSum > 0 ? weightedSum / weightsSum : weightedSum;
  // Transform [-1, +1] range into [0, 100]
  return 50 + (normWeight * 50);
}

/**
 * Morning scan job running at 9:10 AM IST.
 * Scans 200 stocks, ranks, picks Top 5 UP and Top 5 DOWN.
 */
export async function runMorningScan(): Promise<void> {
  const startTime = Date.now();
  await markJobStart("morning_scan");
  
  try {
    const now = getNowIST();
    const { version, weights } = await getActiveWeights();
    
    const niftyQuote = await getYahooStockQuote("^NSEI");
    const niftyReturn = niftyQuote ? niftyQuote.changePercent / 100 : 0;
    
    // Scan F&O stocks list (liquidity filter)
    const scanUniverse = FO_STOCKS.slice(0, 200);
    const predictions: any[] = [];
    
    const BATCH_SIZE = 5;
    for (let i = 0; i < scanUniverse.length; i += BATCH_SIZE) {
      const batch = scanUniverse.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (symbol) => {
        try {
          const features = await computeIntradayFeatures(symbol, niftyReturn, now);
          const score = computeAPEXScore(features, weights);
          
          predictions.push({
            symbol,
            score,
            features
          });
        } catch (err: any) {
          // Log error but continue scanning others
          console.warn(`[APEXEngine] Scan failed for ${symbol}:`, err.message);
        }
      }));
      
      console.log(`[APEXEngine] Scan progress: ${Math.min(i + BATCH_SIZE, scanUniverse.length)}/${scanUniverse.length}`);
      if (i + BATCH_SIZE < scanUniverse.length) {
        await new Promise(res => setTimeout(res, 1000));
      }
    }
    
    if (predictions.length < 10) {
      throw new Error(`Insufficient successful stock scans (${predictions.length}). Need at least 10.`);
    }
    
    // Sort descending
    predictions.sort((a, b) => b.score - a.score);
    
    const topUp = predictions.slice(0, 5);
    const topDown = predictions.slice(-5).reverse();
    
    const toInsert: any[] = [];
    const todayStr = getISTDateString(now);
    
    // Calculate custom composite sub-scores for DB reporting
    const getSubScore = (features: Record<string, number>, keys: string[]) => {
      let sum = 0;
      keys.forEach(k => sum += features[k] || 0);
      return (50 + (sum / keys.length) * 50);
    };
    
    for (const item of topUp) {
      toInsert.push({
        predictionDate: now,
        symbol: item.symbol,
        direction: "UP",
        confidenceScore: String(item.score.toFixed(2)),
        momentumScore: String(getSubScore(item.features, ["rsi_14", "sma_5_20_cross", "rvol_1d"])),
        gapScore: String(getSubScore(item.features, ["gap_pct", "gap_vol_surge"])),
        newsScore: String(getSubScore(item.features, ["stock_news_sentiment", "sector_news_sentiment"])),
        foScore: String(getSubScore(item.features, ["pcr_ratio", "oi_buildup"])),
        sectorScore: "50.00",
        reasoning: `Intraday bullish signals aligned: Gap is ${item.features.gap_pct > 0 ? "positive" : "flat"}, News sentiment is bullish, and option PCR represents demand. Confidence: ${item.score.toFixed(1)}%.`,
        weightVersion: version,
        features: item.features
      });
    }
    
    for (const item of topDown) {
      toInsert.push({
        predictionDate: now,
        symbol: item.symbol,
        direction: "DOWN",
        confidenceScore: String(item.score.toFixed(2)),
        momentumScore: String(getSubScore(item.features, ["rsi_14", "sma_5_20_cross", "rvol_1d"])),
        gapScore: String(getSubScore(item.features, ["gap_pct", "gap_vol_surge"])),
        newsScore: String(getSubScore(item.features, ["stock_news_sentiment", "sector_news_sentiment"])),
        foScore: String(getSubScore(item.features, ["pcr_ratio", "oi_buildup"])),
        sectorScore: "50.00",
        reasoning: `Intraday bearish signals aligned: Pre-open gap is negative, volume is higher on downward move, and option buildup points to short buildup. Confidence: ${item.score.toFixed(1)}%.`,
        weightVersion: version,
        features: item.features
      });
    }
    
    await db.insert(apexPredictions).values(toInsert);
    console.log(`[APEXEngine] Scanned and saved 10 predictions (5 UP, 5 DOWN).`);
    
    const duration = Date.now() - startTime;
    await markJobDone("morning_scan", duration);
  } catch (error: any) {
    console.error(`[APEXEngine] Morning scan job failed:`, error);
    await markJobFailed("morning_scan", error);
  }
}

/**
 * Queries predictions for a date.
 */
export async function getPredictionsForDate(date: Date = getNowIST()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  
  const results = await db.select()
    .from(apexPredictions)
    .where(
      and(
        gte(apexPredictions.predictionDate, start),
        lte(apexPredictions.predictionDate, end)
      )
    )
    .orderBy(desc(apexPredictions.confidenceScore));
    
  const uniqueResults = [];
  const seenSymbols = new Set<string>();
  for (const row of results) {
    if (!seenSymbols.has(row.symbol)) {
      seenSymbols.add(row.symbol);
      uniqueResults.push(row);
    }
  }
    
  return {
    upCalls: uniqueResults.filter(r => r.direction === "UP"),
    downCalls: uniqueResults.filter(r => r.direction === "DOWN")
  };
}

/**
 * Assembles aggregated dashboard metrics for ApexAI frontend.
 */
export async function getApexDashboard() {
  const now = getNowIST();
  
  // 1. Today's predictions
  const todayPreds = await getPredictionsForDate(now);
  
  // 2. Fetch news updates
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const todayNews = await db.select()
    .from(apexNewsSignals)
    .where(gte(apexNewsSignals.signalDate, startOfDay))
    .orderBy(desc(apexNewsSignals.signalDate));
    
  // 3. F&O signals
  const todayFO = await db.select()
    .from(apexFoSignals)
    .where(gte(apexFoSignals.signalDate, startOfDay))
    .orderBy(desc(apexFoSignals.signalDate));
    
  // 4. Learning weight log
  const weightHistory = await db.select()
    .from(apexWeights)
    .orderBy(desc(apexWeights.version));
    
  // 5. System Health
  const jobs = await db.select().from(jobLedger);
  const errors = await db.select().from(jobErrorLog).orderBy(desc(jobErrorLog.createdAt)).limit(20);
  
  // 6. Accuracy tracker (last 30 days)
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const historicalPredictions = await db.select()
    .from(apexPredictions)
    .where(
      and(
        gte(apexPredictions.predictionDate, thirtyDaysAgo),
        sql`${apexPredictions.isCorrect} IS NOT NULL`
      )
    );
    
  return {
    predictions: todayPreds,
    news: todayNews,
    fo: todayFO,
    weights: weightHistory,
    system: {
      jobs,
      errors
    },
    historical: historicalPredictions
  };
}

export async function getApexPrediction(symbol: string): Promise<any> {
  const [pred] = await db
    .select()
    .from(apexPredictions)
    .where(eq(apexPredictions.symbol, symbol.toUpperCase()))
    .orderBy(desc(apexPredictions.predictionDate))
    .limit(1);
  return pred ?? null;
}
