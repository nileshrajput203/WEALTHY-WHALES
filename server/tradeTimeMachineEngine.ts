/**
 * TRADE TIME MACHINE — Deterministic Monte Carlo Replay & Outcome Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Designed for institutional quantitative reliability:
 *  1. Seeded Mulberry32 PRNG — Eliminates jitter & random drift on page refreshes.
 *  2. Empirical Bootstrapping from actual historical candle residuals.
 *  3. In-Memory Result Caching (15-min TTL) ensuring exact stability on reload.
 *  4. Dynamic ATR-based barrier resolution (Target 1, Stop Loss, Target 2).
 *  5. Maximum Adverse Excursion (MAE) & Expected Value (EV) per ₹1,000 risk.
 */

import { candleCache } from "./candleCache";

export interface TimeMachineParams {
  symbol: string;
  entryPrice?: number;
  stopLoss?: number;
  target1?: number;
  target2?: number;
  direction?: "LONG" | "SHORT";
  simulations?: number;
  horizonDays?: number;
}

export interface QuantilePathPoint {
  day: number;
  p5: number;
  p25: number;
  p50: number; // Median
  p75: number;
  p95: number;
  sampleBest: number;
  sampleWorst: number;
}

export interface DistributionBin {
  binLabel: string;
  count: number;
  percentage: number;
  isWin: boolean;
  isLoss: boolean;
}

export interface TimeMachineSimulationResult {
  symbol: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskRewardRatio: number;
  totalSimulations: number;
  horizonDays: number;
  timestamp: string;

  // Probabilistic Outcome Metrics
  winRatePct: number;
  stopOutPct: number;
  expiredPct: number;
  target2Pct: number;

  // Expected Value & Edge
  expectedValuePer1000Risk: number;
  profitFactor: number;
  riskPerShare: number;
  rewardPerShare: number;
  confidenceRating: "STRONG_EDGE" | "POSITIVE_EDGE" | "NEUTRAL_EDGE" | "NEGATIVE_EDGE";
  edgeSummary: string;

  // Time & Volatility Diagnostics
  medianDaysToOutcome: number;
  medianDaysToTarget: number;
  medianDaysToStop: number;
  annualizedVolatilityPct: number;
  dailyVolatilityPct: number;
  averageTrueRange: number;
  maxAdverseExcursionPct: number;
  p95AdverseExcursionPct: number;

  // Visual Replay Quantile Paths & Histogram
  quantilePaths: QuantilePathPoint[];
  distributionHistogram: DistributionBin[];
}

export function toYahooSymbol(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (!s) return s;
  if (/\.(NS|BO|NSE|BSE)$/i.test(s)) return s;
  if (s.startsWith("^")) return s;
  if (s.includes(":")) {
    const parts = s.split(":");
    return `${parts[1]}.NS`;
  }
  return `${s}.NS`;
}

/**
 * Deterministic Mulberry32 32-bit PRNG
 * Guarantees identical simulation sequence for a given seed across all refreshes.
 */
function createMulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Box-Muller Gaussian generator with seeded PRNG
 */
function seededGaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * String to 32-bit integer hash for stable seed derivation
 */
function hashStringToSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

// ── In-Memory Simulation Cache (15-min TTL) ──────────────────────────
const timeMachineCache = new Map<string, { result: TimeMachineSimulationResult; expiresAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

export async function runTradeTimeMachine(
  params: TimeMachineParams
): Promise<TimeMachineSimulationResult> {
  const symbol = params.symbol.toUpperCase();
  const yahooSym = toYahooSymbol(symbol);
  const direction = params.direction || "LONG";
  const numSims = Math.min(10000, Math.max(1000, params.simulations || 5000));
  const horizonDays = Math.min(60, Math.max(5, params.horizonDays || 25));

  // 1. Fetch 1 year of daily historical candles
  const candles = await candleCache.getCandlesCached(yahooSym, "1y", "1d");
  if (!candles || candles.length < 40) {
    throw new Error(`Insufficient historical market data for ${symbol} to run Monte Carlo replay.`);
  }

  const validCandles = candles.filter(c => c && c.close && c.high && c.low && c.open);
  const lastCandle = validCandles[validCandles.length - 1];
  const lastClose = Number(lastCandle.close);

  // 2. Resolve Trade Geometry
  const entryPrice = Number(params.entryPrice) > 0 ? Number(params.entryPrice) : lastClose;
  
  // Calculate 14-period Average True Range (ATR)
  const trueRanges: number[] = [];
  for (let i = 1; i < validCandles.length; i++) {
    const high = Number(validCandles[i].high);
    const low = Number(validCandles[i].low);
    const prevClose = Number(validCandles[i - 1].close);
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trueRanges.push(tr);
  }
  const atr = trueRanges.slice(-14).reduce((a, b) => a + b, 0) / 14 || (entryPrice * 0.02);
  const atrPct = (atr / entryPrice) * 100;

  let stopLoss = Number(params.stopLoss);
  let target1 = Number(params.target1);
  let target2 = Number(params.target2);

  if (!stopLoss || stopLoss <= 0) {
    stopLoss = direction === "LONG"
      ? Math.round((entryPrice - 1.8 * atr) * 100) / 100
      : Math.round((entryPrice + 1.8 * atr) * 100) / 100;
  }

  if (!target1 || target1 <= 0) {
    const risk = Math.abs(entryPrice - stopLoss);
    target1 = direction === "LONG"
      ? Math.round((entryPrice + 2.0 * risk) * 100) / 100
      : Math.round((entryPrice - 2.0 * risk) * 100) / 100;
  }

  if (!target2 || target2 <= 0) {
    const risk = Math.abs(entryPrice - stopLoss);
    target2 = direction === "LONG"
      ? Math.round((entryPrice + 3.5 * risk) * 100) / 100
      : Math.round((entryPrice - 3.5 * risk) * 100) / 100;
  }

  // Check cache for identical parameters
  const cacheKey = `${symbol}|${direction}|${entryPrice}|${stopLoss}|${target1}|${target2}|${horizonDays}|${numSims}`;
  const cached = timeMachineCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.result;
  }

  const riskPerShare = Math.abs(entryPrice - stopLoss);
  const rewardPerShare = Math.abs(target1 - entryPrice);
  const rrRatio = riskPerShare > 0 ? Math.round((rewardPerShare / riskPerShare) * 100) / 100 : 1;

  // 3. Extract Log Returns
  const logReturns: number[] = [];
  for (let i = 1; i < validCandles.length; i++) {
    const prev = Number(validCandles[i - 1].close);
    const curr = Number(validCandles[i].close);
    if (prev > 0 && curr > 0) {
      logReturns.push(Math.log(curr / prev));
    }
  }

  const meanReturn = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance = logReturns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / (logReturns.length - 1);
  const dailyVol = Math.sqrt(variance);
  const annualVolPct = Math.round(dailyVol * Math.sqrt(252) * 10000) / 100;
  const dailyVolPct = Math.round(dailyVol * 10000) / 100;

  // 4. Initialize Deterministic Seeded PRNG
  // Combines symbol, entry, SL, target, and last candle date to produce 100% reproducible outcomes
  const candleDateStr = lastCandle.time || String(lastCandle.timestamp || "");
  const seedString = `${symbol}_${entryPrice}_${stopLoss}_${target1}_${target2}_${horizonDays}_${candleDateStr}`;
  const seed = hashStringToSeed(seedString);
  const rng = createMulberry32(seed);

  // 5. Run Deterministic Multi-Path Monte Carlo Simulation
  let target1Hits = 0;
  let target2Hits = 0;
  let stopOuts = 0;
  let expiredCount = 0;

  const daysToResolution: number[] = [];
  const daysToWin: number[] = [];
  const daysToLoss: number[] = [];
  const winningAdverseExcursions: number[] = [];
  const finalReturns: number[] = [];

  const dayPrices: number[][] = Array.from({ length: horizonDays + 1 }, () => []);
  dayPrices[0] = Array(numSims).fill(entryPrice);

  for (let sim = 0; sim < numSims; sim++) {
    let price = entryPrice;
    let resolved = false;
    let hitT1 = false;
    let minPriceDuring = price;
    let maxPriceDuring = price;

    for (let day = 1; day <= horizonDays; day++) {
      if (!resolved) {
        // Hybrid Bootstrapping: 80% empirical historical jump + 20% random Gaussian shock
        const randomIndex = Math.floor(rng() * logReturns.length);
        const empiricalJump = logReturns[randomIndex];
        const gaussianShock = seededGaussian(rng) * dailyVol;
        const sampledReturn = 0.80 * empiricalJump + 0.20 * gaussianShock;

        // Daily Intraday High/Low simulation based on ATR ratio
        const prevPrice = price;
        price = prevPrice * Math.exp(sampledReturn);
        const intradayWiggle = (atr / entryPrice) * (0.4 + rng() * 0.4);
        const simHigh = Math.max(prevPrice, price) * (1 + intradayWiggle * 0.5);
        const simLow = Math.min(prevPrice, price) * (1 - intradayWiggle * 0.5);

        if (direction === "LONG") {
          minPriceDuring = Math.min(minPriceDuring, simLow);
          maxPriceDuring = Math.max(maxPriceDuring, simHigh);

          if (simLow <= stopLoss) {
            resolved = true;
            stopOuts++;
            daysToResolution.push(day);
            daysToLoss.push(day);
            finalReturns.push(-riskPerShare / entryPrice);
          } else if (simHigh >= target1) {
            if (!hitT1) {
              target1Hits++;
              hitT1 = true;
              daysToResolution.push(day);
              daysToWin.push(day);
              finalReturns.push(rewardPerShare / entryPrice);
              const drawdownPct = ((entryPrice - minPriceDuring) / entryPrice) * 100;
              winningAdverseExcursions.push(Math.max(0, drawdownPct));
            }
            if (simHigh >= target2) {
              target2Hits++;
              resolved = true;
            }
          }
        } else {
          maxPriceDuring = Math.max(maxPriceDuring, simHigh);
          minPriceDuring = Math.min(minPriceDuring, simLow);

          if (simHigh >= stopLoss) {
            resolved = true;
            stopOuts++;
            daysToResolution.push(day);
            daysToLoss.push(day);
            finalReturns.push(-riskPerShare / entryPrice);
          } else if (simLow <= target1) {
            if (!hitT1) {
              target1Hits++;
              hitT1 = true;
              daysToResolution.push(day);
              daysToWin.push(day);
              finalReturns.push(rewardPerShare / entryPrice);
              const drawdownPct = ((maxPriceDuring - entryPrice) / entryPrice) * 100;
              winningAdverseExcursions.push(Math.max(0, drawdownPct));
            }
            if (simLow <= target2) {
              target2Hits++;
              resolved = true;
            }
          }
        }
      }

      dayPrices[day].push(price);
    }

    if (!resolved && !hitT1) {
      expiredCount++;
      const returnPct = direction === "LONG"
        ? (price - entryPrice) / entryPrice
        : (entryPrice - price) / entryPrice;
      finalReturns.push(returnPct);
    }
  }

  // 6. Compute Quantile Paths
  const quantilePaths: QuantilePathPoint[] = [];
  for (let day = 0; day <= horizonDays; day++) {
    const sorted = [...dayPrices[day]].sort((a, b) => a - b);
    const n = sorted.length;
    quantilePaths.push({
      day,
      p5: Math.round(sorted[Math.floor(n * 0.05)] * 100) / 100,
      p25: Math.round(sorted[Math.floor(n * 0.25)] * 100) / 100,
      p50: Math.round(sorted[Math.floor(n * 0.50)] * 100) / 100,
      p75: Math.round(sorted[Math.floor(n * 0.75)] * 100) / 100,
      p95: Math.round(sorted[Math.floor(n * 0.95)] * 100) / 100,
      sampleBest: Math.round(sorted[n - 1] * 100) / 100,
      sampleWorst: Math.round(sorted[0] * 100) / 100,
    });
  }

  // 7. Probabilities & Expected Value (EV)
  const winRatePct = Math.round((target1Hits / numSims) * 1000) / 10;
  const stopOutPct = Math.round((stopOuts / numSims) * 1000) / 10;
  const expiredPct = Math.round((expiredCount / numSims) * 1000) / 10;
  const target2Pct = Math.round((target2Hits / numSims) * 1000) / 10;

  const winProb = winRatePct / 100;
  const stopProb = stopOutPct / 100;
  const ev = Math.round((winProb * rrRatio - stopProb * 1.0) * 1000);

  const totalWinDollars = target1Hits * rewardPerShare;
  const totalLossDollars = stopOuts * riskPerShare;
  const profitFactor = totalLossDollars > 0
    ? Math.round((totalWinDollars / totalLossDollars) * 100) / 100
    : 99.9;

  const medianDaysToOutcome = daysToResolution.length > 0
    ? [...daysToResolution].sort((a, b) => a - b)[Math.floor(daysToResolution.length / 2)]
    : Math.round(horizonDays / 2);
  const medianDaysToTarget = daysToWin.length > 0
    ? [...daysToWin].sort((a, b) => a - b)[Math.floor(daysToWin.length / 2)]
    : 0;
  const medianDaysToStop = daysToLoss.length > 0
    ? [...daysToLoss].sort((a, b) => a - b)[Math.floor(daysToLoss.length / 2)]
    : 0;

  winningAdverseExcursions.sort((a, b) => a - b);
  const maeMedian = winningAdverseExcursions.length > 0
    ? Math.round(winningAdverseExcursions[Math.floor(winningAdverseExcursions.length * 0.5)] * 10) / 10
    : Math.round((atrPct * 0.8) * 10) / 10;
  const maeP95 = winningAdverseExcursions.length > 0
    ? Math.round(winningAdverseExcursions[Math.floor(winningAdverseExcursions.length * 0.95)] * 10) / 10
    : Math.round((atrPct * 1.6) * 10) / 10;

  let confidenceRating: TimeMachineSimulationResult["confidenceRating"] = "NEUTRAL_EDGE";
  let edgeSummary = "";

  if (ev >= 350 && winRatePct >= 55) {
    confidenceRating = "STRONG_EDGE";
    edgeSummary = `High statistical expectancy (+₹${ev} EV per ₹1k risked). Setup boasts a ${winRatePct}% win probability and favorable ${rrRatio} R:R.`;
  } else if (ev >= 100 && winRatePct >= 48) {
    confidenceRating = "POSITIVE_EDGE";
    edgeSummary = `Favorable quant edge (+₹${ev} EV per ₹1k risked). Win probability stands at ${winRatePct}% with profit factor ${profitFactor}.`;
  } else if (ev >= -100 && ev < 100) {
    confidenceRating = "NEUTRAL_EDGE";
    edgeSummary = `Borderline statistical edge (₹${ev} EV). High friction zone; wait for a tighter entry closer to support or order block.`;
  } else {
    confidenceRating = "NEGATIVE_EDGE";
    edgeSummary = `Negative expectancy (-₹${Math.abs(ev)} EV per ₹1k risked). High risk of premature stop-out (${stopOutPct}%). Long entries discouraged.`;
  }

  // 8. Outcome Histogram
  const numBins = 10;
  const minReturn = -Math.max(0.10, riskPerShare / entryPrice * 1.5);
  const maxReturn = Math.max(0.15, (target2 - entryPrice) / entryPrice * 1.2);
  const binWidth = (maxReturn - minReturn) / numBins;
  const distributionHistogram: DistributionBin[] = [];

  for (let b = 0; b < numBins; b++) {
    const binLow = minReturn + b * binWidth;
    const binHigh = binLow + binWidth;
    const count = finalReturns.filter(r => r >= binLow && (b === numBins - 1 ? r <= binHigh : r < binHigh)).length;
    const pct = Math.round((count / numSims) * 1000) / 10;
    const midPct = (binLow + binHigh) / 2 * 100;
    distributionHistogram.push({
      binLabel: `${midPct >= 0 ? "+" : ""}${midPct.toFixed(1)}%`,
      count,
      percentage: pct,
      isWin: midPct > 0.5,
      isLoss: midPct < -0.5,
    });
  }

  const result: TimeMachineSimulationResult = {
    symbol,
    direction,
    entryPrice,
    stopLoss,
    target1,
    target2,
    riskRewardRatio: rrRatio,
    totalSimulations: numSims,
    horizonDays,
    timestamp: new Date().toISOString(),
    winRatePct,
    stopOutPct,
    expiredPct,
    target2Pct,
    expectedValuePer1000Risk: ev,
    profitFactor,
    riskPerShare: Math.round(riskPerShare * 100) / 100,
    rewardPerShare: Math.round(rewardPerShare * 100) / 100,
    confidenceRating,
    edgeSummary,
    medianDaysToOutcome,
    medianDaysToTarget,
    medianDaysToStop,
    annualizedVolatilityPct: annualVolPct,
    dailyVolatilityPct: dailyVolPct,
    averageTrueRange: Math.round(atr * 100) / 100,
    maxAdverseExcursionPct: maeMedian,
    p95AdverseExcursionPct: maeP95,
    quantilePaths,
    distributionHistogram,
  };

  // Cache result for 15 minutes
  timeMachineCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });

  return result;
}
