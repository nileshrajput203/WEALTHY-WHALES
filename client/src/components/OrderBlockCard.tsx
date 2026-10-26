import { useQuery } from "@tanstack/react-query";
import {
  Layers,
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Crosshair,
  Zap,
  Target,
  Sparkles,
  Info,
} from "lucide-react";

interface OrderBlockZone {
  id: string;
  type: "BULLISH_OB" | "BEARISH_OB";
  high: number;
  low: number;
  meanThreshold: number;
  status: "UNMITIGATED" | "MITIGATED" | "BREACHED";
  volumeRatio: number;
  displacementPct: number;
  hasFvgConfluence: boolean;
  distanceFromSpotPct: number;
  strength: "ELITE" | "HIGH" | "MODERATE";
}

interface OrderBlockResponse {
  symbol: string;
  lastClose: number;
  orderBlocks: {
    activeDemandOB: OrderBlockZone | null;
    activeSupplyOB: OrderBlockZone | null;
    allZones: OrderBlockZone[];
  };
  fairValueGaps: Array<{
    id: string;
    type: "BULLISH_FVG" | "BEARISH_FVG";
    top: number;
    bottom: number;
    midpoint: number;
    status: string;
    fillPercentage: number;
  }>;
  liquidityPools: Array<{
    id: string;
    type: "BUY_SIDE_LIQUIDITY" | "SELL_SIDE_LIQUIDITY";
    level: number;
    status: "UNTAPPED" | "SWEPT";
  }>;
  marketStructure: {
    bias: "BULLISH" | "BEARISH" | "RANGING";
    lastStructureBreak: string;
    structureBreakPrice: number;
  };
  pricingMatrix: {
    dealingRangeHigh: number;
    dealingRangeLow: number;
    equilibrium50: number;
    zone: "DISCOUNT" | "PREMIUM" | "EQUILIBRIUM";
    discountDepthPct: number;
  };
  confirmation: {
    score: number;
    grade: "PRIME_A+" | "STRONG_A" | "VALID_B" | "NEUTRAL_C" | "AVOID";
    actionableSetup: string;
    confluenceFactors: string[];
    riskRewardRatio: string;
    suggestedTrade: {
      action: string;
      entryZone: string;
      stopLoss: number;
      target1: number;
      target2: number;
    };
  };
}

interface OrderBlockCardProps {
  symbol: string;
}

export function OrderBlockCard({ symbol }: OrderBlockCardProps) {
  const cleanSymbol = (symbol || "RELIANCE").replace(/\.(NS|BO)$/i, "");

  const { data, isLoading, isError } = useQuery<OrderBlockResponse>({
    queryKey: ["/api/stock/order-block", cleanSymbol],
    queryFn: async () => {
      const res = await fetch(`/api/stock/${cleanSymbol}/order-block`);
      if (!res.ok) throw new Error("Failed to load Order Block analysis");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 p-6 bg-slate-900/60 backdrop-blur-md space-y-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 bg-white/10 rounded w-1/3" />
            <div className="h-3 bg-white/5 rounded w-1/4" />
          </div>
        </div>
        <div className="h-32 bg-white/5 rounded-xl" />
      </div>
    );
  }

  if (isError || !data) return null;

  const { orderBlocks, pricingMatrix, marketStructure, confirmation } = data;
  const demandOB = orderBlocks.activeDemandOB;
  const supplyOB = orderBlocks.activeSupplyOB;

  const isPrime = confirmation.grade === "PRIME_A+" || confirmation.grade === "STRONG_A";

  return (
    <div className="rounded-2xl border border-emerald-500/25 p-6 bg-gradient-to-b from-[#0a1215] to-[#060a0d] space-y-6 shadow-2xl relative overflow-hidden group">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-400" />
              SMART MONEY CONCEPTS (SMC) · ORDER BLOCK ENGINE
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Institutional Order-Block.com Logic
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                pricingMatrix.zone === "DISCOUNT"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : pricingMatrix.zone === "PREMIUM"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              }`}
            >
              {pricingMatrix.zone} ZONE ({pricingMatrix.discountDepthPct}% from High)
            </span>
          </div>

          <h3 className="text-xl font-bold font-display text-white tracking-tight flex items-center gap-2">
            Institutional Supply & Demand Order Blocks
          </h3>
        </div>

        {/* Confirmation Score Pill */}
        <div className="flex items-center gap-3">
          <div className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2 text-right">
            <div className="text-[10px] font-mono text-white/40 uppercase">Structure Bias</div>
            <div
              className={`text-base font-mono font-black flex items-center justify-end gap-1 ${
                marketStructure.bias === "BULLISH"
                  ? "text-emerald-400"
                  : marketStructure.bias === "BEARISH"
                  ? "text-rose-400"
                  : "text-amber-400"
              }`}
            >
              {marketStructure.bias === "BULLISH" ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              {marketStructure.bias}
            </div>
          </div>
          <div
            className={`px-4 py-2 rounded-xl border text-right ${
              isPrime
                ? "bg-emerald-950/70 border-emerald-500/40 text-emerald-200"
                : "bg-white/[0.03] border-white/10 text-white"
            }`}
          >
            <div className="text-[10px] font-mono text-white/40 uppercase">SMC Grade</div>
            <div className="text-base font-mono font-black flex items-center justify-end gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              {confirmation.grade} ({confirmation.score}/100)
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Active Demand OB vs Active Supply OB */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bullish Demand Order Block (+OB) */}
        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono font-bold text-emerald-300 uppercase tracking-wider">
                +OB Institutional Demand Zone
              </span>
            </div>
            {demandOB && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                {demandOB.status}
              </span>
            )}
          </div>

          {demandOB ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-mono font-black text-white">
                  ₹{demandOB.low} – ₹{demandOB.high}
                </span>
                <span className="text-xs font-mono text-emerald-400">
                  {demandOB.distanceFromSpotPct >= 0
                    ? `${demandOB.distanceFromSpotPct}% below spot`
                    : `${Math.abs(demandOB.distanceFromSpotPct)}% above`}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-white/60 bg-black/30 p-2.5 rounded-lg border border-white/5">
                <div>
                  <span className="text-white/40 block text-[9px] uppercase">Mean Threshold (50%)</span>
                  <span className="text-emerald-300 font-bold">₹{demandOB.meanThreshold}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[9px] uppercase">Displacement</span>
                  <span className="text-white font-bold">+{demandOB.displacementPct}%</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[9px] uppercase">Volume Ratio</span>
                  <span className="text-white font-bold">{demandOB.volumeRatio}x</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs font-mono text-white/40 py-4 text-center">
              No recent unbreached demand block found within range
            </div>
          )}
        </div>

        {/* Bearish Supply Order Block (-OB) */}
        <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-4 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <span className="text-xs font-mono font-bold text-rose-300 uppercase tracking-wider">
                -OB Institutional Supply Zone
              </span>
            </div>
            {supplyOB && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                {supplyOB.status}
              </span>
            )}
          </div>

          {supplyOB ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-mono font-black text-white">
                  ₹{supplyOB.low} – ₹{supplyOB.high}
                </span>
                <span className="text-xs font-mono text-rose-400">
                  {supplyOB.distanceFromSpotPct >= 0
                    ? `${supplyOB.distanceFromSpotPct}% above spot`
                    : `${Math.abs(supplyOB.distanceFromSpotPct)}% below`}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-white/60 bg-black/30 p-2.5 rounded-lg border border-white/5">
                <div>
                  <span className="text-white/40 block text-[9px] uppercase">Mean Threshold (50%)</span>
                  <span className="text-rose-300 font-bold">₹{supplyOB.meanThreshold}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[9px] uppercase">Displacement</span>
                  <span className="text-white font-bold">-{supplyOB.displacementPct}%</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[9px] uppercase">Volume Ratio</span>
                  <span className="text-white font-bold">{supplyOB.volumeRatio}x</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs font-mono text-white/40 py-4 text-center">
              No immediate overhead supply block active
            </div>
          )}
        </div>
      </div>

      {/* Actionable Confirmation & Trade Plan */}
      <div className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
          <span className="text-xs font-mono font-bold text-white/80 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            Execution Action:{" "}
            <span className="text-emerald-300 uppercase underline">
              {confirmation.suggestedTrade.action}
            </span>{" "}
            ({confirmation.riskRewardRatio} R:R)
          </span>
          <span className="text-xs font-mono text-white/50">
            Spot Entry Zone: <span className="text-white font-bold">{confirmation.suggestedTrade.entryZone}</span>
          </span>
        </div>

        <p className="text-xs font-mono text-white/70 leading-relaxed">
          {confirmation.actionableSetup}
        </p>

        {/* Trade Levels */}
        <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1">
          <div className="bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg text-center">
            <span className="text-[10px] text-rose-300/60 uppercase block">Invalidation Stop</span>
            <span className="font-bold text-rose-400">₹{confirmation.suggestedTrade.stopLoss}</span>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg text-center">
            <span className="text-[10px] text-emerald-300/60 uppercase block">Target 1 (BSL)</span>
            <span className="font-bold text-emerald-400">₹{confirmation.suggestedTrade.target1}</span>
          </div>
          <div className="bg-indigo-500/10 border border-indigo-500/20 p-2 rounded-lg text-center">
            <span className="text-[10px] text-indigo-300/60 uppercase block">Target 2 (Supply OB)</span>
            <span className="font-bold text-indigo-300">₹{confirmation.suggestedTrade.target2}</span>
          </div>
        </div>

        {/* Confluence Tags */}
        {confirmation.confluenceFactors.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
            {confirmation.confluenceFactors.map((factor, i) => (
              <span
                key={i}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-white/70 border border-white/10 flex items-center gap-1"
              >
                <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                {factor}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
