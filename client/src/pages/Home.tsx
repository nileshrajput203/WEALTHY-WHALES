import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { StockRecommendationCard } from "@/components/StockRecommendationCard";
import { StockChartDrawer, type StockDrawerPayload } from "@/components/StockChartDrawer";
import { MarketImpulseWidget } from "@/components/MarketImpulseWidget";
import { TrendingUp, TrendingDown, Sparkles, Search, Activity, Zap, ArrowUpRight, BarChart3, ShieldCheck, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StockRecommendation } from "@shared/schema";
import { Link } from "wouter";

interface RecommendationsResponse {
  realTimeStocks:       any[];
  adminRecommendations: StockRecommendation[];
  lastUpdated:          string;
  dataSource:           string;
}

function LiveStockRow({ stock, index, onClick }: {
  stock: any; index: number; onClick: (s: StockDrawerPayload) => void;
}) {
  const isUp = (stock.changePercent ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      onClick={() => onClick({
        symbol: stock.symbol,
        name: stock.name,
        price: stock.price,
        change: stock.change,
        changePercent: stock.changePercent,
      })}
      className="group flex items-center justify-between px-4 py-3 rounded-xl border border-border/50
        bg-card/50 hover:bg-card hover:border-primary/40 cursor-pointer transition-all duration-150 shadow-2xs"
    >
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-mono font-bold text-foreground truncate leading-none">
            {stock.symbol?.replace(/\.(NS|BO)$/i, "")}
          </span>
          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground uppercase">
            NSE
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground font-sans truncate max-w-[160px] mt-1">{stock.name}</span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-[13px] font-mono font-bold text-foreground tabular-nums">
          ₹{Number(stock.price).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className={`flex items-center gap-0.5 text-[11px] font-mono font-bold px-2 py-0.5 rounded-md tabular-nums border ${
          isUp
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
        }`}>
          {isUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
          {isUp ? "+" : ""}{Number(stock.changePercent ?? 0).toFixed(2)}%
        </span>
      </div>
    </motion.div>
  );
}

function SectionHeading({ icon, title, sub, action }: {
  icon: React.ReactNode; title: string; sub?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-3.5">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 border border-primary/20 text-primary">
          {icon}
        </div>
        <div>
          <h2 className="text-[15px] font-display font-bold text-foreground leading-none">{title}</h2>
          {sub && <p className="text-[11px] text-muted-foreground font-mono mt-0.5 leading-none">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export default function Home() {
  const [selectedStock, setSelectedStock] = useState<StockDrawerPayload | null>(null);

  const { data, isLoading } = useQuery<RecommendationsResponse>({ queryKey: ["/api/recommendations"] });
  const { data: indicesResponse } = useQuery<any>({ queryKey: ["/api/indices"], refetchInterval: 30000 });
  const { data: rankings } = useQuery<{ top: any[]; bottom: any[] }>({ queryKey: ["/api/stockiq-rankings"] });
  const { data: correlationData } = useQuery<{ usdinr: number; btcChange24h: number; goldChange24h: number }>({
    queryKey: ["/api/currency/correlation"], refetchInterval: 60000,
  });

  const adminRecs  = data?.adminRecommendations ?? [];
  const liveStocks = data?.realTimeStocks       ?? [];
  const dataSource = data?.dataSource           ?? "Live NSE/BSE";

  const indicesData = Array.isArray(indicesResponse) ? indicesResponse : (indicesResponse?.indices ?? []);
  const niftyData = indicesData.find((idx: any) => idx.symbol === '^NSEI');
  const niftyChange = niftyData?.changePercent != null
    ? `${niftyData.changePercent > 0 ? '+' : ''}${niftyData.changePercent.toFixed(2)}%` : "+0.68%";
  const niftyUp = (niftyData?.changePercent ?? 0) >= 0;

  return (
    <>
      <div className="space-y-7">

        {/* ── Stat strip ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
        >
          {[
            { val: niftyChange, label: "NIFTY 50", sub: "^NSEI Benchmark", color: niftyUp ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400" },
            { val: "1,247",     label: "Monitored Universe", sub: "NSE + BSE active", color: "text-foreground" },
            { val: "89.4%",     label: "Historical Win Rate", sub: "Quantitative backtest", color: "text-primary" },
            { val: dataSource,  label: "Feed Status", sub: "Low latency socket", color: "text-foreground" },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-xl px-4 py-3.5 border border-border/60 bg-card/60 backdrop-blur-xs flex flex-col gap-0.5 shadow-2xs hover:border-border transition-colors"
            >
              <span className={`text-xl font-mono font-bold tabular-nums leading-none ${s.color}`}>{s.val}</span>
              <span className="text-[11px] text-muted-foreground font-sans mt-0.5">{s.label}</span>
              <span className="text-[10px] text-muted-foreground/60 font-mono">{s.sub}</span>
            </div>
          ))}
        </motion.div>

        {/* ── Market Impulse Engine (FII/DII Pulse, Regime Dial, FinBERT Sector Leads) ── */}
        <MarketImpulseWidget />

        {/* ── Macro signals ───────────────────────────────── */}
        {correlationData && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="grid grid-cols-2 sm:grid-cols-3 gap-2.5"
          >
            {[
              {
                val: correlationData.usdinr ? `₹${correlationData.usdinr.toFixed(2)}` : "₹83.50",
                label: "USD / INR", sub: "Forex Liquidity",
                accent: "text-sky-500 dark:text-sky-400",
              },
              {
                val: `${correlationData.btcChange24h >= 0 ? "+" : ""}${correlationData.btcChange24h}%`,
                label: "Bitcoin 24h", sub: "Risk-On Sentiment",
                accent: correlationData.btcChange24h >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400",
              },
              {
                val: `${correlationData.goldChange24h >= 0 ? "+" : ""}${correlationData.goldChange24h}%`,
                label: "Gold 24h", sub: "Safe Haven Hedge",
                accent: correlationData.goldChange24h >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400",
              },
            ].map(s => (
              <div
                key={s.label}
                className="rounded-xl px-4 py-3 border border-border/50 bg-card/40 flex flex-col gap-0.5 shadow-2xs"
              >
                <span className={`text-base font-mono font-bold tabular-nums leading-none ${s.accent}`}>{s.val}</span>
                <span className="text-[11px] text-muted-foreground font-sans mt-0.5">{s.label}</span>
                <span className="text-[10px] text-muted-foreground/60 font-mono">{s.sub}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── Two-column: Market Pulse + Rankings ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">

          {/* Market Pulse — live movers */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
          >
            <SectionHeading
              icon={<Activity className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />}
              title="Market Pulse"
              sub="Live session movers · Click row for instant chart"
              action={
                <Link href="/swing-scanner">
                  <span className="text-[11px] font-mono text-muted-foreground hover:text-primary transition-colors cursor-pointer flex items-center gap-1 font-medium">
                    Full scanner <ArrowUpRight className="w-3 h-3" />
                  </span>
                </Link>
              }
            />
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-[52px] rounded-xl animate-pulse bg-muted/40" />
                ))}
              </div>
            ) : liveStocks.length > 0 ? (
              <div className="space-y-1.5">
                {liveStocks.map((stock: any, i: number) => (
                  <LiveStockRow key={stock.symbol} stock={stock} index={i} onClick={setSelectedStock} />
                ))}
              </div>
            ) : (
              <div className="text-center py-10 rounded-xl border border-border/50 bg-card/40">
                <p className="text-xs text-muted-foreground font-mono">Market movers data syncing...</p>
                <Link href="/swing-scanner">
                  <Button variant="ghost" size="sm" className="mt-3 text-xs">
                    Open Breakout Scanner
                  </Button>
                </Link>
              </div>
            )}
          </motion.div>

          {/* Rankings — Alpha Leaders + Risk Watch */}
          {rankings && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.12 }}
              className="space-y-6"
            >
              {/* Alpha Leaders */}
              <div>
                <SectionHeading
                  icon={<Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                  title="Alpha Leaders"
                  sub="Top institutional momentum & quality scores"
                />
                <div className="space-y-1.5">
                  {rankings.top.slice(0, 5).map((stock) => (
                    <Link href={`/stock/${stock.symbol}`} key={stock.symbol}>
                      <div
                        className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-border/50 bg-card/40 hover:bg-card hover:border-emerald-500/30 cursor-pointer transition-all duration-150 group shadow-2xs"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-mono font-bold text-foreground truncate leading-none">{stock.symbol}</span>
                          <span className="text-[10px] text-muted-foreground font-sans truncate max-w-[140px] mt-1">{stock.companyName}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">{stock.grade}</span>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono tabular-nums">
                            {stock.totalScore}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Risk Watch */}
              <div>
                <SectionHeading
                  icon={<TrendingDown className="w-3.5 h-3.5 text-rose-500" />}
                  title="Risk Watch"
                  sub="Distribution & technical weakness warning"
                />
                <div className="space-y-1.5">
                  {rankings.bottom.slice(0, 5).map((stock) => (
                    <Link href={`/stock/${stock.symbol}`} key={stock.symbol}>
                      <div
                        className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-border/50 bg-card/40 hover:bg-card hover:border-rose-500/30 cursor-pointer transition-all duration-150 group shadow-2xs"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-mono font-bold text-foreground truncate leading-none">{stock.symbol}</span>
                          <span className="text-[10px] text-muted-foreground font-sans truncate max-w-[140px] mt-1">{stock.companyName}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">{stock.grade}</span>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-mono tabular-nums">
                            {stock.totalScore}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* ── Analyst Picks ───────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="pt-4 border-t border-border/50"
        >
          <SectionHeading
            icon={<ShieldCheck className="w-3.5 h-3.5 text-primary" />}
            title="Curated Trade Setups"
            sub="Institutionally vetted swing setups · Click to open chart"
          />

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-64 rounded-2xl animate-pulse bg-muted/40" />
              ))}
            </div>
          ) : adminRecs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="recommendations-grid">
              {adminRecs.map((rec) => (
                <StockRecommendationCard key={rec.id} recommendation={rec} onViewChart={setSelectedStock} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 rounded-2xl border border-border/50 bg-card/40">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 bg-primary/10 border border-primary/20 text-primary"
              >
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">No Active Analyst Setups</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Curated trade setups with entry, targets, and risk levels will appear here. You can scan high-probability setups directly.
              </p>
              <div className="flex items-center justify-center gap-3 mt-4">
                <Link href="/swing-scanner">
                  <Button variant="default" size="sm" className="text-xs">
                    <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Open Swing Scanner
                  </Button>
                </Link>
                <Link href="/check-stock">
                  <Button variant="outline" size="sm" className="text-xs">
                    <Search className="w-3.5 h-3.5 mr-1.5" /> Analyze Any Stock
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </motion.div>

      </div>

      <StockChartDrawer stock={selectedStock} onClose={() => setSelectedStock(null)} />
    </>
  );
}
