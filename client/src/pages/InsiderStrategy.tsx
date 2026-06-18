import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, TrendingUp, TrendingDown, Search, ArrowUpDown, DollarSign, Filter } from "lucide-react";

interface InsiderTrade {
  date: string;
  company: string;
  symbol: string;
  insider: string;
  relation: string;
  txnType: "Buy" | "Sell";
  quantity: number;
  price: number;
  value: number;
  holdingChange: number;
}

export default function InsiderStrategy() {
  const [filter, setFilter] = useState<"all" | "Buy" | "Sell">("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"date" | "value">("date");

  const { data, isLoading } = useQuery<{ trades: InsiderTrade[] }>({
    queryKey: ["/api/nse/insider-trades"],
    staleTime: 5 * 60 * 1000,
  });

  const trades = useMemo(() => {
    let list = data?.trades ?? [];
    if (filter !== "all") list = list.filter(t => t.txnType === filter);
    if (search) list = list.filter(t =>
      t.company.toLowerCase().includes(search.toLowerCase()) ||
      t.symbol.toLowerCase().includes(search.toLowerCase()) ||
      t.insider.toLowerCase().includes(search.toLowerCase())
    );
    if (sortKey === "value") list = [...list].sort((a, b) => b.value - a.value);
    return list;
  }, [data, filter, search, sortKey]);

  const totalBuyValue = trades.filter(t => t.txnType === "Buy").reduce((s, t) => s + t.value, 0);
  const totalSellValue = trades.filter(t => t.txnType === "Sell").reduce((s, t) => s + t.value, 0);
  const bigBuys = trades.filter(t => t.txnType === "Buy" && t.value >= 10_000_000).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1 flex items-center gap-2">
          <Eye className="w-6 h-6 text-primary" />
          Insider Strategy
        </h1>
        <p className="text-sm text-white/40 font-sans">
          Track insider, bulk & block deals · Spot smart money moves before the crowd
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Trades", val: trades.length, icon: ArrowUpDown, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
          { label: "Buy Value", val: `₹${(totalBuyValue / 10_000_000).toFixed(1)}Cr`, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
          { label: "Sell Value", val: `₹${(totalSellValue / 10_000_000).toFixed(1)}Cr`, icon: TrendingDown, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
          { label: "Big Buys (>1Cr)", val: bigBuys, icon: DollarSign, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">{s.label}</span>
            </div>
            <p className={`text-lg font-mono font-bold ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search company, symbol, insider…"
            className="w-full pl-9 pr-4 py-2 rounded-xl glass-card border border-white/8 text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:border-primary/50 font-mono bg-transparent"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "Buy", "Sell"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all ${
                filter === f
                  ? f === "Buy" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                    : f === "Sell" ? "bg-red-500/20 border-red-500/40 text-red-400"
                    : "bg-primary/20 border-primary/40 text-primary"
                  : "bg-white/3 border-white/8 text-white/40 hover:text-white/60"
              }`}
            >
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSortKey(sortKey === "date" ? "value" : "date")}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono border border-white/8 text-white/40 hover:text-white/60 bg-white/3 transition-all"
        >
          <Filter className="w-3 h-3" /> Sort: {sortKey === "date" ? "Date" : "Value"}
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-white/3 animate-pulse border border-white/5" />
          ))}
        </div>
      ) : trades.length > 0 ? (
        <div className="rounded-2xl border border-white/6 overflow-hidden glass-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  {["Date", "Company", "Insider", "Type", "Qty", "Price", "Value", "Δ Holding"].map(col => (
                    <th key={col} className={`px-3 py-2.5 text-[10px] font-mono font-semibold uppercase tracking-widest text-white/30 ${["Qty", "Price", "Value", "Δ Holding"].includes(col) ? "text-right" : "text-left"}`}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map((t, i) => (
                  <tr key={i} className="border-b border-white/4 last:border-0 hover:bg-white/3 transition-colors">
                    <td className="px-3 py-3">
                      <span className="text-xs text-white/40 font-mono">{t.date}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div>
                        <p className="text-sm text-white/80 font-sans">{t.company}</p>
                        <p className="text-[10px] text-primary/60 font-mono">{t.symbol}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div>
                        <p className="text-xs text-white/60 font-sans">{t.insider}</p>
                        <p className="text-[9px] text-white/25 font-mono">{t.relation}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                        t.txnType === "Buy"
                          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                          : "text-red-400 bg-red-500/10 border-red-500/20"
                      }`}>
                        {t.txnType === "Buy" ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                        {t.txnType}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-xs text-white/50 font-mono">{t.quantity.toLocaleString("en-IN")}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-xs text-white/50 font-mono">₹{t.price.toFixed(2)}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className={`text-xs font-mono font-bold ${t.value >= 10_000_000 ? "text-yellow-400" : "text-white/60"}`}>
                        ₹{(t.value / 100_000).toFixed(1)}L
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className={`text-xs font-mono ${t.holdingChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {t.holdingChange >= 0 ? "+" : ""}{t.holdingChange.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 glass-card rounded-2xl border border-white/6">
          <Eye className="w-12 h-12 mx-auto text-white/15 mb-3" />
          <h3 className="text-base font-semibold text-white/60 mb-1">No insider trades found</h3>
          <p className="text-sm text-white/30">Insider data will populate during market hours</p>
        </div>
      )}
    </div>
  );
}
