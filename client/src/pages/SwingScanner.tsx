import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Search, BarChart2, Activity, Zap, ArrowUpDown, Star, Bell, BellRing, X, Trash2 } from "lucide-react";
import { StockChartDrawer, type StockDrawerPayload } from "@/components/StockChartDrawer";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";

interface SwingStock {
  sr:              number;
  stockName:       string;
  symbol:          string;
  links:           string;
  changePercent:   number;
  price:           number;
  volume:          string;
  setup:           string;
  atr:             number;
  ema9:            number;
  ema20:           number;
  ema50:           number;
  ema150:          number;
  ema200:          number;
  weekHigh52:      number;
  turnover:        number;
  vcpScore:        number;
  fundamentalScore:number;
  atrCompression:  number;
  volumeRatio:     number;
  nearHighPct:     number;
  rsScore:         number;
}

interface VcpAlert {
  id: string;
  userId: string;
  symbol: string;
  stockName: string;
  thresholdScore: number;
  createdAt: string;
}

/* VCP quality label based on score */
function vcpLabel(score: number): { text: string; cls: string } {
  if (score >= 80) return { text: "ROCKET BASE", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
  if (score >= 65) return { text: "ELITE VCP",  cls: "text-cyan-400   bg-cyan-500/10   border-cyan-500/20"    };
  if (score >= 50) return { text: "QUALITY VCP",  cls: "text-blue-400   bg-blue-500/10   border-blue-500/20"    };
  return               { text: "FORMING",  cls: "text-white/40   bg-white/5       border-white/8"       };
}

export default function SwingScanner() {
  const [search,           setSearch]           = useState("");
  const [sortFundamentals, setSortFundamentals] = useState(false);
  const [selectedStock,    setSelectedStock]    = useState<StockDrawerPayload | null>(null);
  const [expandedRow,      setExpandedRow]      = useState<number | null>(null);
  const [alertTarget,      setAlertTarget]      = useState<SwingStock | null>(null);
  const [alertThreshold,   setAlertThreshold]   = useState(70);
  const [scannerMode,      setScannerMode]      = useState<"vcp1" | "vcp2">("vcp1");

  const scannerEndpoint = scannerMode === "vcp2" ? "/api/swing-scanner-vcp2" : "/api/swing-scanner";

  const { data: swingData, isLoading, refetch, isFetching } = useQuery<{ stocks: SwingStock[]; cached?: boolean }>({
    queryKey: [scannerEndpoint],
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const { data: authUser } = useQuery<{ id: string } | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: vcpAlerts = [] } = useQuery<VcpAlert[]>({
    queryKey: ["/api/vcp-alerts"],
    enabled: !!authUser,
    staleTime: 30 * 1000,
  });

  const createAlert = useMutation({
    mutationFn: async (payload: { symbol: string; stockName: string; thresholdScore: number }) => {
      const res = await apiRequest("POST", "/api/vcp-alerts", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vcp-alerts"] });
      setAlertTarget(null);
    },
  });

  const deleteAlert = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/vcp-alerts/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/vcp-alerts"] }),
  });

  const alertMap = new Map<string, VcpAlert>(vcpAlerts.map(a => [a.symbol, a]));

  const rawStocks = (swingData?.stocks ?? []).filter(s =>
    !search ||
    s.stockName.toLowerCase().includes(search.toLowerCase()) ||
    s.symbol.toLowerCase().includes(search.toLowerCase())
  );

  // When toggle is ON → sort by fundamentalScore desc; else default (vcpScore desc)
  const stocks = [...rawStocks].sort((a, b) =>
    sortFundamentals
      ? (b.fundamentalScore ?? 0) - (a.fundamentalScore ?? 0)
      : (b.vcpScore ?? 0) - (a.vcpScore ?? 0)
  );

  const posCount = stocks.filter(s => s.changePercent >= 0).length;
  const negCount = stocks.filter(s => s.changePercent < 0).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="space-y-6">

        {/* ── Header ──────────────────────────── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1 flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" />
              Wealthy Whales VCP
              <span className={`text-xs font-mono font-normal px-2 py-0.5 rounded-full border ml-1 ${
                scannerMode === "vcp1"
                  ? "bg-primary/15 border-primary/30 text-primary/80"
                  : "bg-violet-500/15 border-violet-500/30 text-violet-400"
              }`}>
                {scannerMode === "vcp1" ? "VCP1: EVOLVED" : "VCP2: ROCKET"}
              </span>
            </h1>
            <p className="text-sm text-white/40 font-sans">
              {scannerMode === "vcp1"
                ? "Hyper-accurate Minervini VCP screen · 12 strict filters · 10%+ return targets"
                : "Rocket Base Setup · Extreme volatility contraction · Ghost town volume detection"
              }
            </p>
          </div>

          {/* Market mood pills */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono font-semibold text-emerald-400">
              <TrendingUp className="w-3 h-3" /> {posCount} Bullish
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-mono font-semibold text-red-400">
              <TrendingDown className="w-3 h-3" /> {negCount} Bearish
            </div>
          </div>
        </div>

        {/* ── VCP Alerts Panel ─────────────────── */}
        {vcpAlerts.length > 0 && (
          <div className="glass-card rounded-2xl border border-purple-500/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <BellRing className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-purple-400">
                VCP Watchlist — {vcpAlerts.length} Alert{vcpAlerts.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {vcpAlerts.map(alert => {
                const liveStock  = (swingData?.stocks ?? []).find(s => s.symbol === alert.symbol);
                const score      = liveStock?.vcpScore ?? null;
                const triggered  = score !== null && score >= alert.thresholdScore;
                return (
                  <div
                    key={alert.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all
                      ${triggered
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.12)]"
                        : "bg-white/4 border-white/8 text-white/50"
                      }`}
                  >
                    {triggered
                      ? <BellRing className="w-3 h-3 text-emerald-400 animate-pulse" />
                      : <Bell className="w-3 h-3 text-white/30" />
                    }
                    <span className={triggered ? "text-white/90" : ""}>{alert.symbol.replace(".NS","").replace(".BO","")}</span>
                    {score !== null && (
                      <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${triggered ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-white/30"}`}>
                        {score}/{alert.thresholdScore}
                      </span>
                    )}
                    {triggered && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-bold animate-pulse">
                        TRIGGERED
                      </span>
                    )}
                    <button
                      onClick={() => deleteAlert.mutate(alert.id)}
                      className="ml-1 text-white/20 hover:text-red-400 transition-colors"
                      title="Remove alert"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Search & Controls ────────────────── */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input
              type="text"
              placeholder="Search by name or symbol..."
              className="w-full bg-white/4 border border-white/8 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center p-1 bg-white/4 border border-white/8 rounded-2xl">
            <button
              onClick={() => setScannerMode("vcp1")}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                scannerMode === "vcp1"
                  ? "bg-primary text-black shadow-lg"
                  : "text-white/40 hover:text-white"
              }`}
            >
              VCP1 (Strict)
            </button>
            <button
              onClick={() => setScannerMode("vcp2")}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                scannerMode === "vcp2"
                  ? "bg-violet-500 text-white shadow-lg"
                  : "text-white/40 hover:text-white"
              }`}
            >
              VCP2 (Rocket)
            </button>
          </div>

          <button
            onClick={() => setSortFundamentals(!sortFundamentals)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all ${
              sortFundamentals
                ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                : "bg-white/4 border-white/8 text-white/40 hover:text-white"
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            {sortFundamentals ? "Sorted by Fundamentals" : "Sort by Fundamentals"}
          </button>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 rounded-2xl bg-white/4 border border-white/8 text-white/40 hover:text-white transition-all disabled:opacity-50"
          >
            <Activity className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* ── Table View ───────────────────────── */}
        <div className="glass-card rounded-3xl border border-white/8 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/8 bg-white/2">
                  <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-white/40">#</th>
                  <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-white/40">Stock</th>
                  <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-white/40 text-right">Price</th>
                  <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-white/40 text-right">Change</th>
                  <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-white/40">Setup / Strategy</th>
                  <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-white/40 text-center">VCP Score</th>
                  <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-white/40 text-center">Quality</th>
                  <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-white/40 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={8} className="px-6 py-4 h-16 bg-white/2" />
                    </tr>
                  ))
                ) : stocks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center text-white/20 font-mono text-sm">
                      No matching stocks found in current universe
                    </td>
                  </tr>
                ) : (
                  stocks.map((stock) => {
                    const label = vcpLabel(stock.vcpScore);
                    const isPositive = stock.changePercent >= 0;
                    const hasAlert = alertMap.has(stock.symbol);

                    return (
                      <tr
                        key={stock.symbol}
                        className="group hover:bg-white/4 transition-all cursor-pointer"
                        onClick={() => setSelectedStock({ symbol: stock.symbol, name: stock.stockName, price: stock.price })}
                      >
                        <td className="px-6 py-4 text-xs font-mono text-white/30">{stock.sr}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-white group-hover:text-primary transition-colors">{stock.symbol.replace(".NS","").replace(".BO","")}</span>
                            <span className="text-[10px] text-white/40 truncate max-w-[120px]">{stock.stockName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-mono text-white">₹{stock.price.toLocaleString("en-IN")}</td>
                        <td className={`px-6 py-4 text-right text-xs font-mono font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                          {isPositive ? "+" : ""}{stock.changePercent.toFixed(2)}%
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] text-white/80 font-medium">{stock.setup}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/8">{stock.links}</span>
                              <span className="text-[9px] text-white/30">Vol Ratio: {stock.volumeRatio.toFixed(2)}x</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/4 border border-white/8 text-sm font-display font-bold text-white">
                            {stock.vcpScore}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${label.cls}`}>
                            {label.text}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasAlert) deleteAlert.mutate(alertMap.get(stock.symbol)!.id);
                              else setAlertTarget(stock);
                            }}
                            className={`p-2 rounded-xl border transition-all ${
                              hasAlert
                                ? "bg-purple-500/20 border-purple-500/40 text-purple-400"
                                : "bg-white/4 border-white/8 text-white/20 hover:text-white hover:border-white/20"
                            }`}
                          >
                            <Bell className={`w-4 h-4 ${hasAlert ? "fill-current" : ""}`} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Info Cards ──────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card rounded-3xl border border-white/8 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display font-bold text-white">VCP1: EVOLVED</h3>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Based on Mark Minervini's "Trade Like a Stock Market Wizard" criteria. We use 12 high-precision filters including EMA stack alignment, 200d trend slope, and progressive ATR contraction.
            </p>
          </div>

          <div className="glass-card rounded-3xl border border-white/8 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-violet-500/10 border border-violet-500/20">
                <Activity className="w-5 h-5 text-violet-400" />
              </div>
              <h3 className="font-display font-bold text-white">VCP2: ROCKET</h3>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Detects the "Cheat" or "Rocket Base" setup. Focuses on extreme tightness (last contraction &lt; 8%) and volume dry-up (VDU). Designed for explosive 10%+ moves within days.
            </p>
          </div>

          <div className="glass-card rounded-3xl border border-white/8 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                <BarChart2 className="w-5 h-5 text-cyan-400" />
              </div>
              <h3 className="font-display font-bold text-white">VCP SCORE</h3>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              A composite 0-100 rating based on trend quality, volatility compression, proximity to highs, and volume characteristics. Scores &gt; 80 indicate high-probability breakout setups.
            </p>
          </div>
        </div>
      </div>

      {/* ── Drawers & Modals ─────────────────── */}
      {selectedStock && (
        <StockChartDrawer
          payload={selectedStock}
          onClose={() => setSelectedStock(null)}
        />
      )}

      {/* Alert Threshold Modal */}
      {alertTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card rounded-3xl border border-white/10 w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-display font-bold text-white">Set VCP Alert</h3>
              <button onClick={() => setAlertTarget(null)} className="p-2 rounded-full hover:bg-white/5 transition-colors">
                <X className="w-5 h-5 text-white/40" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-white/4 border border-white/8">
                <div className="text-[10px] font-mono uppercase tracking-widest text-white/30 mb-1">Target Stock</div>
                <div className="text-lg font-bold text-white">{alertTarget.symbol}</div>
                <div className="text-xs text-white/40">{alertTarget.stockName}</div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-mono text-white/60">VCP Score Threshold</label>
                  <span className="text-sm font-bold text-primary">{alertThreshold}</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="1"
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(parseInt(e.target.value))}
                />
                <div className="flex justify-between text-[10px] font-mono text-white/20">
                  <span>50 (Broad)</span>
                  <span>95 (Elite Only)</span>
                </div>
              </div>

              <button
                onClick={() => createAlert.mutate({
                  symbol: alertTarget.symbol,
                  stockName: alertTarget.stockName,
                  thresholdScore: alertThreshold
                })}
                disabled={createAlert.isPending}
                className="w-full py-3.5 rounded-2xl bg-primary text-black font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {createAlert.isPending ? "Creating..." : "Create Alert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
