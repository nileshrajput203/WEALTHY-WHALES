import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecommendationBadge } from "./RecommendationBadge";
import { TrendingUp, Target, ShieldAlert } from "lucide-react";
import type { StockRecommendation } from "@shared/schema";

interface StockRecommendationCardProps {
  recommendation: StockRecommendation;
}

export function StockRecommendationCard({ recommendation }: StockRecommendationCardProps) {
  return (
    <Card className="bg-card border-card-border rounded-xl shadow-xl hover:shadow-2xl hover-elevate transition-all duration-300">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-bold font-mono tracking-wide uppercase text-foreground">
              {recommendation.stockSymbol}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{recommendation.stockName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{recommendation.exchange}</p>
          </div>
          <RecommendationBadge type={recommendation.recommendationType as any} size="md" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="text-lg font-semibold text-success flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5" />
            Reason to Buy
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {recommendation.reasonToBuy}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-secondary/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-bullish" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Target Price</span>
            </div>
            <p className="text-2xl font-bold font-mono text-bullish">
              ₹{recommendation.targetPrice}
            </p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-bearish" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Stop Loss</span>
            </div>
            <p className="text-2xl font-bold font-mono text-bearish">
              ₹{recommendation.stopLoss}
            </p>
          </div>
        </div>

        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Current Price</p>
          <p className="text-xl font-bold font-mono text-foreground">₹{recommendation.currentPrice}</p>
        </div>

        <Button className="w-full bg-primary hover:bg-primary/90" data-testid="button-view-analysis">
          View Full Analysis
        </Button>
      </CardContent>
    </Card>
  );
}
