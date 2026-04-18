/**
 * StockChartDrawer — A TradingView-style full right-side panel that slides in
 * when the user clicks any recommended or scanned stock.
 *
 * Contains:
 *   - Header: Symbol, name, live price + change badge
 *   - Full TradingView chart
 *   - Quick stats strip (open, high, low, prev close, volume, mkt cap)
 *   - AI insight badge (Buy/Hold/Sell with gauge)
 *   - "Open full analysis" link → /stock/:symbol
 */
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import { X, ExternalLink, TrendingUp, TrendingDown, BarChart2 } from "lucide-react";
import { TradingViewChart, toTVSymbol } from "./TradingViewChart";
import { Link } from "wouter";

/* ── Types ───────────────────────────────────────────────── */
export interface StockDrawerPayload {
  /** Yahoo-style symbol, plain symbol, or "NSE:XXX" format */
  symbol:   string;
  name?:    string;
  exchange?: string; // "NSE" | "BSE"
  /** If already known (from recommendation), pass to avoid extra fetch */
  price?:       number;
  change?:      number;
  changePercent?: number;
  targetPrice?: string;
  stopLoss?:    string;
  reasonToBuy?: string;
}

interface Props {
  stock:   StockDrawerPayload | null;
  onClose: () => void;
}

/* ── Interval selector ───────────────────────────────────── */
const INTERVALS = [
  { label: "5m",  value: "5"  },
  { label: "15m", value: "15" },
  { label: "1H",  value: "60" },
  { label: "1D",  value: "D"  },
  { label: "1W",  value: "W"  },
  { label: "1M",  value: "M"  },
];

/* ── Live price fetcher ──────────────────────────────────── */
function useLiveQuote(symbol: string | null) {
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetch_ = useCallback(async (sym: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/stock/${encodeURIComponent(sym)}`);
      if (r.ok) {
        const d = await r.json();
        setQuote(d.stock ?? null);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!symbol) { setQuote(null); return; }
    fetch_(symbol);
    // Poll every 30s for live price
    const t = setInterval(() => fetch_(symbol), 30000);
    return () => clearInterval(t);
  }, [symbol, fetch_]);

  return { quote, loading };
}

/* ── AI insight fetcher ──────────────────────────────────── */
function useInsight(symbol: string | null) {
  const [insight, setInsight] = useState<any>(null);
  useEffect(() => {
    if (!symbol) { setInsight(null); return; }
    let live = true;
    fetch(`/api/stock/${encodeURIComponent(symbol)}/insight?timeframe=mid`)
      .then(r => r.json())
      .then(d => { if (live) setInsight(d); })
      .catch(() => {});
    return () => { live = false; };
  }, [symbol]);
  return insight;
}

/* ── Stat pill ───────────────────────────────────────────── */
function StatPill({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[72px]">
      <span className="text-[10px] text-white/35 font-mono uppercase tracking-wider">{label}</span>
      <span className="text-[13px] text-white/85 font-mono font-semibold tabular-nums">
        {value ?? "—"}
      </span>
    </div>
  );
}

/* ── Main drawer ─────────────────────────────────────────── */
export function StockChartDrawer({ stock, onClose }: Props) {
  const [interval, setInterval] = useState("D");

  // Build clean symbol for API queries (Yahoo-style)
  const apiSymbol = stock
    ? (stock.symbol.includes(":") ? `${stock.symbol.split(":")[1]}.NS` : stock.symbol)
    : null;

  const { quote, loading: quoteLoading } = useLiveQuote(
    stock ? stock.symbol : null
  );
  const insight = useInsight(stock ? stock.symbol : null);

  // Prefer live quote data, fall back to passed-in props
  const price         = quote?.price         ?? stock?.price;
  const change        = quote?.change        ?? stock?.change;
  const changePercent = quote?.changePercent ?? stock?.changePercent;
  const name          = quote?.name          ?? stock?.name ?? stock?.symbol;
  const isUp          = (changePercent ?? 0) >= 0;

  const verdictColor =
    insight?.verdict === "Buy"  ? "text-emerald-400" :
    insight?.verdict === "Sell" ? "text-red-400"     : "text-yellow-400";

  const verdictBg =
    insight?.verdict === "Buy"  ? "bg-emerald-500/10 border-emerald-500/25" :
    insight?.verdict === "Sell" ? "bg-red-500/10     border-red-500/25"     :
                                  "bg-yellow-500/10  border-yellow-500/25";

  /* Keyboard dismiss */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  /* Body scroll lock */
  useEffect(() => {
    if (stock) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [!!stock]);

  // Build the URL for full analysis page
  const fullAnalysisUrl = stock
    ? `/stock/${encodeURIComponent(stock.symbol)}`
    : "#";

  return (
    <AnimatePresence>
      {stock && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            key="panel"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0,      opacity: 1 }}
            exit={{   x: "100%",  opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed right-0 top-0 bottom-0 z-50 flex flex-col w-full max-w-3xl"
            style={{
              background: "hsl(0 0% 5%)",
              borderLeft: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "-24px 0 80px 0 rgba(0,0,0,0.7)",
            }}
          >
            {/* ── Header ─────────────────────────────── */}
            <div
              className="flex items-start justify-between px-5 py-4 border-b border-white/6 flex-shrink-0"
              style={{ background: "hsl(0 0% 6%)" }}
            >
              <div className="flex flex-col gap-1 min-w-0">
                {/* Symbol + exchange badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl font-display font-extrabold text-white font-mono tracking-tight">
                    {stock.symbol.includes(":")
                      ? stock.symbol.split(":")[1]
                      : stock.symbol.replace(/\.(NS|BO)$/i, "")}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/6 text-white/40 border border-white/8">
                    {stock.exchange ?? (stock.symbol.includes("NS") ? "NSE" : "NSE")}
                  </span>
                  {/* AI verdict */}
                  {insight?.verdict && (
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${verdictBg} ${verdictColor}`}>
                      {insight.verdict} · {insight.confidence}%
                    </span>
                  )}
                </div>

                {/* Company name */}
                <span className="text-sm text-white/45 font-sans truncate max-w-xs">
                  {name}
                </span>

                {/* Price */}
                <div className="flex items-center gap-3 mt-1">
                  {quoteLoading && !price ? (
                    <div className="h-8 w-32 rounded-lg bg-white/5 animate-pulse" />
                  ) : price ? (
                    <>
                      <span className="text-2xl font-mono font-bold text-white tabular-nums">
                        ₹{Number(price).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </span>
                      <span
                        className={`flex items-center gap-1 text-sm font-mono font-semibold tabular-nums px-2 py-1 rounded-full border
                          ${isUp
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                            : "text-red-400 bg-red-500/10 border-red-500/20"
                          }`}
                      >
                        {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {isUp ? "+" : ""}{Number(changePercent ?? 0).toFixed(2)}%
                        &nbsp;({isUp ? "+" : ""}₹{Number(change ?? 0).toFixed(2)})
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Right actions */}
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <Link href={fullAnalysisUrl}>
                  <a
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-card border border-white/8
                      text-xs font-mono text-white/60 hover:text-white hover:border-primary/40 transition-all duration-200"
                    title="Open full analysis"
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    Full Analysis
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </Link>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg glass-card border border-white/8 flex items-center justify-center
                    text-white/40 hover:text-white hover:border-white/20 transition-all duration-200"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Quick stats strip ───────────────────── */}
            {quote && (
              <div className="flex items-center gap-5 px-5 py-3 border-b border-white/5 overflow-x-auto flex-shrink-0">
                <StatPill label="Open"       value={quote.open       ? `₹${Number(quote.open).toFixed(2)}`       : undefined} />
                <StatPill label="High"       value={quote.high       ? `₹${Number(quote.high).toFixed(2)}`       : undefined} />
                <StatPill label="Low"        value={quote.low        ? `₹${Number(quote.low).toFixed(2)}`        : undefined} />
                <StatPill label="Prev Close" value={quote.previousClose ? `₹${Number(quote.previousClose).toFixed(2)}` : undefined} />
                <StatPill label="Volume"     value={quote.volume     ? Number(quote.volume).toLocaleString("en-IN") : undefined} />
                <StatPill label="Mkt Cap"    value={quote.marketCap  ? `₹${(Number(quote.marketCap) / 1e7).toFixed(0)}Cr` : undefined} />
              </div>
            )}

            {/* ── Interval selector ───────────────────── */}
            <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-white/5 flex-shrink-0">
              {INTERVALS.map(iv => (
                <button
                  key={iv.value}
                  onClick={() => setInterval(iv.value)}
                  className={`px-3 py-1 rounded-md text-[11px] font-mono font-semibold transition-all duration-150
                    ${interval === iv.value
                      ? "bg-primary/80 text-white shadow-[0_0_10px_0_hsl(260,84%,65%,0.35)]"
                      : "text-white/35 hover:text-white/70 hover:bg-white/5"
                    }`}
                >
                  {iv.label}
                </button>
              ))}
              <div className="ml-auto text-[10px] text-white/20 font-mono">Powered by TradingView</div>
            </div>

            {/* ── TradingView chart ────────────────────── */}
            <div className="flex-1 min-h-0 px-0 overflow-hidden">
              <TradingViewChart
                symbol={stock.symbol}
                exchange={stock.exchange}
                interval={interval}
                height="100%"
                className="h-full rounded-none"
                showToolbar={true}
                allowSymbolChange={false}
                studies={["RSI@tv-basicstudies", "MAExp@tv-basicstudies", "MACD@tv-basicstudies"]}
              />
            </div>

            {/* ── Bottom bar: rec details if available ─── */}
            {(stock.targetPrice || stock.stopLoss || stock.reasonToBuy) && (
              <div
                className="flex-shrink-0 px-5 py-4 border-t border-white/6 grid grid-cols-3 gap-4"
                style={{ background: "hsl(0 0% 6%)" }}
              >
                {stock.targetPrice && (
                  <div>
                    <div className="text-[10px] text-white/35 font-mono uppercase tracking-wider mb-1">Target</div>
                    <div className="text-base font-mono font-bold text-emerald-400 tabular-nums">₹{stock.targetPrice}</div>
                  </div>
                )}
                {stock.stopLoss && (
                  <div>
                    <div className="text-[10px] text-white/35 font-mono uppercase tracking-wider mb-1">Stop Loss</div>
                    <div className="text-base font-mono font-bold text-red-400 tabular-nums">₹{stock.stopLoss}</div>
                  </div>
                )}
                {stock.reasonToBuy && (
                  <div className="col-span-3 mt-1">
                    <div className="text-[10px] text-white/35 font-mono uppercase tracking-wider mb-1">Reason</div>
                    <p className="text-xs text-white/50 font-sans leading-relaxed line-clamp-2">{stock.reasonToBuy}</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
