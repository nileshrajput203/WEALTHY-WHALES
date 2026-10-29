import { useQuery } from "@tanstack/react-query";
import {
  Scan, TrendingUp, TrendingDown, ArrowUpDown, Activity, Sparkles,
  Landmark, Info, ShieldAlert, AlertTriangle, ArrowRightLeft,
  Percent, Globe, Coins, CalendarDays, BarChart3, HelpCircle, Check,
  Loader2, RefreshCw
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";

interface SectorData {
  name: string;
  symbol: string;
  change1d: number;
  change1w: number;
  change1m: number;
  rsRatio?: number;
  rsMomentum?: number;
  rrgQuadrant?: "LEADING" | "IMPROVING" | "WEAKENING" | "LAGGING";
  institutionalAction?: string;
  topGainer: { symbol: string; change: number };
  topLoser: { symbol: string; change: number };
}

interface MacroOverview {
  economicCycleStage: string;
  recessionProbability: string;
  interestRateCycle: { currentRate: string; outlook: string; impact: string };
  inflationTrend: { currentCPI: string; outlook: string; impact: string };
  gdpGrowth: { forecast: string; outlook: string; impact: string };
  rupeeTrajectory: { current: string; impact: string };
  fiiDiiFlows: { fiiYTD: string; diiYTD: string; impact: string };
}

interface SectorAnalysis {
  name: string;
  indexSymbol: string;
  cyclePosition: string;
  score: number;
  status: string;
  why: string;
  momentum3M: string;
  pe: number;
  pe5Y: number;
  peNifty: number;
  valuationStatus: string;
  earningGrowthFY25: string;
  earningGrowthFY26: string;
  earningsTrend: string;
  keyRisks: { risk: string; severity: string; probability: string }[];
  tacticalPlaybook: string;
}

interface PortfolioAllocation {
  tactical3_6M: { sector: string; weight: number }[];
  medium6_12M: { sector: string; weight: number }[];
  strategic12_24M: { sector: string; weight: number }[];
}

interface RotationTimeline {
  phase: string;
  action: string;
}

interface RotationAnalysisResponse {
  macroOverview: MacroOverview;
  sectors: SectorAnalysis[];
  portfolioAllocation: PortfolioAllocation;
  rotationPlaybook: {
    now: string;
    next: string;
    timeline: RotationTimeline[];
  };
}

const DEFAULT_MACRO_OVERVIEW: MacroOverview = {
  economicCycleStage: "Mid-to-Late Cycle (3-4 years into recovery)",
  recessionProbability: "25% (moderate, not imminent)",
  interestRateCycle: {
    currentRate: "6.50% (RBI Repo Rate)",
    outlook: "Peak cycle reached; rate cuts expected from Q3-Q4 (-50 bps by year-end)",
    impact: "Lower rates will drive valuation expansion for Realty, Auto, and Infrastructure while putting minor pressure on Bank margins."
  },
  inflationTrend: {
    currentCPI: "5.4% (Upper bound of RBI comfort zone)",
    outlook: "Expected to moderate to 4.5% by year-end",
    impact: "FMCG margins will recover due to cheaper raw materials, but pricing power decreases."
  },
  gdpGrowth: {
    forecast: "6.5% - 7.0% for FY25",
    outlook: "Gradual moderation toward structural 6.2% trend",
    impact: "Favors secular defensives (Pharma) and government Capex (Infrastructure) over discretionary spending."
  },
  rupeeTrajectory: {
    current: "₹84.5 vs USD (depreciating)",
    impact: "Direct tailwind for IT exports and Pharma; headwinds for Auto parts and Airlines import costs."
  },
  fiiDiiFlows: {
    fiiYTD: "+₹150 Cr (Cautious accumulation)",
    diiYTD: "+₹300 Cr (Ample domestic retail inflows)",
    impact: "Supports large-caps, but mid-caps face valuation correction pressures."
  }
};

const DEFAULT_PORTFOLIO_ALLOCATION: PortfolioAllocation = {
  tactical3_6M: [
    { sector: "Banking", weight: 25 },
    { sector: "Infrastructure", weight: 20 },
    { sector: "Pharma", weight: 15 },
    { sector: "FMCG", weight: 10 },
    { sector: "IT", weight: 8 },
    { sector: "Auto", weight: 5 },
    { sector: "Real Estate", weight: 2 },
    { sector: "Cash/Bonds", weight: 15 }
  ],
  medium6_12M: [
    { sector: "Banking", weight: 20 },
    { sector: "Infrastructure", weight: 18 },
    { sector: "Pharma", weight: 18 },
    { sector: "FMCG", weight: 15 },
    { sector: "IT", weight: 12 },
    { sector: "Auto", weight: 5 },
    { sector: "Real Estate", weight: 5 },
    { sector: "Other", weight: 7 }
  ],
  strategic12_24M: [
    { sector: "Infrastructure", weight: 22 },
    { sector: "Pharma", weight: 20 },
    { sector: "Banking", weight: 18 },
    { sector: "FMCG", weight: 15 },
    { sector: "Auto", weight: 12 },
    { sector: "IT", weight: 10 },
    { sector: "Real Estate", weight: 3 }
  ]
};

const DEFAULT_PLAYBOOK = {
  now: "Capital is rotating OUT of high-valuation cyclicals like Auto and Real Estate, and moving INTO large-cap banks, infrastructure, and defensive Pharma.",
  next: "Once the RBI signals a clear timeline for rate cuts, money will cycle back into premium real estate and passenger auto stocks.",
  timeline: [
    { phase: "Now (Q2-Q3 2026)", action: "Maintain high allocation in Banking and Infrastructure. Buy Pharma on market dips." },
    { phase: "Late 2026", action: "Begin gradual accumulation of FMCG and IT as cost pressures moderate." },
    { phase: "Early 2027", action: "Rotate tactically from Banks into Auto and Real Estate to ride the post-rate-cut credit acceleration." }
  ]
};

const DEFAULT_SECTOR_ROTATIONS: SectorAnalysis[] = [
  {
    name: "Nifty Bank",
    indexSymbol: "^NSEBANK",
    cyclePosition: "Growth (Recovery/Early Expansion)",
    score: 5,
    status: "STRONG BUY",
    why: "Robust credit growth, steady net interest margins, and clean asset quality with multi-year low NPAs.",
    momentum3M: "↑↑↑ ACCELERATING",
    pe: 15.2,
    pe5Y: 14.8,
    peNifty: 19.5,
    valuationStatus: "FAIR",
    earningGrowthFY25: "+18-20%",
    earningGrowthFY26: "+15-18%",
    earningsTrend: "STRONG",
    keyRisks: [
      { risk: "NPA spike if macro growth slows", severity: "Medium", probability: "30%" },
      { risk: "Deposit cost competition across banks", severity: "Medium", probability: "25%" }
    ],
    tacticalPlaybook: "Accumulate on pullbacks. Prioritize tier-1 private & public lenders with low loan-to-deposit ratios."
  },
  {
    name: "Nifty Infrastructure",
    indexSymbol: "^CNXINFRA",
    cyclePosition: "Growth (Recovery/Early Expansion)",
    score: 4,
    status: "BUY",
    why: "Government capex outlays, production-linked incentive execution, and robust order book visibility.",
    momentum3M: "↑ STEADY",
    pe: 18.3,
    pe5Y: 16.5,
    peNifty: 19.5,
    valuationStatus: "FAIR",
    earningGrowthFY25: "+22-25%",
    earningGrowthFY26: "+20-22%",
    earningsTrend: "STRONG",
    keyRisks: [
      { risk: "Execution and statutory clearance bottlenecks", severity: "High", probability: "25%" },
      { risk: "Debt refinancing cost sensitivity", severity: "Medium", probability: "30%" }
    ],
    tacticalPlaybook: "Accrue leading construction and power transmission pure-plays on dips."
  },
  {
    name: "Nifty IT",
    indexSymbol: "^CNXIT",
    cyclePosition: "Mid-cycle (Slowing Expansion)",
    score: 3,
    status: "HOLD",
    why: "Discretionary tech spend cautiousness in US/EU balanced by secular cloud and AI deal ramp-ups.",
    momentum3M: "↓ DECELERATING",
    pe: 21.8,
    pe5Y: 23.5,
    peNifty: 19.5,
    valuationStatus: "EXPENSIVE",
    earningGrowthFY25: "+8-10%",
    earningGrowthFY26: "+10-12%",
    earningsTrend: "WEAK",
    keyRisks: [
      { risk: "AI deflation in traditional IT support contracts", severity: "High", probability: "35%" },
      { risk: "Global corporate discretionary IT capex freeze", severity: "High", probability: "40%" }
    ],
    tacticalPlaybook: "Avoid aggressive lump-sum entries. Rupee tailwinds provide downside support; enter after 10-15% margin consolidation."
  },
  {
    name: "Nifty Energy",
    indexSymbol: "^CNXENERGY",
    cyclePosition: "Mid-cycle (Slowing Expansion)",
    score: 3,
    status: "HOLD",
    why: "Resilient domestic electricity demand and steady gross refining margins, though capped by commodity swings.",
    momentum3M: "↑ STEADY",
    pe: 15.6,
    pe5Y: 14.8,
    peNifty: 19.5,
    valuationStatus: "FAIR",
    earningGrowthFY25: "+12-14%",
    earningGrowthFY26: "+14-16%",
    earningsTrend: "STEADY",
    keyRisks: [
      { risk: "Global crude volatility and export tax adjustments", severity: "Medium", probability: "30%" },
      { risk: "Geopolitical supply chain disruptions", severity: "High", probability: "35%" }
    ],
    tacticalPlaybook: "Hold existing exposures for strong dividend yields and hedge value against currency depreciation."
  },
  {
    name: "Nifty Metal",
    indexSymbol: "^CNXMETAL",
    cyclePosition: "Mid-cycle (Slowing Expansion)",
    score: 3,
    status: "HOLD",
    why: "Global commodity prices consolidating with Chinese stimulus policies; domestic infrastructure demand solid.",
    momentum3M: "↓ DECELERATING",
    pe: 16.4,
    pe5Y: 15.5,
    peNifty: 19.5,
    valuationStatus: "FAIR",
    earningGrowthFY25: "+10-12%",
    earningGrowthFY26: "+12-14%",
    earningsTrend: "STEADY",
    keyRisks: [
      { risk: "Cheap Chinese steel dumping in Asian markets", severity: "High", probability: "40%" },
      { risk: "Coking coal and energy input price inflation", severity: "Medium", probability: "30%" }
    ],
    tacticalPlaybook: "Strictly swing-trade low-cost integrated miners; avoid debt-heavy downstream converters."
  },
  {
    name: "Nifty Auto",
    indexSymbol: "^CNXAUTO",
    cyclePosition: "Late-cycle (Peak Expansion)",
    score: 2,
    status: "AVOID",
    why: "Post-pandemic replacement cycle maturity, rising dealer inventory channel days, and price discounting.",
    momentum3M: "↓↓ SHARPLY DECELERATING",
    pe: 14.5,
    pe5Y: 16.2,
    peNifty: 19.5,
    valuationStatus: "CHEAP",
    earningGrowthFY25: "+8-12%",
    earningGrowthFY26: "+12-15%",
    earningsTrend: "SLOWING",
    keyRisks: [
      { risk: "Higher retail inventory overhang exceeding 50 days", severity: "High", probability: "45%" },
      { risk: "EV transition capex squeezing near-term ROCE", severity: "Medium", probability: "35%" }
    ],
    tacticalPlaybook: "Take profits on rallies. Rotate capital into defensives or banking until channel inventory normalizes."
  },
  {
    name: "Nifty Realty",
    indexSymbol: "^CNXREALTY",
    cyclePosition: "Late-cycle (Peak Expansion)",
    score: 2,
    status: "AVOID",
    why: "Multi-year price run-up stretching affordability metrics; new project launches outpacing absorption velocity.",
    momentum3M: "↓ DECELERATING",
    pe: 11.8,
    pe5Y: 13.5,
    peNifty: 19.5,
    valuationStatus: "CHEAP",
    earningGrowthFY25: "+15-18%",
    earningGrowthFY26: "+18-20%",
    earningsTrend: "SLOWING",
    keyRisks: [
      { risk: "Unsold luxury residential units in Tier-1 cities", severity: "High", probability: "35%" },
      { risk: "High land acquisition premiums eroding net margins", severity: "Medium", probability: "30%" }
    ],
    tacticalPlaybook: "Trim speculative holdings; re-enter only when rate reduction cycles provide fresh retail mortgage tailwinds."
  },
  {
    name: "Nifty Pharma",
    indexSymbol: "^CNXPHARMA",
    cyclePosition: "Recession (Defensive)",
    score: 4,
    status: "BUY",
    why: "Pricing stability in US generics, domestic chronic formulation volume growth, and non-cyclical cash flow cushion.",
    momentum3M: "↑ STEADY",
    pe: 23.5,
    pe5Y: 25.0,
    peNifty: 19.5,
    valuationStatus: "FAIR",
    earningGrowthFY25: "+13-15%",
    earningGrowthFY26: "+15-18%",
    earningsTrend: "STEADY",
    keyRisks: [
      { risk: "US FDA warning letters or import alerts on key facilities", severity: "High", probability: "20%" },
      { risk: "Domestic NLEM price revision expansions", severity: "Medium", probability: "35%" }
    ],
    tacticalPlaybook: "Accumulate steadily during broader market turbulence to preserve portfolio alpha and gain currency hedge."
  },
  {
    name: "Nifty FMCG",
    indexSymbol: "^CNXFMCG",
    cyclePosition: "Recession (Defensive)",
    score: 4,
    status: "BUY",
    why: "Rural consumption bottoming out, easing input raw material inflation, and consistent dividend yield anchor.",
    momentum3M: "↑ STEADY",
    pe: 45.2,
    pe5Y: 42.8,
    peNifty: 19.5,
    valuationStatus: "VERY EXPENSIVE",
    earningGrowthFY25: "+6-8%",
    earningGrowthFY26: "+8-10%",
    earningsTrend: "STEADY",
    keyRisks: [
      { risk: "Uneven monsoon or food inflation curbing rural disposable income", severity: "High", probability: "35%" },
      { risk: "Direct-to-consumer and unorganized regional brand competition", severity: "Medium", probability: "30%" }
    ],
    tacticalPlaybook: "Deploy capital for downside protection in defensive market phases. Focus on names with pricing moat."
  }
];

function matchCycleStage(sectorPos: string | undefined, stageKey: string): boolean {
  if (!sectorPos) return false;
  const pos = sectorPos.toLowerCase().trim();
  const key = stageKey.toLowerCase().trim();
  if (pos === key) return true;
  if (key.includes("growth") || key.includes("recovery")) {
    return pos.includes("growth") || pos.includes("recovery") || pos.includes("early");
  }
  if (key.includes("mid")) {
    return pos.includes("mid");
  }
  if (key.includes("late")) {
    return pos.includes("late") || pos.includes("peak");
  }
  if (key.includes("recession") || key.includes("defensive")) {
    return pos.includes("recession") || pos.includes("defensive") || pos.includes("trough");
  }
  return false;
}

export default function SectorScope() {
  const [activeTab, setActiveTab] = useState<"rrg" | "cycle" | "macro" | "valuations">("rrg");
  const [timeframe, setTimeframe] = useState<"1d" | "1w" | "1m">("1d");

  // Query 1: Heatmap performance
  const { data: perfData, isLoading: isPerfLoading, refetch: refetchPerf } = useQuery<{ sectors: SectorData[] }>({
    queryKey: ["/api/sector-performance"],
    staleTime: 5 * 60 * 1000,
  });

  // Query 2: Deep Sector Rotation analysis
  const {
    data: analysisData,
    isLoading: isAnalysisLoading,
    isFetching: isAnalysisFetching,
    refetch: refetchAnalysis,
  } = useQuery<RotationAnalysisResponse>({
    queryKey: ["/api/sector-rotation-analysis"],
    staleTime: 10 * 60 * 1000,
  });

  const activeSectors: SectorAnalysis[] =
    analysisData?.sectors && analysisData.sectors.length > 0
      ? analysisData.sectors
      : DEFAULT_SECTOR_ROTATIONS;

  const macroOverview = analysisData?.macroOverview || DEFAULT_MACRO_OVERVIEW;
  const portfolioAllocation = analysisData?.portfolioAllocation || DEFAULT_PORTFOLIO_ALLOCATION;
  const rotationPlaybook = analysisData?.rotationPlaybook || DEFAULT_PLAYBOOK;

  const sectors = perfData?.sectors ?? [];
  const sortedSectors = [...sectors].sort((a, b) => {
    const key = timeframe === "1d" ? "change1d" : timeframe === "1w" ? "change1w" : "change1m";
    return b[key] - a[key];
  });

  const getChange = (s: SectorData) =>
    timeframe === "1d" ? s.change1d : timeframe === "1w" ? s.change1w : s.change1m;

  const maxAbsChange = Math.max(...sortedSectors.map(s => Math.abs(getChange(s))), 1);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "STRONG BUY": return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
      case "BUY": return "text-emerald-300 border-emerald-500/20 bg-emerald-500/5";
      case "HOLD": return "text-amber-400 border-amber-500/20 bg-amber-500/5";
      case "SELL / TRIM": return "text-orange-400 border-orange-500/20 bg-orange-500/5";
      case "AVOID": return "text-red-400 border-red-500/30 bg-red-500/10";
      default: return "text-zinc-400 border-zinc-500/20 bg-zinc-500/5";
    }
  };

  const getValStatusColor = (status: string) => {
    switch (status) {
      case "CHEAP": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "FAIR": return "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
      case "EXPENSIVE": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "VERY EXPENSIVE": return "text-red-400 bg-red-500/10 border-red-500/20";
      default: return "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
    }
  };

  const ALLOCATION_COLORS = ["#a855f7", "#3b82f6", "#22c55e", "#eab308", "#f43f5e", "#06b6d4", "#f97316", "#a1a1aa"];

  // Group sectors into RRG quadrants
  const leadingSectors = sectors.filter(s => (s.rrgQuadrant || "LEADING") === "LEADING");
  const improvingSectors = sectors.filter(s => s.rrgQuadrant === "IMPROVING");
  const weakeningSectors = sectors.filter(s => s.rrgQuadrant === "WEAKENING");
  const laggingSectors = sectors.filter(s => s.rrgQuadrant === "LAGGING");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1 flex items-center gap-2.5">
            <Scan className="w-7 h-7 text-primary" />
            Sector Rotation & RRG Dashboard
          </h1>
          <p className="text-sm text-white/50 font-sans">
            Institutional JdK Relative Rotation Graph (RRG) · 4-Quadrant Macro Momentum vs Nifty 50
          </p>
        </div>

        {/* Tab buttons */}
        <div className="flex gap-1 bg-white/4 border border-white/8 p-1 rounded-xl self-start sm:self-auto overflow-x-auto scrollbar-none">
          {[
            { key: "rrg", label: "4-Quadrant RRG Model" },
            { key: "cycle", label: "Cycle & Heatmap" },
            { key: "macro", label: "Macro & Playbook" },
            { key: "valuations", label: "Valuations & Earnings" }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap
                ${activeTab === t.key
                  ? "bg-primary/20 border border-primary/45 text-white shadow-[0_0_8px_rgba(168,85,247,0.2)]"
                  : "text-white/40 hover:text-white/85"
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
        >
          {/* TAB 0: 4-QUADRANT RELATIVE ROTATION GRAPH (RRG) MODEL */}
          {activeTab === "rrg" && (
            <div className="space-y-6">
              {/* Concept Banner */}
              <div className="glass-card rounded-2xl border border-white/8 p-6 bg-gradient-to-r from-purple-950/20 via-black to-blue-950/20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-primary font-bold block mb-1">
                      INSTITUTIONAL QUANTITATIVE ROTATION ENGINE
                    </span>
                    <h2 className="text-xl font-display font-bold text-white">
                      JdK Relative Rotation Graph (RRG) vs Nifty 50
                    </h2>
                    <p className="text-xs text-white/50 font-sans max-w-2xl mt-1 leading-relaxed">
                      Tracks relative strength ratio (X-axis) and relative momentum (Y-axis) benchmarked to 100 against Nifty 50. Sectors rotate clockwise through <strong>Improving → Leading → Weakening → Lagging</strong>.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                      70% Longs in LEADING
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold">
                      F&O Shorts in LAGGING
                    </span>
                  </div>
                </div>
              </div>

              {/* 4 Quadrants Display */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. LEADING QUADRANT (Top-Right) */}
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 space-y-4 shadow-[0_0_20px_rgba(16,185,129,0.08)]">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
                        <h3 className="text-base font-bold font-display text-emerald-300">
                          QUADRANT I: LEADING
                        </h3>
                      </div>
                      <p className="text-[11px] font-mono text-emerald-400/70 mt-0.5">
                        High Relative Strength (RS &gt; 100) + High Momentum (Mom &gt; 100)
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Focus 70% Long Trades
                    </span>
                  </div>
                  <p className="text-xs text-white/60 font-sans leading-relaxed">
                    Institutional market drivers outperforming Nifty 50 with accelerating momentum. Deploy high-conviction breakout and pullback setups here.
                  </p>

                  <div className="space-y-2">
                    {leadingSectors.map(s => (
                      <div key={s.name} className="p-3 rounded-xl bg-black/40 border border-emerald-500/20 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm font-display">{s.name}</span>
                            <span className={`text-[10px] font-mono font-bold ${s.change1w >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {s.change1w >= 0 ? "+" : ""}{s.change1w}% (1W)
                            </span>
                          </div>
                          <span className="text-[10px] text-white/40 font-mono">
                            Top: <strong className="text-white/80">{s.topGainer.symbol}</strong> ({s.topGainer.change >= 0 ? "+" : ""}{s.topGainer.change}%)
                          </span>
                        </div>
                        <div className="text-right font-mono text-xs">
                          <span className="text-emerald-300 font-bold block">RS: {s.rsRatio || "102.4"}</span>
                          <span className="text-emerald-400/70 text-[10px]">Mom: {s.rsMomentum || "101.8"}</span>
                        </div>
                      </div>
                    ))}
                    {leadingSectors.length === 0 && (
                      <p className="text-xs text-white/30 italic">No sectors currently in pure leading quadrant.</p>
                    )}
                  </div>
                </div>

                {/* 2. IMPROVING QUADRANT (Top-Left) */}
                <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-5 space-y-4 shadow-[0_0_20px_rgba(6,182,212,0.08)]">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#06b6d4]" />
                        <h3 className="text-base font-bold font-display text-cyan-300">
                          QUADRANT IV: IMPROVING
                        </h3>
                      </div>
                      <p className="text-[11px] font-mono text-cyan-400/70 mt-0.5">
                        Low Relative Strength (RS &lt; 100) + Rising Momentum (Mom &gt; 100)
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      Early Rotation Entry
                    </span>
                  </div>
                  <p className="text-xs text-white/60 font-sans leading-relaxed">
                    Sectors bottoming out and gaining relative momentum before price breaks out. Accumulate Stage 1/2 transition setups for maximum risk:reward.
                  </p>

                  <div className="space-y-2">
                    {improvingSectors.map(s => (
                      <div key={s.name} className="p-3 rounded-xl bg-black/40 border border-cyan-500/20 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm font-display">{s.name}</span>
                            <span className={`text-[10px] font-mono font-bold ${s.change1w >= 0 ? "text-cyan-400" : "text-rose-400"}`}>
                              {s.change1w >= 0 ? "+" : ""}{s.change1w}% (1W)
                            </span>
                          </div>
                          <span className="text-[10px] text-white/40 font-mono">
                            Top: <strong className="text-white/80">{s.topGainer.symbol}</strong> ({s.topGainer.change >= 0 ? "+" : ""}{s.topGainer.change}%)
                          </span>
                        </div>
                        <div className="text-right font-mono text-xs">
                          <span className="text-cyan-300 font-bold block">RS: {s.rsRatio || "98.6"}</span>
                          <span className="text-cyan-400/70 text-[10px]">Mom: {s.rsMomentum || "101.4"}</span>
                        </div>
                      </div>
                    ))}
                    {improvingSectors.length === 0 && (
                      <p className="text-xs text-white/30 italic">No sectors currently in improving quadrant.</p>
                    )}
                  </div>
                </div>

                {/* 3. WEAKENING QUADRANT (Bottom-Right) */}
                <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 space-y-4 shadow-[0_0_20px_rgba(245,158,11,0.08)]">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" />
                        <h3 className="text-base font-bold font-display text-amber-300">
                          QUADRANT II: WEAKENING
                        </h3>
                      </div>
                      <p className="text-[11px] font-mono text-amber-400/70 mt-0.5">
                        High Relative Strength (RS &gt; 100) + Falling Momentum (Mom &lt; 100)
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Tighten Trailing Stops
                    </span>
                  </div>
                  <p className="text-xs text-white/60 font-sans leading-relaxed">
                    Sectors still holding high relative strength from past runs, but losing steam. Avoid fresh swing buys; raise stops to 20 EMA and book partial profits.
                  </p>

                  <div className="space-y-2">
                    {weakeningSectors.map(s => (
                      <div key={s.name} className="p-3 rounded-xl bg-black/40 border border-amber-500/20 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm font-display">{s.name}</span>
                            <span className={`text-[10px] font-mono font-bold ${s.change1w >= 0 ? "text-amber-400" : "text-rose-400"}`}>
                              {s.change1w >= 0 ? "+" : ""}{s.change1w}% (1W)
                            </span>
                          </div>
                          <span className="text-[10px] text-white/40 font-mono">
                            Top: <strong className="text-white/80">{s.topGainer.symbol}</strong> ({s.topGainer.change >= 0 ? "+" : ""}{s.topGainer.change}%)
                          </span>
                        </div>
                        <div className="text-right font-mono text-xs">
                          <span className="text-amber-300 font-bold block">RS: {s.rsRatio || "101.5"}</span>
                          <span className="text-amber-400/70 text-[10px]">Mom: {s.rsMomentum || "98.2"}</span>
                        </div>
                      </div>
                    ))}
                    {weakeningSectors.length === 0 && (
                      <p className="text-xs text-white/30 italic">No sectors currently in weakening quadrant.</p>
                    )}
                  </div>
                </div>

                {/* 4. LAGGING QUADRANT (Bottom-Left) */}
                <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-5 space-y-4 shadow-[0_0_20px_rgba(244,63,94,0.08)]">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse shadow-[0_0_8px_#f43f5e]" />
                        <h3 className="text-base font-bold font-display text-rose-300">
                          QUADRANT III: LAGGING
                        </h3>
                      </div>
                      <p className="text-[11px] font-mono text-rose-400/70 mt-0.5">
                        Low Relative Strength (RS &lt; 100) + Negative Momentum (Mom &lt; 100)
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      Focus F&O Shorts
                    </span>
                  </div>
                  <p className="text-xs text-white/60 font-sans leading-relaxed">
                    Underperforming benchmark index under active institutional distribution. Prime hunting ground for intraday Put options and short buildup plays.
                  </p>

                  <div className="space-y-2">
                    {laggingSectors.map(s => (
                      <div key={s.name} className="p-3 rounded-xl bg-black/40 border border-rose-500/20 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm font-display">{s.name}</span>
                            <span className="text-[10px] font-mono font-bold text-rose-400">
                              {s.change1w >= 0 ? "+" : ""}{s.change1w}% (1W)
                            </span>
                          </div>
                          <span className="text-[10px] text-white/40 font-mono">
                            Loser: <strong className="text-rose-400">{s.topLoser.symbol}</strong> ({s.topLoser.change}%)
                          </span>
                        </div>
                        <div className="text-right font-mono text-xs">
                          <span className="text-rose-300 font-bold block">RS: {s.rsRatio || "97.4"}</span>
                          <span className="text-rose-400/70 text-[10px]">Mom: {s.rsMomentum || "98.1"}</span>
                        </div>
                      </div>
                    ))}
                    {laggingSectors.length === 0 && (
                      <p className="text-xs text-white/30 italic">No sectors currently in lagging quadrant.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: SECTOR CYCLE & HEATMAP */}
          {activeTab === "cycle" && (
            <div className="space-y-8">
              {/* Heatmap Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white/85">Sector Performance Heatmap</h3>
                    <p className="text-[11px] text-white/40 font-mono mt-0.5">Timeframe returns of key Indian market indices</p>
                  </div>
                  <div className="flex gap-1.5">
                    {(["1d", "1w", "1m"] as const).map(tf => (
                      <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-mono font-semibold border transition-all ${
                          timeframe === tf
                            ? "bg-primary/25 border-primary/40 text-primary"
                            : "bg-white/3 border-white/6 text-white/40 hover:text-white/60"
                        }`}
                      >
                        {tf === "1d" ? "Today" : tf === "1w" ? "1 Week" : "1 Month"}
                      </button>
                    ))}
                  </div>
                </div>

                {isPerfLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {[...Array(9)].map((_, i) => (
                      <div key={i} className="h-36 rounded-2xl bg-white/3 animate-pulse border border-white/5" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
                    {sortedSectors.map(sector => {
                      const change = getChange(sector);
                      const isPos = change >= 0;
                      const intensity = Math.min(Math.abs(change) / maxAbsChange, 1);
                      const bg = isPos
                        ? `rgba(34, 197, 94, ${0.05 + intensity * 0.2})`
                        : `rgba(239, 68, 68, ${0.05 + intensity * 0.2})`;
                      const borderColor = isPos
                        ? `rgba(34, 197, 94, ${0.1 + intensity * 0.3})`
                        : `rgba(239, 68, 68, ${0.1 + intensity * 0.3})`;

                      return (
                        <div
                          key={sector.symbol}
                          className="rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] cursor-default col-span-2 sm:col-span-1 lg:col-span-3 flex flex-col justify-between min-h-[140px]"
                          style={{ background: bg, border: `1px solid ${borderColor}` }}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <h4 className="text-xs font-semibold text-white/80 truncate">{sector.name}</h4>
                              {isPos ? (
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              ) : (
                                <TrendingDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                              )}
                            </div>
                            <p className={`text-xl font-mono font-bold ${isPos ? "text-emerald-400" : "text-red-400"}`}>
                              {isPos ? "+" : ""}{change.toFixed(2)}%
                            </p>
                          </div>

                          {/* Top / Bot performers in sector */}
                          <div className="space-y-1 border-t border-white/5 pt-2 mt-3">
                            <div className="flex items-center justify-between text-[9px] font-mono">
                              <span className="text-white/20">Top Gainer</span>
                              <span className="text-emerald-400 truncate max-w-[120px]">{sector.topGainer.symbol} (+{sector.topGainer.change.toFixed(1)}%)</span>
                            </div>
                            <div className="flex items-center justify-between text-[9px] font-mono">
                              <span className="text-white/20">Top Loser</span>
                              <span className="text-red-400 truncate max-w-[120px]">{sector.topLoser.symbol} ({sector.topLoser.change.toFixed(1)}%)</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sector Cycle Positioning Matrix */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                      <span>📊 SECTOR ROTATION MATRIX (Cycle Positioning)</span>
                      {isAnalysisFetching && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/25">
                          <Loader2 className="w-3 h-3 animate-spin" /> Live Fetching
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-white/45 font-mono mt-0.5">
                      Sectors mapped to their current stage in the macroeconomic timeline
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => refetchAnalysis()}
                      disabled={isAnalysisFetching}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-primary/50 bg-white/5 hover:bg-primary/10 text-white/80 hover:text-primary transition-all text-xs font-mono font-semibold disabled:opacity-50"
                      title="Fetch fresh macroeconomic and rotation analysis from AI engine"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isAnalysisFetching ? "animate-spin text-primary" : ""}`} />
                      <span>{isAnalysisFetching ? "Analyzing Cycle..." : "Sync Macro Cycle"}</span>
                    </button>
                  </div>
                </div>

                {/* Loading Banner & Skeleton Option if analysis is loading */}
                {isAnalysisLoading ? (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-primary/30 bg-primary/5 backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white font-mono flex items-center gap-2">
                            <span>Loading Institutional Sector Cycle Models</span>
                            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                          </div>
                          <p className="text-[11px] text-white/50 font-sans mt-0.5">
                            Synthesizing RBI interest rate cycle, GDP projections, and macroeconomic positioning across all 9 NSE sectors...
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => refetchAnalysis()}
                        disabled={isAnalysisFetching}
                        className="px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary font-mono text-xs hover:bg-primary/20 transition flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                      >
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Reload Data
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                      {[
                        { title: "GROWTH / RECOVERY", desc: "Leads bull markets, cheap entry, credit rebound", color: "border-cyan-500/20 bg-cyan-500/5 text-cyan-400" },
                        { title: "MID-CYCLE EXPANSION", desc: "Goldilocks growth phase, earnings peak, Tech favor", color: "border-purple-500/20 bg-purple-500/5 text-purple-400" },
                        { title: "LATE-CYCLE PEAK", desc: "Stretched valuations, rising cost pressures, defensive rotation", color: "border-amber-500/20 bg-amber-500/5 text-amber-400" },
                        { title: "RECESSION / DEFENSIVE", desc: "Safety focus, predictable cash flows, counter-cyclical", color: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" }
                      ].map((stage, idx) => (
                        <div key={idx} className={`rounded-2xl border p-4 space-y-4 ${stage.color}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-mono font-bold tracking-wider uppercase block">{stage.title}</span>
                              <span className="text-[9px] text-white/35 font-sans leading-relaxed block mt-0.5">{stage.desc}</span>
                            </div>
                            <Loader2 className="w-3.5 h-3.5 animate-spin opacity-50 shrink-0" />
                          </div>
                          <div className="space-y-3">
                            {[1, 2].map(n => (
                              <div key={n} className="bg-white/4 border border-white/5 rounded-xl p-3 space-y-2 animate-pulse">
                                <div className="flex items-center justify-between">
                                  <div className="h-3.5 w-24 bg-white/10 rounded" />
                                  <div className="h-4 w-14 bg-white/10 rounded" />
                                </div>
                                <div className="h-2.5 w-3/4 bg-white/10 rounded" />
                                <div className="h-2 w-full bg-white/5 rounded" />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    {[
                      { key: "Growth (Recovery/Early Expansion)", title: "GROWTH / RECOVERY", desc: "Leads bull markets, cheap entry, credit rebound", color: "border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-400" },
                      { key: "Mid-cycle (Slowing Expansion)", title: "MID-CYCLE EXPANSION", desc: "Goldilocks growth phase, earnings peak, Tech favor", color: "border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 text-purple-400" },
                      { key: "Late-cycle (Peak Expansion)", title: "LATE-CYCLE PEAK", desc: "Stretched valuations, rising cost pressures, defensive rotation", color: "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400" },
                      { key: "Recession (Defensive)", title: "RECESSION / DEFENSIVE", desc: "Safety focus, predictable cash flows, counter-cyclical", color: "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400" }
                    ].map(stage => {
                      const stageSectors = activeSectors.filter(s => matchCycleStage(s.cyclePosition, stage.key));
                      return (
                        <div key={stage.key} className={`rounded-2xl border p-4 space-y-4 transition duration-300 ${stage.color}`}>
                          <div>
                            <span className="text-[10px] font-mono font-bold tracking-wider uppercase block">{stage.title}</span>
                            <span className="text-[9px] text-white/35 font-sans leading-relaxed block mt-0.5">{stage.desc}</span>
                          </div>

                          <div className="space-y-3">
                            {stageSectors.length > 0 ? (
                              stageSectors.map(s => (
                                <div key={s.name} className="bg-white/2 border border-white/4 rounded-xl p-3 space-y-2 hover:border-white/10 transition">
                                  <div className="flex items-start justify-between gap-1.5">
                                    <div>
                                      <h4 className="text-xs font-semibold text-white">{s.name}</h4>
                                      <span className="text-[9px] text-white/35 font-mono">{s.indexSymbol}</span>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                      <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold border ${getStatusColor(s.status)}`}>
                                        {s.status}
                                      </span>
                                      <div className="text-[9px] text-amber-400 font-mono">
                                        {"★".repeat(s.score)}{"☆".repeat(5 - s.score)}
                                      </div>
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-white/50 leading-relaxed font-sans">{s.why}</p>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-xl border border-dashed border-white/10 bg-white/1 p-4 text-center space-y-1">
                                <div className="text-[10px] text-white/50 font-mono">No Active Rotations</div>
                                <p className="text-[9px] text-white/30 font-sans leading-tight">Institutional flows currently clustered in adjacent stages.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Relative Performance & Momentum */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                      <span>📈 SECTOR RELATIVE PERFORMANCE & MOMENTUM</span>
                      {isAnalysisFetching && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      )}
                    </h3>
                    <p className="text-[11px] text-white/45 font-mono mt-0.5">Indices performance benchmarked against the broader Nifty Index</p>
                  </div>
                  <span className="text-[10px] font-mono text-white/50 bg-white/5 px-2.5 py-1 rounded border border-white/10 self-start sm:self-auto">
                    {activeSectors.length} Tracked Sectors
                  </span>
                </div>

                {isAnalysisLoading ? (
                  <div className="overflow-hidden rounded-2xl border border-white/6 p-6 space-y-3 bg-white/1">
                    <div className="flex items-center justify-between text-xs font-mono text-primary animate-pulse pb-2 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Synthesizing sector momentum, relative strength & earnings trends...</span>
                      </div>
                      <span>9 Indices</span>
                    </div>
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-10 rounded-lg bg-white/3 animate-pulse border border-white/5 flex items-center justify-between px-4">
                        <div className="h-3.5 w-28 bg-white/10 rounded" />
                        <div className="h-3 w-16 bg-white/10 rounded" />
                        <div className="h-5 w-20 bg-white/10 rounded-full" />
                        <div className="h-3.5 w-24 bg-white/10 rounded" />
                        <div className="h-5 w-16 bg-white/10 rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-white/6">
                    <table className="w-full text-left border-collapse font-sans text-xs">
                      <thead>
                        <tr className="bg-white/4 border-b border-white/6">
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider">Sector Index</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider">Symbol</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">Earnings Trend</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">3-Month Momentum</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {activeSectors.map((s, idx) => {
                          const isAcc = s.momentum3M.includes("ACCELERATING");
                          const isDec = s.momentum3M.includes("DECELERATING");
                          const statusColor = getStatusColor(s.status);
                          return (
                            <tr key={s.name} className={`hover:bg-white/3 transition ${idx % 2 === 0 ? "bg-white/1" : "bg-transparent"}`}>
                              <td className="px-4 py-3 font-semibold text-white">{s.name}</td>
                              <td className="px-4 py-3 font-mono text-white/40">{s.indexSymbol}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold 
                                  ${s.earningsTrend === "STRONG" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : 
                                    s.earningsTrend === "STEADY" ? "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20" : 
                                    "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                                  {s.earningsTrend}
                                </span>
                              </td>
                              <td className={`px-4 py-3 font-mono text-center font-bold ${isAcc ? "text-emerald-400" : isDec ? "text-rose-400" : "text-zinc-400"}`}>
                                {s.momentum3M}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${statusColor}`}>
                                  {s.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MACRO DRIVERS & PLAYBOOK */}
          {activeTab === "macro" && (
            <div className="space-y-8">
              {/* Macro Drivers Cards */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                      <span>🔑 KEY MACRO DRIVERS OF SECTOR ROTATION</span>
                      {isAnalysisFetching && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/25">
                          <Loader2 className="w-3 h-3 animate-spin" /> Live Fetching
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-white/40 font-mono mt-0.5">Macro forces that trigger shifts in institutional capital</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => refetchAnalysis()}
                      disabled={isAnalysisFetching}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-primary/50 bg-white/5 hover:bg-primary/10 text-white/80 hover:text-primary transition-all text-xs font-mono font-semibold disabled:opacity-50"
                      title="Fetch fresh macroeconomic and rotation analysis from AI engine"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isAnalysisFetching ? "animate-spin text-primary" : ""}`} />
                      <span>{isAnalysisFetching ? "Analyzing..." : "Sync Macro Drivers"}</span>
                    </button>
                  </div>
                </div>

                {isAnalysisLoading ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-2xl border border-primary/30 bg-primary/5">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        <div>
                          <div className="text-xs font-semibold text-white font-mono">Loading Macro Cycle Overview...</div>
                          <p className="text-[11px] text-white/50">Tracking RBI repo rates, CPI forecasts, GDP models and institutional capital flows.</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-44 rounded-2xl bg-white/2 animate-pulse border border-white/5" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Interest Rate */}
                    <div className="glass-card rounded-2xl border border-white/6 p-4 flex flex-col justify-between min-h-[170px] hover:border-primary/20 transition duration-300">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center">
                            <Landmark className="w-3.5 h-3.5 text-cyan-400" />
                          </div>
                          <span className="text-xs font-semibold text-white/90">Interest Rate Cycle</span>
                        </div>
                        <div className="text-sm font-mono font-bold text-white mb-2">
                          Rate: {macroOverview.interestRateCycle.currentRate}
                        </div>
                        <p className="text-[11px] text-white/50 leading-relaxed font-sans">
                          Outlook: {macroOverview.interestRateCycle.outlook}
                        </p>
                      </div>
                      <div className="text-[10px] text-cyan-400 font-sans border-t border-white/5 pt-2 mt-3 italic leading-relaxed">
                        Impact: {macroOverview.interestRateCycle.impact}
                      </div>
                    </div>

                    {/* Inflation CPI */}
                    <div className="glass-card rounded-2xl border border-white/6 p-4 flex flex-col justify-between min-h-[170px] hover:border-primary/20 transition duration-300">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/25 flex items-center justify-center">
                            <Percent className="w-3.5 h-3.5 text-orange-400" />
                          </div>
                          <span className="text-xs font-semibold text-white/90">Inflation CPI Trend</span>
                        </div>
                        <div className="text-sm font-mono font-bold text-white mb-2">
                          CPI: {macroOverview.inflationTrend.currentCPI}
                        </div>
                        <p className="text-[11px] text-white/50 leading-relaxed font-sans">
                          Outlook: {macroOverview.inflationTrend.outlook}
                        </p>
                      </div>
                      <div className="text-[10px] text-orange-400 font-sans border-t border-white/5 pt-2 mt-3 italic leading-relaxed">
                        Impact: {macroOverview.inflationTrend.impact}
                      </div>
                    </div>

                    {/* GDP Growth */}
                    <div className="glass-card rounded-2xl border border-white/6 p-4 flex flex-col justify-between min-h-[170px] hover:border-primary/20 transition duration-300">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <span className="text-xs font-semibold text-white/90">GDP Growth Outlook</span>
                        </div>
                        <div className="text-sm font-mono font-bold text-white mb-2">
                          Forecast: {macroOverview.gdpGrowth.forecast}
                        </div>
                        <p className="text-[11px] text-white/50 leading-relaxed font-sans">
                          Outlook: {macroOverview.gdpGrowth.outlook}
                        </p>
                      </div>
                      <div className="text-[10px] text-emerald-400 font-sans border-t border-white/5 pt-2 mt-3 italic leading-relaxed">
                        Impact: {macroOverview.gdpGrowth.impact}
                      </div>
                    </div>

                    {/* Forex USD/INR */}
                    <div className="glass-card rounded-2xl border border-white/6 p-4 flex flex-col justify-between min-h-[170px] hover:border-primary/20 transition duration-300">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/25 flex items-center justify-center">
                            <Globe className="w-3.5 h-3.5 text-purple-400" />
                          </div>
                          <span className="text-xs font-semibold text-white/90">Rupee Trajectory</span>
                        </div>
                        <div className="text-sm font-mono font-bold text-white mb-2">
                          Level: {macroOverview.rupeeTrajectory.current}
                        </div>
                      </div>
                      <div className="text-[10px] text-purple-400 font-sans border-t border-white/5 pt-2 mt-3 italic leading-relaxed">
                        Impact: {macroOverview.rupeeTrajectory.impact}
                      </div>
                    </div>

                    {/* FII DII Flows */}
                    <div className="glass-card rounded-2xl border border-white/6 p-4 flex flex-col justify-between min-h-[170px] hover:border-primary/20 transition duration-300 col-span-1 md:col-span-2 lg:col-span-2">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-pink-500/10 border border-pink-500/25 flex items-center justify-center">
                            <Coins className="w-3.5 h-3.5 text-pink-400" />
                          </div>
                          <span className="text-xs font-semibold text-white/90">FII / DII Institutional Flows</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-2">
                          <div>FII Inflows: <span className="text-emerald-400 font-bold">{macroOverview.fiiDiiFlows.fiiYTD}</span></div>
                          <div>DII Inflows: <span className="text-emerald-400 font-bold">{macroOverview.fiiDiiFlows.diiYTD}</span></div>
                        </div>
                      </div>
                      <div className="text-[10px] text-pink-400 font-sans border-t border-white/5 pt-2 mt-3 italic leading-relaxed">
                        Impact: {macroOverview.fiiDiiFlows.impact}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Allocation Roadmap */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white/85">💼 SECTOR ALLOCATION ROADMAP (Portfolio Strategy)</h3>
                  <p className="text-[11px] text-white/45 font-mono mt-0.5">Target sector weights mapped to different holding timelines</p>
                </div>

                {isAnalysisLoading ? (
                  <div className="h-64 rounded-2xl bg-white/2 animate-pulse border border-white/5" />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {[
                      { title: "Tactical Trading (3-6 Months)", key: "tactical3_6M", desc: "Momentum capture, rotation leaders" },
                      { title: "Medium-Term (6-12 Months)", key: "medium6_12M", desc: "Valuation accumulation, structural transition" },
                      { title: "Strategic Investing (12-24 Months)", key: "strategic12_24M", desc: "Long-term capex theme, secular compounders" }
                    ].map(road => {
                      const allocations = portfolioAllocation[road.key as keyof PortfolioAllocation] ?? [];
                      return (
                        <div key={road.key} className="glass-card rounded-2xl border border-white/6 p-5 space-y-4">
                          <div>
                            <h4 className="text-xs font-bold text-white font-display tracking-wide uppercase">{road.title}</h4>
                            <span className="text-[9px] text-white/35 font-mono">{road.desc}</span>
                          </div>

                          <div className="space-y-3">
                            {allocations.map((a, idx) => (
                              <div key={a.sector} className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-mono">
                                  <span className="text-white/60 font-sans">{a.sector}</span>
                                  <span className="font-bold text-primary">{a.weight}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${a.weight}%`,
                                      background: ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length]
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Playbook Play Timeline */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white/85">🔄 SECTOR ROTATION PLAYBOOK</h3>
                  <p className="text-[11px] text-white/45 font-mono mt-0.5">Execution steps to stay aligned with market cycles</p>
                </div>

                {isAnalysisLoading ? (
                  <div className="h-44 rounded-2xl bg-white/2 animate-pulse border border-white/5" />
                ) : (
                  <div className="glass-card rounded-2xl border border-white/6 p-5 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2 border-r border-white/5 pr-0 md:pr-6">
                        <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Rotation Happening Now</span>
                        <p className="text-xs text-white/85 font-sans leading-relaxed">{rotationPlaybook.now}</p>
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Rotation Expected Next</span>
                        <p className="text-xs text-white/85 font-sans leading-relaxed">{rotationPlaybook.next}</p>
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-4">
                      <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block mb-3">Tactical Timeline</span>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {rotationPlaybook.timeline.map((t, idx) => (
                          <div key={idx} className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
                            <span className="text-[11px] font-bold text-primary font-mono">{t.phase}</span>
                            <p className="text-[11px] text-white/70 font-sans leading-relaxed">{t.action}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: VALUATIONS & EARNINGS MATRIX */}
          {activeTab === "valuations" && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-2">
                <div>
                  <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                    <span>💰 SECTOR VALUATION & EARNINGS MATRIX</span>
                    {isAnalysisFetching && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/25">
                        <Loader2 className="w-3 h-3 animate-spin" /> Live Fetching
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-white/40 font-mono mt-0.5">Valuation multiples, 5Y benchmarks, growth forecasts & risk parameters</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => refetchAnalysis()}
                    disabled={isAnalysisFetching}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-primary/50 bg-white/5 hover:bg-primary/10 text-white/80 hover:text-primary transition-all text-xs font-mono font-semibold disabled:opacity-50"
                    title="Fetch fresh macroeconomic and rotation analysis from AI engine"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isAnalysisFetching ? "animate-spin text-primary" : ""}`} />
                    <span>{isAnalysisFetching ? "Analyzing..." : "Sync Valuations"}</span>
                  </button>
                </div>
              </div>

              {/* Valuation & Earnings Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Valuations Table */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white/85">💰 SECTOR VALUATION SNAPSHOT</h3>
                    <p className="text-[11px] text-white/40 font-mono mt-0.5">Average P/E valuations benchmarked historically</p>
                  </div>

                  {isAnalysisLoading ? (
                    <div className="h-56 rounded-2xl bg-white/2 animate-pulse border border-white/5 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-xs font-mono text-white/50">Loading historical valuation multiples...</span>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-white/6">
                      <table className="w-full text-left border-collapse font-sans text-xs">
                        <thead>
                          <tr className="bg-white/4 border-b border-white/6">
                            <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider">Sector</th>
                            <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">PE</th>
                            <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">5Y PE</th>
                            <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">Nifty PE</th>
                            <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-right">Valuation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {activeSectors.map((s, idx) => (
                            <tr key={s.name} className={idx % 2 === 0 ? "bg-white/1" : "bg-transparent"}>
                              <td className="px-4 py-3 font-semibold text-white">{s.name}</td>
                              <td className="px-4 py-3 font-mono text-center text-white/80">{s.pe.toFixed(1)}x</td>
                              <td className="px-4 py-3 font-mono text-center text-white/40">{s.pe5Y.toFixed(1)}x</td>
                              <td className="px-4 py-3 font-mono text-center text-white/35">19.5x</td>
                              <td className="px-4 py-3 text-right">
                                <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-mono font-bold border ${getValStatusColor(s.valuationStatus)}`}>
                                  {s.valuationStatus}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Earnings Table */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white/85">📈 SECTOR EARNINGS CYCLE</h3>
                    <p className="text-[11px] text-white/40 font-mono mt-0.5">Corporate earnings expansion rates and YoY forecasts</p>
                  </div>

                  {isAnalysisLoading ? (
                    <div className="h-56 rounded-2xl bg-white/2 animate-pulse border border-white/5 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-xs font-mono text-white/50">Loading forward earnings estimates...</span>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-white/6">
                      <table className="w-full text-left border-collapse font-sans text-xs">
                        <thead>
                          <tr className="bg-white/4 border-b border-white/6">
                            <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider">Sector</th>
                            <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">FY25E Growth</th>
                            <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">FY26E Growth</th>
                            <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-right">Trend</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {activeSectors.map((s, idx) => (
                            <tr key={s.name} className={idx % 2 === 0 ? "bg-white/1" : "bg-transparent"}>
                              <td className="px-4 py-3 font-semibold text-white">{s.name}</td>
                              <td className="px-4 py-3 font-mono text-center text-white/80">{s.earningGrowthFY25}</td>
                              <td className="px-4 py-3 font-mono text-center text-white/80">{s.earningGrowthFY26}</td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">{s.earningsTrend}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Risk Assessment Matrix */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white/85">⚠️ SECTOR RISK ASSESSMENT</h3>
                  <p className="text-[11px] text-white/45 font-mono mt-0.5">Summary of core external risks and likelihood parameters</p>
                </div>

                {isAnalysisLoading ? (
                  <div className="h-56 rounded-2xl bg-white/2 animate-pulse border border-white/5 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-xs font-mono text-white/50">Analyzing macro & regulatory risk triggers...</span>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-white/6">
                    <table className="w-full text-left border-collapse font-sans text-xs">
                      <thead>
                        <tr className="bg-white/4 border-b border-white/6">
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider">Sector</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider">Key Red Flag / Risk Factor</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">Severity</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-right">Probability</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {activeSectors.map((s, idx) => (
                          <tr key={s.name} className={idx % 2 === 0 ? "bg-white/1" : "bg-transparent"}>
                            <td className="px-4 py-3 font-semibold text-white">{s.name}</td>
                            <td className="px-4 py-3 text-white/70 leading-relaxed font-sans">{s.keyRisks[0]?.risk || "—"}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border 
                                ${s.keyRisks[0]?.severity === "High" ? "text-red-400 bg-red-500/10 border-red-500/25" : 
                                  s.keyRisks[0]?.severity === "Medium" ? "text-amber-400 bg-amber-500/10 border-amber-500/25" : 
                                  "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"}`}>
                                {s.keyRisks[0]?.severity || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-white/40">{s.keyRisks[0]?.probability || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Complete Comparison Matrix */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white/85">📊 SECTOR COMPARISON MATRIX (All-in-One)</h3>
                  <p className="text-[11px] text-white/45 font-mono mt-0.5">Quick reference comparison matrix across all core dimensions</p>
                </div>

                {isAnalysisLoading ? (
                  <div className="h-64 rounded-2xl bg-white/2 animate-pulse border border-white/5 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-xs font-mono text-white/50">Compiling multi-dimensional comparison metrics...</span>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-white/6">
                    <table className="w-full text-left border-collapse font-sans text-xs">
                      <thead>
                        <tr className="bg-white/4 border-b border-white/6">
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider">Sector</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">P/E</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">5Y P/E</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">FY25 Growth</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">Momentum</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-center">Earnings Cycle</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold text-white/55 uppercase tracking-wider text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {activeSectors.map((s, idx) => {
                          const statusColor = getStatusColor(s.status);
                          return (
                            <tr key={s.name} className={idx % 2 === 0 ? "bg-white/1" : "bg-transparent"}>
                              <td className="px-4 py-3 font-bold text-white">{s.name}</td>
                              <td className="px-4 py-3 font-mono text-center text-white/80">{s.pe.toFixed(1)}x</td>
                              <td className="px-4 py-3 font-mono text-center text-white/40">{s.pe5Y.toFixed(1)}x</td>
                              <td className="px-4 py-3 font-mono text-center text-emerald-400">{s.earningGrowthFY25}</td>
                              <td className="px-4 py-3 font-mono text-center text-white/70">{s.momentum3M}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border 
                                  ${s.earningsTrend === "STRONG" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : 
                                    s.earningsTrend === "STEADY" ? "text-zinc-300 border-zinc-500/20 bg-zinc-500/5" : 
                                    "text-rose-400 border-rose-500/30 bg-rose-500/10"}`}>
                                  {s.earningsTrend}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${statusColor}`}>
                                  {s.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
