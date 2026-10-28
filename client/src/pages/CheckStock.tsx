import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useViewMode } from "@/hooks/useViewMode";
import { type StockIQResult } from "@shared/types";
import { StockSearchBar } from "@/components/StockSearchBar";
import { InstitutionalVerdictCard } from "@/components/InstitutionalVerdictCard";
import { FoundationModelCard } from "@/components/FoundationModelCard";
import { OrderBlockCard } from "@/components/OrderBlockCard";
import { Search, BarChart2, ExternalLink, Globe, Settings, X, Plus, TrendingUp, TrendingDown, Info, Sparkles } from "lucide-react";
import { FundamentalDashboard } from "@/components/FundamentalDashboard";
import { PredictaPanel } from "@/components/PredictaPanel";
import { TradingViewChart, toTVSymbol } from "@/components/TradingViewChart";
import { motion, AnimatePresence } from "framer-motion";

const INTERVALS = [
  { label: "15m", value: "15"  },
  { label: "1H",  value: "60"  },
  { label: "4H",  value: "240" },
  { label: "1D",  value: "D"   },
  { label: "1W",  value: "W"   },
];

const RATIO_METADATA: Record<string, { label: string; desc: string }> = {
  mktCap: { label: "Market Cap", desc: "Total market value of shares" },
  currentPrice: { label: "Current Price", desc: "Latest trading price" },
  highLow: { label: "High / Low", desc: "52-week highest and lowest prices" },
  pe: { label: "Stock P/E", desc: "Price-to-earnings ratio" },
  bookValue: { label: "Book Value", desc: "Net asset value per share" },
  divYield: { label: "Dividend Yield", desc: "Dividend payout percentage" },
  roce: { label: "ROCE", desc: "Return on capital employed" },
  roe: { label: "ROE", desc: "Return on equity" },
  faceValue: { label: "Face Value", desc: "Nominal value of a share" },
  debtEquity: { label: "Debt to Equity", desc: "Total debt relative to equity" },
  promoterHolding: { label: "Promoter holding", desc: "Shares held by promoters" },
  interestCoverage: { label: "Interest Coverage", desc: "Ability to pay interest expenses" },
  netProfitMargin: { label: "Net Profit Margin", desc: "Net income as a percentage of revenue" },
  salesGrowth: { label: "Sales Growth (3Y)", desc: "Compound annual sales growth rate over 3 years" },
  profitGrowth: { label: "Profit Growth (3Y)", desc: "Compound annual net profit growth rate over 3 years" },
  pegRatio: { label: "PEG Ratio", desc: "P/E ratio divided by earnings growth rate" }
};

const METRICS_POOL: Record<string, (q: any, f: any, iq: any, sym: string) => string> = {
  mktCap: (q: any, f: any, iq: any, sym: string) => {
    const val = q?.stock?.marketCap ? (Number(q.stock.marketCap) / 1e7).toFixed(0) : null;
    return val ? `₹ ${Number(val).toLocaleString("en-IN")} Cr.` : "—";
  },
  currentPrice: (q: any, f: any, iq: any, sym: string) => {
    return q?.stock?.price ? `₹ ${Number(q.stock.price).toLocaleString("en-IN")}` : "—";
  },
  highLow: (q: any, f: any, iq: any, sym: string) => {
    const high = q?.stock?.high ? `₹ ${Number(q.stock.high).toFixed(0)}` : "—";
    const low = q?.stock?.low ? `₹ ${Number(q.stock.low).toFixed(0)}` : "—";
    return `${high} / ${low}`;
  },
  pe: (q: any, f: any, iq: any, sym: string) => {
    const val = f?.ratios?.yearly?.at(-1)?.pe || iq?.fundamentals?.metrics?.find((m: any) => m.name === "P/E Ratio")?.value;
    return val ? String(val) : "—";
  },
  bookValue: (q: any, f: any, iq: any, sym: string) => {
    const pb = f?.ratios?.yearly?.at(-1)?.pb;
    const price = q?.stock?.price;
    if (pb && price && pb > 0) return `₹ ${(price / pb).toFixed(1)}`;
    const bv = f?.ratios?.yearly?.at(-1)?.bookValue || iq?.fundamentals?.metrics?.find((m: any) => m.name === "Book Value")?.value;
    return bv ? `₹ ${bv}` : "—";
  },
  divYield: (q: any, f: any, iq: any, sym: string) => {
    const dy = f?.ratios?.yearly?.at(-1)?.dividendYield || iq?.fundamentals?.metrics?.find((m: any) => m.name === "Dividend Yield")?.value || q?.stock?.dividendYield;
    return dy != null ? `${Number(dy).toFixed(2)} %` : "—";
  },
  roce: (q: any, f: any, iq: any, sym: string) => {
    const val = f?.ratios?.yearly?.at(-1)?.roce || iq?.fundamentals?.metrics?.find((m: any) => m.name === "ROCE")?.value;
    return val ? `${val} %` : "—";
  },
  roe: (q: any, f: any, iq: any, sym: string) => {
    const val = f?.ratios?.yearly?.at(-1)?.roe || iq?.fundamentals?.metrics?.find((m: any) => m.name === "ROE")?.value;
    return val ? `${val} %` : "—";
  },
  faceValue: (q: any, f: any, iq: any, sym: string) => {
    const fv = f?.ratios?.yearly?.at(-1)?.faceValue || q?.stock?.faceValue;
    return fv ? `₹ ${fv}.00` : "—";
  },
  debtEquity: (q: any, f: any, iq: any, sym: string) => {
    const val = f?.ratios?.yearly?.at(-1)?.debtEquity || iq?.fundamentals?.metrics?.find((m: any) => m.name === "Debt/Equity")?.value;
    return val ? String(val) : "—";
  },
  promoterHolding: (q: any, f: any, iq: any, sym: string) => {
    const val = f?.shareholding?.yearly?.at(-1)?.promoter;
    return val ? `${val.toFixed(2)} %` : "—";
  },
  interestCoverage: (q: any, f: any, iq: any, sym: string) => {
    const val = f?.ratios?.yearly?.at(-1)?.interestCoverage;
    return val ? String(val) : "—";
  },
  netProfitMargin: (q: any, f: any, iq: any, sym: string) => {
    const val = f?.ratios?.yearly?.at(-1)?.netProfitMargin;
    return val ? `${val.toFixed(1)} %` : "—";
  },
  salesGrowth: (q: any, f: any, iq: any, sym: string) => {
    const sg = f?.ratios?.yearly?.at(-1)?.salesGrowth || f?.profitAndLoss?.salesGrowth3Y;
    return sg != null ? `${Number(sg).toFixed(1)} %` : "—";
  },
  profitGrowth: (q: any, f: any, iq: any, sym: string) => {
    const pg = f?.ratios?.yearly?.at(-1)?.profitGrowth || f?.profitAndLoss?.profitGrowth3Y;
    return pg != null ? `${Number(pg).toFixed(1)} %` : "—";
  },
  pegRatio: (q: any, f: any, iq: any, sym: string) => {
    const val = iq?.fundamentals?.metrics?.find((m: any) => m.name === "PEG Ratio")?.value;
    return val ? String(val) : "—";
  }
};

const SUGGESTED_RATIOS = [
  { label: "Debt to Equity", key: "debtEquity" },
  { label: "Promoter holding", key: "promoterHolding" },
  { label: "Interest Coverage", key: "interestCoverage" },
  { label: "Net Profit Margin", key: "netProfitMargin" },
  { label: "Sales Growth (3Y)", key: "salesGrowth" },
  { label: "Profit Growth (3Y)", key: "profitGrowth" },
  { label: "PEG Ratio", key: "pegRatio" }
];

export default function CheckStock() {
  const [match, params] = useRoute("/stock/:symbol");
  const [, setLocation] = useLocation();
  const { isPro } = useViewMode();
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [interval, setInterval] = useState("D");

  const { data: stockIq } = useQuery<StockIQResult>({
    queryKey: [`/api/stockiq/${selectedStock}`],
    enabled: !!selectedStock,
  });

  const { data: quote, isLoading: quoteLoading } = useQuery<any>({
    queryKey: [`/api/stock/${selectedStock}`],
    enabled: !!selectedStock,
  });

  const { data: financials } = useQuery<any>({
    queryKey: [`/api/stock/${selectedStock}/financials`],
    enabled: !!selectedStock,
  });

  const { data: insight, isLoading: insightLoading } = useQuery<any>({
    queryKey: [`/api/stock/${selectedStock}/insight`],
    enabled: !!selectedStock,
  });

  const [customRatios, setCustomRatios] = useState<string[]>([
    "mktCap", "currentPrice", "highLow", "pe", "bookValue", "divYield", "roce", "roe", "faceValue"
  ]);
  const [ratioQuery, setRatioQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const handleAddRatio = (key: string) => {
    if (!customRatios.includes(key)) {
      setCustomRatios([...customRatios, key]);
    }
    setRatioQuery("");
    setShowSuggestions(false);
  };

  const handleRemoveRatio = (key: string) => {
    setCustomRatios(customRatios.filter((k) => k !== key));
  };

  useEffect(() => {
    if (match && params?.symbol) {
      setSelectedStock(params.symbol);
    }
  }, [match, params]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1 flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-primary" />
          Check Your Stock
        </h1>
        <p className="text-sm text-white/40 font-sans">
          Search any NSE/BSE stock for live TradingView charts + AI-powered analysis
        </p>
      </div>

      {/* Search bar */}
      <div className="max-w-3xl">
        <StockSearchBar />
      </div>

      <AnimatePresence mode="wait">
        {!selectedStock ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-20 rounded-2xl border border-border/50 bg-card/40"
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-primary/10 border border-primary/20 text-primary">
              <Search className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold font-display text-foreground mb-2">Search Any NSE/BSE Equity</h3>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed mb-6">
              Enter any listed symbol to inspect real-time TradingView charts, audited balance sheets & P&L ratios, technical indicators, and quantitative momentum ratings.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto">
              <span className="text-xs text-muted-foreground/70 font-mono mr-1">Popular:</span>
              {["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "TATAMOTORS"].map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => setLocation(`/stock/${sym}`)}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-muted/60 hover:bg-primary/15 hover:text-primary hover:border-primary/30 border border-border transition-all shadow-2xs"
                >
                  {sym}
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={selectedStock}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >

            {/* ── 5-Pillar Institutional Verdict Card (NSE/BSE Microstructure) ── */}
            {stockIq?.institutionalVerdict && (
              <InstitutionalVerdictCard
                verdictData={stockIq.institutionalVerdict}
                symbol={selectedStock}
                price={quote?.stock?.price || 0}
              />
            )}

            {/* ── Screener.in Style Key Metrics Card ── */}
            {quoteLoading && !quote && (
              <div className="glass-card border border-white/10 rounded-2xl p-6 space-y-4 animate-pulse bg-white/[0.02]">
                <div className="h-7 w-48 bg-white/10 rounded-lg" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="h-16 bg-white/5 rounded-xl border border-white/5" />
                  ))}
                </div>
              </div>
            )}

            {quote && (
              <div 
                className="glass-card border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl relative overflow-visible"
                style={{ background: "rgba(10, 10, 10, 0.45)", backdropFilter: "blur(12px)" }}
                onMouseLeave={() => setShowSuggestions(false)}
              >
                {/* Glowing Background Details */}
                <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
                
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                  <div>
                    <h2 className="text-2xl font-bold font-display text-white tracking-tight flex items-center gap-2.5 flex-wrap">
                      {quote.stock?.name || selectedStock}
                      {insight && (
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-extrabold tracking-wider uppercase border transition-all duration-300 shadow-lg relative overflow-hidden group
                          ${insight.verdict === "Buy"
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                            : insight.verdict === "Sell"
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.25)] hover:shadow-[0_0_20px_rgba(244,63,94,0.4)]"
                            : "bg-zinc-500/10 border-zinc-500/30 text-zinc-400 shadow-none"
                          }`}
                          title={`${insight.verdict} verdict with ${insight.confidence}% confidence, based on multi-factor fundamental, technical, and news sentiment analysis.`}
                        >
                          {/* Inner soft gradient light */}
                          <span className={`absolute inset-0 opacity-10 bg-gradient-to-r pointer-events-none
                            ${insight.verdict === "Buy" ? "from-emerald-500 to-teal-500" : insight.verdict === "Sell" ? "from-rose-500 to-red-500" : "from-zinc-500 to-slate-500"}`} 
                          />

                          {/* Pulsing Status indicator */}
                          <span className="relative flex h-2 w-2">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75
                              ${insight.verdict === "Buy" ? "bg-emerald-400" : insight.verdict === "Sell" ? "bg-rose-400" : "bg-zinc-400"}`} 
                            />
                            <span className={`relative inline-flex rounded-full h-2 w-2
                              ${insight.verdict === "Buy" ? "bg-emerald-500" : insight.verdict === "Sell" ? "bg-rose-500" : "bg-zinc-500"}`} 
                            />
                          </span>

                          {/* Icon */}
                          {insight.verdict === "Buy" && <TrendingUp className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />}
                          {insight.verdict === "Sell" && <TrendingDown className="w-3.5 h-3.5 text-rose-400 animate-bounce" />}

                          {/* Text labels with split styling */}
                          <span className="flex items-center gap-1.5 z-10">
                            <span className="font-black tracking-widest">{insight.verdict}</span>
                            <span className="opacity-30 font-normal">|</span>
                            <span className="opacity-90 font-bold">{insight.confidence}% CONFIDENCE</span>
                          </span>
                        </span>
                      )}
                      {insightLoading && (
                        <span className="text-[10px] font-mono text-white/30 animate-pulse flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-ping" />
                          Evaluating Sentiment & Signals...
                        </span>
                      )}
                    </h2>
                    <div className="flex items-center gap-3 mt-1.5 font-mono text-xs text-white/40">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5 text-white/30" />
                        <a href={`https://www.google.com/search?q=${encodeURIComponent((quote.stock?.name || selectedStock || "") + ' website')}`} 
                           target="_blank" rel="noopener noreferrer" className="hover:text-primary transition">
                          {(selectedStock || "").toLowerCase().replace(/\.(ns|bo)$/i, "")}.in
                        </a>
                      </span>
                      <span>•</span>
                      <a href={`https://www.google.com/search?q=BSE+${selectedStock}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition flex items-center gap-1">
                        BSE: {selectedStock?.replace(/\.(ns|bo)$/i, "")}
                      </a>
                      <span>•</span>
                      <a href={`https://www.google.com/search?q=NSE+${selectedStock}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition flex items-center gap-1">
                        NSE: {selectedStock?.replace(/\.(ns|bo)$/i, "")}
                      </a>
                    </div>
                    {insight?.reasons && insight.reasons.length > 0 && (
                      <div className="mt-3.5 max-w-2xl bg-white/[0.02] border border-white/5 rounded-xl p-3 text-[11px] leading-relaxed text-white/55">
                        <span className="font-mono font-bold text-white/80 uppercase tracking-wider block mb-1 flex items-center gap-1.5 text-[10px]">
                          <Info className="w-3.5 h-3.5 text-primary" /> Analyst Confluence Reasons
                        </span>
                        <ul className="list-disc pl-4 space-y-1 font-sans">
                          {insight.reasons.map((reason: string, i: number) => (
                            <li key={i}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold font-mono text-white">
                      ₹{quote.stock?.price ? Number(quote.stock.price).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
                    </span>
                    <span className={`text-sm font-semibold font-mono ${quote.stock?.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {quote.stock?.changePercent >= 0 ? "+" : ""}{Number(quote.stock?.changePercent || 0).toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {customRatios.map((ratioKey) => {
                    const config = RATIO_METADATA[ratioKey] || { label: ratioKey, desc: "" };
                    const value = METRICS_POOL[ratioKey] 
                      ? METRICS_POOL[ratioKey](quote, financials, stockIq, selectedStock || "")
                      : "—";

                    return (
                      <div key={ratioKey} className="group relative glass-card bg-white/2 hover:bg-white/4 border border-white/5 hover:border-white/10 rounded-xl p-4 transition-all duration-200 shadow-sm flex flex-col justify-between min-h-[90px]">
                        {isEditMode && (
                          <button
                            onClick={() => handleRemoveRatio(ratioKey)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition shadow-md z-10"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                        <span className="text-[11px] text-white/40 font-semibold uppercase tracking-wider font-sans block mb-1">
                          {config.label}
                        </span>
                        <div className="text-lg font-bold font-mono text-white tracking-tight">
                          {value}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Customizer Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/5 pt-4">
                  <div className="relative w-full max-w-sm">
                    <label className="text-[10px] font-mono text-white/35 uppercase tracking-widest block mb-1.5">Add ratio to table</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="eg. Promoter holding, Debt to Equity..."
                        value={ratioQuery}
                        onChange={(e) => {
                          setRatioQuery(e.target.value);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        className="w-full bg-white/3 hover:bg-white/5 focus:bg-white/6 border border-white/8 focus:border-primary/50 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none transition font-mono"
                      />
                    </div>

                    {/* Suggestions Dropdown */}
                    {showSuggestions && ratioQuery && (
                      <div className="absolute left-0 right-0 mt-1 bg-neutral-900 border border-white/10 rounded-lg shadow-2xl z-20 max-h-48 overflow-y-auto divide-y divide-white/5">
                        {SUGGESTED_RATIOS.filter(r => 
                          r.label.toLowerCase().includes(ratioQuery.toLowerCase()) && 
                          !customRatios.includes(r.key)
                        ).map((r) => (
                          <button
                            key={r.key}
                            onClick={() => handleAddRatio(r.key)}
                            className="w-full text-left px-3 py-2 hover:bg-white/5 text-xs text-white/85 hover:text-white transition font-mono flex justify-between items-center"
                          >
                            <span>{r.label}</span>
                            <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-mono font-bold uppercase">Add</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setIsEditMode(!isEditMode)}
                    className="flex items-center gap-1.5 self-end sm:self-auto px-4 py-1.5 rounded-lg border border-white/8 hover:border-white/20 text-xs font-mono text-white/50 hover:text-white transition"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    {isEditMode ? "DONE EDITING" : "EDIT RATIOS"}
                  </button>
                </div>
              </div>
            )}

            {/* ── TradingView full chart ────────── */}
            <div className="rounded-2xl border border-white/6 overflow-hidden glass-card">
              {/* Interval selector */}
              <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/5"
                style={{ background: "rgba(255,255,255,0.02)" }}>
                <span className="text-[10px] font-mono text-white/25 uppercase tracking-widest mr-2">Interval</span>
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
                {/* Open in TradingView — for applying Pine Script */}
                <a
                  href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(toTVSymbol(selectedStock))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-mono font-semibold text-primary/70 hover:text-primary hover:bg-primary/10 transition-all duration-150 border border-primary/20 hover:border-primary/40"
                  title="Open on TradingView.com to apply your Pine Script"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open in TradingView
                </a>
              </div>

              {/* Chart — clean, no default indicators */}
              <TradingViewChart
                symbol={selectedStock}
                interval={interval}
                height={520}
                showToolbar={true}
                allowSymbolChange={false}
                studies={[]}
              />
            </div>

            {/* ── AI Foundation Model (Amazon Chronos-Bolt + Qlib Alpha158) ── */}
            <FoundationModelCard
              symbol={selectedStock}
              currentPrice={quote?.stock?.price}
            />

            {/* ── Institutional Order Block & SMC Zones (OrderBlock.com engine) ── */}
            <OrderBlockCard
              symbol={selectedStock}
            />

            {/* ── PREDICTA V4 Dashboard ───────────────────────── */}
            <PredictaPanel symbol={selectedStock} />

            {/* ── Deep Fundamental Dashboard ─────────────────── */}
            <FundamentalDashboard symbol={selectedStock} />

            {/* ── Generate Detailed AI Research Report Option ────────── */}
            <div className="pt-2 pb-6">
              <button
                type="button"
                onClick={() => setLocation(`/stock/${selectedStock}/report`)}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-primary via-violet-600 to-indigo-600 hover:from-primary/90 hover:via-violet-600/90 hover:to-indigo-600/90 text-white font-bold text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-2.5 transition-all shadow-[0_0_24px_rgba(124,58,237,0.35)] hover:shadow-[0_0_32px_rgba(124,58,237,0.55)] active:scale-[0.99] border border-white/10 group cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-violet-200 animate-pulse group-hover:rotate-12 transition-transform" />
                <span>Generate Detailed AI Research Report</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
