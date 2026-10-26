import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RecommendationBadgeProps {
  type: "BUY" | "SELL" | "HOLD";
  size?: "sm" | "md" | "lg";
}

export function RecommendationBadge({ type, size = "md" }: RecommendationBadgeProps) {
  const config = {
    BUY: {
      color: "bg-emerald-950/90 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.18)] font-black",
      icon: TrendingUp,
      label: "Buy",
    },
    SELL: {
      color: "bg-rose-950/90 text-rose-300 border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.18)] font-black",
      icon: TrendingDown,
      label: "Sell",
    },
    HOLD: {
      color: "bg-amber-950/90 text-amber-300 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.18)] font-black",
      icon: Minus,
      label: "Hold",
    },
  };

  const { color, icon: Icon, label } = config[type] || config.HOLD;
  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px] font-bold font-mono tracking-wide uppercase",
    md: "px-3 py-1 text-xs font-bold font-mono tracking-wide uppercase",
    lg: "px-4 py-1.5 text-sm font-bold font-mono tracking-wide uppercase",
  };

  return (
    <Badge
      variant="outline"
      className={`${color} ${sizeClasses[size]} rounded-lg border inline-flex items-center gap-1.5 shadow-2xs`}
      data-testid={`badge-recommendation-${type.toLowerCase()}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </Badge>
  );
}
