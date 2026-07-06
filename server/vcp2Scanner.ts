/**
 * VCP2 SCANNER — Relaxed Volatility Contraction Pattern Scanner
 * ─────────────────────────────────────────────────────────────────────────────
 * 8-filter VCP screen designed to catch stocks at earlier stages of contraction.
 * Relaxed compared to VCP1's strict 12-filter Minervini gate.
 *
 * VCP2 FILTER STACK (8 conditions):
 *  1. ATR(14) < ATR(14) 10 days ago           — Volatility contracting
 *  2. ATR(14) / Daily Close < 0.08            — Low volatility relative to price
 *  3. Daily Close > 52W High × 0.75           — Within 25% of 52-week high
 *  4. EMA(50) > EMA(150)                      — 50 EMA above 150 EMA
 *  5. EMA(150) > EMA(200)                     — 150 EMA above 200 EMA
 *  6. Daily Close > EMA(50)                   — Price above 50 EMA
 *  7. Daily Close > ₹10                       — Minimum price filter
 *  8. Daily Close × Daily Volume > 10,00,000  — Turnover above ₹10 Lakh
 */

import {
  getYahooStockQuote,
  getYahooHistory,
  computeEMA,
  type SwingScanResult,
} from "./stockApi";
import { NSE_UNIQUE, NIFTY_50, ETFS } from "./nseUniverse";

// ─── Constants ────────────────────────────────────────────────────────────────
const BATCH_SIZE = 15;
const BATCH_DELAY_MS = 300;

// ─── ATR helper (not exported from stockApi, so we include our own) ──────────
function computeATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
): (number | null)[] {
  const out: (number | null)[] = [null];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    );
    out.push(tr);
  }
  const trs = out.map((v) => v ?? 0);
  const atr: (number | null)[] = [];
  let avg: number | null = null;
  for (let i = 0; i < trs.length; i++) {
    if (i + 1 < period) {
      atr.push(null);
      continue;
    }
    if (avg === null) {
      avg =
        trs.slice(i + 1 - period, i + 1).reduce((a, b) => a + b, 0) / period;
    } else {
      avg = (avg * (period - 1) + trs[i]) / period;
    }
    atr.push(avg);
  }
  return atr;
}

/**
 * Analyze a single stock against the 8 VCP2 filters.
 * Returns a SwingScanResult or null if it fails any filter.
 */
async function analyzeStockVcp2(
  sym: string,
): Promise<SwingScanResult | null> {
  try {
    const yahooSym = sym.includes(".") ? sym : `${sym}.NS`;
    const candles = await getYahooHistory(yahooSym, "1y", "1d");
    // Require at least 60 candles to get meaningful EMA50 and ATR
    if (!candles || candles.length < 60) return null;

    const closes = candles.map((c: any) => c.close as number);
    const highs = candles.map((c: any) => c.high as number);
    const lows = candles.map((c: any) => c.low as number);
    const vols = candles.map((c: any) => c.volume as number);
    const n = closes.length;
    const last = closes[n - 1];
    const prev = closes[n - 2];

    // ── FILTER 7: Daily Close > ₹10 ──────────────────────────────
    if (last <= 10) return null;

    // ── FILTER 8: Daily Close × Daily Volume > 10,00,000 ─────────
    const todayVol = vols[n - 1] || 0;
    const turnover = last * todayVol;
    if (turnover <= 1_000_000) return null;

    // ── EMA STACK ─────────────────────────────────────────────────
    const ema50Arr = computeEMA(closes, 50);
    const ema150Arr = computeEMA(closes, 150);
    const ema200Arr = computeEMA(closes, 200);

    const e50 = ema50Arr[n - 1] ?? 0;
    const e150 = ema150Arr[n - 1] ?? 0;
    const e200 = ema200Arr[n - 1] ?? 0;

    // ── FILTER 6: Daily Close > EMA(50) ──────────────────────────
    if (last <= e50) return null;

    // ── FILTER 4: EMA(50) > EMA(150) ─────────────────────────────
    if (e50 <= e150) return null;

    // ── FILTER 5: EMA(150) > EMA(200) ────────────────────────────
    if (e150 <= e200) return null;

    // ── ATR (Volatility Contraction) ─────────────────────────────
    const atrArr = computeATR(highs, lows, closes, 14);
    const currentATR = atrArr[n - 1];
    const atr10ago = atrArr[n - 11];
    if (currentATR == null || atr10ago == null) return null;

    // ── FILTER 1: ATR(14) < ATR(14) 10 days ago ──────────────────
    if (currentATR >= atr10ago) return null;

    // ── FILTER 2: ATR(14) / Daily Close < 0.08 ───────────────────
    const tightCoilRatio = currentATR / last;
    if (tightCoilRatio >= 0.08) return null;

    // ── 52-WEEK HIGH ─────────────────────────────────────────────
    // Chartink uses Weekly Max(52, Weekly Close) which evaluates the closing prices.
    const lookback52 = Math.min(n, 252);
    const weekHigh52 = Math.max(...closes.slice(n - lookback52));

    // ── FILTER 3: Daily Close > 52W High × 0.75 ──────────────────
    if (last <= weekHigh52 * 0.75) return null;

    // ══════ PASSED ALL 8 VCP2 FILTERS ════════════════════════════

    // Compute additional metrics for the UI
    const ema9Arr = computeEMA(closes, 9);
    const ema20Arr = computeEMA(closes, 20);
    const e9 = ema9Arr[n - 1] ?? last;
    const e20 = ema20Arr[n - 1] ?? last;

    const dailyChange = prev > 0 ? ((last - prev) / prev) * 100 : 0;
    const nearHighPct = weekHigh52 > 0 ? (last / weekHigh52) * 100 : 0;
    const atrCompression = atr10ago > 0 ? Math.min(1, 1 - currentATR / atr10ago) : 0;

    // Volume ratio (current vol / 20d avg)
    const volSlice = vols.slice(Math.max(0, n - 21), n - 1);
    const avg20vol = volSlice.length > 0 ? volSlice.reduce((a, b) => a + b, 0) / volSlice.length : 1;
    const volumeRatio = avg20vol > 0 ? todayVol / avg20vol : 1;

    // 6-month relative strength
    const idx6m = Math.max(0, n - 127);
    const rsScore = closes[idx6m] > 0 ? ((last / closes[idx6m]) - 1) * 100 : 0;

    // VCP2 quality score (0-100), weighted for the 8 conditions
    const vcpScore = Math.min(
      100,
      Math.round(
        Math.min(25, atrCompression * 50) + // ATR compression
        Math.min(20, Math.max(0, (0.08 - tightCoilRatio) / 0.08) * 20) + // tight coil
        Math.min(20, Math.max(0, nearHighPct - 75) / 25 * 20) + // near 52w high
        Math.min(15, // EMA alignment
          (last > e50 ? 5 : 0) +
          (e50 > e150 ? 5 : 0) +
          (e150 > e200 ? 5 : 0)) +
        Math.min(10, Math.max(0, 1 - volumeRatio) * 20) + // volume bonus
        Math.min(10, Math.max(0, rsScore) / 15) // RS kicker
      ),
    );

    // Fundamental proxy score
    const weekLow52 = Math.min(...lows.slice(n - lookback52));
    const fundamentalScore = Math.min(
      100,
      Math.round(
        Math.min(40, Math.max(0, rsScore) * 0.5) +
        Math.min(20, Math.log10(Math.max(1, turnover / 100_000)) * 6) +
        Math.min(20, (1 - Math.min(1, tightCoilRatio / 0.08)) * 20) +
        Math.min(20, (nearHighPct - 75) * 0.8),
      ),
    );

    const cleanSym = sym.replace(".NS", "").replace(".BO", "");
    const atrPct = ((1 - currentATR / atr10ago) * 100).toFixed(0);

    return {
      sr: 0,
      stockName: cleanSym,
      symbol: sym,
      links: "P&F | F.A",
      changePercent: Number(dailyChange.toFixed(2)),
      price: Number(last.toFixed(2)),
      volume: todayVol.toLocaleString("en-IN"),
      sector: "",
      setup: `VCP2: ATR↓${atrPct}% · ${nearHighPct.toFixed(0)}% of 52WH · Close>EMA50>150>200`,
      atr: Number(currentATR.toFixed(2)),
      ema9: Number(e9.toFixed(2)),
      ema20: Number(e20.toFixed(2)),
      ema50: Number(e50.toFixed(2)),
      ema150: Number(e150.toFixed(2)),
      ema200: Number(e200.toFixed(2)),
      weekHigh52: Number(weekHigh52.toFixed(2)),
      turnover: Number(turnover.toFixed(0)),
      vcpScore,
      fundamentalScore,
      atrCompression: Number(atrCompression.toFixed(3)),
      volumeRatio: Number(volumeRatio.toFixed(3)),
      nearHighPct: Number(nearHighPct.toFixed(1)),
      rsScore: Number(rsScore.toFixed(1)),
    };
  } catch {
    return null;
  }
}

/**
 * Run the full VCP2 scanner across the NSE/BSE universe.
 * Excludes Nifty 50 and ETFs, same as VCP1.
 */
export async function runVcp2Scanner(): Promise<SwingScanResult[]> {
  const baseList = NSE_UNIQUE.filter((sym) => {
    const clean = sym.replace(".NS", "").replace(".BO", "");
    if (NIFTY_50.has(clean)) return false;
    if (ETFS.has(clean)) return false;
    return true;
  });

  const scanList: string[] = [];
  for (const sym of baseList) {
    scanList.push(`${sym}.NS`);
    scanList.push(`${sym}.BO`);
  }

  console.log(
    `[VCP2] Scanning ${scanList.length} stocks with 8 relaxed VCP filters...`,
  );

  const results: SwingScanResult[] = [];
  let scanned = 0;

  for (let b = 0; b < scanList.length; b += BATCH_SIZE) {
    const batch = scanList.slice(b, b + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(analyzeStockVcp2));

    for (const r of batchResults) {
      if (r) results.push(r);
    }

    scanned += batch.length;
    if (scanned % 100 === 0 || b + BATCH_SIZE >= scanList.length) {
      console.log(
        `  [VCP2] Scanned ${scanned}/${scanList.length} → ${results.length} matches so far`,
      );
    }

    if (b + BATCH_SIZE < scanList.length) {
      await new Promise((res) => setTimeout(res, BATCH_DELAY_MS));
    }
  }

  // Sort by VCP score descending
  results.sort((a, b) => (b.vcpScore ?? 0) - (a.vcpScore ?? 0));
  results.forEach((r, i) => {
    r.sr = i + 1;
  });

  console.log(`[VCP2] ═══ Scan complete: ${results.length} stocks passed all 8 VCP2 filters ═══`);
  return results;
}
