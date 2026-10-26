import React, { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FastForward,
  Calculator,
  Search,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Percent,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BarChart2,
  RotateCcw,
  Play,
  Layers,
  ArrowRight,
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
import { PositionSizerModal } from "@/components/PositionSizerModal";

const POPULAR_SYMBOLS = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "TATASTEEL", "BHARTIARTL", "SBIN"];

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
  medianDaysToTarget: number;
  medianDaysToStop: number;
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

export default function TradeTimeMachinePage() {
  const [, params] = useRoute("/time-machine/:symbol");
  const [symbol, setSymbol] = useState<string>(params?.symbol?.toUpperCase() || "RELIANCE");
  const [searchInput, setSearchInput] = useState<string>("");

  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [entryPrice, setEntryPrice] = useState<string>("");
  const [stopLoss, setStopLoss] = useState<string>("");
  const [target1, setTarget1] = useState<string>("");
  const [target2, setTarget2] = useState<string>("");
  const [horizonDays, setHorizonDays] = useState<number>(25);
  const [numSims, setNumSims] = useState<number>(5000);

  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<SimulationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sizerOpen, setSizerOpen] = useState<boolean>(false);

  useEffect(() => {
    if (params?.symbol) {
      setSymbol(params.symbol.toUpperCase());
    }
  }, [params?.symbol]);

  useEffect(() => {
    runSimulation(symbol);
  }, [symbol]);

  const runSimulation = async (sym: string = symbol) => {
    if (!sym) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/stock/${sym.toUpperCase()}/time-machine`, {
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

      if (!entryPrice) setEntryPrice(String(json.entryPrice));
      if (!stopLoss) setStopLoss(String(json.stopLoss));
      if (!target1) setTarget1(String(json.target1));
      if (!target2) setTarget2(String(json.target2));
    } catch (err: any) {
      setError(err.message || "Failed to calculate Monte Carlo outcome replay.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const clean = searchInput.trim().toUpperCase().replace(/(\.NS|\.BO)$/i, "");
      setSymbol(clean);
      setEntryPrice("");
      setStopLoss("");
      setTarget1("");
      setTarget2("");
      setSearchInput("");
    }
  };

  const chartData = React.useMemo(() => {
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

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <FastForward className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-mono font-black text-white flex items-center gap-2.5">
                <span>TRADE TIME MACHINE</span>
                <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 bg-indigo-950/40 text-indigo-300 border-indigo-700/50">
                  REPLAY ENGINE
                </Badge>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-Path Monte Carlo Replay & Expected Value (EV) Modeling across 5,000+ historical sessions
              </p>
            </div>
          </div>
        </div>

        {/* Symbol Search Bar */}
        <div className="flex items-center gap-2">
          <form onSubmit={handleSearch} className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search NSE stock..."
              className="h-9 pl-9 pr-3 text-xs font-mono bg-slate-900 border-slate-700 text-white rounded-lg"
            />
          </form>

          <Button
            onClick={() => setSizerOpen(true)}
            className="h-9 text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Position Sizer</span>
          </Button>
        </div>
      </div>

      {/* Popular Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
        <span className="text-[11px] text-slate-500 mr-1">Popular:</span>
        {POPULAR_SYMBOLS.map(s => (
          <button
            key={s}
            onClick={() => {
              setSymbol(s);
              setEntryPrice("");
              setStopLoss("");
              setTarget1("");
              setTarget2("");
            }}
            className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
              symbol === s
                ? "bg-indigo-600 text-white font-bold"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Control Configuration Grid */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 font-mono text-xs">
          <div>
            <label className="text-[10px] text-slate-400 uppercase font-semibold mb-1 block">Direction</label>
            <div className="flex rounded-md overflow-hidden border border-slate-700">
              <button
                type="button"
                onClick={() => setDirection("LONG")}
                className={`flex-1 py-1.5 text-center text-xs font-bold transition-colors ${
                  direction === "LONG" ? "bg-emerald-600 text-white" : "bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                BUY
              </button>
              <button
                type="button"
                onClick={() => setDirection("SHORT")}
                className={`flex-1 py-1.5 text-center text-xs font-bold transition-colors ${
                  direction === "SHORT" ? "bg-rose-600 text-white" : "bg-slate-900 text-slate-400 hover:text-white"
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
              onClick={() => runSimulation(symbol)}
              disabled={loading}
              className="w-full h-8 text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>Replaying...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Replay Setup</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800/60 gap-2">
          <div className="flex items-center gap-2">
            <span>Trading Horizon:</span>
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

          <div className="flex items-center gap-2">
            <span>Bootstrap Runs:</span>
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
                {s.toLocaleString()} Paths
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs font-mono flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {data && (
        <div className="space-y-5">
          {/* KPI Outcome Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Target 1 Win Probability
              </span>
              <div className="text-2xl sm:text-3xl font-mono font-black text-emerald-400">
                {data.winRatePct}%
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                ({data.target2Pct}% reached Target 2)
              </span>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mt-1">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${Math.min(100, data.winRatePct)}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Stop-Out Risk Probability
              </span>
              <div className="text-2xl sm:text-3xl font-mono font-black text-rose-400">
                {data.stopOutPct}%
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                ({data.expiredPct}% expired after {data.horizonDays}d)
              </span>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mt-1">
                <div
                  className="h-full bg-rose-500"
                  style={{ width: `${Math.min(100, data.stopOutPct)}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                EV per ₹1,000 Risked
              </span>
              <div className={`text-2xl sm:text-3xl font-mono font-black ${
                data.expectedValuePer1000Risk > 0 ? "text-emerald-400" : "text-rose-400"
              }`}>
                {data.expectedValuePer1000Risk > 0 ? "+" : ""}₹{data.expectedValuePer1000Risk}
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                R:R 1:{data.riskRewardRatio} | PF {data.profitFactor}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Median Outcome Time
              </span>
              <div className="text-2xl sm:text-3xl font-mono font-black text-indigo-300">
                {data.medianDaysToOutcome}d
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                MAE Drawdown: ~{data.maxAdverseExcursionPct}%
              </span>
            </div>
          </div>

          {/* Plain English Edge Verdict */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
            data.expectedValuePer1000Risk > 0
              ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-200"
              : "bg-rose-950/20 border-rose-800/40 text-rose-200"
          }`}>
            <Sparkles className="w-5 h-5 mt-0.5 shrink-0" />
            <div className="text-sm leading-relaxed">
              <strong className="font-mono text-xs uppercase tracking-wide block mb-0.5">
                Institutional Quant Verdict:
              </strong>
              {data.edgeSummary}
            </div>
          </div>

          {/* Quantile Fan Replay Chart */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-mono font-bold text-white">
                  MONTE CARLO PROBABILITY FAN ({numSims.toLocaleString()} PATHS)
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500/40 border border-indigo-400" />
                  50% Core Interquartile
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-indigo-900/30 border border-indigo-600/30" />
                  90% Probability Cone
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-3 h-0.5 bg-emerald-400 inline-block" /> Target
                </span>
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="w-3 h-0.5 bg-rose-400 inline-block" /> Stop Loss
                </span>
              </div>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pageQuantile90" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="pageQuantile50" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0.15} />
                    </linearGradient>
                  </defs>

                  <XAxis
                    dataKey="day"
                    tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "monospace" }}
                    axisLine={{ stroke: "#334155" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "monospace" }}
                    axisLine={{ stroke: "#334155" }}
                    tickLine={false}
                    tickFormatter={(val: number) => `₹${val.toFixed(0)}`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="p-3 rounded-xl bg-slate-950/95 border border-slate-800 text-xs font-mono text-slate-200 shadow-2xl space-y-1">
                          <span className="text-indigo-400 font-bold block">{d.day} Projected Price Envelope</span>
                          <div>Upper 95th: <strong className="text-indigo-300">₹{d.p95}</strong></div>
                          <div>Upper 75th: <strong className="text-indigo-200">₹{d.p75}</strong></div>
                          <div>Median (p50): <strong className="text-white font-bold">₹{d.p50}</strong></div>
                          <div>Lower 25th: <strong className="text-slate-300">₹{d.p25}</strong></div>
                          <div>Lower 5th: <strong className="text-rose-300">₹{d.p5}</strong></div>
                        </div>
                      );
                    }}
                  />

                  <ReferenceLine y={data.entryPrice} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: `Entry ₹${data.entryPrice}`, fill: "#94a3b8", fontSize: 11, position: "left" }} />
                  <ReferenceLine y={data.target1} stroke="#10b981" strokeWidth={1.5} label={{ value: `Target ₹${data.target1}`, fill: "#10b981", fontSize: 11, position: "right" }} />
                  {data.target2 && (
                    <ReferenceLine y={data.target2} stroke="#06b6d4" strokeDasharray="2 2" label={{ value: `Target 2 ₹${data.target2}`, fill: "#06b6d4", fontSize: 11, position: "right" }} />
                  )}
                  <ReferenceLine y={data.stopLoss} stroke="#f43f5e" strokeWidth={1.5} label={{ value: `Stop Loss ₹${data.stopLoss}`, fill: "#f43f5e", fontSize: 11, position: "right" }} />

                  <Area type="monotone" dataKey="p95" stroke="none" fill="url(#pageQuantile90)" />
                  <Area type="monotone" dataKey="p75" stroke="none" fill="url(#pageQuantile50)" />
                  <Area type="monotone" dataKey="p25" stroke="none" fill="#0f172a" />
                  <Area type="monotone" dataKey="p5" stroke="none" fill="#020617" />
                  <Line type="monotone" dataKey="p50" stroke="#a5b4fc" strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Histogram + Diagnostics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
              <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-indigo-400" />
                SIMULATED RETURN DISTRIBUTION (FINAL HISTOGRAM)
              </span>

              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.distributionHistogram} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="binLabel"
                      tick={{ fill: "#94a3b8", fontSize: 10, fontFamily: "monospace" }}
                      axisLine={{ stroke: "#334155" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 10, fontFamily: "monospace" }}
                      axisLine={{ stroke: "#334155" }}
                      tickLine={false}
                      tickFormatter={(val: number) => `${val}%`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200">
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
                          fill={bin.isWin ? "#10b981" : bin.isLoss ? "#f43f5e" : "#64748b"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Volatility & Adverse Excursion Metrics */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between space-y-3">
              <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                MICROSTRUCTURE & DRAWDOWN TOLERANCE
              </span>

              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase block">Daily Volatility</span>
                  <strong className="text-base text-white">{data.dailyVolatilityPct}%</strong>
                  <span className="text-[10px] text-slate-400 block">Annualized: {data.annualizedVolatilityPct}%</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase block">14D Average True Range</span>
                  <strong className="text-base text-white">₹{data.averageTrueRange}</strong>
                  <span className="text-[10px] text-slate-400 block">Typical daily candle wiggle</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-amber-500 uppercase block">Median Drawdown (MAE)</span>
                  <strong className="text-base text-amber-400">-{data.maxAdverseExcursionPct}%</strong>
                  <span className="text-[10px] text-slate-400 block">Normal dip on winning paths</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-rose-500 uppercase block">95th% Max Adverse Dip</span>
                  <strong className="text-base text-rose-400">-{data.p95AdverseExcursionPct}%</strong>
                  <span className="text-[10px] text-slate-400 block">Extreme retracement tolerance</span>
                </div>
              </div>

              <Button
                onClick={() => setSizerOpen(true)}
                className="w-full text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5"
              >
                <Calculator className="w-4 h-4" />
                <span>Calculate Exact Share Size for this Setup</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Position Sizer Modal */}
      {data && (
        <PositionSizerModal
          open={sizerOpen}
          onClose={() => setSizerOpen(false)}
          symbol={symbol}
          defaultEntry={data.entryPrice}
          defaultStopLoss={data.stopLoss}
          defaultTarget1={data.target1}
          defaultTarget2={data.target2}
        />
      )}
    </div>
  );
}
