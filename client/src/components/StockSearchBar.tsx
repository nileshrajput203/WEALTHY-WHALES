import { useState, useEffect, useRef } from "react";
import { Search, Loader2, TrendingUp, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

interface StockSearchBarProps {
  onSearch?: (symbol: string) => void;
}

interface SearchResult {
  symbol: string;
  name: string;
  exchange?: string;
}

export function StockSearchBar({ onSearch }: StockSearchBarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const wrapperRef = useRef<HTMLFormElement>(null);

  // Debounce the search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: suggestions, isLoading } = useQuery<SearchResult[]>({
    queryKey: ["/api/search/stocks", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      const res = await fetch(`/api/search/stocks?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: debouncedQuery.trim().length > 0,
  });

  const handleSelect = (symbol: string) => {
    setSearchQuery(symbol);
    setIsOpen(false);
    if (onSearch) {
      onSearch(symbol);
    } else {
      setLocation(`/stock/${encodeURIComponent(symbol)}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      handleSelect(searchQuery.trim().toUpperCase());
    }
  };

  return (
    <form ref={wrapperRef} onSubmit={handleSubmit} className="w-full max-w-2xl relative">
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground group-focus-within:text-primary transition-colors duration-200" />
        <Input
          type="search"
          placeholder="Search stocks (e.g., TCS, RELIANCE)..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-12 pr-4 py-3 sm:py-2.5 bg-card/80 backdrop-blur-sm border-card-border/50 rounded-xl text-sm sm:text-base focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all duration-200 hover:border-primary/30 shadow-soft hover:shadow-medium"
          data-testid="input-stock-search"
        />
        {isLoading && searchQuery === debouncedQuery && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Dropdown Suggestions */}
      <AnimatePresence>
        {isOpen && debouncedQuery.trim().length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 bg-card/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden z-50 max-h-[300px] overflow-y-auto"
          >
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Searching...</div>
            ) : suggestions && suggestions.length > 0 ? (
              <div className="py-1">
                {suggestions.map((s, i) => (
                  <button
                    key={`${s.symbol}-${i}`}
                    type="button"
                    onClick={() => handleSelect(s.symbol)}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 flex items-center justify-between group"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold font-mono text-white group-hover:text-primary transition-colors">
                        {s.symbol.replace(/\.(NS|BO)$/i, "")}
                      </span>
                      <span className="text-xs text-white/50 truncate max-w-[280px]">
                        {s.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/40 font-mono flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {s.exchange || (s.symbol.endsWith(".NS") ? "NSE" : s.symbol.endsWith(".BO") ? "BSE" : "IND")}
                      </span>
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400/50 group-hover:text-emerald-400 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No stocks found for "{debouncedQuery}"
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
