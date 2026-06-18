import { useRoute } from "wouter";
import { FundamentalDashboard } from "@/components/FundamentalDashboard";
import { BookOpen } from "lucide-react";

export default function FundamentalDetail() {
  const [, params] = useRoute("/stock/:symbol/fundamentals");
  const symbol = params?.symbol || "";

  if (!symbol) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" />
          {symbol} · Fundamental Analysis
        </h1>
        <p className="text-sm text-white/40 font-sans">
          AI-powered deep fundamental analysis · Concall intel · Annual reports · Valuation
        </p>
      </div>
      <FundamentalDashboard symbol={symbol} />
    </div>
  );
}
