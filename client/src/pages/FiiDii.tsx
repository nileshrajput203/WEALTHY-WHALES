import { useQuery } from "@tanstack/react-query";
import { Users, TrendingUp, TrendingDown, RefreshCw, Landmark, ArrowLeftRight, BarChart2 } from "lucide-react";
import { useState } from "react";

interface FiiDiiDailyItem {
  date: string;
  fiiCash: number;
  diiCash: number;
  fiiIndexFutures: number;
  fiiStockFutures: number;
  netCashFlow: number;
}

interface FiiDiiData {
  latestDate: string;
  fiiCashLatest: number;
  diiCashLatest: number;
  netCashLatest: number;
  fiiIndexFuturesLatest: number;
  fiiStockFuturesLatest: number;
  sentiment: "Bullish" | "Bearish" | "Neutral" | "Mixed";
  sentimentReason: string;
  usdinr?: number;
  history: FiiDiiDailyItem[];
}

export default function FiiDii() {
  const { data, isLoading, refetch, isFetching } = useQuery<{ data: FiiDiiData }>({
    queryKey: ["/api/fii-dii"],
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  const fd = data?.data;

  const getSentimentStyle = (sentiment: string) => {
    switch (sentiment) {
      case "Bullish":
        return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
      case "Bearish":
        return "bg-red-500/10 border-red-500/20 text-red-400";
      case "Mixed":
        return "bg-yellow-500/10 border-yellow-500/20 text-yellow-400";
      default:
        return "bg-white/5 border-white/8 text-white/50";
    }
  };

  const formatVolume = (val: number) => {
    const absVal = Math.abs(val);
    const sign = val >= 0 ? "+" : "-";
    return `${sign}₹${absVal.toLocaleString("en-IN")} Cr`;
  };

  const getVolColor = (val: number) => {
    if (val > 0) return "text-emerald-400";
    if (val < 0) return "text-red-400";
    return "text-white/40";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            FII / DII Flows
          </h1>
          <p className="text-sm text-white/40 font-sans flex items-center gap-2 flex-wrap">
            <span>Institutional money flows, cash market activity, and derivative positioning</span>
            {fd?.usdinr && (
              <>
                <span className="text-white/20">•</span>
                <span className="inline-flex items-center gap-1 text-xs font-mono bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-lg">
                  USD/INR: ₹{fd.usdinr.toFixed(2)}
                </span>
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 rounded-xl bg-white/5 border border-white/8 text-white/60 hover:text-white hover:bg-white/8 active:scale-95 transition-all flex items-center gap-2 text-xs font-mono"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Syncing..." : "Sync Flow"}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-white/3 border border-white/5" />
            ))}
          </div>
          <div className="h-96 rounded-2xl bg-white/3 border border-white/5" />
        </div>
      ) : fd ? (
        <>
          {/* Sentiment Gauge & Info */}
          <div className="glass-card rounded-2xl border border-white/6 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">Current Market Stance</span>
              <div className="flex items-center gap-3">
                <span className={`text-xl font-bold font-mono px-3 py-1 rounded-xl border ${getSentimentStyle(fd.sentiment)}`}>
                  {fd.sentiment}
                </span>
                <span className="text-sm font-sans text-white/60">{fd.sentimentReason}</span>
              </div>
            </div>
            <div className="text-sm text-white/30 font-mono text-left md:text-right">
              Latest Data Date: <span className="text-white/60">{fd.latestDate}</span>
            </div>
          </div>

          {/* Core Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card rounded-2xl border border-white/6 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase text-white/20">FII Cash Net</span>
                <Landmark className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <p className={`text-xl font-mono font-bold ${getVolColor(fd.fiiCashLatest)}`}>
                {formatVolume(fd.fiiCashLatest)}
              </p>
              <p className="text-[9px] font-sans text-white/30 mt-1">Foreign investor net flow</p>
            </div>

            <div className="glass-card rounded-2xl border border-white/6 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase text-white/20">DII Cash Net</span>
                <Landmark className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <p className={`text-xl font-mono font-bold ${getVolColor(fd.diiCashLatest)}`}>
                {formatVolume(fd.diiCashLatest)}
              </p>
              <p className="text-[9px] font-sans text-white/30 mt-1">Domestic funds/LIC/MFs net flow</p>
            </div>

            <div className="glass-card rounded-2xl border border-white/6 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase text-white/20">FII Index Futures</span>
                <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <p className={`text-xl font-mono font-bold ${getVolColor(fd.fiiIndexFuturesLatest)}`}>
                {formatVolume(fd.fiiIndexFuturesLatest)}
              </p>
              <p className="text-[9px] font-sans text-white/30 mt-1">Nifty/Bank Nifty futures net activity</p>
            </div>

            <div className="glass-card rounded-2xl border border-white/6 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase text-white/20">FII Stock Futures</span>
                <ArrowLeftRight className="w-3.5 h-3.5 text-yellow-400" />
              </div>
              <p className={`text-xl font-mono font-bold ${getVolColor(fd.fiiStockFuturesLatest)}`}>
                {formatVolume(fd.fiiStockFuturesLatest)}
              </p>
              <p className="text-[9px] font-sans text-white/30 mt-1">Individual stock futures net activity</p>
            </div>
          </div>

          {/* Historical Flows Bar Chart Representation */}
          <div className="glass-card rounded-2xl border border-white/6 p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" /> FII vs DII Cash Activity (Recent Trends)
            </h3>
            <div className="flex flex-col space-y-4">
              {fd.history.slice(0, 7).map(item => {
                const maxVol = Math.max(...fd.history.map(x => Math.max(Math.abs(x.fiiCash), Math.abs(x.diiCash))));
                const fiiPct = Math.min((Math.abs(item.fiiCash) / maxVol) * 100, 100);
                const diiPct = Math.min((Math.abs(item.diiCash) / maxVol) * 100, 100);

                return (
                  <div key={item.date} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl bg-white/2 border border-white/5">
                    <div className="w-24 text-xs font-mono font-bold text-white/50">{item.date}</div>
                    
                    <div className="flex-1 space-y-1.5">
                      {/* FII Bar */}
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-mono text-white/35 w-8">FII</span>
                        <div className="flex-1 h-3.5 bg-white/2 rounded overflow-hidden relative flex items-center">
                          <div
                            className={`h-full transition-all ${item.fiiCash >= 0 ? "bg-emerald-500/30" : "bg-red-500/30"}`}
                            style={{ width: `${fiiPct}%` }}
                          />
                          <span className={`absolute left-2 text-[9px] font-mono font-bold ${getVolColor(item.fiiCash)}`}>
                            {formatVolume(item.fiiCash)}
                          </span>
                        </div>
                      </div>
                      
                      {/* DII Bar */}
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-mono text-white/35 w-8">DII</span>
                        <div className="flex-1 h-3.5 bg-white/2 rounded overflow-hidden relative flex items-center">
                          <div
                            className={`h-full transition-all ${item.diiCash >= 0 ? "bg-emerald-500/30" : "bg-red-500/30"}`}
                            style={{ width: `${diiPct}%` }}
                          />
                          <span className={`absolute left-2 text-[9px] font-mono font-bold ${getVolColor(item.diiCash)}`}>
                            {formatVolume(item.diiCash)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabular Flow History */}
          <div className="glass-card rounded-2xl border border-white/6 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 bg-white/2 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-white">Daily Flow History (Cr)</h3>
              <span className="text-[10px] font-mono text-white/20">All values in INR Crores</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] font-mono text-white/30 uppercase bg-white/1">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">FII Cash Net</th>
                    <th className="py-3 px-4 text-right">DII Cash Net</th>
                    <th className="py-3 px-4 text-right">FII Index Fut</th>
                    <th className="py-3 px-4 text-right">FII Stock Fut</th>
                    <th className="py-3 px-4 text-right">Net Flow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {fd.history.map(row => (
                    <tr key={row.date} className="hover:bg-white/2 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-white/60">{row.date}</td>
                      <td className={`py-3 px-4 font-mono text-xs text-right ${getVolColor(row.fiiCash)}`}>
                        {row.fiiCash > 0 ? "+" : ""}{row.fiiCash.toLocaleString("en-IN")}
                      </td>
                      <td className={`py-3 px-4 font-mono text-xs text-right ${getVolColor(row.diiCash)}`}>
                        {row.diiCash > 0 ? "+" : ""}{row.diiCash.toLocaleString("en-IN")}
                      </td>
                      <td className={`py-3 px-4 font-mono text-xs text-right ${getVolColor(row.fiiIndexFutures)}`}>
                        {row.fiiIndexFutures > 0 ? "+" : ""}{row.fiiIndexFutures.toLocaleString("en-IN")}
                      </td>
                      <td className={`py-3 px-4 font-mono text-xs text-right ${getVolColor(row.fiiStockFutures)}`}>
                        {row.fiiStockFutures > 0 ? "+" : ""}{row.fiiStockFutures.toLocaleString("en-IN")}
                      </td>
                      <td className={`py-3 px-4 font-mono text-xs text-right font-bold ${getVolColor(row.netCashFlow)}`}>
                        {row.netCashFlow > 0 ? "+" : ""}{row.netCashFlow.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-16 glass-card rounded-2xl border border-white/6">
          <Users className="w-12 h-12 mx-auto text-white/15 mb-3" />
          <h3 className="text-base font-semibold text-white/60 mb-1">FII / DII data loading…</h3>
          <p className="text-sm text-white/30">Refreshes dynamically with exchange publications</p>
        </div>
      )}
    </div>
  );
}
