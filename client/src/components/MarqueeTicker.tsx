import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown } from "lucide-react";

interface IndexData {
  name: string;
  symbol: string;
  value: number;
  change: number;
  changePercent: number;
}

export function MarqueeTicker() {
  const { data: indices = [] } = useQuery<IndexData[]>({
    queryKey: ["/api/indices"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return (
    <div className="bg-[hsl(220_20%_16%)] border-b border-gray-700 overflow-hidden" data-testid="marquee-ticker">
      <div className="flex animate-marquee whitespace-nowrap py-2">
        {/* Duplicate indices for seamless loop */}
        {[...indices, ...indices].map((index, i) => (
          <div
            key={`${index.symbol}-${i}`}
            className="inline-flex items-center gap-2 px-6 font-mono text-sm"
            data-testid={`ticker-item-${index.symbol}-${i}`}
          >
            <span className="text-muted-foreground font-medium tracking-wide uppercase">
              {index.symbol}
            </span>
            <span className="text-foreground font-semibold">
              {index.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className={`flex items-center gap-1 font-semibold ${
              index.change >= 0 ? 'text-bullish' : 'text-bearish'
            }`}>
              {index.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {index.change >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
