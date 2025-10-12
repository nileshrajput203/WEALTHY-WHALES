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
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search stocks by symbol (e.g., TCS, RELIANCE)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 pr-4 py-2.5 bg-card border-card-border rounded-lg text-sm focus-visible:ring-primary"
          data-testid="input-stock-search"
        />
      </div>
    </form>
  );
}
