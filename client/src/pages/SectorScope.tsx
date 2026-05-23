import { useQuery } from "@tanstack/react-query";
import { Scan, TrendingUp, TrendingDown, ArrowUpDown } from "lucide-react";
import { useState } from "react";

interface SectorData {
  name: string;
  symbol: string;
  change1d: number;
  change1w: number;
  change1m: number;
  topGainer: { symbol: string; change: number };
  topLoser: { symbol: string; change: number };
}

export default function SectorScope() {
  const [timeframe, setTimeframe] = useState<"1d" | "1w" | "1m">("1d");

  const { data, isLoading } = useQuery<{ sectors: SectorData[] }>({
    queryKey: ["/api/sector-performance"],
    staleTime: 5 * 60 * 1000,
  });

  const sectors = data?.sectors ?? [];
  const sorted = [...sectors].sort((a, b) => {
    const key = timeframe === "1d" ? "change1d" : timeframe === "1w" ? "change1w" : "change1m";
    return b[key] - a[key];
  });

  const getChange = (s: SectorData) =>
    timeframe === "1d" ? s.change1d : timeframe === "1w" ? s.change1w : s.change1m;

  const maxAbsChange = Math.max(...sorted.map(s => Math.abs(getChange(s))), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1 flex items-center gap-2">
            <Scan className="w-6 h-6 text-primary" />
            Sector Scope
          </h1>
          <p className="text-sm text-white/40 font-sans">
            Sector rotation heatmap · Identify where the money is flowing
          </p>
        </div>
        <div className="flex gap-1.5">
          {(["1d", "1w", "1m"] as const).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all ${
                timeframe === tf
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-white/3 border-white/8 text-white/40 hover:text-white/60"
              }`}
            >
              {tf === "1d" ? "Today" : tf === "1w" ? "1 Week" : "1 Month"}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-white/3 animate-pulse border border-white/5" />
          ))}
        </div>
      ) : sorted.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {sorted.map(sector => {
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
                className="rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] cursor-default"
                style={{ background: bg, border: `1px solid ${borderColor}` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white/80 truncate">{sector.name}</h3>
                  {isPos ? (
                    <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-400 flex-shrink-0" />
                  )}
                </div>

                <p className={`text-2xl font-mono font-bold mb-3 ${isPos ? "text-emerald-400" : "text-red-400"}`}>
                  {isPos ? "+" : ""}{change.toFixed(2)}%
                </p>

                {/* Multi-timeframe mini view */}
                <div className="flex gap-2 text-[9px] font-mono mb-3">
                  <span className={sector.change1d >= 0 ? "text-emerald-400/60" : "text-red-400/60"}>
                    D: {sector.change1d >= 0 ? "+" : ""}{sector.change1d.toFixed(1)}%
                  </span>
                  <span className={sector.change1w >= 0 ? "text-emerald-400/60" : "text-red-400/60"}>
                    W: {sector.change1w >= 0 ? "+" : ""}{sector.change1w.toFixed(1)}%
                  </span>
                  <span className={sector.change1m >= 0 ? "text-emerald-400/60" : "text-red-400/60"}>
                    M: {sector.change1m >= 0 ? "+" : ""}{sector.change1m.toFixed(1)}%
                  </span>
                </div>

                {/* Top gainer / loser */}
                <div className="space-y-1 border-t border-white/5 pt-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-white/25">Top</span>
                    <span className="text-emerald-400">{sector.topGainer.symbol} +{sector.topGainer.change.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-white/25">Bot</span>
                    <span className="text-red-400">{sector.topLoser.symbol} {sector.topLoser.change.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 glass-card rounded-2xl border border-white/6">
          <Scan className="w-12 h-12 mx-auto text-white/15 mb-3" />
          <h3 className="text-base font-semibold text-white/60 mb-1">No sector data available</h3>
          <p className="text-sm text-white/30">Sector data refreshes during market hours</p>
        </div>
      )}

      {/* Rotation Indicator */}
      {sorted.length > 0 && (
        <div className="glass-card rounded-2xl border border-white/6 p-5">
          <h3 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-primary" />
            Sector Rotation Signal
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {sorted.slice(0, 3).map(s => (
              <span key={s.symbol} className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                ↑ {s.name}
              </span>
            ))}
            <span className="text-white/15 text-xs">→</span>
            {sorted.slice(-3).reverse().map(s => (
              <span key={s.symbol} className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold bg-red-500/10 border border-red-500/20 text-red-400">
                ↓ {s.name}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-white/20 font-mono mt-2">
            Money rotating from weak sectors → strong sectors. Follow institutional flow.
          </p>
        </div>
      )}
    </div>
  );
}
