/**
 * HERMES AI — Self-Learning Stock Intelligence Engine
 *
 * Core capabilities:
 *   1. Daily Scan — Snapshot every stock with all indicators
 *   2. Outcome Tracker — Fill 5/10/20-day forward returns
 *   3. Learning Engine — Evolve scoring weights from real outcomes
 *   4. Regime Classifier — Classify market conditions
 *   5. Adaptive Scoring — Score stocks using learned weights
 *
 * Reuses: stockApi (Yahoo/FMP data), stockiq (sub-scores),
 *         patternScanner (chart patterns), gemini (regime analysis)
 */

import { db } from "./db";
import {
  hermesSnapshots,
  hermesOutcomes,
  hermesWeights,
  hermesRegimeLog,
  type HermesSnapshot,
  type HermesOutcome,
  type HermesWeight,
  type HermesRegimeLog,
} from "@shared/schema";
import { eq, and, isNull, lte, desc, asc, sql, count } from "drizzle-orm";
import { NSE_UNIQUE } from "./nseUniverse";
import {
  getYahooStockQuote,
  getYahooHistory,
  getFmpFundamentals,
  computeSMA,
  computeRSI,
  computeEMA,
} from "./stockApi";
import { calculateStockIQ } from "./stockiq";
import {
  computeVcpFeatures,
  computeVcpScore,
  computeVcpEntrySLTarget,
  describeVcpSetup,
  type VcpFeatures,
} from "./vcpCore";
import { logJournalEntry } from "./vcpJournalEngine";

/* ═══════════════════════════════════════════════════════════
   CONSTANTS & DEFAULT WEIGHTS (VCP-ONLY — HERMES v2)
   Goal: find VCP breakouts expected to swing 5-10% within ~1-2 days.
═══════════════════════════════════════════════════════════ */

/** Win threshold aligned to the 5-10% swing target band, loss aligned to SL risk */
const WIN_THRESHOLD = 5.0;
const LOSS_THRESHOLD = -4.0;

/** Maximum stocks to scan per daily run */
const MAX_SCAN_UNIVERSE = 200;

/** Batch size for parallel Yahoo API calls */
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 600;

/** Default weight vector — v0 "intuition" before any learning. VCP factors only. */
export const DEFAULT_WEIGHTS: Record<string, number> = {
  atr_compression: 0.16, // ATR fallen sharply vs 10d ago
  progressive_contraction: 0.1, // Multi-stage tightening (contractionCount)
  tight_coil: 0.12, // ATR/price ratio very tight
  volume_dryup: 0.16, // Volume well below 20d avg (classic VCP dry-up)
  near_52w_high: 0.14, // Trading near the 52-week high
  ema_stack_full: 0.14, // Full stage-2 EMA stack alignment
  ema50_rising: 0.06, // EMA50 sloping up
  range_quality: 0.06, // Meaningful 52w range (not a flat penny stock)
  rs_score: 0.04, // 6-month relative strength
  liquidity_turnover: 0.02, // Enough turnover to trade safely
};

/** Sector mapping for NSE stocks */
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

/* ═══════════════════════════════════════════════════════════
   HELPER: Compute ADX (Average Directional Index)
═══════════════════════════════════════════════════════════ */
function computeADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
): number | null {
  const n = highs.length;
  if (n < period * 2 + 1) return null;

  const trueRanges: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < n; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    );
    trueRanges.push(tr);

    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  // Smoothed averages
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);

  const dxValues: number[] = [];

  for (let i = period; i < trueRanges.length; i++) {
    atr = atr - atr / period + trueRanges[i];
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDM[i];
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDM[i];

    const plusDI = atr > 0 ? (smoothPlusDM / atr) * 100 : 0;
    const minusDI = atr > 0 ? (smoothMinusDM / atr) * 100 : 0;
    const diSum = plusDI + minusDI;
    const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
    dxValues.push(dx);
  }

  if (dxValues.length < period) return null;
  let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
  }
  return adx;
}

/** Compute ATR */
function computeATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
): number | null {
  const n = highs.length;
  if (n < period + 1) return null;

  const trueRanges: number[] = [];
  for (let i = 1; i < n; i++) {
    trueRanges.push(
      Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1]),
      ),
    );
  }

  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }
  return atr;
}

/* ═══════════════════════════════════════════════════════════
   ACTIVE WEIGHTS — Load from DB or use defaults
═══════════════════════════════════════════════════════════ */
let activeWeightsCache: {
  weights: Record<string, number>;
  version: number;
  ts: number;
} | null = null;
const WEIGHT_CACHE_TTL = 30 * 60 * 1000; // 30 min

async function getActiveWeights(): Promise<{
  weights: Record<string, number>;
  version: number;
}> {
  if (
    activeWeightsCache &&
    Date.now() - activeWeightsCache.ts < WEIGHT_CACHE_TTL
  ) {
    return {
      weights: activeWeightsCache.weights,
      version: activeWeightsCache.version,
    };
  }

  try {
    const [active] = await db
      .select()
      .from(hermesWeights)
      .where(eq(hermesWeights.isActive, true))
      .limit(1);

    if (active) {
      const w = active.weights as Record<string, number>;
      const isStaleSchema = !Object.keys(DEFAULT_WEIGHTS).every((k) => k in w);
      if (isStaleSchema) {
        // Pre-VCP-rebuild weight rows use a completely different key set (fundamentals/RSI/etc).
        // Re-seed a fresh v1 VCP weight set rather than silently scoring everything as 0/50.
        console.warn(
          "[HERMES] Active weights use a stale (pre-VCP) schema — reseeding default VCP weights.",
        );
        await db.update(hermesWeights).set({ isActive: false });
        const [latest] = await db
          .select({
            maxVer: sql<number>`COALESCE(MAX(${hermesWeights.version}), 0)`,
          })
          .from(hermesWeights);
        const newVersion = (latest?.maxVer ?? 0) + 1;
        await db.insert(hermesWeights).values({
          version: newVersion,
          weights: DEFAULT_WEIGHTS,
          accuracy: "0",
          sampleSize: 0,
          notes: `VCP rebuild v${newVersion}: reseeded default weights (previous weight schema was stale)`,
          isActive: true,
        });
        activeWeightsCache = {
          weights: DEFAULT_WEIGHTS,
          version: newVersion,
          ts: Date.now(),
        };
        return { weights: DEFAULT_WEIGHTS, version: newVersion };
      }
      activeWeightsCache = {
        weights: w,
        version: active.version,
        ts: Date.now(),
      };
      return { weights: w, version: active.version };
    }
  } catch (e) {
    console.error("[HERMES] Failed to load active weights:", e);
  }

  // Fallback: insert default weights as v1 if none exist
  return { weights: DEFAULT_WEIGHTS, version: 0 };
}

/* ═══════════════════════════════════════════════════════════
   HERMES SCORE — Compute adaptive VCP score for a stock
═══════════════════════════════════════════════════════════ */

function vcpConditions(f: VcpFeatures): Record<string, boolean> {
  return {
    atr_compression: f.atrCompression >= 0.3,
    progressive_contraction: f.contractionCount >= 2,
    tight_coil: f.tightCoilRatio <= 0.05,
    volume_dryup: f.volumeRatio <= 0.75,
    near_52w_high: f.nearHighPct >= 85,
    ema_stack_full: f.emaStackScore >= 0.85,
    ema50_rising: f.ema50Rising,
    range_quality: f.rangeQuality >= 1.2,
    rs_score: f.rsScore > 15,
    liquidity_turnover: f.turnover >= 2_000_000,
  };
}

function computeHermesScore(
  features: VcpFeatures,
  weights: Record<string, number>,
): number {
  let score = 0;
  let maxPossible = 0;

  const conditions = vcpConditions(features);
  const strengths: Record<string, number> = {
    atr_compression: Math.min(1, features.atrCompression / 0.6),
    progressive_contraction: features.contractionCount / 3,
    tight_coil: Math.min(
      1,
      Math.max(0, (0.06 - features.tightCoilRatio) / 0.06),
    ),
    volume_dryup: Math.min(1, Math.max(0, (1 - features.volumeRatio) / 0.5)),
    near_52w_high: Math.min(1, Math.max(0, (features.nearHighPct - 80) / 20)),
    ema_stack_full: features.emaStackScore,
    ema50_rising: 1,
    range_quality: 1,
    rs_score: Math.min(1, Math.max(0, features.rsScore / 30)),
    liquidity_turnover: 1,
  };

  const add = (key: string) => {
    const w = weights[key] || 0;
    maxPossible += w;
    if (conditions[key]) {
      score += w * (strengths[key] ?? 1.0);
    }
  };

  for (const key of Object.keys(DEFAULT_WEIGHTS)) add(key);

  // Normalize to 0-100
  if (maxPossible <= 0) return 50;
  return Math.round((score / maxPossible) * 100);
}

function hermesVerdict(score: number): string {
  if (score >= 72) return "BUY";
  if (score >= 45) return "HOLD";
  return "AVOID";
}

/* ═══════════════════════════════════════════════════════════
   DAILY SCAN — Snapshot every stock in the universe
═══════════════════════════════════════════════════════════ */

let isScanRunning = false;

export async function runDailyScan(universeSize = MAX_SCAN_UNIVERSE): Promise<{
  scanned: number;
  inserted: number;
  errors: number;
  duration: string;
}> {
  if (isScanRunning) {
    console.log("[HERMES] Scan already in progress, skipping.");
    return { scanned: 0, inserted: 0, errors: 0, duration: "0s" };
  }

  isScanRunning = true;
  const startTime = Date.now();
  console.log(
    `[HERMES] ═══ Starting daily scan for ${universeSize} stocks ═══`,
  );

  const { weights, version } = await getActiveWeights();
  const universe = NSE_UNIQUE.slice(0, universeSize);
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < universe.length; i += BATCH_SIZE) {
    const batch = universe.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (sym) => {
        try {
          const yahooSym = `${sym}.NS`;

          // Fetch data — candles are all HERMES v2 needs (VCP is pure price/volume)
          const [quoteRes, histRes] = await Promise.allSettled([
            getYahooStockQuote(yahooSym),
            getYahooHistory(yahooSym, "1y", "1d"),
          ]);

          const quote = quoteRes.status === "fulfilled" ? quoteRes.value : null;
          const candles = histRes.status === "fulfilled" ? histRes.value : [];

          if (!candles || candles.length < 60) return;

          const vcp = computeVcpFeatures(candles);
          if (!vcp) return;

          const price = quote?.price ?? vcp.price;

          // Momentum (kept for dashboard display only — not used in scoring anymore)
          const closes = candles
            .map((c: any) => Number(c.close))
            .filter((v: number) => isFinite(v));
          const n = closes.length;
          const ret = (days: number) =>
            n > days
              ? ((closes[n - 1] - closes[n - 1 - days]) /
                  closes[n - 1 - days]) *
                100
              : null;
          const return1w = ret(5);
          const return1m = ret(22);
          const return3m = ret(66);
          const return6m = ret(132);

          const marketCapValue = quote?.marketCap ?? null;
          const capCr = (marketCapValue ?? 0) / 1e7;
          const marketCapBucket =
            capCr >= 50000 ? "LARGE" : capCr >= 10000 ? "MID" : "SMALL";
          const sector = SECTOR_MAP[sym] || "Other";

          const hermesScoreVal = computeHermesScore(vcp, weights);
          const verdict = hermesVerdict(hermesScoreVal);

          // Insert snapshot
          const [snap] = await db
            .insert(hermesSnapshots)
            .values({
              symbol: sym,
              price: String(price),
              volume: null,
              volumeAvg20d: null,
              rvol: String(vcp.volumeRatio.toFixed(2)),
              rsi14: null,
              sma20: null,
              sma50: null,
              ema12: null,
              ema26: null,
              macdHistogram: null,
              adx: null,
              atr14: String(vcp.atr14.toFixed(2)),
              pe: null,
              roe: null,
              debtToEquity: null,
              opm: null,
              roce: null,
              peg: null,
              marketCapValue:
                marketCapValue != null
                  ? String(Math.round(marketCapValue))
                  : null,
              dividendYield: null,
              return1w: return1w != null ? String(return1w.toFixed(2)) : null,
              return1m: return1m != null ? String(return1m.toFixed(2)) : null,
              return3m: return3m != null ? String(return3m.toFixed(2)) : null,
              return6m: return6m != null ? String(return6m.toFixed(2)) : null,
              proximity52wHigh: String(vcp.nearHighPct.toFixed(2)),
              iqTotal: computeVcpScore(vcp),
              iqFundamentals: 0,
              iqTechnicals: 0,
              iqMomentum: 0,
              iqInsider: 0,
              patternDetected: vcp.passesAllFilters ? "VCP" : null,
              patternStage: vcp.passesAllFilters
                ? "Breakout Confirmed"
                : vcp.contractionCount >= 2
                  ? "Near Breakout"
                  : "Consolidation",
              sector,
              marketCapBucket,
              hermesScore: String(hermesScoreVal.toFixed(2)),
              hermesVerdict: verdict,
              weightVersion: version,
              vcpFeatures: vcp,
            })
            .returning();

          // Create outcome tracking row
          await db.insert(hermesOutcomes).values({
            snapshotId: snap.id,
            symbol: sym,
          });

          // Autonomous journaling — every BUY-grade VCP setup gets its own
          // entry/SL/target logged for dedicated SL-hit vs target-hit tracking.
          if (verdict === "BUY" && vcp.passesAllFilters) {
            const trade = computeVcpEntrySLTarget(vcp);
            await logJournalEntry("HERMES", {
              symbol: sym,
              stockName: sym,
              entryPrice: trade.entry,
              stopLoss: trade.stopLoss,
              target: trade.target,
              riskReward: trade.riskRewardRatio,
              vcpScore: hermesScoreVal,
              atrCompression: vcp.atrCompression,
              volumeRatio: vcp.volumeRatio,
              nearHighPct: vcp.nearHighPct,
              aiNotes: `[HERMES] ${describeVcpSetup(vcp)}`,
            });
          }

          inserted++;
        } catch (e) {
          errors++;
        }
      }),
    );

    // Rate limiting delay
    if (i + BATCH_SIZE < universe.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }

    // Progress logging every 50 stocks
    if ((i + BATCH_SIZE) % 50 === 0 || i + BATCH_SIZE >= universe.length) {
      console.log(
        `[HERMES] Progress: ${Math.min(i + BATCH_SIZE, universe.length)}/${universe.length} | Inserted: ${inserted} | Errors: ${errors}`,
      );
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[HERMES] ═══ Scan complete: ${inserted} snapshots in ${duration}s ═══`,
  );

  isScanRunning = false;
  return {
    scanned: universe.length,
    inserted,
    errors,
    duration: `${duration}s`,
  };
}

/* ═══════════════════════════════════════════════════════════
   OUTCOME TRACKER — Fill forward returns
═══════════════════════════════════════════════════════════ */

export async function runOutcomeTracker(): Promise<{
  filled5d: number;
  filled10d: number;
  filled20d: number;
}> {
  console.log("[HERMES] Running outcome tracker...");
  const now = new Date();
  let filled5d = 0,
    filled10d = 0,
    filled20d = 0;

  // 5-day outcomes: snapshots older than 7 calendar days (~5 trading days)
  const fiveDayAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const pending5d = await db
    .select()
    .from(hermesOutcomes)
    .innerJoin(
      hermesSnapshots,
      eq(hermesOutcomes.snapshotId, hermesSnapshots.id),
    )
    .where(
      and(
        isNull(hermesOutcomes.return5d),
        lte(hermesSnapshots.scanDate, fiveDayAgo),
      ),
    )
    .limit(100);

  for (const row of pending5d) {
    try {
      const quote = await getYahooStockQuote(
        `${row.hermes_outcomes.symbol}.NS`,
      );
      if (quote?.price) {
        const entryPrice = Number(row.hermes_snapshots.price);
        const returnPct = ((quote.price - entryPrice) / entryPrice) * 100;
        const outcome =
          returnPct >= WIN_THRESHOLD
            ? "WIN"
            : returnPct <= LOSS_THRESHOLD
              ? "LOSS"
              : "NEUTRAL";

        await db
          .update(hermesOutcomes)
          .set({
            price5d: String(quote.price.toFixed(2)),
            return5d: String(returnPct.toFixed(2)),
            outcome5d: outcome,
            filled5dAt: new Date(),
          })
          .where(eq(hermesOutcomes.id, row.hermes_outcomes.id));
        filled5d++;
      }
    } catch {}
  }

  // 10-day outcomes: snapshots older than 14 calendar days
  const tenDayAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const pending10d = await db
    .select()
    .from(hermesOutcomes)
    .innerJoin(
      hermesSnapshots,
      eq(hermesOutcomes.snapshotId, hermesSnapshots.id),
    )
    .where(
      and(
        isNull(hermesOutcomes.return10d),
        lte(hermesSnapshots.scanDate, tenDayAgo),
      ),
    )
    .limit(100);

  for (const row of pending10d) {
    try {
      const quote = await getYahooStockQuote(
        `${row.hermes_outcomes.symbol}.NS`,
      );
      if (quote?.price) {
        const entryPrice = Number(row.hermes_snapshots.price);
        const returnPct = ((quote.price - entryPrice) / entryPrice) * 100;
        const outcome =
          returnPct >= WIN_THRESHOLD
            ? "WIN"
            : returnPct <= LOSS_THRESHOLD
              ? "LOSS"
              : "NEUTRAL";

        await db
          .update(hermesOutcomes)
          .set({
            price10d: String(quote.price.toFixed(2)),
            return10d: String(returnPct.toFixed(2)),
            outcome10d: outcome,
            filled10dAt: new Date(),
          })
          .where(eq(hermesOutcomes.id, row.hermes_outcomes.id));
        filled10d++;
      }
    } catch {}
  }

  // 20-day outcomes: snapshots older than 28 calendar days
  const twentyDayAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const pending20d = await db
    .select()
    .from(hermesOutcomes)
    .innerJoin(
      hermesSnapshots,
      eq(hermesOutcomes.snapshotId, hermesSnapshots.id),
    )
    .where(
      and(
        isNull(hermesOutcomes.return20d),
        lte(hermesSnapshots.scanDate, twentyDayAgo),
      ),
    )
    .limit(100);

  for (const row of pending20d) {
    try {
      const quote = await getYahooStockQuote(
        `${row.hermes_outcomes.symbol}.NS`,
      );
      if (quote?.price) {
        const entryPrice = Number(row.hermes_snapshots.price);
        const returnPct = ((quote.price - entryPrice) / entryPrice) * 100;
        const outcome =
          returnPct >= WIN_THRESHOLD
            ? "WIN"
            : returnPct <= LOSS_THRESHOLD
              ? "LOSS"
              : "NEUTRAL";

        await db
          .update(hermesOutcomes)
          .set({
            price20d: String(quote.price.toFixed(2)),
            return20d: String(returnPct.toFixed(2)),
            outcome20d: outcome,
            filled20dAt: new Date(),
          })
          .where(eq(hermesOutcomes.id, row.hermes_outcomes.id));
        filled20d++;
      }
    } catch {}
  }

  console.log(
    `[HERMES] Outcomes filled — 5d: ${filled5d}, 10d: ${filled10d}, 20d: ${filled20d}`,
  );
  return { filled5d, filled10d, filled20d };
}

/* ═══════════════════════════════════════════════════════════
   LEARNING ENGINE — Evolve weights from outcomes
═══════════════════════════════════════════════════════════ */

export async function runLearningCycle(): Promise<{
  newVersion: number;
  accuracy: number;
  sampleSize: number;
}> {
  console.log("[HERMES] ═══ Running learning cycle ═══");

  // Get all completed outcomes (at least 5d filled)
  const completedOutcomes = await db
    .select()
    .from(hermesOutcomes)
    .innerJoin(
      hermesSnapshots,
      eq(hermesOutcomes.snapshotId, hermesSnapshots.id),
    )
    .where(sql`${hermesOutcomes.return5d} IS NOT NULL`)
    .limit(5000);

  if (completedOutcomes.length < 30) {
    console.log(
      `[HERMES] Insufficient data (${completedOutcomes.length} outcomes). Need 30+. Skipping learning.`,
    );
    return { newVersion: 0, accuracy: 0, sampleSize: completedOutcomes.length };
  }

  const { weights: currentWeights } = await getActiveWeights();
  const newWeights = { ...currentWeights };

  // For each weight key, compute correlation between that feature's presence and positive outcomes
  const featureWinRates: Record<string, { wins: number; total: number }> = {};

  for (const key of Object.keys(DEFAULT_WEIGHTS)) {
    featureWinRates[key] = { wins: 0, total: 0 };
  }

  for (const row of completedOutcomes) {
    const snap = row.hermes_snapshots;
    const outcome = row.hermes_outcomes;
    const returnVal = Number(outcome.return5d ?? 0);
    const isWin = returnVal >= WIN_THRESHOLD;

    // Evaluate each VCP feature condition from the stored feature blob
    const vf = (snap.vcpFeatures as VcpFeatures | null) ?? null;

    const conditions: Record<string, boolean> = vf
      ? vcpConditions(vf)
      : {
          atr_compression: false,
          progressive_contraction: false,
          tight_coil: false,
          volume_dryup: false,
          near_52w_high: false,
          ema_stack_full: false,
          ema50_rising: false,
          range_quality: false,
          rs_score: false,
          liquidity_turnover: false,
        };

    for (const [key, conditionMet] of Object.entries(conditions)) {
      if (conditionMet) {
        featureWinRates[key].total++;
        if (isWin) featureWinRates[key].wins++;
      }
    }
  }

  // Compute new weights: EMA blend (70% old, 30% new evidence)
  const BLEND_OLD = 0.7;
  const BLEND_NEW = 0.3;
  const changeLog: string[] = [];

  for (const [key, stats] of Object.entries(featureWinRates)) {
    if (stats.total < 10) continue; // Not enough data for this feature

    const winRate = stats.wins / stats.total;
    // Target weight: proportional to win rate (normalized)
    const targetWeight = winRate * (DEFAULT_WEIGHTS[key] || 0.05) * 2; // Scale factor
    const oldWeight = currentWeights[key] || DEFAULT_WEIGHTS[key] || 0.05;
    const blended = BLEND_OLD * oldWeight + BLEND_NEW * targetWeight;

    // Clamp weights to [0.01, 0.20]
    newWeights[key] = Math.max(0.01, Math.min(0.2, blended));

    const delta = (((newWeights[key] - oldWeight) / oldWeight) * 100).toFixed(
      1,
    );
    if (Math.abs(Number(delta)) > 5) {
      changeLog.push(
        `${key}: ${(winRate * 100).toFixed(0)}% win rate → weight ${delta}%`,
      );
    }
  }

  // Normalize weights to sum to 1.0
  const totalWeight = Object.values(newWeights).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(newWeights)) {
    newWeights[key] = newWeights[key] / totalWeight;
  }

  // Compute overall accuracy
  let totalWins = 0;
  for (const row of completedOutcomes) {
    if (Number(row.hermes_outcomes.return5d ?? 0) >= WIN_THRESHOLD) totalWins++;
  }
  const accuracy = (totalWins / completedOutcomes.length) * 100;

  // Get next version
  const [latest] = await db
    .select({ maxVer: sql<number>`COALESCE(MAX(${hermesWeights.version}), 0)` })
    .from(hermesWeights);
  const newVersion = (latest?.maxVer ?? 0) + 1;

  // Deactivate all previous
  await db.update(hermesWeights).set({ isActive: false });

  // Insert new weight set
  await db.insert(hermesWeights).values({
    version: newVersion,
    weights: newWeights,
    accuracy: String(accuracy.toFixed(2)),
    sampleSize: completedOutcomes.length,
    winRate5d: String(accuracy.toFixed(2)),
    notes:
      changeLog.length > 0
        ? `Learning cycle v${newVersion}: ${changeLog.join("; ")}`
        : `Learning cycle v${newVersion}: Minor adjustments, ${completedOutcomes.length} samples`,
    isActive: true,
  });

  // Clear weight cache
  activeWeightsCache = null;

  console.log(
    `[HERMES] ═══ Learning complete: v${newVersion}, accuracy: ${accuracy.toFixed(1)}%, samples: ${completedOutcomes.length} ═══`,
  );
  return { newVersion, accuracy, sampleSize: completedOutcomes.length };
}

/* ═══════════════════════════════════════════════════════════
   REGIME CLASSIFIER — Classify current market conditions
═══════════════════════════════════════════════════════════ */

export async function classifyMarketRegime(): Promise<HermesRegimeLog | null> {
  console.log("[HERMES] Classifying market regime...");

  try {
    const niftyCandles = await getYahooHistory("^NSEI", "3mo", "1d");
    if (!niftyCandles || niftyCandles.length < 22) return null;

    const closes = niftyCandles
      .map((c: any) => Number(c.close))
      .filter((v: number) => isFinite(v));
    const n = closes.length;
    const current = closes[n - 1];

    // Nifty returns
    const change1w =
      n > 5 ? ((current - closes[n - 6]) / closes[n - 6]) * 100 : 0;
    const change1m =
      n > 22 ? ((current - closes[n - 23]) / closes[n - 23]) * 100 : 0;

    // Simple regime classification
    let regime: string;
    if (change1m > 3 && change1w > 0.5) {
      regime = "TRENDING_UP";
    } else if (change1m < -3 && change1w < -0.5) {
      regime = "TRENDING_DOWN";
    } else if (Math.abs(change1m) > 5 && Math.abs(change1w) > 2) {
      regime = "VOLATILE";
    } else {
      regime = "RANGING";
    }

    // Market breadth proxy: count advancing vs declining recent changes
    const breadthRatio = change1w > 0 ? 1.2 : change1w < -1 ? 0.7 : 1.0;
    const marketBreadth =
      breadthRatio > 1.1 ? "STRONG" : breadthRatio < 0.8 ? "WEAK" : "NEUTRAL";

    const [entry] = await db
      .insert(hermesRegimeLog)
      .values({
        regime,
        niftyPrice: String(current.toFixed(2)),
        niftyChange1w: String(change1w.toFixed(2)),
        niftyChange1m: String(change1m.toFixed(2)),
        advanceDeclineRatio: String(breadthRatio.toFixed(2)),
        marketBreadth,
      })
      .returning();

    console.log(
      `[HERMES] Regime: ${regime} | Nifty: ${current.toFixed(0)} | 1w: ${change1w.toFixed(1)}% | 1m: ${change1m.toFixed(1)}%`,
    );
    return entry;
  } catch (e) {
    console.error("[HERMES] Regime classification failed:", e);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════
   QUERY FUNCTIONS — For API endpoints
═══════════════════════════════════════════════════════════ */

export async function getHermesLeaderboard(
  limit = 30,
): Promise<HermesSnapshot[]> {
  // Get the latest scan date
  const [latest] = await db
    .select({ maxDate: sql<Date>`MAX(${hermesSnapshots.scanDate})` })
    .from(hermesSnapshots);

  if (!latest?.maxDate) return [];

  // Get top stocks from the latest scan
  const results = await db
    .select()
    .from(hermesSnapshots)
    .where(eq(hermesSnapshots.scanDate, latest.maxDate))
    .orderBy(desc(hermesSnapshots.hermesScore))
    .limit(limit);

  return results;
}

export async function getHermesStockSnapshot(
  symbol: string,
): Promise<HermesSnapshot | null> {
  const [snap] = await db
    .select()
    .from(hermesSnapshots)
    .where(eq(hermesSnapshots.symbol, symbol.toUpperCase()))
    .orderBy(desc(hermesSnapshots.scanDate))
    .limit(1);

  return snap ?? null;
}

export async function getHermesAccuracy(): Promise<{
  overall: {
    wins: number;
    losses: number;
    neutral: number;
    total: number;
    winRate: number;
  };
  bySector: Record<string, { wins: number; total: number; winRate: number }>;
  byRegime: Record<string, { wins: number; total: number; winRate: number }>;
  byVerdict: Record<string, { wins: number; total: number; winRate: number }>;
}> {
  const outcomes = await db
    .select()
    .from(hermesOutcomes)
    .innerJoin(
      hermesSnapshots,
      eq(hermesOutcomes.snapshotId, hermesSnapshots.id),
    )
    .where(sql`${hermesOutcomes.return5d} IS NOT NULL`)
    .limit(5000);

  const overall = {
    wins: 0,
    losses: 0,
    neutral: 0,
    total: outcomes.length,
    winRate: 0,
  };
  const bySector: Record<
    string,
    { wins: number; total: number; winRate: number }
  > = {};
  const byVerdict: Record<
    string,
    { wins: number; total: number; winRate: number }
  > = {};

  for (const row of outcomes) {
    const returnVal = Number(row.hermes_outcomes.return5d ?? 0);
    const isWin = returnVal >= WIN_THRESHOLD;
    const isLoss = returnVal <= LOSS_THRESHOLD;

    if (isWin) overall.wins++;
    else if (isLoss) overall.losses++;
    else overall.neutral++;

    // By sector
    const sector = row.hermes_snapshots.sector || "Other";
    if (!bySector[sector]) bySector[sector] = { wins: 0, total: 0, winRate: 0 };
    bySector[sector].total++;
    if (isWin) bySector[sector].wins++;

    // By verdict
    const verdict = row.hermes_snapshots.hermesVerdict || "UNKNOWN";
    if (!byVerdict[verdict])
      byVerdict[verdict] = { wins: 0, total: 0, winRate: 0 };
    byVerdict[verdict].total++;
    if (isWin) byVerdict[verdict].wins++;
  }

  overall.winRate =
    overall.total > 0 ? (overall.wins / overall.total) * 100 : 0;

  for (const s of Object.keys(bySector)) {
    bySector[s].winRate =
      bySector[s].total > 0 ? (bySector[s].wins / bySector[s].total) * 100 : 0;
  }
  for (const v of Object.keys(byVerdict)) {
    byVerdict[v].winRate =
      byVerdict[v].total > 0
        ? (byVerdict[v].wins / byVerdict[v].total) * 100
        : 0;
  }

  return { overall, bySector, byRegime: {}, byVerdict };
}

export async function getHermesWeightHistory(): Promise<HermesWeight[]> {
  return db
    .select()
    .from(hermesWeights)
    .orderBy(desc(hermesWeights.version))
    .limit(20);
}

export async function getHermesRegimeHistory(
  limit = 30,
): Promise<HermesRegimeLog[]> {
  return db
    .select()
    .from(hermesRegimeLog)
    .orderBy(desc(hermesRegimeLog.date))
    .limit(limit);
}

export async function getHermesRecentOutcomes(limit = 50): Promise<
  Array<{
    snapshot: HermesSnapshot;
    outcome: HermesOutcome;
  }>
> {
  const rows = await db
    .select()
    .from(hermesOutcomes)
    .innerJoin(
      hermesSnapshots,
      eq(hermesOutcomes.snapshotId, hermesSnapshots.id),
    )
    .where(sql`${hermesOutcomes.return5d} IS NOT NULL`)
    .orderBy(desc(hermesOutcomes.filled5dAt))
    .limit(limit);

  return rows.map((r) => ({
    snapshot: r.hermes_snapshots,
    outcome: r.hermes_outcomes,
  }));
}

export async function getHermesDashboard() {
  // Ensure any stale (pre-VCP-rebuild) weight row gets reseeded before we read history.
  await getActiveWeights();

  const [leaderboard, accuracy, weights, regime, recentOutcomes] =
    await Promise.allSettled([
      getHermesLeaderboard(20),
      getHermesAccuracy(),
      getHermesWeightHistory(),
      getHermesRegimeHistory(7),
      getHermesRecentOutcomes(20),
    ]);

  // Count total snapshots
  const [snapCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(hermesSnapshots);

  const activeWeight =
    weights.status === "fulfilled"
      ? (weights.value.find((w) => w.isActive) ?? null)
      : null;

  return {
    leaderboard: leaderboard.status === "fulfilled" ? leaderboard.value : [],
    accuracy: accuracy.status === "fulfilled" ? accuracy.value : null,
    activeWeight,
    weightHistory: weights.status === "fulfilled" ? weights.value : [],
    regime: regime.status === "fulfilled" ? regime.value : [],
    recentOutcomes:
      recentOutcomes.status === "fulfilled" ? recentOutcomes.value : [],
    totalSnapshots: snapCount?.count ?? 0,
    isScanRunning,
  };
}

/* ═══════════════════════════════════════════════════════════
   INITIALIZATION — Ensure default weights exist
═══════════════════════════════════════════════════════════ */

export async function initializeHermes(): Promise<void> {
  console.log("[HERMES] Initializing...");

  try {
    const existing = await db.select().from(hermesWeights).limit(1);
    if (existing.length === 0) {
      console.log("[HERMES] No weights found. Inserting default v1 weights...");
      await db.insert(hermesWeights).values({
        version: 1,
        weights: DEFAULT_WEIGHTS,
        accuracy: "0",
        sampleSize: 0,
        notes: "Initial default weights — pre-learning baseline",
        isActive: true,
      });
      console.log("[HERMES] Default weights v1 inserted.");
    }
  } catch (e) {
    console.error(
      "[HERMES] Initialization error (tables may not exist yet, run db:push):",
      e,
    );
  }
}
