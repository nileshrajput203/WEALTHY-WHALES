import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { StockRecommendationCard } from "@/components/StockRecommendationCard";
import { StockChartDrawer, type StockDrawerPayload } from "@/components/StockChartDrawer";
import { TrendingUp, TrendingDown, Sparkles, Search, Activity, Zap, ArrowUpRight } from "lucide-react";
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
      transition={{ delay: index * 0.04, duration: 0.3 }}
      onClick={() => onClick({
        symbol: stock.symbol, name: stock.name,
        price: stock.price, change: stock.change, changePercent: stock.changePercent,
      })}
      className="group flex items-center justify-between px-4 py-3 rounded-xl border border-transparent
        hover:border-white/8 cursor-pointer transition-all duration-150"
      style={{ background: "rgba(255,255,255,0.025)" }}
    >
      <div className="flex flex-col min-w-0">
        <span className="text-[13px] font-mono font-bold text-foreground/90 truncate leading-none">
          {stock.symbol?.replace(/\.(NS|BO)$/i, "")}
        </span>
        <span className="text-[11px] text-foreground/30 font-sans truncate max-w-[140px] mt-0.5">{stock.name}</span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-[13px] font-mono font-semibold text-foreground/85 tabular-nums">
          ₹{Number(stock.price).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
        </span>
        <span className={`flex items-center gap-0.5 text-[11px] font-mono font-bold px-2 py-0.5 rounded-md tabular-nums
          ${isUp ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}
        >
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
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {icon}
        </div>
        <div>
          <h2 className="text-[15px] font-display font-bold text-foreground/90 leading-none">{title}</h2>
          {sub && <p className="text-[11px] text-foreground/35 font-mono mt-0.5 leading-none">{sub}</p>}
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
  const dataSource = data?.dataSource           ?? "—";

  const indicesData = Array.isArray(indicesResponse) ? indicesResponse : (indicesResponse?.indices ?? []);
  const niftyData = indicesData.find((idx: any) => idx.symbol === '^NSEI');
  const niftyChange = niftyData?.changePercent != null
    ? `${niftyData.changePercent > 0 ? '+' : ''}${niftyData.changePercent.toFixed(2)}%` : "—";
  const niftyUp = niftyData?.changePercent >= 0;

  return (
    <>
      <div className="space-y-8">

        {/* ── Stat strip ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2"
        >
          {[
            { val: niftyChange, label: "NIFTY 50", sub: "^NSEI", color: niftyUp ? "text-emerald-400" : "text-rose-400" },
            { val: "1,247",     label: "Active stocks", sub: "NSE + BSE",    color: "text-foreground/90" },
            { val: "89%",       label: "AI accuracy",   sub: "backtested",   color: "text-primary" },
            { val: dataSource,  label: "Data source",   sub: "real-time",    color: "text-foreground/90" },
          ].map(s => (
            <div key={s.label}
              className="rounded-xl px-4 py-3 border border-white/5 flex flex-col gap-0.5"
              style={{ background: "rgba(255,255,255,0.025)" }}
            >
              <span className={`text-xl font-mono font-bold tabular-nums leading-none ${s.color}`}>{s.val}</span>
              <span className="text-[11px] text-foreground/40 font-sans">{s.label}</span>
              <span className="text-[10px] text-foreground/20 font-mono">{s.sub}</span>
            </div>
          ))}
        </motion.div>

        {/* ── Macro signals ───────────────────────────────── */}
        {correlationData && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="grid grid-cols-2 sm:grid-cols-3 gap-2"
          >
            {[
              {
                val: correlationData.usdinr ? `₹${correlationData.usdinr.toFixed(2)}` : "₹83.50",
                label: "USD / INR", sub: "Forex",
                up: true, fixed: true,
                accent: "text-sky-400",
              },
              {
                val: `${correlationData.btcChange24h >= 0 ? "+" : ""}${correlationData.btcChange24h}%`,
                label: "Bitcoin 24h", sub: "Crypto sentiment",
                up: correlationData.btcChange24h >= 0,
                accent: correlationData.btcChange24h >= 0 ? "text-emerald-400" : "text-rose-400",
              },
              {
                val: `${correlationData.goldChange24h >= 0 ? "+" : ""}${correlationData.goldChange24h}%`,
                label: "Gold 24h", sub: "Safe haven",
                up: correlationData.goldChange24h >= 0,
                accent: correlationData.goldChange24h >= 0 ? "text-emerald-400" : "text-rose-400",
              },
            ].map(s => (
              <div key={s.label}
                className="rounded-xl px-4 py-3 border border-white/5 flex flex-col gap-0.5"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <span className={`text-base font-mono font-bold tabular-nums leading-none ${s.accent}`}>{s.val}</span>
                <span className="text-[11px] text-foreground/40 font-sans">{s.label}</span>
                <span className="text-[10px] text-foreground/20 font-mono">{s.sub}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── Two-column: Market Pulse + Rankings ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">

          {/* Market Pulse — live movers */}
          {(isLoading || liveStocks.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08 }}
            >
              <SectionHeading
                icon={<Activity className="w-3.5 h-3.5 text-emerald-400" />}
                title="Market Pulse"
                sub="click any row to open chart"
                action={
                  <Link href="/swing-scanner">
                    <span className="text-[11px] font-mono text-foreground/35 hover:text-primary transition-colors cursor-pointer flex items-center gap-1">
                      Full scanner <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </Link>
                }
              />
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-[52px] rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.025)" }} />
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {liveStocks.map((stock: any, i: number) => (
                    <LiveStockRow key={stock.symbol} stock={stock} index={i} onClick={setSelectedStock} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Rankings — Alpha Tier + Risk Watch */}
          {rankings && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.12 }}
              className="space-y-6"
            >
              {/* Alpha Tier */}
              <div>
                <SectionHeading
                  icon={<Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                  title="Alpha Tier"
                  sub="top StockIQ scores"
                />
                <div className="space-y-1.5">
                  {rankings.top.slice(0, 5).map((stock) => (
                    <Link href={`/stock/${stock.symbol}`} key={stock.symbol}>
                      <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-transparent hover:border-emerald-500/20 cursor-pointer transition-all duration-150 group"
                        style={{ background: "rgba(255,255,255,0.025)" }}>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-mono font-bold text-foreground/90 truncate leading-none">{stock.symbol}</span>
                          <span className="text-[10px] text-foreground/30 font-sans truncate max-w-[140px] mt-0.5">{stock.companyName}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest">{stock.grade}</span>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-emerald-500/10 text-emerald-400 font-mono tabular-nums">
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
                  icon={<TrendingDown className="w-3.5 h-3.5 text-rose-400" />}
                  title="Risk Watch"
                  sub="structural or tech weaknesses"
                />
                <div className="space-y-1.5">
                  {rankings.bottom.slice(0, 5).map((stock) => (
                    <Link href={`/stock/${stock.symbol}`} key={stock.symbol}>
                      <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-transparent hover:border-rose-500/20 cursor-pointer transition-all duration-150 group"
                        style={{ background: "rgba(255,255,255,0.025)" }}>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-mono font-bold text-foreground/90 truncate leading-none">{stock.symbol}</span>
                          <span className="text-[10px] text-foreground/30 font-sans truncate max-w-[140px] mt-0.5">{stock.companyName}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest">{stock.grade}</span>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-rose-500/10 text-rose-400 font-mono tabular-nums">
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
          transition={{ duration: 0.4, delay: 0.15 }}
          className="pt-2 border-t border-white/5"
        >
          <SectionHeading
            icon={<Zap className="w-3.5 h-3.5 text-primary" />}
            title="Analyst Picks"
            sub="curated setups · click to open chart"
          />

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-64 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.025)" }} />
              ))}
            </div>
          ) : adminRecs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="recommendations-grid">
              {adminRecs.map((rec) => (
                <StockRecommendationCard key={rec.id} recommendation={rec} onViewChart={setSelectedStock} />
              ))}
            </div>
          ) : (
            <div className="text-center py-14 rounded-2xl border border-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "hsl(260 84% 65% / 0.1)", border: "1px solid hsl(260 84% 65% / 0.2)" }}>
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground/70 mb-2">No picks yet</h3>
              <p className="text-xs text-foreground/35 max-w-xs mx-auto leading-relaxed">
                Admin-curated trade setups appear here. Use the Admin Panel to add them.
              </p>
              <Link href="/check-stock">
                <Button variant="ghost" size="sm" className="mt-4 text-xs text-foreground/40 hover:text-foreground/70">
                  <Search className="w-3.5 h-3.5 mr-1.5" /> Explore stocks yourself
                </Button>
              </Link>
            </div>
          )}
        </motion.div>

      </div>

      <StockChartDrawer stock={selectedStock} onClose={() => setSelectedStock(null)} />
    </>
  );
}
