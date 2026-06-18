import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, BarChart2, TrendingUp, TrendingDown, RefreshCw, Layers, Compass, Zap, Target } from "lucide-react";
import { StockChartDrawer, type StockDrawerPayload } from "@/components/StockChartDrawer";

interface PatternStock {
  symbol: string;
  stockName: string;
  price: number;
  changePercent: number;
  volume: string;
  pattern: string;
  stage: "Near Breakout" | "Breakout Confirmed" | "Consolidation" | "Pullback";
  details: string;
}

const PATTERNS = [
  {
    key: "cup_and_handle",
    name: "Cup and Handle",
    desc: "A bullish continuation pattern showing a rounding bottom (cup) and a minor consolidation pullback (handle). Signals accumulation before a breakout.",
    bullish: true,
    target: "15% - 25%",
    checklist: ["U-shaped rounding bottom", "Drawdown from rim between 10% and 30%", "Shallow consolidation handle < 12%", "Breakout above cup rim resistance"]
  },
  {
    key: "flag_and_pole",
    name: "Flag and Pole",
    desc: "A strong momentum pattern. A near-vertical rally (pole) on high volume is followed by a narrow, downward-sloping flag consolidation. High breakout probability.",
    bullish: true,
    target: "10% - 20%",
    checklist: ["Sharp run-up pole (>12% in 4-8 days)", "Consolidation flag range < 7%", "Volume contracts inside the flag", "Breakout above the upper flag boundary"]
  },
  {
    key: "double_bottom",
    name: "Double Bottom",
    desc: "A classic trend reversal pattern. The price hits a support level twice with a peak in between, forming a 'W' shape. Indicates strong demand at support.",
    bullish: true,
    target: "12% - 18%",
    checklist: ["Two distinct bottoms in last 60 days", "Bottoms support levels within 2.5% of each other", "Neckline peak between bottoms", "Rebound from the second bottom on volume"]
  },
  {
    key: "head_and_shoulders",
    name: "Inverse Head & Shoulders",
    desc: "A powerful bullish reversal pattern featuring three troughs: a lower middle trough (head) and two shallow outer troughs (shoulders). Neckline breakout confirms.",
    bullish: true,
    target: "18% - 30%",
    checklist: ["Head is the lowest trough", "Left & right shoulder troughs are within 3.5% of each other", "Resistance neckline connecting peak 1 and peak 2", "Breakout above neckline on strong volume"]
  },
  {
    key: "ascending_triangle",
    name: "Ascending Triangle",
    desc: "A bullish pattern characterized by a flat overhead resistance line and a rising support line (higher lows). Suggests buyers are becoming more aggressive.",
    bullish: true,
    target: "8% - 15%",
    checklist: ["Flat resistance ceiling (multiple highs within 1.5%)", "Series of ascending higher lows", "Price converges toward the apex", "Volume spikes on final breakout above resistance"]
  }
];

export default function ChartPatterns() {
  const [selectedPattern, setSelectedPattern] = useState(PATTERNS[0]);
  const [search, setSearch] = useState("");
  const [selectedStock, setSelectedStock] = useState<StockDrawerPayload | null>(null);
  const [cap, setCap] = useState("all");
  const [fundamentals, setFundamentals] = useState(true);
  const [momentum, setMomentum] = useState(true);

  const { data, isLoading, refetch, isFetching } = useQuery<{ matches: PatternStock[] }>({
    queryKey: [`/api/chart-patterns`, selectedPattern.key, cap, fundamentals, momentum],
    queryFn: async () => {
      const res = await fetch(`/api/chart-patterns?pattern=${selectedPattern.key}&cap=${cap}&fundamentals=${fundamentals}&momentum=${momentum}`);
      if (!res.ok) throw new Error("Failed to scan patterns");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  const stocks = (data?.matches ?? []).filter(s =>
    !search ||
    s.stockName.toLowerCase().includes(search.toLowerCase()) ||
    s.symbol.toLowerCase().includes(search.toLowerCase())
  );

  const stageColors: Record<PatternStock["stage"], string> = {
    "Breakout Confirmed": "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    "Near Breakout": "bg-amber-500/10 border-amber-500/20 text-amber-400",
    "Consolidation": "bg-blue-500/10 border-blue-500/20 text-blue-400",
    "Pullback": "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
  };

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1 flex items-center gap-2">
            <Compass className="w-6 h-6 text-primary" />
            Chart Recognition
          </h1>
          <p className="text-sm text-white/40 font-sans">
            AI & technical pattern scanner · Automatic daily recognition over active NSE listings
          </p>
        </div>
      </div>

      {/* ── Pattern Selector ──────────────────── */}
      <div className="flex gap-2 pb-2 overflow-x-auto scrollbar-thin">
        {PATTERNS.map(p => (
          <button
            key={p.key}
            onClick={() => setSelectedPattern(p)}
            className={`px-4 py-2.5 rounded-xl border text-xs font-mono font-bold whitespace-nowrap transition-all duration-200
              ${selectedPattern.key === p.key
                ? "bg-primary/25 border-primary text-white shadow-[0_0_12px_0_hsl(260,84%,65%,0.3)]"
                : "glass-card border-white/8 text-white/40 hover:text-white/80 hover:border-white/15"
              }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* ── Pattern Details Card ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card rounded-2xl border border-white/6 p-5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-primary font-bold">Pattern Description</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${selectedPattern.bullish ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                {selectedPattern.bullish ? "BULLISH SETUP" : "BEARISH SETUP"}
              </span>
            </div>
            <h2 className="text-xl font-display font-bold text-white">{selectedPattern.name}</h2>
            <p className="text-xs text-white/60 leading-relaxed font-sans">{selectedPattern.desc}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/5">
            <div>
              <span className="text-[9px] font-mono uppercase tracking-widest text-white/20">Target Potential</span>
              <p className="text-sm font-mono font-bold text-emerald-400 mt-0.5">{selectedPattern.target}</p>
            </div>
            <div>
              <span className="text-[9px] font-mono uppercase tracking-widest text-white/20">Setup Type</span>
              <p className="text-sm font-mono font-bold text-primary mt-0.5">Continuation / Breakout</p>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-white/6 p-5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-primary font-bold block mb-3">Breakout Checklist</span>
          <div className="space-y-2">
            {selectedPattern.checklist.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs font-sans text-white/70">
                <span className="w-5 h-5 rounded-md bg-white/4 border border-white/8 flex items-center justify-center font-mono text-[9px] font-bold text-white/40 mt-0.5 flex-shrink-0">
                  {idx + 1}
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Controls ──────────────────────────── */}
      <div className="flex flex-col gap-4">
        {/* Filters Row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 glass-card rounded-xl p-1 border border-white/8">
            {["all", "large", "mid", "small"].map(c => (
              <button
                key={c}
                onClick={() => setCap(c)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold capitalize transition-all ${
                  cap === c
                    ? "bg-primary/20 text-white border border-primary/30 shadow-[0_0_8px_0_hsl(260,84%,65%,0.2)]"
                    : "text-white/40 hover:text-white/70 border border-transparent"
                }`}
              >
                {c === "all" ? "All Caps" : `${c} Cap`}
              </button>
            ))}
          </div>
          
          <label className="flex items-center gap-2 text-[11px] font-mono text-white/60 cursor-pointer glass-card px-3 py-2 rounded-xl border border-white/8 hover:border-white/20 transition-colors">
            <input type="checkbox" checked={fundamentals} onChange={e => setFundamentals(e.target.checked)} className="accent-primary w-3.5 h-3.5" />
            Strong Fundamentals
          </label>
          
          <label className="flex items-center gap-2 text-[11px] font-mono text-white/60 cursor-pointer glass-card px-3 py-2 rounded-xl border border-white/8 hover:border-white/20 transition-colors">
            <input type="checkbox" checked={momentum} onChange={e => setMomentum(e.target.checked)} className="accent-primary w-3.5 h-3.5" />
            High Momentum
          </label>
        </div>

        {/* Search & Refresh Row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search matches for ${selectedPattern.name}...`}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl glass-card border border-white/8 text-sm text-white/80
              placeholder:text-white/25 focus:outline-none focus:border-primary/50 font-mono bg-transparent transition-all"
          />
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-4 py-2.5 rounded-xl glass-card border border-white/8 text-xs font-mono text-white/50
            hover:text-white hover:border-primary/40 transition-all duration-200 flex items-center gap-2
            disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isFetching ? (
            <>
              <div className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              Re-Scan
            </>
          )}
        </button>
        </div>
      </div>

      {/* ── Table / List Results ──────────────── */}
      {isLoading || isFetching ? (
        <div className="space-y-3">
          <div className="glass-card rounded-2xl border border-white/6 p-10 text-center">
            <div className="inline-flex items-center gap-3 text-primary/60">
              <div className="w-5 h-5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
              <span className="text-sm font-mono">Running technical calculations over NSE universe...</span>
            </div>
            <p className="text-[10px] text-white/25 mt-2 font-mono">Comparing daily candles with {selectedPattern.name} constraints</p>
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-white/3 animate-pulse border border-white/5" />
          ))}
        </div>
      ) : stocks.length > 0 ? (
        <div className="rounded-2xl border border-white/6 overflow-hidden glass-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  {["#", "Stock", "Symbol", "Chart", "Price", "Daily Chg", "Stage", "Detection Details"].map((col, idx) => (
                    <th
                      key={col}
                      className={`px-4 py-3 text-[10px] font-mono font-semibold uppercase tracking-widest text-white/30
                        ${col === "Price" || col === "Daily Chg" ? "text-right" : "text-left"}
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
                    <tr
                      key={stock.symbol}
                      className="group border-b border-white/4 last:border-0 hover:bg-white/3 transition-all"
                    >
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-white/25 font-mono">{idx + 1}</span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="text-sm text-white/80 font-sans group-hover:text-white font-medium">
                          {stock.stockName}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="text-sm text-primary/70 group-hover:text-primary font-mono font-semibold">
                          {stock.symbol.replace(/\.(NS|BO)$/i, "")}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => setSelectedStock({
                            symbol: stock.symbol,
                            name: stock.stockName,
                            price: stock.price,
                            changePercent: stock.changePercent
                          })}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono
                            bg-white/4 border border-white/8 text-white/35 group-hover:text-primary/95
                            group-hover:border-primary/30 group-hover:bg-primary/8 transition-all"
                        >
                          <BarChart2 className="w-3.5 h-3.5" /> Chart
                        </button>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <span className="text-sm font-mono font-bold text-white tabular-nums">
                          ₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-mono font-bold tabular-nums px-2 py-0.5 rounded-full
                            ${isPos
                              ? "text-emerald-400 bg-emerald-500/8 border border-emerald-500/15"
                              : "text-red-400 bg-red-500/8 border border-red-500/15"
                            }`}
                        >
                          {isPos ? "+" : ""}{stock.changePercent.toFixed(2)}%
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${stageColors[stock.stage] || "bg-white/5 border-white/10 text-white/40"}`}>
                          {stock.stage}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="text-[11px] text-white/35 font-mono">
                          {stock.details}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 glass-card rounded-2xl border border-white/6">
          <Layers className="w-16 h-16 mx-auto text-white/15 mb-4 animate-pulse" />
          <h3 className="text-base font-semibold text-white/60 mb-2">No stocks forming {selectedPattern.name} currently</h3>
          <p className="text-sm text-white/30 max-w-sm mx-auto">
            The scanner couldn't identify any stocks matching these exact rules today. Try again later or scan another pattern.
          </p>
        </div>
      )}

      {/* Drawer */}
      <StockChartDrawer
        stock={selectedStock}
        onClose={() => setSelectedStock(null)}
      />
    </div>
  );
}
