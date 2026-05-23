import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useViewMode } from "@/hooks/useViewMode";
import { type StockIQResult } from "../../../server/stockiq";
import StockIQScore from "@/components/StockIQScore";
import StockIQBreakdown from "@/components/StockIQBreakdown";
import { StockSearchBar } from "@/components/StockSearchBar";
import { Search, BarChart2, ExternalLink } from "lucide-react";
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
            className="text-center py-24 glass-card rounded-2xl border border-white/6"
          >
            <Search className="w-16 h-16 mx-auto text-white/15 mb-6" />
            <h3 className="text-xl font-semibold text-white/60 mb-3">Search for a Stock</h3>
            <p className="text-sm text-white/30 max-w-md mx-auto">
              Enter a symbol (e.g., TCS, RELIANCE, INFY) to view the live TradingView chart,
              AI-generated fundamentals, technical analysis, and buy/hold/sell signals.
            </p>
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
            {/* ── StockIQ Score & Breakdown ────────── */}
            {stockIq && (
              <div className="grid grid-cols-1 gap-6">
                <StockIQScore
                  data={stockIq}
                  onGenerateReport={() => setLocation(`/stock/${selectedStock}/report`)}
                />
                {isPro && <StockIQBreakdown data={stockIq} />}
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

            {/* ── PREDICTA V4 Dashboard ───────────────────────── */}
            <PredictaPanel symbol={selectedStock} />

            {/* ── Deep Fundamental Dashboard ─────────────────── */}
            <FundamentalDashboard symbol={selectedStock} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
