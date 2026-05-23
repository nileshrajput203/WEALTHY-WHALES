import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Search, BarChart2, Activity, Zap, Shield, Target } from "lucide-react";
import { StockChartDrawer, type StockDrawerPayload } from "@/components/StockChartDrawer";

interface SwingStock {
  sr:            number;
  stockName:     string;
  symbol:        string;
  links:         string;
  changePercent: number;
  price:         number;
  volume:        string;
  setup:         string;
  atr:           number;
  ema9:          number;
  ema20:         number;
  ema50:         number;
  ema150:        number;
  ema200:        number;
  weekHigh52:    number;
  turnover:      number;
}

export default function SwingScanner() {
  const [search,        setSearch]        = useState("");
  const [selectedStock, setSelectedStock] = useState<StockDrawerPayload | null>(null);
  const [expandedRow,   setExpandedRow]   = useState<number | null>(null);

  const { data: swingData, isLoading, refetch, isFetching } = useQuery<{ stocks: SwingStock[]; cached?: boolean }>({
    queryKey: ["/api/swing-scanner"],
    staleTime: 10 * 60 * 1000, // 10 min
    retry: 1,
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
              Swing Spectrum
            </h1>
            <p className="text-sm text-white/40 font-sans">
              Real-time technical scanner · Small & Mid-cap only · No Nifty 50/100/500 · No ETFs
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

        {/* ── 12 Chartink Technical Rules ─────────── */}
        <div className="glass-card rounded-2xl border border-white/6 p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-primary mb-3">
            🔬 Active Technical Filters (All 12 Chartink Conditions Applied)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {[
              { label: "1. ATR(10) < ATR(20)", desc: "Volatility contracting" },
              { label: "2. Close > 75% of 52W High", desc: "Strong accumulation zone" },
              { label: "3. EMA(9) > EMA(20)", desc: "Bullish short-term momentum" },
              { label: "4. EMA(50) > EMA(150)", desc: "Bullish medium-term trend" },
              { label: "5. EMA(150) > EMA(200)", desc: "Long-term bullish structure" },
              { label: "6. Close > EMA(50)", desc: "Above intermediate support" },
              { label: "7. Share Price > ₹10", desc: "Filters out illiquid penny stocks" },
              { label: "8. Daily Turnover > ₹10L", desc: "Price × Vol > ₹1,000,000" },
              { label: "9. Daily Change > 0%", desc: "Bullish positive day" },
              { label: "10. Daily Change < 3%", desc: "Controlled breakout volatility" },
              { label: "11. Close > EMA(9)", desc: "Aggressive short-term support" },
              { label: "12. Close > EMA(20)", desc: "Above near-term moving average" },
            ].map((f, i) => (
              <div key={i} className="p-2 rounded-xl bg-white/2 border border-white/5 flex flex-col justify-between hover:bg-white/4 transition-colors">
                <span className="text-[10px] font-mono font-bold text-white/80">{f.label}</span>
                <span className="text-[9px] font-sans text-white/40 mt-0.5">{f.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Controls ──────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
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
            disabled={isFetching}
            className="px-3 py-2 rounded-xl glass-card border border-white/8 text-xs font-mono text-white/50
              hover:text-white hover:border-primary/40 transition-all duration-200 flex items-center gap-1.5
              disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isFetching ? "⏳ Scanning…" : "↻ Refresh"}
          </button>

          {swingData?.cached && (
            <span className="text-[10px] font-mono text-white/20 px-2 py-1 bg-white/3 rounded-lg border border-white/5">
              cached
            </span>
          )}
        </div>

        {/* ── Loading state ─────────────────────── */}
        {isLoading || isFetching ? (
          <div className="space-y-4">
            <div className="glass-card rounded-2xl border border-white/6 p-8 text-center">
              <div className="inline-flex items-center gap-3 text-primary/60">
                <div className="w-5 h-5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                <span className="text-sm font-mono">Scanning 800+ NSE stocks against 12 technical filters…</span>
              </div>
              <p className="text-[11px] text-white/20 mt-2 font-mono">This may take 60-90 seconds on first load (results are cached for 15 min)</p>
            </div>
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-white/3 animate-pulse border border-white/5" />
              ))}
            </div>
          </div>
        ) : stocks.length > 0 ? (
          /* ── Table ─────────────────────────────── */
          <div className="rounded-2xl border border-white/6 overflow-hidden glass-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {["#", "Stock", "Symbol", "Chart", "% Chg", "Price", "Volume", "Setup"].map(col => (
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
                    const isExpanded = expandedRow === idx;
                    return (
                      <>
                        <tr
                          key={stock.sr}
                          className="group border-b border-white/4 last:border-0 hover:bg-white/3 cursor-pointer transition-colors duration-150"
                        >
                          {/* Sr */}
                          <td className="px-4 py-3.5">
                            <span className="text-xs text-white/25 font-mono">{stock.sr}</span>
                          </td>

                          {/* Stock name */}
                          <td className="px-4 py-3.5" onClick={() => setExpandedRow(isExpanded ? null : idx)}>
                            <span className="text-sm text-white/80 font-sans group-hover:text-white transition-colors">
                              {stock.stockName}
                            </span>
                          </td>

                          {/* Symbol */}
                          <td className="px-4 py-3.5" onClick={() => setExpandedRow(isExpanded ? null : idx)}>
                            <span className="text-sm text-primary/70 group-hover:text-primary font-mono font-semibold transition-colors">
                              {stock.symbol}
                            </span>
                          </td>

                          {/* Chart launch */}
                          <td className="px-4 py-3.5 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStock({
                                  symbol: stock.symbol,
                                  name: stock.stockName,
                                  price: stock.price,
                                  changePercent: stock.changePercent,
                                });
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono
                                bg-white/4 border border-white/8 text-white/35 group-hover:text-primary/80
                                group-hover:border-primary/30 group-hover:bg-primary/8 transition-all duration-150"
                            >
                              <BarChart2 className="w-3 h-3" /> Chart
                            </button>
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

                          {/* Setup */}
                          <td className="px-4 py-3.5">
                            <span className="text-[10px] text-white/30 font-mono leading-tight line-clamp-1">
                              {stock.setup}
                            </span>
                          </td>
                        </tr>

                        {/* Expanded technical details row */}
                        {isExpanded && (
                          <tr key={`detail-${stock.sr}`} className="bg-white/2 border-b border-white/4">
                            <td colSpan={8} className="px-6 py-4">
                              <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 text-xs font-mono">
                                <div>
                                  <p className="text-white/25 text-[9px] uppercase tracking-wider mb-0.5">EMA 9</p>
                                  <p className="text-cyan-400 font-semibold">₹{stock.ema9?.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-white/25 text-[9px] uppercase tracking-wider mb-0.5">EMA 20</p>
                                  <p className="text-blue-400 font-semibold">₹{stock.ema20?.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-white/25 text-[9px] uppercase tracking-wider mb-0.5">EMA 50</p>
                                  <p className="text-emerald-400 font-semibold">₹{stock.ema50?.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-white/25 text-[9px] uppercase tracking-wider mb-0.5">EMA 150</p>
                                  <p className="text-yellow-400 font-semibold">₹{stock.ema150?.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-white/25 text-[9px] uppercase tracking-wider mb-0.5">EMA 200</p>
                                  <p className="text-orange-400 font-semibold">₹{stock.ema200?.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-white/25 text-[9px] uppercase tracking-wider mb-0.5">ATR(14)</p>
                                  <p className="text-purple-400 font-semibold">₹{stock.atr?.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-white/25 text-[9px] uppercase tracking-wider mb-0.5">52W High</p>
                                  <p className="text-white/60 font-semibold">₹{stock.weekHigh52?.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-white/25 text-[9px] uppercase tracking-wider mb-0.5">From 52W High</p>
                                  <p className="text-white/60 font-semibold">{((stock.price / stock.weekHigh52) * 100).toFixed(1)}%</p>
                                </div>
                                <div>
                                  <p className="text-white/25 text-[9px] uppercase tracking-wider mb-0.5">Turnover</p>
                                  <p className="text-white/60 font-semibold">₹{(stock.turnover / 100000).toFixed(1)}L</p>
                                </div>
                              </div>
                              {/* EMA Stack visual */}
                              <div className="mt-3 flex items-center gap-2 flex-wrap">
                                <span className="text-[9px] font-mono text-white/20 uppercase">EMA Stack:</span>
                                {[
                                  { label: "Price", val: stock.price, color: "text-white" },
                                  { label: "9", val: stock.ema9, color: "text-cyan-400" },
                                  { label: "20", val: stock.ema20, color: "text-blue-400" },
                                  { label: "50", val: stock.ema50, color: "text-emerald-400" },
                                  { label: "150", val: stock.ema150, color: "text-yellow-400" },
                                  { label: "200", val: stock.ema200, color: "text-orange-400" },
                                ].map((e, i, arr) => (
                                  <span key={e.label} className="inline-flex items-center gap-1">
                                    <span className={`text-[10px] font-mono font-bold ${e.color}`}>{e.label}</span>
                                    {i < arr.length - 1 && <span className="text-emerald-500/50 text-[10px]">›</span>}
                                  </span>
                                ))}
                                <span className="text-[9px] text-emerald-400/50 font-mono ml-1">✓ Perfect alignment</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 glass-card rounded-2xl border border-white/6">
            <TrendingUp className="w-14 h-14 mx-auto text-white/15 mb-4" />
            <h3 className="text-base font-semibold text-white/60 mb-2">No stocks matched all 12 filters</h3>
            <p className="text-sm text-white/30 max-w-md mx-auto">
              The scanner checks ATR contraction, EMA stack alignment (9 › 20 › 50 › 150 › 200), 
              52-week high proximity, positive day with low volatility, and minimum turnover. 
              Try again during market hours for more results.
            </p>
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
