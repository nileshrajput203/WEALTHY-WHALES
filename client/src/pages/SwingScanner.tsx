import { useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Search, BarChart2, Activity, Zap, ArrowUpDown, Star } from "lucide-react";
import { StockChartDrawer, type StockDrawerPayload } from "@/components/StockChartDrawer";

interface SwingStock {
  sr:              number;
  stockName:       string;
  symbol:          string;
  links:           string;
  changePercent:   number;
  price:           number;
  volume:          string;
  setup:           string;
  atr:             number;
  ema9:            number;
  ema20:           number;
  ema50:           number;
  ema150:          number;
  ema200:          number;
  weekHigh52:      number;
  turnover:        number;
  vcpScore:        number;
  fundamentalScore:number;
  atrCompression:  number;
  volumeRatio:     number;
  nearHighPct:     number;
  rsScore:         number;
}

/* VCP quality label based on score */
function vcpLabel(score: number): { text: string; cls: string } {
  if (score >= 80) return { text: "A+ VCP", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
  if (score >= 65) return { text: "A VCP",  cls: "text-cyan-400   bg-cyan-500/10   border-cyan-500/20"    };
  if (score >= 50) return { text: "B VCP",  cls: "text-blue-400   bg-blue-500/10   border-blue-500/20"    };
  return               { text: "C VCP",  cls: "text-white/40   bg-white/5       border-white/8"       };
}

export default function SwingScanner() {
  const [search,        setSearch]        = useState("");
  const [sortFundamentals, setSortFundamentals] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockDrawerPayload | null>(null);
  const [expandedRow,   setExpandedRow]   = useState<number | null>(null);

  const { data: swingData, isLoading, refetch, isFetching } = useQuery<{ stocks: SwingStock[]; cached?: boolean }>({
    queryKey: ["/api/swing-scanner"],
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const rawStocks = (swingData?.stocks ?? []).filter(s =>
    !search ||
    s.stockName.toLowerCase().includes(search.toLowerCase()) ||
    s.symbol.toLowerCase().includes(search.toLowerCase())
  );

  // When toggle is ON → sort by fundamentalScore desc; else default (vcpScore desc)
  const stocks = [...rawStocks].sort((a, b) =>
    sortFundamentals
      ? (b.fundamentalScore ?? 0) - (a.fundamentalScore ?? 0)
      : (b.vcpScore ?? 0) - (a.vcpScore ?? 0)
  );

  const posCount = stocks.filter(s => s.changePercent >= 0).length;
  const negCount = stocks.filter(s => s.changePercent < 0).length;

  return (
    <div>
      <div className="space-y-6">

        {/* ── Header ──────────────────────────── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1 flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" />
              Swing Spectrum
              <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary/80 ml-1">
                VCP Scanner
              </span>
            </h1>
            <p className="text-sm text-white/40 font-sans">
              Minervini-style VCP screen · 12 strict filters · NSE &amp; BSE small/mid-cap · No Nifty 50 / ETFs
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

        {/* ── 12 VCP Technical Rules ─────────── */}
        <div className="glass-card rounded-2xl border border-white/6 p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
            <Zap className="w-3 h-3" /> Active VCP Filters — All 12 Minervini Conditions Applied
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {[
              { label: "1. ATR(14) < ATR(14) 10d ago",      desc: "Volatility actively contracting" },
              { label: "2. ATR 5d ago < ATR 10d ago",       desc: "Progressive (not random) compression" },
              { label: "3. ATR(14)/Close < 0.06",           desc: "Tight coil: volatility tiny vs price" },
              { label: "4. Close > EMA50 > EMA150 > EMA200",desc: "Full stage-2 trend template" },
              { label: "5. EMA9 > EMA20 > EMA50",           desc: "Short-term momentum aligned" },
              { label: "6. Close within 15% of 52W High",   desc: "Near pivot — not a laggard" },
              { label: "7. Volume < 85% of 20D Avg",        desc: "Supply dry-up inside the base" },
              { label: "8. Daily Turnover > ₹20 Lakh",      desc: "Institutional-grade liquidity" },
              { label: "9. Share Price > ₹20",              desc: "Filters penny & micro-cap risk" },
              { label: "10. Daily Change −1% to +4%",       desc: "Controlled consolidation phase" },
              { label: "11. EMA(50) slope rising",          desc: "Healthy stage-2 uptrend slope" },
              { label: "12. 52W High > 52W Low × 1.20",    desc: "Meaningful range, not flat stock" },
            ].map((f, i) => (
              <div key={i} className="p-2 rounded-xl bg-white/2 border border-white/5 flex flex-col justify-between hover:bg-white/4 transition-colors">
                <span className="text-[10px] font-mono font-bold text-white/80">{f.label}</span>
                <span className="text-[9px] font-sans text-white/40 mt-0.5">{f.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Controls ──────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by name or symbol…"
              data-testid="input-search"
              className="w-full pl-9 pr-4 py-2 rounded-xl glass-card border border-white/8 text-sm text-white/80
                placeholder:text-white/25 focus:outline-none focus:border-primary/50 font-mono bg-transparent transition-all"
            />
          </div>

          {/* Sort by Fundamentals toggle */}
          <button
            data-testid="button-sort-fundamentals"
            onClick={() => setSortFundamentals(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-mono transition-all duration-200
              ${sortFundamentals
                ? "bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                : "glass-card border-white/8 text-white/50 hover:text-white hover:border-white/20"
              }`}
          >
            <Star className={`w-3.5 h-3.5 ${sortFundamentals ? "fill-amber-400 text-amber-400" : ""}`} />
            Sort by Fundamentals
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ml-0.5 ${
              sortFundamentals ? "bg-amber-500/20 text-amber-300" : "bg-white/6 text-white/30"
            }`}>
              {sortFundamentals ? "ON" : "OFF"}
            </span>
          </button>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh"
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

        {/* Sort mode indicator */}
        {sortFundamentals && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/8 border border-amber-500/15 text-xs font-mono text-amber-400/80">
            <ArrowUpDown className="w-3 h-3" />
            Sorted by Fundamental Score (RS strength + turnover + stability + trend health). Higher score = stronger stock.
          </div>
        )}

        {/* ── Loading state ─────────────────── */}
        {isLoading || isFetching ? (
          <div className="space-y-4">
            <div className="glass-card rounded-2xl border border-white/6 p-8 text-center">
              <div className="inline-flex items-center gap-3 text-primary/60">
                <div className="w-5 h-5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                <span className="text-sm font-mono">Running Minervini VCP scan on 800+ NSE/BSE stocks…</span>
              </div>
              <p className="text-[11px] text-white/20 mt-2 font-mono">
                Checking 12 strict VCP conditions · ATR compression · volume dry-up · stage-2 trend · Results cached 15 min
              </p>
            </div>
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-white/3 animate-pulse border border-white/5" />
              ))}
            </div>
          </div>
        ) : stocks.length > 0 ? (
          /* ── Table ───────────────────────── */
          <div className="rounded-2xl border border-white/6 overflow-hidden glass-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {[
                      { col: "#",         align: "left"   },
                      { col: "Stock",     align: "left"   },
                      { col: "Symbol",    align: "left"   },
                      { col: "Chart",     align: "center" },
                      { col: "VCP Grade", align: "left"   },
                      { col: "% Chg",     align: "right"  },
                      { col: "Price",     align: "right"  },
                      { col: "Near High", align: "right"  },
                      { col: sortFundamentals ? "F.Score" : "VCP Score", align: "right" },
                    ].map(({ col, align }) => (
                      <th key={col}
                        className={`px-4 py-3 text-[10px] font-mono font-semibold uppercase tracking-widest text-white/30 text-${align}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((stock, idx) => {
                    const isPos      = stock.changePercent >= 0;
                    const isExpanded = expandedRow === idx;
                    const grade      = vcpLabel(stock.vcpScore ?? 0);
                    const scoreVal   = sortFundamentals
                      ? (stock.fundamentalScore ?? 0)
                      : (stock.vcpScore ?? 0);

                    return (
                      <Fragment key={stock.sr}>
                        <tr
                          data-testid={`row-stock-${stock.symbol}`}
                          className="group border-b border-white/4 last:border-0 hover:bg-white/3 cursor-pointer transition-colors duration-150"
                          onClick={() => setExpandedRow(isExpanded ? null : idx)}
                        >
                          {/* # */}
                          <td className="px-4 py-3.5">
                            <span className="text-xs text-white/25 font-mono">{idx + 1}</span>
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
                              {stock.symbol?.replace('.NS','').replace('.BO','')}
                            </span>
                          </td>

                          {/* Chart launch */}
                          <td className="px-4 py-3.5 text-center">
                            <button
                              data-testid={`button-chart-${stock.symbol}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStock({
                                  symbol: stock.symbol?.replace('.NS','').replace('.BO',''),
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

                          {/* VCP Grade */}
                          <td className="px-4 py-3.5">
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${grade.cls}`}>
                              {grade.text}
                            </span>
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

                          {/* Near 52W High % */}
                          <td className="px-4 py-3.5 text-right">
                            <span className={`text-xs font-mono tabular-nums ${
                              (stock.nearHighPct ?? 0) >= 95 ? "text-emerald-400" :
                              (stock.nearHighPct ?? 0) >= 90 ? "text-cyan-400" : "text-white/50"
                            }`}>
                              {(stock.nearHighPct ?? ((stock.price / stock.weekHigh52) * 100)).toFixed(1)}%
                            </span>
                          </td>

                          {/* Score (VCP or Fundamental) */}
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="w-12 h-1.5 rounded-full bg-white/8 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    sortFundamentals
                                      ? "bg-amber-400"
                                      : scoreVal >= 80 ? "bg-emerald-400"
                                      : scoreVal >= 65 ? "bg-cyan-400"
                                      : scoreVal >= 50 ? "bg-blue-400"
                                      : "bg-white/30"
                                  }`}
                                  style={{ width: `${scoreVal}%` }}
                                />
                              </div>
                              <span className={`text-xs font-mono font-bold tabular-nums ${
                                sortFundamentals ? "text-amber-400" :
                                scoreVal >= 80 ? "text-emerald-400" :
                                scoreVal >= 65 ? "text-cyan-400" : "text-white/40"
                              }`}>
                                {scoreVal}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded VCP details row */}
                        {isExpanded && (
                          <tr key={`detail-${stock.sr}`} className="bg-white/2 border-b border-white/4">
                            <td colSpan={9} className="px-6 py-4">
                              {/* Score bars */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                {[
                                  { label: "VCP Score",       val: stock.vcpScore ?? 0,        color: "bg-emerald-400",  max: 100 },
                                  { label: "Fundamental",     val: stock.fundamentalScore ?? 0, color: "bg-amber-400",    max: 100 },
                                  { label: "ATR Compression", val: Math.round((stock.atrCompression ?? 0) * 100), color: "bg-purple-400", max: 100 },
                                  { label: "Vol Dry-up",      val: Math.round((1 - Math.min(1, stock.volumeRatio ?? 1)) * 100), color: "bg-cyan-400", max: 100 },
                                ].map(bar => (
                                  <div key={bar.label}>
                                    <div className="flex justify-between mb-1">
                                      <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider">{bar.label}</span>
                                      <span className="text-[10px] font-mono font-bold text-white/60">{bar.val}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                                      <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${(bar.val / bar.max) * 100}%` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Technical metrics */}
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
                                  <p className="text-white/25 text-[9px] uppercase tracking-wider mb-0.5">Near High</p>
                                  <p className="text-emerald-400 font-semibold">{(stock.nearHighPct ?? 0).toFixed(1)}%</p>
                                </div>
                                <div>
                                  <p className="text-white/25 text-[9px] uppercase tracking-wider mb-0.5">Vol Ratio</p>
                                  <p className="text-cyan-400 font-semibold">{((stock.volumeRatio ?? 0) * 100).toFixed(0)}%</p>
                                </div>
                                <div>
                                  <p className="text-white/25 text-[9px] uppercase tracking-wider mb-0.5">6M RS</p>
                                  <p className={`font-semibold ${(stock.rsScore ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                    {(stock.rsScore ?? 0) >= 0 ? "+" : ""}{(stock.rsScore ?? 0).toFixed(1)}%
                                  </p>
                                </div>
                                <div>
                                  <p className="text-white/25 text-[9px] uppercase tracking-wider mb-0.5">Turnover</p>
                                  <p className="text-white/60 font-semibold">₹{(stock.turnover / 100000).toFixed(1)}L</p>
                                </div>
                                <div>
                                  <p className="text-white/25 text-[9px] uppercase tracking-wider mb-0.5">Setup</p>
                                  <p className="text-primary/60 font-semibold text-[9px] leading-tight">{stock.setup}</p>
                                </div>
                              </div>

                              {/* EMA Stack visual */}
                              <div className="mt-3 flex items-center gap-2 flex-wrap">
                                <span className="text-[9px] font-mono text-white/20 uppercase">EMA Stack:</span>
                                {[
                                  { label: "Price", val: stock.price,  color: "text-white"      },
                                  { label: "9",     val: stock.ema9,   color: "text-cyan-400"   },
                                  { label: "20",    val: stock.ema20,  color: "text-blue-400"   },
                                  { label: "50",    val: stock.ema50,  color: "text-emerald-400"},
                                  { label: "150",   val: stock.ema150, color: "text-yellow-400" },
                                  { label: "200",   val: stock.ema200, color: "text-orange-400" },
                                ].map((e, i, arr) => (
                                  <span key={e.label} className="inline-flex items-center gap-1">
                                    <span className={`text-[10px] font-mono font-bold ${e.color}`}>{e.label}</span>
                                    {i < arr.length - 1 && <span className="text-emerald-500/50 text-[10px]">›</span>}
                                  </span>
                                ))}
                                <span className="text-[9px] text-emerald-400/50 font-mono ml-1">✓ Perfect VCP alignment</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 glass-card rounded-2xl border border-white/6">
            <Activity className="w-14 h-14 mx-auto text-white/15 mb-4" />
            <h3 className="text-base font-semibold text-white/60 mb-2">No stocks matched all 12 VCP filters</h3>
            <p className="text-sm text-white/30 max-w-md mx-auto">
              The scanner checks ATR progressive contraction, full EMA stack (9›20›50›150›200), 
              volume dry-up (below 85% of 20D avg), within 15% of 52W high, and controlled daily change.
              Try again during market hours — VCP setups are more common in trending markets.
            </p>
          </div>
        )}
      </div>

      {/* Drawer */}
      <StockChartDrawer
        stock={selectedStock}
        onClose={() => setSelectedStock(null)}
      />
    </div>
  );
}
