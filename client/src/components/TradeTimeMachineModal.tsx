import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldAlert,
  Percent,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BarChart2,
  FastForward,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from "recharts";

export interface TimeMachineModalProps {
  open: boolean;
  onClose: () => void;
  symbol: string;
  defaultEntry?: number;
  defaultStopLoss?: number;
  defaultTarget1?: number;
  defaultTarget2?: number;
  defaultDirection?: "LONG" | "SHORT";
}

interface SimulationData {
  symbol: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskRewardRatio: number;
  totalSimulations: number;
  horizonDays: number;
  winRatePct: number;
  stopOutPct: number;
  expiredPct: number;
  target2Pct: number;
  expectedValuePer1000Risk: number;
  profitFactor: number;
  riskPerShare: number;
  rewardPerShare: number;
  confidenceRating: "STRONG_EDGE" | "POSITIVE_EDGE" | "NEUTRAL_EDGE" | "NEGATIVE_EDGE";
  edgeSummary: string;
  medianDaysToOutcome: number;
  medianDaysToTarget?: number;
  medianDaysToStop?: number;
  annualizedVolatilityPct: number;
  dailyVolatilityPct: number;
  averageTrueRange: number;
  maxAdverseExcursionPct: number;
  p95AdverseExcursionPct: number;
  quantilePaths: Array<{
    day: number;
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
    sampleBest: number;
    sampleWorst: number;
  }>;
  distributionHistogram: Array<{
    binLabel: string;
    count: number;
    percentage: number;
    isWin: boolean;
    isLoss: boolean;
  }>;
}

export function TradeTimeMachineModal({
  open,
  onClose,
  symbol,
  defaultEntry,
  defaultStopLoss,
  defaultTarget1,
  defaultTarget2,
  defaultDirection = "LONG",
}: TimeMachineModalProps) {
  const [direction, setDirection] = useState<"LONG" | "SHORT">(defaultDirection);
  const [entryPrice, setEntryPrice] = useState<string>(defaultEntry ? String(defaultEntry) : "");
  const [stopLoss, setStopLoss] = useState<string>(defaultStopLoss ? String(defaultStopLoss) : "");
  const [target1, setTarget1] = useState<string>(defaultTarget1 ? String(defaultTarget1) : "");
  const [target2, setTarget2] = useState<string>(defaultTarget2 ? String(defaultTarget2) : "");
  const [horizonDays, setHorizonDays] = useState<number>(25);
  const [numSims, setNumSims] = useState<number>(5000);

  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<SimulationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync defaults when modal opens or symbol changes
  useEffect(() => {
    if (open && symbol) {
      if (defaultEntry) setEntryPrice(String(defaultEntry));
      if (defaultStopLoss) setStopLoss(String(defaultStopLoss));
      if (defaultTarget1) setTarget1(String(defaultTarget1));
      if (defaultTarget2) setTarget2(String(defaultTarget2));
      setDirection(defaultDirection);
      runSimulation();
    }
  }, [open, symbol]);

  const runSimulation = async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/stock/${symbol.toUpperCase()}/time-machine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryPrice: entryPrice ? Number(entryPrice) : undefined,
          stopLoss: stopLoss ? Number(stopLoss) : undefined,
          target1: target1 ? Number(target1) : undefined,
          target2: target2 ? Number(target2) : undefined,
          direction,
          simulations: numSims,
          horizonDays,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || "Failed to run simulation");
      }

      const json: SimulationData = await res.json();
      setData(json);

      // Populate input boxes if empty with backend calculated defaults
      if (!entryPrice) setEntryPrice(String(json.entryPrice));
      if (!stopLoss) setStopLoss(String(json.stopLoss));
      if (!target1) setTarget1(String(json.target1));
      if (!target2) setTarget2(String(json.target2));
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during Monte Carlo replay.");
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!data?.quantilePaths) return [];
    return data.quantilePaths.map(p => ({
      day: `D+${p.day}`,
      dayNum: p.day,
      p5: p.p5,
      p25: p.p25,
      p50: p.p50,
      p75: p.p75,
      p95: p.p95,
      best: p.sampleBest,
      worst: p.sampleWorst,
      entry: data.entryPrice,
      sl: data.stopLoss,
      t1: data.target1,
      t2: data.target2,
    }));
  }, [data]);

  const ratingBadge = useMemo(() => {
    if (!data) return null;
    switch (data.confidenceRating) {
      case "STRONG_EDGE":
        return {
          label: "STRONG QUANT EDGE",
          color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
        };
      case "POSITIVE_EDGE":
        return {
          label: "POSITIVE EXPECTANCY",
          color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
          icon: <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />,
        };
      case "NEUTRAL_EDGE":
        return {
          label: "NEUTRAL / COIN FLIP",
          color: "bg-amber-500/20 text-amber-400 border-amber-500/40",
          icon: <HelpCircle className="w-3.5 h-3.5 text-amber-400" />,
        };
      default:
        return {
          label: "NEGATIVE EXPECTANCY (AVOID)",
          color: "bg-rose-500/20 text-rose-400 border-rose-500/40",
          icon: <XCircle className="w-3.5 h-3.5 text-rose-400" />,
        };
    }
  }, [data]);

  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-slate-950 border-slate-800 text-slate-100 p-4 sm:p-6 shadow-2xl">
        <DialogHeader className="border-b border-slate-800/80 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
                <FastForward className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-mono font-bold flex items-center gap-2">
                  <span>TRADE TIME MACHINE</span>
                  <span className="text-indigo-400 font-extrabold">{symbol?.toUpperCase()}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Bootstrap Monte Carlo Outcome Replay & Probability Modeling (NSE Equity)
                </DialogDescription>
              </div>
            </div>

            {ratingBadge && (
              <Badge variant="outline" className={`font-mono text-xs px-2.5 py-1 flex items-center gap-1.5 ${ratingBadge.color}`}>
                {ratingBadge.icon}
                {ratingBadge.label}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Input Parameters Control Bar */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 font-mono text-xs">
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-semibold mb-1 block">Direction</label>
              <div className="flex rounded-md overflow-hidden border border-slate-700">
                <button
                  type="button"
                  onClick={() => setDirection("LONG")}
                  className={`flex-1 py-1.5 text-center text-xs font-bold transition-colors ${
                    direction === "LONG"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-900 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("SHORT")}
                  className={`flex-1 py-1.5 text-center text-xs font-bold transition-colors ${
                    direction === "SHORT"
                      ? "bg-rose-600 text-white"
                      : "bg-slate-900 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  SELL
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase font-semibold mb-1 block">Entry (₹)</label>
              <Input
                type="number"
                step="0.05"
                value={entryPrice}
                onChange={e => setEntryPrice(e.target.value)}
                placeholder="Entry Price"
                className="h-8 text-xs font-mono bg-slate-950 border-slate-700"
              />
            </div>

            <div>
              <label className="text-[10px] text-rose-400 uppercase font-semibold mb-1 block">Stop Loss (₹)</label>
              <Input
                type="number"
                step="0.05"
                value={stopLoss}
                onChange={e => setStopLoss(e.target.value)}
                placeholder="Stop Loss"
                className="h-8 text-xs font-mono bg-slate-950 border-rose-800/60 text-rose-300"
              />
            </div>

            <div>
              <label className="text-[10px] text-emerald-400 uppercase font-semibold mb-1 block">Target 1 (₹)</label>
              <Input
                type="number"
                step="0.05"
                value={target1}
                onChange={e => setTarget1(e.target.value)}
                placeholder="Target 1"
                className="h-8 text-xs font-mono bg-slate-950 border-emerald-800/60 text-emerald-300"
              />
            </div>

            <div>
              <label className="text-[10px] text-cyan-400 uppercase font-semibold mb-1 block">Target 2 (₹)</label>
              <Input
                type="number"
                step="0.05"
                value={target2}
                onChange={e => setTarget2(e.target.value)}
                placeholder="Target 2"
                className="h-8 text-xs font-mono bg-slate-950 border-cyan-800/60 text-cyan-300"
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={runSimulation}
                disabled={loading}
                className="w-full h-8 text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5 shadow-md shadow-indigo-900/30"
              >
                {loading ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Replaying...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Replay</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/60 gap-2">
            <div className="flex items-center gap-3">
              <span>Horizon:</span>
              {[15, 25, 40].map(days => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setHorizonDays(days)}
                  className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                    horizonDays === days
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold"
                      : "hover:text-slate-200"
                  }`}
                >
                  {days} Days
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span>Simulations:</span>
              {[2500, 5000, 10000].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setNumSims(s)}
                  className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                    numSims === s
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold"
                      : "hover:text-slate-200"
                  }`}
                >
                  {s.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs font-mono flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {data && (
          <div className="space-y-4">
            {/* Core KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Win Rate */}
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                  Target 1 Win Rate
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-xl sm:text-2xl font-mono font-black ${
                    data.winRatePct >= 55 ? "text-emerald-400" : data.winRatePct >= 45 ? "text-cyan-400" : "text-rose-400"
                  }`}>
                    {data.winRatePct}%
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    ({data.target2Pct}% reach T2)
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      data.winRatePct >= 55 ? "bg-emerald-500" : data.winRatePct >= 45 ? "bg-cyan-500" : "bg-rose-500"
                    }`}
                    style={{ width: `${Math.min(100, data.winRatePct)}%` }}
                  />
                </div>
              </div>

              {/* Stop-Out Risk */}
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                  Stop-Out Probability
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-xl sm:text-2xl font-mono font-black ${
                    data.stopOutPct > 45 ? "text-rose-400" : "text-slate-200"
                  }`}>
                    {data.stopOutPct}%
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    ({data.expiredPct}% expired)
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-rose-500 transition-all"
                    style={{ width: `${Math.min(100, data.stopOutPct)}%` }}
                  />
                </div>
              </div>

              {/* Expected Value per ₹1,000 Risk */}
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                  EV per ₹1,000 Risked
                </span>
                <div className="flex items-baseline gap-1">
                  <span className={`text-xl sm:text-2xl font-mono font-black ${
                    data.expectedValuePer1000Risk > 0 ? "text-emerald-400" : "text-rose-400"
                  }`}>
                    {data.expectedValuePer1000Risk > 0 ? "+" : ""}₹{data.expectedValuePer1000Risk}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 block truncate">
                  R:R 1:{data.riskRewardRatio} | PF {data.profitFactor}
                </span>
              </div>

              {/* Median Resolution Time */}
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                  Median Days to Exit
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-mono font-black text-indigo-300">
                    {data.medianDaysToOutcome}d
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    (Wins: {data.medianDaysToTarget}d)
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 block truncate">
                  MAE Dip: ~{data.maxAdverseExcursionPct}%
                </span>
              </div>
            </div>

            {/* Plain English Edge Verdict */}
            <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
              data.expectedValuePer1000Risk > 0
                ? "bg-emerald-950/25 border-emerald-800/40 text-emerald-200"
                : "bg-rose-950/25 border-rose-800/40 text-rose-200"
            }`}>
              <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="text-xs font-sans leading-relaxed">
                <strong className="font-semibold block font-mono text-[11px] mb-0.5 uppercase">
                  Statistical Expectancy Verdict:
                </strong>
                {data.edgeSummary}
              </div>
            </div>

            {/* Monte Carlo Replay Quantile Fan Chart */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-mono font-bold text-slate-200">
                    MONTE CARLO QUANTILE REPLAY FAN ({numSims.toLocaleString()} PATHS)
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-[10px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500/40 border border-indigo-400" />
                    50% Interquartile
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-indigo-900/30 border border-indigo-600/30" />
                    90% Probability Cone
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-emerald-400 inline-block" /> Target
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-rose-400 inline-block" /> Stop Loss
                  </span>
                </div>
              </div>

              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="quantile90" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="quantile50" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0.15} />
                      </linearGradient>
                    </defs>

                    <XAxis
                      dataKey="day"
                      tick={{ fill: "#94a3b8", fontSize: 10, fontFamily: "monospace" }}
                      axisLine={{ stroke: "#334155" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fill: "#94a3b8", fontSize: 10, fontFamily: "monospace" }}
                      axisLine={{ stroke: "#334155" }}
                      tickLine={false}
                      tickFormatter={(val: number) => `₹${val.toFixed(0)}`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="p-2.5 rounded-lg bg-slate-950/95 border border-slate-800 text-[11px] font-mono text-slate-200 shadow-xl space-y-1">
                            <span className="text-indigo-400 font-bold block">{d.day} Projected Range</span>
                            <div className="text-[10px] space-y-0.5">
                              <div>Upper 95th: <strong className="text-indigo-300">₹{d.p95}</strong></div>
                              <div>Median (p50): <strong className="text-white">₹{d.p50}</strong></div>
                              <div>Lower 5th: <strong className="text-rose-300">₹{d.p5}</strong></div>
                            </div>
                          </div>
                        );
                      }}
                    />

                    {/* Barrier Lines */}
                    <ReferenceLine y={data.entryPrice} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: "Entry", fill: "#94a3b8", fontSize: 10, position: "left" }} />
                    <ReferenceLine y={data.target1} stroke="#10b981" strokeWidth={1.5} label={{ value: `T1: ₹${data.target1}`, fill: "#10b981", fontSize: 10, position: "right" }} />
                    {data.target2 && (
                      <ReferenceLine y={data.target2} stroke="#06b6d4" strokeDasharray="2 2" label={{ value: `T2: ₹${data.target2}`, fill: "#06b6d4", fontSize: 10, position: "right" }} />
                    )}
                    <ReferenceLine y={data.stopLoss} stroke="#f43f5e" strokeWidth={1.5} label={{ value: `SL: ₹${data.stopLoss}`, fill: "#f43f5e", fontSize: 10, position: "right" }} />

                    {/* Quantile Ribbons */}
                    <Area type="monotone" dataKey="p95" stroke="none" fill="url(#quantile90)" />
                    <Area type="monotone" dataKey="p75" stroke="none" fill="url(#quantile50)" />
                    <Area type="monotone" dataKey="p25" stroke="none" fill="#0f172a" />
                    <Area type="monotone" dataKey="p5" stroke="none" fill="#020617" />

                    {/* Median Line */}
                    <Line type="monotone" dataKey="p50" stroke="#a5b4fc" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* P&L Distribution Histogram */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-indigo-400" />
                SIMULATED RETURN DISTRIBUTION (FINAL OUTCOME BINS)
              </span>

              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.distributionHistogram} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="binLabel"
                      tick={{ fill: "#94a3b8", fontSize: 9, fontFamily: "monospace" }}
                      axisLine={{ stroke: "#334155" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 9, fontFamily: "monospace" }}
                      axisLine={{ stroke: "#334155" }}
                      tickLine={false}
                      tickFormatter={(val: number) => `${val}%`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-200">
                            <div>Return: <strong className="text-white">{d.binLabel}</strong></div>
                            <div>Frequency: <strong className="text-indigo-400">{d.percentage}%</strong> ({d.count} paths)</div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="percentage" radius={[3, 3, 0, 0]}>
                      {data.distributionHistogram.map((bin, i) => (
                        <Cell
                          key={i}
                          fill={
                            bin.isWin
                              ? "#10b981"
                              : bin.isLoss
                              ? "#f43f5e"
                              : "#64748b"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Diagnostic Footer */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px] font-mono text-slate-400 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <div>
                <span className="text-[10px] block text-slate-500 uppercase">Daily Volatility</span>
                <strong className="text-slate-300">{data.dailyVolatilityPct}%</strong>
              </div>
              <div>
                <span className="text-[10px] block text-slate-500 uppercase">Annualized Vol</span>
                <strong className="text-slate-300">{data.annualizedVolatilityPct}%</strong>
              </div>
              <div>
                <span className="text-[10px] block text-slate-500 uppercase">14D ATR</span>
                <strong className="text-slate-300">₹{data.averageTrueRange}</strong>
              </div>
              <div>
                <span className="text-[10px] block text-slate-500 uppercase">95th% Max Dip</span>
                <strong className="text-amber-400">-{data.p95AdverseExcursionPct}%</strong>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
