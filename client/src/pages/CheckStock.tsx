import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { StockSearchBar } from "@/components/StockSearchBar";
import { Search } from "lucide-react";

export default function CheckStock() {
  const [match, params] = useRoute("/stock/:symbol");
  const [selectedStock, setSelectedStock] = useState<string | null>(null);

  useEffect(() => {
    if (match && params?.symbol) {
      setSelectedStock(params.symbol);
    }
  }, [match, params]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Check Your Stock</h1>
        <p className="text-muted-foreground">Search and analyze Indian stocks from NSE and BSE</p>
      </div>

      <div className="max-w-3xl">
        <StockSearchBar />
      </div>

      {!selectedStock ? (
        <div className="text-center py-24 bg-card rounded-xl border border-card-border">
          <Search className="w-20 h-20 mx-auto text-muted-foreground mb-6" />
          <h3 className="text-2xl font-semibold text-foreground mb-3">Search for a Stock</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Enter a stock symbol (e.g., TCS, RELIANCE, INFY) to view detailed analysis, 
            charts, and recommendations
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-card-border p-8">
          <h2 className="text-2xl font-bold font-mono uppercase text-foreground mb-6">{selectedStock}</h2>
          <p className="text-muted-foreground">Stock analysis will be displayed here...</p>
        </div>
      )}
    </div>
  );
}
