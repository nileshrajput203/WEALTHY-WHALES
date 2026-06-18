import { useQuery } from "@tanstack/react-query";
import { useWatchlist } from "@/hooks/useWatchlist";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Newspaper, ExternalLink, StarOff, TrendingUp, TrendingDown, Star } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { StockChartDrawer, type StockDrawerPayload } from "@/components/StockChartDrawer";

// Watchlist Stock Row Item
function WatchlistStockRow({ symbol, onOpenChart, onRemove }: { symbol: string, onOpenChart: (stock: any) => void, onRemove: (s: string) => void }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/stock/${encodeURIComponent(symbol)}`],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return <div className="h-16 bg-white/5 animate-pulse rounded-xl" />;
  }
  
  const stock = data?.stock;
  if (!stock) return null;

  const isUp = (stock.changePercent ?? 0) >= 0;

  return (
    <div 
      className="glass-card rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-primary/40 transition-all border border-white/10"
      onClick={() => onOpenChart(stock)}
    >
      <div className="flex flex-col">
        <span className="font-bold text-white font-mono">{symbol.replace(".NS", "")}</span>
        <span className="text-xs text-white/50">{stock.name}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end text-right">
          <span className="font-bold text-white font-mono">₹{Number(stock.price).toFixed(2)}</span>
          <span className={`text-xs font-semibold flex items-center gap-1 ${isUp ? "text-emerald-400" : "text-red-400"}`}>
            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isUp ? "+" : ""}{Number(stock.changePercent ?? 0).toFixed(2)}%
          </span>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(symbol); }}
          className="p-2 hover:bg-red-500/10 text-white/40 hover:text-red-400 rounded-lg transition-colors"
          title="Remove from Watchlist"
        >
          <StarOff className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function Watchlist() {
  const { watchlist, removeStock } = useWatchlist();
  const [selectedStock, setSelectedStock] = useState<StockDrawerPayload | null>(null);

  // Fetch batch news for all symbols in watchlist
  const symbolsQuery = watchlist.length > 0 ? watchlist.join(",") : "";
  const { data: newsData, isLoading: isLoadingNews } = useQuery<any>({
    queryKey: ["/api/news/batch", symbolsQuery],
    enabled: watchlist.length > 0,
    refetchInterval: 60000,
  });

  const newsItems = newsData?.news ?? [];

  const formatDate = (date: string | null) => {
    if (!date) return "Recently";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="space-y-8">
      {/* Chart Drawer */}
      <StockChartDrawer stock={selectedStock} onClose={() => setSelectedStock(null)} />

      <div>
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Star className="w-8 h-8 text-yellow-400 fill-yellow-400/20" />
          My Watchlist
        </h1>
        <p className="text-white/50">Track your favorite stocks and see personalized market news.</p>
      </div>

      {watchlist.length === 0 ? (
        <Card className="glass-card border-white/10 bg-black/40">
          <CardContent className="pt-16 pb-16 text-center">
            <Star className="w-16 h-16 mx-auto text-white/20 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Your Watchlist is Empty</h3>
            <p className="text-white/50 max-w-md mx-auto mb-6">
              You aren't tracking any stocks yet. Open any stock chart across the platform and click the <Star className="inline w-4 h-4 text-yellow-400"/> Watchlist button to see personalized news here.
            </p>
            <Link href="/">
              <button className="px-6 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/50 font-semibold rounded-lg transition-colors">
                Explore Market
              </button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: The Watchlist Stocks */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-bold text-white mb-4">Tracked Assets ({watchlist.length})</h2>
            <div className="flex flex-col gap-3">
              {watchlist.map((symbol) => (
                <WatchlistStockRow 
                  key={symbol} 
                  symbol={symbol} 
                  onOpenChart={setSelectedStock}
                  onRemove={removeStock}
                />
              ))}
            </div>
          </div>

          {/* Right Column: AI Filtered Watchlist News */}
          <div className="lg:col-span-2 space-y-4">
             <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
               <Newspaper className="w-5 h-5 text-primary" />
               Impact Drivers & News
             </h2>

             {isLoadingNews ? (
               <div className="space-y-4">
                 {[...Array(3)].map((_, i) => (
                   <div key={i} className="h-32 bg-white/5 rounded-xl animate-pulse" />
                 ))}
               </div>
             ) : newsItems.length > 0 ? (
               <div className="space-y-4">
                 {newsItems.map((item: any, idx: number) => (
                   <Card key={item.id ?? idx} className="glass-card hover-elevate border-white/10 overflow-hidden">
                     {/* Color bar representing the stock */}
                     <div className="h-1 w-full bg-gradient-to-r from-primary/50 to-primary/10" />
                     <CardHeader className="pb-2">
                       <div className="flex items-start justify-between gap-4">
                         <div>
                           <div className="text-[10px] font-mono font-bold text-primary tracking-wider uppercase mb-1.5 px-2 py-0.5 bg-primary/10 inline-block rounded">
                             {item.relatedSymbol?.replace(".NS", "")}
                           </div>
                           <CardTitle className="text-lg font-semibold text-white leading-snug group-hover:text-primary transition-colors">
                             {item.title}
                           </CardTitle>
                         </div>
                         {item.url && (
                           <a
                             href={item.url}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="text-white/40 hover:text-primary transition-colors flex-shrink-0"
                             onClick={(e) => e.stopPropagation()}
                           >
                             <ExternalLink className="w-5 h-5" />
                           </a>
                         )}
                       </div>
                     </CardHeader>
                     {item.description && (
                       <CardContent>
                         <p className="text-sm text-white/60 line-clamp-2 leading-relaxed mb-3">{item.description}</p>
                         <div className="flex items-center gap-3 text-xs text-white/40 font-mono">
                           {item.source && <span className="bg-white/5 px-2 py-0.5 rounded text-white/70">{item.source}</span>}
                           <span>{formatDate(item.publishedAt)}</span>
                         </div>
                       </CardContent>
                     )}
                   </Card>
                 ))}
               </div>
             ) : (
                <div className="glass-card rounded-xl p-12 text-center border-white/5">
                  <Newspaper className="w-12 h-12 mx-auto text-white/20 mb-3" />
                  <p className="text-white/50">No recent news found for your tracked stocks.</p>
                </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
