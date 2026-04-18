import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Search, BarChart2, Activity } from "lucide-react";
import { StockChartDrawer, type StockDrawerPayload } from "@/components/StockChartDrawer";

interface SwingStock {
  sr:            number;
  stockName:     string;
  symbol:        string;
  links:         string;
  changePercent: number;
  price:         number;
  volume:        string;
}

export default function SwingScanner() {
  const [search,        setSearch]        = useState("");
  const [selectedStock, setSelectedStock] = useState<StockDrawerPayload | null>(null);

  const { data: swingData, isLoading, refetch } = useQuery<{ stocks: SwingStock[] }>({
    queryKey: ["/api/swing-scanner"],
  });

  const stocks = (swingData?.stocks ?? []).filter(s =>
    !search ||
    s.stockName.toLowerCase().includes(search.toLowerCase()) ||
    s.symbol.toLowerCase().includes(search.toLowerCase())
  );

  const posCount = stocks.filter(s => s.changePercent > 0).length;
  const negCount = stocks.filter(s => s.changePercent < 0).length;

  return (
    <>
      <div className="space-y-6">

        {/* ── Header ────────────────────────────── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1 flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" />
              Swing Scanner
            </h1>
            <p className="text-sm text-white/40 font-sans">
              AI-powered top swing opportunities · Click any row to view live chart
            </p>
          </div>

          {/* Market mood pills */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono font-semibold text-emerald-400">
              <TrendingUp className="w-3 h-3" /> {posCount} Bullish
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-mono font-semibold text-red-400">
              <TrendingDown className="w-3 h-3" /> {negCount} Bearish
            </div>
          </div>
        </div>

        {/* ── Controls ──────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by name or symbol…"
              className="w-full pl-9 pr-4 py-2 rounded-xl glass-card border border-white/8 text-sm text-white/80
                placeholder:text-white/25 focus:outline-none focus:border-primary/50 font-mono bg-transparent transition-all"
            />
          </div>

          <button
            onClick={() => refetch()}
            className="px-3 py-2 rounded-xl glass-card border border-white/8 text-xs font-mono text-white/50
              hover:text-white hover:border-primary/40 transition-all duration-200 flex items-center gap-1.5"
          >
            ↻ Refresh
          </button>
        </div>

        {/* ── Table ─────────────────────────────── */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-white/3 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : stocks.length > 0 ? (
          <div className="rounded-2xl border border-white/6 overflow-hidden glass-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {["#", "Stock", "Symbol", "Chart", "% Chg", "Price", "Volume"].map(col => (
                      <th key={col}
                        className={`px-4 py-3 text-[10px] font-mono font-semibold uppercase tracking-widest text-white/30
                          ${col === "% Chg" || col === "Price" || col === "Volume" ? "text-right" : "text-left"}
                          ${col === "Chart" ? "text-center" : ""}
                        `}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((stock, idx) => {
                    const isPos = stock.changePercent >= 0;
                    return (
                      <motion.tr
                        key={stock.sr}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => setSelectedStock({
                          symbol: `${stock.symbol}.NS`,
                          name:   stock.stockName,
                          price:  stock.price,
                          changePercent: stock.changePercent,
                          exchange: "NSE",
                        })}
                        className="group border-b border-white/4 last:border-0 hover:bg-white/3 cursor-pointer transition-colors duration-150"
                      >
                        {/* Sr */}
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-white/25 font-mono">{stock.sr}</span>
                        </td>

                        {/* Stock name */}
                        <td className="px-4 py-3.5">
                          <span className="text-sm text-white/80 font-sans group-hover:text-white transition-colors">
                            {stock.stockName}
                          </span>
                        </td>

                        {/* Symbol */}
                        <td className="px-4 py-3.5">
                          <span className="text-sm text-primary/70 group-hover:text-primary font-mono font-semibold transition-colors">
                            {stock.symbol}
                          </span>
                        </td>

                        {/* Chart launch */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono
                            bg-white/4 border border-white/8 text-white/35 group-hover:text-primary/80
                            group-hover:border-primary/30 group-hover:bg-primary/8 transition-all duration-150">
                            <BarChart2 className="w-3 h-3" /> Chart
                          </div>
                        </td>

                        {/* % Change */}
                        <td className="px-4 py-3.5 text-right">
                          <span
                            className={`inline-flex items-center gap-1 text-sm font-mono font-bold tabular-nums px-2 py-0.5 rounded-full
                              ${isPos
                                ? "text-emerald-400 bg-emerald-500/8 border border-emerald-500/15"
                                : "text-red-400 bg-red-500/8 border border-red-500/15"
                              }`}
                          >
                            {isPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {isPos ? "+" : ""}{stock.changePercent.toFixed(2)}%
                          </span>
                        </td>

                        {/* Price */}
                        <td className="px-4 py-3.5 text-right">
                          <span className="text-sm font-mono font-bold text-white tabular-nums">
                            ₹{stock.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* Volume */}
                        <td className="px-4 py-3.5 text-right">
                          <span className="text-xs text-white/40 font-mono">{stock.volume}</span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 glass-card rounded-2xl border border-white/6">
            <TrendingUp className="w-14 h-14 mx-auto text-white/15 mb-4" />
            <h3 className="text-base font-semibold text-white/60 mb-2">No stocks found</h3>
            <p className="text-sm text-white/30">Try adjusting your search filter</p>
          </div>
        )}
      </div>

      {/* Drawer */}
      <StockChartDrawer
        stock={selectedStock}
        onClose={() => setSelectedStock(null)}
      />
    </>
  );
}
