import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { ScannerData } from "@shared/schema";

export default function SwingScanner() {
  const { data: scannerData = [], isLoading } = useQuery<ScannerData[]>({
    queryKey: ["/api/scanner/swing"],
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Swing Scanner</h1>
        <p className="text-muted-foreground">Top swing trading opportunities in the Indian market</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-card rounded-lg animate-pulse" />
          ))}
        </div>
      ) : scannerData.length > 0 ? (
        <div className="bg-card rounded-xl border border-card-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="table-swing-scanner">
              <thead className="bg-secondary">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Symbol</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exchange</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Price</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Change</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {scannerData.map((stock) => {
                  const isPositive = parseFloat(stock.change) >= 0;
                  return (
                    <tr key={stock.id} className="hover:bg-secondary/70" data-testid={`row-stock-${stock.stockSymbol}`}>
                      <td className="px-4 py-3 font-mono font-semibold text-foreground">{stock.stockSymbol}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{stock.stockName}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{stock.exchange}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">₹{stock.price}</td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
                        <span className="inline-flex items-center gap-1">
                          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {isPositive ? '+' : ''}{stock.changePercent}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">{stock.volume || 'N/A'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-16 pb-16 text-center">
            <TrendingUp className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Scanner Data</h3>
            <p className="text-muted-foreground">Swing trading opportunities will appear here</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
