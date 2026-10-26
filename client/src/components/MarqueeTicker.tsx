import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown } from "lucide-react";

interface IndexData {
  name: string;
  symbol: string;
  value: number;
  change: number;
  changePercent: number;
}

const DEFAULT_INDICES: IndexData[] = [
  { name: "NIFTY 50", symbol: "^NSEI", value: 24853.25, change: 168.40, changePercent: 0.68 },
  { name: "SENSEX", symbol: "^BSESN", value: 81525.60, change: 480.15, changePercent: 0.59 },
  { name: "BANK NIFTY", symbol: "^NSEBANK", value: 52940.80, change: 310.20, changePercent: 0.59 },
  { name: "INDIA VIX", symbol: "^INDIAVIX", value: 12.85, change: -0.42, changePercent: -3.16 },
  { name: "NIFTY IT", symbol: "^CNXIT", value: 41820.10, change: 345.50, changePercent: 0.83 },
  { name: "NIFTY AUTO", symbol: "^CNXAUTO", value: 25410.30, change: 140.25, changePercent: 0.55 },
  { name: "MIDCAP 100", symbol: "^NSEMDCP100", value: 58920.45, change: 420.70, changePercent: 0.72 },
];

export function MarqueeTicker() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/indices"],
    refetchInterval: 30000,
  });

  const apiIndices: IndexData[] = Array.isArray(data)
    ? data
    : (data?.indices as IndexData[] | undefined) ?? [];

  const indicesData = apiIndices.length > 0 ? apiIndices : DEFAULT_INDICES;

  return (
    <div
      className="group relative bg-card/70 backdrop-blur-md border-b border-border/50 overflow-hidden shadow-xs w-full select-none"
      data-testid="marquee-ticker"
    >
      <div className="flex animate-marquee-safe group-hover:[animation-play-state:paused] whitespace-nowrap py-2 transition-all">
        {/* Repeat indices to create seamless infinite ticker */}
        {[...indicesData, ...indicesData, ...indicesData].map((index, i) => {
          const change = Number(index.change ?? 0);
          const changePercent = Number(
            index.changePercent ?? (index.value ? (change / index.value) * 100 : 0)
          );
          const positive = change >= 0;

          return (
            <div
              key={`${index.symbol}-${i}`}
              className="inline-flex items-center gap-2.5 px-5 font-mono text-xs hover:bg-foreground/[0.04] transition-colors rounded-lg mx-0.5 cursor-default"
              data-testid={`ticker-item-${index.symbol}-${i}`}
            >
              <span className="text-muted-foreground font-semibold tracking-wider uppercase text-[11px]">
                {index.name || index.symbol}
              </span>
              <span className="text-foreground font-bold tabular-nums text-xs">
                {Number(index.value).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span
                className={`inline-flex items-center gap-1 font-semibold text-[11px] px-1.5 py-0.5 rounded-md tabular-nums border ${
                  positive
                    ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-500/15"
                    : "text-rose-500 bg-rose-500/10 border-rose-500/20 dark:text-rose-400 dark:bg-rose-500/15"
                }`}
              >
                {positive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {positive ? "+" : ""}
                {changePercent.toFixed(2)}%
              </span>
              <span className="text-border/60 select-none ml-2">|</span>
            </div>
          );
        })}
      </div>

      {/* Smooth edge feather masks */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
    </div>
  );
}
