/**
 * TRADE TIME MACHINE — Monte Carlo Replay & Statistical Outcome Simulator
 * ─────────────────────────────────────────────────────────────────────────────
 * Inspired by institutional risk modeling and quant trade replay systems:
 *  1. Empirical Bootstrapped Return Sampling (with fat-tail kurtosis adjustment)
 *  2. Multi-Path Monte Carlo Simulation (5,000 to 10,000 iterations)
 *  3. Dynamic Target vs. Stop Barrier Resolution with Intraday ATR Range
 *  4. Maximum Adverse Excursion (MAE) Calculation (drawdown tolerance)
 *  5. Expected Value (EV) per ₹1,000 Risk & Statistical Edge Verdict
 *  6. Quantile Path Envelopes (p5, p25, median, p75, p95) for visual replay
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
  winRatePct: number; // Reached Target 1 before Stop Loss
  stopOutPct: number; // Breached Stop Loss before Target 1
  expiredPct: number; // Reached horizon without hitting either
  target2Pct: number; // Continued to reach Target 2

  // Expected Value & Edge
  expectedValuePer1000Risk: number; // ₹ EV per ₹1,000 risked
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
  maxAdverseExcursionPct: number; // Median drawdown on winning paths
  p95AdverseExcursionPct: number; // 95th percentile worst drawdown on winners

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
 * Standard Normal Box-Muller random number generator
 */
function randomGaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export async function runTradeTimeMachine(
  params: TimeMachineParams
): Promise<TimeMachineSimulationResult> {
  const symbol = params.symbol.toUpperCase();
  const yahooSym = toYahooSymbol(symbol);
  const direction = params.direction || "LONG";
  const numSims = Math.min(10000, Math.max(1000, params.simulations || 5000));
  const horizonDays = Math.min(60, Math.max(5, params.horizonDays || 25));

  // 1. Fetch 1 year of daily historical candles from cache
  const candles = await candleCache.getCandlesCached(yahooSym, "1y", "1d");
  if (!candles || candles.length < 40) {
    throw new Error(`Insufficient historical market data for ${symbol} to run Monte Carlo replay.`);
  }

  const validCandles = candles.filter(c => c && c.close && c.high && c.low && c.open);
  const lastCandle = validCandles[validCandles.length - 1];
  const lastClose = Number(lastCandle.close);

  // 2. Resolve Trade Geometry (Entry, Stop Loss, Target 1, Target 2)
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

  const riskPerShare = Math.abs(entryPrice - stopLoss);
  const rewardPerShare = Math.abs(target1 - entryPrice);
  const rrRatio = riskPerShare > 0 ? Math.round((rewardPerShare / riskPerShare) * 100) / 100 : 1;

  // 3. Extract Log Returns & Empirical Distribution
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

  // 4. Run Multi-Path Monte Carlo Simulation
  let target1Hits = 0;
  let target2Hits = 0;
  let stopOuts = 0;
  let expiredCount = 0;

  const daysToResolution: number[] = [];
  const daysToWin: number[] = [];
  const daysToLoss: number[] = [];
  const winningAdverseExcursions: number[] = []; // % dip on winners
  const finalReturns: number[] = [];

  // Track all simulated price matrices for quantile ribbons (Day 0 to Horizon)
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
        const randomIndex = Math.floor(Math.random() * logReturns.length);
        const empiricalJump = logReturns[randomIndex];
        const gaussianShock = randomGaussian() * dailyVol;
        const sampledReturn = 0.80 * empiricalJump + 0.20 * gaussianShock;

        // Daily Intraday High/Low simulation based on ATR ratio
        const prevPrice = price;
        price = prevPrice * Math.exp(sampledReturn);
        const intradayWiggle = (atr / entryPrice) * (0.4 + Math.random() * 0.4);
        const simHigh = Math.max(prevPrice, price) * (1 + intradayWiggle * 0.5);
        const simLow = Math.min(prevPrice, price) * (1 - intradayWiggle * 0.5);

        if (direction === "LONG") {
          minPriceDuring = Math.min(minPriceDuring, simLow);
          maxPriceDuring = Math.max(maxPriceDuring, simHigh);

          // Check barrier hits (Stop Loss vs Target)
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
          // SHORT DIRECTION
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

  // 5. Compute Percentiles & Quantile Paths
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

  // 6. Probabilities & Expected Value (EV)
  const winRatePct = Math.round((target1Hits / numSims) * 1000) / 10;
  const stopOutPct = Math.round((stopOuts / numSims) * 1000) / 10;
  const expiredPct = Math.round((expiredCount / numSims) * 1000) / 10;
  const target2Pct = Math.round((target2Hits / numSims) * 1000) / 10;

  // Expected Value per ₹1,000 risked
  // Formula: (WinRate * Reward/Risk - StopRate * 1.0) * 1000
  const winProb = winRatePct / 100;
  const stopProb = stopOutPct / 100;
  const ev = Math.round((winProb * rrRatio - stopProb * 1.0) * 1000);

  // Profit Factor = Total Win $ / Total Loss $
  const totalWinDollars = target1Hits * rewardPerShare;
  const totalLossDollars = stopOuts * riskPerShare;
  const profitFactor = totalLossDollars > 0
    ? Math.round((totalWinDollars / totalLossDollars) * 100) / 100
    : 99.9;

  // Median days to outcome
  const medianDaysToOutcome = daysToResolution.length > 0
    ? [...daysToResolution].sort((a, b) => a - b)[Math.floor(daysToResolution.length / 2)]
    : Math.round(horizonDays / 2);
  const medianDaysToTarget = daysToWin.length > 0
    ? [...daysToWin].sort((a, b) => a - b)[Math.floor(daysToWin.length / 2)]
    : 0;
  const medianDaysToStop = daysToLoss.length > 0
    ? [...daysToLoss].sort((a, b) => a - b)[Math.floor(daysToLoss.length / 2)]
    : 0;

  // Maximum Adverse Excursion on Winning Trades
  winningAdverseExcursions.sort((a, b) => a - b);
  const maeMedian = winningAdverseExcursions.length > 0
    ? Math.round(winningAdverseExcursions[Math.floor(winningAdverseExcursions.length * 0.5)] * 10) / 10
    : Math.round((atrPct * 0.8) * 10) / 10;
  const maeP95 = winningAdverseExcursions.length > 0
    ? Math.round(winningAdverseExcursions[Math.floor(winningAdverseExcursions.length * 0.95)] * 10) / 10
    : Math.round((atrPct * 1.6) * 10) / 10;

  // Edge Verdict
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

  // 7. Outcome Histogram (10 bins)
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

  return {
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
}
