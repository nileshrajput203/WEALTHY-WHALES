/**
 * SWING GENOME ENGINE — Self-Improving Swing Scanner
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps the existing runSwingScanner() with:
 *  1. Genome-controlled filter parameters (vs hardcoded thresholds)
 *  2. News + fundamental scoring integration
 *  3. Outcome tracking (5d/10d/20d forward returns)
 *  4. Learning cycle with genome evolution toward 5-10% avg returns
 *
 * Uses the selfImprovingCore genome system with engine ID "SWING".
 */

import { db } from "./db";
import { swingOutcomes } from "@shared/schema";
import { and, eq, gte, isNull, lte, sql, desc } from "drizzle-orm";
import { getGenome, runGenomeEvolution, type TradeOutcome } from "./selfImprovingCore";
import {
  getYahooStockQuote,
  getYahooHistory,
  getFmpFundamentals,
  computeSMA,
  computeRSI,
  computeEMA,
  type SwingScanResult,
} from "./stockApi";
import { NSE_UNIQUE, NIFTY_50, ETFS } from "./nseUniverse";
import { computeVcpFeatures, computeVcpScore, computeVcpEntrySLTarget } from "./vcpCore";
import { batchAnalyzeNewsImpact } from "./newsImpactScorer";
import { getNewsScoreForSymbol } from "./apexNewsEngine";
import { getNowIST } from "./istUtils";
import { markJobStart, markJobDone, markJobFailed } from "./jobLedger";

// ─── Constants ────────────────────────────────────────────────────────────────
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 500;
const DEFAULT_WIN_THRESHOLD = 5.0;
const DEFAULT_LOSS_THRESHOLD = -4.0;

/**
 * Genome-evolved Swing Scanner.
 * Uses genome parameters instead of hardcoded filter thresholds.
 */
export async function runSwingScannerEvolved(): Promise<{
  results: SwingScanResult[];
  genomeVersion: number;
  scanned: number;
  passed: number;
}> {
  console.log("[SwingGenome] ═══ Starting genome-aware swing scan ═══");
  const startTime = Date.now();
  await markJobStart("swing_evolved_scan");

  try {
    // Load current genome
    const genome = await getGenome("SWING");
    const gp = genome.params;
    const minGradeScore = Math.round(gp.min_grade_score ?? 65);
    const atrTightnessMax = gp.atr_tightness_max ?? 0.06;
    const volumeDryupMax = gp.volume_dryup_max ?? 0.85;
    const nearHighPctMax = gp.near_high_pct_max ?? 0.15;
    const slPctMax = gp.sl_pct_max ?? 0.06;
    const riskReward = gp.risk_reward ?? 2.5;
    const maxHoldDays = Math.round(gp.max_hold_days ?? 10);

    console.log(`[SwingGenome] Genome v${genome.version}: minScore=${minGradeScore} atrMax=${atrTightnessMax} volMax=${volumeDryupMax} nearHigh=${nearHighPctMax} slMax=${slPctMax} rr=${riskReward} hold=${maxHoldDays}d`);

    // Build scan universe (exclude Nifty 50 and ETFs)
    const baseList = NSE_UNIQUE.filter(sym => {
      const clean = sym.replace('.NS', '').replace('.BO', '');
      return !NIFTY_50.has(clean) && !ETFS.has(clean);
    });

    const scanList = baseList.slice(0, 300).map(sym => sym.includes('.') ? sym : `${sym}.NS`);
    console.log(`[SwingGenome] Scanning ${scanList.length} stocks...`);

    const results: SwingScanResult[] = [];
    let scanned = 0;

    for (let b = 0; b < scanList.length; b += BATCH_SIZE) {
      const batch = scanList.slice(b, b + BATCH_SIZE);

      await Promise.allSettled(batch.map(async (yahooSym) => {
        try {
          const candles = await getYahooHistory(yahooSym, "1y", "1d");
          if (!candles || candles.length < 60) return;

          const vcp = computeVcpFeatures(candles);
          if (!vcp) return;

          const quote = await getYahooStockQuote(yahooSym);
          const price = quote?.price ?? vcp.price;

          // ── Genome-controlled filters ──────────────────────────────
          const tightCoilRatio = vcp.tightCoilRatio ?? (vcp.atr14 / price);
          if (tightCoilRatio > atrTightnessMax) return; // ATR too wide

          if (vcp.volumeRatio > volumeDryupMax) return; // Volume not dry enough

          const distFromHigh = 1 - (vcp.nearHighPct / 100);
          if (distFromHigh > nearHighPctMax) return; // Too far from 52w high

          // Compute VCP score
          const vcpScore = computeVcpScore(vcp);
          if (vcpScore < minGradeScore) return; // Below genome threshold

          // Entry/SL/Target
          const trade = computeVcpEntrySLTarget(vcp);
          const slPct = Math.abs(trade.entry - trade.stopLoss) / trade.entry;
          if (slPct > slPctMax) return; // SL too wide

          // Get news score for this stock
          let newsScore = 0;
          try {
            const cleanSym = yahooSym.replace('.NS', '').replace('.BO', '');
            newsScore = await getNewsScoreForSymbol(cleanSym);
          } catch (_) {}

          // Get fundamental score
          let fundamentalScore = 50;
          try {
            const cleanSym = yahooSym.replace('.NS', '').replace('.BO', '');
            const fmp = await getFmpFundamentals(cleanSym);
            if (fmp) {
              const roe = Number((fmp as any).returnOnEquity ?? 0) * 100;
              const debt = Number((fmp as any).debtToEquity ?? 100);
              fundamentalScore = 50;
              if (roe >= 15) fundamentalScore += 15;
              else if (roe >= 10) fundamentalScore += 8;
              if (debt < 0.5) fundamentalScore += 10;
              else if (debt > 2.0) fundamentalScore -= 10;
              fundamentalScore = Math.max(0, Math.min(100, fundamentalScore));
            }
          } catch (_) {}

          // Composite score (genome-weighted)
          const newsWeight = gp.news_weight ?? 0.15;
          const fundamentalWeight = gp.fundamental_weight ?? 0.20;
          const technicalWeight = gp.technical_weight ?? 0.65;
          const totalW = newsWeight + fundamentalWeight + technicalWeight;
          const newsScore100 = Math.max(0, Math.min(100, 50 + newsScore / 2));
          const compositeScore = Math.round(
            (vcpScore * technicalWeight +
             fundamentalScore * fundamentalWeight +
             newsScore100 * newsWeight) / totalW
          );

          const cleanSym = yahooSym.replace('.NS', '').replace('.BO', '');

          results.push({
            symbol: cleanSym,
            name: cleanSym,
            price: price,
            change: quote?.change ?? 0,
            changePercent: quote?.changePercent ?? 0,
            volume: quote?.volume ?? 0,
            atrCompression: vcp.atrCompression,
            volumeRatio: vcp.volumeRatio,
            nearHighPct: vcp.nearHighPct,
            rsScore: vcp.rsScore,
            sr: 0,
          } as any);

          // Record outcome tracking entry
          try {
            await db.insert(swingOutcomes).values({
              symbol: cleanSym,
              entryPrice: String(price.toFixed(2)),
              stopLoss: String(trade.stopLoss.toFixed(2)),
              target: String(trade.target.toFixed(2)),
              vcpScore,
              newsScore: String(newsScore.toFixed(2)),
              fundamentalScore,
              compositeScore: String(compositeScore.toFixed(2)),
              genomeVersion: genome.version,
            });
          } catch (_) {}

        } catch (_) {}
      }));

      scanned += batch.length;
      if (b + BATCH_SIZE < scanList.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }

      if (scanned % 100 === 0 || b + BATCH_SIZE >= scanList.length) {
        console.log(`[SwingGenome] Progress: ${scanned}/${scanList.length} → ${results.length} matches`);
      }
    }

    // Sort by change% descending
    results.sort((a, b) => b.changePercent - a.changePercent);
    results.forEach((r, i) => { r.sr = i + 1; });

    const duration = Date.now() - startTime;
    await markJobDone("swing_evolved_scan", duration);
    console.log(`[SwingGenome] ═══ Scan complete: ${results.length} picks from ${scanned} stocks (genome v${genome.version}) ═══`);

    return {
      results,
      genomeVersion: genome.version,
      scanned,
      passed: results.length,
    };
  } catch (error: any) {
    console.error("[SwingGenome] Scan failed:", error);
    await markJobFailed("swing_evolved_scan", error);
    return { results: [], genomeVersion: 1, scanned: 0, passed: 0 };
  }
}

/**
 * Fill forward returns for swing picks.
 * Runs periodically to track 5d/10d/20d outcomes.
 */
export async function trackSwingOutcomes(): Promise<{
  filled5d: number;
  filled10d: number;
  filled20d: number;
}> {
  console.log("[SwingGenome] Running outcome tracker...");
  const now = new Date();
  let filled5d = 0, filled10d = 0, filled20d = 0;

  // 5-day outcomes: entries older than 7 calendar days
  const fiveDayAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  try {
    const pending5d = await db.select()
      .from(swingOutcomes)
      .where(and(
        isNull(swingOutcomes.return5d),
        lte(swingOutcomes.scanDate, fiveDayAgo),
      ))
      .limit(80);

    for (const row of pending5d) {
      try {
        const quote = await getYahooStockQuote(`${row.symbol}.NS`);
        if (quote?.price && row.entryPrice) {
          const entryPrice = parseFloat(row.entryPrice);
          const returnPct = ((quote.price - entryPrice) / entryPrice) * 100;
          const sl = row.stopLoss ? parseFloat(row.stopLoss) : null;
          const tgt = row.target ? parseFloat(row.target) : null;

          let outcome = "NEUTRAL";
          if (tgt && quote.price >= tgt) outcome = "TARGET_HIT";
          else if (sl && quote.price <= sl) outcome = "SL_HIT";
          else if (returnPct >= DEFAULT_WIN_THRESHOLD) outcome = "WIN";
          else if (returnPct <= DEFAULT_LOSS_THRESHOLD) outcome = "LOSS";

          await db.update(swingOutcomes)
            .set({
              price5d: String(quote.price.toFixed(2)),
              return5d: String(returnPct.toFixed(2)),
              outcome5d: outcome,
              filled5dAt: now,
            })
            .where(eq(swingOutcomes.id, row.id));
          filled5d++;
        }
      } catch (_) {}
    }
  } catch (_) {}

  // 10-day outcomes
  const tenDayAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  try {
    const pending10d = await db.select()
      .from(swingOutcomes)
      .where(and(
        isNull(swingOutcomes.return10d),
        sql`${swingOutcomes.return5d} IS NOT NULL`,
        lte(swingOutcomes.scanDate, tenDayAgo),
      ))
      .limit(80);

    for (const row of pending10d) {
      try {
        const quote = await getYahooStockQuote(`${row.symbol}.NS`);
        if (quote?.price && row.entryPrice) {
          const entryPrice = parseFloat(row.entryPrice);
          const returnPct = ((quote.price - entryPrice) / entryPrice) * 100;
          const sl = row.stopLoss ? parseFloat(row.stopLoss) : null;
          const tgt = row.target ? parseFloat(row.target) : null;

          let outcome = "NEUTRAL";
          if (tgt && quote.price >= tgt) outcome = "TARGET_HIT";
          else if (sl && quote.price <= sl) outcome = "SL_HIT";
          else if (returnPct >= DEFAULT_WIN_THRESHOLD) outcome = "WIN";
          else if (returnPct <= DEFAULT_LOSS_THRESHOLD) outcome = "LOSS";

          await db.update(swingOutcomes)
            .set({
              price10d: String(quote.price.toFixed(2)),
              return10d: String(returnPct.toFixed(2)),
              outcome10d: outcome,
              filled10dAt: now,
            })
            .where(eq(swingOutcomes.id, row.id));
          filled10d++;
        }
      } catch (_) {}
    }
  } catch (_) {}

  // 20-day outcomes
  const twentyDayAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  try {
    const pending20d = await db.select()
      .from(swingOutcomes)
      .where(and(
        isNull(swingOutcomes.return20d),
        sql`${swingOutcomes.return10d} IS NOT NULL`,
        lte(swingOutcomes.scanDate, twentyDayAgo),
      ))
      .limit(80);

    for (const row of pending20d) {
      try {
        const quote = await getYahooStockQuote(`${row.symbol}.NS`);
        if (quote?.price && row.entryPrice) {
          const entryPrice = parseFloat(row.entryPrice);
          const returnPct = ((quote.price - entryPrice) / entryPrice) * 100;

          await db.update(swingOutcomes)
            .set({
              price20d: String(quote.price.toFixed(2)),
              return20d: String(returnPct.toFixed(2)),
              outcome20d: returnPct >= DEFAULT_WIN_THRESHOLD ? "WIN" : returnPct <= DEFAULT_LOSS_THRESHOLD ? "LOSS" : "NEUTRAL",
              filled20dAt: now,
            })
            .where(eq(swingOutcomes.id, row.id));
          filled20d++;
        }
      } catch (_) {}
    }
  } catch (_) {}

  console.log(`[SwingGenome] Outcomes filled — 5d: ${filled5d}, 10d: ${filled10d}, 20d: ${filled20d}`);
  return { filled5d, filled10d, filled20d };
}

/**
 * Self-improving learning cycle for Swing Scanner.
 * Gathers completed outcomes → evolves genome → promotes if better.
 */
export async function runSwingLearningCycle(): Promise<{
  promoted: boolean;
  oldAvgReturn: number;
  newAvgReturn: number;
  sampleSize: number;
  description: string;
}> {
  console.log("[SwingGenome] ═══ Running self-improving learning cycle ═══");
  await markJobStart("swing_learning_cycle");

  try {
    // Gather all completed outcomes (with 5d return)
    const completed = await db.select()
      .from(swingOutcomes)
      .where(sql`${swingOutcomes.return5d} IS NOT NULL`)
      .orderBy(desc(swingOutcomes.scanDate))
      .limit(500);

    // Convert to TradeOutcome format
    const trades: TradeOutcome[] = completed.map(row => ({
      returnPct: parseFloat(row.return5d || "0"),
      vcpScore: row.vcpScore ?? undefined,
      newsScore: row.newsScore ? parseFloat(row.newsScore) : undefined,
      outcome: row.outcome5d ?? undefined,
    }));

    // Run genome evolution
    const result = await runGenomeEvolution("SWING", trades, {
      mutations: 25,
      minImprovement: 0.2,
    });

    const duration = Date.now();
    await markJobDone("swing_learning_cycle", duration);

    console.log(`[SwingGenome] ═══ Learning cycle complete: ${result.promoted ? "PROMOTED" : "unchanged"} | ${result.oldAvgReturn.toFixed(2)}% → ${result.newAvgReturn.toFixed(2)}% ═══`);

    return {
      promoted: result.promoted,
      oldAvgReturn: result.oldAvgReturn,
      newAvgReturn: result.newAvgReturn,
      sampleSize: trades.length,
      description: result.description,
    };
  } catch (error: any) {
    console.error("[SwingGenome] Learning cycle failed:", error);
    await markJobFailed("swing_learning_cycle", error);
    return { promoted: false, oldAvgReturn: 0, newAvgReturn: 0, sampleSize: 0, description: "Error" };
  }
}

/**
 * Returns current genome status for the Swing engine.
 */
export async function getSwingGenomeStatus() {
  const genome = await getGenome("SWING");
  const outcomeCount = await db.select({ count: sql<number>`COUNT(*)` })
    .from(swingOutcomes)
    .where(sql`${swingOutcomes.return5d} IS NOT NULL`);

  return {
    engine: "SWING",
    genomeVersion: genome.version,
    params: genome.params,
    avgReturn: genome.avgReturn,
    sampleSize: genome.sampleSize,
    completedOutcomes: outcomeCount[0]?.count ?? 0,
  };
}
