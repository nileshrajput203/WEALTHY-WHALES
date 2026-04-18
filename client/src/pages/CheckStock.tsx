import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { StockSearchBar } from "@/components/StockSearchBar";
import { Search, BarChart2 } from "lucide-react";
import { StockAnalysisPanel } from "@/components/StockAnalysisPanel";
import { TradingViewChart } from "@/components/TradingViewChart";
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
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [interval, setInterval] = useState("D");

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
                <span className="ml-auto text-[10px] text-white/15 font-mono">Powered by TradingView · Free</span>
              </div>

              {/* Chart */}
              <TradingViewChart
                symbol={selectedStock}
                interval={interval}
                height={520}
                showToolbar={true}
                allowSymbolChange={false}
                studies={[
                  "RSI@tv-basicstudies",
                  "MAExp@tv-basicstudies",
                  "MACD@tv-basicstudies",
                  "BB@tv-basicstudies",
                ]}
              />
            </div>

            {/* ── AI Analysis Panel ─────────────── */}
            <StockAnalysisPanel symbol={selectedStock} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
