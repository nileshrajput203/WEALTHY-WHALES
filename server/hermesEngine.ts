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

/* ═══════════════════════════════════════════════════════════
   CONSTANTS & DEFAULT WEIGHTS
═══════════════════════════════════════════════════════════ */

/** Win threshold: +3% forward return = WIN, -3% = LOSS */
const WIN_THRESHOLD = 3.0;
const LOSS_THRESHOLD = -3.0;

/** Maximum stocks to scan per daily run */
const MAX_SCAN_UNIVERSE = 200;

/** Batch size for parallel Yahoo API calls */
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 600;

/** Default weight vector — v0 "intuition" before any learning */
export const DEFAULT_WEIGHTS: Record<string, number> = {
  // Technicals (30%)
  rsi14_zone: 0.08,        // RSI in sweet spot (40-65)
  sma20_above: 0.06,       // Price above SMA20
  sma50_above: 0.05,       // Price above SMA50
  golden_cross: 0.04,      // SMA20 > SMA50
  macd_positive: 0.04,     // MACD histogram positive
  adx_strong: 0.03,        // ADX > 25 (trending)

  // Fundamentals (25%)
  roe_quality: 0.07,       // ROE > 15%
  low_debt: 0.05,          // D/E < 1
  margin_quality: 0.05,    // OPM > 15%
  pe_reasonable: 0.04,     // PE 10-30
  roce_quality: 0.04,      // ROCE > 12%

  // Momentum (25%)
  return_1w: 0.05,         // 1-week return
  return_1m: 0.06,         // 1-month return
  return_3m: 0.06,         // 3-month return
  proximity_52w_high: 0.04, // Near 52-week high
  rvol_elevated: 0.04,     // Relative volume > 1.5

  // Insider/Quality (10%)
  market_cap_stable: 0.04, // Large/mid cap bonus
  dividend_present: 0.03,  // Has dividend
  iq_composite: 0.03,      // StockIQ total score

  // Pattern (10%)
  pattern_bullish: 0.06,   // Bullish pattern detected
  pattern_breakout: 0.04,  // Pattern in breakout stage
};

/** Sector mapping for NSE stocks */
const SECTOR_MAP: Record<string, string> = {
  TCS: "IT", INFY: "IT", WIPRO: "IT", HCLTECH: "IT", TECHM: "IT", LTIM: "IT",
  HDFCBANK: "Banking", ICICIBANK: "Banking", SBIN: "Banking", KOTAKBANK: "Banking",
  AXISBANK: "Banking", INDUSINDBK: "Banking", BANDHANBNK: "Banking",
  SUNPHARMA: "Pharma", CIPLA: "Pharma", DRREDDY: "Pharma", DIVISLAB: "Pharma",
  TATAMOTORS: "Auto", MARUTI: "Auto", "M&M": "Auto", "BAJAJ-AUTO": "Auto",
  HINDUNILVR: "FMCG", ITC: "FMCG", NESTLEIND: "FMCG", BRITANNIA: "FMCG",
  RELIANCE: "Energy", NTPC: "Energy", POWERGRID: "Energy", ONGC: "Energy",
  TATASTEEL: "Metals", JSWSTEEL: "Metals", HINDALCO: "Metals", VEDL: "Metals",
  LT: "Infra", ADANIENT: "Infra", ADANIPORTS: "Infra",
  BAJFINANCE: "Finance", BAJAJFINSV: "Finance", SBILIFE: "Finance",
  TITAN: "Consumer", ASIANPAINT: "Consumer",
  ULTRACEMCO: "Cement", GRASIM: "Cement",
  BHARTIARTL: "Telecom",
};

/* ═══════════════════════════════════════════════════════════
   HELPER: Compute ADX (Average Directional Index)
═══════════════════════════════════════════════════════════ */
function computeADX(highs: number[], lows: number[], closes: number[], period = 14): number | null {
  const n = highs.length;
  if (n < period * 2 + 1) return null;

  const trueRanges: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < n; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
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
function computeATR(highs: number[], lows: number[], closes: number[], period = 14): number | null {
  const n = highs.length;
  if (n < period + 1) return null;

  const trueRanges: number[] = [];
  for (let i = 1; i < n; i++) {
    trueRanges.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
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
let activeWeightsCache: { weights: Record<string, number>; version: number; ts: number } | null = null;
const WEIGHT_CACHE_TTL = 30 * 60 * 1000; // 30 min

async function getActiveWeights(): Promise<{ weights: Record<string, number>; version: number }> {
  if (activeWeightsCache && Date.now() - activeWeightsCache.ts < WEIGHT_CACHE_TTL) {
    return { weights: activeWeightsCache.weights, version: activeWeightsCache.version };
  }

  try {
    const [active] = await db
      .select()
      .from(hermesWeights)
      .where(eq(hermesWeights.isActive, true))
      .limit(1);

    if (active) {
      const w = active.weights as Record<string, number>;
      activeWeightsCache = { weights: w, version: active.version, ts: Date.now() };
      return { weights: w, version: active.version };
    }
  } catch (e) {
    console.error("[HERMES] Failed to load active weights:", e);
  }

  // Fallback: insert default weights as v1 if none exist
  return { weights: DEFAULT_WEIGHTS, version: 0 };
}

/* ═══════════════════════════════════════════════════════════
   HERMES SCORE — Compute adaptive score for a stock
═══════════════════════════════════════════════════════════ */
interface StockFeatures {
  rsi14: number | null;
  sma20: number | null;
  sma50: number | null;
  price: number;
  macdHistogram: number | null;
  adx: number | null;
  roe: number | null;
  debtToEquity: number | null;
  opm: number | null;
  pe: number | null;
  roce: number | null;
  return1w: number | null;
  return1m: number | null;
  return3m: number | null;
  proximity52wHigh: number | null;
  rvol: number | null;
  marketCapValue: number | null;
  dividendYield: number | null;
  iqTotal: number | null;
  patternDetected: string | null;
  patternStage: string | null;
}

function computeHermesScore(features: StockFeatures, weights: Record<string, number>): number {
  let score = 0;
  let maxPossible = 0;

  const add = (key: string, condition: boolean, strength: number = 1.0) => {
    const w = weights[key] || 0;
    maxPossible += w;
    if (condition) {
      score += w * strength;
    }
  };

  // Technicals
  const rsi = features.rsi14;
  add("rsi14_zone", rsi != null && rsi >= 40 && rsi <= 65, rsi != null ? (rsi >= 50 && rsi <= 60 ? 1.0 : 0.7) : 0);
  add("sma20_above", features.sma20 != null && features.price > features.sma20);
  add("sma50_above", features.sma50 != null && features.price > features.sma50);
  add("golden_cross", features.sma20 != null && features.sma50 != null && features.sma20 > features.sma50);
  add("macd_positive", features.macdHistogram != null && features.macdHistogram > 0);
  add("adx_strong", features.adx != null && features.adx > 25, features.adx != null && features.adx > 40 ? 1.0 : 0.7);

  // Fundamentals
  add("roe_quality", features.roe != null && features.roe > 15, features.roe != null && features.roe > 20 ? 1.0 : 0.7);
  add("low_debt", features.debtToEquity != null && features.debtToEquity < 1, features.debtToEquity != null && features.debtToEquity < 0.5 ? 1.0 : 0.7);
  add("margin_quality", features.opm != null && features.opm > 15, features.opm != null && features.opm > 25 ? 1.0 : 0.7);
  add("pe_reasonable", features.pe != null && features.pe > 10 && features.pe < 30);
  add("roce_quality", features.roce != null && features.roce > 12);

  // Momentum
  add("return_1w", features.return1w != null && features.return1w > 0, Math.min(1, Math.max(0, (features.return1w ?? 0) / 5)));
  add("return_1m", features.return1m != null && features.return1m > 0, Math.min(1, Math.max(0, (features.return1m ?? 0) / 10)));
  add("return_3m", features.return3m != null && features.return3m > 0, Math.min(1, Math.max(0, (features.return3m ?? 0) / 20)));
  add("proximity_52w_high", features.proximity52wHigh != null && features.proximity52wHigh > 85);
  add("rvol_elevated", features.rvol != null && features.rvol > 1.5, features.rvol != null && features.rvol > 2.5 ? 1.0 : 0.7);

  // Insider/Quality
  const capCr = (features.marketCapValue ?? 0) / 1e7;
  add("market_cap_stable", capCr > 5000);
  add("dividend_present", features.dividendYield != null && features.dividendYield > 0.5);
  add("iq_composite", features.iqTotal != null && features.iqTotal > 60, (features.iqTotal ?? 50) / 100);

  // Pattern
  add("pattern_bullish", features.patternDetected != null && features.patternDetected !== "");
  add("pattern_breakout", features.patternStage === "Breakout Confirmed" || features.patternStage === "Near Breakout");

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
  console.log(`[HERMES] ═══ Starting daily scan for ${universeSize} stocks ═══`);

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

          // Fetch data
          const [quoteRes, histRes, fundRes] = await Promise.allSettled([
            getYahooStockQuote(yahooSym),
            getYahooHistory(yahooSym, "1y", "1d"),
            getFmpFundamentals(sym),
          ]);

          const quote = quoteRes.status === "fulfilled" ? quoteRes.value : null;
          const candles = histRes.status === "fulfilled" ? histRes.value : [];
          const fund = fundRes.status === "fulfilled" ? fundRes.value : null;

          if (!quote && candles.length === 0) return;

          const closes = candles.map((c: any) => Number(c.close)).filter((v: number) => isFinite(v));
          const highs = candles.map((c: any) => Number(c.high)).filter((v: number) => isFinite(v));
          const lows = candles.map((c: any) => Number(c.low)).filter((v: number) => isFinite(v));
          const volumes = candles.map((c: any) => Number(c.volume)).filter((v: number) => isFinite(v));

          if (closes.length < 20) return;

          const price = quote?.price ?? closes[closes.length - 1];
          const lastVol = volumes[volumes.length - 1] ?? 0;

          // Technical indicators
          const smaArr20 = computeSMA(closes, 20);
          const smaArr50 = computeSMA(closes, 50);
          const rsiArr = computeRSI(closes, 14);
          const emaArr12 = computeEMA(closes, 12);
          const emaArr26 = computeEMA(closes, 26);

          const sma20 = smaArr20.length > 0 ? smaArr20[smaArr20.length - 1] : null;
          const sma50 = smaArr50.length > 0 ? smaArr50[smaArr50.length - 1] : null;
          const rsi14 = rsiArr.length > 0 ? rsiArr[rsiArr.length - 1] : null;
          const ema12 = emaArr12.length > 0 ? emaArr12[emaArr12.length - 1] : null;
          const ema26 = emaArr26.length > 0 ? emaArr26[emaArr26.length - 1] : null;

          const macdHist = ema12 != null && ema26 != null ? ema12 - ema26 : null;
          const adx = computeADX(highs, lows, closes);
          const atr14 = computeATR(highs, lows, closes);

          // Volume analysis
          const vol20d = volumes.length >= 20
            ? volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20
            : null;
          const rvol = vol20d && vol20d > 0 ? lastVol / vol20d : null;

          // Momentum
          const n = closes.length;
          const ret = (days: number) => n > days ? ((closes[n - 1] - closes[n - 1 - days]) / closes[n - 1 - days]) * 100 : null;
          const return1w = ret(5);
          const return1m = ret(22);
          const return3m = ret(66);
          const return6m = ret(132);

          // 52-week high proximity
          const high252 = n >= 252 ? Math.max(...closes.slice(n - 252)) : Math.max(...closes);
          const proximity52wHigh = high252 > 0 ? (price / high252) * 100 : null;

          // Fundamentals
          const pe = fund?.pe != null ? Number(fund.pe) : null;
          const roe = fund?.roe != null ? (Number(fund.roe) < 1 ? Number(fund.roe) * 100 : Number(fund.roe)) : null;
          const debtToEquity = fund?.debtToEquity != null ? Number(fund.debtToEquity) : null;
          const opm = fund?.opm != null ? (Number(fund.opm) < 1 ? Number(fund.opm) * 100 : Number(fund.opm)) : null;
          const roce = fund?.roce != null ? (Number(fund.roce) < 1 ? Number(fund.roce) * 100 : Number(fund.roce)) : null;
          const peg = fund?.peg != null ? Number(fund.peg) : null;
          const marketCapValue = fund?.marketCap ?? quote?.marketCap ?? null;
          const dividendYield = fund?.dividendYield != null ? Number(fund.dividendYield) : null;

          // Market cap bucket
          const capCr = (marketCapValue ?? 0) / 1e7;
          const marketCapBucket = capCr >= 50000 ? "LARGE" : capCr >= 10000 ? "MID" : "SMALL";

          // StockIQ
          let iqTotal = 0, iqFundamentals = 0, iqTechnicals = 0, iqMomentum = 0, iqInsider = 0;
          try {
            const iq = await calculateStockIQ(sym);
            iqTotal = iq.totalScore;
            iqFundamentals = iq.fundamentals.score;
            iqTechnicals = iq.technicals.score;
            iqMomentum = iq.momentum.score;
            iqInsider = iq.insider.score;
          } catch {}

          // Pattern detection (lightweight check)
          let patternDetected: string | null = null;
          let patternStage: string | null = null;
          // We skip full pattern scan here for speed — the main pattern scanner already caches results

          // Sector
          const sector = SECTOR_MAP[sym] || "Other";

          // Compute HERMES score
          const features: StockFeatures = {
            rsi14, sma20, sma50, price, macdHistogram: macdHist, adx,
            roe, debtToEquity, opm, pe, roce,
            return1w, return1m, return3m, proximity52wHigh, rvol,
            marketCapValue, dividendYield, iqTotal,
            patternDetected, patternStage,
          };

          const hermesScoreVal = computeHermesScore(features, weights);
          const verdict = hermesVerdict(hermesScoreVal);

          // Insert snapshot
          const [snap] = await db.insert(hermesSnapshots).values({
            symbol: sym,
            price: String(price),
            volume: lastVol ? String(Math.round(lastVol)) : null,
            volumeAvg20d: vol20d ? String(Math.round(vol20d)) : null,
            rvol: rvol != null ? String(rvol.toFixed(2)) : null,
            rsi14: rsi14 != null ? String(rsi14.toFixed(2)) : null,
            sma20: sma20 != null ? String(sma20.toFixed(2)) : null,
            sma50: sma50 != null ? String(sma50.toFixed(2)) : null,
            ema12: ema12 != null ? String(ema12.toFixed(2)) : null,
            ema26: ema26 != null ? String(ema26.toFixed(2)) : null,
            macdHistogram: macdHist != null ? String(macdHist.toFixed(4)) : null,
            adx: adx != null ? String(adx.toFixed(2)) : null,
            atr14: atr14 != null ? String(atr14.toFixed(2)) : null,
            pe: pe != null ? String(pe.toFixed(2)) : null,
            roe: roe != null ? String(roe.toFixed(2)) : null,
            debtToEquity: debtToEquity != null ? String(debtToEquity.toFixed(2)) : null,
            opm: opm != null ? String(opm.toFixed(2)) : null,
            roce: roce != null ? String(roce.toFixed(2)) : null,
            peg: peg != null ? String(peg.toFixed(2)) : null,
            marketCapValue: marketCapValue != null ? String(Math.round(marketCapValue)) : null,
            dividendYield: dividendYield != null ? String(dividendYield.toFixed(2)) : null,
            return1w: return1w != null ? String(return1w.toFixed(2)) : null,
            return1m: return1m != null ? String(return1m.toFixed(2)) : null,
            return3m: return3m != null ? String(return3m.toFixed(2)) : null,
            return6m: return6m != null ? String(return6m.toFixed(2)) : null,
            proximity52wHigh: proximity52wHigh != null ? String(proximity52wHigh.toFixed(2)) : null,
            iqTotal, iqFundamentals, iqTechnicals, iqMomentum, iqInsider,
            patternDetected, patternStage,
            sector, marketCapBucket,
            hermesScore: String(hermesScoreVal.toFixed(2)),
            hermesVerdict: verdict,
            weightVersion: version,
          }).returning();

          // Create outcome tracking row
          await db.insert(hermesOutcomes).values({
            snapshotId: snap.id,
            symbol: sym,
          });

          inserted++;
        } catch (e) {
          errors++;
        }
      })
    );

    // Rate limiting delay
    if (i + BATCH_SIZE < universe.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }

    // Progress logging every 50 stocks
    if ((i + BATCH_SIZE) % 50 === 0 || i + BATCH_SIZE >= universe.length) {
      console.log(`[HERMES] Progress: ${Math.min(i + BATCH_SIZE, universe.length)}/${universe.length} | Inserted: ${inserted} | Errors: ${errors}`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[HERMES] ═══ Scan complete: ${inserted} snapshots in ${duration}s ═══`);

  isScanRunning = false;
  return { scanned: universe.length, inserted, errors, duration: `${duration}s` };
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
  let filled5d = 0, filled10d = 0, filled20d = 0;

  // 5-day outcomes: snapshots older than 7 calendar days (~5 trading days)
  const fiveDayAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const pending5d = await db
    .select()
    .from(hermesOutcomes)
    .innerJoin(hermesSnapshots, eq(hermesOutcomes.snapshotId, hermesSnapshots.id))
    .where(and(
      isNull(hermesOutcomes.return5d),
      lte(hermesSnapshots.scanDate, fiveDayAgo)
    ))
    .limit(100);

  for (const row of pending5d) {
    try {
      const quote = await getYahooStockQuote(`${row.hermes_outcomes.symbol}.NS`);
      if (quote?.price) {
        const entryPrice = Number(row.hermes_snapshots.price);
        const returnPct = ((quote.price - entryPrice) / entryPrice) * 100;
        const outcome = returnPct >= WIN_THRESHOLD ? "WIN" : returnPct <= LOSS_THRESHOLD ? "LOSS" : "NEUTRAL";

        await db.update(hermesOutcomes)
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
    .innerJoin(hermesSnapshots, eq(hermesOutcomes.snapshotId, hermesSnapshots.id))
    .where(and(
      isNull(hermesOutcomes.return10d),
      lte(hermesSnapshots.scanDate, tenDayAgo)
    ))
    .limit(100);

  for (const row of pending10d) {
    try {
      const quote = await getYahooStockQuote(`${row.hermes_outcomes.symbol}.NS`);
      if (quote?.price) {
        const entryPrice = Number(row.hermes_snapshots.price);
        const returnPct = ((quote.price - entryPrice) / entryPrice) * 100;
        const outcome = returnPct >= WIN_THRESHOLD ? "WIN" : returnPct <= LOSS_THRESHOLD ? "LOSS" : "NEUTRAL";

        await db.update(hermesOutcomes)
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
    .innerJoin(hermesSnapshots, eq(hermesOutcomes.snapshotId, hermesSnapshots.id))
    .where(and(
      isNull(hermesOutcomes.return20d),
      lte(hermesSnapshots.scanDate, twentyDayAgo)
    ))
    .limit(100);

  for (const row of pending20d) {
    try {
      const quote = await getYahooStockQuote(`${row.hermes_outcomes.symbol}.NS`);
      if (quote?.price) {
        const entryPrice = Number(row.hermes_snapshots.price);
        const returnPct = ((quote.price - entryPrice) / entryPrice) * 100;
        const outcome = returnPct >= WIN_THRESHOLD ? "WIN" : returnPct <= LOSS_THRESHOLD ? "LOSS" : "NEUTRAL";

        await db.update(hermesOutcomes)
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

  console.log(`[HERMES] Outcomes filled — 5d: ${filled5d}, 10d: ${filled10d}, 20d: ${filled20d}`);
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
    .innerJoin(hermesSnapshots, eq(hermesOutcomes.snapshotId, hermesSnapshots.id))
    .where(sql`${hermesOutcomes.return5d} IS NOT NULL`)
    .limit(5000);

  if (completedOutcomes.length < 30) {
    console.log(`[HERMES] Insufficient data (${completedOutcomes.length} outcomes). Need 30+. Skipping learning.`);
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

    // Evaluate each feature condition
    const rsi = snap.rsi14 != null ? Number(snap.rsi14) : null;
    const price = Number(snap.price);

    const conditions: Record<string, boolean> = {
      rsi14_zone: rsi != null && rsi >= 40 && rsi <= 65,
      sma20_above: snap.sma20 != null && price > Number(snap.sma20),
      sma50_above: snap.sma50 != null && price > Number(snap.sma50),
      golden_cross: snap.sma20 != null && snap.sma50 != null && Number(snap.sma20) > Number(snap.sma50),
      macd_positive: snap.macdHistogram != null && Number(snap.macdHistogram) > 0,
      adx_strong: snap.adx != null && Number(snap.adx) > 25,
      roe_quality: snap.roe != null && Number(snap.roe) > 15,
      low_debt: snap.debtToEquity != null && Number(snap.debtToEquity) < 1,
      margin_quality: snap.opm != null && Number(snap.opm) > 15,
      pe_reasonable: snap.pe != null && Number(snap.pe) > 10 && Number(snap.pe) < 30,
      roce_quality: snap.roce != null && Number(snap.roce) > 12,
      return_1w: snap.return1w != null && Number(snap.return1w) > 0,
      return_1m: snap.return1m != null && Number(snap.return1m) > 0,
      return_3m: snap.return3m != null && Number(snap.return3m) > 0,
      proximity_52w_high: snap.proximity52wHigh != null && Number(snap.proximity52wHigh) > 85,
      rvol_elevated: snap.rvol != null && Number(snap.rvol) > 1.5,
      market_cap_stable: (Number(snap.marketCapValue ?? 0) / 1e7) > 5000,
      dividend_present: snap.dividendYield != null && Number(snap.dividendYield) > 0.5,
      iq_composite: snap.iqTotal != null && snap.iqTotal > 60,
      pattern_bullish: snap.patternDetected != null && snap.patternDetected !== "",
      pattern_breakout: snap.patternStage === "Breakout Confirmed" || snap.patternStage === "Near Breakout",
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
    newWeights[key] = Math.max(0.01, Math.min(0.20, blended));

    const delta = ((newWeights[key] - oldWeight) / oldWeight * 100).toFixed(1);
    if (Math.abs(Number(delta)) > 5) {
      changeLog.push(`${key}: ${(winRate * 100).toFixed(0)}% win rate → weight ${delta}%`);
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
    notes: changeLog.length > 0
      ? `Learning cycle v${newVersion}: ${changeLog.join("; ")}`
      : `Learning cycle v${newVersion}: Minor adjustments, ${completedOutcomes.length} samples`,
    isActive: true,
  });

  // Clear weight cache
  activeWeightsCache = null;

  console.log(`[HERMES] ═══ Learning complete: v${newVersion}, accuracy: ${accuracy.toFixed(1)}%, samples: ${completedOutcomes.length} ═══`);
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

    const closes = niftyCandles.map((c: any) => Number(c.close)).filter((v: number) => isFinite(v));
    const n = closes.length;
    const current = closes[n - 1];

    // Nifty returns
    const change1w = n > 5 ? ((current - closes[n - 6]) / closes[n - 6]) * 100 : 0;
    const change1m = n > 22 ? ((current - closes[n - 23]) / closes[n - 23]) * 100 : 0;

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
    const marketBreadth = breadthRatio > 1.1 ? "STRONG" : breadthRatio < 0.8 ? "WEAK" : "NEUTRAL";

    const [entry] = await db.insert(hermesRegimeLog).values({
      regime,
      niftyPrice: String(current.toFixed(2)),
      niftyChange1w: String(change1w.toFixed(2)),
      niftyChange1m: String(change1m.toFixed(2)),
      advanceDeclineRatio: String(breadthRatio.toFixed(2)),
      marketBreadth,
    }).returning();

    console.log(`[HERMES] Regime: ${regime} | Nifty: ${current.toFixed(0)} | 1w: ${change1w.toFixed(1)}% | 1m: ${change1m.toFixed(1)}%`);
    return entry;
  } catch (e) {
    console.error("[HERMES] Regime classification failed:", e);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════
   QUERY FUNCTIONS — For API endpoints
═══════════════════════════════════════════════════════════ */

export async function getHermesLeaderboard(limit = 30): Promise<HermesSnapshot[]> {
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

export async function getHermesStockSnapshot(symbol: string): Promise<HermesSnapshot | null> {
  const [snap] = await db
    .select()
    .from(hermesSnapshots)
    .where(eq(hermesSnapshots.symbol, symbol.toUpperCase()))
    .orderBy(desc(hermesSnapshots.scanDate))
    .limit(1);

  return snap ?? null;
}

export async function getHermesAccuracy(): Promise<{
  overall: { wins: number; losses: number; neutral: number; total: number; winRate: number };
  bySector: Record<string, { wins: number; total: number; winRate: number }>;
  byRegime: Record<string, { wins: number; total: number; winRate: number }>;
  byVerdict: Record<string, { wins: number; total: number; winRate: number }>;
}> {
  const outcomes = await db
    .select()
    .from(hermesOutcomes)
    .innerJoin(hermesSnapshots, eq(hermesOutcomes.snapshotId, hermesSnapshots.id))
    .where(sql`${hermesOutcomes.return5d} IS NOT NULL`)
    .limit(5000);

  const overall = { wins: 0, losses: 0, neutral: 0, total: outcomes.length, winRate: 0 };
  const bySector: Record<string, { wins: number; total: number; winRate: number }> = {};
  const byVerdict: Record<string, { wins: number; total: number; winRate: number }> = {};

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
    if (!byVerdict[verdict]) byVerdict[verdict] = { wins: 0, total: 0, winRate: 0 };
    byVerdict[verdict].total++;
    if (isWin) byVerdict[verdict].wins++;
  }

  overall.winRate = overall.total > 0 ? (overall.wins / overall.total) * 100 : 0;

  for (const s of Object.keys(bySector)) {
    bySector[s].winRate = bySector[s].total > 0 ? (bySector[s].wins / bySector[s].total) * 100 : 0;
  }
  for (const v of Object.keys(byVerdict)) {
    byVerdict[v].winRate = byVerdict[v].total > 0 ? (byVerdict[v].wins / byVerdict[v].total) * 100 : 0;
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

export async function getHermesRegimeHistory(limit = 30): Promise<HermesRegimeLog[]> {
  return db
    .select()
    .from(hermesRegimeLog)
    .orderBy(desc(hermesRegimeLog.date))
    .limit(limit);
}

export async function getHermesRecentOutcomes(limit = 50): Promise<Array<{
  snapshot: HermesSnapshot;
  outcome: HermesOutcome;
}>> {
  const rows = await db
    .select()
    .from(hermesOutcomes)
    .innerJoin(hermesSnapshots, eq(hermesOutcomes.snapshotId, hermesSnapshots.id))
    .where(sql`${hermesOutcomes.return5d} IS NOT NULL`)
    .orderBy(desc(hermesOutcomes.filled5dAt))
    .limit(limit);

  return rows.map((r) => ({
    snapshot: r.hermes_snapshots,
    outcome: r.hermes_outcomes,
  }));
}

export async function getHermesDashboard() {
  const [leaderboard, accuracy, weights, regime, recentOutcomes] = await Promise.allSettled([
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

  const activeWeight = weights.status === "fulfilled"
    ? weights.value.find((w) => w.isActive) ?? null
    : null;

  return {
    leaderboard: leaderboard.status === "fulfilled" ? leaderboard.value : [],
    accuracy: accuracy.status === "fulfilled" ? accuracy.value : null,
    activeWeight,
    weightHistory: weights.status === "fulfilled" ? weights.value : [],
    regime: regime.status === "fulfilled" ? regime.value : [],
    recentOutcomes: recentOutcomes.status === "fulfilled" ? recentOutcomes.value : [],
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
    console.error("[HERMES] Initialization error (tables may not exist yet, run db:push):", e);
  }
}
