import { useState, useEffect } from "react";

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("genai_stock_watchlist");
      if (stored) {
        setWatchlist(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load watchlist from localStorage");
    }
  }, []);

  const addStock = (symbol: string) => {
    setWatchlist((prev) => {
      if (prev.includes(symbol)) return prev;
      const updated = [...prev, symbol];
      localStorage.setItem("genai_stock_watchlist", JSON.stringify(updated));
      return updated;
    });
  };

  const removeStock = (symbol: string) => {
    setWatchlist((prev) => {
      const updated = prev.filter((s) => s !== symbol);
      localStorage.setItem("genai_stock_watchlist", JSON.stringify(updated));
      return updated;
    });
  };

  const isWatched = (symbol: string) => watchlist.includes(symbol);

  const toggleStock = (symbol: string) => {
    if (isWatched(symbol)) {
      removeStock(symbol);
    } else {
      addStock(symbol);
    }
  };

  return { watchlist, addStock, removeStock, isWatched, toggleStock };
}
