import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useViewMode } from "@/hooks/useViewMode";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import ScreenerSearchBar from "@/components/ScreenerSearchBar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles, BarChart2, LayoutGrid, CheckCircle2, ChevronRight, TrendingUp, TrendingDown, ArrowUpDown } from "lucide-react";

interface ScreenerResult {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap?: number;
  pe?: number | null;
  roe?: number | null;
  debtToEquity?: number | null;
  stockiqScore?: number;
  stockiqGrade?: string;
  matchReason: string;
}

interface ScreenerResponse {
  filters: any;
  results: ScreenerResult[];
  query: string;
}

export default function SmartScreener() {
  const { isPro } = useViewMode();
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [activeFilters, setActiveFilters] = useState<any>(null);
  const [sortBy, setSortBy] = useState<keyof ScreenerResult>("stockiqScore");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Fetch suggested queries
  const { data: suggestionsData } = useQuery<{ suggestions: string[] }>({
    queryKey: ["/api/screener/suggestions"],
  });
  const suggestions = suggestionsData?.suggestions || [];

  // Mutation to trigger NLP screening
  const { mutate: runScreener, isPending } = useMutation<ScreenerResponse, Error, string>({
    mutationFn: async (queryStr: string) => {
      const res = await axios.post("/api/screener/smart", { query: queryStr });
      return res.data;
    },
    onSuccess: (data) => {
      setResults(data.results);
      setActiveFilters(data.filters);
    },
  });

  const handleSearch = (queryStr: string) => {
    runScreener(queryStr);
  };

  const handleSort = (field: keyof ScreenerResult) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  // Sort and filter results
  const sortedResults = [...results].sort((a, b) => {
    const valA = a[sortBy];
    const valB = b[sortBy];

    if (valA == null) return 1;
    if (valB == null) return -1;

    if (typeof valA === "number" && typeof valB === "number") {
      return sortOrder === "desc" ? valB - valA : valA - valB;
    }
    return 0;
  });

  const getScoreBadgeStyles = (score?: number) => {
    if (!score) return "bg-neutral-800 text-neutral-400";
    if (score >= 80) return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
    if (score >= 60) return "bg-green-500/10 border-green-500/20 text-green-400";
    if (score >= 40) return "bg-amber-500/10 border-amber-500/20 text-amber-400";
    return "bg-rose-500/10 border-rose-500/20 text-rose-400";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4 border-b border-white/5">
        <div>
          <span className="text-[10px] font-bold text-primary uppercase tracking-widest block mb-1">
            AI Stock Screener
          </span>
          <h2 className="text-3xl font-extrabold font-display text-white">
            Smart NLP Screener
          </h2>
          <p className="text-sm text-white/40 mt-1">
            Search stocks in plain English. AI translates queries to metrics instantly.
          </p>
        </div>
      </div>

      {/* Search Input Bar */}
      <ScreenerSearchBar
        onSearch={handleSearch}
        isLoading={isPending}
        suggestions={suggestions}
      />

      {/* AI Filters Output Card */}
      {activeFilters && (
        <Card className="border border-primary/20 bg-primary/5 backdrop-blur-md">
          <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">AI Filter Analysis</span>
                <p className="text-xs text-white/80">
                  Parsed Query: <span className="font-bold text-white italic">"{activeFilters.rawQuery}"</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {activeFilters.sectors && activeFilters.sectors.length > 0 && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-white/5 text-white/70 border-white/10 font-mono">
                  Sectors: {activeFilters.sectors.join(", ")}
                </Badge>
              )}
              {activeFilters.maxPrice && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-white/5 text-white/70 border-white/10 font-mono">
                  Price: &lt; ₹{activeFilters.maxPrice}
                </Badge>
              )}
              {activeFilters.minROE && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-white/5 text-white/70 border-white/10 font-mono">
                  ROE: &gt; {activeFilters.minROE}%
                </Badge>
              )}
              {activeFilters.maxPE && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-white/5 text-white/70 border-white/10 font-mono">
                  P/E: &lt; {activeFilters.maxPE}
                </Badge>
              )}
              {activeFilters.maxDebtToEquity && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-white/5 text-white/70 border-white/10 font-mono">
                  D/E: &lt; {activeFilters.maxDebtToEquity}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-primary/10 border-primary/20 text-primary font-bold">
                Matches: {results.length} Stocks
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading Thinking state */}
      {isPending && (
        <div className="flex flex-col items-center justify-center py-20 bg-black/10 border border-white/5 rounded-2xl">
          <div className="relative w-16 h-16 mb-4">
            {/* Spinning pulse loader */}
            <div className="absolute inset-0 rounded-full border-2 border-primary/10 border-t-primary animate-spin" />
            <div className="absolute inset-2 rounded-full border-2 border-violet-500/10 border-t-violet-500 animate-spin" style={{ animationDuration: "1s", animationDirection: "reverse" }} />
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-primary to-violet-600 animate-pulse opacity-80" />
          </div>
          <h4 className="text-sm font-bold text-white/60 uppercase tracking-widest">AI Screener Core Running</h4>
          <p className="text-xs text-white/40 mt-1 max-w-xs text-center leading-relaxed">
            Translating NLP to criteria, fetching live prices and financial ratios, then sorting by StockIQ.
          </p>
        </div>
      )}

      {/* Results Rendering */}
      {!isPending && results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white/35 uppercase tracking-widest">Screener Universe Matches</span>
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              {isPro ? (
                <span className="flex items-center gap-1"><BarChart2 className="h-3.5 w-3.5 text-primary" /> Pro Grid Mode</span>
              ) : (
                <span className="flex items-center gap-1"><LayoutGrid className="h-3.5 w-3.5 text-emerald-400" /> Simple Cards Mode</span>
              )}
            </div>
          </div>

          {isPro ? (
            /* ================= PRO VIEW TABLE ================= */
            <div className="overflow-hidden border border-white/5 bg-black/40 rounded-xl shadow-xl backdrop-blur-xl">
              <Table>
                <TableHeader className="bg-white/5 border-b border-white/10">
                  <TableRow>
                    <TableHead className="w-[100px] py-4 px-5 text-white/40 font-bold uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort("symbol")}>
                      <div className="flex items-center gap-1.5">Symbol <ArrowUpDown className="h-3 w-3" /></div>
                    </TableHead>
                    <TableHead className="py-4 px-5 text-white/40 font-bold uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort("name")}>
                      <div className="flex items-center gap-1.5">Company Name <ArrowUpDown className="h-3 w-3" /></div>
                    </TableHead>
                    <TableHead className="py-4 px-5 text-white/40 font-bold uppercase tracking-wider text-right cursor-pointer select-none" onClick={() => handleSort("price")}>
                      <div className="flex items-center gap-1.5 justify-end">Price <ArrowUpDown className="h-3 w-3" /></div>
                    </TableHead>
                    <TableHead className="py-4 px-5 text-white/40 font-bold uppercase tracking-wider text-right cursor-pointer select-none" onClick={() => handleSort("changePercent")}>
                      <div className="flex items-center gap-1.5 justify-end">Change % <ArrowUpDown className="h-3 w-3" /></div>
                    </TableHead>
                    <TableHead className="py-4 px-5 text-white/40 font-bold uppercase tracking-wider text-right cursor-pointer select-none" onClick={() => handleSort("pe")}>
                      <div className="flex items-center gap-1.5 justify-end">P/E <ArrowUpDown className="h-3 w-3" /></div>
                    </TableHead>
                    <TableHead className="py-4 px-5 text-white/40 font-bold uppercase tracking-wider text-right cursor-pointer select-none" onClick={() => handleSort("roe")}>
                      <div className="flex items-center gap-1.5 justify-end">ROE <ArrowUpDown className="h-3 w-3" /></div>
                    </TableHead>
                    <TableHead className="py-4 px-5 text-white/40 font-bold uppercase tracking-wider text-right cursor-pointer select-none" onClick={() => handleSort("debtToEquity")}>
                      <div className="flex items-center gap-1.5 justify-end">D/E <ArrowUpDown className="h-3 w-3" /></div>
                    </TableHead>
                    <TableHead className="py-4 px-5 text-white/40 font-bold uppercase tracking-wider text-right cursor-pointer select-none" onClick={() => handleSort("stockiqScore")}>
                      <div className="flex items-center gap-1.5 justify-end">StockIQ <ArrowUpDown className="h-3 w-3" /></div>
                    </TableHead>
                    <TableHead className="w-[50px] py-4 px-5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedResults.map((stock) => (
                    <TableRow key={stock.symbol} className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group">
                      <TableCell className="py-4 px-5 font-black text-white text-sm">{stock.symbol}</TableCell>
                      <TableCell className="py-4 px-5 text-white/80 font-semibold text-xs truncate max-w-[200px]">{stock.name}</TableCell>
                      <TableCell className="py-4 px-5 text-right font-bold text-white text-sm">₹{stock.price.toFixed(1)}</TableCell>
                      <TableCell className={cn("py-4 px-5 text-right font-bold text-xs", stock.changePercent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        <div className="flex items-center justify-end gap-1">
                          {stock.changePercent >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          <span>{stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-5 text-right font-medium text-white/70 text-xs">{stock.pe ? stock.pe.toFixed(1) : "—"}</TableCell>
                      <TableCell className="py-4 px-5 text-right font-medium text-white/70 text-xs">
                        {stock.roe ? `${(stock.roe < 1 ? stock.roe * 100 : stock.roe).toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell className="py-4 px-5 text-right font-medium text-white/70 text-xs">{stock.debtToEquity != null ? stock.debtToEquity.toFixed(2) : "—"}</TableCell>
                      <TableCell className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-[10px] font-extrabold text-white/40 uppercase tracking-wider">{stock.stockiqGrade}</span>
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-black font-mono border", getScoreBadgeStyles(stock.stockiqScore))}>
                            {stock.stockiqScore ?? "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-5 text-center">
                        <Link href={`/stock/${stock.symbol}`}>
                          <ChevronRight className="h-4.5 w-4.5 text-white/20 hover:text-white transition-colors cursor-pointer" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* ================= SIMPLE VIEW CARDS ================= */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedResults.map((stock) => {
                const scoreColor = getScoreBadgeStyles(stock.stockiqScore);
                const isBullish = stock.changePercent >= 0;

                return (
                  <Card key={stock.symbol} className="border border-white/5 bg-black/40 hover:bg-black/60 transition-all duration-300 hover:border-white/10 group shadow-lg">
                    <CardContent className="p-5 flex flex-col justify-between h-full min-h-[180px]">
                      <div>
                        {/* Title line */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest block">NSE Stock</span>
                            <h4 className="text-lg font-black text-white font-display mt-0.5">{stock.symbol}</h4>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider", scoreColor)}>
                              {stock.stockiqScore ? `Score: ${stock.stockiqScore}` : "N/A"}
                            </span>
                          </div>
                        </div>

                        {/* Name */}
                        <p className="text-xs text-white/50 font-medium truncate mt-1">{stock.name}</p>

                        {/* Reason / Verdict */}
                        <div className="mt-3.5 bg-white/5 rounded-lg px-2.5 py-1.5 border border-white/5">
                          <p className="text-[11px] font-semibold text-white/80 leading-snug">
                            {stock.matchReason}
                          </p>
                        </div>
                      </div>

                      {/* Footer metrics */}
                      <div className="flex items-end justify-between mt-5 pt-3.5 border-t border-white/5">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-white/35 font-medium uppercase tracking-wider">Current Price</span>
                          <span className="text-base font-black text-white">₹{stock.price.toFixed(1)}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-white/35 font-medium uppercase tracking-wider">Today</span>
                          <span className={cn("text-xs font-bold flex items-center gap-0.5", isBullish ? "text-emerald-400" : "text-rose-400")}>
                            {isBullish ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            <span>{isBullish ? "+" : ""}{stock.changePercent.toFixed(2)}%</span>
                          </span>
                        </div>
                        <Link href={`/stock/${stock.symbol}`}>
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg bg-white/5 border border-white/5 hover:bg-primary/20 hover:border-primary/30 text-white/70 group-hover:text-white transition-all cursor-pointer">
                            <ChevronRight className="h-4.5 w-4.5" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* No results empty state */}
      {!isPending && results.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-20 bg-black/10 border border-dashed border-white/5 rounded-2xl p-6">
          <Sparkles className="h-10 w-10 text-white/10 mb-4" />
          <h4 className="text-sm font-bold text-white/60 uppercase tracking-widest">Type a query to begin</h4>
          <p className="text-xs text-white/45 max-w-sm mt-1 leading-relaxed">
            Enter queries like <span className="text-primary font-bold">"IT stocks under ₹500 with rising profits"</span> to filter the Nifty 500 universe with AI intelligence.
          </p>
        </div>
      )}
    </div>
  );
}
