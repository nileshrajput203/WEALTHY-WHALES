import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Zap,
  Filter,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Flame,
} from "lucide-react";
import { Link } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MonthlyStats {
  month: number;
  monthName: string;
  avgReturnPct: number;
  winRatePct: number;
  medianReturnPct: number;
  maxDrawdownPct: number;
}

interface SectorSeasonality {
  sector: string;
  currentMonthRank: number;
  currentMonthWinRate: number;
  currentMonthAvgReturn: number;
  verdict: "STRONG_SEASONAL_TAILWIND" | "MODERATE_TAILWIND" | "NEUTRAL" | "SEASONAL_HEADWIND";
  monthlyData: MonthlyStats[];
  topHistoricalStocks: string[];
}

interface StockSeasonalityItem {
  symbol: string;
  companyName: string;
  sector: string;
  winRatePct: number;
  avgReturnPct: number;
  medianReturnPct: number;
  maxDrawdownPct: number;
  consistencyScore: number;
  confluence: {
    emaBullishToday: boolean;
    newsCatalystPositive: boolean;
    rsLeader: boolean;
    hasConfluence: boolean;
  };
}

function getHeatmapCellStyles(winRatePct: number, avgReturnPct: number, isSelected: boolean) {
  let bgStyle = "";
  let winRateTextColor = "";
  let returnTextColor = "";

  if (avgReturnPct >= 2.5 || (avgReturnPct >= 1.2 && winRatePct >= 75)) {
    // Strong Bullish Tailwind
    bgStyle = "bg-emerald-950/95 border border-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.25)]";
    winRateTextColor = "text-emerald-200 font-black";
    returnTextColor = "text-emerald-300 font-bold";
  } else if (avgReturnPct >= 0.75 || (avgReturnPct > 0 && winRatePct >= 60)) {
    // Solid Bullish
    bgStyle = "bg-emerald-950/70 border border-emerald-600/45 shadow-xs";
    winRateTextColor = "text-emerald-300 font-bold";
    returnTextColor = "text-emerald-400 font-semibold";
  } else if (avgReturnPct > 0) {
    // Mild Bullish
    bgStyle = "bg-emerald-950/45 border border-emerald-700/35";
    winRateTextColor = "text-emerald-300/90 font-semibold";
    returnTextColor = "text-emerald-400/90";
  } else if (avgReturnPct === 0 || (avgReturnPct > -0.3 && avgReturnPct < 0.3 && winRatePct >= 45 && winRatePct <= 55)) {
    // Neutral / Flat
    bgStyle = "bg-slate-900/80 border border-slate-700/60";
    winRateTextColor = "text-slate-200 font-bold";
    returnTextColor = "text-slate-400";
  } else if (avgReturnPct <= -2.5 || (avgReturnPct <= -1.0 && winRatePct <= 35)) {
    // Strong Bearish Headwind
    bgStyle = "bg-rose-950/95 border border-rose-500/60 shadow-[0_0_10px_rgba(244,63,94,0.25)]";
    winRateTextColor = "text-rose-200 font-black";
    returnTextColor = "text-rose-300 font-bold";
  } else if (avgReturnPct <= -0.75 || winRatePct <= 45) {
    // Solid Bearish
    bgStyle = "bg-rose-950/70 border border-rose-600/45 shadow-xs";
    winRateTextColor = "text-rose-300 font-bold";
    returnTextColor = "text-rose-400 font-semibold";
  } else {
    // Mild Bearish
    bgStyle = "bg-rose-950/45 border border-rose-700/35";
    winRateTextColor = "text-rose-300/90 font-semibold";
    returnTextColor = "text-rose-400/90";
  }

  const selectionRing = isSelected
    ? "ring-2 ring-indigo-400 border-indigo-400 shadow-[0_0_12px_rgba(129,140,248,0.4)]"
    : "";

  return { bgStyle, winRateTextColor, returnTextColor, selectionRing };
}

export default function Seasonality() {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>("ALL");

  const { data: matrixData, isLoading: matrixLoading } = useQuery<{
    currentMonth: number;
    currentMonthName: string;
    sectors: SectorSeasonality[];
    activeEventCycle: any;
    eventCycles: any[];
  }>({
    queryKey: ["/api/seasonality/matrix"],
  });

  const { data: stockRankings, isLoading: stocksLoading } = useQuery<StockSeasonalityItem[]>({
    queryKey: ["/api/seasonality/stocks", selectedMonth, selectedSectorFilter],
    queryFn: async () => {
      const res = await fetch(`/api/seasonality/stocks?month=${selectedMonth}&sector=${selectedSectorFilter}`);
      return res.json();
    },
  });

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-6 h-6 text-indigo-400" />
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
            Seasonality & Regularity Engine
          </h1>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            10-YEAR HISTORICAL AUDIT
          </span>
        </div>
        <p className="text-sm text-slate-300 font-sans">
          Discover recurring institutional buying cycles, event-driven anomalies, and high-probability seasonal winners.
        </p>
      </div>

      {/* Active Event Cycle Banner */}
      {matrixData?.activeEventCycle && (
        <div className="glass-card rounded-2xl p-5 border border-indigo-500/35 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900/60 relative overflow-hidden shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-indigo-300 font-mono text-xs font-bold mb-1">
                <Flame className="w-4 h-4 text-amber-400" />
                ACTIVE CYCLE: {matrixData.activeEventCycle.title} ({matrixData.activeEventCycle.dates})
              </div>
              <p className="text-sm text-slate-200 font-sans">
                {matrixData.activeEventCycle.theme} · Historical Sector Win Rate:{" "}
                <span className="text-emerald-300 font-black font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40">
                  {matrixData.activeEventCycle.historicalWinRate}%
                </span>{" "}
                (Avg Return: +{matrixData.activeEventCycle.avgSectorReturn}%)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400 font-semibold">Top Plays:</span>
              <div className="flex gap-1.5">
                {matrixData.activeEventCycle.recommendedPlays.map((sym: string) => (
                  <Link
                    key={sym}
                    href={`/stock/${sym}`}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-indigo-950/80 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/40 transition-all shadow-xs"
                  >
                    {sym}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 12-Month Sector Seasonality Heatmap */}
      <div className="glass-card rounded-2xl border border-slate-800 p-6 bg-[#0c1017]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              12-Month Sector Seasonality Matrix
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Cells display: Win Rate % · Avg Return % (10-Year Historical Data)
            </p>
          </div>

          {/* Month Selector Tabs */}
          <div className="flex flex-wrap gap-1">
            {monthNames.map((name, i) => (
              <button
                key={name}
                onClick={() => setSelectedMonth(i + 1)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                  selectedMonth === i + 1
                    ? "bg-indigo-600 text-white border-indigo-400 font-black shadow-lg shadow-indigo-600/30"
                    : "bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Heatmap Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase">
                <th className="py-2.5 px-3 min-w-[160px]">Sector</th>
                {monthNames.map((m, i) => (
                  <th
                    key={m}
                    className={`py-2.5 px-2 text-center min-w-[65px] transition-colors ${
                      selectedMonth === i + 1
                        ? "bg-indigo-600/25 text-indigo-300 font-black rounded-t-lg border-t-2 border-indigo-500"
                        : "text-slate-400"
                    }`}
                  >
                    {m}
                  </th>
                ))}
                <th className="py-2.5 px-3 text-right">Top Leader</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs font-mono">
              {matrixData?.sectors.map((sector) => (
                <tr key={sector.sector} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-100 flex items-center gap-1.5">
                    {sector.sector}
                    {sector.currentMonthRank <= 2 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-mono font-black shadow-xs">
                        #{sector.currentMonthRank}
                      </span>
                    )}
                  </td>
                  {sector.monthlyData.map((m) => {
                    const isSelected = selectedMonth === m.month;
                    const { bgStyle, winRateTextColor, returnTextColor, selectionRing } =
                      getHeatmapCellStyles(m.winRatePct, m.avgReturnPct, isSelected);

                    return (
                      <td
                        key={m.month}
                        className={`py-1.5 px-1 text-center ${
                          isSelected ? "bg-indigo-950/20" : ""
                        }`}
                      >
                        <div
                          className={`p-1.5 rounded-lg border transition-all ${bgStyle} ${selectionRing}`}
                        >
                          <div className={`text-[11px] leading-tight ${winRateTextColor}`}>
                            {m.winRatePct}%
                          </div>
                          <div className={`text-[10px] leading-tight font-mono mt-0.5 ${returnTextColor}`}>
                            {m.avgReturnPct > 0 ? "+" : ""}
                            {m.avgReturnPct}%
                          </div>
                        </div>
                      </td>
                    );
                  })}
                  <td className="py-3 px-3 text-right">
                    <Link
                      href={`/stock/${sector.topHistoricalStocks[0]}`}
                      className="font-bold font-mono text-indigo-400 hover:text-indigo-300 hover:underline tracking-wider"
                    >
                      {sector.topHistoricalStocks[0]}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Seasonality & Regularity Scanner */}
      <div className="glass-card rounded-2xl border border-slate-800 p-6 bg-[#0c1017]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Stock Regularity Scanner: {monthNames[selectedMonth - 1]} Season Winners
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Computed from 10-Year (120 Monthly Bars) Exchange Data · Sample Size: N=10 Years · Zero Simulated Data
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <Select
              value={selectedSectorFilter}
              onValueChange={(val) => setSelectedSectorFilter(val)}
            >
              <SelectTrigger className="w-[160px] h-8 text-xs font-mono bg-slate-900 border border-slate-700 text-slate-100 rounded-xl focus:border-indigo-500">
                <SelectValue placeholder="All Sectors" />
              </SelectTrigger>
              <SelectContent className="bg-[#0b0f19] border border-slate-700 text-slate-100 shadow-2xl z-50">
                <SelectItem value="ALL" className="text-slate-100 hover:bg-slate-800 cursor-pointer">All Sectors</SelectItem>
                <SelectItem value="Banking" className="text-slate-100 hover:bg-slate-800 cursor-pointer">Banking</SelectItem>
                <SelectItem value="IT" className="text-slate-100 hover:bg-slate-800 cursor-pointer">IT</SelectItem>
                <SelectItem value="Auto" className="text-slate-100 hover:bg-slate-800 cursor-pointer">Auto</SelectItem>
                <SelectItem value="Pharma" className="text-slate-100 hover:bg-slate-800 cursor-pointer">Pharma</SelectItem>
                <SelectItem value="Energy" className="text-slate-100 hover:bg-slate-800 cursor-pointer">Energy</SelectItem>
                <SelectItem value="Capital Goods" className="text-slate-100 hover:bg-slate-800 cursor-pointer">Capital Goods</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stock Regularity Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase">
                <th className="py-3 px-3">Ticker / Company</th>
                <th className="py-3 px-3">Sector</th>
                <th className="py-3 px-3 text-center">10-Yr Win Rate (N=10)</th>
                <th className="py-3 px-3 text-center">Avg / Med Return</th>
                <th className="py-3 px-3 text-center">Sharpe Consistency</th>
                <th className="py-3 px-3 text-center">Live Technical Confluence</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs font-mono">
              {stockRankings?.map((stock) => (
                <tr key={stock.symbol} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-white text-sm font-mono tracking-tight">{stock.symbol}</div>
                    <div className="text-[11px] text-slate-400 font-sans">{stock.companyName}</div>
                  </td>
                  <td className="py-3.5 px-3 text-slate-300 font-sans">{stock.sector}</td>
                  <td className="py-3.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-md font-bold font-mono border ${
                      stock.winRatePct >= 75
                        ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/50 shadow-xs"
                        : stock.winRatePct >= 60
                        ? "bg-emerald-950/60 text-emerald-300 border-emerald-600/35"
                        : stock.winRatePct >= 50
                        ? "bg-amber-950/80 text-amber-300 border-amber-500/40"
                        : "bg-rose-950/90 text-rose-300 border-rose-500/50 shadow-xs"
                    }`}>
                      {stock.winRatePct}%
                    </span>
                    <div className="text-[9px] text-slate-500 font-mono mt-0.5">N=10 yrs</div>
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <div className={`font-bold font-mono text-sm ${stock.avgReturnPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {stock.avgReturnPct > 0 ? "+" : ""}{stock.avgReturnPct}%
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Med: {stock.medianReturnPct > 0 ? "+" : ""}{stock.medianReturnPct}%
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <div className="w-20 mx-auto">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-400">Score</span>
                        <span className="font-bold font-mono text-slate-200">{stock.consistencyScore}/100</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full"
                          style={{ width: `${stock.consistencyScore}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    {stock.confluence.hasConfluence ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        TRIPLE CONFLUENCE (EMA + NEWS)
                      </span>
                    ) : stock.confluence.emaBullishToday ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-500/40">
                        <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                        EMA Bullish Today
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-900/80 text-slate-400 border border-slate-800">
                        Historical Only
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <Link
                      href={`/stock/${stock.symbol}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold font-mono bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 transition-all inline-flex items-center gap-1 shadow-xs"
                    >
                      Trade Setup <ChevronRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
