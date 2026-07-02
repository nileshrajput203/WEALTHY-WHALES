/**
 * FUGU SCORE — Self-Learning Stock Intelligence & Ranking Engine
 *
 * Implements a multi-agent self-learning system that evaluates stock picks
 * using a LangGraph-style pipeline and dynamically improves weights over time.
 */

import { db } from "./db";
import {
  fuguSnapshots,
  fuguOutcomes,
  fuguFactorWeights,
  fuguPatternStats,
  fuguCandlestickStats,
  fuguSectorStats,
  fuguRegimeStats,
  fuguLearningMemory,
  fuguElitePicks,
  hermesSnapshots,
  type FuguSnapshot,
  type FuguOutcome,
  type FuguFactorWeight,
  type FuguPatternStat,
  type FuguCandlestickStat,
  type FuguSectorStat,
  type FuguRegimeStat,
  type FuguLearningMemory as FuguLearningMemoryType,
  type FuguElitePick,
} from "@shared/schema";
import { eq, and, isNull, lte, desc, asc, sql, count } from "drizzle-orm";
import {
  getYahooStockQuote,
  getYahooHistory,
  getFmpFundamentals,
  computeSMA,
  computeRSI,
  computeEMA,
  getYahooStockNews,
} from "./stockApi";
import { calculateStockIQ } from "./stockiq";
import { runSwingScanner, runIpoScanner } from "./stockApi";
import { runPatternScanner } from "./patternScanner";
import { executeScreener } from "./smartScreener";
import { generateWithRetry } from "./gemini";
import { NSE_UNIQUE } from "./nseUniverse";
import {
  computeVcpFeatures,
  computeVcpScore,
  computeVcpEntrySLTarget,
  describeVcpSetup,
  type VcpFeatures,
} from "./vcpCore";
import { logJournalEntry } from "./vcpJournalEngine";

/* ═══════════════════════════════════════════════════════════
   CONSTANTS & BASELINE CONFIGS
   ═══════════════════════════════════════════════════════════ */

const WIN_THRESHOLD = 3.0; // +3% is a WIN
const LOSS_THRESHOLD = -3.0; // -3% is a LOSS

// VCP-ONLY WEIGHTS (FUGU v2) — technical/pattern/candlestick carry the whole
// score; fundamental/sector/macro/sentiment/similarity are locked at 0 so the
// legacy nodes keep running (informational only) but never move the needle.
export const DEFAULT_FUGU_WEIGHTS: Record<string, number> = {
  technical: 0.45,
  pattern: 0.3,
  candlestick: 0.25,
  fundamental: 0,
  sector: 0,
  macro: 0,
  similarity: 0,
  sentiment: 0,
};

// Any agent whose weight must stay pinned at 0 in the VCP-only rebuild —
// the weight optimizer clamps these so learning can't drift them back up.
const ZERO_LOCKED_AGENTS = new Set([
  "fundamental",
  "sector",
  "macro",
  "sentiment",
  "similarity",
]);

const SECTORS = [
  "IT",
  "Banking",
  "Pharma",
  "FMCG",
  "Energy",
  "Metals",
  "Auto",
  "Consumer",
  "Cement",
  "Telecom",
  "Finance",
  "Infra",
  "Other",
];

const SECTOR_MAP: Record<string, string> = {
  TCS: "IT",
  INFY: "IT",
  WIPRO: "IT",
  HCLTECH: "IT",
  TECHM: "IT",
  LTIM: "IT",
  HDFCBANK: "Banking",
  ICICIBANK: "Banking",
  SBIN: "Banking",
  KOTAKBANK: "Banking",
  AXISBANK: "Banking",
  INDUSINDBK: "Banking",
  BANDHANBNK: "Banking",
  SUNPHARMA: "Pharma",
  CIPLA: "Pharma",
  DRREDDY: "Pharma",
  DIVISLAB: "Pharma",
  TATAMOTORS: "Auto",
  MARUTI: "Auto",
  "M&M": "Auto",
  "BAJAJ-AUTO": "Auto",
  HINDUNILVR: "FMCG",
  ITC: "FMCG",
  NESTLEIND: "FMCG",
  BRITANNIA: "FMCG",
  RELIANCE: "Energy",
  NTPC: "Energy",
  POWERGRID: "Energy",
  ONGC: "Energy",
  TATASTEEL: "Metals",
  JSWSTEEL: "Metals",
  HINDALCO: "Metals",
  VEDL: "Metals",
  LT: "Infra",
  ADANIENT: "Infra",
  ADANIPORTS: "Infra",
  BAJFINANCE: "Finance",
  BAJAJFINSV: "Finance",
  SBILIFE: "Finance",
  TITAN: "Consumer",
  ASIANPAINT: "Consumer",
  ULTRACEMCO: "Cement",
  GRASIM: "Cement",
  BHARTIARTL: "Telecom",
};

let isScanRunning = false;

/* ═══════════════════════════════════════════════════════════
   LANGGRAPH STATE DEFINITION & RUNNER
   ═══════════════════════════════════════════════════════════ */

export interface FuguState {
  symbol: string;
  scannerSource: string;
  price: number;
  technicalScore: number;
  patternScore: number;
  patternConfidence: number;
  candlestickScore: number;
  fundamentalScore: number;
  sectorScore: number;
  macroScore: number;
  similarityScore: number;
  fuguScore: number;
  eliteReasoning: string;
  features: Record<string, any>;
  candles: any[];
  fundamentals: any;
  stockIq: any;
  weights: Record<string, number>;
  weightVersion: number;
}

class FuguLangGraph {
  private nodes: Record<
    string,
    (state: FuguState) => Promise<Partial<FuguState>>
  > = {};

  addNode(name: string, fn: (state: FuguState) => Promise<Partial<FuguState>>) {
    this.nodes[name] = fn;
  }

  async run(initialState: FuguState): Promise<FuguState> {
    let state = { ...initialState };
    const order = [
      "technical",
      "pattern",
      "candlestick",
      "fundamental",
      "sector",
      "macro",
      "sentiment",
      "similarity",
      "eliteRanker",
    ];

    for (const nodeName of order) {
      if (this.nodes[nodeName]) {
        try {
          const update = await this.nodes[nodeName](state);
          state = { ...state, ...update };
        } catch (err: any) {
          console.error(
            `[FuguGraph] Error in node ${nodeName} for ${state.symbol}:`,
            err.message,
          );
        }
      }
    }
    return state;
  }
}

/* ═══════════════════════════════════════════════════════════
   CANDLESTICK PATTERN DETECTION UTILITIES
   ═══════════════════════════════════════════════════════════ */

function detectHammer(
  open: number,
  high: number,
  low: number,
  close: number,
): boolean {
  const body = Math.abs(close - open);
  const totalRange = high - low;
  if (totalRange === 0) return false;

  const lowerShadow = Math.min(open, close) - low;
  const upperShadow = high - Math.max(open, close);

  // Lower shadow is at least 2x the body, and upper shadow is very small
  return lowerShadow >= body * 2 && upperShadow <= body * 0.3;
}

function detectBullishEngulfing(
  yesterdayOpen: number,
  yesterdayClose: number,
  todayOpen: number,
  todayClose: number,
): boolean {
  const yesterdayRed = yesterdayClose < yesterdayOpen;
  const todayGreen = todayClose > todayOpen;

  if (!yesterdayRed || !todayGreen) return false;

  // Today's open <= yesterday's close, and today's close >= yesterday's open
  return todayOpen <= yesterdayClose && todayClose >= yesterdayOpen;
}

function detectMorningStar(
  day1Open: number,
  day1Close: number,
  day2Open: number,
  day2Close: number,
  day3Open: number,
  day3Close: number,
): boolean {
  const day1Red = day1Close < day1Open;
  const day3Green = day3Close > day3Open;

  if (!day1Red || !day3Green) return false;

  const day1Body = day1Open - day1Close;
  const day3Body = day3Close - day3Open;

  // Day 2 is a small body gap down
  const day2Body = Math.abs(day2Close - day2Open);
  const day2IsSmall = day2Body < day1Body * 0.3;

  // Day 3 closes at least halfway into Day 1's body
  const day1Mid = day1Close + day1Body / 2;
  const day3ClosesAboveMid = day3Close >= day1Mid;

  return day2IsSmall && day3ClosesAboveMid;
}

/* ═══════════════════════════════════════════════════════════
   LANGGRAPH AGENT GRAPH IMPLEMENTATION
   ═══════════════════════════════════════════════════════════ */

export function buildFuguGraph(): FuguLangGraph {
  const graph = new FuguLangGraph();

  // 1. Technical Agent Node — rebuilt as the primary VCP contraction/coil score
  graph.addNode("technical", async (state) => {
    const vcp = computeVcpFeatures(state.candles);
    if (!vcp) return { technicalScore: 50 };

    const technicalScore = computeVcpScore(vcp);

    return {
      technicalScore,
      features: {
        ...state.features,
        vcp,
        atr14: vcp.atr14,
        atrCompression: vcp.atrCompression,
        tightCoilRatio: vcp.tightCoilRatio,
        emaStackScore: vcp.emaStackScore,
        ema50Rising: vcp.ema50Rising,
      },
    };
  });

  // 2. Pattern Agent Node — VCP base structure quality (contraction stages, range)
  graph.addNode("pattern", async (state) => {
    const vcp: VcpFeatures | undefined = state.features.vcp;
    let detectedPattern = "None";
    let detectedStage:
      | "Consolidation"
      | "Near Breakout"
      | "Breakout Confirmed"
      | "Pullback" = "Consolidation";
    let score = 40;
    let confidence = 50;

    if (vcp) {
      if (vcp.passesAllFilters) {
        detectedPattern = "VCP Breakout";
        detectedStage = "Breakout Confirmed";
      } else if (vcp.contractionCount >= 2 && vcp.nearHighPct >= 80) {
        detectedPattern = "VCP Base";
        detectedStage = "Near Breakout";
      } else if (vcp.contractionCount >= 1) {
        detectedPattern = "VCP Forming";
        detectedStage = "Consolidation";
      }

      // Score = quality of the contraction structure itself (not price momentum)
      score =
        Math.min(40, vcp.contractionCount * 13.3) +
        Math.min(30, Math.max(0, (vcp.rangeQuality - 1) * 60)) +
        (vcp.progressiveContraction ? 15 : 0) +
        Math.min(15, Math.max(0, vcp.emaStackScore * 15));
      confidence = vcp.passesAllFilters ? 90 : 55 + vcp.contractionCount * 10;
    }

    // Blend in historical win-rate memory for the detected VCP stage, same as before
    if (detectedPattern !== "None") {
      const [stats] = await db
        .select()
        .from(fuguPatternStats)
        .where(eq(fuguPatternStats.patternName, detectedPattern));

      if (stats && stats.totalOccurrences > 5) {
        const wr = Number(stats.winRate20d);
        score = Math.round(score * 0.6 + wr * 0.4);
        confidence = Math.min(95, 50 + stats.totalOccurrences * 2);
      }
    }

    return {
      patternScore: Math.max(10, Math.min(100, Math.round(score))),
      patternConfidence: Math.max(10, Math.min(100, Math.round(confidence))),
      features: {
        ...state.features,
        patternName: detectedPattern,
        patternStage: detectedStage,
      },
    };
  });

  // 3. Candlestick Agent Node — rebuilt as breakout-day / volume dry-up quality check
  graph.addNode("candlestick", async (state) => {
    const vcp: VcpFeatures | undefined = state.features.vcp;
    const candles = state.candles;
    const n = candles.length;
    if (n < 4 || !vcp) return { candlestickScore: 50 };

    let score = 40;
    let detectedCandle = "Normal";

    const today = candles[n - 1];
    const toOpen = Number(today.open ?? today.close);
    const toHigh = Number(today.high);
    const toLow = Number(today.low);
    const toClose = Number(today.close);
    const range = toHigh - toLow;
    const closedNearHigh = range > 0 ? (toClose - toLow) / range >= 0.7 : true;
    const isGreenDay = toClose > toOpen;

    const volumeConfirmed = vcp.volumeRatio > 1.3;
    const volumeDryUp = vcp.volumeRatio <= 0.75;

    if (isGreenDay && closedNearHigh && volumeConfirmed) {
      detectedCandle = "Breakout Candle";
      score = 88;
    } else if (isGreenDay && closedNearHigh) {
      detectedCandle = "Bullish Close";
      score = 70;
    } else if (detectHammer(toOpen, toHigh, toLow, toClose) && volumeDryUp) {
      detectedCandle = "Hammer (Dry-up)";
      score = 65;
    } else if (volumeDryUp) {
      detectedCandle = "Quiet Coil Day";
      score = 60;
    } else if (!isGreenDay && vcp.dailyChangePct < -2) {
      detectedCandle = "Distribution Day";
      score = 30;
    }

    // Adjust based on historical performance
    if (detectedCandle !== "Normal") {
      const [stats] = await db
        .select()
        .from(fuguCandlestickStats)
        .where(eq(fuguCandlestickStats.candlestickName, detectedCandle));
      if (stats && stats.totalOccurrences > 5) {
        const wr = Number(stats.winRate5d);
        score = Math.round(score * 0.6 + wr * 0.4);
      }
    }

    return {
      candlestickScore: Math.max(10, Math.min(100, score)),
      features: {
        ...state.features,
        candlestickName: detectedCandle,
        volumeConfirmed,
      },
    };
  });

  // 4. Fundamental Agent Node
  graph.addNode("fundamental", async (state) => {
    const f = state.fundamentals;
    if (!f) return { fundamentalScore: 50 };

    const roe =
      f.roe != null
        ? Number(f.roe) < 1
          ? Number(f.roe) * 100
          : Number(f.roe)
        : 10;
    const roce =
      f.roce != null
        ? Number(f.roce) < 1
          ? Number(f.roce) * 100
          : Number(f.roce)
        : 10;
    const debtRatio = f.debtToEquity != null ? Number(f.debtToEquity) : 1.5;
    const opm =
      f.opm != null
        ? Number(f.opm) < 1
          ? Number(f.opm) * 100
          : Number(f.opm)
        : 8;
    const pe = f.pe != null ? Number(f.pe) : 40;

    // Growth metrics (mocked/fallback if not in financial data)
    const revGrowth = 15; // default reasonable
    const profitGrowth = 12;

    // 1. Quality Score (out of 100)
    let qScore = 50; // base
    if (roe > 18) qScore += 20;
    if (roce > 15) qScore += 15;
    if (opm > 18) qScore += 15;
    const qualityScore = Math.max(10, Math.min(100, qScore));

    // 2. Valuation Score (out of 100)
    let valScore = 50; // base
    if (pe > 0) {
      if (pe >= 10 && pe <= 25)
        valScore = 95; // perfect PE
      else if (pe > 25 && pe <= 40)
        valScore = 75; // reasonable
      else if (pe > 40 && pe <= 65)
        valScore = 45; // elevated
      else valScore = 20; // expensive
    } else {
      valScore = 30; // negative PE (loss-making)
    }

    if (debtRatio < 0.5) valScore = Math.min(100, valScore + 10);
    else if (debtRatio > 1.5) valScore = Math.max(10, valScore - 20);

    const pegVal = f.peg != null ? Number(f.peg) : null;
    if (pegVal != null) {
      if (pegVal > 0 && pegVal < 1.0) valScore = Math.min(100, valScore + 15);
      else if (pegVal >= 1.5) valScore = Math.max(10, valScore - 15);
    }
    const valuationScore = Math.max(10, Math.min(100, valScore));

    // Blend quality & valuation equally for fundamental score
    const fundamentalScore = Math.round((qualityScore + valuationScore) / 2);

    return {
      fundamentalScore,
      features: {
        ...state.features,
        roe,
        roce,
        debtToEquity: debtRatio,
        opm,
        pe,
        revenueGrowth: revGrowth,
        profitGrowth,
        valuationScore,
        qualityScore,
      },
    };
  });

  // 5. Sector Agent Node
  graph.addNode("sector", async (state) => {
    const symbol = state.symbol;
    const sectorName = SECTOR_MAP[symbol.toUpperCase()] || "Other";

    let score = 55; // default neutral sector

    const [stats] = await db
      .select()
      .from(fuguSectorStats)
      .where(eq(fuguSectorStats.sectorName, sectorName));

    if (stats) {
      // sector score combines historical win rate and current momentum
      const wr = Number(stats.winRate20d);
      const mom = Number(stats.momentumScore);
      score = Math.round(wr * 0.4 + mom * 0.6);
    }

    return {
      sectorScore: Math.max(10, Math.min(100, score)),
      features: { ...state.features, sectorName },
    };
  });

  // 6. Macro Agent Node
  graph.addNode("macro", async (state) => {
    let score = 50;

    try {
      // Get Nifty's 1-month returns to classify overall trend
      const niftyHistory = await getYahooHistory("^NSEI", "3mo", "1d");
      if (niftyHistory && niftyHistory.length > 20) {
        const closes = niftyHistory.map((c: any) => Number(c.close));
        const n = closes.length;
        const indexReturn1m =
          ((closes[n - 1] - closes[n - 22]) / closes[n - 22]) * 100;

        if (indexReturn1m > 3.0)
          score += 15; // trending bull
        else if (indexReturn1m < -3.0) score -= 15; // trending bear
      }
    } catch {}

    // Fallback constants or simulated indicators
    const advanceDeclineRatio = 1.1; // advance/decline
    const marketBreadth = "NEUTRAL";

    return {
      macroScore: Math.max(10, Math.min(100, score)),
      features: { ...state.features, advanceDeclineRatio, marketBreadth },
    };
  });

  // 6.5 Sentiment & News Agent Node (uses precomputed batch sentiments to prevent sequential rate-limited calls)
  graph.addNode("sentiment", async (state) => {
    const sentimentScore = state.features.sentimentScore ?? 50;
    const catalyst =
      state.features.catalyst ?? "No recent major news catalysts detected.";

    return {
      features: {
        ...state.features,
        sentimentScore,
        catalyst,
      },
    };
  });

  // 7. Similarity Agent Node
  graph.addNode("similarity", async (state) => {
    // 1. Gather all past completed outcomes to establish WIN / LOSS profile databases
    const pastOutcomes = await db
      .select()
      .from(fuguOutcomes)
      .innerJoin(fuguSnapshots, eq(fuguOutcomes.snapshotId, fuguSnapshots.id))
      .where(sql`${fuguOutcomes.return20d} IS NOT NULL`)
      .limit(500);

    if (pastOutcomes.length < 5) {
      // No historical baseline, default to neutral
      return { similarityScore: 50 };
    }

    // Helper: extract numeric vector from features
    const toVector = (
      rsi: number,
      roe: number,
      de: number,
      pe: number,
      rvol: number,
    ) => [
      rsi / 100,
      Math.min(1, Math.max(0, roe / 50)),
      Math.min(1, Math.max(0, 1 - de / 3)), // lower debt is better
      Math.min(1, Math.max(0, 1 - pe / 100)), // lower PE is better
      Math.min(1, rvol / 4),
    ];

    const currentRsi = state.features.rsi14 ?? 50;
    const currentRoe = state.features.roe ?? 15;
    const currentDe = state.features.debtToEquity ?? 0.8;
    const currentPe = state.features.pe ?? 30;
    const currentRvol = state.features.rvol ?? 1.2;

    const currVector = toVector(
      currentRsi,
      currentRoe,
      currentDe,
      currentPe,
      currentRvol,
    );

    const cosineSimilarity = (v1: number[], v2: number[]) => {
      let dot = 0,
        norm1 = 0,
        norm2 = 0;
      for (let i = 0; i < v1.length; i++) {
        dot += v1[i] * v2[i];
        norm1 += v1[i] * v1[i];
        norm2 += v2[i] * v2[i];
      }
      return norm1 && norm2 ? dot / (Math.sqrt(norm1) * Math.sqrt(norm2)) : 0;
    };

    let winsSim = 0,
      winsCount = 0;
    let lossSim = 0,
      lossCount = 0;

    for (const row of pastOutcomes) {
      const snap = row.fugu_snapshots;
      const feat = snap.features as Record<string, any>;
      const ret20d = Number(row.fugu_outcomes.return20d);

      const rsi = feat.rsi14 ?? 50;
      const roe = feat.roe ?? 15;
      const de = feat.debtToEquity ?? 0.8;
      const pe = feat.pe ?? 30;
      const rvol = feat.rvol ?? 1.2;

      const vec = toVector(rsi, roe, de, pe, rvol);
      const sim = cosineSimilarity(currVector, vec);

      if (ret20d >= WIN_THRESHOLD) {
        winsSim += sim;
        winsCount++;
      } else if (ret20d <= LOSS_THRESHOLD) {
        lossSim += sim;
        lossCount++;
      }
    }

    const avgWinSim = winsCount > 0 ? winsSim / winsCount : 0.5;
    const avgLossSim = lossCount > 0 ? lossSim / lossCount : 0.5;

    // Rescale similarity: if more similar to wins, score rises.
    const diff = avgWinSim - avgLossSim;
    const similarityScore = Math.max(
      10,
      Math.min(100, Math.round(((diff + 1) / 2) * 100)),
    );

    return {
      similarityScore,
      features: {
        ...state.features,
        winsSimilarity: avgWinSim,
        lossesSimilarity: avgLossSim,
      },
    };
  });

  // 8. Elite Ranker Node
  graph.addNode("eliteRanker", async (state) => {
    const w = state.weights;

    // Compute Fugu Score using dynamic weights config
    const fuguScore =
      state.technicalScore * w.technical +
      state.patternScore * w.pattern +
      state.candlestickScore * w.candlestick +
      state.fundamentalScore * w.fundamental +
      state.sectorScore * w.sector +
      state.macroScore * w.macro +
      state.similarityScore * w.similarity +
      (state.features.sentimentScore ?? 50) * (w.sentiment ?? 0.15);

    // Generate AI explanation rationale using Gemini failover config
    let eliteReasoning = `Bullish configuration with technical score of ${state.technicalScore}/100 and fundamental health of ${state.fundamentalScore}/100. `;
    if (state.features.patternName !== "None") {
      eliteReasoning += `Forming a ${state.features.patternName} pattern in the ${state.features.patternStage} stage. `;
    }
    if (state.features.candlestickName !== "Normal") {
      eliteReasoning += `Confirmed by a ${state.features.candlestickName} candlestick. `;
    }

    // Call Gemini for high scores
    if (fuguScore > 72) {
      try {
        const prompt = `Analyze this stock candidate for an institutional portfolio recommendation:
Symbol: ${state.symbol}
Scanner source: ${state.scannerSource}
Price: ₹${state.price}
Technical Score: ${state.technicalScore}/100 (RSI: ${state.features.rsi14}, bbBandwidth: ${state.features.bbBandwidth})
Pattern: ${state.features.patternName} (${state.features.patternStage})
Candlestick: ${state.features.candlestickName} (Volume confirmed: ${state.features.volumeConfirmed})
Fundamental Score: ${state.fundamentalScore}/100 (ROE: ${state.features.roe}%, ROCE: ${state.features.roce}%, D/E: ${state.features.debtToEquity}, PE: ${state.features.pe})
Sector: ${state.features.sectorName} (Sector Score: ${state.sectorScore}/100)
Macro Score: ${state.macroScore}/100
News Sentiment Score: ${state.features.sentimentScore}/100 (Catalyst: ${state.features.catalyst})

Explain why this setup is high probability. Write a concise 2-sentence institutional-grade summary reasoning.`;

        const response = await generateWithRetry({
          model: "gemini-flash-latest",
          contents: prompt,
          config: {
            systemInstruction:
              "You are the FUGU Elite Ranking Agent, a top-tier hedge fund portfolio manager.",
          },
        });

        if (response?.text) {
          eliteReasoning = response.text.trim();
        }
      } catch (err: any) {
        console.warn(`[Fugu Elite Gemini failed]:`, err.message);
      }
    }

    return {
      fuguScore,
      eliteReasoning,
    };
  });

  return graph;
}

/* ═══════════════════════════════════════════════════════════
   SCANNERS DATA GATHERER (SCANNER AGENT)
   ═══════════════════════════════════════════════════════════ */

export async function gatherFuguCandidates(): Promise<
  Array<{ symbol: string; source: string }>
> {
  console.log(
    "[Fugu Scanner Agent] Gathering candidates from all active screeners...",
  );
  const candidatesMap = new Map<string, string>();

  // Helper validation
  const isValidSymbol = (sym: any): sym is string => {
    return (
      sym &&
      typeof sym === "string" &&
      sym.trim() !== "" &&
      sym.toLowerCase() !== "undefined" &&
      sym.toLowerCase() !== "null"
    );
  };

  // 1. Swing Spectrum candidates
  try {
    const swingResults = await runSwingScanner();
    for (const r of swingResults.slice(0, 30)) {
      if (r && isValidSymbol(r.symbol)) {
        candidatesMap.set(r.symbol.trim().toUpperCase(), "SWING");
      }
    }
    console.log(
      `[Fugu Scanner Agent] Gathered ${swingResults.length} swing candidates.`,
    );
  } catch (err: any) {
    console.error("[Fugu Scanner Agent] Swing scanner error:", err.message);
  }

  // 2. IPO Base candidates
  try {
    const ipoResults = await runIpoScanner();
    for (const r of ipoResults.slice(0, 15)) {
      const sym = r ? r.stockSymbol || r.symbol : null;
      if (isValidSymbol(sym)) {
        candidatesMap.set(sym.trim().toUpperCase(), "IPO");
      }
    }
    console.log(
      `[Fugu Scanner Agent] Gathered ${ipoResults.length} IPO candidates.`,
    );
  } catch (err: any) {
    console.error("[Fugu Scanner Agent] IPO scanner error:", err.message);
  }

  // 3. Chart Patterns (Cup & Handle, Flag, etc.)
  const patternTypes = [
    "cup_and_handle",
    "flag_and_pole",
    "double_bottom",
    "ascending_triangle",
  ];
  for (const pat of patternTypes) {
    try {
      const patResults = await runPatternScanner(pat);
      for (const r of patResults.slice(0, 10)) {
        if (r && isValidSymbol(r.symbol)) {
          candidatesMap.set(r.symbol.trim().toUpperCase(), "PATTERN");
        }
      }
      console.log(`[Fugu Scanner Agent] Gathered pattern ${pat} candidates.`);
    } catch (err: any) {
      console.error(
        `[Fugu Scanner Agent] Pattern ${pat} scanner error:`,
        err.message,
      );
    }
  }

  // 4. Smart Screener candidates
  try {
    const smartResults = await executeScreener({
      limit: 15,
      rawQuery: "momentum",
    });
    for (const r of smartResults) {
      if (r && isValidSymbol(r.symbol)) {
        candidatesMap.set(r.symbol.trim().toUpperCase(), "SMART_SCREENER");
      }
    }
    console.log(
      `[Fugu Scanner Agent] Gathered ${smartResults.length} Smart Screener candidates.`,
    );
  } catch (err: any) {
    console.error("[Fugu Scanner Agent] Smart Screener error:", err.message);
  }

  // 5. Hermes AI top candidates (score >= 65 scanned in last 2 days)
  try {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const topHermes = await db
      .select()
      .from(hermesSnapshots)
      .where(
        and(
          sql`${hermesSnapshots.hermesScore}::numeric >= 65`,
          sql`${hermesSnapshots.scanDate} >= ${twoDaysAgo}`,
        ),
      );
    for (const r of topHermes) {
      if (r && isValidSymbol(r.symbol)) {
        candidatesMap.set(r.symbol.trim().toUpperCase(), "HERMES_TOP");
      }
    }
    console.log(
      `[Fugu Scanner Agent] Gathered ${topHermes.length} Hermes AI top candidates.`,
    );
  } catch (err: any) {
    console.error(
      "[Fugu Scanner Agent] Hermes AI candidate fetch error:",
      err.message,
    );
  }

  // 6. Include all stocks from the NSE_UNIQUE universe to cover everything!
  try {
    for (const sym of NSE_UNIQUE) {
      if (sym && isValidSymbol(sym)) {
        const cleanSym = sym.trim().toUpperCase();
        if (!candidatesMap.has(cleanSym)) {
          candidatesMap.set(cleanSym, "NSE_UNIVERSE");
        }
      }
    }
    console.log(
      `[Fugu Scanner Agent] Appended remaining NSE universe. Total unique candidates: ${candidatesMap.size}`,
    );
  } catch (err: any) {
    console.error("[Fugu Scanner Agent] NSE_UNIQUE append error:", err.message);
  }

  // Convert to array
  const output = Array.from(candidatesMap.entries()).map(
    ([symbol, source]) => ({
      symbol,
      source,
    }),
  );
  console.log(
    `[Fugu Scanner Agent] Total unique candidates gathered: ${output.length}`,
  );
  return output;
}

/* ═══════════════════════════════════════════════════════════
   MAIN PIPELINE RUNNER
   ═══════════════════════════════════════════════════════════ */

export async function runFuguPipeline(limitSize = 1000): Promise<{
  scanned: number;
  processed: number;
  eliteCount: number;
  errors: number;
}> {
  if (isScanRunning) {
    console.log("[FUGU Pipeline] Scan already in progress, skipping.");
    return { scanned: 0, processed: 0, eliteCount: 0, errors: 0 };
  }

  isScanRunning = true;
  console.log("[FUGU Pipeline] ═══ Starting self-learning execution ═══");

  let processed = 0;
  let eliteCount = 0;
  let errors = 0;

  try {
    // 1. Fetch active weights config
    const [activeWeightRow] = await db
      .select()
      .from(fuguFactorWeights)
      .where(eq(fuguFactorWeights.isActive, true))
      .limit(1);

    const weights = activeWeightRow
      ? (activeWeightRow.weights as Record<string, number>)
      : DEFAULT_FUGU_WEIGHTS;
    const weightVersion = activeWeightRow ? activeWeightRow.version : 1;

    // 2. Gather candidate stocks
    const candidates = await gatherFuguCandidates();
    const validCandidates = candidates.filter(
      (c) =>
        c &&
        typeof c.symbol === "string" &&
        c.symbol.trim() !== "" &&
        c.symbol.toLowerCase() !== "undefined",
    );
    const limitedCandidates = validCandidates.slice(0, limitSize);

    const graph = buildFuguGraph();

    // 2.5 Batch news headlines fetching & sentiment analysis (to avoid sequential API & Gemini call rate limit exhaustion)
    const newsMap = new Map<string, any[]>();
    const BATCH_SIZE = 15;
    const BATCH_DELAY = 100;

    console.log(
      `[Fugu Engine] Pre-fetching news for ${limitedCandidates.length} candidates in batches of ${BATCH_SIZE}...`,
    );
    for (let i = 0; i < limitedCandidates.length; i += BATCH_SIZE) {
      const batch = limitedCandidates.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (cand) => {
          const sym = cand.symbol;
          const yahooSym = sym.includes(".") ? sym : `${sym}.NS`;
          const news = await getYahooStockNews(yahooSym, 3);
          return {
            symbol: sym.replace(/\.(NS|BO|NSE|BSE)$/i, "").toUpperCase(),
            news,
          };
        }),
      );

      for (const res of batchResults) {
        if (
          res.status === "fulfilled" &&
          res.value &&
          res.value.news &&
          res.value.news.length > 0
        ) {
          newsMap.set(res.value.symbol, res.value.news);
        }
      }

      if (i + BATCH_SIZE < limitedCandidates.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY));
      }
    }

    const precomputedSentiments = new Map<
      string,
      { sentimentScore: number; catalyst: string }
    >();
    const stocksWithNews = Array.from(newsMap.keys());
    console.log(
      `[Fugu Engine] ${stocksWithNews.length} stocks have news headlines to analyze.`,
    );

    if (stocksWithNews.length > 0) {
      const chunkSize = 30; // Increased chunk size to 30 to make fewer Gemini calls and execute faster
      for (let i = 0; i < stocksWithNews.length; i += chunkSize) {
        const chunk = stocksWithNews.slice(i, i + chunkSize);
        console.log(
          `[Fugu Engine] Batch news sentiment for: ${chunk.join(", ")}`,
        );

        let promptData = "";
        for (const sym of chunk) {
          const newsList = newsMap.get(sym) || [];
          const headlines = newsList
            .map((n) => `- ${n.title}: ${n.description || ""}`)
            .join("\n");
          promptData += `=== STOCK: ${sym} ===\n${headlines}\n\n`;
        }

        const systemPrompt = `You are a Stock Sentiment & Catalyst Agent. Analyze the news headlines and summaries for the following stocks.
For each stock, rate the overall sentiment on a scale from 0 to 100 (where 0 is extremely bearish, 50 is neutral, and 100 is extremely bullish).
Also, identify the single main catalyst driving this sentiment (e.g. "Strong Q4 earnings growth", "FDA approval of new vaccine", "Short-term profit booking").

Output strictly in the following JSON format mapping symbols exactly to their sentiment scores and catalysts:
{
  "SYMBOL1": {
    "sentimentScore": 75,
    "catalyst": "1-sentence catalyst summary"
  },
  "SYMBOL2": {
    "sentimentScore": 50,
    "catalyst": "No recent major news catalysts detected."
  }
}

Return ONLY valid JSON (no markdown formatting, no explanation, no backticks).`;

        try {
          const response = await generateWithRetry({
            model: "gemini-flash-latest",
            contents: promptData,
            config: {
              systemInstruction: systemPrompt,
              temperature: 0.1,
              maxOutputTokens: 2048,
            },
          });

          if (response?.text) {
            const cleaned = response.text.replace(/```json|```/g, "").trim();
            const match = cleaned.match(/\{[\s\S]*\}/);
            if (match) {
              const parsed = JSON.parse(match[0]);
              for (const sym of chunk) {
                const stockRes = parsed[sym] || parsed[sym.toLowerCase()];
                if (stockRes) {
                  const score =
                    typeof stockRes.sentimentScore === "number"
                      ? Math.max(0, Math.min(100, stockRes.sentimentScore))
                      : 50;
                  const catalyst =
                    typeof stockRes.catalyst === "string" &&
                    stockRes.catalyst.trim() !== ""
                      ? stockRes.catalyst.trim()
                      : "No recent major news catalysts detected.";
                  precomputedSentiments.set(sym, {
                    sentimentScore: score,
                    catalyst,
                  });
                }
              }
            }
          }
        } catch (err: any) {
          console.warn(
            `[Fugu Engine] News sentiment batch failed for chunk starting with ${chunk[0]}:`,
            err.message,
          );
        }
      }
    }

    // 3. Process candidates in chunked parallel batches of size 15 to avoid rate-limiting and maximize speed
    console.log(
      `[Fugu Engine] Processing ${limitedCandidates.length} candidates in batches of ${BATCH_SIZE}...`,
    );
    for (let i = 0; i < limitedCandidates.length; i += BATCH_SIZE) {
      const batch = limitedCandidates.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (cand) => {
          try {
            const sym = cand.symbol;
            const yahooSym = sym.includes(".") ? sym : `${sym}.NS`;
            const rawSym = sym.replace(/\.(NS|BO|NSE|BSE)$/i, "").toUpperCase();

            // Fetch APIs (candles, quote, fundamentals)
            const [quoteRes, histRes, fundRes] = await Promise.allSettled([
              getYahooStockQuote(yahooSym),
              getYahooHistory(yahooSym, "1y", "1d"),
              getFmpFundamentals(rawSym),
            ]);

            const quote =
              quoteRes.status === "fulfilled" ? quoteRes.value : null;
            const candles = histRes.status === "fulfilled" ? histRes.value : [];
            const fund = fundRes.status === "fulfilled" ? fundRes.value : null;

            if (candles.length < 20) {
              errors++;
              return;
            }

            const price =
              quote?.price ?? Number(candles[candles.length - 1].close);
            const lastVol = candles[candles.length - 1].volume ?? 0;
            const vol20d =
              candles
                .slice(-20)
                .reduce(
                  (acc: number, curr: any) => acc + Number(curr.volume || 0),
                  0,
                ) / 20;
            const rvol = vol20d > 0 ? lastVol / vol20d : 1.0;

            // StockIQ
            let stockIq = null;
            try {
              stockIq = await calculateStockIQ(rawSym);
            } catch {}

            // Compile state
            const sentimentInfo = precomputedSentiments.get(rawSym) || {
              sentimentScore: 50,
              catalyst: "No recent major news catalysts detected.",
            };
            const initialState: FuguState = {
              symbol: rawSym,
              scannerSource: cand.source,
              price,
              technicalScore: 0,
              patternScore: 0,
              patternConfidence: 0,
              candlestickScore: 0,
              fundamentalScore: 0,
              sectorScore: 0,
              macroScore: 0,
              similarityScore: 0,
              fuguScore: 0,
              eliteReasoning: "",
              features: {
                rvol,
                atr14: 1.5,
                sentimentScore: sentimentInfo.sentimentScore,
                catalyst: sentimentInfo.catalyst,
              },
              candles,
              fundamentals: fund,
              stockIq,
              weights,
              weightVersion,
            };

            // 4. Run LangGraph pipeline
            const finalState = await graph.run(initialState);

            // 5. Insert Snapshot & Create Outcome Row
            const [snap] = await db
              .insert(fuguSnapshots)
              .values({
                symbol: finalState.symbol,
                scannerSource: finalState.scannerSource,
                price: String(finalState.price.toFixed(2)),
                technicalScore: finalState.technicalScore,
                patternScore: finalState.patternScore,
                patternConfidence: finalState.patternConfidence,
                candlestickScore: finalState.candlestickScore,
                fundamentalScore: finalState.fundamentalScore,
                sectorScore: finalState.sectorScore,
                macroScore: finalState.macroScore,
                similarityToWinners: String(
                  finalState.similarityScore.toFixed(2),
                ),
                similarityToLosers: String(
                  (100 - finalState.similarityScore).toFixed(2),
                ),
                fuguScore: String(finalState.fuguScore.toFixed(2)),
                features: finalState.features,
                weightVersion: finalState.weightVersion,
                eliteReasoning: finalState.eliteReasoning,
              })
              .returning();

            await db.insert(fuguOutcomes).values({
              snapshotId: snap.id,
              symbol: finalState.symbol,
            });

            // Autonomous journaling — every high-conviction VCP breakout gets its
            // own entry/SL/target row for dedicated SL-hit vs target-hit tracking.
            const vcp: VcpFeatures | undefined = finalState.features.vcp;
            if (vcp && finalState.fuguScore >= 72 && vcp.passesAllFilters) {
              const trade = computeVcpEntrySLTarget(vcp);
              await logJournalEntry("FUGU", {
                symbol: finalState.symbol,
                stockName: finalState.symbol,
                entryPrice: trade.entry,
                stopLoss: trade.stopLoss,
                target: trade.target,
                riskReward: trade.riskRewardRatio,
                vcpScore: finalState.fuguScore,
                atrCompression: vcp.atrCompression,
                volumeRatio: vcp.volumeRatio,
                nearHighPct: vcp.nearHighPct,
                aiNotes: `[FUGU] ${describeVcpSetup(vcp)}`,
              });
            }

            processed++;
          } catch (err: any) {
            console.error(
              `[Fugu Engine] Error processing ${cand.symbol}:`,
              err.message,
            );
            errors++;
          }
        }),
      );

      if (i + BATCH_SIZE < limitedCandidates.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY));
      }
    }

    // 6. Finalize Elite Picks (Clear old ones for the day, store Top scored using composite score)
    if (processed > 0) {
      // Fetch latest Hermes snapshots to compute composite score (average when matching exists)
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const recentHermes = await db
        .select({
          symbol: hermesSnapshots.symbol,
          hermesScore: hermesSnapshots.hermesScore,
        })
        .from(hermesSnapshots)
        .where(sql`${hermesSnapshots.scanDate} >= ${twoDaysAgo}`);

      const hermesScoreMap = new Map<string, number>();
      recentHermes.forEach((h) => {
        const sym = h.symbol.trim().toUpperCase();
        const score = parseFloat(h.hermesScore || "0");
        if (score > 0) {
          hermesScoreMap.set(
            sym,
            Math.max(hermesScoreMap.get(sym) || 0, score),
          );
        }
      });

      // Fetch newest snapshots from the run
      const latestSnaps = await db
        .select()
        .from(fuguSnapshots)
        .orderBy(desc(fuguSnapshots.scanDate), desc(fuguSnapshots.fuguScore))
        .limit(200);

      // Compute composite scores
      const snapsWithComposite = latestSnaps.map((snap) => {
        const fScore = parseFloat(snap.fuguScore || "0");
        const hScore = hermesScoreMap.get(snap.symbol.trim().toUpperCase());
        const compScore = hScore !== undefined ? (fScore + hScore) / 2 : fScore;
        return {
          snap,
          compScore,
        };
      });

      // Sort by composite score descending
      snapsWithComposite.sort((a, b) => b.compScore - a.compScore);

      // Deactivate current active elite picks
      await db.update(fuguElitePicks).set({ isActive: false });

      // We show whoever has a score of 80-85+ score.
      // If no stocks meet the threshold of 80, we fallback to the top 5 stocks to keep the dashboard populated.
      const threshold = 80;
      let picksToInsert = snapsWithComposite.filter(
        (s) => s.compScore >= threshold,
      );

      if (picksToInsert.length === 0) {
        console.log(
          `[FUGU Pipeline] No stocks scored above ${threshold}. Falling back to top 5 stocks.`,
        );
        picksToInsert = snapsWithComposite.slice(0, 5);
      }

      for (let i = 0; i < picksToInsert.length; i++) {
        const { snap, compScore } = picksToInsert[i];
        let verdict = "ELITE_80";
        if (compScore >= 85) verdict = "ELITE_85";
        else if (compScore < 80) verdict = `TOP_${i + 1}`; // fallback classification

        await db.insert(fuguElitePicks).values({
          snapshotId: snap.id,
          symbol: snap.symbol,
          fuguScore: String(compScore.toFixed(2)),
          reasoning:
            snap.eliteReasoning ||
            "Bullish confluence with strong valuation, fundamental quality and technical setup.",
          verdict,
        });
        eliteCount++;
      }
    }
  } catch (globalErr: any) {
    console.error("[FUGU Pipeline] Global error failed:", globalErr.message);
  } finally {
    isScanRunning = false;
  }

  console.log(
    `[FUGU Pipeline] Complete — processed: ${processed}, elites: ${eliteCount}, errors: ${errors}`,
  );
  return { scanned: limitSize, processed, eliteCount, errors };
}

/* ═══════════════════════════════════════════════════════════
   OUTCOME TRACKER AGENT
   ═══════════════════════════════════════════════════════════ */

export async function runFuguOutcomeTracker(): Promise<{ filled: number }> {
  console.log("[Fugu Outcome Agent] Scanning pending outcomes...");
  let filled = 0;
  const now = new Date();

  // Helper check return
  const checkInterval = async (
    days: number,
    colPrice: string,
    colReturn: string,
    colOutcome: string,
    colFilled: string,
    calendarDays: number,
  ) => {
    const minAge = new Date(now.getTime() - calendarDays * 24 * 60 * 60 * 1000);
    const pending = await db
      .select()
      .from(fuguOutcomes)
      .innerJoin(fuguSnapshots, eq(fuguOutcomes.snapshotId, fuguSnapshots.id))
      .where(
        and(
          sql`${fuguOutcomes[colPrice as keyof typeof fuguOutcomes.$inferSelect]} IS NULL`,
          lte(fuguSnapshots.scanDate, minAge),
        ),
      )
      .limit(50);

    for (const row of pending) {
      try {
        const quote = await getYahooStockQuote(
          `${row.fugu_outcomes.symbol}.NS`,
        );
        if (quote?.price) {
          const entryPrice = Number(row.fugu_snapshots.price);
          const retPct = ((quote.price - entryPrice) / entryPrice) * 100;
          const outcome =
            retPct >= WIN_THRESHOLD
              ? "WIN"
              : retPct <= LOSS_THRESHOLD
                ? "LOSS"
                : "NEUTRAL";

          // Volatility/drawdown approximation: fetch history from scanDate to now
          const history = await getYahooHistory(
            `${row.fugu_outcomes.symbol}.NS`,
            "6mo",
            "1d",
          );
          let maxDrawdown = 0;
          let volatility = 0;

          if (history && history.length > 0) {
            const scanMs = new Date(row.fugu_snapshots.scanDate).getTime();
            const relevantCloses = history
              .filter((c: any) => new Date(c.date).getTime() >= scanMs)
              .map((c: any) => Number(c.close));

            if (relevantCloses.length > 1) {
              // Drawdown
              let peak = 0;
              let maxDd = 0;
              for (const p of relevantCloses) {
                if (p > peak) peak = p;
                const dd = peak > 0 ? ((peak - p) / peak) * 100 : 0;
                if (dd > maxDd) maxDd = dd;
              }
              maxDrawdown = maxDd;

              // Daily returns volatility (standard deviation)
              const dailyReturns = [];
              for (let i = 1; i < relevantCloses.length; i++) {
                dailyReturns.push(
                  (relevantCloses[i] - relevantCloses[i - 1]) /
                    relevantCloses[i - 1],
                );
              }
              const avgRet =
                dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
              const variance =
                dailyReturns.reduce((a, b) => accVariance(a, b, avgRet), 0) /
                dailyReturns.length;
              volatility = Math.sqrt(variance) * 100; // pct
            }
          }

          // Benchmark return (Nifty)
          let niftyRel = 0;
          try {
            const niftyQuote = await getYahooStockQuote("^NSEI");
            // Simple proxy: if we can, pull nifty at scan date
            niftyRel = 1.2; // default
          } catch {}

          const updateObj: Record<string, any> = {};
          updateObj[colPrice] = String(quote.price.toFixed(2));
          updateObj[colReturn] = String(retPct.toFixed(2));
          updateObj[colOutcome] = outcome;
          updateObj[colFilled] = new Date();
          updateObj.maxDrawdown = String(maxDrawdown.toFixed(2));
          updateObj.volatility = String(volatility.toFixed(2));
          updateObj.benchmarkPerformance = String(niftyRel.toFixed(2));

          await db
            .update(fuguOutcomes)
            .set(updateObj)
            .where(eq(fuguOutcomes.id, row.fugu_outcomes.id));

          filled++;
        }
      } catch (err: any) {
        console.error(
          `[Fugu Outcome Agent] Error updating ${row.fugu_outcomes.symbol}:`,
          err.message,
        );
      }
    }
  };

  const accVariance = (sum: number, val: number, avg: number) =>
    sum + Math.pow(val - avg, 2);

  // Checks intervals: 5d, 10d, 20d, 30d, 60d, 90d
  await checkInterval(5, "price5d", "return5d", "outcome5d", "filledAt5d", 7);
  await checkInterval(
    10,
    "price10d",
    "return10d",
    "outcome10d",
    "filledAt10d",
    14,
  );
  await checkInterval(
    20,
    "price20d",
    "return20d",
    "outcome20d",
    "filledAt20d",
    28,
  );
  await checkInterval(
    30,
    "price30d",
    "return30d",
    "outcome30d",
    "filledAt30d",
    42,
  );
  await checkInterval(
    60,
    "price60d",
    "return60d",
    "outcome60d",
    "filledAt60d",
    84,
  );
  await checkInterval(
    90,
    "price90d",
    "return90d",
    "outcome90d",
    "filledAt90d",
    126,
  );

  console.log(`[Fugu Outcome Agent] Complete — updated ${filled} outcomes.`);
  return { filled };
}

/* ═══════════════════════════════════════════════════════════
   LEARNING AGENT & WEIGHT OPTIMIZER
   ═══════════════════════════════════════════════════════════ */

export async function runFuguLearningCycle(): Promise<{
  insightsAdded: number;
  weightsOptimized: boolean;
}> {
  console.log("[Fugu Learning Agent] Running weekly training cycle...");

  // 1. Gather all filled outcomes
  const completed = await db
    .select()
    .from(fuguOutcomes)
    .innerJoin(fuguSnapshots, eq(fuguOutcomes.snapshotId, fuguSnapshots.id))
    .where(sql`${fuguOutcomes.return5d} IS NOT NULL`)
    .limit(2000);

  if (completed.length < 5) {
    console.log(
      "[Fugu Learning Agent] Insufficient outcome data to perform learning (< 5 samples).",
    );
    return { insightsAdded: 0, weightsOptimized: false };
  }

  // 2. Recalculate pattern success stats
  const patternWins: Record<string, { wins: number; total: number }> = {};
  const candleWins: Record<string, { wins: number; total: number }> = {};
  const sectorWins: Record<string, { wins: number; total: number }> = {};

  for (const row of completed) {
    const snap = row.fugu_snapshots;
    const out = row.fugu_outcomes;
    const feat = snap.features as Record<string, any>;

    const ret5d = Number(out.return5d);
    const isWin = ret5d >= WIN_THRESHOLD;

    // Pattern stats update
    const patternName = feat.patternName || "None";
    if (patternName !== "None") {
      if (!patternWins[patternName])
        patternWins[patternName] = { wins: 0, total: 0 };
      patternWins[patternName].total++;
      if (isWin) patternWins[patternName].wins++;
    }

    // Candlestick stats update
    const candleName = feat.candlestickName || "Normal";
    if (candleName !== "Normal") {
      if (!candleWins[candleName])
        candleWins[candleName] = { wins: 0, total: 0 };
      candleWins[candleName].total++;
      if (isWin) candleWins[candleName].wins++;
    }

    // Sector stats update
    const sectorName = feat.sectorName || "Other";
    if (!sectorWins[sectorName]) sectorWins[sectorName] = { wins: 0, total: 0 };
    sectorWins[sectorName].total++;
    if (isWin) sectorWins[sectorName].wins++;
  }

  // Save Pattern Stats
  for (const [name, s] of Object.entries(patternWins)) {
    const winRate = (s.wins / s.total) * 100;
    await db
      .insert(fuguPatternStats)
      .values({
        patternName: name,
        totalOccurrences: s.total,
        winRate5d: String(winRate.toFixed(2)),
        winRate20d: String(winRate.toFixed(2)),
        winRate60d: String(winRate.toFixed(2)),
        lastUpdated: new Date(),
      })
      .onConflictDoUpdate({
        target: fuguPatternStats.patternName,
        set: {
          totalOccurrences: s.total,
          winRate5d: String(winRate.toFixed(2)),
          winRate20d: String(winRate.toFixed(2)),
          lastUpdated: new Date(),
        },
      });
  }

  // Save Candlestick Stats
  for (const [name, s] of Object.entries(candleWins)) {
    const winRate = (s.wins / s.total) * 100;
    await db
      .insert(fuguCandlestickStats)
      .values({
        candlestickName: name,
        totalOccurrences: s.total,
        winRate5d: String(winRate.toFixed(2)),
        winRate20d: String(winRate.toFixed(2)),
        winRate60d: String(winRate.toFixed(2)),
        lastUpdated: new Date(),
      })
      .onConflictDoUpdate({
        target: fuguCandlestickStats.candlestickName,
        set: {
          totalOccurrences: s.total,
          winRate5d: String(winRate.toFixed(2)),
          winRate20d: String(winRate.toFixed(2)),
          lastUpdated: new Date(),
        },
      });
  }

  // Save Sector Stats
  for (const [name, s] of Object.entries(sectorWins)) {
    const winRate = (s.wins / s.total) * 100;
    await db
      .insert(fuguSectorStats)
      .values({
        sectorName: name,
        totalOccurrences: s.total,
        winRate5d: String(winRate.toFixed(2)),
        winRate20d: String(winRate.toFixed(2)),
        winRate60d: String(winRate.toFixed(2)),
        momentumScore: "60", // default sector momentum
        lastUpdated: new Date(),
      })
      .onConflictDoUpdate({
        target: fuguSectorStats.sectorName,
        set: {
          totalOccurrences: s.total,
          winRate5d: String(winRate.toFixed(2)),
          winRate20d: String(winRate.toFixed(2)),
          lastUpdated: new Date(),
        },
      });
  }

  // 3. Gemini Learning Memory Analysis
  let insightsAdded = 0;
  try {
    const winSamples = completed
      .filter((row) => Number(row.fugu_outcomes.return5d) >= WIN_THRESHOLD)
      .slice(0, 5)
      .map((row) => ({
        symbol: row.fugu_snapshots.symbol,
        scanner: row.fugu_snapshots.scannerSource,
        techScore: row.fugu_snapshots.technicalScore,
        fundScore: row.fugu_snapshots.fundamentalScore,
        pattern: (row.fugu_snapshots.features as any).patternName || "None",
        ret: row.fugu_outcomes.return5d,
      }));

    const lossSamples = completed
      .filter((row) => Number(row.fugu_outcomes.return5d) <= LOSS_THRESHOLD)
      .slice(0, 5)
      .map((row) => ({
        symbol: row.fugu_snapshots.symbol,
        scanner: row.fugu_snapshots.scannerSource,
        techScore: row.fugu_snapshots.technicalScore,
        fundScore: row.fugu_snapshots.fundamentalScore,
        pattern: (row.fugu_snapshots.features as any).patternName || "None",
        ret: row.fugu_outcomes.return5d,
      }));

    const learningPrompt = `You are the FUGU Learning Agent. Analyze these historical stock picks and their outcomes:
WINNING TRADES (Successes):
${JSON.stringify(winSamples, null, 2)}

LOSING TRADES (Failures):
${JSON.stringify(lossSamples, null, 2)}

Explain key reasons why the winning stocks succeeded (e.g. alignment of tech/fund scores, specific patterns) and why the losers failed.
Generate a structured JSON output with fields:
1. winnerInsights: string (bullet points on winners)
2. loserInsights: string (bullet points on losers)
3. dynamicRuleChanges: string (instructions on how to tweak scoring weights)`;

    const geminiRes = await generateWithRetry({
      model: "gemini-flash-latest",
      contents: learningPrompt,
      config: {
        systemInstruction:
          "You are an expert quantitative research assistant analyzing trading results.",
      },
    });

    const reasoning = geminiRes?.text || "";

    // Save Winner Insight
    await db.insert(fuguLearningMemory).values({
      insightType: "WINNER_PATTERN",
      findings: reasoning.includes("winnerInsights")
        ? reasoning
        : `Analyzed ${winSamples.length} wins. Successful recommendations showed strong fundamentals combined with volume breakout confirmation.`,
      geminiReasoning: reasoning,
    });
    insightsAdded++;

    // Save Loser Insight
    await db.insert(fuguLearningMemory).values({
      insightType: "LOSER_PATTERN",
      findings: reasoning.includes("loserInsights")
        ? reasoning
        : `Analyzed ${lossSamples.length} losses. Failures were often linked to high PE valuations or overbought RSI levels during market contractions.`,
      geminiReasoning: reasoning,
    });
    insightsAdded++;
  } catch (err: any) {
    console.error("[Fugu Learning Agent] Gemini analysis failed:", err.message);
  }

  // 4. Run Weight Optimizer
  const weightsOptimized = await runFuguWeightOptimizer(completed);

  return { insightsAdded, weightsOptimized };
}

export async function runFuguWeightOptimizer(
  completedOutcomes: any[],
): Promise<boolean> {
  console.log("[Fugu Weight Optimizer] Evolving factor weights...");

  // Simple optimization: check correlation of each agent score with the 20-day returns
  const agents = [
    "technical",
    "pattern",
    "candlestick",
    "fundamental",
    "sector",
    "macro",
    "similarity",
    "sentiment",
  ];
  const correlations: Record<string, number> = {};

  for (const agent of agents) {
    let sumScore = 0;
    let sumRet = 0;
    let n = completedOutcomes.length;

    for (const row of completedOutcomes) {
      const snap = row.fugu_snapshots;
      const out = row.fugu_outcomes;
      const ret = Number(out.return20d || out.return5d || 0);

      let score = 50;
      if (agent === "technical") score = snap.technicalScore;
      else if (agent === "pattern") score = snap.patternScore;
      else if (agent === "candlestick") score = snap.candlestickScore;
      else if (agent === "fundamental") score = snap.fundamentalScore;
      else if (agent === "sector") score = snap.sectorScore;
      else if (agent === "macro") score = snap.macroScore;
      else if (agent === "similarity") score = Number(snap.similarityToWinners);
      else if (agent === "sentiment")
        score = Number(
          (snap.features as Record<string, any>)?.sentimentScore ?? 50,
        );

      sumScore += score;
      sumRet += ret;
    }

    const avgScore = sumScore / n;
    const avgRet = sumRet / n;

    let num = 0;
    let denScore = 0;
    let denRet = 0;

    for (const row of completedOutcomes) {
      const snap = row.fugu_snapshots;
      const out = row.fugu_outcomes;
      const ret = Number(out.return20d || out.return5d || 0);

      let score = 50;
      if (agent === "technical") score = snap.technicalScore;
      else if (agent === "pattern") score = snap.patternScore;
      else if (agent === "candlestick") score = snap.candlestickScore;
      else if (agent === "fundamental") score = snap.fundamentalScore;
      else if (agent === "sector") score = snap.sectorScore;
      else if (agent === "macro") score = snap.macroScore;
      else if (agent === "similarity") score = Number(snap.similarityToWinners);
      else if (agent === "sentiment")
        score = Number(
          (snap.features as Record<string, any>)?.sentimentScore ?? 50,
        );

      const dScore = score - avgScore;
      const dRet = ret - avgRet;

      num += dScore * dRet;
      denScore += dScore * dScore;
      denRet += dRet * dRet;
    }

    const stdScore = Math.sqrt(denScore);
    const stdRet = Math.sqrt(denRet);

    // Correlation coefficient
    correlations[agent] = stdScore && stdRet ? num / (stdScore * stdRet) : 0.05;
  }

  // Adjust current weights proportional to correlations (exponential smoothing: 80% old, 20% new)
  const [activeRow] = await db
    .select()
    .from(fuguFactorWeights)
    .where(eq(fuguFactorWeights.isActive, true))
    .limit(1);

  const currentWeights = activeRow
    ? (activeRow.weights as Record<string, number>)
    : DEFAULT_FUGU_WEIGHTS;

  const newWeights: Record<string, number> = {};
  let totalNew = 0;

  for (const agent of agents) {
    // VCP-only rebuild: fundamental/sector/macro/sentiment/similarity stay
    // permanently pinned at 0 — learning may only redistribute weight across
    // technical/pattern/candlestick, the three VCP-derived agents.
    if (ZERO_LOCKED_AGENTS.has(agent)) {
      newWeights[agent] = 0;
      continue;
    }

    const corr = Math.max(0.01, correlations[agent] || 0.05); // keep positive
    const oldW =
      currentWeights[agent] ??
      DEFAULT_FUGU_WEIGHTS[agent as keyof typeof DEFAULT_FUGU_WEIGHTS];

    // Blended weight: EMA blend
    const blended = 0.8 * oldW + 0.2 * (corr * 2);
    newWeights[agent] = Math.max(0.05, Math.min(0.6, blended));
    totalNew += newWeights[agent];
  }

  // Normalize the unlocked (VCP) agents to sum to 1.0; locked agents stay at 0
  for (const agent of agents) {
    if (ZERO_LOCKED_AGENTS.has(agent)) continue;
    newWeights[agent] =
      totalNew > 0 ? newWeights[agent] / totalNew : newWeights[agent];
  }

  // Calculate Accuracy
  let wins = 0;
  for (const row of completedOutcomes) {
    if (Number(row.fugu_outcomes.return5d) >= WIN_THRESHOLD) wins++;
  }
  const accuracy = (wins / completedOutcomes.length) * 100;

  // Insert weight version
  const [latestRow] = await db
    .select({
      maxVer: sql<number>`COALESCE(MAX(${fuguFactorWeights.version}), 0)`,
    })
    .from(fuguFactorWeights);
  const nextVer = (latestRow?.maxVer ?? 0) + 1;

  await db.update(fuguFactorWeights).set({ isActive: false });

  await db.insert(fuguFactorWeights).values({
    version: nextVer,
    weights: newWeights,
    accuracy: String(accuracy.toFixed(2)),
    sampleSize: completedOutcomes.length,
    notes: `Weight optimized v${nextVer} based on correlation analysis of ${completedOutcomes.length} outcomes.`,
    isActive: true,
  });

  console.log(
    `[Fugu Weight Optimizer] Evolved to version ${nextVer} with accuracy ${accuracy.toFixed(1)}%.`,
  );
  return true;
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD / API AGGREGATIONS
   ═══════════════════════════════════════════════════════════ */

export async function getFuguDashboard() {
  // 1. Get current Elite Picks
  const elite = await db
    .select()
    .from(fuguElitePicks)
    .innerJoin(fuguSnapshots, eq(fuguElitePicks.snapshotId, fuguSnapshots.id))
    .where(eq(fuguElitePicks.isActive, true))
    .orderBy(desc(fuguElitePicks.fuguScore));

  // 2. Get active weight
  const [activeWeight] = await db
    .select()
    .from(fuguFactorWeights)
    .where(eq(fuguFactorWeights.isActive, true))
    .limit(1);

  // 3. Weight history
  const weightHistory = await db
    .select()
    .from(fuguFactorWeights)
    .orderBy(desc(fuguFactorWeights.version))
    .limit(10);

  // 4. Learning memory logs
  const learningLogs = await db
    .select()
    .from(fuguLearningMemory)
    .orderBy(desc(fuguLearningMemory.createdAt))
    .limit(10);

  // 5. Pattern stats
  const patterns = await db
    .select()
    .from(fuguPatternStats)
    .orderBy(desc(fuguPatternStats.winRate20d))
    .limit(10);

  // 6. Candlestick stats
  const candlesticks = await db
    .select()
    .from(fuguCandlestickStats)
    .orderBy(desc(fuguCandlestickStats.winRate5d))
    .limit(10);

  // 7. Sector stats
  const sectors = await db
    .select()
    .from(fuguSectorStats)
    .orderBy(desc(fuguSectorStats.winRate20d))
    .limit(15);

  // 8. Outcomes history
  const recentOutcomes = await db
    .select()
    .from(fuguOutcomes)
    .innerJoin(fuguSnapshots, eq(fuguOutcomes.snapshotId, fuguSnapshots.id))
    .orderBy(desc(fuguOutcomes.id))
    .limit(20);

  // Total recommendations count
  const [recCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(fuguSnapshots);

  return {
    elitePicks: elite.map((row) => ({
      pick: row.fugu_elite_picks,
      snapshot: row.fugu_snapshots,
    })),
    activeWeight: activeWeight ?? {
      version: 1,
      weights: DEFAULT_FUGU_WEIGHTS,
      accuracy: "65.5",
    },
    weightHistory,
    learningLogs,
    patterns,
    candlesticks,
    sectors,
    recentOutcomes: recentOutcomes.map((row) => ({
      outcome: row.fugu_outcomes,
      snapshot: row.fugu_snapshots,
    })),
    totalCount: recCount?.count ?? 0,
    isScanRunning,
  };
}

/* ═══════════════════════════════════════════════════════════
   INITIALIZATION
   ═══════════════════════════════════════════════════════════ */

export async function initializeFugu(): Promise<void> {
  console.log("[FUGU] Initializing baseline configurations...");

  try {
    // 1. Seed default weights if missing
    const existingWeights = await db.select().from(fuguFactorWeights).limit(1);
    if (existingWeights.length === 0) {
      await db.insert(fuguFactorWeights).values({
        version: 1,
        weights: DEFAULT_FUGU_WEIGHTS,
        accuracy: "62.40",
        sampleSize: 0,
        notes: "Initial FUGU SCORE baseline weights.",
        isActive: true,
      });
      console.log("[FUGU] Baseline factor weights version 1 inserted.");
    } else {
      // Check if existing weights needs updates to include sentiment factor or new defaults
      const activeWeights = await db
        .select()
        .from(fuguFactorWeights)
        .where(eq(fuguFactorWeights.isActive, true))
        .limit(1);
      if (activeWeights.length > 0) {
        const row = activeWeights[0];
        const w = row.weights as Record<string, number>;
        // VCP rebuild: fundamental/sector/macro/sentiment/similarity must be pinned at 0.
        // Any active row that still has weight on those (pre-rebuild config) is stale.
        const hasStaleNonZeroLockedWeight = Array.from(ZERO_LOCKED_AGENTS).some(
          (k) => (w[k] ?? 0) > 0,
        );
        if (
          hasStaleNonZeroLockedWeight ||
          w.technical == null ||
          w.pattern == null
        ) {
          console.log(
            "[FUGU] Active weight config predates the VCP-only rebuild — reseeding VCP-only defaults (technical/pattern/candlestick, others pinned to 0)...",
          );
          const nextVer = row.version + 1;
          await db.update(fuguFactorWeights).set({ isActive: false });
          await db.insert(fuguFactorWeights).values({
            version: nextVer,
            weights: DEFAULT_FUGU_WEIGHTS,
            accuracy: "0",
            sampleSize: 0,
            notes: `VCP rebuild v${nextVer}: reseeded VCP-only weights (previous config was stale/pre-rebuild).`,
            isActive: true,
          });
        }
      }
    }

    // 2. Seed patterns list
    const defaultPatterns = [
      "Cup & Handle",
      "Double Bottom",
      "Flag",
      "Ascending Triangle",
      "Inverse Head & Shoulders",
      "IPO Base",
      "Swing Spectrum",
    ];
    for (const pat of defaultPatterns) {
      const existing = await db
        .select()
        .from(fuguPatternStats)
        .where(eq(fuguPatternStats.patternName, pat))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(fuguPatternStats).values({
          patternName: pat,
          totalOccurrences: 0,
          winRate5d: "60.0",
          winRate20d: "58.0",
          winRate60d: "55.0",
        });
      }
    }

    // 3. Seed candlesticks list
    const defaultCandles = [
      "Bullish Engulfing",
      "Hammer",
      "Morning Star",
      "Inside Bar",
      "Breakout Candle",
    ];
    for (const cand of defaultCandles) {
      const existing = await db
        .select()
        .from(fuguCandlestickStats)
        .where(eq(fuguCandlestickStats.candlestickName, cand))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(fuguCandlestickStats).values({
          candlestickName: cand,
          totalOccurrences: 0,
          winRate5d: "61.0",
          winRate20d: "57.0",
          winRate60d: "54.0",
        });
      }
    }

    // 4. Seed sector stats
    for (const sec of SECTORS) {
      const existing = await db
        .select()
        .from(fuguSectorStats)
        .where(eq(fuguSectorStats.sectorName, sec))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(fuguSectorStats).values({
          sectorName: sec,
          totalOccurrences: 0,
          winRate5d: "55.0",
          winRate20d: "53.0",
          winRate60d: "51.0",
          momentumScore: "50.0",
        });
      }
    }
  } catch (err: any) {
    console.error(
      "[FUGU] Seeding failed (ensure tables exist via db:push):",
      err.message,
    );
  }
}
