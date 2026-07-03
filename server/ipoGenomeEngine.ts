/**
 * IPO GENOME ENGINE — Self-Improving IPO Radar
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps the existing runIpoScanner() with:
 *  1. Genome-controlled filter parameters
 *  2. IPO scoring (base quality + volume + news)
 *  3. Outcome tracking (5d/10d/20d forward returns)
 *  4. Learning cycle with genome evolution toward 5-10% returns
 *
 * Uses the selfImprovingCore genome system with engine ID "IPO".
 */

import { db } from "./db";
import { ipoOutcomes } from "@shared/schema";
import { and, eq, gte, isNull, lte, sql, desc } from "drizzle-orm";
import { getGenome, runGenomeEvolution, type TradeOutcome } from "./selfImprovingCore";
import { getYahooStockQuote, getYahooHistory } from "./stockApi";
import { NSE_UNIQUE } from "./nseUniverse";
import { getNewsScoreForSymbol } from "./apexNewsEngine";
import { getNowIST } from "./istUtils";
import { markJobStart, markJobDone, markJobFailed } from "./jobLedger";

// ─── Constants ────────────────────────────────────────────────────────────────
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 200;
const DEFAULT_WIN_THRESHOLD = 5.0;
const DEFAULT_LOSS_THRESHOLD = -4.0;

/**
 * Compute an IPO quality score (0-100).
 * Combines base tightness, volume, consolidation quality, and relative position.
 */
function computeIpoScore(
  baseDepth: number,         // 0-1 (fraction from peak)
  consolidationRange: number, // 0-1 (last 10d range fraction)
  avgVolume: number,
  daysOld: number,
  lastClose: number,
  maxHigh: number,
): number {
  let score = 50;

  // Base depth: shallower is better (ideal: 10-20%)
  if (baseDepth <= 0.15) score += 15;
  else if (baseDepth <= 0.25) score += 8;
  else if (baseDepth > 0.30) score -= 10;

  // Consolidation tightness: tighter is better
  if (consolidationRange <= 0.08) score += 15;
  else if (consolidationRange <= 0.12) score += 8;
  else if (consolidationRange > 0.20) score -= 5;

  // Volume: moderate volume is ideal
  if (avgVolume >= 50000) score += 10;
  else if (avgVolume >= 10000) score += 5;
  else if (avgVolume < 3000) score -= 10;

  // Proximity to high: closer is bullish
  const nearHighPct = lastClose / maxHigh;
  if (nearHighPct >= 0.95) score += 10;
  else if (nearHighPct >= 0.85) score += 5;
  else if (nearHighPct < 0.70) score -= 10;

  // Days since listing: sweet spot is 30-90 days
  if (daysOld >= 30 && daysOld <= 80) score += 5;
  else if (daysOld < 15) score -= 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * Genome-evolved IPO Scanner.
 * Uses genome parameters for dynamic filtering.
 */
export async function runIpoScannerEvolved(): Promise<{
  results: any[];
  genomeVersion: number;
  scanned: number;
  passed: number;
}> {
  console.log("[IpoGenome] ═══ Starting genome-aware IPO scan ═══");
  const startTime = Date.now();
  await markJobStart("ipo_evolved_scan");

  try {
    // Load current genome
    const genome = await getGenome("IPO");
    const gp = genome.params;
    const minDaysSinceListing = Math.round(gp.min_days_since_listing ?? 10);
    const maxDaysSinceListing = Math.round(gp.max_days_since_listing ?? 110);
    const maxBaseDepthPct = gp.max_base_depth_pct ?? 0.35;
    const consolidationRangePct = gp.consolidation_range_pct ?? 0.15;
    const minAvgVolume = Math.round(gp.min_avg_volume ?? 5000);
    const minScoreThreshold = Math.round(gp.min_score_threshold ?? 50);
    const targetReturnGoal = gp.target_return_goal ?? 7.5;

    console.log(`[IpoGenome] Genome v${genome.version}: days=${minDaysSinceListing}-${maxDaysSinceListing} baseMax=${maxBaseDepthPct} consolMax=${consolidationRangePct} vol=${minAvgVolume} minScore=${minScoreThreshold}`);

    const scanList = NSE_UNIQUE.map(sym => sym.includes('.') ? sym : `${sym}.NS`);
    console.log(`[IpoGenome] Scanning ${scanList.length} stocks...`);

    const results: any[] = [];
    let scanned = 0;

    for (let b = 0; b < scanList.length; b += BATCH_SIZE) {
      const batch = scanList.slice(b, b + BATCH_SIZE);

      await Promise.allSettled(batch.map(async (sym) => {
        try {
          const candles = await getYahooHistory(sym, '1y', '1d');
          // Short history = potential IPO
          if (!candles || candles.length < 10 || candles.length > 80) return;

          const firstCandle = candles[0];
          const listingDate = new Date(firstCandle.time);
          const ageInDays = (Date.now() - listingDate.getTime()) / (1000 * 60 * 60 * 24);

          // Genome-controlled age filter
          if (ageInDays < minDaysSinceListing || ageInDays > maxDaysSinceListing) return;

          const closes = candles.map((c: any) => c.close as number);
          const highs = candles.map((c: any) => c.high as number);
          const lows = candles.map((c: any) => c.low as number);
          const vols = candles.map((c: any) => c.volume as number);

          const n = closes.length;
          const lastClose = closes[n - 1];
          const prevClose = closes[n - 2];

          // Total base depth filter (genome-controlled)
          const maxHighAll = Math.max(...highs);
          const minLowAll = Math.min(...lows);
          const totalDepth = (maxHighAll - minLowAll) / maxHighAll;
          if (totalDepth > maxBaseDepthPct) return;

          // Consolidation range filter (genome-controlled)
          const lookback = Math.min(n, 10);
          const recentHighs = highs.slice(n - lookback);
          const recentLows = lows.slice(n - lookback);
          const maxRecent = Math.max(...recentHighs);
          const minRecent = Math.min(...recentLows);
          const recentDepth = (maxRecent - minRecent) / maxRecent;
          if (recentDepth > consolidationRangePct) return;

          // Volume filter (genome-controlled)
          const recentVols = vols.slice(n - Math.min(n, 5));
          const avgVol = recentVols.reduce((sum: number, v: number) => sum + (v || 0), 0) / recentVols.length;
          if (avgVol < minAvgVolume) return;

          // Compute IPO score
          const ipoScore = computeIpoScore(totalDepth, recentDepth, avgVol, ageInDays, lastClose, maxHighAll);
          if (ipoScore < minScoreThreshold) return;

          // Get news score
          const cleanSym = sym.replace('.NS', '').replace('.BO', '');
          let newsScore = 0;
          try {
            newsScore = await getNewsScoreForSymbol(cleanSym);
          } catch (_) {}

          const dailyChange = lastClose - prevClose;
          const dailyChangePercent = (dailyChange / prevClose) * 100;

          const result = {
            id: `ipo_${cleanSym}`,
            scannerType: 'ipo',
            stockSymbol: cleanSym,
            stockName: cleanSym,
            exchange: 'NSE',
            price: lastClose.toFixed(2),
            change: dailyChange.toFixed(2),
            changePercent: dailyChangePercent.toFixed(2),
            volume: vols[n - 1] ? vols[n - 1].toLocaleString('en-IN') : '0',
            marketCap: 'N/A',
            ipoScore,
            newsScore: Math.round(newsScore),
            daysOld: Math.round(ageInDays),
            baseDepth: (totalDepth * 100).toFixed(1) + '%',
            consolidation: (recentDepth * 100).toFixed(1) + '%',
            genomeVersion: genome.version,
            createdAt: new Date().toISOString(),
          };

          results.push(result);

          // Record outcome tracking
          try {
            await db.insert(ipoOutcomes).values({
              symbol: cleanSym,
              entryPrice: String(lastClose.toFixed(2)),
              listingDate,
              daysOld: Math.round(ageInDays),
              baseDepth: String(totalDepth.toFixed(4)),
              consolidationRange: String(recentDepth.toFixed(4)),
              avgVolume: String(Math.round(avgVol)),
              ipoScore,
              newsScore: String(newsScore.toFixed(2)),
              genomeVersion: genome.version,
            });
          } catch (_) {}

        } catch (_) {}
      }));

      scanned += batch.length;
      if (b + BATCH_SIZE < scanList.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    // Sort by IPO score descending, then by change%
    results.sort((a, b) => (b.ipoScore || 0) - (a.ipoScore || 0));
    console.log(`[IpoGenome] ═══ Scan complete: ${results.length} IPO picks from ${scanned} stocks (genome v${genome.version}) ═══`);

    const duration = Date.now() - startTime;
    await markJobDone("ipo_evolved_scan", duration);

    return {
      results,
      genomeVersion: genome.version,
      scanned,
      passed: results.length,
    };
  } catch (error: any) {
    console.error("[IpoGenome] Scan failed:", error);
    await markJobFailed("ipo_evolved_scan", error);
    return { results: [], genomeVersion: 1, scanned: 0, passed: 0 };
  }
}

/**
 * Fill forward returns for IPO picks.
 */
export async function trackIpoOutcomes(): Promise<{
  filled5d: number;
  filled10d: number;
  filled20d: number;
}> {
  console.log("[IpoGenome] Running outcome tracker...");
  const now = new Date();
  let filled5d = 0, filled10d = 0, filled20d = 0;

  // 5-day outcomes
  const fiveDayAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  try {
    const pending5d = await db.select()
      .from(ipoOutcomes)
      .where(and(
        isNull(ipoOutcomes.return5d),
        lte(ipoOutcomes.scanDate, fiveDayAgo),
      ))
      .limit(80);

    for (const row of pending5d) {
      try {
        const quote = await getYahooStockQuote(`${row.symbol}.NS`);
        if (quote?.price && row.entryPrice) {
          const entryPrice = parseFloat(row.entryPrice);
          const returnPct = ((quote.price - entryPrice) / entryPrice) * 100;
          const outcome = returnPct >= DEFAULT_WIN_THRESHOLD ? "WIN" : returnPct <= DEFAULT_LOSS_THRESHOLD ? "LOSS" : "NEUTRAL";

          await db.update(ipoOutcomes)
            .set({
              price5d: String(quote.price.toFixed(2)),
              return5d: String(returnPct.toFixed(2)),
              outcome5d: outcome,
              filled5dAt: now,
            })
            .where(eq(ipoOutcomes.id, row.id));
          filled5d++;
        }
      } catch (_) {}
    }
  } catch (_) {}

  // 10-day outcomes
  const tenDayAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  try {
    const pending10d = await db.select()
      .from(ipoOutcomes)
      .where(and(
        isNull(ipoOutcomes.return10d),
        sql`${ipoOutcomes.return5d} IS NOT NULL`,
        lte(ipoOutcomes.scanDate, tenDayAgo),
      ))
      .limit(80);

    for (const row of pending10d) {
      try {
        const quote = await getYahooStockQuote(`${row.symbol}.NS`);
        if (quote?.price && row.entryPrice) {
          const entryPrice = parseFloat(row.entryPrice);
          const returnPct = ((quote.price - entryPrice) / entryPrice) * 100;

          await db.update(ipoOutcomes)
            .set({
              price10d: String(quote.price.toFixed(2)),
              return10d: String(returnPct.toFixed(2)),
              outcome10d: returnPct >= DEFAULT_WIN_THRESHOLD ? "WIN" : returnPct <= DEFAULT_LOSS_THRESHOLD ? "LOSS" : "NEUTRAL",
              filled10dAt: now,
            })
            .where(eq(ipoOutcomes.id, row.id));
          filled10d++;
        }
      } catch (_) {}
    }
  } catch (_) {}

  // 20-day outcomes
  const twentyDayAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  try {
    const pending20d = await db.select()
      .from(ipoOutcomes)
      .where(and(
        isNull(ipoOutcomes.return20d),
        sql`${ipoOutcomes.return10d} IS NOT NULL`,
        lte(ipoOutcomes.scanDate, twentyDayAgo),
      ))
      .limit(80);

    for (const row of pending20d) {
      try {
        const quote = await getYahooStockQuote(`${row.symbol}.NS`);
        if (quote?.price && row.entryPrice) {
          const entryPrice = parseFloat(row.entryPrice);
          const returnPct = ((quote.price - entryPrice) / entryPrice) * 100;

          await db.update(ipoOutcomes)
            .set({
              price20d: String(quote.price.toFixed(2)),
              return20d: String(returnPct.toFixed(2)),
              outcome20d: returnPct >= DEFAULT_WIN_THRESHOLD ? "WIN" : returnPct <= DEFAULT_LOSS_THRESHOLD ? "LOSS" : "NEUTRAL",
              filled20dAt: now,
            })
            .where(eq(ipoOutcomes.id, row.id));
          filled20d++;
        }
      } catch (_) {}
    }
  } catch (_) {}

  console.log(`[IpoGenome] Outcomes filled — 5d: ${filled5d}, 10d: ${filled10d}, 20d: ${filled20d}`);
  return { filled5d, filled10d, filled20d };
}

/**
 * Self-improving learning cycle for IPO Radar.
 */
export async function runIpoLearningCycle(): Promise<{
  promoted: boolean;
  oldAvgReturn: number;
  newAvgReturn: number;
  sampleSize: number;
  description: string;
}> {
  console.log("[IpoGenome] ═══ Running self-improving learning cycle ═══");
  await markJobStart("ipo_learning_cycle");

  try {
    const completed = await db.select()
      .from(ipoOutcomes)
      .where(sql`${ipoOutcomes.return5d} IS NOT NULL`)
      .orderBy(desc(ipoOutcomes.scanDate))
      .limit(500);

    const trades: TradeOutcome[] = completed.map(row => ({
      returnPct: parseFloat(row.return5d || "0"),
      vcpScore: row.ipoScore ?? undefined,
      newsScore: row.newsScore ? parseFloat(row.newsScore) : undefined,
      outcome: row.outcome5d ?? undefined,
    }));

    const result = await runGenomeEvolution("IPO", trades, {
      mutations: 25,
      minImprovement: 0.2,
    });

    await markJobDone("ipo_learning_cycle", Date.now());

    console.log(`[IpoGenome] ═══ Learning cycle complete: ${result.promoted ? "PROMOTED" : "unchanged"} | ${result.oldAvgReturn.toFixed(2)}% → ${result.newAvgReturn.toFixed(2)}% ═══`);

    return {
      promoted: result.promoted,
      oldAvgReturn: result.oldAvgReturn,
      newAvgReturn: result.newAvgReturn,
      sampleSize: trades.length,
      description: result.description,
    };
  } catch (error: any) {
    console.error("[IpoGenome] Learning cycle failed:", error);
    await markJobFailed("ipo_learning_cycle", error);
    return { promoted: false, oldAvgReturn: 0, newAvgReturn: 0, sampleSize: 0, description: "Error" };
  }
}

/**
 * Returns current genome status for the IPO engine.
 */
export async function getIpoGenomeStatus() {
  const genome = await getGenome("IPO");
  const outcomeCount = await db.select({ count: sql<number>`COUNT(*)` })
    .from(ipoOutcomes)
    .where(sql`${ipoOutcomes.return5d} IS NOT NULL`);

  return {
    engine: "IPO",
    genomeVersion: genome.version,
    params: genome.params,
    avgReturn: genome.avgReturn,
    sampleSize: genome.sampleSize,
    completedOutcomes: outcomeCount[0]?.count ?? 0,
  };
}
