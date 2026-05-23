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
  // The API may return either an array or an object: { indices: IndexData[] }
  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/indices"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const indicesData: IndexData[] = Array.isArray(data)
    ? data
    : (data?.indices as IndexData[] | undefined) ?? [];

  return (
    <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 overflow-hidden shadow-lg w-full" data-testid="marquee-ticker">
      <div className="flex animate-marquee-safe whitespace-nowrap py-3">
        {/* State: loading / error / empty */}
        {isLoading && (
          <div className="px-6 text-slate-300 text-sm">Loading indices…</div>
        )}
        {isError && !isLoading && indicesData.length === 0 && (
          <div className="px-6 text-slate-300 text-sm">Failed to load indices</div>
        )}
        {/* Duplicate indices for seamless loop */}
        {[...indicesData, ...indicesData].map((index, i) => (
          <div
            key={`${index.symbol}-${i}`}
            className="inline-flex items-center gap-3 px-6 font-mono text-sm hover:bg-white/5 transition-colors duration-200 rounded-lg mx-1"
            data-testid={`ticker-item-${index.symbol}-${i}`}
          >
            <span className="text-slate-300 font-semibold tracking-wide uppercase text-xs">
              {index.name || index.symbol}
            </span>
            <span className="text-white font-bold text-sm">
              {index.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            {(() => {
              const change = Number(index.change ?? 0);
              const changePercent = Number(
                index.changePercent ?? (index.value ? (change / index.value) * 100 : 0)
              );
              const positive = change >= 0;
              return (
                <span className={`flex items-center gap-1 font-bold text-xs px-2 py-1 rounded-full ${
                  positive
                    ? 'text-green-400 bg-green-400/10 border border-green-400/20'
                    : 'text-red-400 bg-red-400/10 border border-red-400/20'
                }`}>
                  {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {positive ? '+' : ''}{changePercent.toFixed(2)}%
                </span>
              );
            })()}
          </div>
        ))}
      </div>
      {/* Gradient overlays for smooth edges */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-900 to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-900 to-transparent pointer-events-none" />
    </div>
  );
}
