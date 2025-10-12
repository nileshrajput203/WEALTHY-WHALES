import { useState } from "react";
import { AuthModal } from "@/components/AuthModal";
import { Button } from "@/components/ui/button";
import { TrendingUp, BarChart3, Sparkles, Shield } from "lucide-react";

export default function Landing() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [hasSkipped, setHasSkipped] = useState(false);

  const handleSkip = () => {
    setHasSkipped(true);
    setShowAuthModal(false);
  };

  if (hasSkipped) {
    window.location.href = "/check-stock";
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6">
            Professional Stock Analysis
            <span className="block text-primary mt-2">For Indian Markets</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Get AI-powered insights, live market data, and expert recommendations for NSE/BSE stocks
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90"
              onClick={() => setShowAuthModal(true)}
              data-testid="button-get-started"
            >
              Get Started
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={handleSkip}
              data-testid="button-explore-free"
            >
              Explore Free
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {[
            {
              icon: TrendingUp,
              title: "Live Market Data",
              description: "Real-time stock prices and indices from NSE/BSE",
            },
            {
              icon: BarChart3,
              title: "Technical Analysis",
              description: "Advanced charts and technical indicators",
            },
            {
              icon: Sparkles,
              title: "AI-Powered Insights",
              description: "Chat with AI for personalized stock advice",
            },
            {
              icon: Shield,
              title: "Expert Recommendations",
              description: "Curated stock picks from professionals",
            },
          ].map((feature, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-6 hover-elevate">
              <feature.icon className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} onSkip={handleSkip} />
    </div>
  );
}
