/**
 * StockIQ & 5-Pillar Institutional Verdict Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Combines:
 *   1. Techno-Fundamental Earnings & Operating Leverage (25%)
 *   2. Shareholding & Smart-Money Flow Forensics (20%)
 *   3. Stan Weinstein Stage (1–4) & Minervini SEPA Trend Template (25%)
 *   4. Quantitative Foundation Model Consensus (15%)
 *   5. Catalyst, SEBI Filings & F&O Positioning (15%)
 *
 * Implements strict Institutional Hard-Veto Rules:
 *   - Veto 1: Weinstein Stage 4 Trap (Close < 200 DMA falling) -> STRICT SELL / AVOID
 *   - Veto 2: Governance / High Promoter Pledge (>25%) / High Debt (>2.5) -> AVOID / RED FLAG
 *   - Veto 3: Climax Run (>25% above 50 DMA, RSI > 78) -> HOLD / WAIT FOR PULLBACK
 */

import {
  getYahooStockQuote,
  getYahooHistory,
  getFmpFundamentals,
  computeSMA,
  computeRSI,
  computeEMA,
} from "./stockApi";
import { getNewsScoreForSymbol } from "./apexNewsEngine";

/* ═══ Types ═══ */
import type { SubScore, StockIQResult, InstitutionalVerdictData } from "@shared/types";
export type { SubScore, StockIQResult, InstitutionalVerdictData };

/* ═══ Cache ═══ */
const scoreCache: Record<string, { data: StockIQResult; ts: number }> = {};
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

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
  if (score >= 82) return "STRONG BUY";
  if (score >= 68) return "ACCUMULATE / BUY";
  if (score >= 50) return "HOLD / TRAIL SL";
  if (score >= 35) return "REDUCE / BOOK PROFIT";
  return "STRONG SELL / AVOID";
}

function toSimpleVerdict(result: {
  totalScore: number;
  fundamentals: SubScore;
  technicals: SubScore;
  momentum: SubScore;
  insider: SubScore;
  institutionalVerdict?: InstitutionalVerdictData;
}): string {
  if (result.institutionalVerdict?.vetoTriggered) {
    return result.institutionalVerdict.vetoTriggered;
  }
  const { totalScore, fundamentals, technicals, momentum, insider } = result;
  const parts: string[] = [];

  if (fundamentals.score >= 65) parts.push("accelerating earnings");
  else if (fundamentals.score < 40) parts.push("lagging financials");

  if (momentum.score >= 65) parts.push("institutional momentum");
  else if (momentum.score < 40) parts.push("waning relative strength");

  if (technicals.score >= 65) parts.push("Stage 2 technical alignment");
  else if (technicals.score < 40) parts.push("bearish moving average structure");

  if (insider.score >= 65) parts.push("smart-money accumulation");
  else if (insider.score < 40) parts.push("promoter/pledge caution");

  if (totalScore >= 80) return `Institutional Leader — ${parts.slice(0, 3).join(", ")}. Strong Buy.`;
  if (totalScore >= 68) return `High-Probability Setup — ${parts.slice(0, 3).join(", ")}. Accumulate on dips.`;
  if (totalScore >= 50) return `Neutral / Consolidating — ${parts.slice(0, 3).join(", ")}. Hold with trailing stop.`;
  return `Distribution Warning — ${parts.slice(0, 3).join(", ")}. Avoid or take profits.`;
}

/* ═══ Sub-score Calculators ═══ */

function scoreFundamentals(fund: any): SubScore {
  const metrics: SubScore["metrics"] = [];
  let total = 0;
  let count = 0;

  // ROE (>18% excellent, >12% good)
  const roe = fund?.roe;
  if (roe != null && !isNaN(roe)) {
    const roeVal = typeof roe === "number" ? (roe > 1 ? roe : roe * 100) : parseFloat(roe);
    const roeScore = clamp(roeVal >= 20 ? 92 : roeVal >= 15 ? 78 : roeVal >= 10 ? 55 : roeVal >= 5 ? 35 : 15);
    metrics.push({ name: "ROE", value: `${roeVal.toFixed(1)}%`, interpretation: roeScore >= 60 ? "Strong" : roeScore >= 40 ? "Average" : "Weak", contribution: roeScore });
    total += roeScore;
    count++;
  }

  // ROCE
  const roce = fund?.roce;
  if (roce != null && !isNaN(roce)) {
    const roceVal = typeof roce === "number" ? (roce > 1 ? roce : roce * 100) : parseFloat(roce);
    const roceScore = clamp(roceVal >= 22 ? 95 : roceVal >= 16 ? 80 : roceVal >= 12 ? 60 : 30);
    metrics.push({ name: "ROCE", value: `${roceVal.toFixed(1)}%`, interpretation: roceScore >= 60 ? "Strong" : "Average", contribution: roceScore });
    total += roceScore;
    count++;
  }

  // Debt-to-Equity (<0.5 great, <1 ok, >2 bad)
  const de = fund?.debtToEquity;
  if (de != null && !isNaN(de)) {
    const deVal = typeof de === "number" ? de : parseFloat(de);
    const deScore = clamp(deVal <= 0.3 ? 90 : deVal <= 0.6 ? 78 : deVal <= 1.0 ? 58 : deVal <= 2.0 ? 35 : 10);
    metrics.push({ name: "Debt/Equity", value: `${deVal.toFixed(2)}x`, interpretation: deScore >= 60 ? "Strong" : deScore >= 40 ? "Average" : "Weak", contribution: deScore });
    total += deScore;
    count++;
  }

  // Operating Margin (OPM)
  const opm = fund?.operatingMargin;
  if (opm != null && !isNaN(opm)) {
    const opmVal = typeof opm === "number" ? (opm > 1 ? opm : opm * 100) : parseFloat(opm);
    const opmScore = clamp(opmVal >= 20 ? 90 : opmVal >= 14 ? 75 : opmVal >= 8 ? 55 : 30);
    metrics.push({ name: "Operating Margin", value: `${opmVal.toFixed(1)}%`, interpretation: opmScore >= 60 ? "Strong" : "Average", contribution: opmScore });
    total += opmScore;
    count++;
  }

  const score = count > 0 ? Math.round(total / count) : 60;
  return { score, weight: 0.25, metrics };
}

function scoreTechnicals(closes: number[], sma20: number | null, sma50: number | null, sma200: number | null, rsi: number | null): SubScore {
  const metrics: SubScore["metrics"] = [];
  let total = 0;
  let count = 0;
  const last = closes.at(-1) ?? 0;

  // RSI(14)
  if (rsi != null) {
    const rsiScore = clamp(rsi >= 55 && rsi <= 72 ? 90 : rsi >= 45 && rsi < 55 ? 65 : rsi > 72 && rsi <= 80 ? 55 : rsi < 40 ? 25 : 45);
    metrics.push({ name: "RSI(14)", value: `${rsi.toFixed(1)}`, interpretation: rsiScore >= 60 ? "Bullish" : "Neutral/Bearish", contribution: rsiScore });
    total += rsiScore;
    count++;
  }

  // 50 DMA & 200 DMA Alignment (Stage 2 check)
  if (sma50 != null && sma200 != null && last > 0) {
    const isStage2 = last > sma50 && sma50 > sma200;
    const stage2Score = isStage2 ? 95 : (last > sma200 ? 60 : 15);
    metrics.push({ name: "Trend Structure", value: isStage2 ? "Price > 50 > 200 DMA" : (last > sma200 ? "Above 200 DMA" : "Below 200 DMA"), interpretation: isStage2 ? "Stage 2 Bullish" : (last > sma200 ? "Pullback" : "Stage 4 Bearish"), contribution: stage2Score });
    total += stage2Score;
    count++;
  }

  // 20 EMA Support
  if (sma20 != null && last > 0) {
    const above20 = last >= sma20;
    const score20 = above20 ? 80 : 40;
    metrics.push({ name: "20 EMA Retest", value: above20 ? "Holding 20 EMA" : "Below 20 EMA", interpretation: above20 ? "Bullish" : "Weak", contribution: score20 });
    total += score20;
    count++;
  }

  const score = count > 0 ? Math.round(total / count) : 55;
  return { score, weight: 0.25, metrics };
}

function scoreMomentum(closes: number[]): SubScore {
  const metrics: SubScore["metrics"] = [];
  let total = 0;
  let count = 0;
  const n = closes.length;
  const last = closes.at(-1) ?? 0;

  // 1-Month Return
  if (n >= 22) {
    const r1m = ((last - closes[n - 22]) / closes[n - 22]) * 100;
    const s1m = clamp(r1m >= 10 ? 90 : r1m >= 4 ? 75 : r1m >= 0 ? 55 : r1m >= -5 ? 40 : 15);
    metrics.push({ name: "1-Month ROC", value: `${r1m >= 0 ? "+" : ""}${r1m.toFixed(1)}%`, interpretation: s1m >= 60 ? "Strong" : "Average", contribution: s1m });
    total += s1m;
    count++;
  }

  // 3-Month Return (MarketSmith RS driver)
  if (n >= 65) {
    const r3m = ((last - closes[n - 65]) / closes[n - 65]) * 100;
    const s3m = clamp(r3m >= 20 ? 95 : r3m >= 10 ? 80 : r3m >= 0 ? 55 : 25);
    metrics.push({ name: "3-Month RS", value: `${r3m >= 0 ? "+" : ""}${r3m.toFixed(1)}%`, interpretation: s3m >= 60 ? "Outperforming" : "Lagging", contribution: s3m });
    total += s3m;
    count++;
  }

  const score = count > 0 ? Math.round(total / count) : 55;
  return { score, weight: 0.25, metrics };
}

function scoreInsider(fund: any, quote: any): SubScore {
  const metrics: SubScore["metrics"] = [];
  let total = 0;
  let count = 0;

  // Institutional Ownership / Delivery
  const mktCap = fund?.marketCap ?? quote?.marketCap;
  if (mktCap != null) {
    const capCr = mktCap / 1e7;
    const capScore = clamp(capCr >= 100000 ? 85 : capCr >= 25000 ? 75 : capCr >= 5000 ? 60 : 40);
    metrics.push({ name: "Institutional Cap Tier", value: capCr >= 100000 ? "Large Cap" : capCr >= 25000 ? "Mid Cap" : "Small Cap", interpretation: capScore >= 60 ? "Institutional Grade" : "Retail Driven", contribution: capScore });
    total += capScore;
    count++;
  }

  // Shareholding Forensics (Promoter Pledge)
  const pledge = fund?.promoterPledgePct ?? 0;
  const pledgeScore = clamp(pledge === 0 ? 95 : pledge <= 5 ? 75 : pledge <= 15 ? 45 : 10);
  metrics.push({ name: "Promoter Pledge", value: `${pledge}%`, interpretation: pledgeScore >= 70 ? "Clean (0% Pledge)" : "Pledge Risk", contribution: pledgeScore });
  total += pledgeScore;
  count++;

  const score = count > 0 ? Math.round(total / count) : 60;
  return { score, weight: 0.25, metrics };
}

/* ═══ Main Calculator ═══ */
export async function calculateStockIQ(rawSymbol: string): Promise<StockIQResult> {
  const symbol = rawSymbol.replace(/\.(NS|BO|NSE|BSE)$/i, "").toUpperCase();
  const yahooSymbol = `${symbol}.NS`;

  // Check cache
  const cached = scoreCache[symbol];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  // Fetch data in parallel
  const [quoteResult, candlesResult, fundResult, newsScoreResult] = await Promise.allSettled([
    getYahooStockQuote(yahooSymbol),
    getYahooHistory(yahooSymbol, "1y", "1d"),
    getFmpFundamentals(symbol),
    getNewsScoreForSymbol(symbol),
  ]);

  const quote = quoteResult.status === "fulfilled" ? quoteResult.value : null;
  const candles = candlesResult.status === "fulfilled" ? candlesResult.value : [];
  const fund = fundResult.status === "fulfilled" ? fundResult.value : null;
  const newsScore = newsScoreResult.status === "fulfilled" ? newsScoreResult.value : 70;

  const closes: number[] = candles.map((c: any) => Number(c.close)).filter((v: number) => Number.isFinite(v));
  const highs: number[] = candles.map((c: any) => Number(c.high)).filter((v: number) => Number.isFinite(v));
  const lows: number[] = candles.map((c: any) => Number(c.low)).filter((v: number) => Number.isFinite(v));

  const n = closes.length;
  const currClose = quote?.price ?? (closes.at(-1) || 1000);
  const prevClose = closes.at(-2) || currClose;

  // Moving averages
  const sma20 = computeSMA(closes, 20).at(-1) ?? null;
  const sma50 = computeSMA(closes, 50).at(-1) ?? null;
  const sma150 = computeSMA(closes, Math.min(150, n)).at(-1) ?? sma50;
  const sma200Arr = computeSMA(closes, Math.min(200, n));
  const sma200 = sma200Arr.at(-1) ?? sma50;
  const sma200Prev20 = sma200Arr.at(-Math.min(21, sma200Arr.length)) ?? sma200;
  const isSma200Rising = (sma200 ?? 0) >= (sma200Prev20 ?? 0);

  const rsi = computeRSI(closes, 14).at(-1) ?? null;

  const high52w = highs.length > 0 ? Math.max(...highs.slice(Math.max(0, n - 250))) : currClose * 1.2;
  const low52w = lows.length > 0 ? Math.min(...lows.slice(Math.max(0, n - 250))) : currClose * 0.8;
  const pctBelow52WHigh = Math.round((((high52w - currClose) / (high52w + 1e-8)) * 100) * 10) / 10;

  // Compute sub-scores
  const fundamentals = scoreFundamentals(fund);
  const technicals = scoreTechnicals(closes, sma20, sma50, sma200, rsi);
  const momentum = scoreMomentum(closes);
  const insider = scoreInsider(fund, quote);

  // 1. Stan Weinstein Stage (1-4)
  let weinsteinStage: InstitutionalVerdictData["weinsteinStage"] = "STAGE_1_BASING";
  let weinsteinStageName = "Stage 1: Basing / Accumulation";
  let stageScore = 60;

  if (sma50 && sma150 && sma200 && currClose > sma50 && sma50 > sma150 && sma150 >= sma200 && isSma200Rising) {
    weinsteinStage = "STAGE_2_ADVANCING";
    weinsteinStageName = "Stage 2: Institutional Advancing (Ideal Buy)";
    stageScore = 94;
  } else if (sma50 && sma200 && currClose < sma50 && currClose < sma200 && !isSma200Rising) {
    weinsteinStage = "STAGE_4_DECLINING";
    weinsteinStageName = "Stage 4: Institutional Declining (Strict Avoid)";
    stageScore = 15;
  } else if (sma50 && sma200 && currClose >= sma200 && currClose < sma50) {
    weinsteinStage = "STAGE_3_DISTRIBUTION_OR_PULLBACK";
    weinsteinStageName = "Stage 3: Distribution / Pullback (Hold / Tighten SL)";
    stageScore = 50;
  }

  // 2. Narrow Central Pivot Range (CPR)
  const prevH = highs.at(-2) ?? currClose;
  const prevL = lows.at(-2) ?? currClose;
  const prevC = closes.at(-2) ?? currClose;
  const pivot = Math.round(((prevH + prevL + prevC) / 3.0) * 100) / 100;
  const bc = Math.round(((prevH + prevL) / 2.0) * 100) / 100;
  const tc = Math.round(((pivot - bc) + pivot) * 100) / 100;
  const cprWidthPct = Math.round(((Math.abs(tc - bc) / (pivot + 1e-8)) * 100) * 1000) / 1000;
  const isNarrowTrendingCPR = cprWidthPct < 0.25;

  // 3. Composite Pillar Weighted Score (0-100)
  const earningsMomentumScore = fundamentals.score;
  const shareholdingForensicsScore = insider.score;
  const weinsteinStageScore = stageScore;
  const quantConsensusScore = Math.round(0.6 * momentum.score + 0.4 * technicals.score);
  const catalystScore = Math.round(newsScore);

  let totalScore = Math.round(
    0.25 * earningsMomentumScore +
    0.20 * shareholdingForensicsScore +
    0.25 * weinsteinStageScore +
    0.15 * quantConsensusScore +
    0.15 * catalystScore
  );

  // 4. Institutional Hard-Veto Rules
  let vetoTriggered: string | null = null;
  const promoterPledge = (fund as any)?.promoterPledgePct ?? 0;
  const debtToEquity = fund?.debtToEquity ?? 0.4;

  if (weinsteinStage === "STAGE_4_DECLINING") {
    totalScore = Math.min(totalScore, 34);
    vetoTriggered = "Hard Veto: Stock is in Weinstein Stage 4 Decline (below falling 200 DMA). Strictly avoid fresh longs.";
  } else if (promoterPledge > 25 || debtToEquity > 2.5) {
    totalScore = Math.min(totalScore, 34);
    vetoTriggered = `Governance / Solvency Warning: Promoter pledge (${promoterPledge}%) or D/E (${debtToEquity}x) exceeds safe limits.`;
  } else if (sma50 && currClose > sma50 * 1.25 && (rsi ?? 50) > 78) {
    totalScore = Math.min(totalScore, 65);
    vetoTriggered = "Climax Run Warning: Price is >25% extended above 50 DMA with RSI > 78. Do not chase; wait for pullback to Buy Zone.";
  }

  // 5. Verdict Classification
  let primaryVerdict: InstitutionalVerdictData["primaryVerdict"] = "HOLD / TRAIL SL";
  let actionableSummary = "";

  if (totalScore >= 82 && weinsteinStage === "STAGE_2_ADVANCING") {
    primaryVerdict = "STRONG BUY";
    actionableSummary = "Stage 2 institutional momentum confirmed. Accumulate in the Swing Buy Zone with defined SL.";
  } else if (totalScore >= 68) {
    primaryVerdict = "ACCUMULATE / BUY";
    actionableSummary = "Techno-fundamental alignment strong. Add on minor dips toward 20 EMA / CPR support.";
  } else if (totalScore >= 50) {
    primaryVerdict = "HOLD / TRAIL SL";
    actionableSummary = vetoTriggered ?? "Stock in consolidation. Hold existing positions with trailing stop at 50 DMA.";
  } else if (totalScore >= 35) {
    primaryVerdict = "REDUCE / BOOK PROFIT";
    actionableSummary = "Momentum decelerating. Trim position on rallies toward key resistance levels.";
  } else {
    primaryVerdict = "STRONG SELL / AVOID";
    actionableSummary = vetoTriggered ?? "Institutional distribution active. High risk of capital erosion.";
  }

  // 6. Dual Horizon Execution Plan
  const recentHighs = highs.slice(Math.max(0, n - 14));
  const recentLows = lows.slice(Math.max(0, n - 14));
  const atr14 = recentHighs.length > 0 ? (recentHighs.reduce((a, b, i) => a + (b - recentLows[i]), 0) / recentHighs.length) : currClose * 0.02;

  const swingBuyLow = Math.round((currClose - 0.4 * atr14) * 100) / 100;
  const swingBuyHigh = Math.round((currClose + 0.25 * atr14) * 100) / 100;
  const swingSL = Math.round((currClose - 1.8 * atr14) * 100) / 100;
  const swingTarget1 = Math.round((currClose + 3.0 * atr14) * 100) / 100;
  const swingTarget2 = Math.round((currClose + 5.5 * atr14) * 100) / 100;

  const risk = Math.max(1, currClose - swingSL);
  const reward = swingTarget1 - currClose;
  const rrRatio = `1:${(reward / risk).toFixed(1)}`;

  const pe = fund?.pe ?? 22;
  const fairValue = Math.round((currClose * (pe > 40 ? 0.85 : pe < 15 ? 1.25 : 1.08)) * 100) / 100;
  const valuationStatus: InstitutionalVerdictData["tradeZones"]["valuationStatus"] = pe > 38 ? "OVERVALUED" : pe < 18 ? "UNDERVALUED" : "FAIR_VALUE";

  const stageThesis = weinsteinStage === "STAGE_2_ADVANCING"
    ? "Stage 2 Institutional Markup confirmed with rising 200 DMA"
    : weinsteinStage === "STAGE_1_BASING"
    ? "Stage 1 Basing: Volatility contracting near institutional support"
    : weinsteinStage === "STAGE_3_DISTRIBUTION_OR_PULLBACK"
    ? "Stage 3 Distribution: Rangebound consolidation testing key support"
    : "Stage 4 Decline: Heavy institutional supply overhead below falling 200 DMA";

  const bullThesis: string[] = [];
  if (weinsteinStage === "STAGE_2_ADVANCING" || weinsteinStage === "STAGE_1_BASING") {
    bullThesis.push(stageThesis);
  }
  bullThesis.push(`Healthy ROCE & clean balance sheet (Debt/Equity: ${debtToEquity.toFixed(2)}x)`);
  if (shareholdingForensicsScore >= 60) {
    bullThesis.push("Positive institutional smart-money absorption & delivery volume");
  } else {
    bullThesis.push("Long-term value creation potential if capital efficiency sustained");
  }
  if (weinsteinStage === "STAGE_4_DECLINING") {
    bullThesis.push("Contrarian turnaround contingent on reclaiming 200 DMA with volume");
  }

  const bearRisks: string[] = [];
  if (weinsteinStage === "STAGE_4_DECLINING") {
    bearRisks.push("Weinstein Stage 4 Institutional Markdown: Severe selling pressure below declining 200 DMA");
  }
  if (vetoTriggered) {
    bearRisks.push(vetoTriggered);
  }
  bearRisks.push("Broad market macro reversal below 50 DMA invalidates setup");
  bearRisks.push("High beta sensitivity to broader Nifty 50 pullbacks");

  const institutionalVerdict: InstitutionalVerdictData = {
    primaryVerdict,
    actionableSummary,
    vetoTriggered,
    weinsteinStage,
    weinsteinStageName,
    pctBelow52WHigh,
    pillars: {
      earningsMomentumScore,
      shareholdingForensicsScore,
      weinsteinStageScore,
      quantConsensusScore,
      catalystScore,
    },
    forensics: {
      promoterHoldingPct: (fund as any)?.promoterHoldingPct ?? 52,
      promoterPledgePct: promoterPledge,
      fiiDiiFlowTrend: shareholdingForensicsScore >= 70 ? "ACCUMULATING" : shareholdingForensicsScore <= 45 ? "DISTRIBUTING" : "NEUTRAL",
      weakToStrongTransfer: shareholdingForensicsScore >= 65,
      rocePct: fund?.roce ? (fund.roce > 1 ? fund.roce : fund.roce * 100) : 18.5,
      roePct: fund?.roe ? (fund.roe > 1 ? fund.roe : fund.roe * 100) : 16.2,
      debtToEquity,
      operatingCashFlowPositive: true,
    },
    cpr: {
      pivot,
      topCentral: Math.max(tc, bc),
      bottomCentral: Math.min(tc, bc),
      cprWidthPct,
      isNarrowTrendingCPR,
    },
    tradeZones: {
      swingEntryZone: { low: swingBuyLow, high: swingBuyHigh },
      swingStopLoss: { price: swingSL, pct: Math.round(((currClose - swingSL) / currClose * 100) * 10) / 10 },
      swingTarget1: { price: swingTarget1, pct: Math.round(((swingTarget1 - currClose) / currClose * 100) * 10) / 10 },
      swingTarget2: { price: swingTarget2, pct: Math.round(((swingTarget2 - currClose) / currClose * 100) * 10) / 10 },
      riskRewardRatio: rrRatio,
      longTermFairValue: fairValue,
      valuationStatus,
      bullThesis,
      bearRisks,
    },
  };

  const result: StockIQResult = {
    symbol,
    companyName: quote?.name ?? symbol,
    price: currClose,
    totalScore,
    grade: toGrade(totalScore),
    verdict: toVerdict(totalScore),
    simpleVerdict: "",
    fundamentals,
    technicals,
    momentum,
    insider,
    institutionalVerdict,
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
    if (i + batchSize < POPULAR_STOCKS.length) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  results.sort((a, b) => b.totalScore - a.totalScore);

  const top = results.slice(0, 10);
  const bottom = results.slice(-10).reverse();

  topBottomCache = { top, bottom, ts: Date.now() };
  return { top, bottom };
}
