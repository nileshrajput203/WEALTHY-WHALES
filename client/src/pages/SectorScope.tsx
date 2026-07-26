import { useQuery } from "@tanstack/react-query";
import {
  Scan, TrendingUp, TrendingDown, ArrowUpDown, Activity, Sparkles,
  Landmark, Info, ShieldAlert, AlertTriangle, ArrowRightLeft,
  Percent, Globe, Coins, CalendarDays, BarChart3, HelpCircle, Check
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";

interface SectorData {
  name: string;
  symbol: string;
  change1d: number;
  change1w: number;
  change1m: number;
  topGainer: { symbol: string; change: number };
  topLoser: { symbol: string; change: number };
}

interface MacroOverview {
  economicCycleStage: string;
  recessionProbability: string;
  interestRateCycle: { currentRate: string; outlook: string; impact: string };
  inflationTrend: { currentCPI: string; outlook: string; impact: string };
  gdpGrowth: { forecast: string; outlook: string; impact: string };
  rupeeTrajectory: { current: string; impact: string };
  fiiDiiFlows: { fiiYTD: string; diiYTD: string; impact: string };
}

interface SectorAnalysis {
  name: string;
  indexSymbol: string;
  cyclePosition: string;
  score: number;
  status: string;
  why: string;
  momentum3M: string;
  pe: number;
  pe5Y: number;
  peNifty: number;
  valuationStatus: string;
  earningGrowthFY25: string;
  earningGrowthFY26: string;
  earningsTrend: string;
  keyRisks: { risk: string; severity: string; probability: string }[];
  tacticalPlaybook: string;
}

interface PortfolioAllocation {
  tactical3_6M: { sector: string; weight: number }[];
  medium6_12M: { sector: string; weight: number }[];
  strategic12_24M: { sector: string; weight: number }[];
}

interface RotationTimeline {
  phase: string;
  action: string;
}

interface RotationAnalysisResponse {
  macroOverview: MacroOverview;
  sectors: SectorAnalysis[];
  portfolioAllocation: PortfolioAllocation;
  rotationPlaybook: {
    now: string;
    next: string;
    timeline: RotationTimeline[];
  };
}

export default function SectorScope() {
  const [activeTab, setActiveTab] = useState<"cycle" | "macro" | "valuations">("cycle");
  const [timeframe, setTimeframe] = useState<"1d" | "1w" | "1m">("1d");

  // Query 1: Heatmap performance
  const { data: perfData, isLoading: isPerfLoading } = useQuery<{ sectors: SectorData[] }>({
    queryKey: ["/api/sector-performance"],
    staleTime: 5 * 60 * 1000,
  });

  // Query 2: Deep Sector Rotation analysis
  const { data: analysisData, isLoading: isAnalysisLoading } = useQuery<RotationAnalysisResponse>({
    queryKey: ["/api/sector-rotation-analysis"],
    staleTime: 10 * 60 * 1000,
  });

  const sectors = perfData?.sectors ?? [];
  const sortedSectors = [...sectors].sort((a, b) => {
    const key = timeframe === "1d" ? "change1d" : timeframe === "1w" ? "change1w" : "change1m";
    return b[key] - a[key];
  });

  const getChange = (s: SectorData) =>
    timeframe === "1d" ? s.change1d : timeframe === "1w" ? s.change1w : s.change1m;

  const maxAbsChange = Math.max(...sortedSectors.map(s => Math.abs(getChange(s))), 1);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "STRONG BUY": return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
      case "BUY": return "text-emerald-300 border-emerald-500/20 bg-emerald-500/5";
      case "HOLD": return "text-amber-400 border-amber-500/20 bg-amber-500/5";
      case "SELL / TRIM": return "text-orange-400 border-orange-500/20 bg-orange-500/5";
      case "AVOID": return "text-red-400 border-red-500/30 bg-red-500/10";
      default: return "text-zinc-400 border-zinc-500/20 bg-zinc-500/5";
    }
  };

  const getValStatusColor = (status: string) => {
    switch (status) {
      case "CHEAP": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "FAIR": return "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
      case "EXPENSIVE": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "VERY EXPENSIVE": return "text-red-400 bg-red-500/10 border-red-500/20";
      default: return "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
    }
  };

  const ALLOCATION_COLORS = ["#a855f7", "#3b82f6", "#22c55e", "#eab308", "#f43f5e", "#06b6d4", "#f97316", "#a1a1aa"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1 flex items-center gap-2.5">
            <Scan className="w-7 h-7 text-primary" />
            Sector Rotation Dashboard
          </h1>
          <p className="text-sm text-white/40 font-sans">
            Institutional-grade economic cycle strategy · Relative performance, valuations, macro drivers & allocations
          </p>
        </div>

        {/* Tab buttons */}
        <div className="flex gap-1 bg-white/4 border border-white/8 p-1 rounded-xl self-start sm:self-auto overflow-x-auto scrollbar-none">
          {[
            { key: "cycle", label: "Cycle & Heatmap" },
            { key: "macro", label: "Macro & Playbook" },
            { key: "valuations", label: "Valuations & Earnings" }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap
                ${activeTab === t.key
                  ? "bg-primary/20 border border-primary/45 text-white shadow-[0_0_8px_rgba(168,85,247,0.2)]"
                  : "text-white/40 hover:text-white/85"
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
        >
          {/* TAB 1: SECTOR CYCLE & HEATMAP */}
          {activeTab === "cycle" && (
            <div className="space-y-8">
              {/* Heatmap Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white/85">Sector Performance Heatmap</h3>
                    <p className="text-[11px] text-white/40 font-mono mt-0.5">Timeframe returns of key Indian market indices</p>
                  </div>
                  <div className="flex gap-1.5">
                    {(["1d", "1w", "1m"] as const).map(tf => (
                      <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-mono font-semibold border transition-all ${
                          timeframe === tf
                            ? "bg-primary/25 border-primary/40 text-primary"
                            : "bg-white/3 border-white/6 text-white/40 hover:text-white/60"
                        }`}
                      >
                        {tf === "1d" ? "Today" : tf === "1w" ? "1 Week" : "1 Month"}
                      </button>
                    ))}
                  </div>
                </div>

                {isPerfLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {[...Array(9)].map((_, i) => (
                      <div key={i} className="h-36 rounded-2xl bg-white/3 animate-pulse border border-white/5" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
                    {sortedSectors.map(sector => {
                      const change = getChange(sector);
                      const isPos = change >= 0;
                      const intensity = Math.min(Math.abs(change) / maxAbsChange, 1);
                      const bg = isPos
                        ? `rgba(34, 197, 94, ${0.05 + intensity * 0.2})`
                        : `rgba(239, 68, 68, ${0.05 + intensity * 0.2})`;
                      const borderColor = isPos
                        ? `rgba(34, 197, 94, ${0.1 + intensity * 0.3})`
                        : `rgba(239, 68, 68, ${0.1 + intensity * 0.3})`;

                      return (
                        <div
                          key={sector.symbol}
                          className="rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] cursor-default col-span-2 sm:col-span-1 lg:col-span-3 flex flex-col justify-between min-h-[140px]"
                          style={{ background: bg, border: `1px solid ${borderColor}` }}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <h4 className="text-xs font-semibold text-white/80 truncate">{sector.name}</h4>
                              {isPos ? (
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              ) : (
                                <TrendingDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                              )}
                            </div>
                            <p className={`text-xl font-mono font-bold ${isPos ? "text-emerald-400" : "text-red-400"}`}>
                              {isPos ? "+" : ""}{change.toFixed(2)}%
                            </p>
                          </div>

                          {/* Top / Bot performers in sector */}
                          <div className="space-y-1 border-t border-white/5 pt-2 mt-3">
                            <div className="flex items-center justify-between text-[9px] font-mono">
                              <span className="text-white/20">Top Gainer</span>
                              <span className="text-emerald-400 truncate max-w-[120px]">{sector.topGainer.symbol} (+{sector.topGainer.change.toFixed(1)}%)</span>
                            </div>
                            <div className="flex items-center justify-between text-[9px] font-mono">
                              <span className="text-white/20">Top Loser</span>
                              <span className="text-red-400 truncate max-w-[120px]">{sector.topLoser.symbol} ({sector.topLoser.change.toFixed(1)}%)</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sector Cycle Positioning Matrix */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white/85">📊 SECTOR ROTATION MATRIX (Cycle Positioning)</h3>
                  <p className="text-[11px] text-white/45 font-mono mt-0.5">Sectors mapped to their current stage in the macroeconomic timeline</p>
                </div>

                {isAnalysisLoading ? (
                  <div className="h-64 rounded-2xl bg-white/2 animate-pulse border border-white/5" />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    {[
                      { key: "Growth (Recovery/Early Expansion)", title: "GROWTH / RECOVERY", desc: "Leads bull markets, cheap entry, credit rebound", color: "border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-400" },
                      { key: "Mid-cycle (Slowing Expansion)", title: "MID-CYCLE EXPANSION", desc: "Goldilocks growth phase, earnings peak, Tech favor", color: "border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 text-purple-400" },
                      { key: "Late-cycle (Peak Expansion)", title: "LATE-CYCLE PEAK", desc: "Stretched valuations, rising cost pressures, defensive rotation", color: "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400" },
                      { key: "Recession (Defensive)", title: "RECESSION / DEFENSIVE", desc: "Safety focus, predictable cash flows, counter-cyclical", color: "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400" }
                    ].map(stage => {
                      const stageSectors = analysisData?.sectors.filter(s => s.cyclePosition === stage.key) ?? [];
                      return (
                        <div key={stage.key} className={`rounded-2xl border p-4 space-y-4 transition duration-300 ${stage.color}`}>
                          <div>
                            <span className="text-[10px] font-mono font-bold tracking-wider uppercase block">{stage.title}</span>
                            <span className="text-[9px] text-white/35 font-sans leading-relaxed block mt-0.5">{stage.desc}</span>
                          </div>

                          <div className="space-y-3">
                            {stageSectors.length > 0 ? (
                              stageSectors.map(s => (
                                <div key={s.name} className="bg-white/2 border border-white/4 rounded-xl p-3 space-y-2">
                                  <div className="flex items-start justify-between gap-1.5">
                                    <div>
                                      <h4 className="text-xs font-semibold text-white">{s.name}</h4>
                                      <span className="text-[9px] text-white/35 font-mono">{s.indexSymbol}</span>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                      <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold border ${getStatusColor(s.status)}`}>
                                        {s.status}
                                      </span>
                                      <div className="text-[9px] text-amber-400 font-mono">
                                        {"★".repeat(s.score)}{"☆".repeat(5 - s.score)}
                                      </div>
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-white/50 leading-relaxed font-sans">{s.why}</p>
                                </div>
                              ))
                            ) : (
                              <div className="text-[10px] text-white/20 italic font-mono text-center py-4">
                                No active sectors in this phase
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Relative Performance & Momentum */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white/85">📈 SECTOR RELATIVE PERFORMANCE & MOMENTUM</h3>
                  <p className="text-[11px] text-white/45 font-mono mt-0.5">Indices performance benchmarked against the broader Nifty Index</p>
                </div>

                {isAnalysisLoading ? (
                  <div className="h-48 rounded-2xl bg-white/2 animate-pulse border border-white/5" />
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-white/6">
                    <table className="w-full text-left border-collapse font-sans text-xs">
                      <thead>
                        <tr className="bg-white/4 border-b border-white/6">
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider">Sector Index</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider">Symbol</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">Earnings Trend</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">3-Month Momentum</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {analysisData?.sectors.map((s, idx) => {
                          const isAcc = s.momentum3M.includes("ACCELERATING");
                          const isDec = s.momentum3M.includes("DECELERATING");
                          const statusColor = getStatusColor(s.status);
                          return (
                            <tr key={s.name} className={`hover:bg-white/3 transition ${idx % 2 === 0 ? "bg-white/1" : "bg-transparent"}`}>
                              <td className="px-4 py-3 font-semibold text-white">{s.name}</td>
                              <td className="px-4 py-3 font-mono text-white/40">{s.indexSymbol}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold 
                                  ${s.earningsTrend === "STRONG" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : 
                                    s.earningsTrend === "STEADY" ? "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20" : 
                                    "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                                  {s.earningsTrend}
                                </span>
                              </td>
                              <td className={`px-4 py-3 font-mono text-center font-bold ${isAcc ? "text-emerald-400" : isDec ? "text-rose-400" : "text-zinc-400"}`}>
                                {s.momentum3M}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${statusColor}`}>
                                  {s.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MACRO DRIVERS & PLAYBOOK */}
          {activeTab === "macro" && (
            <div className="space-y-8">
              {/* Macro Drivers Cards */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white/85">🔑 KEY MACRO DRIVERS OF SECTOR ROTATION</h3>
                  <p className="text-[11px] text-white/40 font-mono mt-0.5">Macro forces that trigger shifts in institutional capital</p>
                </div>

                {isAnalysisLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-44 rounded-2xl bg-white/2 animate-pulse border border-white/5" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Interest Rate */}
                    <div className="glass-card rounded-2xl border border-white/6 p-4 flex flex-col justify-between min-h-[170px] hover:border-primary/20 transition duration-300">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center">
                            <Landmark className="w-3.5 h-3.5 text-cyan-400" />
                          </div>
                          <span className="text-xs font-semibold text-white/90">Interest Rate Cycle</span>
                        </div>
                        <div className="text-sm font-mono font-bold text-white mb-2">
                          Rate: {analysisData?.macroOverview.interestRateCycle.currentRate}
                        </div>
                        <p className="text-[11px] text-white/50 leading-relaxed font-sans">
                          Outlook: {analysisData?.macroOverview.interestRateCycle.outlook}
                        </p>
                      </div>
                      <div className="text-[10px] text-cyan-400 font-sans border-t border-white/5 pt-2 mt-3 italic leading-relaxed">
                        Impact: {analysisData?.macroOverview.interestRateCycle.impact}
                      </div>
                    </div>

                    {/* Inflation CPI */}
                    <div className="glass-card rounded-2xl border border-white/6 p-4 flex flex-col justify-between min-h-[170px] hover:border-primary/20 transition duration-300">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/25 flex items-center justify-center">
                            <Percent className="w-3.5 h-3.5 text-orange-400" />
                          </div>
                          <span className="text-xs font-semibold text-white/90">Inflation CPI Trend</span>
                        </div>
                        <div className="text-sm font-mono font-bold text-white mb-2">
                          CPI: {analysisData?.macroOverview.inflationTrend.currentCPI}
                        </div>
                        <p className="text-[11px] text-white/50 leading-relaxed font-sans">
                          Outlook: {analysisData?.macroOverview.inflationTrend.outlook}
                        </p>
                      </div>
                      <div className="text-[10px] text-orange-400 font-sans border-t border-white/5 pt-2 mt-3 italic leading-relaxed">
                        Impact: {analysisData?.macroOverview.inflationTrend.impact}
                      </div>
                    </div>

                    {/* GDP Growth */}
                    <div className="glass-card rounded-2xl border border-white/6 p-4 flex flex-col justify-between min-h-[170px] hover:border-primary/20 transition duration-300">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <span className="text-xs font-semibold text-white/90">GDP Growth Outlook</span>
                        </div>
                        <div className="text-sm font-mono font-bold text-white mb-2">
                          Forecast: {analysisData?.macroOverview.gdpGrowth.forecast}
                        </div>
                        <p className="text-[11px] text-white/50 leading-relaxed font-sans">
                          Outlook: {analysisData?.macroOverview.gdpGrowth.outlook}
                        </p>
                      </div>
                      <div className="text-[10px] text-emerald-400 font-sans border-t border-white/5 pt-2 mt-3 italic leading-relaxed">
                        Impact: {analysisData?.macroOverview.gdpGrowth.impact}
                      </div>
                    </div>

                    {/* Forex USD/INR */}
                    <div className="glass-card rounded-2xl border border-white/6 p-4 flex flex-col justify-between min-h-[170px] hover:border-primary/20 transition duration-300">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/25 flex items-center justify-center">
                            <Globe className="w-3.5 h-3.5 text-purple-400" />
                          </div>
                          <span className="text-xs font-semibold text-white/90">Rupee Trajectory</span>
                        </div>
                        <div className="text-sm font-mono font-bold text-white mb-2">
                          Level: {analysisData?.macroOverview.rupeeTrajectory.current}
                        </div>
                      </div>
                      <div className="text-[10px] text-purple-400 font-sans border-t border-white/5 pt-2 mt-3 italic leading-relaxed">
                        Impact: {analysisData?.macroOverview.rupeeTrajectory.impact}
                      </div>
                    </div>

                    {/* FII DII Flows */}
                    <div className="glass-card rounded-2xl border border-white/6 p-4 flex flex-col justify-between min-h-[170px] hover:border-primary/20 transition duration-300 col-span-1 md:col-span-2 lg:col-span-2">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-pink-500/10 border border-pink-500/25 flex items-center justify-center">
                            <Coins className="w-3.5 h-3.5 text-pink-400" />
                          </div>
                          <span className="text-xs font-semibold text-white/90">FII / DII Institutional Flows</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-2">
                          <div>FII Inflows: <span className="text-emerald-400 font-bold">{analysisData?.macroOverview.fiiDiiFlows.fiiYTD}</span></div>
                          <div>DII Inflows: <span className="text-emerald-400 font-bold">{analysisData?.macroOverview.fiiDiiFlows.diiYTD}</span></div>
                        </div>
                      </div>
                      <div className="text-[10px] text-pink-400 font-sans border-t border-white/5 pt-2 mt-3 italic leading-relaxed">
                        Impact: {analysisData?.macroOverview.fiiDiiFlows.impact}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Allocation Roadmap */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white/85">💼 SECTOR ALLOCATION ROADMAP (Portfolio Strategy)</h3>
                  <p className="text-[11px] text-white/45 font-mono mt-0.5">Target sector weights mapped to different holding timelines</p>
                </div>

                {isAnalysisLoading ? (
                  <div className="h-64 rounded-2xl bg-white/2 animate-pulse border border-white/5" />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {[
                      { title: "Tactical Trading (3-6 Months)", key: "tactical3_6M", desc: "Momentum capture, rotation leaders" },
                      { title: "Medium-Term (6-12 Months)", key: "medium6_12M", desc: "Valuation accumulation, structural transition" },
                      { title: "Strategic Investing (12-24 Months)", key: "strategic12_24M", desc: "Long-term capex theme, secular compounders" }
                    ].map(road => {
                      const allocations = analysisData?.portfolioAllocation[road.key as keyof PortfolioAllocation] ?? [];
                      return (
                        <div key={road.key} className="glass-card rounded-2xl border border-white/6 p-5 space-y-4">
                          <div>
                            <h4 className="text-xs font-bold text-white font-display tracking-wide uppercase">{road.title}</h4>
                            <span className="text-[9px] text-white/35 font-mono">{road.desc}</span>
                          </div>

                          <div className="space-y-3">
                            {allocations.map((a, idx) => (
                              <div key={a.sector} className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-mono">
                                  <span className="text-white/60 font-sans">{a.sector}</span>
                                  <span className="font-bold text-primary">{a.weight}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${a.weight}%`,
                                      background: ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length]
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Playbook Play Timeline */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white/85">🔄 SECTOR ROTATION PLAYBOOK</h3>
                  <p className="text-[11px] text-white/45 font-mono mt-0.5">Execution steps to stay aligned with market cycles</p>
                </div>

                {isAnalysisLoading ? (
                  <div className="h-44 rounded-2xl bg-white/2 animate-pulse border border-white/5" />
                ) : (
                  <div className="glass-card rounded-2xl border border-white/6 p-5 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2 border-r border-white/5 pr-0 md:pr-6">
                        <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Rotation Happening Now</span>
                        <p className="text-xs text-white/85 font-sans leading-relaxed">{analysisData?.rotationPlaybook.now}</p>
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Rotation Expected Next</span>
                        <p className="text-xs text-white/85 font-sans leading-relaxed">{analysisData?.rotationPlaybook.next}</p>
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-4">
                      <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block mb-3">Tactical Timeline</span>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {analysisData?.rotationPlaybook.timeline.map((t, idx) => (
                          <div key={idx} className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
                            <span className="text-[11px] font-bold text-primary font-mono">{t.phase}</span>
                            <p className="text-[11px] text-white/70 font-sans leading-relaxed">{t.action}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: VALUATIONS & EARNINGS MATRIX */}
          {activeTab === "valuations" && (
            <div className="space-y-8">
              {/* Valuation & Earnings Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Valuations Table */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white/85">💰 SECTOR VALUATION SNAPSHOT</h3>
                    <p className="text-[11px] text-white/40 font-mono mt-0.5">Average P/E valuations benchmarked historically</p>
                  </div>

                  {isAnalysisLoading ? (
                    <div className="h-56 rounded-2xl bg-white/2 animate-pulse border border-white/5" />
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-white/6">
                      <table className="w-full text-left border-collapse font-sans text-xs">
                        <thead>
                          <tr className="bg-white/4 border-b border-white/6">
                            <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider">Sector</th>
                            <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">PE</th>
                            <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">5Y PE</th>
                            <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">Nifty PE</th>
                            <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-right">Valuation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {analysisData?.sectors.map((s, idx) => (
                            <tr key={s.name} className={idx % 2 === 0 ? "bg-white/1" : "bg-transparent"}>
                              <td className="px-4 py-3 font-semibold text-white">{s.name}</td>
                              <td className="px-4 py-3 font-mono text-center text-white/80">{s.pe.toFixed(1)}x</td>
                              <td className="px-4 py-3 font-mono text-center text-white/40">{s.pe5Y.toFixed(1)}x</td>
                              <td className="px-4 py-3 font-mono text-center text-white/35">19.5x</td>
                              <td className="px-4 py-3 text-right">
                                <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-mono font-bold border ${getValStatusColor(s.valuationStatus)}`}>
                                  {s.valuationStatus}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Earnings Table */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white/85">📈 SECTOR EARNINGS CYCLE</h3>
                    <p className="text-[11px] text-white/40 font-mono mt-0.5">Corporate earnings expansion rates and YoY forecasts</p>
                  </div>

                  {isAnalysisLoading ? (
                    <div className="h-56 rounded-2xl bg-white/2 animate-pulse border border-white/5" />
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-white/6">
                      <table className="w-full text-left border-collapse font-sans text-xs">
                        <thead>
                          <tr className="bg-white/4 border-b border-white/6">
                            <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider">Sector</th>
                            <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">FY25E Growth</th>
                            <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">FY26E Growth</th>
                            <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-right">Trend</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {analysisData?.sectors.map((s, idx) => (
                            <tr key={s.name} className={idx % 2 === 0 ? "bg-white/1" : "bg-transparent"}>
                              <td className="px-4 py-3 font-semibold text-white">{s.name}</td>
                              <td className="px-4 py-3 font-mono text-center text-white/80">{s.earningGrowthFY25}</td>
                              <td className="px-4 py-3 font-mono text-center text-white/80">{s.earningGrowthFY26}</td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">{s.earningsTrend}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Risk Assessment Matrix */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white/85">⚠️ SECTOR RISK ASSESSMENT</h3>
                  <p className="text-[11px] text-white/45 font-mono mt-0.5">Summary of core external risks and likelihood parameters</p>
                </div>

                {isAnalysisLoading ? (
                  <div className="h-56 rounded-2xl bg-white/2 animate-pulse border border-white/5" />
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-white/6">
                    <table className="w-full text-left border-collapse font-sans text-xs">
                      <thead>
                        <tr className="bg-white/4 border-b border-white/6">
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider">Sector</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider">Key Red Flag / Risk Factor</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">Severity</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-right">Probability</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {analysisData?.sectors.map((s, idx) => (
                          <tr key={s.name} className={idx % 2 === 0 ? "bg-white/1" : "bg-transparent"}>
                            <td className="px-4 py-3 font-semibold text-white">{s.name}</td>
                            <td className="px-4 py-3 text-white/70 leading-relaxed font-sans">{s.keyRisks[0]?.risk || "—"}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border 
                                ${s.keyRisks[0]?.severity === "High" ? "text-red-400 bg-red-500/10 border-red-500/25" : 
                                  s.keyRisks[0]?.severity === "Medium" ? "text-amber-400 bg-amber-500/10 border-amber-500/25" : 
                                  "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"}`}>
                                {s.keyRisks[0]?.severity || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-white/40">{s.keyRisks[0]?.probability || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Complete Comparison Matrix */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white/85">📊 SECTOR COMPARISON MATRIX (All-in-One)</h3>
                  <p className="text-[11px] text-white/45 font-mono mt-0.5">Quick reference comparison matrix across all core dimensions</p>
                </div>

                {isAnalysisLoading ? (
                  <div className="h-64 rounded-2xl bg-white/2 animate-pulse border border-white/5" />
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-white/6">
                    <table className="w-full text-left border-collapse font-sans text-xs">
                      <thead>
                        <tr className="bg-white/4 border-b border-white/6">
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider">Sector</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">P/E</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">5Y P/E</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">FY25 Growth</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">Momentum</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">Earnings Cycle</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {analysisData?.sectors.map((s, idx) => {
                          const statusColor = getStatusColor(s.status);
                          return (
                            <tr key={s.name} className={idx % 2 === 0 ? "bg-white/1" : "bg-transparent"}>
                              <td className="px-4 py-3 font-bold text-white">{s.name}</td>
                              <td className="px-4 py-3 font-mono text-center text-white/80">{s.pe.toFixed(1)}x</td>
                              <td className="px-4 py-3 font-mono text-center text-white/40">{s.pe5Y.toFixed(1)}x</td>
                              <td className="px-4 py-3 font-mono text-center text-emerald-400">{s.earningGrowthFY25}</td>
                              <td className="px-4 py-3 font-mono text-center text-white/70">{s.momentum3M}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border 
                                  ${s.earningsTrend === "STRONG" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : 
                                    s.earningsTrend === "STEADY" ? "text-zinc-300 border-zinc-500/20 bg-zinc-500/5" : 
                                    "text-rose-400 border-rose-500/30 bg-rose-500/10"}`}>
                                  {s.earningsTrend}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${statusColor}`}>
                                  {s.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
