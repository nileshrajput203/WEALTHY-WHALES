import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RecommendationBadgeProps {
  type: "BUY" | "SELL" | "HOLD";
  size?: "sm" | "md" | "lg";
}

export function RecommendationBadge({ type, size = "md" }: RecommendationBadgeProps) {
  const config = {
    BUY: {
      color: "bg-bullish/20 text-bullish border-bullish",
      icon: TrendingUp,
      label: "Buy",
    },
    SELL: {
      color: "bg-bearish/20 text-bearish border-bearish",
      icon: TrendingDown,
      label: "Sell",
    },
    HOLD: {
      color: "bg-accent/20 text-accent-foreground border-accent",
      icon: Minus,
      label: "Hold",
    },
  };

  const { color, icon: Icon, label } = config[type];
  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <Badge
      className={`${color} ${sizeClasses[size]} rounded-full font-semibold border inline-flex items-center gap-1.5`}
      data-testid={`badge-recommendation-${type.toLowerCase()}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </Badge>
  );
}
