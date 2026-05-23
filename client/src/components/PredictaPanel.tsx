/**
 * PredictaPanel — PREDICTA V4 Pine Script replicated as a React component.
 *
 * Computes the same 8 signals (MACD, RSI, Stochastic, Volume, Delta, Trend, ADX, Price>EMA55)
 * from Yahoo candle data and renders the prediction dashboard natively in the app.
 */
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, TrendingUp, TrendingDown, BarChart3, Zap, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

/* ══════════════════════════════════════════════════════════════
   INDICATOR MATH — same logic as PREDICTA V4 Pine Script
══════════════════════════════════════════════════════════════ */

function ema(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function sma(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(NaN); continue; }
    const slice = data.slice(i - period + 1, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

function computeRSI(closes: number[], period: number): number[] {
  const rsi: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return rsi;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period; avgLoss /= period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

function computeMACD(closes: number[]): { macdLine: number[]; signalLine: number[]; histogram: number[] } {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = ema(macdLine, 9);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macdLine, signalLine, histogram };
}

function computeStochastic(highs: number[], lows: number[], closes: number[], period: number): { k: number[]; d: number[] } {
  const kValues: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { kValues.push(NaN); continue; }
    const highSlice = highs.slice(i - period + 1, i + 1);
    const lowSlice = lows.slice(i - period + 1, i + 1);
    const hh = Math.max(...highSlice);
    const ll = Math.min(...lowSlice);
    kValues.push(hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100);
  }
  const dValues = sma(kValues.map(v => isNaN(v) ? 50 : v), 3);
  return { k: kValues, d: dValues };
}

function computeADX(highs: number[], lows: number[], closes: number[], period: number): { adx: number[]; diPlus: number[]; diMinus: number[] } {
  const len = closes.length;
  const trArr: number[] = [0];
  const dmPlusArr: number[] = [0];
  const dmMinusArr: number[] = [0];

  for (let i = 1; i < len; i++) {
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    const dmPlus = highs[i] - highs[i - 1] > lows[i - 1] - lows[i] ? Math.max(highs[i] - highs[i - 1], 0) : 0;
    const dmMinus = lows[i - 1] - lows[i] > highs[i] - highs[i - 1] ? Math.max(lows[i - 1] - lows[i], 0) : 0;
    trArr.push(tr); dmPlusArr.push(dmPlus); dmMinusArr.push(dmMinus);
  }

  // Smoothed using Wilder's method
  const smoothTR: number[] = []; const smoothDMP: number[] = []; const smoothDMM: number[] = [];
  let sumTR = 0, sumDMP = 0, sumDMM = 0;
  for (let i = 0; i < len; i++) {
    if (i < period) {
      sumTR += trArr[i]; sumDMP += dmPlusArr[i]; sumDMM += dmMinusArr[i];
      smoothTR.push(NaN); smoothDMP.push(NaN); smoothDMM.push(NaN);
    } else if (i === period) {
      sumTR += trArr[i]; sumDMP += dmPlusArr[i]; sumDMM += dmMinusArr[i];
      smoothTR.push(sumTR); smoothDMP.push(sumDMP); smoothDMM.push(sumDMM);
    } else {
      const sTR = smoothTR[i - 1] - smoothTR[i - 1] / period + trArr[i];
      const sDMP = smoothDMP[i - 1] - smoothDMP[i - 1] / period + dmPlusArr[i];
      const sDMM = smoothDMM[i - 1] - smoothDMM[i - 1] / period + dmMinusArr[i];
      smoothTR.push(sTR); smoothDMP.push(sDMP); smoothDMM.push(sDMM);
    }
  }

  const diPlus = smoothDMP.map((v, i) => isNaN(v) || smoothTR[i] === 0 ? NaN : (v / smoothTR[i]) * 100);
  const diMinus = smoothDMM.map((v, i) => isNaN(v) || smoothTR[i] === 0 ? NaN : (v / smoothTR[i]) * 100);
  const dx = diPlus.map((v, i) => isNaN(v) || isNaN(diMinus[i]) || (v + diMinus[i]) === 0 ? NaN : Math.abs(v - diMinus[i]) / (v + diMinus[i]) * 100);

  // ADX = smoothed DX
  const adx: number[] = new Array(len).fill(NaN);
  let adxSum = 0; let adxCount = 0;
  for (let i = 0; i < len; i++) {
    if (!isNaN(dx[i])) {
      adxCount++;
      if (adxCount <= period) { adxSum += dx[i]; if (adxCount === period) adx[i] = adxSum / period; }
      else { adx[i] = (adx[i - 1] * (period - 1) + dx[i]) / period; }
    }
  }

  return { adx, diPlus, diMinus };
}

/* ══════════════════════════════════════════════════════════════
   PREDICTA V4 COMPUTATION
══════════════════════════════════════════════════════════════ */

interface PredictaResult {
  longPct: number;
  shortPct: number;
  longConf: number;
  shortConf: number;
  signals: {
    name: string;
    bullish: boolean;
    value: string;
  }[];
  metrics: {
    label: string;
    value: string;
    color: "green" | "red" | "neutral";
  }[];
  emas: { ema8: number; ema21: number; ema55: number; ema144: number };
  rsiVal: number;
  adxVal: number;
}

function computePredicta(candles: any[]): PredictaResult | null {
  if (!candles || candles.length < 50) return null;

  const closes = candles.map((c: any) => Number(c.close));
  const highs = candles.map((c: any) => Number(c.high));
  const lows = candles.map((c: any) => Number(c.low));
  const opens = candles.map((c: any) => Number(c.open));
  const volumes = candles.map((c: any) => Number(c.volume || 0));
  const last = closes.length - 1;

  // EMAs
  const ema8 = ema(closes, 8);
  const ema21 = ema(closes, 21);
  const ema55 = ema(closes, 55);
  const ema144 = ema(closes, 144);

  // EMA % from price
  const ema8pct = (closes[last] - ema8[last]) / ema8[last] * 100;
  const ema21pct = (closes[last] - ema21[last]) / ema21[last] * 100;
  const ema55pct = (closes[last] - ema55[last]) / ema55[last] * 100;
  const ema144pct = (closes[last] - ema144[last]) / ema144[last] * 100;

  // MACD
  const macd = computeMACD(closes);
  const macdBull = macd.macdLine[last] > macd.signalLine[last];

  // RSI
  const rsi = computeRSI(closes, 14);
  const rsiVal = rsi[last] ?? 50;
  const rsiBull = rsiVal > 50;

  // Stochastic
  const stoch = computeStochastic(highs, lows, closes, 14);
  const kVal = stoch.k[last] ?? 50;
  const dVal = stoch.d[last] ?? 50;
  const stochBull = kVal > dVal && kVal < 80;

  // Volume
  const avgVol20 = sma(volumes, 20);
  const avgVolLast = avgVol20[last] || 1;
  const volBull = volumes[last] > avgVolLast;
  const volRatio = volumes[last] / avgVolLast;
  const rVol = volRatio * 100;

  // Delta
  const deltaVal = closes[last] - opens[last];
  const deltaBull = deltaVal > 0;

  // Trend (EMA alignment)
  const trendUp = ema8[last] > ema21[last] && ema21[last] > ema55[last];
  const trendDown = ema8[last] < ema21[last] && ema21[last] < ema55[last];

  // ADX
  const adxData = computeADX(highs, lows, closes, 14);
  const adxVal = adxData.adx[last] ?? 0;
  const diPlusVal = adxData.diPlus[last] ?? 0;
  const diMinusVal = adxData.diMinus[last] ?? 0;
  const adxStrong = adxVal > 25;

  // ADR
  const adrData = candles.slice(-14).map((c: any) => Number(c.high) - Number(c.low));
  const adr = (adrData.reduce((a: number, b: number) => a + b, 0) / 14) / closes[last] * 100;

  // Volume 50-day avg
  const vol50d = sma(volumes, 50);
  const vol50dVal = vol50d[last] || 0;

  // Score
  let longScore = 0;
  if (macdBull) longScore++;
  if (rsiBull) longScore++;
  if (stochBull) longScore++;
  if (volBull) longScore++;
  if (deltaBull) longScore++;
  if (trendUp) longScore++;
  if (adxStrong) longScore++;
  if (closes[last] > ema55[last]) longScore++;

  const shortScore = 8 - longScore;
  const longPct = Math.round(longScore / 8 * 100);
  const shortPct = Math.round(shortScore / 8 * 100);
  const longConf = longScore >= 6 ? longScore - 5 : 0;
  const shortConf = shortScore >= 6 ? shortScore - 5 : 0;

  const signals = [
    { name: "MACD", bullish: macdBull, value: macdBull ? "Bullish ↑" : "Bearish ↓" },
    { name: "RSI", bullish: rsiBull, value: `(${Math.round(rsiVal)})` },
    { name: "STOCH", bullish: stochBull, value: stochBull ? "Bullish ↑" : "Bearish ↓" },
    { name: "VOLUME", bullish: volBull, value: `${volRatio.toFixed(1)}x` },
    { name: "DELTA ▶", bullish: deltaBull, value: deltaBull ? "Strong Buy ▶" : "Strong Sell ▶" },
    { name: "TREND", bullish: trendUp, value: trendUp ? "Strong Up ↑" : (trendDown ? "Down ↓" : "Flat →") },
    { name: "ADX", bullish: adxStrong, value: `${Math.round(adxVal)} ${adxVal <= 25 ? "Weak" : "Strong"}` },
    { name: "CONFLUENCE", bullish: longConf > 0, value: `${longConf} / 8` },
  ];

  const metrics = [
    { label: "Price", value: `₹${closes[last].toFixed(2)}`, color: "neutral" as const },
    { label: "EMA-8", value: `${ema8pct.toFixed(2)} %`, color: ema8pct >= 0 ? "green" as const : "red" as const },
    { label: "EMA-21", value: `${ema21pct.toFixed(2)} %`, color: ema21pct >= 0 ? "green" as const : "red" as const },
    { label: "EMA-55", value: `${ema55pct.toFixed(2)} %`, color: ema55pct >= 0 ? "green" as const : "red" as const },
    { label: "EMA-144", value: `${ema144pct.toFixed(2)} %`, color: ema144pct >= 0 ? "green" as const : "red" as const },
    { label: "RVol", value: `${rVol.toFixed(1)} %`, color: rVol > 100 ? "green" as const : "neutral" as const },
    { label: "ADR", value: `${adr.toFixed(2)} %`, color: "neutral" as const },
    { label: "50 DAV", value: `${(vol50dVal / 1e5).toFixed(1)} M`, color: "neutral" as const },
    { label: "Vol Tod", value: `${(volumes[last] / 1e5).toFixed(1)} M`, color: volBull ? "green" as const : "neutral" as const },
    { label: "RSI", value: rsiVal.toFixed(1), color: rsiVal > 60 ? "green" as const : rsiVal < 40 ? "red" as const : "neutral" as const },
    { label: "ADX", value: adxVal.toFixed(1), color: adxVal > 25 ? "green" as const : "neutral" as const },
    { label: "U/D Ratio", value: (diPlusVal / Math.max(diMinusVal, 0.001)).toFixed(2), color: diPlusVal > diMinusVal ? "green" as const : "red" as const },
  ];

  return {
    longPct, shortPct, longConf, shortConf, signals, metrics,
    emas: { ema8: ema8[last], ema21: ema21[last], ema55: ema55[last], ema144: ema144[last] },
    rsiVal, adxVal,
  };
}

/* ══════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════ */

const colorMap = { green: "text-emerald-400", red: "text-red-400", neutral: "text-white/50" };

export function PredictaPanel({ symbol }: { symbol: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/stock", symbol, "technicals", "predicta"],
    queryFn: async () => {
      const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}/technicals?range=2y`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const predicta = data?.candles ? computePredicta(data.candles) : null;

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl border border-white/6 p-6 animate-pulse">
        <div className="h-6 w-48 bg-white/5 rounded mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-40 bg-white/3 rounded-xl" />
          <div className="h-40 bg-white/3 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!predicta) {
    return (
      <div className="glass-card rounded-2xl border border-white/6 p-6 text-center text-white/30 text-sm">
        Insufficient data for PREDICTA V4 analysis
      </div>
    );
  }

  const { longPct, shortPct, signals, metrics } = predicta;
  const isBullish = longPct >= shortPct;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="glass-card rounded-2xl border border-white/6 overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-3 border-b border-white/5 flex items-center gap-3"
        style={{ background: "linear-gradient(135deg, rgba(26,26,46,0.9), rgba(13,13,26,0.9))" }}>
        <Activity className="w-5 h-5 text-purple-400" />
        <span className="text-sm font-bold font-mono text-white tracking-wide">PREDICTA V4</span>
        <span className="text-[10px] font-mono text-white/30 ml-1">
          ATR: {predicta.adxVal <= 25 ? "↓ LOW" : "→ MID"}
        </span>
        {/* Prediction badges */}
        <div className="ml-auto flex items-center gap-2">
          <div className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold font-mono
            ${isBullish ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/5 text-white/30 border border-white/10"}`}>
            <ArrowUpCircle className="w-3.5 h-3.5" />
            LONG {longPct}%
          </div>
          <div className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold font-mono
            ${!isBullish ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-white/5 text-white/30 border border-white/10"}`}>
            <ArrowDownCircle className="w-3.5 h-3.5" />
            SHORT {shortPct}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
        {/* ── LONG ANALYSIS ──────────────────────── */}
        <div className="border-r border-white/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400/80 uppercase tracking-wider">Long Analysis</span>
            <span className={`ml-auto text-xs font-mono font-bold px-2 py-0.5 rounded
              ${longPct >= 60 ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/30"}`}>
              {longPct}%
            </span>
          </div>
          <div className="space-y-1.5">
            {signals.map((sig) => (
              <div key={sig.name} className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-white/3 transition-colors">
                <span className="text-[11px] text-white/40 font-mono">{sig.name}</span>
                <span className={`text-[11px] font-mono font-semibold ${sig.bullish ? "text-emerald-400" : "text-red-400"}`}>
                  {sig.value}
                </span>
              </div>
            ))}
          </div>
          {/* Footer */}
          <div className="flex gap-2 mt-3">
            <div className={`flex-1 text-center py-1.5 rounded-md text-[11px] font-bold font-mono
              ${longPct >= 60 ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/20"}`}>
              LONG
            </div>
            <div className={`flex-1 text-center py-1.5 rounded-md text-[11px] font-bold font-mono
              ${longPct < 60 ? "bg-orange-500/20 text-orange-400" : "bg-white/5 text-white/20"}`}>
              WAIT
            </div>
          </div>
        </div>

        {/* ── SHORT ANALYSIS ─────────────────────── */}
        <div className="border-r border-white/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-xs font-bold text-red-400/80 uppercase tracking-wider">Short Analysis</span>
            <span className={`ml-auto text-xs font-mono font-bold px-2 py-0.5 rounded
              ${shortPct >= 60 ? "bg-red-500/20 text-red-400" : "bg-white/5 text-white/30"}`}>
              {shortPct}%
            </span>
          </div>
          <div className="space-y-1.5">
            {signals.map((sig) => (
              <div key={`s-${sig.name}`} className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-white/3 transition-colors">
                <span className="text-[11px] text-white/40 font-mono">{sig.name}</span>
                <span className={`text-[11px] font-mono font-semibold ${!sig.bullish ? "text-red-400" : "text-emerald-400"}`}>
                  {sig.value}
                </span>
              </div>
            ))}
          </div>
          {/* Footer */}
          <div className="flex gap-2 mt-3">
            <div className={`flex-1 text-center py-1.5 rounded-md text-[11px] font-bold font-mono
              ${shortPct >= 60 ? "bg-red-500/20 text-red-400" : "bg-white/5 text-white/20"}`}>
              SHORT
            </div>
            <div className={`flex-1 text-center py-1.5 rounded-md text-[11px] font-bold font-mono
              ${shortPct < 60 ? "bg-orange-500/20 text-orange-400" : "bg-white/5 text-white/20"}`}>
              WAIT
            </div>
          </div>
        </div>

        {/* ── METRICS PANEL ──────────────────────── */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-purple-400/80 uppercase tracking-wider">Metrics</span>
            <Zap className="w-3 h-3 ml-auto text-yellow-500/40" />
          </div>
          <div className="space-y-1">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-white/3 transition-colors">
                <span className="text-[11px] text-white/40 font-mono">{m.label}</span>
                <span className={`text-[11px] font-mono font-semibold ${colorMap[m.color]}`}>
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom prediction bar */}
      <div className="px-4 py-3 border-t border-white/5 flex items-center gap-3"
        style={{ background: "rgba(255,255,255,0.01)" }}>
        <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${longPct}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{
              background: longPct >= 60
                ? "linear-gradient(90deg, #10b981, #34d399)"
                : longPct >= 40
                  ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                  : "linear-gradient(90deg, #ef4444, #f87171)",
            }}
          />
        </div>
        <span className={`text-xs font-bold font-mono ${isBullish ? "text-emerald-400" : "text-red-400"}`}>
          {isBullish ? `LONG ${longPct}%` : `SHORT ${shortPct}%`}
        </span>
      </div>
    </motion.div>
  );
}
