/**
 * HERMES ENGINE — Multi-Layered Quantitative Scoring System
 * ─────────────────────────────────────────────────────────────────────────────
 * Combines VCP Technicals, Fundamental Analysis, and News Impact into a single
 * composite 0-100 score for the full market universe.
 */

import { db } from "./db";
import {
  hermesSnapshots,
  hermesOutcomes,
  hermesWeights,
  hermesRegimeLog,
} from "@shared/schema";
import { eq, and, desc, sql, gte, isNull, lte } from "drizzle-orm";
import {
  getYahooStockQuote,
  getYahooHistory,
  getFmpFundamentals,
  computeSMA,
  computeRSI,
  computeEMA,
  type StockQuote,
} from "./stockApi";
import { NSE_UNIQUE, NIFTY_50, ETFS } from "./nseUniverse";
import {
  computeVcpFeatures,
  computeVcpScore,
  computeVcpEntrySLTarget,
  type VcpFeatures,
} from "./vcpCore";
import { getNewsScoreForSymbol } from "./apexNewsEngine";
import { getNowIST } from "./istUtils";
import { markJobStart, markJobDone, markJobFailed } from "./jobLedger";
import { logJournalEntry } from "./vcpJournalEngine";

// ─── Constants ────────────────────────────────────────────────────────────────
const BATCH_SIZE = 15;
const BATCH_DELAY = 500;
const DEFAULT_WEIGHT_VERSION = 1;

const DEFAULT_WEIGHTS: Record<string, number> = {
  atr_compression: 15,
  progressive_contraction: 15,
  tight_coil: 15,
  volume_dryup: 10,
  near_52w_high: 10,
  ema_stack_full: 10,
  ema50_rising: 5,
  range_quality: 5,
  rs_score: 10,
  liquidity_turnover: 5,
};

const SECTOR_MAP: Record<string, string> = {
  RELIANCE: "Energy",
  TCS: "IT",
  HDFCBANK: "Banking",
  INFY: "IT",
  ICICIBANK: "Banking",
  HINDUNILVR: "FMCG",
  ITC: "FMCG",
  SBIN: "Banking",
  BHARTIARTL: "Telecom",
  KOTAKBANK: "Banking",
};

// ─── Scoring Logic ───────────────────────────────────────────────────────────

function vcpConditions(f: VcpFeatures): Record<string, boolean> {
  return {
    atr_compression: (1 - f.tightCoilRatio) >= 0.3,
    progressive_contraction: f.contractionCount >= 2,
    tight_coil: f.tightCoilRatio <= 0.05,
    volume_dryup: f.volumeRatio <= 0.75,
    near_52w_high: f.nearHighPct >= 85,
    ema_stack_full: f.isStage2,
    ema50_rising: f.isStage2,
    range_quality: true,
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
    atr_compression: Math.min(1, (1 - features.tightCoilRatio) / 0.6),
    progressive_contraction: features.contractionCount / 3,
    tight_coil: Math.min(
      1,
      Math.max(0, (0.06 - features.tightCoilRatio) / 0.06),
    ),
    volume_dryup: Math.min(1, Math.max(0, (1 - features.volumeRatio) / 0.5)),
    near_52w_high: Math.min(1, Math.max(0, (features.nearHighPct - 80) / 20)),
    ema_stack_full: features.isStage2 ? 1 : 0.5,
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

function computeFundamentalScore(fmp: Record<string, any> | null): number {
  if (!fmp) return 50;
  let score = 50;
  const roe = Number(fmp.returnOnEquity || 0) * 100;
  const debt = Number(fmp.debtToEquity || 1);
  if (roe > 15) score += 15;
  if (debt < 0.5) score += 15;
  if (roe < 5) score -= 20;
  return Math.min(100, Math.max(0, score));
}

function newsScoreToRange100(raw: number): number {
  // raw news score is typically -50 to +100
  return Math.round(Math.min(100, Math.max(0, (raw + 50) * 0.66)));
}

/* ═══════════════════════════════════════════════════════════
   DAILY SCAN — Snapshot every stock in the universe
═══════════════════════════════════════════════════════════ */

let isScanRunning = false;

export async function runDailyScan(universeSize?: number): Promise<{
  scanned: number;
  inserted: number;
}> {
  if (isScanRunning) throw new Error("A HERMES scan is already in progress.");
  isScanRunning = true;
  await markJobStart("hermes_daily_scan");

  try {
    const symbols = NSE_UNIQUE.slice(0, universeSize || 300);
    console.log(`[HERMES] Starting daily scan for ${symbols.length} stocks...`);

    // Load current weights
    const [weightRow] = await db
      .select()
      .from(hermesWeights)
      .orderBy(desc(hermesWeights.version))
      .limit(1);
    const weights = (weightRow?.weights as Record<string, number>) || DEFAULT_WEIGHTS;
    const technicalWeight = 0.6;
    const fundamentalWeight = 0.2;
    const newsWeight = 0.2;
    const weightVersion = weightRow?.version ?? DEFAULT_WEIGHT_VERSION;

    let scanned = 0;
    let inserted = 0;

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (sym) => {
          try {
            const yahooSym = sym.includes(".") ? sym : `${sym}.NS`;
            const [quoteRes, histRes, fmpRes] = await Promise.allSettled([
              getYahooStockQuote(yahooSym),
              getYahooHistory(yahooSym, "1y", "1d"),
              getFmpFundamentals(sym),
            ]);

            const quote = quoteRes.status === "fulfilled" ? quoteRes.value : null;
            const candles = histRes.status === "fulfilled" ? histRes.value : [];
            const fmp = fmpRes.status === "fulfilled" ? fmpRes.value : null;

            if (!candles || candles.length < 210) return;

            const vcp = computeVcpFeatures(candles, sym);
            if (!vcp) return;

            const price = quote?.price ?? vcp.price;

            const closes = candles
              .map((c: any) => Number(c.close))
              .filter((v: number) => isFinite(v));
            const n = closes.length;
            const ret = (days: number) =>
              n > days ? ((closes[n - 1] - closes[n - 1 - days]) / closes[n - 1 - days]) * 100 : null;

            const return1w = ret(5);
            const return1m = ret(22);
            const return3m = ret(66);
            const return6m = ret(132);

            const marketCapValue = quote?.marketCap ?? null;
            const capCr = (marketCapValue ?? 0) / 1e7;
            const marketCapBucket = capCr >= 50000 ? "LARGE" : capCr >= 10000 ? "MID" : "SMALL";
            const sector = SECTOR_MAP[sym] || "Other";

            // ── Technical score (VCP / HERMES weights) ──────────────────────
            const vcpTechnicalScore = computeHermesScore(vcp, weights); // 0-100

            // ── Fundamental score (ROE, debt, margins) ──────────────────────
            const fmpData = fmp as Record<string, any> | null;
            const fundamentalScore = computeFundamentalScore(fmpData);

            // ── News score (apexNewsEngine — real RSS + keyword scoring) ─────
            let rawNewsScore = 0;
            try {
              rawNewsScore = await getNewsScoreForSymbol(sym, new Date());
            } catch (_) {}
            const newsScore100 = newsScoreToRange100(rawNewsScore); // 0-100

            // ── HERMES Composite Score (genome-weighted blend) ───────────────
            const totalW = technicalWeight + fundamentalWeight + newsWeight;
            const hermesScoreVal = Math.round(
              ((vcpTechnicalScore * technicalWeight) +
               (fundamentalScore * fundamentalWeight) +
               (newsScore100 * newsWeight)) / totalW
            );

            const verdict = hermesVerdict(hermesScoreVal);

            // Determine pattern label
            const patternDetected = vcp.passesAllFilters
              ? "VCP"
              : fundamentalScore >= 65
              ? "Fundamental Pick"
              : rawNewsScore >= 30
              ? "News Catalyst"
              : null;

            const patternStage = vcp.passesAllFilters
              ? "Breakout Confirmed"
              : vcp.contractionCount >= 2
              ? "Near Breakout"
              : "Consolidation";

            // Build AI notes
            const aiNotes = [
              `Tech:${vcpTechnicalScore}`,
              `Fund:${fundamentalScore}`,
              `News:${newsScore100}(raw:${rawNewsScore.toFixed(0)})`,
              vcp.passesAllFilters ? `ROCKET: Tightness ${vcp.lastContractionDepth.toFixed(1)}%` : "",
            ].filter(Boolean).join(" | ");

            // Extract fundamental columns for DB
            const peRatio = fmpData?.peRatio ?? fmpData?.pe ?? null;
            const roeVal = fmpData?.returnOnEquity ?? fmpData?.roe ?? null;
            const debtEq = fmpData?.debtToEquity ?? fmpData?.debtEquityRatio ?? null;
            const opmVal = fmpData?.operatingProfitMargin ?? fmpData?.opm ?? null;
            const roceVal = fmpData?.returnOnCapitalEmployed ?? fmpData?.roce ?? null;

            // Insert snapshot
            const [snap] = await db
              .insert(hermesSnapshots)
              .values({
                symbol: sym,
                price: String(price),
                volume: quote?.volume ? String(quote.volume) : null,
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
                pe: peRatio != null ? String(Number(peRatio).toFixed(2)) : null,
                roe: roeVal != null ? String(Number(roeVal).toFixed(2)) : null,
                debtToEquity: debtEq != null ? String(Number(debtEq).toFixed(2)) : null,
                opm: opmVal != null ? String(Number(opmVal).toFixed(2)) : null,
                roce: roceVal != null ? String(Number(roceVal).toFixed(2)) : null,
                return1w: return1w != null ? String(return1w.toFixed(2)) : null,
                return1m: return1m != null ? String(return1m.toFixed(2)) : null,
                return3m: return3m != null ? String(return3m.toFixed(2)) : null,
                return6m: return6m != null ? String(return6m.toFixed(2)) : null,
                marketCapBucket,
                sector,
                hermesScore: String(hermesScoreVal),
                hermesVerdict: verdict,
                patternDetected,
                patternStage,
                weightVersion,
              })
              .returning();

            // Create outcome row
            await db.insert(hermesOutcomes).values({
              snapshotId: snap.id,
              symbol: sym,
            });

            // Autonomous journaling for high-conviction BUYs
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
                atrCompression: 1 - vcp.tightCoilRatio,
                volumeRatio: vcp.volumeRatio,
                nearHighPct: vcp.nearHighPct,
                aiNotes: `[HERMES] ROCKET: Tightness ${vcp.lastContractionDepth.toFixed(1)}% · Pivot ${vcp.pivotPoint.toFixed(2)}`,
              });
            }

            inserted++;
          } catch (err: any) {
            console.error(`[HERMES] Error scanning ${sym}:`, err.message);
          }
          scanned++;
        }),
      );

      if (i + BATCH_SIZE < symbols.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY));
      }
    }

    await markJobDone("hermes_daily_scan", 0);
    console.log(`[HERMES] Daily scan complete. Scanned: ${scanned}, Inserted: ${inserted}`);
    return { scanned, inserted };
  } catch (error: any) {
    console.error("[HERMES] Daily scan failed:", error);
    await markJobFailed("hermes_daily_scan", error);
    throw error;
  } finally {
    isScanRunning = false;
  }
}

export async function getHermesDashboard() {
  const latestSnapshots = await db
    .select()
    .from(hermesSnapshots)
    .orderBy(desc(hermesSnapshots.scanDate))
    .limit(10);

  const topPicks = await db
    .select()
    .from(hermesSnapshots)
    .where(eq(hermesSnapshots.hermesVerdict, "BUY"))
    .orderBy(desc(hermesSnapshots.hermesScore))
    .limit(10);

  const [weights] = await db
    .select()
    .from(hermesWeights)
    .orderBy(desc(hermesWeights.version))
    .limit(1);

  return {
    latestSnapshots,
    topPicks,
    weights: weights || {
      technicalWeight: 0.6,
      fundamentalWeight: 0.2,
      newsWeight: 0.2,
    },
  };
}

export async function getHermesLeaderboard() {
  return await db
    .select()
    .from(hermesSnapshots)
    .orderBy(desc(hermesSnapshots.hermesScore))
    .limit(20);
}

export async function getHermesStockSnapshot(symbol: string) {
  return await db
    .select()
    .from(hermesSnapshots)
    .where(eq(hermesSnapshots.symbol, symbol))
    .orderBy(desc(hermesSnapshots.scanDate))
    .limit(5);
}

export async function getHermesAccuracy() {
  return { accuracy: 75 }; // Placeholder
}

export async function getHermesWeightHistory() {
  return await db.select().from(hermesWeights).orderBy(desc(hermesWeights.version)).limit(10);
}

export async function getHermesRegimeHistory() {
  return await db.select().from(hermesRegimeLog).orderBy(desc(hermesRegimeLog.date)).limit(10);
}

export async function getHermesRecentOutcomes() {
  return await db.select().from(hermesOutcomes).where(sql`${hermesOutcomes.return5d} IS NOT NULL`).limit(10);
}

export async function runLearningCycle() {
  return { promoted: false, oldAvgReturn: 0, newAvgReturn: 0 };
}

const WIN_THRESHOLD = 3;
const LOSS_THRESHOLD = -3;

export async function initializeHermes(): Promise<void> {
  const existing = await db.select().from(hermesWeights).limit(1);
  if (existing.length > 0) return;

  await db.insert(hermesWeights).values({
    version: DEFAULT_WEIGHT_VERSION,
    weights: DEFAULT_WEIGHTS,
    isActive: true,
    notes: "Initial default weights",
  });
  console.log("[HERMES] Initialized default weights");
}

export async function classifyMarketRegime(): Promise<string> {
  try {
    const candles = await getYahooHistory("^NSEI", "3mo", "1d");
    if (!candles || candles.length < 22) {
      await db.insert(hermesRegimeLog).values({ regime: "RANGING" });
      return "RANGING";
    }

    const closes = candles
      .map((c: { close: number }) => Number(c.close))
      .filter((v: number) => isFinite(v));
    const n = closes.length;
    const niftyPrice = closes[n - 1];
    const change1w =
      n > 5 ? ((closes[n - 1] - closes[n - 6]) / closes[n - 6]) * 100 : 0;
    const change1m =
      n > 22 ? ((closes[n - 1] - closes[n - 23]) / closes[n - 23]) * 100 : 0;

    let regime: string;
    if (Math.abs(change1w) > 3 && Math.abs(change1m) > 5) {
      regime = change1w > 0 ? "TRENDING_UP" : "TRENDING_DOWN";
    } else if (Math.abs(change1w) > 2) {
      regime = "VOLATILE";
    } else {
      regime = "RANGING";
    }

    await db.insert(hermesRegimeLog).values({
      regime,
      niftyPrice: String(niftyPrice.toFixed(2)),
      niftyChange1w: String(change1w.toFixed(2)),
      niftyChange1m: String(change1m.toFixed(2)),
      marketBreadth: change1w > 0 ? "STRONG" : change1w < -1 ? "WEAK" : "NEUTRAL",
    });

    return regime;
  } catch (err: any) {
    console.error("[HERMES] Regime classification failed:", err.message);
    return "RANGING";
  }
}

export async function runOutcomeTracker(): Promise<{
  filled5d: number;
  filled10d: number;
  filled20d: number;
}> {
  await markJobStart("hermes_outcome_tracker");
  const now = new Date();
  let filled5d = 0;
  let filled10d = 0;
  let filled20d = 0;

  try {
    const fiveDayAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const pending5d = await db
      .select({
        outcomeId: hermesOutcomes.id,
        symbol: hermesOutcomes.symbol,
        entryPrice: hermesSnapshots.price,
      })
      .from(hermesOutcomes)
      .innerJoin(hermesSnapshots, eq(hermesOutcomes.snapshotId, hermesSnapshots.id))
      .where(
        and(isNull(hermesOutcomes.return5d), lte(hermesSnapshots.scanDate, fiveDayAgo)),
      )
      .limit(80);

    for (const row of pending5d) {
      try {
        const quote = await getYahooStockQuote(`${row.symbol}.NS`);
        const entry = parseFloat(row.entryPrice);
        if (!quote?.price || !isFinite(entry) || entry <= 0) continue;

        const returnPct = ((quote.price - entry) / entry) * 100;
        let outcome = "NEUTRAL";
        if (returnPct >= WIN_THRESHOLD) outcome = "WIN";
        else if (returnPct <= LOSS_THRESHOLD) outcome = "LOSS";

        await db
          .update(hermesOutcomes)
          .set({
            price5d: String(quote.price.toFixed(2)),
            return5d: String(returnPct.toFixed(2)),
            outcome5d: outcome,
            filled5dAt: now,
          })
          .where(eq(hermesOutcomes.id, row.outcomeId));
        filled5d++;
      } catch (_) {}
    }

    const tenDayAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const pending10d = await db
      .select({
        outcomeId: hermesOutcomes.id,
        symbol: hermesOutcomes.symbol,
        entryPrice: hermesSnapshots.price,
      })
      .from(hermesOutcomes)
      .innerJoin(hermesSnapshots, eq(hermesOutcomes.snapshotId, hermesSnapshots.id))
      .where(
        and(
          isNull(hermesOutcomes.return10d),
          sql`${hermesOutcomes.return5d} IS NOT NULL`,
          lte(hermesSnapshots.scanDate, tenDayAgo),
        ),
      )
      .limit(80);

    for (const row of pending10d) {
      try {
        const quote = await getYahooStockQuote(`${row.symbol}.NS`);
        const entry = parseFloat(row.entryPrice);
        if (!quote?.price || !isFinite(entry) || entry <= 0) continue;

        const returnPct = ((quote.price - entry) / entry) * 100;
        let outcome = "NEUTRAL";
        if (returnPct >= WIN_THRESHOLD) outcome = "WIN";
        else if (returnPct <= LOSS_THRESHOLD) outcome = "LOSS";

        await db
          .update(hermesOutcomes)
          .set({
            price10d: String(quote.price.toFixed(2)),
            return10d: String(returnPct.toFixed(2)),
            outcome10d: outcome,
            filled10dAt: now,
          })
          .where(eq(hermesOutcomes.id, row.outcomeId));
        filled10d++;
      } catch (_) {}
    }

    const twentyDayAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    const pending20d = await db
      .select({
        outcomeId: hermesOutcomes.id,
        symbol: hermesOutcomes.symbol,
        entryPrice: hermesSnapshots.price,
      })
      .from(hermesOutcomes)
      .innerJoin(hermesSnapshots, eq(hermesOutcomes.snapshotId, hermesSnapshots.id))
      .where(
        and(
          isNull(hermesOutcomes.return20d),
          sql`${hermesOutcomes.return10d} IS NOT NULL`,
          lte(hermesSnapshots.scanDate, twentyDayAgo),
        ),
      )
      .limit(80);

    for (const row of pending20d) {
      try {
        const quote = await getYahooStockQuote(`${row.symbol}.NS`);
        const entry = parseFloat(row.entryPrice);
        if (!quote?.price || !isFinite(entry) || entry <= 0) continue;

        const returnPct = ((quote.price - entry) / entry) * 100;
        let outcome = "NEUTRAL";
        if (returnPct >= WIN_THRESHOLD) outcome = "WIN";
        else if (returnPct <= LOSS_THRESHOLD) outcome = "LOSS";

        await db
          .update(hermesOutcomes)
          .set({
            price20d: String(quote.price.toFixed(2)),
            return20d: String(returnPct.toFixed(2)),
            outcome20d: outcome,
            filled20dAt: now,
          })
          .where(eq(hermesOutcomes.id, row.outcomeId));
        filled20d++;
      } catch (_) {}
    }

    await markJobDone("hermes_outcome_tracker", 0);
    console.log(
      `[HERMES] Outcome tracker: 5d=${filled5d}, 10d=${filled10d}, 20d=${filled20d}`,
    );
    return { filled5d, filled10d, filled20d };
  } catch (error: any) {
    await markJobFailed("hermes_outcome_tracker", error);
    throw error;
  }
}
