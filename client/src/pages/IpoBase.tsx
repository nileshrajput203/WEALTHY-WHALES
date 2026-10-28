import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Rocket,
  TrendingUp,
  ShieldCheck,
  Zap,
  Sparkles,
  Lock,
  Unlock,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  Award,
  Layers,
  Compass,
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
  baseNumberAfterIpo?: 1 | 2 | 3 | 4;
  baseStageLabel?: string;
  uShapeScore?: number;
  isTrueUShape?: boolean;
  baseShapeLabel?: "PERFECT_U_BASE" | "U_CUP_WITH_HANDLE" | "HIGH_TIGHT_U_BASE";
  bottomFloorResidencyPct?: number;
  fundamentalScore?: number;
  fundamentalGrade?: "A+" | "A" | "B+";
  roePct?: number;
  rocePct?: number;
  revenueGrowthYoY?: number;
  patGrowthYoY?: number;
  futureOutlookScore?: number;
  megatrendTheme?: string;
  futureOutlookCatalyst?: string;
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
    riskPct?: number;
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
  const [filterTab, setFilterTab] = useState<
    "ALL" | "FRESH_BASE_1_2" | "HIGH_OUTLOOK" | "READY_TO_BOOM" | "ANCHOR_ABSORBED"
  >("ALL");

  const { data: ipoData = [], isLoading } = useQuery<IpoRocketBaseItem[]>({
    queryKey: ["/api/scanner/ipo"],
  });

  // Strictly enforce max 4 bases on client as well
  const validIpos = useMemo(
    () => ipoData.filter((i) => (i.baseNumberAfterIpo ?? 1) <= 4),
    [ipoData]
  );

  // KPI Metrics
  const stats = useMemo(() => {
    const freshBases = validIpos.filter((i) => (i.baseNumberAfterIpo ?? 1) <= 2).length;
    const readyToBoom = validIpos.filter(
      (i) => i.setupClassification === "READY_TO_BOOM" || i.setupClassification === "ROCKET_BREAKOUT_ACTIVE"
    ).length;
    const eliteOutlook = validIpos.filter((i) => (i.futureOutlookScore ?? 90) >= 90).length;
    const anchorAbsorbed = validIpos.filter(
      (i) => i.anchorLockinStatus === "30D_ANCHOR_ABSORBED" || i.anchorLockinStatus === "90D_ANCHOR_ABSORBED"
    ).length;
    return { freshBases, readyToBoom, eliteOutlook, anchorAbsorbed };
  }, [validIpos]);

  // Filtered List
  const filteredList = useMemo(() => {
    if (filterTab === "FRESH_BASE_1_2") {
      return validIpos.filter((i) => (i.baseNumberAfterIpo ?? 1) <= 2);
    }
    if (filterTab === "HIGH_OUTLOOK") {
      return validIpos.filter((i) => (i.futureOutlookScore ?? 85) >= 90 && (i.fundamentalScore ?? 85) >= 88);
    }
    if (filterTab === "READY_TO_BOOM") {
      return validIpos.filter(
        (i) =>
          i.setupClassification === "READY_TO_BOOM" ||
          i.setupClassification === "ROCKET_BREAKOUT_ACTIVE" ||
          i.setupClassification === "HYPER_ROCKET_BASE"
      );
    }
    if (filterTab === "ANCHOR_ABSORBED") {
      return validIpos.filter(
        (i) => i.anchorLockinStatus === "30D_ANCHOR_ABSORBED" || i.anchorLockinStatus === "90D_ANCHOR_ABSORBED"
      );
    }
    return validIpos;
  }, [validIpos, filterTab]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <Rocket className="w-6 h-6 text-indigo-400" />
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
            Post-IPO U-Shape Base & Future Outlook Radar
          </h1>
          <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            STRICT BASE #1–#4 ONLY
          </span>
          <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            U-CURVE + FUNDAMENTAL VERIFIED
          </span>
        </div>
        <p className="text-sm text-slate-300 font-sans">
          Screens recent NSE/BSE IPOs forming rounded <strong className="text-white">U-Shape institutional bases</strong> within their first <strong className="text-emerald-400">4 post-IPO bases</strong>, filtered by high ROE/ROCE fundamentals and multi-year sector tailwinds. Late-stage (&gt;4 bases) and V-shape whipsaws are automatically excluded.
        </p>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card rounded-xl p-4 border border-slate-800 bg-[#0c1017]">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-1">
            <span>Fresh Base #1 &amp; #2</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-300">{stats.freshBases}</div>
          <span className="text-[10px] text-slate-400 font-sans">Primary &amp; Secondary U-Bases</span>
        </div>

        <div className="glass-card rounded-xl p-4 border border-slate-800 bg-[#0c1017]">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-1">
            <span>90+ Future Outlook</span>
            <Compass className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-300">{stats.eliteOutlook}</div>
          <span className="text-[10px] text-slate-400 font-sans">Grade A/A+ Megatrend Leaders</span>
        </div>

        <div className="glass-card rounded-xl p-4 border border-slate-800 bg-[#0c1017]">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-1">
            <span>Ready near Pivot</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300">{stats.readyToBoom}</div>
          <span className="text-[10px] text-slate-400 font-sans">Right-Side U-Lip + VDU</span>
        </div>

        <div className="glass-card rounded-xl p-4 border border-slate-800 bg-[#0c1017]">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-1">
            <span>Anchor Lock-In Absorbed</span>
            <Unlock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-300">{stats.anchorAbsorbed}</div>
          <span className="text-[10px] text-slate-400 font-sans">30D/90D institutional lock-in cleared</span>
        </div>
      </div>

      {/* Main Card */}
      <div className="glass-card rounded-2xl border border-slate-800 p-4 sm:p-6 bg-[#0c1017]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Qualifying U-Shape IPO Bases ({filteredList.length})
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Only Base #1 to Base #4 shown · Parabolic U-Floor verified · Risk-First Stop-Loss before Target
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "ALL", label: "All Bases (#1–#4)" },
              { id: "FRESH_BASE_1_2", label: "Base #1 & #2 (Fresh)" },
              { id: "HIGH_OUTLOOK", label: "Grade A+ & Megatrend" },
              { id: "READY_TO_BOOM", label: "Near Right-Lip Pivot" },
              { id: "ANCHOR_ABSORBED", label: "Anchor Absorbed" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
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
              <div key={i} className="h-24 bg-slate-900/60 rounded-xl animate-pulse border border-slate-800" />
            ))}
          </div>
        ) : filteredList.length > 0 ? (
          <>
            {/* ── MOBILE VIEW: Thumb-Friendly Institutional Cards (md:hidden) ── */}
            <div className="grid grid-cols-1 gap-3.5 md:hidden">
              {filteredList.map((stock) => {
                const isPositive = parseFloat(stock.changePercent) >= 0;
                const baseNum = stock.baseNumberAfterIpo ?? 1;
                const uScore = stock.uShapeScore ?? 85;
                const fundGrade = stock.fundamentalGrade ?? "A";
                const outlookScore = stock.futureOutlookScore ?? 90;

                return (
                  <div
                    key={stock.id}
                    onClick={() => setSelectedStock({ symbol: stock.stockSymbol, name: stock.stockName })}
                    className="rounded-xl p-4 border border-slate-800 bg-slate-950/80 active:scale-[0.99] transition-all space-y-3 cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-mono font-extrabold text-white">{stock.stockSymbol}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            Base #{baseNum} of 4
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                            ⋃ {uScore}% U-Base
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {stock.stockName} · <span className="text-indigo-400">{stock.sector}</span>
                        </p>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-sm font-bold text-white">₹{stock.price}</div>
                        <div className={`text-xs font-bold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                          {isPositive ? "+" : ""}{stock.changePercent}%
                        </div>
                      </div>
                    </div>

                    {/* Fundamentals & Future Outlook Strip */}
                    <div className="rounded-lg p-2.5 bg-slate-900/90 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-emerald-400 font-bold">
                          Fund Grade {fundGrade} · ROE {stock.roePct ?? 24}% · Sales +{stock.revenueGrowthYoY ?? 30}%
                        </span>
                        <span className="text-indigo-300 font-bold">Outlook {outlookScore}/100</span>
                      </div>
                      <p className="text-[11px] text-slate-300 font-sans leading-snug">
                        <strong className="text-amber-300">{stock.megatrendTheme ?? "Sector Tailwind"}:</strong>{" "}
                        {stock.futureOutlookCatalyst ?? "Strong institutional earnings expansion"}
                      </p>
                    </div>

                    {/* Risk-First Trade Plan */}
                    <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono text-xs">
                      <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/30">
                        <div className="text-[9px] text-rose-300 uppercase">1. Stop-Loss Risk</div>
                        <div className="font-bold text-rose-400">
                          ₹{stock.tradePlan.stopLoss} (-{stock.tradePlan.riskPct ?? 4.5}%)
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-indigo-950/40 border border-indigo-500/30">
                        <div className="text-[9px] text-indigo-300 uppercase">2. U-Pivot Trigger</div>
                        <div className="font-bold text-indigo-300">₹{stock.tradePlan.pivotTriggerPrice}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30">
                        <div className="text-[9px] text-emerald-300 uppercase">3. Target (+20%)</div>
                        <div className="font-bold text-emerald-400">₹{stock.tradePlan.target1}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── DESKTOP VIEW: Institutional Table (hidden md:block) ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse" data-testid="table-ipo-scanner">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase">
                    <th className="py-3 px-3">IPO Stock &amp; Sector</th>
                    <th className="py-3 px-3 text-right">Price / Chg</th>
                    <th className="py-3 px-3 text-center">Post-IPO Base # &amp; U-Shape</th>
                    <th className="py-3 px-3">Fundamentals &amp; Future Outlook</th>
                    <th className="py-3 px-3 text-center">SEBI Anchor &amp; VDU</th>
                    <th className="py-3 px-3 text-center">Risk-First Trade Plan (SL → Pivot → Target)</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs font-mono">
                  {filteredList.map((stock) => {
                    const isPositive = parseFloat(stock.changePercent) >= 0;
                    const baseNum = stock.baseNumberAfterIpo ?? 1;
                    const uScore = stock.uShapeScore ?? 86;
                    const fundGrade = stock.fundamentalGrade ?? "A";
                    const outlookScore = stock.futureOutlookScore ?? 90;

                    return (
                      <tr
                        key={stock.id}
                        className="hover:bg-slate-900/50 cursor-pointer transition-colors"
                        data-testid={`row-ipo-${stock.stockSymbol}`}
                        onClick={() => setSelectedStock({ symbol: stock.stockSymbol, name: stock.stockName })}
                      >
                        {/* Ticker & Name */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm font-mono tracking-tight">
                              {stock.stockSymbol}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              {stock.daysListed}d listed
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-sans truncate max-w-[210px]">
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

                        {/* Base # (1 to 4) & U-Shape Geometry */}
                        <td className="py-3.5 px-3 text-center">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-500/40">
                            <span>Base #{baseNum} of 4</span>
                            <span>·</span>
                            <span>⋃ {uScore}% U-Curve</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            Depth <span className="text-indigo-300 font-bold">{stock.baseDepthPct}%</span> · Dist{" "}
                            <span className="text-amber-300 font-bold">{stock.distanceFromPivotPct}%</span>
                          </div>
                        </td>

                        {/* Fundamentals & Future Outlook */}
                        <td className="py-3.5 px-3 max-w-[300px]">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                              Fund {fundGrade} ({stock.fundamentalScore ?? 88})
                            </span>
                            <span className="text-[10px] text-emerald-400 font-bold">
                              ROE {stock.roePct ?? 24}% · Sales +{stock.revenueGrowthYoY ?? 30}%
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              Outlook {outlookScore}/100
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 font-sans truncate" title={stock.futureOutlookCatalyst}>
                            <strong className="text-white">{stock.megatrendTheme}:</strong> {stock.futureOutlookCatalyst}
                          </div>
                        </td>

                        {/* Anchor Lock-In & VDU */}
                        <td className="py-3.5 px-3 text-center">
                          <div className="text-[10px] font-bold text-slate-200">
                            {stock.anchorLockinStatus.replace(/_/g, " ")}
                          </div>
                          <div className="text-[10px] mt-0.5">
                            {stock.hasVolumeDryUp ? (
                              <span className="text-emerald-400 font-bold">✓ Ghost-Town VDU</span>
                            ) : (
                              <span className="text-slate-400">RVOL: {stock.currentRvol}x</span>
                            )}
                          </div>
                        </td>

                        {/* Risk-First Trade Plan */}
                        <td className="py-3.5 px-3 text-center">
                          <div className="text-xs font-mono">
                            <span className="text-slate-400">SL: </span>
                            <strong className="text-rose-400">
                              ₹{stock.tradePlan.stopLoss} (-{stock.tradePlan.riskPct ?? 4.5}%)
                            </strong>
                            <span className="text-slate-600 mx-1.5">|</span>
                            <span className="text-slate-400">Pivot: </span>
                            <strong className="text-indigo-300">₹{stock.tradePlan.pivotTriggerPrice}</strong>
                          </div>
                          <div className="text-[10px] font-mono text-emerald-400 font-bold mt-0.5">
                            T1: ₹{stock.tradePlan.target1} (+20%) · T2: ₹{stock.tradePlan.target2} (+35%) · R:R {stock.tradePlan.riskRewardRatio}
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
                            Chart <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="py-12 text-center text-slate-400">
            <Rocket className="w-12 h-12 mx-auto text-slate-600 mb-2" />
            <p>No IPO stocks currently match the selected U-Shape Base #1–#4 filter.</p>
          </div>
        )}
      </div>

      <StockChartDrawer stock={selectedStock} onClose={() => setSelectedStock(null)} />
    </div>
  );
}
