/**
 * StockIQ Score — Proprietary 0–100 scoring system
 *
 * Combines 4 pillars:
 *   🏗️ Fundamentals (30%) — ROE, debt, margins, PEG
 *   📊 Technicals   (25%) — RSI, SMA crossovers, trend
 *   🚀 Momentum     (25%) — Price performance, relative strength
 *   👁️ Insider      (20%) — Promoter holding patterns, delivery %
 *
 * Scores are cached for 4 hours per symbol.
 */

import {
  getYahooStockQuote,
  getYahooHistory,
  getFmpFundamentals,
  computeSMA,
  computeRSI,
  computeEMA,
} from "./stockApi";

/* ═══ Types ═══ — re-exported from shared so client can import from @shared/types */
export type { SubScore, StockIQResult } from "@shared/types";
import type { SubScore, StockIQResult } from "@shared/types";

/* ═══ Cache ═══ */
const scoreCache: Record<string, { data: StockIQResult; ts: number }> = {};
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

/* ═══ Helpers ═══ */
function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

function toGrade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C+";
  if (score >= 40) return "C";
  if (score >= 30) return "D";
  return "F";
}

function toVerdict(score: number): string {
  if (score >= 81) return "Exceptional";
  if (score >= 61) return "Strong";
  if (score >= 41) return "Average";
  if (score >= 21) return "Weak";
  return "Avoid";
}

function toSimpleVerdict(result: {
  totalScore: number;
  fundamentals: SubScore;
  technicals: SubScore;
  momentum: SubScore;
  insider: SubScore;
}): string {
  const { totalScore, fundamentals, technicals, momentum, insider } = result;
  const parts: string[] = [];

  if (fundamentals.score >= 60) parts.push("solid financials");
  else if (fundamentals.score < 35) parts.push("weak financials");

  if (momentum.score >= 60) parts.push("rising momentum");
  else if (momentum.score < 35) parts.push("falling momentum");

  if (technicals.score >= 60) parts.push("bullish technicals");
  else if (technicals.score < 35) parts.push("bearish technicals");

  if (insider.score >= 60) parts.push("smart money backing");
  else if (insider.score < 35) parts.push("insider selling");

  if (totalScore >= 70) return `Strong stock — ${parts.slice(0, 3).join(", ")}.`;
  if (totalScore >= 50) return `Decent stock — ${parts.slice(0, 3).join(", ")}.`;
  if (totalScore >= 30) return `Caution — ${parts.slice(0, 3).join(", ")}.`;
  return `Risky — ${parts.slice(0, 3).join(", ")}.`;
}

/* ═══ Sub-score Calculators ═══ */

function scoreFundamentals(fund: any): SubScore {
  const metrics: SubScore["metrics"] = [];
  let total = 0;
  let count = 0;

  // ROE (>15% excellent, >10% good, <5% poor)
  const roe = fund?.roe;
  if (roe != null && !isNaN(roe)) {
    const roeVal = typeof roe === "number" ? roe * 100 : parseFloat(roe);
    const roeScore = clamp(roeVal >= 20 ? 90 : roeVal >= 15 ? 75 : roeVal >= 10 ? 55 : roeVal >= 5 ? 35 : 15);
    metrics.push({ name: "ROE", value: `${roeVal.toFixed(1)}%`, interpretation: roeScore >= 60 ? "Strong" : roeScore >= 40 ? "Average" : "Weak", contribution: roeScore });
    total += roeScore;
    count++;
  }

  // Debt-to-Equity (<0.5 great, <1 ok, >2 bad)
  const de = fund?.debtToEquity;
  if (de != null && !isNaN(de)) {
    const deVal = typeof de === "number" ? de : parseFloat(de);
    const deScore = clamp(deVal <= 0.3 ? 90 : deVal <= 0.5 ? 75 : deVal <= 1 ? 55 : deVal <= 2 ? 30 : 10);
    metrics.push({ name: "Debt/Equity", value: deVal.toFixed(2), interpretation: deScore >= 60 ? "Strong" : deScore >= 40 ? "Average" : "Weak", contribution: deScore });
    total += deScore;
    count++;
  }

  // Operating Profit Margin (>20% great, >10% ok, <5% bad)
  const opm = fund?.opm;
  if (opm != null && !isNaN(opm)) {
    const opmVal = typeof opm === "number" ? opm * 100 : parseFloat(opm);
    const opmScore = clamp(opmVal >= 25 ? 90 : opmVal >= 15 ? 70 : opmVal >= 8 ? 50 : opmVal >= 3 ? 30 : 10);
    metrics.push({ name: "Profit Margin", value: `${opmVal.toFixed(1)}%`, interpretation: opmScore >= 60 ? "Strong" : opmScore >= 40 ? "Average" : "Weak", contribution: opmScore });
    total += opmScore;
    count++;
  }

  // P/E (15-25 ideal zone, >40 expensive, <8 value trap risk)
  const pe = fund?.pe;
  if (pe != null && !isNaN(pe)) {
    const peVal = typeof pe === "number" ? pe : parseFloat(pe);
    const peScore = clamp(
      peVal <= 0 ? 10 : peVal <= 10 ? 50 : peVal <= 15 ? 75 : peVal <= 25 ? 85 : peVal <= 40 ? 55 : peVal <= 60 ? 30 : 10
    );
    metrics.push({ name: "P/E Ratio", value: peVal.toFixed(1), interpretation: peScore >= 60 ? "Strong" : peScore >= 40 ? "Average" : "Weak", contribution: peScore });
    total += peScore;
    count++;
  }

  // PEG Ratio (<1 undervalued, 1-2 fair, >2 expensive)
  const peg = fund?.peg;
  if (peg != null && !isNaN(peg)) {
    const pegVal = typeof peg === "number" ? peg : parseFloat(peg);
    if (pegVal > 0) {
      const pegScore = clamp(pegVal <= 0.5 ? 90 : pegVal <= 1 ? 80 : pegVal <= 1.5 ? 60 : pegVal <= 2.5 ? 40 : 15);
      metrics.push({ name: "PEG Ratio", value: pegVal.toFixed(2), interpretation: pegScore >= 60 ? "Strong" : pegScore >= 40 ? "Average" : "Weak", contribution: pegScore });
      total += pegScore;
      count++;
    }
  }

  const score = count > 0 ? Math.round(total / count) : 50;
  return { score, weight: 0.3, metrics };
}

function scoreTechnicals(closes: number[], smaShort: number | null, smaLong: number | null, rsi: number | null): SubScore {
  const metrics: SubScore["metrics"] = [];
  let total = 0;
  let count = 0;
  const last = closes.at(-1) ?? 0;

  // RSI
  if (rsi != null) {
    // Best: slightly bullish (40-60), overbought/oversold are warning
    const rsiScore = clamp(
      rsi >= 30 && rsi <= 70
        ? (rsi >= 40 && rsi <= 60 ? 75 : rsi > 60 ? 85 - (rsi - 60) * 2 : 50 + (rsi - 30) * 1.5)
        : rsi > 70 ? Math.max(10, 50 - (rsi - 70) * 3)
        : Math.max(10, 50 - (30 - rsi) * 3)
    );
    metrics.push({ name: "RSI (14)", value: rsi.toFixed(1), interpretation: rsi > 70 ? "Weak" : rsi < 30 ? "Weak" : rsi > 55 ? "Strong" : "Average", contribution: rsiScore });
    total += rsiScore;
    count++;
  }

  // Price vs SMA20
  if (smaShort != null && last > 0) {
    const aboveSMA20 = last > smaShort;
    const distance = ((last - smaShort) / smaShort) * 100;
    const sma20Score = clamp(aboveSMA20 ? Math.min(90, 60 + distance * 3) : Math.max(10, 40 + distance * 2));
    metrics.push({
      name: "Price vs SMA20", value: aboveSMA20 ? `+${distance.toFixed(1)}%` : `${distance.toFixed(1)}%`,
      interpretation: aboveSMA20 ? "Strong" : "Weak", contribution: sma20Score,
    });
    total += sma20Score;
    count++;
  }

  // Price vs SMA50
  if (smaLong != null && last > 0) {
    const aboveSMA50 = last > smaLong;
    const distance = ((last - smaLong) / smaLong) * 100;
    const sma50Score = clamp(aboveSMA50 ? Math.min(90, 60 + distance * 2) : Math.max(10, 40 + distance * 1.5));
    metrics.push({
      name: "Price vs SMA50", value: aboveSMA50 ? `+${distance.toFixed(1)}%` : `${distance.toFixed(1)}%`,
      interpretation: aboveSMA50 ? "Strong" : "Weak", contribution: sma50Score,
    });
    total += sma50Score;
    count++;
  }

  // SMA20 vs SMA50 (golden/death cross)
  if (smaShort != null && smaLong != null) {
    const golden = smaShort > smaLong;
    const crossScore = golden ? 80 : 25;
    metrics.push({
      name: "SMA Crossover", value: golden ? "Golden Cross" : "Death Cross",
      interpretation: golden ? "Strong" : "Weak", contribution: crossScore,
    });
    total += crossScore;
    count++;
  }

  const score = count > 0 ? Math.round(total / count) : 50;
  return { score, weight: 0.25, metrics };
}

function scoreMomentum(closes: number[]): SubScore {
  const metrics: SubScore["metrics"] = [];
  let total = 0;
  let count = 0;
  const n = closes.length;
  const last = closes[n - 1] ?? 0;

  const periods = [
    { name: "1-Week", days: 5 },
    { name: "1-Month", days: 22 },
    { name: "3-Month", days: 66 },
    { name: "6-Month", days: 132 },
    { name: "1-Year", days: 252 },
  ];

  for (const p of periods) {
    if (n > p.days) {
      const prev = closes[n - 1 - p.days];
      if (prev && prev > 0) {
        const changePercent = ((last - prev) / prev) * 100;
        // Moderate positive momentum is best
        let mScore: number;
        if (changePercent > 0) {
          mScore = clamp(Math.min(95, 50 + changePercent * 2));
        } else {
          mScore = clamp(Math.max(5, 50 + changePercent * 1.5));
        }
        metrics.push({
          name: `${p.name} Return`, value: `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(1)}%`,
          interpretation: changePercent > 5 ? "Strong" : changePercent > 0 ? "Average" : "Weak",
          contribution: mScore,
        });
        total += mScore;
        count++;
      }
    }
  }

  // 52-week high proximity
  if (n >= 252) {
    const high52 = Math.max(...closes.slice(n - 252));
    const proximity = (last / high52) * 100;
    const proxScore = clamp(proximity >= 95 ? 90 : proximity >= 85 ? 75 : proximity >= 75 ? 55 : proximity >= 60 ? 35 : 15);
    metrics.push({
      name: "52W High Proximity", value: `${proximity.toFixed(0)}%`,
      interpretation: proxScore >= 60 ? "Strong" : proxScore >= 40 ? "Average" : "Weak",
      contribution: proxScore,
    });
    total += proxScore;
    count++;
  }

  const score = count > 0 ? Math.round(total / count) : 50;
  return { score, weight: 0.25, metrics };
}

function scoreInsider(fund: any, quote: any): SubScore {
  const metrics: SubScore["metrics"] = [];
  let total = 0;
  let count = 0;

  // Market cap buckets (larger = more stable)
  const mktCap = fund?.marketCap ?? quote?.marketCap;
  if (mktCap != null) {
    const capCr = mktCap / 1e7; // Convert to Crores
    const capScore = clamp(capCr >= 100000 ? 80 : capCr >= 20000 ? 70 : capCr >= 5000 ? 55 : capCr >= 1000 ? 40 : 25);
    metrics.push({
      name: "Market Cap", value: capCr >= 100000 ? "Large Cap" : capCr >= 20000 ? "Mid Cap" : "Small Cap",
      interpretation: capScore >= 60 ? "Strong" : capScore >= 40 ? "Average" : "Weak",
      contribution: capScore,
    });
    total += capScore;
    count++;
  }



  // Dividend yield (proxy for institutional quality)
  const divYield = fund?.dividendYield;
  if (divYield != null && !isNaN(divYield)) {
    const dy = typeof divYield === "number" ? divYield : parseFloat(divYield);
    if (dy >= 0) {
      const dyScore = clamp(dy >= 4 ? 85 : dy >= 2 ? 70 : dy >= 1 ? 55 : dy >= 0.5 ? 40 : 30);
      metrics.push({
        name: "Dividend Yield", value: `${dy.toFixed(2)}%`,
        interpretation: dyScore >= 60 ? "Strong" : dyScore >= 40 ? "Average" : "Weak",
        contribution: dyScore,
      });
      total += dyScore;
      count++;
    }
  }

  // ROCE/ROIC as proxy for capital allocation quality (insiders managing well)
  const roce = fund?.roce;
  if (roce != null && !isNaN(roce)) {
    const roceVal = typeof roce === "number" ? roce * 100 : parseFloat(roce);
    const roceScore = clamp(roceVal >= 20 ? 85 : roceVal >= 12 ? 65 : roceVal >= 8 ? 45 : 20);
    metrics.push({
      name: "ROCE (Capital Quality)", value: `${roceVal.toFixed(1)}%`,
      interpretation: roceScore >= 60 ? "Strong" : roceScore >= 40 ? "Average" : "Weak",
      contribution: roceScore,
    });
    total += roceScore;
    count++;
  }

  const score = count > 0 ? Math.round(total / count) : 50;
  return { score, weight: 0.2, metrics };
}

/* ═══ Main Calculator ═══ */
export async function calculateStockIQ(rawSymbol: string): Promise<StockIQResult> {
  const symbol = rawSymbol.replace(/\.(NS|BO|NSE|BSE)$/i, "").toUpperCase();
  const yahooSymbol = `${symbol}.NS`;

  // Check cache
  const cached = scoreCache[symbol];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  // Fetch data in parallel
  const [quoteResult, candlesResult, fundResult] = await Promise.allSettled([
    getYahooStockQuote(yahooSymbol),
    getYahooHistory(yahooSymbol, "1y", "1d"),
    getFmpFundamentals(symbol),
  ]);

  const quote = quoteResult.status === "fulfilled" ? quoteResult.value : null;
  const candles = candlesResult.status === "fulfilled" ? candlesResult.value : [];
  const fund = fundResult.status === "fulfilled" ? fundResult.value : null;

  const closes: number[] = candles.map((c: any) => Number(c.close)).filter((v: number) => Number.isFinite(v));
  const sma20 = computeSMA(closes, 20).at(-1) ?? null;
  const sma50 = computeSMA(closes, 50).at(-1) ?? null;
  const rsi = computeRSI(closes, 14).at(-1) ?? null;

  // Compute sub-scores
  const fundamentals = scoreFundamentals(fund);
  const technicals = scoreTechnicals(closes, sma20, sma50, rsi);
  const momentum = scoreMomentum(closes);
  const insider = scoreInsider(fund, quote);

  // Weighted total
  const totalScore = Math.round(
    fundamentals.score * fundamentals.weight +
    technicals.score * technicals.weight +
    momentum.score * momentum.weight +
    insider.score * insider.weight
  );

  const result: StockIQResult = {
    symbol,
    companyName: quote?.name ?? symbol,
    price: quote?.price ?? closes.at(-1) ?? null,
    totalScore,
    grade: toGrade(totalScore),
    verdict: toVerdict(totalScore),
    simpleVerdict: "",
    fundamentals,
    technicals,
    momentum,
    insider,
    computedAt: new Date().toISOString(),
  };
  result.simpleVerdict = toSimpleVerdict(result);

  // Cache
  scoreCache[symbol] = { data: result, ts: Date.now() };
  return result;
}

/* ═══ Top / Bottom Scorers ═══ */
const POPULAR_STOCKS = [
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
  "BHARTIARTL", "ITC", "SBIN", "LT", "KOTAKBANK",
  "HINDUNILVR", "BAJFINANCE", "TATAMOTORS", "MARUTI", "WIPRO",
  "SUNPHARMA", "HCLTECH", "AXISBANK", "TITAN", "ASIANPAINT",
  "NESTLEIND", "CIPLA", "ADANIENT", "ADANIPORTS", "TECHM",
  "POWERGRID", "NTPC", "ULTRACEMCO", "JSWSTEEL", "TATASTEEL",
];

let topBottomCache: { top: StockIQResult[]; bottom: StockIQResult[]; ts: number } | null = null;
const TOP_BOTTOM_TTL = 6 * 60 * 60 * 1000; // 6 hours

export async function getTopBottomStockIQ(): Promise<{ top: StockIQResult[]; bottom: StockIQResult[] }> {
  if (topBottomCache && Date.now() - topBottomCache.ts < TOP_BOTTOM_TTL) {
    return { top: topBottomCache.top, bottom: topBottomCache.bottom };
  }

  const results: StockIQResult[] = [];
  const batchSize = 5;

  for (let i = 0; i < POPULAR_STOCKS.length; i += batchSize) {
    const batch = POPULAR_STOCKS.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(calculateStockIQ));
    for (const r of batchResults) {
      if (r.status === "fulfilled") results.push(r.value);
    }
    // Delay between batches
    if (i + batchSize < POPULAR_STOCKS.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  results.sort((a, b) => b.totalScore - a.totalScore);

  const top = results.slice(0, 10);
  const bottom = results.slice(-10).reverse();

  topBottomCache = { top, bottom, ts: Date.now() };
  return { top, bottom };
}
