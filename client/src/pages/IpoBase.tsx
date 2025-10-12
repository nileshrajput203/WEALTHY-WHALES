import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Rocket, TrendingUp, TrendingDown } from "lucide-react";
import type { ScannerData } from "@shared/schema";

export default function IpoBase() {
  const { data: ipoData = [], isLoading } = useQuery<ScannerData[]>({
    queryKey: ["/api/scanner/ipo"],
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
          <Rocket className="w-8 h-8 text-primary" />
          IPO Base Scanner
        </h1>
        <p className="text-muted-foreground">Track recent IPOs and their performance in the market</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-card rounded-lg animate-pulse" />
          ))}
        </div>
      ) : ipoData.length > 0 ? (
        <div className="bg-card rounded-xl border border-card-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="table-ipo-scanner">
              <thead className="bg-secondary">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Symbol</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Company Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exchange</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Price</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Change %</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Market Cap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {ipoData.map((stock) => {
                  const isPositive = parseFloat(stock.change) >= 0;
                  return (
                    <tr key={stock.id} className="hover:bg-secondary/70" data-testid={`row-ipo-${stock.stockSymbol}`}>
                      <td className="px-4 py-3 font-mono font-semibold text-foreground">{stock.stockSymbol}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{stock.stockName}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{stock.exchange}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">₹{stock.price}</td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
                        <span className="inline-flex items-center gap-1">
                          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {isPositive ? '+' : ''}{stock.changePercent}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">{stock.marketCap || 'N/A'}</td>
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
            <Rocket className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No IPO Data</h3>
            <p className="text-muted-foreground">Recent IPO listings will appear here</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
