import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ArrowDownRight, Activity, TrendingUp, TrendingDown, RefreshCw, BarChart2 } from "lucide-react";
import { useState } from "react";

interface IndexMoverItem {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  pointsContribution: number;
  weight: number;
}

interface IndexMoversData {
  indexName: string;
  indexValue: number;
  indexChange: number;
  indexChangePercent: number;
  netPositivePoints: number;
  netNegativePoints: number;
  advances: number;
  declines: number;
  movers: {
    positive: IndexMoverItem[];
    negative: IndexMoverItem[];
  };
  sectorContribution: {
    sector: string;
    points: number;
  }[];
}

export default function IndexMover() {
  const [selectedIndex, setSelectedIndex] = useState<"NIFTY" | "BANKNIFTY">("NIFTY");

  const { data, isLoading, refetch, isFetching } = useQuery<{ data: IndexMoversData }>({
    queryKey: ["/api/index-movers", selectedIndex],
    staleTime: 60 * 1000,
  });

  const md = data?.data;

  const getWeightColor = (weight: number) => {
    if (weight > 8) return "text-purple-400 border-purple-500/20 bg-purple-500/5";
    if (weight > 4) return "text-cyan-400 border-cyan-500/20 bg-cyan-500/5";
    return "text-white/40 border-white/5 bg-white/2";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1 flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Index Mover
          </h1>
          <p className="text-sm text-white/40 font-sans">
            Real-time point contribution and index constituent impact analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-xl bg-white/5 border border-white/8 text-white/60 hover:text-white hover:bg-white/8 active:scale-95 transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          <div className="flex gap-1.5">
            {(["NIFTY", "BANKNIFTY"] as const).map(idx => (
              <button
                key={idx}
                onClick={() => setSelectedIndex(idx)}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                  selectedIndex === idx
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-white/3 border-white/8 text-white/40 hover:text-white/60"
                }`}
              >
                {idx === "NIFTY" ? "Nifty 50" : "Bank Nifty"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-white/3 border border-white/5" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-96 rounded-2xl bg-white/3 border border-white/5" />
            <div className="h-96 rounded-2xl bg-white/3 border border-white/5" />
          </div>
        </div>
      ) : md ? (
        <>
          {/* Index Summary Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card rounded-2xl border border-white/6 p-5">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">Index Level</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-mono font-bold text-white">
                  {md.indexValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
                <span className={`text-xs font-mono font-bold flex items-center ${md.indexChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {md.indexChange >= 0 ? "+" : ""}
                  {md.indexChange.toFixed(2)} ({md.indexChangePercent >= 0 ? "+" : ""}
                  {md.indexChangePercent.toFixed(2)}%)
                </span>
              </div>
            </div>

            <div className="glass-card rounded-2xl border border-white/6 p-5">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">Advance / Decline Ratio</span>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex-1">
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-emerald-400">{md.advances} Advances</span>
                    <span className="text-red-400">{md.declines} Declines</span>
                  </div>
                  <div className="h-2.5 bg-white/5 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 transition-all"
                      style={{ width: `${(md.advances / (md.advances + md.declines)) * 100}%` }}
                    />
                    <div
                      className="bg-red-500 transition-all"
                      style={{ width: `${(md.declines / (md.advances + md.declines)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl border border-white/6 p-5">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">Point Contribution Split</span>
              <div className="flex items-baseline justify-between mt-2">
                <div>
                  <span className="text-xl font-mono font-semibold text-emerald-400">+{md.netPositivePoints.toFixed(1)}</span>
                  <span className="text-[9px] font-mono text-white/20 block">Positive Pts</span>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <span className="text-xl font-mono font-semibold text-red-400">-{md.netNegativePoints.toFixed(1)}</span>
                  <span className="text-[9px] font-mono text-white/20 block">Negative Pts</span>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <span className="text-xl font-mono font-semibold text-primary">
                    {(md.netPositivePoints - md.netNegativePoints).toFixed(1)}
                  </span>
                  <span className="text-[9px] font-mono text-white/20 block">Net Pts</span>
                </div>
              </div>
            </div>
          </div>

          {/* Movers Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Positive Contributors */}
            <div className="glass-card rounded-2xl border border-white/6 p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Top Positive Contributors</h2>
              </div>
              <div className="space-y-3">
                {md.movers.positive.map((item, idx) => {
                  const maxPts = Math.max(
                    ...md.movers.positive.map(x => Math.abs(x.pointsContribution)),
                    ...md.movers.negative.map(x => Math.abs(x.pointsContribution))
                  );
                  const pct = (Math.abs(item.pointsContribution) / maxPts) * 100;
                  return (
                    <div key={item.symbol} className="flex items-center justify-between p-3 rounded-xl bg-white/3 hover:bg-white/5 border border-white/5 transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-white">{item.symbol}</span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${getWeightColor(item.weight)}`}>
                            Wt: {item.weight}%
                          </span>
                        </div>
                        <span className="text-xs text-white/40 block truncate max-w-[160px]">{item.name}</span>
                      </div>

                      <div className="flex-1 max-w-[120px] mx-4 hidden sm:block">
                        <div className="h-2 bg-white/3 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500/40 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-mono font-bold text-emerald-400 flex items-center justify-end gap-1">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          +{item.pointsContribution.toFixed(2)} pts
                        </span>
                        <div className="text-[10px] font-mono text-white/30 mt-0.5">
                          ₹{item.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })} (+{item.changePercent.toFixed(2)}%)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Negative Contributors */}
            <div className="glass-card rounded-2xl border border-white/6 p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-5 h-5 text-red-400" />
                <h2 className="text-lg font-bold text-white">Top Negative Contributors</h2>
              </div>
              <div className="space-y-3">
                {md.movers.negative.map((item, idx) => {
                  const maxPts = Math.max(
                    ...md.movers.positive.map(x => Math.abs(x.pointsContribution)),
                    ...md.movers.negative.map(x => Math.abs(x.pointsContribution))
                  );
                  const pct = (Math.abs(item.pointsContribution) / maxPts) * 100;
                  return (
                    <div key={item.symbol} className="flex items-center justify-between p-3 rounded-xl bg-white/3 hover:bg-white/5 border border-white/5 transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-white">{item.symbol}</span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${getWeightColor(item.weight)}`}>
                            Wt: {item.weight}%
                          </span>
                        </div>
                        <span className="text-xs text-white/40 block truncate max-w-[160px]">{item.name}</span>
                      </div>

                      <div className="flex-1 max-w-[120px] mx-4 hidden sm:block">
                        <div className="h-2 bg-white/3 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500/40 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-mono font-bold text-red-400 flex items-center justify-end gap-1">
                          <ArrowDownRight className="w-3.5 h-3.5" />
                          {item.pointsContribution.toFixed(2)} pts
                        </span>
                        <div className="text-[10px] font-mono text-white/30 mt-0.5">
                          ₹{item.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })} ({item.changePercent.toFixed(2)}%)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sector Contribution */}
          <div className="glass-card rounded-2xl border border-white/6 p-5">
            <div className="flex items-center gap-2 mb-6">
              <BarChart2 className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-white">Sectoral Index Contribution</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {md.sectorContribution.map(sec => {
                const isPos = sec.points >= 0;
                return (
                  <div key={sec.sector} className="p-4 rounded-xl bg-white/3 border border-white/5 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-white/60 mb-2 truncate">{sec.sector}</span>
                    <div className="flex items-baseline justify-between">
                      <span className={`text-lg font-mono font-bold ${isPos ? "text-emerald-400" : "text-red-400"}`}>
                        {isPos ? "+" : ""}
                        {sec.points.toFixed(2)}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${isPos ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                        {isPos ? "Bullish Impact" : "Bearish Impact"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-16 glass-card rounded-2xl border border-white/6">
          <Activity className="w-12 h-12 mx-auto text-white/15 mb-3 animate-pulse" />
          <h3 className="text-base font-semibold text-white/60 mb-1">Index movers data loading…</h3>
          <p className="text-sm text-white/30">Refreshes in real-time based on constituent data</p>
        </div>
      )}
    </div>
  );
}
