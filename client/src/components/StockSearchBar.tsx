import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";

interface StockSearchBarProps {
  onSearch?: (symbol: string) => void;
}

export function StockSearchBar({ onSearch }: StockSearchBarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (onSearch) {
        onSearch(searchQuery.trim());
      } else {
        setLocation(`/stock/${searchQuery.trim().toUpperCase()}`);
      }
    }
  };

  return (
    <form onSubmit={handleSearch} className="w-full max-w-2xl">
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground group-focus-within:text-primary transition-colors duration-200" />
        <Input
          type="search"
          placeholder="Search stocks (e.g., TCS, RELIANCE)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 pr-4 py-3 sm:py-2.5 bg-card/80 backdrop-blur-sm border-card-border/50 rounded-xl text-sm sm:text-base focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all duration-200 hover:border-primary/30 shadow-soft hover:shadow-medium"
          data-testid="input-stock-search"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            ✕
          </button>
        )}
      </div>
    </form>
  );
}
