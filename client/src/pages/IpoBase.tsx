import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Rocket,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Target,
  Zap,
  Sparkles,
  Lock,
  Unlock,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  Filter,
} from "lucide-react";
import { StockChartDrawer, type StockDrawerPayload } from "@/components/StockChartDrawer";

interface IpoRocketBaseItem {
  id: string;
  scannerType: "ipo";
  stockSymbol: string;
  stockName: string;
  sector: string;
  exchange: "NSE";
  price: string;
  change: string;
  changePercent: string;
  volume: string;
  marketCap: string;
  daysListed: number;
  setupClassification: "HYPER_ROCKET_BASE" | "READY_TO_BOOM" | "ROCKET_BREAKOUT_ACTIVE" | "INSTITUTIONAL_VCP" | "FORMING_BASE";
  anchorLockinStatus: "30D_ANCHOR_ABSORBED" | "90D_ANCHOR_ABSORBED" | "30D_WINDOW_ACTIVE" | "90D_WINDOW_ACTIVE" | "PRE_30D_LOCKIN" | "SUPPLY_OVERHANG";
  rocketScore: number;
  baseDepthPct: number;
  distanceFromPivotPct: number;
  hasVolumeDryUp: boolean;
  currentRvol: number;
  tradePlan: {
    pivotTriggerPrice: number;
    postListingHigh: number;
    stopLoss: number;
    target1: number;
    target2: number;
    riskRewardRatio: string;
  };
  totalGainSinceListingPct: number;
  newsScore: number;
  genomeVersion: number;
  createdAt: string;
}

export default function IpoBase() {
  const [selectedStock, setSelectedStock] = useState<StockDrawerPayload | null>(null);
  const [filterTab, setFilterTab] = useState<"ALL" | "READY_TO_BOOM" | "HYPER_ROCKET" | "BREAKOUT" | "ANCHOR_ABSORBED">("ALL");

  const { data: ipoData = [], isLoading } = useQuery<IpoRocketBaseItem[]>({
    queryKey: ["/api/scanner/ipo"],
  });

  // KPI Metrics
  const stats = useMemo(() => {
    const hyperRocket = ipoData.filter((i) => i.setupClassification === "HYPER_ROCKET_BASE").length;
    const readyToBoom = ipoData.filter((i) => i.setupClassification === "READY_TO_BOOM").length;
    const breakoutActive = ipoData.filter((i) => i.setupClassification === "ROCKET_BREAKOUT_ACTIVE").length;
    const anchorAbsorbed = ipoData.filter((i) => i.anchorLockinStatus === "30D_ANCHOR_ABSORBED" || i.anchorLockinStatus === "90D_ANCHOR_ABSORBED").length;
    return { hyperRocket, readyToBoom, breakoutActive, anchorAbsorbed };
  }, [ipoData]);

  // Filtered List
  const filteredList = useMemo(() => {
    if (filterTab === "READY_TO_BOOM") {
      return ipoData.filter((i) => i.setupClassification === "READY_TO_BOOM");
    }
    if (filterTab === "HYPER_ROCKET") {
      return ipoData.filter((i) => i.setupClassification === "HYPER_ROCKET_BASE");
    }
    if (filterTab === "BREAKOUT") {
      return ipoData.filter((i) => i.setupClassification === "ROCKET_BREAKOUT_ACTIVE");
    }
    if (filterTab === "ANCHOR_ABSORBED") {
      return ipoData.filter((i) => i.anchorLockinStatus === "30D_ANCHOR_ABSORBED" || i.anchorLockinStatus === "90D_ANCHOR_ABSORBED");
    }
    return ipoData;
  }, [ipoData, filterTab]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Rocket className="w-6 h-6 text-indigo-400" />
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
            Indian IPO Rocket Base & Anchor Supply Radar
          </h1>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            SEBI ANCHOR UNLOCK FORENSICS
          </span>
        </div>
        <p className="text-sm text-slate-300 font-sans">
          Institutional primary base scanner for NSE/BSE listings under 24 months. Tracks tight consolidations near All-Time Highs and institutional lock-in absorption.
        </p>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card rounded-xl p-4 border border-slate-800 bg-[#0c1017]">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-1">
            <span>Ready to Boom</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300">{stats.readyToBoom}</div>
          <span className="text-[10px] text-slate-400 font-sans">&lt;3.5% from Pivot High with VDU</span>
        </div>

        <div className="glass-card rounded-xl p-4 border border-slate-800 bg-[#0c1017]">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-1">
            <span>Hyper Rocket Bases</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-300">{stats.hyperRocket}</div>
          <span className="text-[10px] text-slate-400 font-sans">Base Depth &le; 18% (Power Plays)</span>
        </div>

        <div className="glass-card rounded-xl p-4 border border-slate-800 bg-[#0c1017]">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-1">
            <span>Anchor Lock-In Absorbed</span>
            <Unlock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-300">{stats.anchorAbsorbed}</div>
          <span className="text-[10px] text-slate-400 font-sans">30D/90D selling fully absorbed</span>
        </div>

        <div className="glass-card rounded-xl p-4 border border-slate-800 bg-[#0c1017]">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-1">
            <span>Breakouts Active</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{stats.breakoutActive}</div>
          <span className="text-[10px] text-slate-400 font-sans">Volume &ge; 2.0x 20D SMA</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="glass-card rounded-2xl border border-slate-800 p-6 bg-[#0c1017]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              IPO Rocket Base Candidates ({filteredList.length})
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Consolidations &lt; 22% depth · Minimal overhead supply · Measured targets (+20% / +35%)
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "ALL", label: "All IPO Bases" },
              { id: "READY_TO_BOOM", label: "Ready to Boom" },
              { id: "HYPER_ROCKET", label: "Hyper Rocket" },
              { id: "BREAKOUT", label: "Confirmed Breakout" },
              { id: "ANCHOR_ABSORBED", label: "Anchor Absorbed" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                  filterTab === tab.id
                    ? "bg-indigo-600 text-white border-indigo-400 font-black shadow-md shadow-indigo-600/30"
                    : "bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-900/60 rounded-xl animate-pulse border border-slate-800" />
            ))}
          </div>
        ) : filteredList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" data-testid="table-ipo-scanner">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase">
                  <th className="py-3 px-3">Ticker / Company</th>
                  <th className="py-3 px-3 text-right">Price / Chg</th>
                  <th className="py-3 px-3 text-center">Setup / Score</th>
                  <th className="py-3 px-3 text-center">SEBI Anchor Lock-in</th>
                  <th className="py-3 px-3 text-center">Base Geometry</th>
                  <th className="py-3 px-3 text-center">Trade Targets (+20%/+35%)</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs font-mono">
                {filteredList.map((stock) => {
                  const isPositive = parseFloat(stock.changePercent) >= 0;

                  // Anchor badge
                  let anchorBadge = (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-slate-900 text-slate-400 border border-slate-800">
                      Pre-Unlock
                    </span>
                  );
                  if (stock.anchorLockinStatus === "30D_ANCHOR_ABSORBED" || stock.anchorLockinStatus === "90D_ANCHOR_ABSORBED") {
                    anchorBadge = (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 shadow-xs inline-flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        {stock.anchorLockinStatus === "30D_ANCHOR_ABSORBED" ? "30D Absorbed" : "90D Absorbed"}
                      </span>
                    );
                  } else if (stock.anchorLockinStatus === "30D_WINDOW_ACTIVE" || stock.anchorLockinStatus === "90D_WINDOW_ACTIVE") {
                    anchorBadge = (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-amber-950/90 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                        <Lock className="w-3 h-3 text-amber-400" />
                        {stock.anchorLockinStatus === "30D_WINDOW_ACTIVE" ? "30D Window Active" : "90D Window Active"}
                      </span>
                    );
                  } else if (stock.anchorLockinStatus === "SUPPLY_OVERHANG") {
                    anchorBadge = (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-rose-950/80 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        Supply Overhang
                      </span>
                    );
                  }

                  // Classification badge
                  let setupBadge = (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-slate-900 text-slate-300 border border-slate-700">
                      Forming Base
                    </span>
                  );
                  if (stock.setupClassification === "ROCKET_BREAKOUT_ACTIVE") {
                    setupBadge = (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-emerald-950/90 text-emerald-200 border border-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.25)]">
                        🚀 Rocket Breakout
                      </span>
                    );
                  } else if (stock.setupClassification === "READY_TO_BOOM") {
                    setupBadge = (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-amber-950/90 text-amber-200 border border-amber-500/50 shadow-xs">
                        ⚡ Ready to Boom
                      </span>
                    );
                  } else if (stock.setupClassification === "HYPER_ROCKET_BASE") {
                    setupBadge = (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-indigo-950/90 text-indigo-200 border border-indigo-500/50 shadow-xs">
                        🔥 Hyper Rocket Base
                      </span>
                    );
                  } else if (stock.setupClassification === "INSTITUTIONAL_VCP") {
                    setupBadge = (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-cyan-950/90 text-cyan-200 border border-cyan-500/40">
                        Institutional VCP
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={stock.id}
                      className="hover:bg-slate-900/40 cursor-pointer transition-colors"
                      data-testid={`row-ipo-${stock.stockSymbol}`}
                      onClick={() => setSelectedStock({ symbol: stock.stockSymbol, name: stock.stockName })}
                    >
                      {/* Ticker & Name */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm font-mono tracking-tight">
                            {stock.stockSymbol}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                            N={stock.daysListed}d
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-sans truncate max-w-xs">
                          {stock.stockName} · <span className="text-indigo-400">{stock.sector}</span>
                        </div>
                      </td>

                      {/* Price & Change */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="font-bold text-white font-mono">₹{stock.price}</div>
                        <div className={`text-[10px] font-mono ${isPositive ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}`}>
                          {isPositive ? "+" : ""}{stock.changePercent}%
                        </div>
                      </td>

                      {/* Setup & Score */}
                      <td className="py-3.5 px-3 text-center">
                        <div>{setupBadge}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-1">
                          Rocket Score: <strong className="text-white font-black">{stock.rocketScore}/100</strong>
                        </div>
                      </td>

                      {/* Anchor Lock-In */}
                      <td className="py-3.5 px-3 text-center">
                        <div>{anchorBadge}</div>
                        <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                          Listing Gain: {stock.totalGainSinceListingPct >= 0 ? "+" : ""}{stock.totalGainSinceListingPct}%
                        </div>
                      </td>

                      {/* Base Geometry */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="text-xs font-mono font-bold text-slate-200">
                          Depth: <span className="text-indigo-300">{stock.baseDepthPct}%</span> · Dist: <span className="text-amber-300">{stock.distanceFromPivotPct}%</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          {stock.hasVolumeDryUp ? (
                            <span className="text-emerald-400 font-bold">✓ Volume Dry-Up (VDU)</span>
                          ) : (
                            <span>RVOL: {stock.currentRvol}x</span>
                          )}
                        </div>
                      </td>

                      {/* Trade Targets */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="text-xs font-mono">
                          <span className="text-slate-400">Buy: </span>
                          <strong className="text-indigo-300">₹{stock.tradePlan.pivotTriggerPrice}</strong>
                          <span className="text-slate-500 mx-1">|</span>
                          <span className="text-slate-400">SL: </span>
                          <strong className="text-rose-400">₹{stock.tradePlan.stopLoss}</strong>
                        </div>
                        <div className="text-[10px] font-mono text-emerald-400 font-bold mt-0.5">
                          T1: ₹{stock.tradePlan.target1} (+20%) · T2: ₹{stock.tradePlan.target2} (+35%)
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStock({ symbol: stock.stockSymbol, name: stock.stockName });
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold font-mono bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 transition-all inline-flex items-center gap-1 shadow-xs"
                        >
                          View Setup <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400">
            <Rocket className="w-12 h-12 mx-auto text-slate-600 mb-2" />
            <p>No stocks currently match the selected IPO Rocket Base filter.</p>
          </div>
        )}
      </div>

      {/* Slide-out Chart Drawer */}
      <StockChartDrawer
        stock={selectedStock}
        onClose={() => setSelectedStock(null)}
      />
    </div>
  );
}
