import { useQuery } from "@tanstack/react-query";
import { StockRecommendationCard } from "@/components/StockRecommendationCard";
import { Button } from "@/components/ui/button";
import { TrendingUp, Sparkles, Search } from "lucide-react";
import type { StockRecommendation } from "@shared/schema";

export default function Home() {
  const { data: recommendations = [], isLoading } = useQuery<StockRecommendation[]>({
    queryKey: ["/api/recommendations"],
  });

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-8 border border-primary/20">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold text-foreground mb-4 flex items-center gap-3">
            <TrendingUp className="w-10 h-10 text-primary" />
            Welcome to StockIQ
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            Your professional stock analysis platform for Indian markets (NSE/BSE). 
            Get AI-powered insights, live market data, and expert recommendations.
          </p>
          <div className="flex gap-4">
            <Button className="bg-primary hover:bg-primary/90" data-testid="button-explore-stocks">
              <Search className="w-4 h-4 mr-2" />
              Explore Stocks
            </Button>
            <Button variant="outline" data-testid="button-ai-chat">
              <Sparkles className="w-4 h-4 mr-2" />
              Ask AI
            </Button>
          </div>
        </div>
      </div>

      {/* Featured Recommendations */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Featured Recommendations</h2>
            <p className="text-sm text-muted-foreground mt-1">Expert picks from our analysts</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-96 bg-card rounded-xl animate-pulse" />
            ))}
          </div>
        ) : recommendations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="recommendations-grid">
            {recommendations.map((rec) => (
              <StockRecommendationCard key={rec.id} recommendation={rec} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-card rounded-xl border border-card-border">
            <TrendingUp className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Recommendations Yet</h3>
            <p className="text-muted-foreground">Check back soon for expert stock picks</p>
          </div>
        )}
      </div>
    </div>
  );
}
