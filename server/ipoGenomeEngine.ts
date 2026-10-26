/**
 * IPO GENOME ENGINE — Institutional Indian IPO Rocket Base & Anchor Lock-In Model
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks Indian IPOs listed within the last 10 to 500 trading days.
 * Evaluates:
 *  1. SEBI Anchor Lock-In supply absorption (30-day & 90-day unlock windows)
 *  2. High-Tight "Rocket Base" geometry near Post-Listing Highs (PLH)
 *  3. Right-side Volume Dry-Up (VDU)
 *  4. Boom Breakout triggers & measured targets (+20% / +35%)
 *  5. Self-improving learning cycle with genome parameter evolution
 */

import { db } from "./db";
import { ipoOutcomes } from "@shared/schema";
import { and, eq, gte, isNull, lte, sql, desc } from "drizzle-orm";
import { getGenome, runGenomeEvolution, type TradeOutcome } from "./selfImprovingCore";
import { getYahooStockQuote, computeEMA } from "./stockApi";
import { candleCache } from "./candleCache";
import { getNewsScoreForSymbol } from "./apexNewsEngine";
import { getNowIST } from "./istUtils";
import { markJobStart, markJobDone, markJobFailed } from "./jobLedger";

// ─── High-Conviction Indian IPO Universe (Listed < 24 Months) ─────────────────
export const RECENT_INDIAN_IPOS: { symbol: string; name: string; sector: string; issuePrice?: number }[] = [
  { symbol: "IREDA", name: "Indian Renewable Energy Dev Agency", sector: "Power Financing", issuePrice: 32 },
  { symbol: "DOMS", name: "DOMS Industries Ltd", sector: "Consumer Stationery", issuePrice: 790 },
  { symbol: "INOXINDIA", name: "INOX India Ltd", sector: "Cryogenic Equipment", issuePrice: 660 },
  { symbol: "MOTISONS", name: "Motisons Jewellers Ltd", sector: "Gems & Jewellery", issuePrice: 55 },
  { symbol: "JYOTICNC", name: "Jyoti CNC Automation Ltd", sector: "Industrial Machinery", issuePrice: 331 },
  { symbol: "TBOPEK", name: "TBO Tek Ltd", sector: "Travel Tech", issuePrice: 920 },
  { symbol: "AADHARHFC", name: "Aadhar Housing Finance Ltd", sector: "Housing Finance", issuePrice: 315 },
  { symbol: "PREMIERENE", name: "Premier Energies Ltd", sector: "Solar Energy & Cells", issuePrice: 450 },
  { symbol: "HYUNDAI", name: "Hyundai Motor India Ltd", sector: "Automobile OEM", issuePrice: 1960 },
  { symbol: "BAJAJHFL", name: "Bajaj Housing Finance Ltd", sector: "Housing Finance", issuePrice: 70 },
  { symbol: "SWIGGY", name: "Swiggy Ltd", sector: "Hyperlocal & Quick Commerce", issuePrice: 390 },
  { symbol: "NTPCGREEN", name: "NTPC Green Energy Ltd", sector: "Renewable Utilities", issuePrice: 108 },
  { symbol: "MANKIND", name: "Mankind Pharma Ltd", sector: "Pharmaceuticals", issuePrice: 1080 },
  { symbol: "NETWEB", name: "Netweb Technologies India Ltd", sector: "AI & Supercomputing", issuePrice: 500 },
  { symbol: "CYIENTDLM", name: "Cyient DLM Ltd", sector: "Electronics Manufacturing", issuePrice: 265 },
  { symbol: "SBFC", name: "SBFC Finance Ltd", sector: "MSME Finance", issuePrice: 57 },
  { symbol: "JSWINFRA", name: "JSW Infrastructure Ltd", sector: "Ports & Logistics", issuePrice: 119 },
  { symbol: "HONASA", name: "Honasa Consumer (Mamaearth)", sector: "Personal Care", issuePrice: 324 },
  { symbol: "HAPPYFORGE", name: "Happy Forgings Ltd", sector: "Auto Ancillaries", issuePrice: 850 },
  { symbol: "RRKABEL", name: "R R Kabel Ltd", sector: "Cables & Wires", issuePrice: 1035 },
  { symbol: "SAMHI", name: "SAMHI Hotels Ltd", sector: "Hospitality", issuePrice: 126 },
  { symbol: "YATHARTH", name: "Yatharth Hospital & Trauma Care", sector: "Healthcare", issuePrice: 300 },
  { symbol: "KFINTECH", name: "KFin Technologies Ltd", sector: "Financial Services", issuePrice: 366 },
  { symbol: "KAYNES", name: "Kaynes Technology India Ltd", sector: "Electronics Manufacturing", issuePrice: 587 },
  { symbol: "IDEAFORGE", name: "ideaForge Technology Ltd", sector: "Defence & Drones", issuePrice: 672 },
  { symbol: "SENCO", name: "Senco Gold Ltd", sector: "Gems & Jewellery", issuePrice: 317 },
  { symbol: "UTKARSHSFB", name: "Utkarsh Small Finance Bank", sector: "Banking", issuePrice: 25 },
  { symbol: "AVALON", name: "Avalon Technologies Ltd", sector: "EMS & Aerospace", issuePrice: 436 },
];

const DEFAULT_WIN_THRESHOLD = 5.0;
const DEFAULT_LOSS_THRESHOLD = -4.0;

export interface IpoRocketBaseResult {
  id: string;
  scannerType: "ipo";
  stockSymbol: string;
  stockName: string;
  sector: string;
  exchange: "NSE";
  price: string;
  change: string;
  changePercent: string;
  volume: string;
  marketCap: string;
  daysListed: number;
  setupClassification: "HYPER_ROCKET_BASE" | "READY_TO_BOOM" | "ROCKET_BREAKOUT_ACTIVE" | "INSTITUTIONAL_VCP" | "FORMING_BASE";
  anchorLockinStatus: "30D_ANCHOR_ABSORBED" | "90D_ANCHOR_ABSORBED" | "30D_WINDOW_ACTIVE" | "90D_WINDOW_ACTIVE" | "PRE_30D_LOCKIN" | "SUPPLY_OVERHANG";
  rocketScore: number;
  baseDepthPct: number;
  distanceFromPivotPct: number;
  hasVolumeDryUp: boolean;
  currentRvol: number;
  tradePlan: {
    pivotTriggerPrice: number;
    postListingHigh: number;
    stopLoss: number;
    target1: number;
    target2: number;
    riskRewardRatio: string;
  };
  totalGainSinceListingPct: number;
  newsScore: number;
  genomeVersion: number;
  createdAt: string;
}

/**
 * Analyzes candle history for Indian IPO Rocket Base & Anchor Lock-In Absorption.
 */
export function evaluateIpoRocketBase(
  symbol: string,
  candles: any[],
  companyName: string = symbol,
  sector: string = "IPO Growth",
  genomeVersion: number = 1
): IpoRocketBaseResult | null {
  if (!candles || candles.length < 10) return null;

  const closes = candles.map((c: any) => Number(c.close));
  const highs = candles.map((c: any) => Number(c.high));
  const lows = candles.map((c: any) => Number(c.low));
  const vols = candles.map((c: any) => Number(c.volume) || 1);

  const n = closes.length;
  const currClose = closes[n - 1];
  const prevClose = closes[n - 2] || currClose;
  const listingOpen = Number(candles[0].open) || closes[0];

  const daysListed = n;
  if (daysListed > 500) return null; // Over 24 months not classified as active IPO base

  const postListingHigh = Math.max(...highs);
  const totalGainSinceListingPct = ((currClose - listingOpen) / (listingOpen + 1e-8)) * 100;

  // Base Window: last 15-40 bars (or half of history)
  const baseWindow = Math.min(40, Math.max(12, Math.floor(n * 0.6)));
  const baseHighs = highs.slice(n - baseWindow);
  const baseLows = lows.slice(n - baseWindow);
  const pivotHigh = Math.max(...baseHighs);
  const baseLow = Math.min(...baseLows);

  const baseDepthPct = ((pivotHigh - baseLow) / (pivotHigh + 1e-8)) * 100;
  const distanceFromPivotPct = ((pivotHigh - currClose) / (pivotHigh + 1e-8)) * 100;

  // Volume Dry-Up (VDU) in last 5 bars vs 20-day average
  const recent20Vols = vols.slice(Math.max(0, n - 20));
  const smaVol20 = recent20Vols.reduce((sum, v) => sum + v, 0) / (recent20Vols.length || 1);
  const recent5Vols = vols.slice(Math.max(0, n - 5));
  const minVolRatio = Math.min(...recent5Vols) / (smaVol20 + 1e-8);
  const currRvol = vols[n - 1] / (smaVol20 + 1e-8);
  const hasVolumeDryUp = minVolRatio <= 0.58;

  // 20 EMA & 50 EMA
  const ema20Arr = computeEMA(closes, Math.min(20, n));
  const currEma20 = ema20Arr[n - 1] || currClose;

  // SEBI Anchor Lock-in Window & Supply Absorption
  let anchorLockinStatus: IpoRocketBaseResult["anchorLockinStatus"] = "PRE_30D_LOCKIN";
  if (daysListed >= 85 && daysListed <= 100) {
    anchorLockinStatus = "90D_WINDOW_ACTIVE";
  } else if (daysListed >= 28 && daysListed <= 38) {
    anchorLockinStatus = "30D_WINDOW_ACTIVE";
  } else if (daysListed > 100 && currClose >= currEma20) {
    anchorLockinStatus = "90D_ANCHOR_ABSORBED";
  } else if (daysListed > 38 && currClose >= currEma20) {
    anchorLockinStatus = "30D_ANCHOR_ABSORBED";
  } else if (currClose < currEma20 && daysListed > 38) {
    anchorLockinStatus = "SUPPLY_OVERHANG";
  }

  // Volatility & ATR
  const recentRanges = highs.slice(Math.max(0, n - 14)).map((h, i) => h - lows[Math.max(0, n - 14) + i]);
  const atr14 = recentRanges.reduce((a, b) => a + b, 0) / (recentRanges.length || 1);

  // Setup Classification
  let setupClassification: IpoRocketBaseResult["setupClassification"] = "FORMING_BASE";
  let rocketScore = 65;

  const isNearHigh = distanceFromPivotPct <= 15.0;
  const isTight = baseDepthPct <= 22.0;

  if (currClose >= pivotHigh * 0.995 && currRvol >= 1.8 && baseDepthPct <= 26.0) {
    setupClassification = "ROCKET_BREAKOUT_ACTIVE";
    rocketScore = 95;
  } else if (isTight && distanceFromPivotPct <= 3.5 && hasVolumeDryUp) {
    setupClassification = "READY_TO_BOOM";
    rocketScore = 88;
  } else if (baseDepthPct <= 18.0 && totalGainSinceListingPct >= 30.0) {
    setupClassification = "HYPER_ROCKET_BASE";
    rocketScore = 84;
  } else if (baseDepthPct <= 28.0 && isNearHigh) {
    setupClassification = "INSTITUTIONAL_VCP";
    rocketScore = 76;
  } else {
    setupClassification = "FORMING_BASE";
    rocketScore = 62;
  }

  // Anchor bonus
  if (anchorLockinStatus === "30D_ANCHOR_ABSORBED" || anchorLockinStatus === "90D_ANCHOR_ABSORBED") {
    rocketScore = Math.min(99, rocketScore + 6);
  }

  const stopLoss = Math.round(Math.max(baseLow, currClose - 1.5 * atr14) * 100) / 100;
  const target1 = Math.round((pivotHigh * 1.20) * 100) / 100;
  const target2 = Math.round((pivotHigh * 1.35) * 100) / 100;
  const risk = Math.max(1, currClose - stopLoss);
  const reward = target1 - currClose;
  const rr = (reward / risk).toFixed(1);

  const dailyChange = currClose - prevClose;
  const dailyChangePercent = (dailyChange / prevClose) * 100;

  return {
    id: `ipo_${symbol}`,
    scannerType: "ipo",
    stockSymbol: symbol,
    stockName: companyName,
    sector,
    exchange: "NSE",
    price: currClose.toFixed(2),
    change: dailyChange.toFixed(2),
    changePercent: dailyChangePercent.toFixed(2),
    volume: vols[n - 1].toLocaleString("en-IN"),
    marketCap: "N/A",
    daysListed,
    setupClassification,
    anchorLockinStatus,
    rocketScore,
    baseDepthPct: Math.round(baseDepthPct * 10) / 10,
    distanceFromPivotPct: Math.round(distanceFromPivotPct * 10) / 10,
    hasVolumeDryUp,
    currentRvol: Math.round(currRvol * 100) / 100,
    tradePlan: {
      pivotTriggerPrice: Math.round(pivotHigh * 100) / 100,
      postListingHigh: Math.round(postListingHigh * 100) / 100,
      stopLoss,
      target1,
      target2,
      riskRewardRatio: `1:${rr}`,
    },
    totalGainSinceListingPct: Math.round(totalGainSinceListingPct * 10) / 10,
    newsScore: 75,
    genomeVersion,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Genome-evolved IPO Scanner using the Institutional Indian IPO Rocket Base Engine.
 */
export async function runIpoScannerEvolved(): Promise<{
  results: IpoRocketBaseResult[];
  genomeVersion: number;
  scanned: number;
  passed: number;
}> {
  console.log("[IpoGenome] ═══ Starting Indian IPO Rocket Base & Anchor Lock-In Scan ═══");
  const startTime = Date.now();
  await markJobStart("ipo_evolved_scan");

  try {
    const genome = await getGenome("IPO");
    const results: IpoRocketBaseResult[] = [];
    let scanned = 0;

    // Scan curated Indian IPOs in parallel with candleCache
    await Promise.all(
      RECENT_INDIAN_IPOS.map(async (item) => {
        try {
          const symbol = item.symbol;
          const candles = await candleCache.getCandlesCached(`${symbol}.NS`, "1y", "1d");
          scanned++;
          
          const analyzed = evaluateIpoRocketBase(
            symbol,
            candles,
            item.name,
            item.sector,
            genome.version
          );

          if (analyzed) {
            try {
              const newsScore = await getNewsScoreForSymbol(symbol);
              analyzed.newsScore = Math.round(newsScore);
            } catch (_) {}

            results.push(analyzed);

            // Record in outcomes table
            try {
              await db.insert(ipoOutcomes).values({
                symbol,
                entryPrice: analyzed.price,
                listingDate: new Date(),
                daysOld: analyzed.daysListed,
                baseDepth: String(analyzed.baseDepthPct),
                consolidationRange: String(analyzed.distanceFromPivotPct),
                avgVolume: String(analyzed.volume).replace(/,/g, ""),
                ipoScore: analyzed.rocketScore,
                newsScore: String(analyzed.newsScore),
                genomeVersion: genome.version,
              });
            } catch (_) {}
          }
        } catch (err: any) {
          console.warn(`[IpoGenome] Could not fetch IPO data for ${item.symbol}:`, err.message);
        }
      })
    );

    // Sort by Rocket Score descending, then by proximity to breakout
    results.sort((a, b) => b.rocketScore - a.rocketScore || a.distanceFromPivotPct - b.distanceFromPivotPct);
    console.log(`[IpoGenome] ═══ Scan complete: ${results.length} IPO Rocket Bases detected ═══`);

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
  let filled5d = 0;
  let filled10d = 0;
  let filled20d = 0;

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
  let completedOutcomes = 0;
  try {
    const outcomeCount = await db.select({ count: sql<number>`COUNT(*)` })
      .from(ipoOutcomes)
      .where(sql`${ipoOutcomes.return5d} IS NOT NULL`);
    completedOutcomes = outcomeCount[0]?.count ?? 0;
  } catch (_) {}

  return {
    engine: "IPO",
    genomeVersion: genome.version,
    params: genome.params,
    avgReturn: genome.avgReturn,
    sampleSize: genome.sampleSize,
    completedOutcomes,
  };
}
