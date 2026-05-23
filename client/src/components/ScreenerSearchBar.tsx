import { useState, useEffect } from "react";
import { Sparkles, Search, History, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ScreenerSearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  suggestions: string[];
}

export default function ScreenerSearchBar({ onSearch, isLoading, suggestions }: ScreenerSearchBarProps) {
  const [query, setQuery] = useState("");
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("genai-recent-screener-queries");
    if (saved) {
      try {
        setRecentQueries(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    
    // Trigger search
    onSearch(query.trim());

    // Update history
    const updated = [query.trim(), ...recentQueries.filter(q => q !== query.trim())].slice(0, 5);
    setRecentQueries(updated);
    localStorage.setItem("genai-recent-screener-queries", JSON.stringify(updated));
    setShowRecent(false);
  };

  const handleSuggestionClick = (sug: string) => {
    setQuery(sug);
    onSearch(sug);
    setShowRecent(false);
  };

  const clearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentQueries([]);
    localStorage.removeItem("genai-recent-screener-queries");
  };

  return (
    <div className="w-full relative space-y-4">
      <form onSubmit={handleSubmit} className="relative w-full">
        {/* Glow behind input */}
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-primary/30 to-violet-600/30 opacity-40 blur-md transition-all duration-500 group-focus-within:opacity-100" />
        
        <div className="relative flex items-center bg-black/40 border border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-xl">
          <div className="pl-3.5 flex items-center justify-center text-white/40 pointer-events-none">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          </div>
          
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowRecent(true)}
            onBlur={() => setTimeout(() => setShowRecent(false), 200)}
            placeholder='Try: "IT stocks under ₹1000 with low debt" or "Pharma with ROE > 15%"'
            className="flex-1 bg-transparent border-0 ring-0 focus-visible:ring-0 text-white placeholder-white/25 text-sm h-11 focus-visible:ring-offset-0"
            disabled={isLoading}
          />
          
          <Button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="h-9 px-4 rounded-lg bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white font-semibold text-xs tracking-wider flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(124,58,237,0.3)] disabled:opacity-50"
          >
            <Search className="h-3.5 w-3.5" />
            <span>{isLoading ? "ANALYZING..." : "SCREEN"}</span>
          </Button>
        </div>

        {/* Recent Queries Dropdown */}
        {showRecent && recentQueries.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border border-white/5 bg-black/90 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in-50 slide-in-from-top-1 duration-200">
            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/5 mb-1.5">
              <span className="text-[10px] font-bold text-white/35 uppercase tracking-widest flex items-center gap-1">
                <History className="h-3 w-3" /> Recent Searches
              </span>
              <button
                type="button"
                onClick={clearHistory}
                className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition-colors uppercase tracking-wider cursor-pointer"
              >
                Clear
              </button>
            </div>
            {recentQueries.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onMouseDown={() => handleSuggestionClick(q)}
                className="w-full text-left px-2.5 py-2 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3 text-white/30" />
                <span className="truncate">{q}</span>
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Suggested chips */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2.5 pt-1.5 items-center">
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Try asking:</span>
          {suggestions.slice(0, 4).map((sug, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSuggestionClick(sug)}
              className="text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-white/60 hover:text-white px-3 py-1 rounded-full border border-white/5 hover:border-white/10 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              {sug}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
