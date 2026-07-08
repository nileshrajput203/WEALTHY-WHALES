import { getYahooHistory, computeEMA, computeRSI, computeSMA, computeATR } from "./stockApi";
import { NSE_UNIQUE } from "./nseUniverse";
import { calculateStockIQ } from "./stockiq";
import { db } from "./db";
import { confluenceSignals } from "@shared/schema";
import { getNowIST } from "./istUtils";

interface PatternMatch {
  symbol: string;
  stockName: string;
  price: number;
  changePercent: number;
  volume: string;
  pattern: string;
  stage: "Near Breakout" | "Breakout Confirmed" | "Consolidation" | "Pullback";
  details: string;
  probability: number; // 0-100: confidence score
  riskRewardRatio: number; // target / stop-loss
  expectedReturn: number; // % expected move
}

interface PatternFeatures {
  trendStrength: number; // 0-1
  volumeConfirmation: number; // 0-1
  technicalAlignment: number; // 0-1
  timeToBreakout: number; // days
  volatilityRank: number; // 0-100
}

/**
 * Enhanced VCP Detection with Probability Scoring
 * Bayesian approach: combines multiple technical factors for confidence
 */
function detectVCPEnhanced(
  closes: number[],
  highs: number[],
  lows: number[],
  vols: number[]
): { match: boolean; stage: PatternMatch["stage"]; details: string; probability: number; features: PatternFeatures } | null {
  const n = closes.length;
  if (n < 200) return null;

  const currentPrice = closes[n - 1];
  const ema50 = computeEMA(closes, 50);
  const ema150 = computeEMA(closes, 150);
  const ema200 = computeEMA(closes, 200);
  const rsi14 = computeRSI(closes, 14);

  const e50 = ema50[n - 1];
  const e150 = ema150[n - 1];
  const e200 = ema200[n - 1];
  const currentRsi = rsi14[n - 1] || 50;

  // Trend template check
  if (!(currentPrice > e50 && e50 > e150 && e150 > e200)) return null;

  // 52-week highs/lows
  const lookback52 = Math.min(n, 250);
  const high52 = Math.max(...highs.slice(n - lookback52));
  const low52 = Math.min(...lows.slice(n - lookback52));

  if (currentPrice < low52 * 1.30 || currentPrice < high52 * 0.75) return null;

  // Volatility contraction
  const recentVol = Math.max(...closes.slice(n - 10)) - Math.min(...closes.slice(n - 10));
  const pastVol = Math.max(...closes.slice(n - 50, n - 10)) - Math.min(...closes.slice(n - 50, n - 10));
  const volContraction = (pastVol - recentVol) / pastVol;

  if (volContraction < 0.15) return null; // Insufficient contraction

  // Volume dry-up
  const recentVolAvg = vols.slice(n - 3).reduce((a, b) => a + b, 0) / 3;
  const pastVolAvg = vols.slice(n - 50).reduce((a, b) => a + b, 0) / 50;
  const volDryUp = (pastVolAvg - recentVolAvg) / pastVolAvg;

  if (volDryUp < 0.10) return null; // Insufficient dry-up

  // ─── PROBABILITY SCORING (Bayesian) ───────────────────────
  let probability = 50; // Base case

  // Trend strength (0-20 points)
  const trendStrength = (currentPrice - e200) / (high52 - low52);
  probability += Math.min(20, trendStrength * 100);

  // EMA alignment (0-15 points)
  const emaGap50_200 = (e50 - e200) / e200;
  probability += Math.min(15, emaGap50_200 * 50);

  // RSI positioning (0-15 points)
  if (currentRsi > 40 && currentRsi < 70) {
    probability += 15; // Sweet spot for breakout
  } else if (currentRsi > 30 && currentRsi < 80) {
    probability += 10;
  }

  // Volatility contraction strength (0-20 points)
  probability += Math.min(20, volContraction * 100);

  // Volume dry-up strength (0-15 points)
  probability += Math.min(15, volDryUp * 100);

  // Price proximity to high (0-15 points)
  const proximityToHigh = (currentPrice - (high52 * 0.85)) / (high52 * 0.15);
  probability += Math.min(15, Math.max(0, proximityToHigh * 100));

  // Cap at 100
  probability = Math.min(100, probability);

  const isBreakingOut = currentPrice >= high52 * 0.985;
  const stage = isBreakingOut ? "Breakout Confirmed" : "Near Breakout";

  return {
    match: true,
    stage,
    details: `VCP: Trend ${(trendStrength * 100).toFixed(1)}%, Vol Contraction ${(volContraction * 100).toFixed(1)}%, Dry-up ${(volDryUp * 100).toFixed(1)}%`,
    probability: Math.round(probability),
    features: {
      trendStrength,
      volumeConfirmation: volDryUp,
      technicalAlignment: emaGap50_200,
      timeToBreakout: 5, // Estimated days
      volatilityRank: (volContraction * 100),
    },
  };
}

/**
 * Enhanced Cup-and-Handle with Probability
 */
function detectCupAndHandleEnhanced(
  closes: number[],
  highs: number[],
  lows: number[]
): { match: boolean; stage: PatternMatch["stage"]; details: string; probability: number; features: PatternFeatures } | null {
  const n = closes.length;
  if (n < 60) return null;

  const subCloses = closes.slice(n - 60);
  const current = subCloses[subCloses.length - 1];

  // Find cup structure
  let leftRimIdx = -1;
  let leftRimVal = 0;
  for (let i = 10; i < 40; i++) {
    if (subCloses[i] > leftRimVal && subCloses[i] > subCloses[i - 5] && subCloses[i] > subCloses[i + 5]) {
      leftRimVal = subCloses[i];
      leftRimIdx = i;
    }
  }
  if (leftRimIdx === -1) return null;

  let cupBottomVal = leftRimVal;
  let cupBottomIdx = -1;
  for (let i = leftRimIdx + 5; i < 50; i++) {
    if (subCloses[i] < cupBottomVal) {
      cupBottomVal = subCloses[i];
      cupBottomIdx = i;
    }
  }
  if (cupBottomIdx === -1) return null;

  const cupDepth = (leftRimVal - cupBottomVal) / leftRimVal;
  if (cupDepth < 0.10 || cupDepth > 0.30) return null;

  let rightRimIdx = -1;
  let rightRimVal = 0;
  for (let i = cupBottomIdx + 5; i < 55; i++) {
    const price = subCloses[i];
    if (Math.abs(price - leftRimVal) / leftRimVal <= 0.05) {
      if (price > rightRimVal) {
        rightRimVal = price;
        rightRimIdx = i;
      }
    }
  }
  if (rightRimIdx === -1) return null;

  let handleBottomVal = rightRimVal;
  for (let i = rightRimIdx + 1; i < subCloses.length; i++) {
    if (subCloses[i] < handleBottomVal) {
      handleBottomVal = subCloses[i];
    }
  }

  const handlePullback = (rightRimVal - handleBottomVal) / rightRimVal;
  if (handlePullback < 0.015 || handlePullback > 0.10) return null;

  // ─── PROBABILITY SCORING ───────────────────────
  let probability = 50;

  // Cup symmetry (0-20 points)
  const leftReboundFromBottom = (leftRimVal - cupBottomVal) / cupBottomVal;
  const rightReboundFromBottom = (rightRimVal - cupBottomVal) / cupBottomVal;
  const symmetry = 1 - Math.abs(leftReboundFromBottom - rightReboundFromBottom) / Math.max(leftReboundFromBottom, rightReboundFromBottom);
  probability += symmetry * 20;

  // Cup depth quality (0-20 points)
  if (cupDepth >= 0.12 && cupDepth <= 0.25) probability += 20;
  else if (cupDepth >= 0.10 && cupDepth <= 0.30) probability += 15;

  // Handle pullback quality (0-20 points)
  if (handlePullback >= 0.02 && handlePullback <= 0.08) probability += 20;
  else if (handlePullback >= 0.015 && handlePullback <= 0.10) probability += 15;

  // Breakout confirmation (0-20 points)
  const isBreakingOut = current >= rightRimVal * 0.99;
  if (isBreakingOut) probability += 20;
  else if (current >= rightRimVal * 0.95) probability += 10;

  // Volume confirmation (0-20 points)
  // (would need volume data for full scoring)
  probability += 10;

  probability = Math.min(100, probability);

  const stage = isBreakingOut ? "Breakout Confirmed" : "Near Breakout";

  return {
    match: true,
    stage,
    details: `Cup depth: ${(cupDepth * 100).toFixed(1)}%, handle: -${(handlePullback * 100).toFixed(1)}%, symmetry: ${(symmetry * 100).toFixed(1)}%`,
    probability: Math.round(probability),
    features: {
      trendStrength: symmetry,
      volumeConfirmation: 0.5,
      technicalAlignment: 1 - handlePullback,
      timeToBreakout: 3,
      volatilityRank: (cupDepth * 100),
    },
  };
}

/**
 * Scan all stocks for patterns with probability scoring
 */
export async function runPatternScannerEnhanced(): Promise<PatternMatch[]> {
  const results: PatternMatch[] = [];
  const scanUniverse = NSE_UNIQUE.slice(0, 300); // Scan top 300 stocks

  for (const symbol of scanUniverse) {
    try {
      const yahooSym = `${symbol}.NS`;
      const candles = await getYahooHistory(yahooSym, '1y', '1d');

      if (!candles || candles.length < 60) continue;

      const closes = candles.map((c: any) => c.close);
      const highs = candles.map((c: any) => c.high);
      const lows = candles.map((c: any) => c.low);
      const vols = candles.map((c: any) => c.volume);
      const currentPrice = closes[closes.length - 1];

      // Try VCP detection
      const vcpResult = detectVCPEnhanced(closes, highs, lows, vols);
      if (vcpResult?.match) {
        results.push({
          symbol,
          stockName: symbol,
          price: currentPrice,
          changePercent: ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100,
          volume: vols[vols.length - 1]?.toLocaleString() || '0',
          pattern: 'VCP',
          stage: vcpResult.stage,
          details: vcpResult.details,
          probability: vcpResult.probability,
          riskRewardRatio: 2.5, // Typical for VCP
          expectedReturn: 12.5, // 10-15% typical
        });
      }

      // Try Cup-and-Handle detection
      const cupResult = detectCupAndHandleEnhanced(closes, highs, lows);
      if (cupResult?.match) {
        results.push({
          symbol,
          stockName: symbol,
          price: currentPrice,
          changePercent: ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100,
          volume: vols[vols.length - 1]?.toLocaleString() || '0',
          pattern: 'Cup & Handle',
          stage: cupResult.stage,
          details: cupResult.details,
          probability: cupResult.probability,
          riskRewardRatio: 2.0,
          expectedReturn: 10.0,
        });
      }
    } catch (err) {
      // Continue scanning
    }
  }

  // Sort by probability
  results.sort((a, b) => b.probability - a.probability);

  // Store top results in confluence signals
  const now = getNowIST();
  for (const result of results.slice(0, 50)) {
    try {
      await db.insert(confluenceSignals).values({
        symbol: result.symbol,
        signalDate: now,
        confluenceScore: result.probability,
        recommendation: result.probability > 70 ? 'STRONG_BUY' : result.probability > 50 ? 'BUY' : 'HOLD',
      }).onConflictDoNothing();
    } catch (err) {
      // Continue
    }
  }

  return results;
}

export async function getPatternScanResults(minProbability = 60): Promise<PatternMatch[]> {
  const results = await runPatternScannerEnhanced();
  return results.filter(r => r.probability >= minProbability);
}
