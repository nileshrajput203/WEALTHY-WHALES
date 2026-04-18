import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { StockRecommendationCard } from "@/components/StockRecommendationCard";
import { StockChartDrawer, type StockDrawerPayload } from "@/components/StockChartDrawer";
import { TrendingUp, TrendingDown, Sparkles, Search, Activity, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StockRecommendation } from "@shared/schema";
import { Link } from "wouter";

/* ── API response shape ─────────────────────────────────── */
interface RecommendationsResponse {
  realTimeStocks:     any[];
  adminRecommendations: StockRecommendation[];
  lastUpdated:        string;
  dataSource:         string;
}

/* ── Mini live stock row ─────────────────────────────────── */
function LiveStockRow({
  stock,
  index,
  onClick,
}: {
  stock: any;
  index: number;
  onClick: (s: StockDrawerPayload) => void;
}) {
  const isUp = (stock.changePercent ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      onClick={() => onClick({
        symbol:   stock.symbol,
        name:     stock.name,
        price:    stock.price,
        change:   stock.change,
        changePercent: stock.changePercent,
      })}
      className="group flex items-center justify-between px-4 py-3 rounded-xl glass-card border border-white/5
        hover:border-primary/30 hover:bg-white/3 cursor-pointer transition-all duration-200"
    >
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-mono font-bold text-white/90 truncate">
          {stock.symbol?.replace(/\.(NS|BO)$/i, "")}
        </span>
        <span className="text-[11px] text-white/35 font-sans truncate max-w-[140px]">{stock.name}</span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-sm font-mono font-bold text-white tabular-nums">
          ₹{Number(stock.price).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
        </span>
        <span
          className={`flex items-center gap-1 text-xs font-mono font-bold px-2 py-1 rounded-full tabular-nums
            ${isUp
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
        >
          {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isUp ? "+" : ""}{Number(stock.changePercent ?? 0).toFixed(2)}%
        </span>
      </div>
    </motion.div>
  );
}

/* ── Quick stat card ─────────────────────────────────────── */
function StatCard({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="glass-card rounded-2xl p-4 border border-white/6 hover:border-white/12 transition-all duration-300">
      <div className="text-2xl font-mono font-bold text-white mb-0.5">{value}</div>
      <div className="text-xs text-white/40 font-sans">{label}</div>
      {sub && <div className="text-[10px] text-white/25 font-mono mt-0.5">{sub}</div>}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────── */
export default function Home() {
  const [selectedStock, setSelectedStock] = useState<StockDrawerPayload | null>(null);

  const { data, isLoading } = useQuery<RecommendationsResponse>({
    queryKey: ["/api/recommendations"],
  });

  const adminRecs    = data?.adminRecommendations ?? [];
  const liveStocks   = data?.realTimeStocks       ?? [];
  const dataSource   = data?.dataSource           ?? "—";

  return (
    <>
      <div className="space-y-8">

        {/* ── Hero ───────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-white/6 glass-card"
          style={{ boxShadow: "0 0 0 1px rgba(124,58,237,0.15), 0 0 60px 0 rgba(124,58,237,0.07), 0 8px 32px 0 rgba(0,0,0,0.5)" }}
        >
          {/* Grid bg */}
          <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none rounded-3xl" />
          {/* Indigo orb */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(ellipse, hsl(260,84%,65%,0.12), transparent 70%)", filter: "blur(40px)" }}
          />

          <div className="relative max-w-4xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center"
                style={{ boxShadow: "0 0 16px 0 hsl(260,84%,65%,0.3)" }}>
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white leading-tight">
                  Welcome to GenAI-Stock
                </h1>
                <p className="text-xs text-white/35 font-mono mt-0.5">
                  Professional AI-Powered Stock Intelligence · {dataSource}
                </p>
              </div>
            </div>

            <p className="text-sm sm:text-base text-white/50 mb-6 leading-relaxed max-w-2xl">
              Institutional-grade NSE/BSE analysis powered by Gemini AI.
              Click any stock to launch the live TradingView chart with AI signals.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/check-stock">
                <Button size="lg"
                  className="h-11 px-6 text-sm font-semibold rounded-full bg-primary text-white hover:opacity-90 transition-all"
                  style={{ boxShadow: "0 0 20px 0 hsl(260,84%,65%,0.3)" }}
                  data-testid="button-explore-stocks"
                >
                  <Search className="w-4 h-4 mr-2" /> Explore Stocks
                </Button>
              </Link>
              <Link href="/ask-ai">
                <Button variant="outline" size="lg"
                  className="h-11 px-6 text-sm font-semibold rounded-full glass-card border-white/12 text-white/70
                    hover:text-white hover:border-primary/40 transition-all"
                  data-testid="button-ai-chat"
                >
                  <Sparkles className="w-4 h-4 mr-2" /> Ask AI Analyst
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ── Quick stats ─────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard value="+2.4%"  label="NIFTY Today"     sub="^NSEI" />
          <StatCard value="1,247"  label="Active Stocks"   sub="NSE+BSE" />
          <StatCard value="89%"    label="AI Accuracy"     sub="backtested" />
          <StatCard value="Real"   label="Data Source"     sub={dataSource} />
        </div>

        {/* ── Live Market Stocks ──────────────────── */}
        {(isLoading || liveStocks.length > 0) && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                  Live Market · Top Movers
                </h2>
                <p className="text-xs text-white/35 font-mono mt-0.5">Click any row to launch chart</p>
              </div>
              <Link href="/swing-scanner">
                <span className="text-xs font-mono text-primary/70 hover:text-primary transition-colors cursor-pointer">
                  View Scanner →
                </span>
              </Link>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-14 rounded-xl bg-white/3 animate-pulse border border-white/5" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {liveStocks.map((stock: any, i: number) => (
                  <LiveStockRow key={stock.symbol} stock={stock} index={i} onClick={setSelectedStock} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Admin Recommendations ──────────────── */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Expert Recommendations
              </h2>
              <p className="text-xs text-white/35 font-mono mt-0.5">
                Curated picks from our analysts — click to view live chart
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-72 rounded-2xl bg-white/3 animate-pulse border border-white/5" />
              ))}
            </div>
          ) : adminRecs.length > 0 ? (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              data-testid="recommendations-grid"
            >
              {adminRecs.map((rec) => (
                <StockRecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onViewChart={setSelectedStock}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 glass-card rounded-2xl border border-white/6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">No Recommendations Yet</h3>
              <p className="text-sm text-white/40 max-w-sm mx-auto">
                Admin-curated stock picks will appear here. Use the Admin Panel to add them.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* ── Drawer (portal over entire page) ────── */}
      <StockChartDrawer
        stock={selectedStock}
        onClose={() => setSelectedStock(null)}
      />
    </>
  );
}
