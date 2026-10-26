import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Layers,
  TrendingUp,
  TrendingDown,
  Activity,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Search,
  Crosshair,
  Filter,
  Flame,
  Zap,
  Target,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { OrderBlockCard } from "@/components/OrderBlockCard";

interface OrderBlockScanItem {
  symbol: string;
  lastClose: number;
  orderBlocks: {
    activeDemandOB: {
      high: number;
      low: number;
      meanThreshold: number;
      status: string;
      volumeRatio: number;
      displacementPct: number;
      distanceFromSpotPct: number;
      strength: string;
    } | null;
    activeSupplyOB: {
      high: number;
      low: number;
      meanThreshold: number;
      status: string;
      volumeRatio: number;
      displacementPct: number;
      distanceFromSpotPct: number;
      strength: string;
    } | null;
  };
  marketStructure: {
    bias: "BULLISH" | "BEARISH" | "RANGING";
    lastStructureBreak: string;
  };
  pricingMatrix: {
    zone: "DISCOUNT" | "PREMIUM" | "EQUILIBRIUM";
    discountDepthPct: number;
  };
  confirmation: {
    score: number;
    grade: string;
    actionableSetup: string;
    riskRewardRatio: string;
    suggestedTrade: {
      action: string;
      entryZone: string;
      stopLoss: number;
      target1: number;
    };
  };
}

export default function OrderBlockRadar() {
  const [selectedStock, setSelectedStock] = useState<string>("RELIANCE");
  const [activeTab, setActiveTab] = useState<"bullish" | "bearish" | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, refetch, isRefetching } = useQuery<{ stocks: OrderBlockScanItem[] }>({
    queryKey: ["/api/scanner/order-blocks"],
    queryFn: async () => {
      const res = await fetch("/api/scanner/order-blocks");
      if (!res.ok) throw new Error("Failed to scan Order Blocks");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const stocks = data?.stocks || [];

  const filteredStocks = stocks.filter((s) => {
    const matchesSearch = s.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeTab === "bullish") return s.marketStructure.bias === "BULLISH";
    if (activeTab === "bearish") return s.marketStructure.bias === "BEARISH";
    return true;
  });

  const bullishCount = stocks.filter((s) => s.marketStructure.bias === "BULLISH").length;
  const bearishCount = stocks.filter((s) => s.marketStructure.bias === "BEARISH").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-400" />
              SMART MONEY CONCEPTS (SMC) TERMINAL
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Live OrderBlock.com Playbook
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight flex items-center gap-2.5">
            Institutional Order Blocks & Liquidity Radar
          </h1>
          <p className="text-sm text-white/50 font-sans mt-1">
            Real-time tracking of institutional limit orders, demand mitigation zones, liquidity sweeps, and fair value gaps across high-momentum F&O stocks.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 bg-white/[0.02] text-xs font-mono text-white/70 hover:text-white transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            REFRESH SCAN
          </button>
        </div>
      </div>

      {/* Market X-Ray Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/[0.02] border border-white/8 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono text-white/40 uppercase">Total F&O Monitored</div>
            <div className="text-2xl font-mono font-black text-white">{stocks.length} Stocks</div>
          </div>
          <Activity className="w-8 h-8 text-white/20" />
        </div>

        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono text-emerald-400/60 uppercase">Bullish +OB Setups</div>
            <div className="text-2xl font-mono font-black text-emerald-300">{bullishCount} Leaders</div>
          </div>
          <TrendingUp className="w-8 h-8 text-emerald-500/40" />
        </div>

        <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono text-rose-400/60 uppercase">Bearish -OB Distribution</div>
            <div className="text-2xl font-mono font-black text-rose-300">{bearishCount} Laggards</div>
          </div>
          <TrendingDown className="w-8 h-8 text-rose-500/40" />
        </div>
      </div>

      {/* Selected Stock Deep Inspection Panel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-emerald-400" />
            Deep Order Block Inspector: <span className="text-white font-bold">{selectedStock}</span>
          </span>
          <Link
            href={`/stock/${selectedStock}`}
            className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
          >
            Full Stock Analytics <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <OrderBlockCard symbol={selectedStock} />
      </div>

      {/* Strength Boards: Filter & Search Controls */}
      <div className="space-y-4 pt-4 border-t border-white/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/8 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition ${
                activeTab === "all"
                  ? "bg-white/10 text-white border border-white/10"
                  : "text-white/40 hover:text-white"
              }`}
            >
              ALL STOCKS ({stocks.length})
            </button>
            <button
              onClick={() => setActiveTab("bullish")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                activeTab === "bullish"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-white/40 hover:text-white"
              }`}
            >
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              BULLISH STRENGTH BOARD ({bullishCount})
            </button>
            <button
              onClick={() => setActiveTab("bearish")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                activeTab === "bearish"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : "text-white/40 hover:text-white"
              }`}
            >
              <TrendingDown className="w-3 h-3 text-rose-400" />
              BEARISH SUPPLY BOARD ({bearishCount})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-white/30 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search ticker (e.g. INFY, TCS)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/8 rounded-lg pl-9 pr-3 py-1.5 text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* Live Strength Table */}
        <div className="rounded-xl border border-white/8 bg-white/[0.01] overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-white/40 uppercase text-[10px]">
                <th className="py-3 px-4">Symbol</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">SMC Bias</th>
                <th className="py-3 px-4">Active +OB Demand</th>
                <th className="py-3 px-4">Active -OB Supply</th>
                <th className="py-3 px-4">Dealing Zone</th>
                <th className="py-3 px-4">Confirmation</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-white/40 font-mono">
                    Scanning institutional order flow across NSE F&O universe...
                  </td>
                </tr>
              ) : filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-white/40 font-mono">
                    No matching order block setups found for filter.
                  </td>
                </tr>
              ) : (
                filteredStocks.map((s) => {
                  const isSelected = selectedStock === s.symbol;
                  return (
                    <tr
                      key={s.symbol}
                      onClick={() => setSelectedStock(s.symbol)}
                      className={`cursor-pointer transition-colors hover:bg-white/[0.03] ${
                        isSelected ? "bg-emerald-500/[0.06] border-l-2 border-emerald-400" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        {s.symbol}
                      </td>
                      <td className="py-3 px-4 text-white/90">₹{s.lastClose.toLocaleString("en-IN")}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.marketStructure.bias === "BULLISH"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : s.marketStructure.bias === "BEARISH"
                              ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                              : "bg-white/5 text-white/50"
                          }`}
                        >
                          {s.marketStructure.bias}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {s.orderBlocks.activeDemandOB ? (
                          <div className="text-[11px]">
                            <span className="text-emerald-300 font-bold">
                              ₹{s.orderBlocks.activeDemandOB.low} - ₹{s.orderBlocks.activeDemandOB.high}
                            </span>
                            <span className="text-[9px] text-white/40 block">
                              MT: ₹{s.orderBlocks.activeDemandOB.meanThreshold}
                            </span>
                          </div>
                        ) : (
                          <span className="text-white/20">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {s.orderBlocks.activeSupplyOB ? (
                          <div className="text-[11px]">
                            <span className="text-rose-300 font-bold">
                              ₹{s.orderBlocks.activeSupplyOB.low} - ₹{s.orderBlocks.activeSupplyOB.high}
                            </span>
                            <span className="text-[9px] text-white/40 block">
                              MT: ₹{s.orderBlocks.activeSupplyOB.meanThreshold}
                            </span>
                          </div>
                        ) : (
                          <span className="text-white/20">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold ${
                            s.pricingMatrix.zone === "DISCOUNT"
                              ? "text-emerald-400"
                              : s.pricingMatrix.zone === "PREMIUM"
                              ? "text-rose-400"
                              : "text-amber-400"
                          }`}
                        >
                          {s.pricingMatrix.zone}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white">{s.confirmation.score}/100</span>
                          <span className="text-[10px] text-white/40">({s.confirmation.grade})</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-emerald-400 font-bold">
                        {s.confirmation.suggestedTrade.action}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStock(s.symbol);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="px-2.5 py-1 rounded bg-white/5 hover:bg-emerald-500/20 text-white/70 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/30 text-[10px] transition"
                        >
                          VIEW ZONE
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
