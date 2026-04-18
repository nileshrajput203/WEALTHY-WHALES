import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import {
  AreaChart, CartesianGrid, XAxis, YAxis, Area, Tooltip, ResponsiveContainer,
} from "recharts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ─── Types ──────────────────────────────────────────────── */
type Quote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high?: number;
  low?: number;
  open?: number;
  previousClose?: number;
};

interface StockAnalysisPanelProps {
  symbol: string;
}

/* ─── SVG Confidence Gauge ───────────────────────────────── */
function ConfidenceGauge({
  verdict,
  confidence,
}: {
  verdict: "Buy" | "Hold" | "Sell" | null;
  confidence: number;
}) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const fill = verdict ? (confidence / 100) * circ : 0;
  const color =
    verdict === "Buy"  ? "hsl(142,71%,50%)" :
    verdict === "Sell" ? "hsl(0,84%,62%)"   :
                          "hsl(38,96%,58%)";
  const glowColor =
    verdict === "Buy"  ? "hsl(142,71%,50%,0.4)"  :
    verdict === "Sell" ? "hsl(0,84%,62%,0.4)"    :
                          "hsl(38,96%,58%,0.4)";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
          {/* Track */}
          <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          {/* Fill with animated stroke */}
          <motion.circle
            cx="44" cy="44" r={r} fill="none"
            stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - fill }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
            style={{ filter: `drop-shadow(0 0 6px ${glowColor})` }}
          />
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="text-xl font-display font-extrabold"
            style={{ color }}
          >
            {verdict ?? "—"}
          </motion.span>
          <span className="text-xs text-white/40 font-mono tabular-nums">
            {verdict ? `${confidence}%` : ""}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className={verdict === "Buy" ? "text-emerald-400 font-semibold" : "text-white/40"}>Buy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-yellow-400" />
          <span className={verdict === "Hold" ? "text-yellow-400 font-semibold" : "text-white/40"}>Hold</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className={verdict === "Sell" ? "text-red-400 font-semibold" : "text-white/40"}>Sell</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Glassmorphic Custom Tooltip ────────────────────────── */
function GlassTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value as number;
  return (
    <div className="px-3 py-2 rounded-xl glass-card border border-white/10 shadow-2xl">
      <div className="text-[11px] text-white/50 font-mono mb-0.5">Price</div>
      <div className="text-sm font-mono font-bold text-white tabular-nums">
        ₹{val?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}

/* ─── Segmented timeframe control ────────────────────────── */
function TimeframeSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const options = [
    { key: "1mo", label: "1M" },
    { key: "6mo", label: "6M" },
    { key: "2y",  label: "2Y" },
  ];
  return (
    <div className="inline-flex items-center glass-card rounded-full p-1 gap-0.5 border border-white/6">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`relative px-4 py-1.5 rounded-full text-xs font-mono font-semibold transition-all duration-200
            ${value === o.key
              ? "text-white"
              : "text-white/40 hover:text-white/70"
            }`}
        >
          {value === o.key && (
            <motion.span
              layoutId="timeframe-pill"
              className="absolute inset-0 bg-primary/80 rounded-full"
              style={{ boxShadow: "0 0 12px 0 hsl(260 84% 65% / 0.4)" }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ─── Analysis card ──────────────────────────────────────── */
function AnalysisCard({
  title,
  accentColor,
  children,
  href,
  hrefLabel,
  disabled,
}: {
  title: string;
  accentColor: string;
  children: ReactNode;
  href?: string;
  hrefLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border border-white/6 glass-card p-5 min-h-[180px] flex flex-col justify-between
        hover:border-white/12 transition-all duration-300 group relative overflow-hidden"
      style={{
        boxShadow: "0 2px 16px 0 hsl(0 0% 0% / 0.5)",
      }}
    >
      {/* Colored top border accent */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
        style={{ background: accentColor, opacity: 0.7 }}
      />
      {/* Corner glow on hover */}
      <div
        className="absolute top-0 left-0 w-24 h-24 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 0% 0%, ${accentColor}22 0%, transparent 70%)`,
        }}
      />
      <div className="flex-1">
        <div className="text-sm font-display font-bold mb-3" style={{ color: accentColor }}>
          {title}
        </div>
        <div className="text-xs text-white/50 font-sans leading-relaxed line-clamp-6">
          {children}
        </div>
      </div>
      {disabled ? (
        <span className="self-start mt-4 text-[11px] font-mono font-semibold text-white/25 border border-white/8 rounded-full px-4 py-1.5 cursor-not-allowed">
          coming soon
        </span>
      ) : href ? (
        <a
          href={href}
          className="self-start mt-4 text-[11px] font-mono font-semibold rounded-full px-4 py-1.5 transition-all duration-200"
          style={{
            color: accentColor,
            background: `${accentColor}15`,
            border: `1px solid ${accentColor}30`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 0 12px 0 ${accentColor}40`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
          }}
        >
          {hrefLabel ?? "view more"}
        </a>
      ) : null}
    </div>
  );
}

// Allow ReactNode in AnalysisCard children
import type { ReactNode } from "react";

/* ─── Main component ─────────────────────────────────────── */
export function StockAnalysisPanel({ symbol }: StockAnalysisPanelProps) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}`);
        if (!res.ok) throw new Error(`Failed to load stock: ${res.status}`);
        const data = await res.json();
        if (isMounted) setQuote(data.stock);
      } catch (e: any) {
        if (isMounted) setError(e.message || "Failed to fetch");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [symbol]);

  const isUp = (quote?.change ?? 0) >= 0;

  const [technicals, setTechnicals] = useState<any | null>(null);
  const [range, setRange] = useState<'1mo' | '6mo' | '2y'>('6mo');
  const [insight, setInsight] = useState<{ verdict: 'Buy' | 'Hold' | 'Sell'; confidence: number; reasons: string[] } | null>(null);
  const [aiFundamentals, setAiFundamentals] = useState<string>("");
  const [aiTechnicals, setAiTechnicals] = useState<string>("");

  useEffect(() => {
    let live = true;
    async function loadMore() {
      try {
        const [t, fAi, tAi] = await Promise.all([
          fetch(`/api/stock/${encodeURIComponent(symbol)}/technicals?range=${range}`).then(r => r.json()),
          fetch(`/api/stock/${encodeURIComponent(symbol)}/fundamentals/ai`).then(r => r.json()).catch(() => ({ markdown: "" })),
          fetch(`/api/stock/${encodeURIComponent(symbol)}/technicals/ai?range=${range}`).then(r => r.json()).catch(() => ({ markdown: "" })),
        ]);
        if (live) { setTechnicals(t); setAiFundamentals(fAi.markdown || ""); setAiTechnicals(tAi.markdown || ""); }
        const tf = range === '1mo' ? 'short' : range === '2y' ? 'long' : 'mid';
        const i = await fetch(`/api/stock/${encodeURIComponent(symbol)}/insight?timeframe=${tf}`).then(r => r.json());
        if (live) setInsight(i);
      } catch { }
    }
    loadMore();
    return () => { live = false; };
  }, [symbol, range]);

  const chartSeries = useMemo(() => {
    const candles = technicals?.candles || [];
    if (candles.length) {
      return candles.map((c: any, i: number) => ({ t: i, p: Number(c.close) }));
    }
    const base = quote?.price ?? 100;
    return Array.from({ length: 30 }, (_v, i) => ({ t: i, p: base * (0.98 + (i / 300)) }));
  }, [technicals, quote]);

  /* ── Color tokens based on direction ── */
  const bullishColor = "hsl(142,71%,50%)";
  const bearishColor = "hsl(0,84%,62%)";
  const chartColor   = isUp ? bullishColor : bearishColor;
  const chartGradId  = isUp ? "gradBull" : "gradBear";
  const chartGradStart = isUp ? "hsl(142,71%,50%,0.35)" : "hsl(0,84%,62%,0.35)";

  /* ── Loading ─────────────────────────── */
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-72 rounded-2xl bg-white/3 animate-pulse border border-white/5" />
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 rounded-2xl bg-white/3 animate-pulse border border-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-red-400 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        {error}
      </div>
    );
  }

  if (!quote) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      {/* ── Top row: Chart + Gauge ────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-5">

        {/* Area chart */}
        <div className="rounded-2xl border border-white/6 glass-card overflow-hidden">
          {/* Chart header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div>
              <div className="text-[11px] font-mono text-white/40 uppercase tracking-widest mb-0.5">
                {quote.symbol}
              </div>
              <div className="text-2xl font-mono font-bold text-white tabular-nums">
                ₹{quote.price?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-mono font-semibold tabular-nums
              ${isUp
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}
              style={isUp ? { boxShadow: "0 0 12px 0 hsl(142,71%,50%,0.2)" } : {}}
            >
              {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {isUp ? "+" : ""}{(quote.changePercent || 0).toFixed(2)}%
            </div>
          </div>

          {/* Timeframe selector */}
          <div className="flex items-center justify-between px-5 pt-3 pb-1">
            <span className="text-[11px] text-white/35 font-mono">{quote.name}</span>
            <TimeframeSelector value={range} onChange={(v) => setRange(v as any)} />
          </div>

          {/* Chart */}
          <div className="px-2 pb-3 pt-1">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartSeries} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id={chartGradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor={chartColor} stopOpacity={0.35} />
                    <stop offset="90%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="t" hide />
                <YAxis domain={["auto", "auto"]} hide />
                <Tooltip content={<GlassTooltip />} />
                <Area
                  type="monotone"
                  dataKey="p"
                  strokeWidth={2}
                  stroke={chartColor}
                  fill={`url(#${chartGradId})`}
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gauge + quick stats */}
        <div className="rounded-2xl border border-white/6 glass-card p-5 flex flex-col items-center justify-center gap-5">
          <AnimatePresence mode="wait">
            <ConfidenceGauge
              key={insight?.verdict ?? "empty"}
              verdict={insight?.verdict ?? null}
              confidence={insight?.confidence ?? 0}
            />
          </AnimatePresence>

          {/* Key reasons */}
          {insight?.reasons?.length ? (
            <div className="w-full space-y-1.5">
              {insight.reasons.slice(0, 3).map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] text-white/45 font-sans">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 flex-shrink-0" />
                  {r}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Analysis cards ────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AnalysisCard
          title="Fundamental Analysis"
          accentColor={bullishColor}
          href={`/stock/${encodeURIComponent(symbol)}/fundamentals`}
          hrefLabel="View full report →"
        >
          {aiFundamentals ? (
            <div className="prose prose-xs dark:prose-invert max-w-none text-[11px] text-white/50">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiFundamentals}</ReactMarkdown>
            </div>
          ) : (
            <span className="text-white/30 italic">Generating analysis…</span>
          )}
        </AnalysisCard>

        <AnalysisCard
          title="Technical Analysis"
          accentColor="hsl(217,91%,66%)"
          href={`/stock/${encodeURIComponent(symbol)}/technicals`}
          hrefLabel="View technicals →"
        >
          {aiTechnicals ? (
            <div className="prose prose-xs dark:prose-invert max-w-none text-[11px] text-white/50">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiTechnicals}</ReactMarkdown>
            </div>
          ) : technicals ? (
            <ul className="space-y-1 text-[11px] text-white/50 list-none">
              <li><span className="text-white/70 font-semibold">Trend: </span>{technicals.trend}</li>
              <li><span className="text-white/70 font-semibold">Momentum: </span>{technicals.momentum}</li>
              <li>
                <span className="text-white/70 font-semibold">SMA20 vs SMA50: </span>
                {Number(technicals.indicators?.sma20 || 0) > Number(technicals.indicators?.sma50 || 0) ? 'Bullish' : 'Neutral / Bearish'}
              </li>
            </ul>
          ) : (
            <span className="text-white/30 italic">Loading…</span>
          )}
        </AnalysisCard>

        <AnalysisCard
          title="Seasonality"
          accentColor="hsl(38,96%,58%)"
          disabled
        >
          <span className="text-white/30 italic">
            Predictable cyclical trends and monthly performance history — coming soon.
          </span>
        </AnalysisCard>
      </div>

      {/* ── Risk / Opportunity split ──────────── */}
      <div className="rounded-2xl border border-white/6 glass-card overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Risk */}
          <div className="p-7 relative group overflow-hidden border-b md:border-b-0 md:border-r border-white/5">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent group-hover:from-red-500/8 transition-colors" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-red-500/50 via-red-500/20 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                </div>
                <span className="text-base font-display font-bold text-red-400">Risk Factors</span>
              </div>
              <ul className="space-y-3">
                {["High input cost sensitivity", "Margin volatility vs peers", "Regulatory overhang possible"].map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/50 font-sans">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500/50 mt-1.5 flex-shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Opportunity */}
          <div className="p-7 relative group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent group-hover:from-emerald-500/8 transition-colors" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-emerald-500/50 via-emerald-500/20 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-base font-display font-bold text-emerald-400">Opportunities</span>
              </div>
              <ul className="space-y-3">
                {["Strong demand visibility", "Operating leverage improving", "New product/segment ramp-up"].map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/50 font-sans">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 mt-1.5 flex-shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
