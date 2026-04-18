import { motion } from "framer-motion";
import { RecommendationBadge } from "./RecommendationBadge";
import { TrendingUp, Target, ShieldAlert, BarChart2, ArrowRight } from "lucide-react";
import type { StockRecommendation } from "@shared/schema";
import type { StockDrawerPayload } from "./StockChartDrawer";

interface StockRecommendationCardProps {
  recommendation: StockRecommendation;
  onViewChart: (stock: StockDrawerPayload) => void;
}

export function StockRecommendationCard({ recommendation, onViewChart }: StockRecommendationCardProps) {
  const payload: StockDrawerPayload = {
    symbol:      recommendation.stockSymbol,
    name:        recommendation.stockName,
    exchange:    recommendation.exchange,
    targetPrice: recommendation.targetPrice,
    stopLoss:    recommendation.stopLoss,
    price:       Number(recommendation.currentPrice),
    reasonToBuy: recommendation.reasonToBuy,
  };

  const recType = recommendation.recommendationType?.toUpperCase() ?? "BUY";
  const accentColor =
    recType === "BUY"  ? "hsl(142,71%,50%)" :
    recType === "SELL" ? "hsl(0,84%,62%)"   : "hsl(38,96%,58%)";

  return (
    <motion.div
      whileHover={{ scale: 1.015, y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="group relative flex flex-col rounded-2xl overflow-hidden glass-card border border-white/6
        hover:border-white/12 cursor-pointer transition-all duration-300"
      style={{ boxShadow: "0 4px 24px 0 rgba(0,0,0,0.5)" }}
      onClick={() => onViewChart(payload)}
    >
      {/* Colored top accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: accentColor }} />

      {/* Hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${accentColor}0f 0%, transparent 65%)` }}
      />

      {/* Header */}
      <div className="flex items-start justify-between p-5 pb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-xl font-mono font-extrabold tracking-tight text-white">
              {recommendation.stockSymbol}
            </h3>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/6 text-white/40 border border-white/8">
              {recommendation.exchange}
            </span>
          </div>
          <p className="text-xs text-white/45 font-sans truncate">{recommendation.stockName}</p>
        </div>
        <RecommendationBadge type={recommendation.recommendationType as any} size="md" />
      </div>

      {/* Reason */}
      <div
        className="mx-4 mb-3 rounded-xl p-3.5 border"
        style={{
          background: `${accentColor}0c`,
          borderColor: `${accentColor}28`,
        }}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <TrendingUp className="w-3.5 h-3.5" style={{ color: accentColor }} />
          <span className="text-[10px] font-mono font-semibold uppercase tracking-widest" style={{ color: accentColor }}>Reason</span>
        </div>
        <p className="text-xs text-white/50 leading-relaxed line-clamp-3 font-sans">
          {recommendation.reasonToBuy}
        </p>
      </div>

      {/* Price grid */}
      <div className="mx-4 mb-3 grid grid-cols-3 gap-2">
        {/* Current */}
        <div className="rounded-xl p-3 bg-white/3 border border-white/6 col-span-1">
          <div className="text-[9px] text-white/35 font-mono uppercase tracking-wider mb-1">Price</div>
          <div className="text-sm font-mono font-bold text-white tabular-nums">₹{recommendation.currentPrice}</div>
        </div>
        {/* Target */}
        <div className="rounded-xl p-3 bg-emerald-500/6 border border-emerald-500/15 col-span-1">
          <div className="flex items-center gap-1 mb-1">
            <Target className="w-2.5 h-2.5 text-emerald-400" />
            <span className="text-[9px] text-emerald-400/70 font-mono uppercase tracking-wider">Target</span>
          </div>
          <div className="text-sm font-mono font-bold text-emerald-400 tabular-nums">₹{recommendation.targetPrice}</div>
        </div>
        {/* SL */}
        <div className="rounded-xl p-3 bg-red-500/6 border border-red-500/15 col-span-1">
          <div className="flex items-center gap-1 mb-1">
            <ShieldAlert className="w-2.5 h-2.5 text-red-400" />
            <span className="text-[9px] text-red-400/70 font-mono uppercase tracking-wider">SL</span>
          </div>
          <div className="text-sm font-mono font-bold text-red-400 tabular-nums">₹{recommendation.stopLoss}</div>
        </div>
      </div>

      {/* CTA row */}
      <div
        className="flex items-center justify-between px-5 py-3.5 mt-auto border-t border-white/5"
        style={{ background: "rgba(255,255,255,0.02)" }}
      >
        <div className="flex items-center gap-1.5 text-xs text-white/35 font-mono">
          <BarChart2 className="w-3.5 h-3.5" />
          Click to view live chart
        </div>
        <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: accentColor }}>
          View Chart
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </motion.div>
  );
}
