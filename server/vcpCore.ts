/**
 * VCP CORE — Shared Volatility Contraction Pattern feature engine.
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for "how VCP-like is this stock right now" used by:
 *   - stockApi.ts swing scanner (hard 12-filter gate)
 *   - hermesEngine.ts (continuous graded score across the full universe)
 *   - fuguEngine.ts (technical / pattern / candlestick agent nodes)
 *
 * Design goal: find setups where price is expected to swing 5-10% within
 * ~1-2 days of a breakout from a tight base (not the breakout day itself).
 * Entry/SL/target are calibrated so the reward sits inside that 5-10% band.
 */

export interface VcpFeatures {
  price: number;
  atr14: number;
  atrCompression: number;     // 0-1, how much ATR has fallen vs 10d ago
  progressiveContraction: boolean; // ATR(5d ago) < ATR(10d ago) too — multi-stage tightening
  tightCoilRatio: number;     // ATR / price (lower = tighter coil)
  volumeRatio: number;        // today vol / 20d avg vol (lower = better dry-up)
  contractionCount: number;   // how many of last 3 five-day windows show falling ATR (0-3)
  nearHighPct: number;        // close / 52w high * 100
  rangeQuality: number;       // 52wHigh / 52wLow ratio (>1.2 = meaningful range)
  emaStackScore: number;      // 0-1, fraction of stage-2 EMA stack conditions satisfied
  ema50Rising: boolean;
  dailyChangePct: number;
  turnover: number;
  rsScore: number;            // 6-month relative performance %
  passesAllFilters: boolean;  // true if it would pass the strict 12-filter swing gate
  baseLow: number;            // lowest close over the recent contraction window (for SL)
}

export interface VcpTrade {
  entry: number;
  stopLoss: number;
  target: number;
  riskPct: number;
  targetPct: number;
  riskRewardRatio: number;
}

const CONTRACTION_WINDOW = 10; // days used to find the base low for stop-loss

/** Compute EMA series (same math used across the app) */
function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function atrSeries(highs: number[], lows: number[], closes: number[], period = 14): (number | null)[] {
  const n = highs.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n < period + 1) return out;
  const trueRanges: number[] = [];
  for (let i = 1; i < n; i++) {
    trueRanges.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period] = atr;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    out[i + 1] = atr;
  }
  return out;
}

/**
 * Compute a full graded VCP feature set from OHLCV candles.
 * Returns null only if there isn't enough history (< 60 candles) to compute
 * anything meaningful — otherwise always returns a graded (possibly weak) result.
 */
export function computeVcpFeatures(candles: Array<{ open?: number; high: number; low: number; close: number; volume: number }>): VcpFeatures | null {
  if (!candles || candles.length < 60) return null;

  const closes = candles.map((c) => Number(c.close)).filter((v) => isFinite(v));
  const highs = candles.map((c) => Number(c.high)).filter((v) => isFinite(v));
  const lows = candles.map((c) => Number(c.low)).filter((v) => isFinite(v));
  const vols = candles.map((c) => Number(c.volume) || 0);
  const n = closes.length;
  if (n < 60 || highs.length < 60 || lows.length < 60) return null;

  const last = closes[n - 1];
  const prev = closes[n - 2] ?? last;
  const dailyChangePct = prev > 0 ? ((last - prev) / prev) * 100 : 0;

  // EMA stack (stage-2 template) — gracefully degrade if <200 candles by using
  // whatever long EMAs are available.
  const hasLongHistory = n >= 210;
  const e9Arr = ema(closes, 9);
  const e20Arr = ema(closes, 20);
  const e50Arr = ema(closes, 50);
  const e150Arr = hasLongHistory ? ema(closes, 150) : new Array(n).fill(null);
  const e200Arr = hasLongHistory ? ema(closes, 200) : new Array(n).fill(null);

  const e9 = e9Arr[n - 1];
  const e20 = e20Arr[n - 1];
  const e50 = e50Arr[n - 1];
  const e150 = e150Arr[n - 1];
  const e200 = e200Arr[n - 1];

  let stackHits = 0;
  let stackTotal = 0;
  const check = (cond: boolean | null) => {
    if (cond === null) return;
    stackTotal++;
    if (cond) stackHits++;
  };
  check(e9 != null && last > e9);
  check(e9 != null && e20 != null ? e9 > e20 : null);
  check(e20 != null && e50 != null ? e20 > e50 : null);
  check(e50 != null ? last > e50 : null);
  check(e50 != null && e150 != null ? e50 > e150 : null);
  check(e150 != null && e200 != null ? e150 > e200 : null);
  const emaStackScore = stackTotal > 0 ? stackHits / stackTotal : 0;

  const e50_5ago = e50Arr[n - 6];
  const ema50Rising = e50 != null && e50_5ago != null && e50 > e50_5ago;

  // ATR / volatility contraction
  const atrArr = atrSeries(highs, lows, closes, 14);
  const currentATR = atrArr[n - 1] ?? 0;
  const atr5ago = atrArr[n - 6] ?? currentATR;
  const atr10ago = atrArr[n - 11] ?? currentATR;
  const atr15ago = atrArr[n - 16] ?? atr10ago;

  const atrCompression = atr10ago > 0 ? Math.min(1, Math.max(0, 1 - currentATR / atr10ago)) : 0;
  const progressiveContraction = atr5ago < atr10ago;
  const tightCoilRatio = last > 0 ? currentATR / last : 1;

  // Count how many of the last 3 five-day windows show a falling ATR (progressive tightening)
  let contractionCount = 0;
  if (currentATR < atr5ago) contractionCount++;
  if (atr5ago < atr10ago) contractionCount++;
  if (atr10ago < atr15ago) contractionCount++;

  // Volume dry-up
  const todayVol = vols[n - 1] || 0;
  const avg20vol = vols.slice(Math.max(0, n - 21), n - 1).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(20, n - 1));
  const volumeRatio = avg20vol > 0 ? todayVol / avg20vol : 1;

  // 52-week high proximity & range quality
  const lookback52 = Math.min(n, 252);
  const weekHigh52 = Math.max(...highs.slice(n - lookback52));
  const weekLow52 = Math.min(...lows.slice(n - lookback52));
  const nearHighPct = weekHigh52 > 0 ? (last / weekHigh52) * 100 : 0;
  const rangeQuality = weekLow52 > 0 ? weekHigh52 / weekLow52 : 1;

  // Relative strength (6-month)
  const idx6m = Math.max(0, n - 127);
  const rsScore = closes[idx6m] > 0 ? ((last / closes[idx6m]) - 1) * 100 : 0;

  const turnover = last * todayVol;

  // Base low for stop-loss placement — lowest close over recent contraction window
  const baseLow = Math.min(...closes.slice(Math.max(0, n - CONTRACTION_WINDOW)));

  // Strict 12-filter gate (same as swing scanner) — used for BUY/verdict gating
  const passesAllFilters =
    last > 20 &&
    dailyChangePct >= -1 && dailyChangePct <= 4 &&
    turnover >= 2_000_000 &&
    e9 != null && e20 != null && e50 != null && e150 != null && e200 != null &&
    last > e50! && e50! > e150! && e150! > e200! &&
    last > e9! && e9! > e20! && e20! > e50! &&
    ema50Rising &&
    currentATR < atr10ago &&
    atr5ago < atr10ago &&
    tightCoilRatio < 0.06 &&
    last >= weekHigh52 * 0.85 &&
    rangeQuality >= 1.20 &&
    volumeRatio <= 0.85;

  return {
    price: Number(last.toFixed(2)),
    atr14: Number(currentATR.toFixed(2)),
    atrCompression: Number(atrCompression.toFixed(3)),
    progressiveContraction,
    tightCoilRatio: Number(tightCoilRatio.toFixed(4)),
    volumeRatio: Number(volumeRatio.toFixed(3)),
    contractionCount,
    nearHighPct: Number(nearHighPct.toFixed(1)),
    rangeQuality: Number(rangeQuality.toFixed(3)),
    emaStackScore: Number(emaStackScore.toFixed(3)),
    ema50Rising,
    dailyChangePct: Number(dailyChangePct.toFixed(2)),
    turnover: Number(turnover.toFixed(0)),
    rsScore: Number(rsScore.toFixed(1)),
    passesAllFilters,
    baseLow: Number(baseLow.toFixed(2)),
  };
}

/**
 * Composite 0-100 VCP quality score from graded features. Works continuously
 * across the whole universe (unlike the strict pass/fail gate), which is what
 * HERMES/FUGU need to learn feature weights from real outcomes.
 */
export function computeVcpScore(f: VcpFeatures): number {
  const score =
    Math.min(22, f.atrCompression * 22) +                                   // ATR compression
    Math.min(10, f.contractionCount * 3.3) +                                // progressive tightening stages
    Math.min(12, Math.max(0, (0.06 - f.tightCoilRatio) / 0.06) * 12) +      // tight coil
    Math.min(18, Math.max(0, 1 - f.volumeRatio) * 32) +                     // volume dry-up
    Math.min(16, Math.max(0, (f.nearHighPct - 80) / 20) * 16) +             // near 52w high
    Math.min(14, f.emaStackScore * 14) +                                    // ema stack alignment
    (f.ema50Rising ? 4 : 0) +                                               // ema50 rising bonus
    Math.min(4, Math.max(0, f.rsScore) / 10);                               // relative strength kicker

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Entry / stop-loss / target calibrated so reward lands in the 5-10% band the
 * user wants to hit within ~1-2 days of a breakout, with a sane risk:reward.
 */
export function computeVcpEntrySLTarget(f: VcpFeatures): VcpTrade {
  const entry = f.price;

  // Stop below the tightest recent base, with a small buffer, but never
  // further than 6% away (keeps risk tight the way a VCP breakout demands).
  const rawStop = Math.min(f.baseLow * 0.99, entry * 0.97);
  const stopLoss = Math.max(rawStop, entry * 0.94);
  const riskPct = Math.max(0.005, (entry - stopLoss) / entry);

  // Target sized off risk (2-2.5R) but clamped into the 5-10% band.
  const targetPct = Math.min(0.10, Math.max(0.05, riskPct * 2.2));
  const target = entry * (1 + targetPct);
  const riskRewardRatio = riskPct > 0 ? targetPct / riskPct : 0;

  return {
    entry: Number(entry.toFixed(2)),
    stopLoss: Number(stopLoss.toFixed(2)),
    target: Number(target.toFixed(2)),
    riskPct: Number((riskPct * 100).toFixed(2)),
    targetPct: Number((targetPct * 100).toFixed(2)),
    riskRewardRatio: Number(riskRewardRatio.toFixed(2)),
  };
}

/** Human-readable one-line setup description for journals/UI. */
export function describeVcpSetup(f: VcpFeatures): string {
  const atrPct = (f.atrCompression * 100).toFixed(0);
  const volDrop = ((1 - f.volumeRatio) * 100).toFixed(0);
  return `VCP: ATR↓${atrPct}% · Vol↓${volDrop}% · ${f.nearHighPct.toFixed(0)}% of 52WH · ${f.contractionCount}/3 contraction stages`;
}
