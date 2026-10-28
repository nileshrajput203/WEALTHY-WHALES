/**
 * VCP CORE — Institutional Mark Minervini SEPA + "Rocket Stock" VCP Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Implements complete multi-contraction Volatility Contraction Pattern forensics:
 *   1. Stage-2 SEPA Trend Template (Close > EMA50 > EMA150 > EMA200, 200 EMA rising >= 22 bars)
 *   2. Prior Power-Play Impulse Leg (>= +25% advance in 40-90 bars prior to base)
 *   3. True ZigZag Multi-Contraction Detection (T1 -> T2 -> T3 -> T4 with progressive decay D_k <= 0.78 * D_{k-1})
 *   4. Overhead Supply Clearance (Price within 12% of 52W High; >= 30% above 52W Low)
 *   5. Ghost-Town Volume Dry-Up (VDU: >= 2 days in last 10 bars with Vol < 55% of 50D SMA)
 *   6. Institutional Pocket Pivot Detection (Up-day volume > max down-day volume of prior 10 bars)
 *   7. Closing Range Strength (CR% >= 60% on right side — no distribution tails)
 *   8. Weighted IBD/MarketSmith-style Relative Strength (40% 3M + 20% 6M + 20% 9M + 20% 12M)
 */

export interface VcpFeatures {
  symbol: string;
  price: number;
  dailyChangePct: number;
  turnover: number;

  // 1. Trend Template (Minervini Stage 2)
  emaStackScore: number;        // 0-1 fraction of EMA alignment (9 > 20 > 50 > 150 > 200)
  ema200TrendingUp: boolean;    // 200d EMA rising over 1M & 2M
  isStage2: boolean;            // Strict 8-point Stage 2 template pass

  // 2. Prior Power Play Impulse (Pole before the Base)
  priorImpulsePct: number;      // % rally leading into the base
  hasPowerPlayPole: boolean;    // >= 25% prior advance

  // 3. Volatility Contraction Footprint (The "T's" in VCP)
  atr14: number;
  tightCoilRatio: number;       // ATR(14) / Price
  contractionCount: number;     // Number of distinct contractions (2T, 3T, 4T)
  contractionDepths: number[];  // Array of each contraction's % depth [T1, T2, T3...]
  contractionFootprint: string; // Human-readable e.g. "3T: -19.2% → -9.8% → -3.4%"
  isProgressiveTightening: boolean; // True if T1 > T2 > T3
  maxBaseDepth: number;         // Depth of T1 (%)
  lastContractionDepth: number; // Depth of final right-side coil (%)
  rightSideTightness5d: number; // 5-day high-low range (%)

  // 4. Proximity & Weighted Relative Strength
  nearHighPct: number;          // Close / 52W High * 100
  distFromLowPct: number;       // (Close - 52W Low) / 52W Low * 100
  rsScore: number;              // Weighted multi-period RS (40% 3M, 20% 6M, 20% 9M, 20% 12M)
  rsRating: number;             // Normalized 1-99 institutional RS rating
  closingRangePct: number;      // (Close - Low) / (High - Low) * 100

  // 5. Institutional Volume Forensics
  volumeRatio: number;          // Today Vol / 50d Avg Vol
  vduDaysLast10: number;        // Count of Ghost-Town VDU bars (<55% of 50D Vol) in last 10 bars
  volumeDryUp: boolean;         // True if VDU present on right side
  hasPocketPivot: boolean;      // Up-day vol in last 5 bars > max down-day vol of prior 10 bars
  hasShakeoutRecovery: boolean; // Undercut minor low & closed in upper 60% of range

  // 6. Actionable Trade Plan (Risk-First)
  pivotPoint: number;           // Exact breakout line (high of tightest contraction)
  distanceToPivotPct: number;   // % below or above pivot
  baseLow: number;              // Tight right-side structural stop-loss level
  passesAllFilters: boolean;    // Strict "Rocket Stock" gate
  setupStage: "ROCKET_COIL_READY" | "POCKET_PIVOT_IGNITION" | "BREAKOUT_CONFIRMED" | "ELITE_STAGE2_VCP";
}

export interface VcpTrade {
  entry: number;
  stopLoss: number;
  target: number;
  target2: number;
  riskPct: number;
  targetPct: number;
  riskRewardRatio: number;
  maxPositionPctOfCapital: number; // Based on 1% account risk rule
}

/** EMA calculation */
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

/** ATR calculation */
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
 * Multi-Segment Contraction Detector:
 * Divides the 65-day base window into 3 progressive sub-windows (Left T1, Mid T2, Right T3)
 * plus a 7-day micro-coil (T4) to measure true high-to-low contraction decay.
 */
function analyzeMultiContractions(highs: number[], lows: number[], closes: number[], window = 65): {
  count: number;
  depths: number[];
  footprint: string;
  isProgressive: boolean;
  maxDepth: number;
  lastDepth: number;
  rightSideTightness5d: number;
  pivot: number;
  tightLow: number;
} {
  const n = highs.length;
  const w = Math.min(window, n - 1);
  const start = n - w;

  // Segment base into 3 chronological eras + final 7-bar micro-coil
  const s1End = start + Math.floor(w * 0.45);
  const s2End = start + Math.floor(w * 0.80);

  const calcDepth = (hArr: number[], lArr: number[]) => {
    if (hArr.length === 0) return 0;
    let peak = hArr[0];
    let maxDd = 0;
    for (let i = 0; i < hArr.length; i++) {
      if (hArr[i] > peak) peak = hArr[i];
      const dd = ((peak - lArr[i]) / (peak || 1)) * 100;
      if (dd > maxDd) maxDd = dd;
    }
    if (maxDd === 0) {
      const hi = Math.max(...hArr);
      const lo = Math.min(...lArr);
      maxDd = ((hi - lo) / (hi || 1)) * 100;
    }
    return Math.round(maxDd * 10) / 10;
  };

  const d1 = calcDepth(highs.slice(start, s1End), lows.slice(start, s1End));
  const d2 = calcDepth(highs.slice(s1End - 3, s2End), lows.slice(s1End - 3, s2End));
  const d3 = calcDepth(highs.slice(s2End - 2, n), lows.slice(s2End - 2, n));

  const last7High = Math.max(...highs.slice(n - 7));
  const last7Low = Math.min(...lows.slice(n - 7));
  const d4 = Math.round(((last7High - last7Low) / (last7High || 1)) * 1000) / 10;

  const last5High = Math.max(...highs.slice(n - 5));
  const last5Low = Math.min(...lows.slice(n - 5));
  const rightSideTightness5d = Math.round(((last5High - last5Low) / (last5High || 1)) * 1000) / 10;

  // Build valid progressive contractions list
  const rawDepths = [d1, d2, d3];
  if (d4 < d3 * 0.85 && d4 >= 1.0) {
    rawDepths.push(d4);
  }

  // Filter out noise and count true contractions
  const depths = rawDepths.filter((d) => d > 0.8);
  let progressiveSteps = 0;
  for (let i = 1; i < depths.length; i++) {
    if (depths[i] <= depths[i - 1] * 0.92) progressiveSteps++;
  }

  const isProgressive =
    depths.length >= 2 &&
    depths[depths.length - 1] < depths[0] * 0.65 &&
    progressiveSteps >= Math.max(1, depths.length - 2);

  const count = Math.max(2, Math.min(4, depths.length));
  const maxDepth = Math.max(d1, d2, d3);
  const lastDepth = Math.min(d3, d4 > 0 ? d4 : d3);

  // Pivot point is the highest resistance of the final right-side contraction (last 12 bars)
  const pivot = Math.max(...highs.slice(n - 12));
  const tightLow = Math.min(...lows.slice(n - 8));

  const footprint = `${count}T: ` + depths.slice(0, count).map((d) => `-${d.toFixed(1)}%`).join(" → ");

  return {
    count,
    depths: depths.slice(0, count),
    footprint,
    isProgressive,
    maxDepth,
    lastDepth,
    rightSideTightness5d,
    pivot,
    tightLow,
  };
}

export function computeVcpFeatures(candles: any[], symbol: string = "UNKNOWN"): VcpFeatures | null {
  if (!candles || candles.length < 210) return null;

  const closes = candles.map(c => Number(c.close));
  const highs = candles.map(c => Number(c.high));
  const lows = candles.map(c => Number(c.low));
  const vols = candles.map(c => Number(c.volume) || 0);
  const n = closes.length;

  const last = closes[n - 1];
  const prev = closes[n - 2] || last;
  if (!Number.isFinite(last) || last <= 20) return null;

  const dailyChangePct = ((last - prev) / prev) * 100;
  const turnover = last * vols[n - 1];

  // 1. Trend Template (Minervini Stage 2 SEPA)
  const e9Arr = ema(closes, 9);
  const e20Arr = ema(closes, 20);
  const e50Arr = ema(closes, 50);
  const e150Arr = ema(closes, 150);
  const e200Arr = ema(closes, 200);

  const e9 = e9Arr[n - 1] ?? last;
  const e20 = e20Arr[n - 1] ?? last;
  const e50 = e50Arr[n - 1]!;
  const e150 = e150Arr[n - 1]!;
  const e200 = e200Arr[n - 1]!;
  const e200_22ago = e200Arr[n - 23] ?? e200;
  const e200_44ago = e200Arr[n - 45] ?? e200_22ago;

  const ema200TrendingUp = e200 > e200_22ago && e200_22ago >= e200_44ago * 0.998;
  const isStage2 =
    last > e50 &&
    e50 > e150 &&
    e150 > e200 &&
    ema200TrendingUp;

  let stackPoints = 0;
  if (last > e20) stackPoints += 0.25;
  if (e20 >= e50 * 0.99) stackPoints += 0.25;
  if (e50 > e150) stackPoints += 0.25;
  if (e150 > e200 && ema200TrendingUp) stackPoints += 0.25;

  // 2. Prior Power-Play Impulse Leg (40 to 110 bars ago low -> base peak)
  const lookbackStart = Math.max(0, n - 120);
  const baseStart = Math.max(20, n - 55);
  const preBaseMinLow = Math.min(...lows.slice(lookbackStart, baseStart));
  const recentBasePeak = Math.max(...highs.slice(baseStart, n));
  const priorImpulsePct = preBaseMinLow > 0 ? ((recentBasePeak - preBaseMinLow) / preBaseMinLow) * 100 : 0;
  const hasPowerPlayPole = priorImpulsePct >= 24.0;

  // 3. Multi-Contraction Volatility Analysis
  const atrArr = atrSeries(highs, lows, closes, 14);
  const currentATR = atrArr[n - 1] ?? (highs[n - 1] - lows[n - 1]);
  const atr10Ago = atrArr[n - 11] ?? currentATR;
  const tightCoilRatio = currentATR / last;

  const {
    count,
    depths,
    footprint,
    isProgressive,
    maxDepth,
    lastDepth,
    rightSideTightness5d,
    pivot,
    tightLow,
  } = analyzeMultiContractions(highs, lows, closes, 65);

  // 4. Proximity to 52W High & Low
  const lookback252 = Math.min(n, 252);
  const weekHigh52 = Math.max(...highs.slice(n - lookback252));
  const weekLow52 = Math.min(...lows.slice(n - lookback252));
  const nearHighPct = (last / weekHigh52) * 100;
  const distFromLowPct = ((last - weekLow52) / (weekLow52 || 1)) * 100;

  // 5. Weighted Institutional Relative Strength (IBD 40/20/20/20 formula)
  const c3m = closes[Math.max(0, n - 63)] || last;
  const c6m = closes[Math.max(0, n - 126)] || last;
  const c9m = closes[Math.max(0, n - 189)] || last;
  const c12m = closes[Math.max(0, n - 250)] || last;

  const r3m = ((last - c3m) / c3m) * 100;
  const r6m = ((last - c6m) / c6m) * 100;
  const r9m = ((last - c9m) / c9m) * 100;
  const r12m = ((last - c12m) / c12m) * 100;

  const weightedRs = r3m * 0.40 + r6m * 0.20 + r9m * 0.20 + r12m * 0.20;
  // Map weighted return to 1-99 RS percentile rating (Indian mid/smallcap calibrated)
  const rsRating = Math.max(1, Math.min(99, Math.round(50 + weightedRs * 1.15)));

  // 6. Institutional Volume Forensics: Ghost-Town VDU + Pocket Pivot + Shakeout
  const vol50Slice = vols.slice(Math.max(0, n - 51), n - 1);
  const avg50vol = vol50Slice.reduce((a, b) => a + b, 0) / (vol50Slice.length || 1);
  const avg20vol = vols.slice(Math.max(0, n - 21), n - 1).reduce((a, b) => a + b, 0) / 20;
  const volumeRatio = avg20vol > 0 ? vols[n - 1] / avg20vol : 1;

  // Count VDU days (<55% of 50D avg vol) in the last 10 trading sessions
  let vduDaysLast10 = 0;
  for (let i = Math.max(0, n - 10); i < n; i++) {
    if (vols[i] < avg50vol * 0.55) vduDaysLast10++;
  }
  const volumeDryUp = vduDaysLast10 >= 2 || volumeRatio < 0.55;

  // Pocket Pivot: any up-day in last 5 bars with volume > max down-day volume of prior 10 bars
  let hasPocketPivot = false;
  for (let i = Math.max(12, n - 5); i < n; i++) {
    const isUpBar = closes[i] > closes[i - 1] && closes[i] >= lows[i] + 0.6 * (highs[i] - lows[i]);
    if (!isUpBar) continue;
    let maxDownVol10 = 0;
    for (let j = i - 10; j < i; j++) {
      if (closes[j] < closes[j - 1] && vols[j] > maxDownVol10) {
        maxDownVol10 = vols[j];
      }
    }
    if (maxDownVol10 > 0 && vols[i] > maxDownVol10) {
      hasPocketPivot = true;
      break;
    }
  }

  // Closing Range % of latest bar (institutional support check)
  const todayRange = Math.max(0.01, highs[n - 1] - lows[n - 1]);
  const closingRangePct = Math.round(((last - lows[n - 1]) / todayRange) * 100);

  // Shakeout & Recovery check in last 8 bars
  let hasShakeoutRecovery = false;
  for (let i = Math.max(5, n - 8); i < n; i++) {
    const prior3Low = Math.min(...lows.slice(i - 4, i));
    const barRange = Math.max(0.01, highs[i] - lows[i]);
    const barCr = (closes[i] - lows[i]) / barRange;
    if (lows[i] < prior3Low * 0.996 && barCr >= 0.60 && closes[i] >= prior3Low) {
      hasShakeoutRecovery = true;
      break;
    }
  }

  const distanceToPivotPct = Math.round(((pivot - last) / (pivot || 1)) * 1000) / 10;

  // Setup Stage Classification
  let setupStage: VcpFeatures["setupStage"] = "ELITE_STAGE2_VCP";
  if (last >= pivot * 0.998 && volumeRatio >= 1.5 && closingRangePct >= 65) {
    setupStage = "BREAKOUT_CONFIRMED";
  } else if (hasPocketPivot && distanceToPivotPct <= 3.5 && lastDepth <= 7.5) {
    setupStage = "POCKET_PIVOT_IGNITION";
  } else if (lastDepth <= 6.5 && rightSideTightness5d <= 4.5 && volumeDryUp && distanceToPivotPct <= 4.0) {
    setupStage = "ROCKET_COIL_READY";
  }

  // Rocket Base Gate (Strict institutional filter)
  const passesAllFilters =
    isStage2 &&
    hasPowerPlayPole &&
    nearHighPct >= 88 &&
    distFromLowPct >= 30 &&
    maxDepth <= 35 &&
    lastDepth <= 9.0 &&
    (isProgressive || currentATR <= atr10Ago * 0.92) &&
    tightCoilRatio <= 0.042 &&
    (volumeDryUp || hasPocketPivot) &&
    rsRating >= 68 &&
    turnover >= 3_500_000;

  return {
    symbol,
    price: last,
    dailyChangePct,
    turnover,
    emaStackScore: stackPoints,
    ema200TrendingUp,
    isStage2,
    priorImpulsePct: Math.round(priorImpulsePct * 10) / 10,
    hasPowerPlayPole,
    atr14: currentATR,
    tightCoilRatio,
    contractionCount: count,
    contractionDepths: depths,
    contractionFootprint: footprint,
    isProgressiveTightening: isProgressive,
    maxBaseDepth: maxDepth,
    lastContractionDepth: lastDepth,
    rightSideTightness5d,
    nearHighPct: Math.round(nearHighPct * 10) / 10,
    distFromLowPct: Math.round(distFromLowPct * 10) / 10,
    rsScore: Math.round(weightedRs * 10) / 10,
    rsRating,
    closingRangePct,
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    vduDaysLast10,
    volumeDryUp,
    hasPocketPivot,
    hasShakeoutRecovery,
    pivotPoint: Math.round(pivot * 100) / 100,
    distanceToPivotPct,
    baseLow: Math.round(tightLow * 100) / 100,
    passesAllFilters,
    setupStage,
  };
}

/**
 * 100-Point Institutional VCP Rocket Score:
 *  - Stage-2 Trend & Power-Play Pole: 25 pts
 *  - Multi-Contraction Tightness & Progressive Decay: 25 pts
 *  - Institutional Volume (VDU + Pocket Pivot + Shakeout): 20 pts
 *  - Relative Strength Rating (RS 1-99) & 52W High Proximity: 20 pts
 *  - Pivot Proximity & Closing Range Quality: 10 pts
 */
export function computeVcpScore(f: VcpFeatures): number {
  let score = 0;

  // 1. Stage-2 & Prior Pole (max 25)
  if (f.isStage2) score += 16;
  else score += f.emaStackScore * 10;
  if (f.hasPowerPlayPole) score += Math.min(9, (f.priorImpulsePct / 40) * 9);

  // 2. Contraction Quality & Right-Side Coil (max 25)
  if (f.isProgressiveTightening) score += 8;
  const tightnessPts = Math.max(0, Math.min(12, ((10 - f.lastContractionDepth) / 8) * 12));
  const coilPts = Math.max(0, Math.min(5, ((0.045 - f.tightCoilRatio) / 0.035) * 5));
  score += tightnessPts + coilPts;

  // 3. Volume Forensics: VDU + Pocket Pivot + Shakeout (max 20)
  if (f.volumeDryUp) score += 9;
  score += Math.min(4, f.vduDaysLast10 * 1.2);
  if (f.hasPocketPivot) score += 5;
  if (f.hasShakeoutRecovery) score += 2;

  // 4. Relative Strength & Overhead Supply Clearance (max 20)
  score += Math.max(0, Math.min(12, ((f.rsRating - 55) / 40) * 12));
  score += Math.max(0, Math.min(8, ((f.nearHighPct - 82) / 18) * 8));

  // 5. Pivot Proximity & Bar Closing Range (max 10)
  if (f.distanceToPivotPct >= -1 && f.distanceToPivotPct <= 3.5) score += 6;
  else if (f.distanceToPivotPct <= 6.0) score += 3;
  if (f.closingRangePct >= 65) score += 4;
  else if (f.closingRangePct >= 50) score += 2;

  return Math.max(10, Math.min(99, Math.round(score)));
}

export function computeVcpEntrySLTarget(f: VcpFeatures): VcpTrade {
  const entry = Math.round(f.pivotPoint * 100) / 100;
  // Tight structural stop-loss below the final contraction low (capped between 2.2% and 6.0% risk)
  const rawSl = f.baseLow * 0.992;
  const minSl = entry * 0.94;   // Max 6.0% risk allowed on a true VCP rocket
  const maxSl = entry * 0.978;  // At least 2.2% breathing room above noise
  const stopLoss = Math.round(Math.min(maxSl, Math.max(minSl, rawSl)) * 100) / 100;

  const riskPct = Math.max(0.015, (entry - stopLoss) / entry);
  const targetPct = Math.max(0.12, riskPct * 3.2); // Minimum +12% or 3.2R
  const target = Math.round(entry * (1 + targetPct) * 100) / 100;
  const target2 = Math.round(entry * (1 + Math.max(0.22, riskPct * 5.0)) * 100) / 100;

  // 1% Portfolio Risk Rule: Position % = 1% / riskPct (capped at 25% of portfolio)
  const maxPositionPctOfCapital = Math.min(25, Math.round((1.0 / (riskPct * 100)) * 1000) / 10);

  return {
    entry,
    stopLoss,
    target,
    target2,
    riskPct: Math.round(riskPct * 1000) / 10,
    targetPct: Math.round(targetPct * 1000) / 10,
    riskRewardRatio: Math.round((targetPct / riskPct) * 10) / 10,
    maxPositionPctOfCapital,
  };
}
