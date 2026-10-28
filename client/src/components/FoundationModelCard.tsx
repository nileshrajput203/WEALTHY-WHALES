import { useQuery } from "@tanstack/react-query";
import {
  Brain,
  Cpu,
  Zap,
  TrendingUp,
  TrendingDown,
  Layers,
  Activity,
  Calendar,
  Sparkles,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Clock,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface FoundationModelData {
  status: string;
  symbol: string;
  isFnO?: boolean;
  marketSegment?: "F&O" | "CASH";
  timestamp: string;
  hermesConvictionScore: number;
  alpha158?: {
    alphaScore: number;
    rsRating: number;
    momentum: {
      roc5d: number;
      roc20d: number;
      roc60d: number;
      roc250d: number;
    };
    volumeMetrics: {
      volumeRatio20d: number;
      volumePriceCorr: number;
      annualizedVolatilityPct: number;
    };
  };
  forecast?: {
    kronosModel: string;
    chronosModel: string;
    lastClose: number;
    predictedCloseT5: number;
    expectedReturnPct: number;
    bullishProbability: number;
    chronosQuantiles: {
      p10Bearish: number[];
      p50Base: number[];
      p90Bullish: number[];
    };
  };
  intradayFO?: {
    setupType: string;
    direction: "BULLISH" | "BEARISH" | "NEUTRAL";
    confidence: number;
    isFnO?: boolean;
    segment?: "F&O" | "CASH";
    segmentLabel?: string;
    foBuildup?: string;
    pcr?: number | null;
    optionStrikeSuggestion?: string | null;
    cashTradeSuggestion?: string | null;
    levels: {
      spotEntry: number;
      stopLoss: number;
      target1: number;
      target2: number;
      vwap: number;
      atr14: number;
    };
    emaStack: {
      ema9: number;
      ema20: number;
      ema50: number;
      ema200: number;
      aboveAllEmas: boolean;
      belowAllEmas: boolean;
    };
  };
  seasonality?: {
    currentMonth: string;
    currentMonthWinRatePct: number;
    currentMonthAvgReturnPct: number;
    isSeasonalTailwindNow: boolean;
    bestHistoricalMonth: string;
    worstHistoricalMonth: string;
  };
  institutionalVerdict?: {
    verdict: string;
    compositeScore: number;
    actionableSummary: string;
    weinsteinStage: string;
    pctBelow52WHigh: number;
    cpr: {
      pivot: number;
      topCentral: number;
      bottomCentral: number;
      cprWidthPct: number;
      isNarrowTrendingCPR: boolean;
    };
  };
}

interface FoundationModelCardProps {
  symbol: string;
  currentPrice?: number;
}

export function FoundationModelCard({ symbol, currentPrice }: FoundationModelCardProps) {
  const cleanSymbol = (symbol || "RELIANCE").replace(/\.(NS|BO)$/i, "");

  const { data, isLoading, isError } = useQuery<FoundationModelData>({
    queryKey: ["/api/quant/forecast", cleanSymbol],
    queryFn: async () => {
      const res = await fetch(`/api/quant/forecast/${cleanSymbol}`);
      if (!res.ok) throw new Error("Failed to load foundation model forecast");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 p-6 bg-gradient-to-b from-slate-900/90 to-slate-950/90 backdrop-blur-md space-y-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 bg-white/10 rounded w-1/3" />
            <div className="h-3 bg-white/5 rounded w-1/4" />
          </div>
        </div>
        <div className="h-44 bg-white/5 rounded-xl" />
      </div>
    );
  }

  if (isError || !data || data.status === "error") {
    return null;
  }

  const { forecast, alpha158, intradayFO, seasonality, hermesConvictionScore } = data;
  const quantiles = forecast?.chronosQuantiles;

  // Build chart points for the probabilistic cone (Last Close -> T+1..T+5)
  const chartData = [
    {
      step: "Current",
      p10: forecast?.lastClose || currentPrice || 0,
      p50: forecast?.lastClose || currentPrice || 0,
      p90: forecast?.lastClose || currentPrice || 0,
    },
  ];

  if (quantiles?.p50Base) {
    quantiles.p50Base.forEach((p50, i) => {
      chartData.push({
        step: `T+${i + 1}`,
        p10: quantiles.p10Bearish[i] ?? p50,
        p50: p50,
        p90: quantiles.p90Bullish[i] ?? p50,
      });
    });
  }

  const isBullish = (forecast?.expectedReturnPct ?? 0) >= 0;
  const returnColor = isBullish ? "text-emerald-400" : "text-rose-400";
  const badgeBorder = isBullish ? "border-emerald-500/30 bg-emerald-500/10" : "border-rose-500/30 bg-rose-500/10";

  return (
    <div className="rounded-2xl border border-indigo-500/20 p-6 bg-gradient-to-b from-[#0c101d] to-[#080b14] space-y-6 shadow-2xl relative overflow-hidden group">
      {/* Background soft ambient glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      {/* Header with Foundation Model Badges */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
              <Brain className="w-4 h-4 text-indigo-400" />
              FOUNDATION MODEL ENSEMBLE
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
              <Cpu className="w-3 h-3 text-indigo-400" />
              Amazon Chronos-Bolt · Zero-Shot Transformer
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              MSFT Alpha158
            </span>
          </div>

          <h3 className="text-xl font-bold font-display text-white tracking-tight flex items-center gap-2">
            Probabilistic Price Trajectory & Quantile Cone
          </h3>
        </div>

        {/* HERMES Conviction Score Pill */}
        <div className="flex items-center gap-3">
          <div className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2 text-right">
            <div className="text-[10px] font-mono text-white/40 uppercase">Hermes Conviction</div>
            <div className="text-lg font-mono font-black text-indigo-300 flex items-center justify-end gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              {hermesConvictionScore}/100
            </div>
          </div>
          <div className={`px-4 py-2 rounded-xl border ${badgeBorder} text-right`}>
            <div className="text-[10px] font-mono text-white/40 uppercase">T+5 Target</div>
            <div className={`text-lg font-mono font-black ${returnColor} flex items-center justify-end gap-1`}>
              {isBullish ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {forecast?.expectedReturnPct && forecast.expectedReturnPct > 0 ? `+${forecast.expectedReturnPct}%` : `${forecast?.expectedReturnPct}%`}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Probabilistic Forecast Cone Chart + Model Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Probabilistic Quantile Cone (8 cols) */}
        <div className="lg:col-span-8 bg-black/30 border border-white/5 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-white/60 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              Chronos-Bolt Quantile Band (P10 Bearish · P50 Median · P90 Bullish)
            </span>
            <span className="text-indigo-400 text-[11px]">
              Predicted T+5: ₹{forecast?.predictedCloseT5.toLocaleString("en-IN")}
            </span>
          </div>

          {/* Area Chart with Quantile Shading */}
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="quantileConeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="step" stroke="#475569" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#475569"
                  fontSize={11}
                  domain={["dataMin - 15", "dataMax + 15"]}
                  tickLine={false}
                  tickFormatter={(val) => `₹${Math.round(val)}`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const p10 = payload.find((p) => p.dataKey === "p10")?.value;
                      const p50 = payload.find((p) => p.dataKey === "p50")?.value;
                      const p90 = payload.find((p) => p.dataKey === "p90")?.value;
                      return (
                        <div className="bg-slate-900/95 border border-slate-700 p-3 rounded-lg shadow-xl font-mono text-xs space-y-1">
                          <div className="font-bold text-white border-b border-white/10 pb-1">{label} Horizon</div>
                          <div className="text-emerald-400">P90 (Bullish Ceiling): ₹{Number(p90).toFixed(2)}</div>
                          <div className="text-indigo-300 font-bold">P50 (Median Base): ₹{Number(p50).toFixed(2)}</div>
                          <div className="text-rose-400">P10 (Bearish Floor): ₹{Number(p10).toFixed(2)}</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {/* Upper P90 Bound */}
                <Area type="monotone" dataKey="p90" stroke="#10b981" strokeWidth={1.5} fillOpacity={0} strokeDasharray="3 3" />
                {/* Middle P50 Forecast Line */}
                <Area type="monotone" dataKey="p50" stroke="#818cf8" strokeWidth={2.5} fill="url(#quantileConeGrad)" />
                {/* Lower P10 Bound */}
                <Area type="monotone" dataKey="p10" stroke="#f43f5e" strokeWidth={1.5} fillOpacity={0} strokeDasharray="3 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-white/40 pt-1 border-t border-white/5">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-emerald-400" /> P90 Max Extension: ₹{quantiles?.p90Bullish.at(-1)?.toLocaleString("en-IN")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-indigo-400" /> P50 Base: ₹{quantiles?.p50Base.at(-1)?.toLocaleString("en-IN")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-rose-400" /> P10 Stop Risk: ₹{quantiles?.p10Bearish.at(-1)?.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Right: Alpha158 + Factor Highlights (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* MarketSmith RS Rating */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-white/50 uppercase">MarketSmith RS Rating</span>
              <span className="text-sm font-mono font-black text-amber-300">
                {alpha158?.rsRating ?? 50}/99
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full"
                style={{ width: `${alpha158?.rsRating ?? 50}%` }}
              />
            </div>
            <span className="text-[10px] text-white/40 block">
              {(alpha158?.rsRating ?? 50) >= 80
                ? "Outperforming 80%+ of all NSE stocks (True Institutional Leader)"
                : (alpha158?.rsRating ?? 50) >= 50
                ? "Moderate relative strength vs broader market"
                : "Lagging relative momentum vs Nifty 50"}
            </span>
          </div>

          {/* Intraday Multi-EMA Setup: Intelligently adapts between F&O Derivatives vs Cash Market */}
          {intradayFO && (() => {
            const isFnO = intradayFO.isFnO ?? (data.isFnO ?? false);
            const dirColor =
              intradayFO.direction === "BULLISH"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                : intradayFO.direction === "BEARISH"
                ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                : "bg-amber-500/15 text-amber-300 border border-amber-500/30";

            return (
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono gap-2 flex-wrap">
                  <span className="text-white/60 uppercase flex items-center gap-1.5 font-bold">
                    {isFnO ? (
                      <>
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        Intraday F&O Ribbon
                      </>
                    ) : (
                      <>
                        <Activity className="w-3.5 h-3.5 text-cyan-400" />
                        Intraday Cash Setup
                      </>
                    )}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-bold border ${
                        isFnO
                          ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                          : "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                      }`}
                    >
                      {isFnO ? "F&O Eligible" : "Cash Only"}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${dirColor}`}>
                      {intradayFO.direction} ({intradayFO.confidence}%)
                    </span>
                  </div>
                </div>

                {isFnO ? (
                  /* F&O Stocks: Authentic Option Strike & OI Buildup */
                  <div className="space-y-1">
                    <div className="text-[11px] font-mono text-white/70">
                      Suggested Strike:{" "}
                      <span className="text-white font-bold">{intradayFO.optionStrikeSuggestion || "ATM Strike"}</span>
                      {intradayFO.pcr && (
                        <span className="text-white/40 text-[10px] ml-2">
                          (PCR: {intradayFO.pcr})
                        </span>
                      )}
                    </div>
                    {intradayFO.foBuildup && intradayFO.foBuildup !== "NOT_APPLICABLE" && (
                      <div className="text-[10px] font-mono text-indigo-300">
                        OI Positioning: {intradayFO.foBuildup.replace(/_/g, " ")}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Non-F&O Stocks: Accurate Cash Market Execution Guidance (No Fake Strikes) */
                  <div className="space-y-1">
                    <div className="text-[11px] font-mono text-white/80">
                      <span className="text-cyan-400 font-medium">Cash Action: </span>
                      <span>
                        {intradayFO.cashTradeSuggestion ||
                          `Trade via Cash/MIS · Target: ₹${intradayFO.levels.target1} · SL: ₹${intradayFO.levels.stopLoss}`}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-white/40 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-cyan-400/60" />
                      <span>Non-F&O Counter · Options & Derivatives not traded on NSE</span>
                    </div>
                  </div>
                )}

                <div className="text-[10px] font-mono text-white/40 pt-1 border-t border-white/5 flex items-center justify-between">
                  <span>VWAP: ₹{intradayFO.levels.vwap}</span>
                  <span>ATR(14): ₹{intradayFO.levels.atr14}</span>
                  <span>SL: ₹{intradayFO.levels.stopLoss}</span>
                </div>
              </div>
            );
          })()}

          {/* 10-Year Seasonality Insight */}
          {seasonality && (
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-white/50 uppercase flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  {seasonality.currentMonth} Seasonality
                </span>
                <span
                  className={`text-xs font-bold font-mono ${
                    seasonality.currentMonthWinRatePct >= 60 ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {seasonality.currentMonthWinRatePct}% Win Rate
                </span>
              </div>
              <div className="text-[10px] font-mono text-white/50">
                Avg Monthly Return: {seasonality.currentMonthAvgReturnPct > 0 ? `+${seasonality.currentMonthAvgReturnPct}%` : `${seasonality.currentMonthAvgReturnPct}%`}
              </div>
              <div className="text-[10px] text-white/40">
                Best Month: <span className="text-emerald-400">{seasonality.bestHistoricalMonth}</span> · Worst:{" "}
                <span className="text-rose-400">{seasonality.worstHistoricalMonth}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
