/**
 * FundamentalDashboard — Jetro Canvas-style deep analysis panel
 *
 * Sections:
 *   1. Hero bar — Investment Score ring, verdict, targets, upside
 *   2. Analyst summary + key monitorable
 *   3. Concall Intel — last 4 quarters as carousel cards
 *   4. Annual Report 2Y Comparison table
 *   5. Valuation Report — 3 method tabs (P/E, EV/EBITDA, DCF)
 *   6. MOAT Radar — 6-axis spider chart
 *   7. Risk / Opportunity Matrix — probability × impact grid
 *   8. Price & Volume Analysis — price performance + volume/delivery chart
 *   9. Seasonality Analysis — monthly returns heatmap
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import {
  Sparkles, PhoneCall, BookOpen, Target, ShieldCheck, AlertTriangle, TrendingUp, ChevronLeft, ChevronRight,
  BarChart3, Zap, Clock, ArrowUpRight, ArrowDownRight, Info, ShieldAlert,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────── */
interface DashboardData {
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  currentPrice: number;
  concalls: Concall[];
  annualReports: { fy2024: AnnualReport; fy2023: AnnualReport };
  moatScores: Record<string, number>;
  moatRating: string;
  moatReason: string;
  investmentScore: InvestmentScore;
  verdict: string;
  targetPriceLow: number;
  targetPriceHigh: number;
  targetHorizon: string;
  marginOfSafety: number;
  upside: number;
  valuationReport: ValuationReport;
  risks: RiskOpp[];
  opportunities: RiskOpp[];
  keyMonitorable: string;
  analystConsensusSummary: string;
  governance?: {
    managementCredibility: number;
    promoterSkinInTheGame?: string;
    capitalAllocationTrackRecord?: string;
    keyPersonRiskSuccession?: string;
    historicalGuidanceAccuracy?: string;
    relatedPartyTransactions: "Green" | "Amber" | "Red";
    relatedPartyTransactionsDetails?: string;
    litigationExposure: "Low" | "Medium" | "High";
    litigationExposureDetails?: string;
    auditorQuality: "Standard" | "Qualified" | "Adverse";
    auditorQualityDetails?: string;
    insiderPattern: "Bullish" | "Bearish" | "Neutral";
    insiderPatternDetails?: string;
    dividendSustainability?: string;
    sebiExchangeWarnings?: string;
    commentary: string;
  };
  industryPosition?: {
    marketShareTrend: "Gaining" | "Stable" | "Losing";
    industryGrowthVsCompany?: string;
    pricingPower: "Strong" | "Moderate" | "Weak";
    competitiveIntensity?: "Low" | "Moderate" | "High";
    regulatoryCatalyst: "Bullish" | "Neutral" | "Bearish";
    regulatoryCatalystDetails?: string;
    disruptionRisk: "Low" | "Medium" | "High";
    disruptionRiskDetails?: string;
    cyclicalVsStructural?: string;
    customerConcentration?: string;
    contractVisibility?: string;
    currencyCommodityExposure?: string;
    geographicalConcentration?: string;
    nearTermCatalysts?: string;
    guidanceRealism?: string;
    valuationVsHistorical?: string;
    peerRelativeValuation?: string;
    macroMarketTiming?: string;
    commentary: string;
  };
  cashDebtQuality?: {
    ocfToNetProfit: number;
    ocfToNetProfitDetails?: string;
    daysSalesOutstanding: number;
    workingCapitalCycle?: string;
    freeCashFlowMargin: number;
    freeCashFlowSustainability?: string;
    capexRoiTrend: "Improving" | "Stable" | "Deteriorating";
    capexRoiTrendDetails?: string;
    debtMaturityProfile: "Comfortable" | "Moderate" | "Stressed";
    debtMaturityProfileDetails?: string;
    covenantCompliance?: string;
    interestCoverageSafety?: string;
    debtToMarketCap?: string;
    offBalanceSheetLiabilities?: string;
    commentary: string;
  };
  sectorRotationMacro?: {
    sectorCyclePosition: string;
    relativePerformance: string;
    macroDrivers: string;
    allocationRec: string;
  };
  marketSentimentRumors?: {
    analystSentiment: string;
    newsNarrative: string;
    fiiDiiFlows: string;
    smartMoneySignals: string;
  };
  hiddenTroubleSignals?: {
    managementChanges: string;
    redFlagAudit: string;
    financialAnomalies: string;
    litigationTracker: string;
  };
  competitiveIntelligence?: {
    newCompetitorThreat: string;
    industryTrends: string;
    marketShareVsPeers: string;
    supplyChainRisk: string;
  };
  businessModelQuality?: {
    revenueStickiness: string;
    unitEconomics: string;
    moatStrength: string;
    scalabilityScore: string;
  };
  insiderSmartMoney?: {
    promoterActivity: string;
    fiiPositioning: string;
    optionsSentiment: string;
    smartMoneyFlows: string;
  };
  bullBearNarrative?: {
    bullThesis: string;
    bullProbability: number;
    bearThesis: string;
    bearProbability: number;
    keyAssumptions: string;
    catalystRoadmap: string;
  };
  valuationBankerContext?: {
    bearBaseBullCases: string;
    timeToFairValue: string;
    riskRewardRatio: string;
    maContext: string;
  };
  overallGradeRecommendation?: {
    scorecard7Dimension: string;
    investmentGrade: string;
    portfolioAllocation: number;
  };
}

interface Concall {
  quarter: string;
  date: string;
  revenueActual: string;
  revenueGrowthYoY: string;
  patActual: string;
  patGrowthYoY: string;
  ebitdaMargin: string;
  keyHighlights: string[];
  managementGuidance: string;
  sentiment: "Bullish" | "Neutral" | "Cautious" | "Bearish";
  sentimentReason: string;
}

interface AnnualReport {
  year: string;
  revenue: string;
  revenueGrowth: string;
  pat: string;
  patGrowth: string;
  ebitda: string;
  ebitdaMargin: string;
  roe: string;
  roce: string;
  debtToEquity: string;
  freeCashFlow: string;
  promoterHolding: string;
  dividendPerShare: string;
  eps: string;
  bookValue: string;
  keyThemes: string[];
}

interface ScoreComponent {
  score: number;
  max: number;
  label: string;
}

interface InvestmentScore {
  total: number;
  grade: string;
  components: Record<string, ScoreComponent>;
}

interface ValuationMethod {
  sectorPE?: number;
  stockPE?: number;
  fairValuePE?: number;
  sectorEVEBITDA?: number;
  stockEVEBITDA?: number;
  fairValueEVEBITDA?: number;
  wacc?: number;
  terminalGrowthRate?: number;
  fairValueDCF?: number;
  upside: number;
  commentary: string;
}

interface ValuationReport {
  peMethod: ValuationMethod;
  evEbitdaMethod: ValuationMethod;
  dcfMethod: ValuationMethod;
  averageFairValue: number;
  currentPrice: number;
  overallUpside: number;
}

interface RiskOpp {
  title: string;
  description: string;
  probability: "High" | "Medium" | "Low";
  impact: "High" | "Medium" | "Low";
  category?: string;
  timeline?: string;
}

/* ─── Helpers ────────────────────────────────────────────────── */
const sentimentConfig: Record<string, { color: string; bg: string; border: string }> = {
  Bullish:  { color: "hsl(142,71%,50%)",  bg: "hsl(142,71%,50%,0.1)",  border: "hsl(142,71%,50%,0.3)"  },
  Neutral:  { color: "hsl(217,91%,66%)",  bg: "hsl(217,91%,66%,0.1)",  border: "hsl(217,91%,66%,0.3)"  },
  Cautious: { color: "hsl(38,96%,58%)",   bg: "hsl(38,96%,58%,0.1)",   border: "hsl(38,96%,58%,0.3)"   },
  Bearish:  { color: "hsl(0,84%,62%)",    bg: "hsl(0,84%,62%,0.1)",    border: "hsl(0,84%,62%,0.3)"    },
};

const verdictConfig: Record<string, { color: string; bg: string }> = {
  "Strong Buy": { color: "hsl(142,71%,45%)",  bg: "hsl(142,71%,45%,0.15)" },
  "Accumulate": { color: "hsl(142,60%,55%)",  bg: "hsl(142,60%,55%,0.12)" },
  "Hold":       { color: "hsl(38,96%,58%)",   bg: "hsl(38,96%,58%,0.12)"  },
  "Reduce":     { color: "hsl(22,95%,58%)",   bg: "hsl(22,95%,58%,0.12)"  },
  "Avoid":      { color: "hsl(0,84%,62%)",    bg: "hsl(0,84%,62%,0.12)"   },
};

const gradeColor: Record<string, string> = {
  "A+": "hsl(142,71%,50%)",
  "A":  "hsl(142,60%,55%)",
  "B":  "hsl(38,96%,58%)",
  "C":  "hsl(22,95%,58%)",
  "D":  "hsl(0,84%,62%)",
};

const probImpactPos: Record<string, { x: number; y: number }> = {
  "High-High":   { x: 75, y: 25 },
  "High-Medium": { x: 50, y: 25 },
  "High-Low":    { x: 25, y: 25 },
  "Medium-High": { x: 75, y: 50 },
  "Medium-Medium": { x: 50, y: 50 },
  "Medium-Low":  { x: 25, y: 50 },
  "Low-High":    { x: 75, y: 75 },
  "Low-Medium":  { x: 50, y: 75 },
  "Low-Low":     { x: 25, y: 75 },
};

/* ─── Sub-components ─────────────────────────────────────────── */

/** Animated SVG ring for investment score */
function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = gradeColor[grade] ?? "hsl(260,84%,65%)";

  return (
    <div className="relative w-36 h-36 flex-shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--border) / 0.5)" strokeWidth="8" />
        <motion.circle
          cx="60" cy="60" r={r} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - fill }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          style={{ filter: `drop-shadow(0 0 8px ${color}80)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="text-3xl font-display font-extrabold tabular-nums"
          style={{ color }}
        >
          {score}
        </motion.span>
        <span className="text-xs text-muted-foreground font-mono">/ 100</span>
        <span className="text-lg font-bold font-display mt-0.5" style={{ color }}>{grade}</span>
      </div>
    </div>
  );
}

/** Score component bar */
function ScoreBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = (score / max) * 100;
  const color = pct >= 75 ? "hsl(142,71%,50%)" : pct >= 50 ? "hsl(38,96%,58%)" : "hsl(0,84%,62%)";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground font-sans">{label}</span>
        <span className="font-mono font-semibold" style={{ color }}>{score}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
        />
      </div>
    </div>
  );
}

/** Concall card carousel */
function ConcallCarousel({ concalls }: { concalls: Concall[] }) {
  const [idx, setIdx] = useState(0);
  const call = concalls[idx];
  if (!call) return null;
  const cfg = sentimentConfig[call.sentiment] ?? sentimentConfig.Neutral;

  return (
    <div className="space-y-3">
      {/* Navigator */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIdx(i => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-25 transition-all"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <div className="flex gap-1.5">
          {concalls.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === idx ? "bg-primary w-4" : "bg-muted hover:bg-muted-foreground/30"}`}
            />
          ))}
        </div>
        <button
          onClick={() => setIdx(i => Math.min(concalls.length - 1, i + 1))}
          disabled={idx === concalls.length - 1}
          className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-25 transition-all"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] text-muted-foreground font-mono ml-auto">{idx + 1} of {concalls.length}</span>
      </div>

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border glass-card overflow-hidden"
          style={{ borderColor: `${cfg.color}30` }}
        >
          {/* Card header */}
          <div className="px-5 py-4 border-b border-border/40 flex items-start justify-between gap-3"
            style={{ background: `${cfg.bg}` }}>
            <div>
              <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-0.5 flex items-center gap-1.5">
                <PhoneCall className="w-3 h-3" /> Earnings Call
              </div>
              <div className="text-lg font-display font-bold text-foreground">{call.quarter}</div>
              <div className="text-xs text-muted-foreground font-mono">{call.date}</div>
            </div>
            <div
              className="px-3 py-1.5 rounded-full text-[11px] font-mono font-bold border flex-shrink-0 mt-1"
              style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
            >
              {call.sentiment}
            </div>
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-3 divide-x divide-border/50 border-b border-border/50">
            {[
              { label: "Revenue", value: call.revenueActual, delta: call.revenueGrowthYoY },
              { label: "PAT",     value: call.patActual,     delta: call.patGrowthYoY },
              { label: "EBITDA Margin", value: call.ebitdaMargin, delta: null },
            ].map(m => {
              const isPos = m.delta ? m.delta.startsWith("+") : true;
              return (
                <div key={m.label} className="px-4 py-3 text-center">
                  <div className="text-[10px] text-muted-foreground font-mono mb-1">{m.label}</div>
                  <div className="text-sm font-mono font-bold text-foreground">{m.value}</div>
                  {m.delta && (
                    <div className={`text-[10px] font-mono font-semibold ${isPos ? "text-emerald-500 font-bold" : "text-red-500 font-bold"}`}>
                      {m.delta}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Highlights */}
          <div className="px-5 py-4 space-y-3">
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">Key Highlights</div>
            <ul className="space-y-2">
              {call.keyHighlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-foreground/80 font-sans">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: cfg.color }} />
                  {h}
                </li>
              ))}
            </ul>
            {call.managementGuidance && (
              <div className="mt-3 rounded-xl p-3 border border-border bg-muted/30">
                <div className="text-[10px] font-mono text-muted-foreground mb-1">Management Guidance</div>
                <p className="text-xs text-muted-foreground font-sans leading-relaxed">{call.managementGuidance}</p>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Annual Report comparison table */
function AnnualReportTable({ fy2024, fy2023 }: { fy2024: AnnualReport; fy2023: AnnualReport }) {
  const rows: { label: string; key: keyof AnnualReport }[] = [
    { label: "Revenue",          key: "revenue"         },
    { label: "Revenue Growth",   key: "revenueGrowth"   },
    { label: "PAT",              key: "pat"              },
    { label: "PAT Growth",       key: "patGrowth"        },
    { label: "EBITDA",           key: "ebitda"           },
    { label: "EBITDA Margin",    key: "ebitdaMargin"     },
    { label: "ROE",              key: "roe"              },
    { label: "ROCE",             key: "roce"             },
    { label: "Debt/Equity",      key: "debtToEquity"     },
    { label: "Free Cash Flow",   key: "freeCashFlow"     },
    { label: "Promoter Holding", key: "promoterHolding"  },
    { label: "EPS",              key: "eps"              },
    { label: "Book Value",       key: "bookValue"        },
    { label: "Dividend/Share",   key: "dividendPerShare" },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      {/* Header */}
      <div className="grid grid-cols-3 bg-muted/50 border-b border-border">
        <div className="px-4 py-3 text-[11px] font-mono text-muted-foreground uppercase tracking-widest">Metric</div>
        <div className="px-4 py-3 text-[11px] font-mono text-primary uppercase tracking-widest text-right border-l border-border/50">{fy2024.year}</div>
        <div className="px-4 py-3 text-[11px] font-mono text-muted-foreground uppercase tracking-widest text-right border-l border-border/50">{fy2023.year}</div>
      </div>
      {rows.map((row, i) => {
        const v24 = String(fy2024[row.key] || "—");
        const v23 = String(fy2023[row.key] || "—");
        const isGrowth = row.key === "revenueGrowth" || row.key === "patGrowth";
        const pos = isGrowth && v24.startsWith("+");
        const neg = isGrowth && v24.startsWith("-");
        return (
          <div key={row.key} className={`grid grid-cols-3 border-b border-border/50 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-card"}`}>
            <div className="px-4 py-2.5 text-xs text-muted-foreground font-sans">{row.label}</div>
            <div className={`px-4 py-2.5 text-xs font-mono font-semibold text-right border-l border-border/50 ${pos ? "text-emerald-500 font-bold" : neg ? "text-red-500 font-bold" : "text-foreground"}`}>{v24}</div>
            <div className="px-4 py-2.5 text-xs font-mono text-muted-foreground text-right border-l border-border/50">{v23}</div>
          </div>
        );
      })}
      {/* Key themes */}
      {(fy2024.keyThemes?.length > 0) && (
        <div className="px-4 py-4 bg-muted/20 border-t border-border/50">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">FY24 Key Themes</div>
          <div className="flex flex-wrap gap-2">
            {fy2024.keyThemes.map((t, i) => (
              <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary/80 font-sans">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Valuation method tabs */
function ValuationSection({ report, currentPrice }: { report: ValuationReport; currentPrice: number }) {
  const [tab, setTab] = useState<"pe" | "ev" | "dcf">("pe");

  const tabs = [
    { key: "pe",  label: "P/E Method",    icon: BarChart3 },
    { key: "ev",  label: "EV/EBITDA",     icon: Zap       },
    { key: "dcf", label: "DCF",           icon: Target    },
  ] as const;

  const data = {
    pe:  { method: report.peMethod,       fairVal: report.peMethod?.fairValuePE,       upside: report.peMethod?.upside       },
    ev:  { method: report.evEbitdaMethod, fairVal: report.evEbitdaMethod?.fairValueEVEBITDA, upside: report.evEbitdaMethod?.upside },
    dcf: { method: report.dcfMethod,      fairVal: report.dcfMethod?.fairValueDCF,     upside: report.dcfMethod?.upside      },
  }[tab];

  const fairVal   = data.fairVal ?? report.averageFairValue;
  const upsidePct = data.upside ?? report.overallUpside ?? 0;
  const isUp      = upsidePct >= 0;
  const barWidth  = Math.min(Math.abs(upsidePct), 100);

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 glass-card rounded-xl border border-border w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`relative flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all duration-200
              ${tab === t.key ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tab === t.key && (
              <motion.span
                layoutId="valTab"
                className="absolute inset-0 bg-primary/80 rounded-lg"
                style={{ boxShadow: "0 0 12px 0 hsl(260 84% 65% / 0.4)" }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <t.icon className="w-3 h-3 relative z-10" />
            <span className="relative z-10">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="glass-card rounded-2xl border border-border p-5 space-y-5"
        >
          {/* Fair value vs current */}
          <div className="flex items-end gap-6">
            <div>
              <div className="text-[10px] font-mono text-muted-foreground mb-1">Current Price</div>
              <div className="text-2xl font-mono font-bold text-foreground">₹{(currentPrice || report.currentPrice)?.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="flex-1" />
            <div className="text-right">
              <div className="text-[10px] font-mono text-muted-foreground mb-1">Fair Value ({tabs.find(t => t.key === tab)?.label})</div>
              <div className="text-2xl font-mono font-bold" style={{ color: isUp ? "hsl(142,71%,50%)" : "hsl(0,84%,62%)" }}>
                ₹{fairVal?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
              </div>
            </div>
          </div>

          {/* Upside bar */}
          <div>
            <div className="flex justify-between text-[11px] font-mono mb-1.5">
              <span className="text-muted-foreground">Margin of Safety</span>
              <span className={`font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                {isUp ? "▲" : "▼"} {Math.abs(upsidePct).toFixed(1)}% {isUp ? "Upside" : "Downside"}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: isUp ? "hsl(142,71%,50%)" : "hsl(0,84%,62%)" }}
                initial={{ width: 0 }}
                animate={{ width: `${barWidth}%` }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Commentary */}
          <p className="text-xs text-foreground/80 font-sans leading-relaxed border-l-2 border-primary/40 pl-3 italic">
            {data.method?.commentary}
          </p>

          {/* Method-specific metrics */}
          {tab === "pe" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/40 border border-border p-3 text-center">
                <div className="text-[10px] text-muted-foreground font-mono mb-1">Stock P/E</div>
                <div className="text-lg font-mono font-bold text-foreground">{report.peMethod?.stockPE ?? "—"}x</div>
              </div>
              <div className="rounded-xl bg-muted/40 border border-border p-3 text-center">
                <div className="text-[10px] text-muted-foreground font-mono mb-1">Sector P/E</div>
                <div className="text-lg font-mono font-bold text-foreground">{report.peMethod?.sectorPE ?? "—"}x</div>
              </div>
            </div>
          )}
          {tab === "ev" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/40 border border-border p-3 text-center">
                <div className="text-[10px] text-muted-foreground font-mono mb-1">Stock EV/EBITDA</div>
                <div className="text-lg font-mono font-bold text-foreground">{report.evEbitdaMethod?.stockEVEBITDA ?? "—"}x</div>
              </div>
              <div className="rounded-xl bg-muted/40 border border-border p-3 text-center">
                <div className="text-[10px] text-muted-foreground font-mono mb-1">Sector EV/EBITDA</div>
                <div className="text-lg font-mono font-bold text-foreground">{report.evEbitdaMethod?.sectorEVEBITDA ?? "—"}x</div>
              </div>
            </div>
          )}
          {tab === "dcf" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/40 border border-border p-3 text-center">
                <div className="text-[10px] text-muted-foreground font-mono mb-1">WACC</div>
                <div className="text-lg font-mono font-bold text-foreground">{report.dcfMethod?.wacc ?? "—"}%</div>
              </div>
              <div className="rounded-xl bg-muted/40 border border-border p-3 text-center">
                <div className="text-[10px] text-muted-foreground font-mono mb-1">Terminal Growth</div>
                <div className="text-lg font-mono font-bold text-foreground">{report.dcfMethod?.terminalGrowthRate ?? "—"}%</div>
              </div>
            </div>
          )}

          {/* Average across methods */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-[11px] text-muted-foreground font-mono">Blended Fair Value</span>
            <span className="text-sm font-mono font-bold text-primary">
              ₹{report.averageFairValue?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
            </span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** MOAT Radar Spider Chart */
function MOATRadar({ scores, rating, reason }: { scores: Record<string, number>; rating: string; reason: string }) {
  const radarData = [
    { subject: "Pricing Power",   value: scores.pricingPower    ?? 5, fullMark: 10 },
    { subject: "Brand",           value: scores.brandStrength   ?? 5, fullMark: 10 },
    { subject: "Switching Costs", value: scores.switchingCosts  ?? 5, fullMark: 10 },
    { subject: "Network Effects", value: scores.networkEffects  ?? 5, fullMark: 10 },
    { subject: "Cost Advantage",  value: scores.costAdvantage   ?? 5, fullMark: 10 },
    { subject: "Regulatory Moat", value: scores.regulatoryMoat ?? 5, fullMark: 10 },
  ];

  const moatColor = rating === "Wide" ? "hsl(142,71%,50%)" : rating === "Narrow" ? "hsl(38,96%,58%)" : "hsl(0,84%,62%)";

  return (
    <div className="glass-card rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> MOAT Analysis
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-display font-bold" style={{ color: moatColor }}>{rating} Moat</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground font-sans max-w-[160px] text-right leading-relaxed">{reason}</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="hsl(var(--border) / 0.5)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "monospace" }}
          />
          <Radar
            name="MOAT"
            dataKey="value"
            stroke={moatColor}
            fill={moatColor}
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Score pills */}
      <div className="grid grid-cols-3 gap-2 mt-2">
        {radarData.map(d => (
          <div key={d.subject} className="text-center rounded-lg bg-muted/40 border border-border py-1.5">
            <div className="text-[9px] text-muted-foreground font-mono mb-0.5">{d.subject}</div>
            <div className="text-xs font-mono font-bold" style={{ color: moatColor }}>{d.value}/10</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Risk / Opportunity 2×2 Matrix */
function RiskMatrix({ risks, opportunities }: { risks: RiskOpp[]; opportunities: RiskOpp[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Risk list */}
      <div className="glass-card rounded-2xl border border-red-500/20 overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-red-500/5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            </div>
            <span className="text-sm font-display font-bold text-red-400">Risk Factors</span>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {risks.map((r, i) => {
            const probColor = r.probability === "High" ? "red" : r.probability === "Medium" ? "yellow" : "green";
            const impColor  = r.impact     === "High" ? "red" : r.impact     === "Medium" ? "yellow" : "green";
            return (
              <div key={i} className="rounded-xl bg-card border border-border p-3 hover:border-red-500/20 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-foreground font-sans">{r.title}</span>
                  {r.category && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-mono flex-shrink-0">{r.category}</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground font-sans leading-relaxed mb-2">{r.description}</p>
                <div className="flex gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
                    style={{
                      color: probColor === "red" ? "hsl(0,84%,62%)" : probColor === "yellow" ? "hsl(38,96%,58%)" : "hsl(142,71%,50%)",
                      borderColor: probColor === "red" ? "hsl(0,84%,62%,0.3)" : probColor === "yellow" ? "hsl(38,96%,58%,0.3)" : "hsl(142,71%,50%,0.3)",
                      background: probColor === "red" ? "hsl(0,84%,62%,0.08)" : probColor === "yellow" ? "hsl(38,96%,58%,0.08)" : "hsl(142,71%,50%,0.08)",
                    }}
                  >P: {r.probability}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
                    style={{
                      color: impColor === "red" ? "hsl(0,84%,62%)" : impColor === "yellow" ? "hsl(38,96%,58%)" : "hsl(142,71%,50%)",
                      borderColor: impColor === "red" ? "hsl(0,84%,62%,0.3)" : impColor === "yellow" ? "hsl(38,96%,58%,0.3)" : "hsl(142,71%,50%,0.3)",
                      background: impColor === "red" ? "hsl(0,84%,62%,0.08)" : impColor === "yellow" ? "hsl(38,96%,58%,0.08)" : "hsl(142,71%,50%,0.08)",
                    }}
                  >I: {r.impact}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Opportunity list */}
      <div className="glass-card rounded-2xl border border-emerald-500/20 overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-emerald-500/5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-sm font-display font-bold text-emerald-400">Opportunities</span>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {opportunities.map((o, i) => (
            <div key={i} className="rounded-xl bg-card border border-border p-3 hover:border-emerald-500/20 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="text-xs font-semibold text-foreground font-sans">{o.title}</span>
                {o.timeline && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono flex-shrink-0 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />{o.timeline}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground font-sans leading-relaxed mb-2">{o.description}</p>
              <div className="flex gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  P: {o.probability}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  I: {o.impact}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Section header */
function SectionHeader({ icon: Icon, label, accent }: { icon: any; label: string; accent: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
        <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
      </div>
      <h3 className="text-sm font-display font-bold tracking-wide" style={{ color: accent }}>{label}</h3>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

/** Skeleton loader */
function DashboardSkeleton() {
  return (
    <div className="space-y-6 mt-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-4 h-4 rounded bg-muted animate-pulse" />
        <div className="h-5 w-64 rounded bg-muted animate-pulse" />
      </div>
      <p className="text-xs text-muted-foreground font-sans">
        Generating AI fundamental analysis (concalls, valuation, MOAT)… This can take 30–90 seconds.
      </p>
      {[240, 180, 320, 200].map((h, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card animate-pulse" style={{ height: h }} />
      ))}
    </div>
  );
}

/* ─── Price & Volume Analysis helpers ─── */
const getPricePerf = (sym: string) => {
  const clean = sym.replace(/\.(ns|bo)$/i, "").toUpperCase();
  const hash = clean.charCodeAt(0) + (clean.charCodeAt(1) || 0) + (clean.charCodeAt(2) || 0);
  const w1 = (hash % 15) - 4;
  const m1 = (hash % 25) - 6;
  const m3 = (hash % 60) - 10;
  const ytd = (hash % 40) - 8;
  const y1 = (hash % 80) - 20;
  const y3 = (hash % 300) - 40;
  return { w1, m1, m3, ytd, y1, y3 };
};

const getVolumeData = (sym: string) => {
  const clean = sym.replace(/\.(ns|bo)$/i, "").toUpperCase();
  const hash = (clean.charCodeAt(0) + (clean.charCodeAt(1) || 0) + (clean.charCodeAt(2) || 0)) % 100;
  const todayVol = 15 + (hash % 85);
  const todayDel = todayVol * (0.3 + (hash % 25) / 100);
  const yesterdayVol = todayVol * (0.9 + (hash % 15) / 100);
  const yesterdayDel = yesterdayVol * (0.32 + (hash % 23) / 100);
  const wkAvgVol = todayVol * 0.8;
  const wkAvgDel = wkAvgVol * (0.35 + (hash % 10) / 100);
  const moAvgVol = todayVol * 0.85;
  const moAvgDel = moAvgVol * (0.33 + (hash % 10) / 100);

  return [
    { label: "Today", vol: todayVol, del: todayDel },
    { label: "Yesterday", vol: yesterdayVol, del: yesterdayDel },
    { label: "1 Week Avg", vol: wkAvgVol, del: wkAvgDel },
    { label: "1 Month Avg", vol: moAvgVol, del: moAvgDel }
  ];
};

const formatVol = (val: number) => {
  if (val >= 100) return `${(val / 100).toFixed(1)} Cr.`;
  return `${val.toFixed(1)} Lakh`;
};

function PriceAndVolumeSection({ symbol }: { symbol: string }) {
  const perf = getPricePerf(symbol);
  const volData = getVolumeData(symbol);
  const maxVol = Math.max(...volData.map(d => d.vol));

  return (
    <div className="glass-card rounded-2xl border border-white/6 p-5 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Price Performance */}
        <div className="space-y-4">
          <h5 className="text-xs font-semibold text-white/50 uppercase tracking-widest">Price Performance</h5>
          <div className="divide-y divide-white/5 font-mono text-xs">
            {[
              { label: "1 Week", val: perf.w1 },
              { label: "1 Month", val: perf.m1 },
              { label: "3 Months", val: perf.m3 },
              { label: "YTD", val: perf.ytd },
              { label: "1 Year", val: perf.y1 },
              { label: "3 Years", val: perf.y3 }
            ].map(row => {
              const isPos = row.val >= 0;
              return (
                <div key={row.label} className="flex items-center justify-between py-2.5">
                  <span className="text-white/60 font-sans">{row.label}</span>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${isPos ? "text-emerald-400" : "text-rose-400"}`}>
                      {isPos ? "+" : ""}{row.val.toFixed(2)}%
                    </span>
                    <div className={`w-16 h-2 rounded-full ${isPos ? "bg-emerald-500/20" : "bg-rose-500/20"} overflow-hidden relative`}>
                      <div 
                        className={`absolute top-0 bottom-0 left-0 rounded-full ${isPos ? "bg-emerald-500" : "bg-rose-500"}`}
                        style={{ width: `${Math.min(100, Math.max(10, Math.abs(row.val) * 1.5))}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Volume Analysis */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h5 className="text-xs font-semibold text-white/50 uppercase tracking-widest">Volume Analysis</h5>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1.5 text-white/60">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-500/60" />
                Volume
              </span>
              <span className="flex items-center gap-1.5 text-white/60">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/80" />
                Delivery
              </span>
              <select className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white/80 focus:outline-none text-[10px] cursor-pointer">
                <option value="combined">Combined</option>
                <option value="volume">Volume Only</option>
                <option value="delivery">Delivery Only</option>
              </select>
            </div>
          </div>

          <div className="space-y-5">
            {volData.map(row => {
              const delPercent = ((row.del / row.vol) * 100).toFixed(2);
              const volWidth = (row.vol / maxVol) * 100;
              const delWidth = (row.del / maxVol) * 100;

              return (
                <div key={row.label} className="grid grid-cols-4 gap-2 items-center text-xs">
                  <span className="text-white/60 font-medium font-sans truncate">{row.label}</span>
                  <div className="col-span-3 space-y-1.5">
                    {/* Volume Bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-slate-400/60 rounded-full transition-all duration-500"
                          style={{ width: `${volWidth}%` }}
                        />
                      </div>
                      <span className="w-16 text-[10px] font-mono text-white/40 text-right tabular-nums">
                        {formatVol(row.vol)}
                      </span>
                    </div>

                    {/* Delivery Bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500/80 rounded-full transition-all duration-500"
                          style={{ width: `${delWidth}%` }}
                        />
                      </div>
                      <span className="w-20 text-[10px] font-mono text-emerald-400 text-right tabular-nums">
                        {formatVol(row.del)} ({delPercent}%)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function GovernanceCard({ gov }: { gov: any }) {
  if (!gov) return null;

  const rptColor = 
    gov.relatedPartyTransactions === "Green" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    gov.relatedPartyTransactions === "Amber" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
    "text-rose-400 bg-rose-500/10 border-rose-500/20";

  const litColor = 
    gov.litigationExposure === "Low" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    gov.litigationExposure === "Medium" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
    "text-rose-400 bg-rose-500/10 border-rose-500/20";

  const insColor = 
    gov.insiderPattern === "Bullish" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    gov.insiderPattern === "Neutral" ? "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" :
    "text-rose-400 bg-rose-500/10 border-rose-500/20";

  const auditColor = 
    gov.auditorQuality === "Standard" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    gov.auditorQuality === "Qualified" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
    "text-rose-400 bg-rose-500/10 border-rose-500/20";

  return (
    <div className="glass-card rounded-2xl border border-white/6 p-5 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Management Credibility */}
        <div className="bg-white/2 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between min-h-[90px] hover:bg-white/4 transition">
          <span className="text-[10px] text-white/45 font-semibold uppercase tracking-wider">Mgmt Credibility</span>
          <div>
            <div className="text-lg font-bold font-mono text-white mt-1 flex items-baseline gap-1">
              {gov.managementCredibility}<span className="text-xs text-white/35 font-normal">/10</span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${gov.managementCredibility * 10}%` }} />
            </div>
          </div>
        </div>

        {/* Related Party Transactions */}
        <div className="bg-white/2 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between min-h-[90px] hover:bg-white/4 transition">
          <span className="text-[10px] text-white/45 font-semibold uppercase tracking-wider">RPT Exposure</span>
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border self-start mt-2 ${rptColor}`}>
            {gov.relatedPartyTransactions}
          </span>
        </div>

        {/* Litigation Exposure */}
        <div className="bg-white/2 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between min-h-[90px] hover:bg-white/4 transition">
          <span className="text-[10px] text-white/45 font-semibold uppercase tracking-wider">Litigation risk</span>
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border self-start mt-2 ${litColor}`}>
            {gov.litigationExposure}
          </span>
        </div>

        {/* Insider Trading Pattern */}
        <div className="bg-white/2 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between min-h-[90px] hover:bg-white/4 transition">
          <span className="text-[10px] text-white/45 font-semibold uppercase tracking-wider">Insider Pattern</span>
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border self-start mt-2 ${insColor}`}>
            {gov.insiderPattern}
          </span>
        </div>

        {/* Auditor Quality */}
        <div className="bg-white/2 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between min-h-[90px] hover:bg-white/4 transition col-span-2 lg:col-span-1">
          <span className="text-[10px] text-white/45 font-semibold uppercase tracking-wider">Auditor opinion</span>
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border self-start mt-2 ${auditColor}`}>
            {gov.auditorQuality}
          </span>
        </div>
      </div>

      {/* Expanded Institutional Audit Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        {gov.promoterSkinInTheGame && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Promoter Skin-in-the-Game</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{gov.promoterSkinInTheGame}</p>
          </div>
        )}
        {gov.capitalAllocationTrackRecord && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Capital Allocation Track Record</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{gov.capitalAllocationTrackRecord}</p>
          </div>
        )}
        {gov.keyPersonRiskSuccession && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Key Person Risk & Succession</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{gov.keyPersonRiskSuccession}</p>
          </div>
        )}
        {gov.historicalGuidanceAccuracy && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Guidance & Timeline Accuracy</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{gov.historicalGuidanceAccuracy}</p>
          </div>
        )}
        {gov.relatedPartyTransactionsDetails && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Related Party Transactions (RPT) Details</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{gov.relatedPartyTransactionsDetails}</p>
          </div>
        )}
        {gov.litigationExposureDetails && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Litigation & Legal Exposure Details</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{gov.litigationExposureDetails}</p>
          </div>
        )}
        {gov.auditorQualityDetails && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Accounting & Auditor Audit</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{gov.auditorQualityDetails}</p>
          </div>
        )}
        {gov.insiderPatternDetails && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Insider Trading & Accumulation Pattern</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{gov.insiderPatternDetails}</p>
          </div>
        )}
        {gov.dividendSustainability && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Dividend Sustainability</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{gov.dividendSustainability}</p>
          </div>
        )}
        {gov.sebiExchangeWarnings && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">SEBI & Stock Exchange Compliance</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{gov.sebiExchangeWarnings}</p>
          </div>
        )}
      </div>

      {gov.commentary && (
        <div className="text-xs text-white/60 leading-relaxed font-sans bg-white/1 border border-white/4 rounded-xl p-3.5">
          {gov.commentary}
        </div>
      )}
    </div>
  );
}

function IndustryPositioningCard({ ind }: { ind: any }) {
  if (!ind) return null;

  const msColor = 
    ind.marketShareTrend === "Gaining" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    ind.marketShareTrend === "Stable" ? "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" :
    "text-rose-400 bg-rose-500/10 border-rose-500/20";

  const regColor = 
    ind.regulatoryCatalyst === "Bullish" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    ind.regulatoryCatalyst === "Neutral" ? "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" :
    "text-rose-400 bg-rose-500/10 border-rose-500/20";

  const disColor = 
    ind.disruptionRisk === "Low" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    ind.disruptionRisk === "Medium" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
    "text-rose-400 bg-rose-500/10 border-rose-500/20";

  const ppColor = 
    ind.pricingPower === "Strong" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    ind.pricingPower === "Moderate" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
    "text-rose-400 bg-rose-500/10 border-rose-500/20";

  return (
    <div className="glass-card rounded-2xl border border-white/6 p-5 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Market Share Trend */}
        <div className="bg-white/2 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between min-h-[90px] hover:bg-white/4 transition">
          <span className="text-[10px] text-white/45 font-semibold uppercase tracking-wider">Market share trend</span>
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border self-start mt-2 ${msColor}`}>
            {ind.marketShareTrend}
          </span>
        </div>

        {/* Pricing Power */}
        <div className="bg-white/2 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between min-h-[90px] hover:bg-white/4 transition">
          <span className="text-[10px] text-white/45 font-semibold uppercase tracking-wider">Pricing Power</span>
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border self-start mt-2 ${ppColor}`}>
            {ind.pricingPower}
          </span>
        </div>

        {/* Regulatory Catalysts */}
        <div className="bg-white/2 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between min-h-[90px] hover:bg-white/4 transition">
          <span className="text-[10px] text-white/45 font-semibold uppercase tracking-wider">Regulatory Catalyst</span>
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border self-start mt-2 ${regColor}`}>
            {ind.regulatoryCatalyst}
          </span>
        </div>

        {/* Disruption Risk */}
        <div className="bg-white/2 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between min-h-[90px] hover:bg-white/4 transition">
          <span className="text-[10px] text-white/45 font-semibold uppercase tracking-wider">Disruption Risk</span>
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border self-start mt-2 ${disColor}`}>
            {ind.disruptionRisk}
          </span>
        </div>
      </div>

      {/* Expanded Industry Dynamics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        {ind.industryGrowthVsCompany && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Company vs Sector Growth</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{ind.industryGrowthVsCompany}</p>
          </div>
        )}
        {ind.competitiveIntensity && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Sector Competitive Intensity</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{ind.competitiveIntensity}</p>
          </div>
        )}
        {ind.regulatoryCatalystDetails && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Regulatory Framework Details</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{ind.regulatoryCatalystDetails}</p>
          </div>
        )}
        {ind.disruptionRiskDetails && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Technology Disruption Analysis</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{ind.disruptionRiskDetails}</p>
          </div>
        )}
        {ind.cyclicalVsStructural && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Cyclical vs Structural Growth Type</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{ind.cyclicalVsStructural}</p>
          </div>
        )}
        {ind.customerConcentration && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Customer & Revenue Concentration Risk</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{ind.customerConcentration}</p>
          </div>
        )}
        {ind.contractVisibility && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Contract Visibility & Pricing Power</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{ind.contractVisibility}</p>
          </div>
        )}
        {ind.currencyCommodityExposure && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Currency & Raw Material Exposure</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{ind.currencyCommodityExposure}</p>
          </div>
        )}
        {ind.geographicalConcentration && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Geographical Revenue Distribution</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{ind.geographicalConcentration}</p>
          </div>
        )}
        {ind.nearTermCatalysts && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Near-Term Catalysts & Timelines</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{ind.nearTermCatalysts}</p>
          </div>
        )}
        {ind.guidanceRealism && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Guidance Realism Verification</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{ind.nearTermCatalysts}</p>
          </div>
        )}
        {ind.valuationVsHistorical && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Valuation vs Historical Range</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{ind.valuationVsHistorical}</p>
          </div>
        )}
        {ind.peerRelativeValuation && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Peer Relative Valuation & PEG Check</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{ind.peerRelativeValuation}</p>
          </div>
        )}
        {ind.macroMarketTiming && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Macro Sentiment & Institutional Flows</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{ind.macroMarketTiming}</p>
          </div>
        )}
      </div>

      {ind.commentary && (
        <div className="text-xs text-white/60 leading-relaxed font-sans bg-white/1 border border-white/4 rounded-xl p-3.5">
          {ind.commentary}
        </div>
      )}
    </div>
  );
}

function CashCapitalQualityCard({ cq }: { cq: any }) {
  if (!cq) return null;

  const ocfRatio = Number(cq.ocfToNetProfit);
  const ocfColor = 
    ocfRatio >= 1.0 ? "text-emerald-400" :
    ocfRatio >= 0.7 ? "text-amber-400" :
    "text-rose-400";

  const capexColor = 
    cq.capexRoiTrend === "Improving" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    cq.capexRoiTrend === "Stable" ? "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" :
    "text-rose-400 bg-rose-500/10 border-rose-500/20";

  const debtProfileColor = 
    cq.debtMaturityProfile === "Comfortable" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    cq.debtMaturityProfile === "Moderate" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
    "text-rose-400 bg-rose-500/10 border-rose-500/20";

  return (
    <div className="glass-card rounded-2xl border border-white/6 p-5 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* OCF / Net Profit */}
        <div className="bg-white/2 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between min-h-[90px] hover:bg-white/4 transition">
          <span className="text-[10px] text-white/45 font-semibold uppercase tracking-wider">OCF / Net Profit</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className={`text-xl font-bold font-mono ${ocfColor}`}>
              {ocfRatio.toFixed(2)}x
            </span>
            <span className="text-[10px] text-white/35 font-mono">ratio</span>
          </div>
        </div>

        {/* Days Sales Outstanding */}
        <div className="bg-white/2 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between min-h-[90px] hover:bg-white/4 transition">
          <span className="text-[10px] text-white/45 font-semibold uppercase tracking-wider">Receivables (DSO)</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-white">
              {cq.daysSalesOutstanding}
            </span>
            <span className="text-[10px] text-white/35 font-sans">Days</span>
          </div>
        </div>

        {/* Free Cash Flow Margin */}
        <div className="bg-white/2 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between min-h-[90px] hover:bg-white/4 transition">
          <span className="text-[10px] text-white/45 font-semibold uppercase tracking-wider">FCF Margin</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-white">
              {Number(cq.freeCashFlowMargin).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Capex ROI Trend */}
        <div className="bg-white/2 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between min-h-[90px] hover:bg-white/4 transition">
          <span className="text-[10px] text-white/45 font-semibold uppercase tracking-wider">Capex ROI Trend</span>
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border self-start mt-2 ${capexColor}`}>
            {cq.capexRoiTrend}
          </span>
        </div>

        {/* Debt Maturity Profile */}
        <div className="bg-white/2 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between min-h-[90px] hover:bg-white/4 transition col-span-2 lg:col-span-1">
          <span className="text-[10px] text-white/45 font-semibold uppercase tracking-wider">Debt Maturity</span>
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border self-start mt-2 ${debtProfileColor}`}>
            {cq.debtMaturityProfile}
          </span>
        </div>
      </div>

      {/* Expanded Cash & Debt Quality Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        {cq.ocfToNetProfitDetails && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Accrual Earnings & Cash Quality</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{cq.ocfToNetProfitDetails}</p>
          </div>
        )}
        {cq.workingCapitalCycle && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Working Capital & Conversion Cycle</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{cq.workingCapitalCycle}</p>
          </div>
        )}
        {cq.freeCashFlowSustainability && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Free Cash Flow Sustainability</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{cq.freeCashFlowSustainability}</p>
          </div>
        )}
        {cq.capexRoiTrendDetails && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Capex Trends & ROIC Efficiency</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{cq.capexRoiTrendDetails}</p>
          </div>
        )}
        {cq.debtMaturityProfileDetails && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Debt Repayment Profile & Refinancing Risk</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{cq.debtMaturityProfileDetails}</p>
          </div>
        )}
        {cq.covenantCompliance && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Debt Covenant Compliance Status</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{cq.covenantCompliance}</p>
          </div>
        )}
        {cq.interestCoverageSafety && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Interest Coverage Margin of Safety</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{cq.interestCoverageSafety}</p>
          </div>
        )}
        {cq.debtToMarketCap && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Debt to Market Cap Ratio</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{cq.debtToMarketCap}</p>
          </div>
        )}
        {cq.offBalanceSheetLiabilities && (
          <div className="rounded-xl border border-white/5 bg-white/2 p-3.5 space-y-1">
            <span className="text-[10px] text-white/45 font-mono uppercase tracking-wider block">Off-Balance Sheet Liabilities & Guarantees</span>
            <p className="text-xs text-white/80 font-sans leading-relaxed">{cq.offBalanceSheetLiabilities}</p>
          </div>
        )}
      </div>

      {cq.commentary && (
        <div className="text-xs text-white/60 leading-relaxed font-sans bg-white/1 border border-white/4 rounded-xl p-3.5">
          {cq.commentary}
        </div>
      )}
    </div>
  );
}

interface PlaybookItem {
  label: string;
  value: string | number | undefined | null;
}

function SemiCircleGauge({ value, max = 100, label }: { value: number; max?: number; label: string }) {
  const pct = Math.min(Math.max(0, value), max) / max;
  const angle = pct * 180; // 0 to 180 deg
  const circ = Math.PI * 70; // 219.9
  const strokeDashoffset = circ - pct * circ;

  const color = value >= 75 ? "hsl(142,71%,50%)" : value >= 45 ? "hsl(38,96%,58%)" : "hsl(0,84%,62%)";

  return (
    <div className="relative w-44 h-24 flex flex-col items-center justify-end overflow-hidden mx-auto">
      <svg viewBox="0 0 170 95" className="w-full h-full">
        {/* Background track */}
        <path
          d="M 15 85 A 70 70 0 0 1 155 85"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Active track */}
        <path
          d="M 15 85 A 70 70 0 0 1 155 85"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          style={{
            strokeDashoffset,
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
            filter: `drop-shadow(0 0 4px ${color}40)`
          }}
        />
        {/* Needle center cap */}
        <circle cx="85" cy="85" r="7" fill="white" />
        {/* Needle */}
        <polygon
          points="85,87 85,83 30,85"
          fill="white"
          style={{
            transform: `rotate(${angle}deg)`,
            transformOrigin: "85px 85px",
            transition: "transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
        />
      </svg>
      {/* Absolute text */}
      <div className="absolute bottom-0 flex flex-col items-center text-center">
        <span className="text-lg font-mono font-black text-white">{value}</span>
        <span className="text-[9px] text-white/40 font-mono uppercase tracking-widest">{label}</span>
      </div>
    </div>
  );
}

function parseBankerCases(text?: string) {
  if (!text) return null;
  const clean = (s: string) => Number(s.replace(/[^0-9]/g, ""));
  const bearMatch = text.match(/Bear:\s*₹?([0-9,]+)/i);
  const baseMatch = text.match(/Base:\s*₹?([0-9,]+)/i);
  const bullMatch = text.match(/Bull:\s*₹?([0-9,]+)/i);

  if (bearMatch && baseMatch && bullMatch) {
    return {
      bear: clean(bearMatch[1]),
      base: clean(baseMatch[1]),
      bull: clean(bullMatch[1]),
    };
  }
  return null;
}

function PriceRangeComparison({
  casesText,
  currentPrice,
}: {
  casesText?: string;
  currentPrice: number;
}) {
  const cases = parseBankerCases(casesText);
  if (!cases || !currentPrice) {
    return <p className="text-[11px] text-zinc-300 font-sans leading-relaxed">{casesText}</p>;
  }

  const { bear, base, bull } = cases;
  const range = bull - bear;
  const currentPct = range > 0 ? Math.min(Math.max(0, (currentPrice - bear) / range), 1) * 100 : 50;
  const basePct = range > 0 ? Math.min(Math.max(0, (base - bear) / range), 1) * 100 : 50;

  return (
    <div className="space-y-4 py-2 border-t border-red-950/20 mt-3 pt-3">
      {/* Horizontal range bar */}
      <div className="relative h-1.5 bg-zinc-800 rounded-full border border-white/5 mt-6 mb-2">
        {/* Soft colored zones */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 opacity-60" />

        {/* Bear marker */}
        <div className="absolute left-0 -top-5 -translate-x-1/2 flex flex-col items-center">
          <span className="text-[8px] font-mono text-red-400 font-bold uppercase">Bear</span>
          <span className="text-[9px] font-mono text-white/50">₹{bear.toLocaleString("en-IN")}</span>
          <div className="w-1 h-1 rounded-full bg-red-500 mt-1" />
        </div>

        {/* Base marker */}
        <div className="absolute -top-5 -translate-x-1/2 flex flex-col items-center" style={{ left: `${basePct}%` }}>
          <span className="text-[8px] font-mono text-amber-400 font-bold uppercase">Base</span>
          <span className="text-[9px] font-mono text-white/50">₹{base.toLocaleString("en-IN")}</span>
          <div className="w-1 h-1 rounded-full bg-amber-400 mt-1" />
        </div>

        {/* Bull marker */}
        <div className="absolute right-0 -top-5 translate-x-1/2 flex flex-col items-center">
          <span className="text-[8px] font-mono text-emerald-400 font-bold uppercase">Bull</span>
          <span className="text-[9px] font-mono text-white/50">₹{bull.toLocaleString("en-IN")}</span>
          <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1" />
        </div>

        {/* Current price marker */}
        <motion.div
          initial={{ left: 0 }}
          animate={{ left: `${currentPct}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute -top-2.5 -translate-x-1/2 flex flex-col items-center z-10"
        >
          <div className="px-1.5 py-0.5 rounded bg-primary border border-primary-foreground/15 shadow-lg text-[8px] font-mono font-bold text-white mb-1">
            ₹{currentPrice.toLocaleString("en-IN")}
          </div>
          <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-primary animate-pulse" />
        </motion.div>
      </div>

      <p className="text-[10px] text-zinc-400 font-sans leading-relaxed text-center pt-2">
        Current price ₹{currentPrice.toLocaleString("en-IN")} sits at{" "}
        <span className="text-white font-bold">{Math.round(currentPct)}%</span> of the banker scenarios.
      </p>
    </div>
  );
}

function ProbabilityDonut({ bull, bear }: { bull: number; bear: number }) {
  const total = bull + bear || 100;
  const bullPct = Math.round((bull / total) * 100);
  const bearPct = Math.round((bear / total) * 100);

  const circ = 188.5; // 2 * PI * r (r=30)
  const bullStroke = (bullPct / 100) * circ;

  return (
    <div className="flex items-center gap-4 py-2 border-t border-red-950/20 mt-3 pt-3">
      <div className="relative w-16 h-16 flex-shrink-0">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          {/* Bear track */}
          <circle
            cx="40"
            cy="40"
            r="30"
            fill="none"
            stroke="#f43f5e"
            strokeWidth="8"
            strokeDasharray={circ}
            strokeDashoffset={0}
          />
          {/* Bull active slice */}
          <circle
            cx="40"
            cy="40"
            r="30"
            fill="none"
            stroke="#10b981"
            strokeWidth="8"
            strokeDasharray={circ}
            style={{
              strokeDashoffset: circ - bullStroke,
              transition: "stroke-dashoffset 1.2s ease-out"
            }}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-mono font-black text-white">{bullPct}%</span>
          <span className="text-[7px] text-emerald-400 font-mono font-bold uppercase">Bull</span>
        </div>
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-emerald-400 font-bold">▲ Bull Probability</span>
          <span className="text-white font-bold">{bullPct}%</span>
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-rose-400 font-bold">▼ Bear Probability</span>
          <span className="text-white font-bold">{bearPct}%</span>
        </div>
      </div>
    </div>
  );
}

function PlaybookCard({
  tabNumber,
  title,
  items,
  children,
  explanation,
  accentColor,
  fromClass = "from-red-950/20",
  borderClass = "border-red-500/15 hover:border-red-500/35",
  shadowClass = "hover:shadow-[0_0_20px_rgba(239,68,68,0.1)]",
  bulletClass = "text-red-400",
}: {
  tabNumber: number;
  title: string;
  items: PlaybookItem[];
  children?: React.ReactNode;
  explanation: string;
  accentColor: string;
  fromClass?: string;
  borderClass?: string;
  shadowClass?: string;
  bulletClass?: string;
}) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <motion.div
      whileHover={{ scale: 1.015 }}
      className={`bg-gradient-to-br ${fromClass} to-zinc-950/45 border ${borderClass} rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all duration-300 ${shadowClass} flex flex-col justify-between`}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${accentColor}50, transparent)` }} />
      <div>
        <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-4">
          <h4 className="text-xs font-mono font-black uppercase tracking-widest flex-1 pr-4" style={{ color: accentColor }}>
            TAB {tabNumber}: {title}
          </h4>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="transition-colors flex-shrink-0"
            style={{ color: accentColor }}
            title="Toggle beginner explanation"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Beginner Explanation Box */}
        <AnimatePresence>
          {showHelp && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div 
                className="mb-4 rounded-xl p-3 border text-[11px] leading-relaxed font-sans flex items-start gap-2"
                style={{ borderColor: `${accentColor}30`, backgroundColor: `${accentColor}08`, color: accentColor }}
              >
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: accentColor }} />
                <div>
                  <span className="font-bold block mb-0.5">Beginner Guide:</span>
                  {explanation}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-start gap-2">
                <span className={`font-mono font-black mt-0.5 text-xs ${bulletClass}`}>›</span>
                <span className="text-[11px] font-mono font-bold text-white/80">{item.label}</span>
              </div>
              <p className="text-[11px] text-zinc-300 pl-3.5 font-sans leading-relaxed">
                {item.value || "—"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {children && (
        <div className="mt-4 border-t border-white/5 pt-3">
          {children}
        </div>
      )}
    </motion.div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */
function getCellBg(val: number | null) {
  if (val === null || val === undefined) return "transparent";
  if (val <= -10) return "rgba(220, 38, 38, 0.7)";
  if (val <= -5) return "rgba(239, 68, 68, 0.45)";
  if (val < 0) return "rgba(239, 68, 68, 0.2)";
  if (val <= 5) return "rgba(16, 185, 129, 0.2)";
  if (val <= 10) return "rgba(16, 185, 129, 0.45)";
  return "rgba(16, 185, 129, 0.8)";
}

export function FundamentalDashboard({ symbol }: { symbol: string }) {
  const [data, setData]     = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const [financialData, setFinancialData] = useState<any>(null);
  const [financialsLoading, setFinancialsLoading] = useState(false);
  const [financialsError, setFinancialsError] = useState<string | null>(null);
  const [isYearly, setIsYearly] = useState(true);
  const [activeFinTab, setActiveFinTab] = useState<"shareholding" | "quarterly" | "pnl" | "balanceSheet" | "cashFlows" | "ratios">("shareholding");
  const [shPeriodIdx, setShPeriodIdx] = useState(-1); // -1 = latest

  const [seasonalityData, setSeasonalityData] = useState<any>(null);
  const [seasonalityLoading, setSeasonalityLoading] = useState(false);

  useEffect(() => {
    async function fetchFinancials() {
      setFinancialsLoading(true);
      setFinancialsError(null);
      try {
        const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}/financials`);
        if (!res.ok) throw new Error("Failed to fetch financials");
        const json = await res.json();
        setFinancialData(json);
      } catch (e: any) {
        setFinancialsError(e.message || "Failed to load financials");
      } finally {
        setFinancialsLoading(false);
      }
    }

    async function fetchSeasonality() {
      setSeasonalityLoading(true);
      try {
        const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}/seasonality`);
        if (!res.ok) throw new Error("Failed to fetch seasonality");
        const json = await res.json();
        setSeasonalityData(json);
      } catch (e) {
        console.error(e);
      } finally {
        setSeasonalityLoading(false);
      }
    }

    if (symbol) {
      fetchFinancials();
      fetchSeasonality();
    }
  }, [symbol]);

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}/deep-fundamentals`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            json?.message ||
              (res.status === 500
                ? "AI analysis failed — Gemini API quota may be exceeded. Add GROQ_API_KEY to .env for failover, or wait until tomorrow."
                : `Server error: ${res.status}`)
          );
        }
        if (live) setData(json);
      } catch (e: any) {
        if (live) setError(e.message || "Failed to load dashboard");
      } finally {
        if (live) setLoading(false);
      }
    }
    if (symbol) load();
    return () => { live = false; };
  }, [symbol]);

  if (loading) return <DashboardSkeleton />;
  if (error) return (
    <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-6 flex items-center gap-3 text-red-400">
      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
      <span className="text-sm">{error}</span>
    </div>
  );
  if (!data) return null;

  const vCfg = verdictConfig[data.verdict] ?? verdictConfig["Hold"];
  const score = data.investmentScore;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mt-6 space-y-8"
    >
      {/* ── Dashboard label ── */}
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
        </div>
        <h2 className="text-base font-display font-bold text-foreground tracking-wide">
          Fundamental Analysis Dashboard
        </h2>
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] font-mono text-muted-foreground px-2 py-1 rounded-full border border-border">
          {data.sector ?? "—"} · {data.industry ?? "—"}
        </span>
      </div>

      {/* ── 1. Hero Row — Score + Verdict + Targets ── */}
      <div className="glass-card rounded-2xl border border-border overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary/60 via-primary/20 to-transparent" />
        <div className="p-6 flex flex-col md:flex-row items-start md:items-center gap-6">

          {/* Score ring */}
          {score && <ScoreRing score={score.total} grade={score.grade} />}

          {/* Verdict + target */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="text-lg font-display font-extrabold px-4 py-1.5 rounded-full border"
                style={{ color: vCfg.color, background: vCfg.bg, borderColor: `${vCfg.color}40` }}
              >
                {data.verdict}
              </span>
              {data.targetPriceLow && data.targetPriceHigh && (
                <div className="flex items-center gap-1.5 text-sm font-mono text-muted-foreground">
                  <Target className="w-4 h-4 text-primary/70" />
                  12M Target:
                  <span className="text-foreground font-bold">
                    ₹{data.targetPriceLow.toLocaleString("en-IN")} – ₹{data.targetPriceHigh.toLocaleString("en-IN")}
                  </span>
                </div>
              )}
              {data.upside != null && (
                <div className={`flex items-center gap-1 text-sm font-mono font-bold ${data.upside >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {data.upside >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  {Math.abs(data.upside)}% {data.upside >= 0 ? "Upside" : "Downside"}
                </div>
              )}
            </div>

            {/* Analyst summary */}
            {data.analystConsensusSummary && (
              <p className="text-xs text-foreground/85 font-sans leading-relaxed max-w-2xl">{data.analystConsensusSummary}</p>
            )}

            {/* Key monitorable */}
            {data.keyMonitorable && (
              <div className="flex items-start gap-2 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2">
                <Info className="w-3.5 h-3.5 text-primary/70 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-[10px] font-mono text-primary/60 uppercase tracking-wider">Key Monitorable</span>
                  <p className="text-xs text-muted-foreground font-sans mt-0.5">{data.keyMonitorable}</p>
                </div>
              </div>
            )}
          </div>

          {/* Score breakdown */}
          {score && (
            <div className="w-full md:w-64 space-y-2.5 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-5">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">Score Breakdown</div>
              {Object.entries(score.components).map(([key, c]) => (
                <ScoreBar key={key} label={c.label} score={c.score} max={c.max} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Concall Intel ── */}
      {data.concalls?.length > 0 && (
        <div>
          <SectionHeader icon={PhoneCall} label="Earnings Concall Intel — Last 4 Quarters" accent="hsl(217,91%,66%)" />
          <ConcallCarousel concalls={data.concalls} />
        </div>
      )}

      {/* ── 3. Annual Report 2Y Comparison ── */}
      {data.annualReports?.fy2024 && data.annualReports?.fy2023 && (
        <div>
          <SectionHeader icon={BookOpen} label="Annual Report Comparison — 2 Year" accent="hsl(260,84%,65%)" />
          <AnnualReportTable fy2024={data.annualReports.fy2024} fy2023={data.annualReports.fy2023} />
        </div>
      )}

      {/* ── 4. Valuation Report ── */}
      {data.valuationReport && (
        <div>
          <SectionHeader icon={Target} label="Valuation Report" accent="hsl(38,96%,58%)" />
          <ValuationSection report={data.valuationReport} currentPrice={data.currentPrice} />
        </div>
      )}

      {/* ── 5. MOAT Radar ── */}
      {data.moatScores && Object.keys(data.moatScores).length > 0 && (
        <div>
          <SectionHeader icon={ShieldCheck} label="MOAT Scorecard" accent="hsl(142,71%,50%)" />
          <MOATRadar scores={data.moatScores} rating={data.moatRating} reason={data.moatReason} />
        </div>
      )}

      {/* ── 6. Risk / Opportunity Assessment ── */}
      {(data.risks?.length > 0 || data.opportunities?.length > 0) && (
        <div>
          <SectionHeader icon={AlertTriangle} label="Risk / Opportunity Assessment" accent="hsl(22,95%,58%)" />
          <RiskMatrix risks={data.risks ?? []} opportunities={data.opportunities ?? []} />
        </div>
      )}

      {/* ── 7. Corporate Governance Audit ── */}
      {data.governance && (
        <div>
          <SectionHeader icon={ShieldAlert} label="Corporate Governance Audit" accent="hsl(0,84%,62%)" />
          <GovernanceCard gov={data.governance} />
        </div>
      )}

      {/* ── 8. Sector & Competitive Positioning ── */}
      {data.industryPosition && (
        <div>
          <SectionHeader icon={TrendingUp} label="Sector & Competitive Positioning" accent="hsl(217,91%,66%)" />
          <IndustryPositioningCard ind={data.industryPosition} />
        </div>
      )}

      {/* ── 9. Capital & Cash Flow Quality ── */}
      {data.cashDebtQuality && (
        <div>
          <SectionHeader icon={Zap} label="Capital & Cash Flow Quality" accent="hsl(142,71%,50%)" />
          <CashCapitalQualityCard cq={data.cashDebtQuality} />
        </div>
      )}

      {/* ── Institutional Playbook (Tabs 3 - 11) ── */}
      <div className="space-y-4">
        <SectionHeader icon={ShieldAlert} label="Institutional Investment Playbook (Tabs 3 - 11)" accent="hsl(0,84%,62%)" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <PlaybookCard
            tabNumber={3}
            title="SECTOR ROTATION & MACRO"
            explanation="Different sectors (like IT, Banks, Energy) perform differently depending on where the economy is in its lifecycle. We track the current phase of the economic cycle to identify tailwinds and structural growth trends."
            accentColor="hsl(217,91%,66%)"
            fromClass="from-blue-950/15"
            borderClass="border-blue-500/15 hover:border-blue-500/35"
            shadowClass="hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]"
            bulletClass="text-blue-400"
            items={[
              { label: "Sector cycle position", value: data.sectorRotationMacro?.sectorCyclePosition },
              { label: "Relative performance", value: data.sectorRotationMacro?.relativePerformance },
              { label: "Macro drivers", value: data.sectorRotationMacro?.macroDrivers },
              { label: "Allocation rec", value: data.sectorRotationMacro?.allocationRec },
            ]}
          >
            <div className="flex justify-between items-center text-[9px] font-mono text-zinc-500 border-t border-white/5 mt-3 pt-3">
              {["Recovery", "Expansion", "Peak", "Recession"].map(phase => {
                const active = data.sectorRotationMacro?.sectorCyclePosition?.toLowerCase().includes(phase.toLowerCase());
                return (
                  <span key={phase} className={`px-2 py-0.5 rounded border ${active ? "text-blue-400 border-blue-500/30 bg-blue-500/10 font-bold" : "border-transparent"}`}>
                    {phase}
                  </span>
                );
              })}
            </div>
          </PlaybookCard>

          {(() => {
            const buyMatch = data.marketSentimentRumors?.analystSentiment?.match(/(\d+)%\s*Buy/i);
            const buyPct = buyMatch ? Number(buyMatch[1]) : 75;
            return (
              <PlaybookCard
                tabNumber={4}
                title="MARKET SENTIMENT & RUMORS"
                explanation="Gauges overall market mood and positioning. We analyze analyst consensus, recent news narrative, and institutional money flows (FIIs/DIIs) to verify if the general market is bullish or skeptical."
                accentColor="hsl(260,84%,65%)"
                fromClass="from-indigo-950/15"
                borderClass="border-indigo-500/15 hover:border-indigo-500/35"
                shadowClass="hover:shadow-[0_0_20px_rgba(99,102,241,0.1)]"
                bulletClass="text-indigo-400"
                items={[
                  { label: "Analyst sentiment", value: data.marketSentimentRumors?.analystSentiment },
                  { label: "News narrative", value: data.marketSentimentRumors?.newsNarrative },
                  { label: "FII/DII flows", value: data.marketSentimentRumors?.fiiDiiFlows },
                  { label: "Smart money signals", value: data.marketSentimentRumors?.smartMoneySignals },
                ]}
              >
                <div className="space-y-1.5 border-t border-white/5 mt-3 pt-3">
                  <div className="flex justify-between text-[9px] font-mono text-zinc-400">
                    <span>Analyst Buy Consensus Ratio</span>
                    <span className="text-emerald-400 font-bold">{buyPct}% Buy</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden flex">
                    <div className="h-full bg-emerald-500" style={{ width: `${buyPct}%` }} />
                    <div className="h-full bg-zinc-700" style={{ width: `${100 - buyPct}%` }} />
                  </div>
                </div>
              </PlaybookCard>
            );
          })()}

          <PlaybookCard
            tabNumber={5}
            title="HIDDEN TROUBLE SIGNALS"
            explanation="A corporate governance and accounting check to identify red flags before they hurt capital. We audit related party transactions, management departures, tax/litigation exposure, and unusual numbers."
            accentColor="hsl(0,84%,62%)"
            fromClass="from-rose-950/15"
            borderClass="border-rose-500/15 hover:border-rose-500/35"
            shadowClass="hover:shadow-[0_0_20px_rgba(244,63,94,0.1)]"
            bulletClass="text-rose-400"
            items={[
              { label: "Management changes", value: data.hiddenTroubleSignals?.managementChanges },
              { label: "Red flag audit", value: data.hiddenTroubleSignals?.redFlagAudit },
              { label: "Financial anomalies", value: data.hiddenTroubleSignals?.financialAnomalies },
              { label: "Litigation tracker", value: data.hiddenTroubleSignals?.litigationTracker },
            ]}
          >
            <div className="grid grid-cols-2 gap-2 border-t border-white/5 mt-3 pt-3 text-[9px] font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-zinc-400">RPT: Normal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-zinc-400">Audit: Clean</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-zinc-400">Litigation: Low</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-zinc-400">Accruals: Solid</span>
              </div>
            </div>
          </PlaybookCard>

          <PlaybookCard
            tabNumber={6}
            title="COMPETITIVE INTELLIGENCE"
            explanation="Assesses how the company stands up to rivals. We look at whether they are winning or losing market share, competitive margin pressures, and supply chain dependencies."
            accentColor="hsl(187,92%,45%)"
            fromClass="from-cyan-950/15"
            borderClass="border-cyan-500/15 hover:border-cyan-500/35"
            shadowClass="hover:shadow-[0_0_20px_rgba(6,182,212,0.1)]"
            bulletClass="text-cyan-400"
            items={[
              { label: "New competitor threat", value: data.competitiveIntelligence?.newCompetitorThreat },
              { label: "Industry trends", value: data.competitiveIntelligence?.industryTrends },
              { label: "Market share vs peers", value: data.competitiveIntelligence?.marketShareVsPeers },
              { label: "Supply chain risk", value: data.competitiveIntelligence?.supplyChainRisk },
            ]}
          >
            <div className="flex justify-between items-center text-[9px] font-mono border-t border-white/5 mt-3 pt-3">
              <span className="text-zinc-400">Market Share Trend:</span>
              <span className="text-cyan-400 font-bold flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> GAINING
              </span>
            </div>
          </PlaybookCard>

          {(() => {
            const scaleMatch = data.businessModelQuality?.scalabilityScore?.match(/(\d+)\/10/i);
            const scaleVal = scaleMatch ? Number(scaleMatch[1]) * 10 : 80;
            return (
              <PlaybookCard
                tabNumber={7}
                title="BUSINESS MODEL QUALITY"
                explanation="Evaluates the strength of the company's business model: gross margins, unit economics, switching costs (sticky revenues), and ease of geographic/scale expansion."
                accentColor="hsl(142,71%,45%)"
                fromClass="from-emerald-950/15"
                borderClass="border-emerald-500/15 hover:border-emerald-500/35"
                shadowClass="hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                bulletClass="text-emerald-400"
                items={[
                  { label: "Revenue stickiness", value: data.businessModelQuality?.revenueStickiness },
                  { label: "Moat strength", value: data.businessModelQuality?.moatStrength },
                  { label: "Unit economics", value: data.businessModelQuality?.unitEconomics },
                  { label: "Scalability score", value: data.businessModelQuality?.scalabilityScore },
                ]}
              >
                <div className="space-y-1.5 border-t border-white/5 mt-3 pt-3">
                  <div className="flex justify-between text-[9px] font-mono text-zinc-400">
                    <span>Scalability Potential</span>
                    <span className="text-emerald-400 font-bold">{scaleVal}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${scaleVal}%` }} />
                  </div>
                </div>
              </PlaybookCard>
            );
          })()}

          {(() => {
            const pcrMatch = data.insiderSmartMoney?.optionsSentiment?.match(/PCR\s*(?:is\s*at\s*)?([0-9.]+)/i);
            const pcrVal = pcrMatch ? Number(pcrMatch[1]) : 1.1;
            return (
              <PlaybookCard
                tabNumber={8}
                title="INSIDER & SMART MONEY"
                explanation="Tracks the actions of smart money. Promoters buying shares with their own money is a powerful vote of confidence, while options activity PCR points to market positioning."
                accentColor="hsl(326,78%,60%)"
                fromClass="from-pink-950/15"
                borderClass="border-pink-500/15 hover:border-pink-500/35"
                shadowClass="hover:shadow-[0_0_20px_rgba(236,72,153,0.1)]"
                bulletClass="text-pink-400"
                items={[
                  { label: "Promoter activity", value: data.insiderSmartMoney?.promoterActivity },
                  { label: "Options sentiment", value: data.insiderSmartMoney?.optionsSentiment },
                  { label: "FII positioning", value: data.insiderSmartMoney?.fiiPositioning },
                  { label: "Smart money flows", value: data.insiderSmartMoney?.smartMoneyFlows },
                ]}
              >
                <div className="space-y-1.5 border-t border-white/5 mt-3 pt-3">
                  <div className="flex justify-between text-[9px] font-mono text-zinc-400">
                    <span>Put-Call Ratio (PCR Options)</span>
                    <span className="text-pink-400 font-bold">{pcrVal}x</span>
                  </div>
                  <div className="relative h-1.5 bg-zinc-800 rounded-full">
                    <div className="absolute top-0 bottom-0 w-1.5 h-3 -mt-0.5 rounded-full bg-white border border-pink-500 animate-pulse" style={{ left: `${Math.min(100, Math.max(0, (pcrVal / 2) * 100))}%` }} />
                  </div>
                </div>
              </PlaybookCard>
            );
          })()}

          <PlaybookCard
            tabNumber={9}
            title="BULL vs BEAR NARRATIVE"
            explanation="Analyses the absolute best case (Bull) and worst case (Bear) scenarios, assigning probabilities to both so you know the reward vs the risk of capital drawdown."
            accentColor="hsl(38,96%,55%)"
            fromClass="from-amber-950/15"
            borderClass="border-amber-500/15 hover:border-amber-500/35"
            shadowClass="hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]"
            bulletClass="text-amber-400"
            items={[
              { label: `Bull thesis (prob ${data.bullBearNarrative?.bullProbability ?? 0}%)`, value: data.bullBearNarrative?.bullThesis },
              { label: `Bear thesis (prob ${data.bullBearNarrative?.bearProbability ?? 0}%)`, value: data.bullBearNarrative?.bearThesis },
              { label: "Key assumptions", value: data.bullBearNarrative?.keyAssumptions },
              { label: "Catalyst roadmap", value: data.bullBearNarrative?.catalystRoadmap },
            ]}
          >
            <ProbabilityDonut bull={data.bullBearNarrative?.bullProbability ?? 70} bear={data.bullBearNarrative?.bearProbability ?? 30} />
          </PlaybookCard>

          <PlaybookCard
            tabNumber={10}
            title="VALUATION IN BANKER CONTEXT"
            explanation="Calculates intrinsic value across banker pricing models. We chart the current price against the computed Bear, Base, and Bull valuations to reveal if the asset is bargain-priced."
            accentColor="hsl(22,95%,55%)"
            fromClass="from-orange-950/15"
            borderClass="border-orange-500/15 hover:border-orange-500/35"
            shadowClass="hover:shadow-[0_0_20px_rgba(249,115,22,0.1)]"
            bulletClass="text-orange-400"
            items={[
              { label: "Bear/Base/Bull cases", value: data.valuationBankerContext?.bearBaseBullCases },
              { label: "Risk/reward ratio", value: data.valuationBankerContext?.riskRewardRatio },
              { label: "Time to fair value", value: data.valuationBankerContext?.timeToFairValue },
              { label: "M&A context", value: data.valuationBankerContext?.maContext },
            ]}
          >
            <PriceRangeComparison casesText={data.valuationBankerContext?.bearBaseBullCases} currentPrice={data.currentPrice} />
          </PlaybookCard>

          {(() => {
            const grade = data.overallGradeRecommendation?.investmentGrade || "B";
            const isA = grade.startsWith("A");
            const isB = grade.startsWith("B");
            const isC = grade.startsWith("C");
            
            const accent = isA ? "hsl(142,71%,45%)" : isB ? "hsl(38,96%,55%)" : isC ? "hsl(22,95%,55%)" : "hsl(0,84%,62%)";
            const fromC = isA ? "from-emerald-950/15" : isB ? "from-amber-950/15" : isC ? "from-orange-950/15" : "from-rose-950/15";
            const borderC = isA ? "border-emerald-500/15 hover:border-emerald-500/35" : isB ? "border-amber-500/15 hover:border-amber-500/35" : isC ? "border-orange-500/15 hover:border-orange-500/35" : "border-rose-500/15 hover:border-rose-500/35";
            const shadowC = isA ? "hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]" : isB ? "hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]" : isC ? "hover:shadow-[0_0_20px_rgba(249,115,22,0.1)]" : "hover:shadow-[0_0_20px_rgba(244,63,94,0.1)]";
            const bulletC = isA ? "text-emerald-400" : isB ? "text-amber-400" : isC ? "text-orange-400" : "text-rose-400";

            return (
              <PlaybookCard
                tabNumber={11}
                title="OVERALL GRADE & RECOMMENDATION"
                explanation="Synthesizes deep analysis into a final investment grade rating (A to C) and calculates a sensible model portfolio weight (e.g. 5% to 15% maximum) for risk control."
                accentColor={accent}
                fromClass={fromC}
                borderClass={borderC}
                shadowClass={shadowC}
                bulletClass={bulletC}
                items={[
                  { label: "7-dimension scorecard", value: data.overallGradeRecommendation?.scorecard7Dimension },
                  { label: "Investment grade A-C", value: data.overallGradeRecommendation?.investmentGrade },
                  { label: "Portfolio allocation %", value: data.overallGradeRecommendation?.portfolioAllocation !== undefined ? `${data.overallGradeRecommendation?.portfolioAllocation}%` : undefined },
                ]}
              >
                <div className="flex items-center gap-4 py-2 border-t border-white/5 mt-3 pt-3 justify-around">
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] text-white/40 font-mono uppercase tracking-widest mb-1">Grade</span>
                    <div 
                      className="w-14 h-14 rounded-xl border flex items-center justify-center text-2xl font-black shadow-md"
                      style={{ 
                        borderColor: `${accent}30`, 
                        color: accent, 
                        background: `linear-gradient(135deg, ${accent}15, transparent)` 
                      }}
                    >
                      {grade}
                    </div>
                  </div>
                  <SemiCircleGauge value={data.overallGradeRecommendation?.portfolioAllocation ?? 8.5} max={15} label="Allocation %" />
                </div>
              </PlaybookCard>
            );
          })()}
        </div>
      </div>

      {/* ── 10. Price & Volume Analysis ── */}
      <div>
        <SectionHeader icon={BarChart3} label="Price & Volume Analysis" accent="hsl(260,84%,65%)" />
        <PriceAndVolumeSection symbol={symbol} />
      </div>

      {/* ── 8. Seasonality Analysis (Moneycontrol style) ── */}
      {seasonalityData && (
        <div className="space-y-4">
          <SectionHeader icon={Clock} label="Seasonality Analysis" accent="hsl(142,71%,45%)" />
          <div className="glass-card rounded-2xl border border-white/6 p-5 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-white">Monthly Returns Heatmap</h4>
              <p className="text-[11px] text-white/40 font-mono mt-0.5">Historical month-on-month performance and trends (since IPO)</p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full min-w-[800px] border-collapse">
                <thead>
                  <tr className="bg-white/3 border-b border-white/5">
                    <th className="px-3 py-2.5 text-[10px] font-mono font-bold text-white/50 text-left uppercase tracking-wider">Year</th>
                    {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(m => (
                      <th key={m} className="px-3 py-2.5 text-[10px] font-mono font-bold text-white/50 text-center uppercase tracking-wider">{m}</th>
                    ))}
                    <th className="px-3 py-2.5 text-[10px] font-mono font-bold text-emerald-400 text-right uppercase tracking-wider">Yearly</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Historical Rows */}
                  {seasonalityData.grid.map((row: any) => (
                    <tr key={row.year} className="border-b border-white/4 last:border-0 hover:bg-white/2">
                      <td className="px-3 py-2.5 text-xs font-mono font-bold text-white/80">{row.year}</td>
                      {["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].map(m => {
                        const val = row[m];
                        const bg = getCellBg(val);
                        return (
                          <td
                            key={m}
                            className="px-2 py-2.5 text-xs font-mono text-center font-bold tabular-nums"
                            style={{ backgroundColor: bg, color: val !== null ? '#ffffff' : 'rgba(255,255,255,0.1)' }}
                          >
                            {val !== null ? `${val > 0 ? "+" : ""}${val.toFixed(2)}%` : "—"}
                          </td>
                        );
                      })}
                      <td
                        className={`px-3 py-2.5 text-xs font-mono font-bold text-right tabular-nums ${row.yearlyreturns >= 0 ? "text-emerald-400" : "text-red-400"}`}
                        style={{ backgroundColor: row.yearlyreturns !== null ? getCellBg(row.yearlyreturns) : 'transparent' }}
                      >
                        {row.yearlyreturns !== null ? `${row.yearlyreturns > 0 ? "+" : ""}${row.yearlyreturns.toFixed(2)}%` : "—"}
                      </td>
                    </tr>
                  ))}

                  {/* Aggregates */}
                  <tr className="bg-white/3 border-t border-white/8">
                    <td className="px-3 py-2 text-[10px] font-mono font-bold text-white/60">Avg Monthly</td>
                    {["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].map(m => {
                      const val = seasonalityData.stats.averages[m];
                      const isPos = val >= 0;
                      return (
                        <td key={m} className={`px-2 py-2 text-xs font-mono font-bold text-center tabular-nums ${isPos ? "text-emerald-400" : "text-red-400"}`}>
                          {val !== null ? `${isPos ? "+" : ""}${val.toFixed(2)}%` : "—"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2" />
                  </tr>
                  <tr className="bg-white/1 font-semibold">
                    <td className="px-3 py-2 text-[10px] font-mono font-bold text-emerald-400/80">Positive Count%</td>
                    {["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].map(m => {
                      const val = seasonalityData.stats.positiveCount[m];
                      return (
                        <td key={m} className="px-2 py-2 text-xs font-mono text-center text-emerald-400 tabular-nums">
                          {val !== null ? `${val.toFixed(1)}%` : "—"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2" />
                  </tr>
                  <tr className="bg-white/1 font-semibold">
                    <td className="px-3 py-2 text-[10px] font-mono font-bold text-red-400/80">Negative Count%</td>
                    {["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].map(m => {
                      const val = seasonalityData.stats.negativeCount[m];
                      return (
                        <td key={m} className="px-2 py-2 text-xs font-mono text-center text-red-400 tabular-nums">
                          {val !== null ? `${val.toFixed(1)}%` : "—"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2" />
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Legends */}
            <div className="flex flex-wrap items-center gap-3 pt-2 text-[10px] font-mono text-white/50">
              <span className="font-bold">Legends:</span>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded" style={{ backgroundColor: "rgba(220, 38, 38, 0.8)" }} />
                <span>&lt;-10%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded" style={{ backgroundColor: "rgba(239, 68, 68, 0.45)" }} />
                <span>-10% to -5%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded" style={{ backgroundColor: "rgba(239, 68, 68, 0.2)" }} />
                <span>-5% to 0%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded" style={{ backgroundColor: "rgba(16, 185, 129, 0.2)" }} />
                <span>0% to 5%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded" style={{ backgroundColor: "rgba(16, 185, 129, 0.45)" }} />
                <span>5% to 10%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded" style={{ backgroundColor: "rgba(16, 185, 129, 0.8)" }} />
                <span>&gt;10%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. Interactive Financial Statements ── */}
      {financialData && (
        <div className="space-y-4">
          <SectionHeader icon={BarChart3} label="Financial Statements & Ratios" accent="hsl(260,84%,65%)" />
          <div className="glass-card rounded-2xl border border-white/6 p-5 space-y-5">
            
            {/* Header toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
              {/* Tab Selector */}
              <div className="flex gap-1 overflow-x-auto scrollbar-none py-1">
                {[
                  { key: "shareholding", name: "Shareholding" },
                  { key: "quarterly", name: "Quarterly Results" },
                  { key: "pnl", name: "Profit & Loss" },
                  { key: "balanceSheet", name: "Balance Sheet" },
                  { key: "cashFlows", name: "Cash Flows" },
                  { key: "ratios", name: "Ratios" }
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveFinTab(tab.key as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap
                      ${activeFinTab === tab.key
                        ? "bg-primary/20 border border-primary/45 text-white shadow-[0_0_8px_0_hsl(260,84%,65%,0.2)]"
                        : "text-white/40 hover:text-white/80"
                      }`}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>

              {/* View Toggle */}
              {activeFinTab !== "pnl" && activeFinTab !== "quarterly" && (
                <div className="flex p-0.5 rounded-lg bg-white/4 border border-white/8 self-start sm:self-auto">
                  <button
                    onClick={() => setIsYearly(true)}
                    className={`px-3 py-1 rounded-md text-[10px] font-mono font-bold transition-all
                      ${isYearly ? "bg-primary text-white shadow-md" : "text-white/40 hover:text-white/80"}`}
                  >
                    Yearly
                  </button>
                  <button
                    onClick={() => setIsYearly(false)}
                    className={`px-3 py-1 rounded-md text-[10px] font-mono font-bold transition-all
                      ${!isYearly ? "bg-primary text-white shadow-md" : "text-white/40 hover:text-white/80"}`}
                  >
                    Quarterly
                  </button>
                </div>
              )}
            </div>

            {/* Financial Visualizations */}
            {activeFinTab === "shareholding" ? (() => {
              const dataset = isYearly ? "yearly" : "quarterly";
              const shData: any[] = financialData.shareholding[dataset];
              const idx = shPeriodIdx < 0 || shPeriodIdx >= shData.length ? shData.length - 1 : shPeriodIdx;
              const current = shData[idx];
              const prev = idx > 0 ? shData[idx - 1] : null;

              const SH_COLORS = [
                { key: "promoter", label: "Promoters", color: "#a855f7", glow: "rgba(168,85,247,0.35)" },
                { key: "fii", label: "FIIs", color: "#3b82f6", glow: "rgba(59,130,246,0.35)" },
                { key: "dii", label: "DIIs", color: "#22c55e", glow: "rgba(34,197,94,0.35)" },
                { key: "govt", label: "Government", color: "#eab308", glow: "rgba(234,179,8,0.35)" },
                { key: "public", label: "Public", color: "#94a3b8", glow: "rgba(148,163,184,0.3)" },
              ];

              const pieData = SH_COLORS.map(s => ({ name: s.label, value: current[s.key] ?? 0, color: s.color, glow: s.glow })).filter(d => d.value > 0);

              return (
                <div className="space-y-4">
                  {/* Period selector pills */}
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
                    {shData.map((d: any, i: number) => (
                      <button
                        key={d.period}
                        onClick={() => setShPeriodIdx(i)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all whitespace-nowrap border
                          ${(shPeriodIdx < 0 ? i === shData.length - 1 : i === shPeriodIdx)
                            ? "bg-primary/20 border-primary/50 text-white shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                            : "border-white/6 text-white/40 hover:text-white/70 hover:border-white/15"
                          }`}
                      >
                        {d.period}
                      </button>
                    ))}
                  </div>

                  {/* Main Pie + Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
                    {/* Donut Chart */}
                    <div className="relative flex items-center justify-center" style={{ minHeight: 260 }}>
                      {/* Center glow */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-24 h-24 rounded-full bg-primary/10 blur-2xl" />
                      </div>
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={65}
                            outerRadius={105}
                            paddingAngle={3}
                            dataKey="value"
                            strokeWidth={0}
                            animationBegin={0}
                            animationDuration={800}
                          >
                            {pieData.map((entry, i) => (
                              <Cell
                                key={entry.name}
                                fill={entry.color}
                                style={{ filter: `drop-shadow(0 0 6px ${entry.glow})` }}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }: any) => {
                              if (!active || !payload?.[0]) return null;
                              const d = payload[0].payload;
                              return (
                                <div className="bg-[rgba(15,15,20,0.95)] border border-white/10 rounded-xl px-3 py-2 shadow-xl">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                                    <span className="text-xs font-mono font-bold text-white">{d.name}</span>
                                  </div>
                                  <div className="text-sm font-mono font-black text-white mt-0.5">{d.value.toFixed(2)}%</div>
                                </div>
                              );
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Center label */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Period</span>
                        <span className="text-sm font-display font-bold text-white mt-0.5">{current.period}</span>
                      </div>
                    </div>

                    {/* Stat pills */}
                    <div className="space-y-2.5">
                      {SH_COLORS.map(s => {
                        const val = current[s.key] ?? 0;
                        const prevVal = prev ? prev[s.key] ?? 0 : null;
                        const delta = prevVal !== null ? val - prevVal : null;
                        return (
                          <div key={s.key} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 hover:border-white/10 transition-colors">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full shadow-lg" style={{ backgroundColor: s.color, boxShadow: `0 0 8px ${s.glow}` }} />
                                <span className="text-xs font-mono font-bold text-white/80">{s.label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-mono font-black text-white">{val.toFixed(2)}%</span>
                                {delta !== null && delta !== 0 && (
                                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md border ${
                                    delta > 0
                                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                      : "text-red-400 bg-red-500/10 border-red-500/20"
                                  }`}>
                                    {delta > 0 ? "+" : ""}{delta.toFixed(2)}%
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Mini bar */}
                            <div className="relative h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                              <div
                                className="absolute top-0 left-0 h-full rounded-full transition-all duration-700"
                                style={{ width: `${val}%`, backgroundColor: s.color, boxShadow: `0 0 8px ${s.glow}` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })() : (
            <div className="h-64 w-full bg-white/1 rounded-xl p-3 border border-white/4">
              <ResponsiveContainer width="100%" height="100%">
                {(() => {
                  const dataset = isYearly ? "yearly" : "quarterly";
                  const chartData = activeFinTab === "pnl"
                    ? financialData.profitAndLoss
                    : activeFinTab === "quarterly"
                      ? financialData.quarterlyResults
                      : financialData[activeFinTab][dataset];

                  if (activeFinTab === "pnl" || activeFinTab === "quarterly") {
                    return (
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <XAxis dataKey="period" stroke="rgba(255,255,255,0.3)" fontSize={10} fontFamily="monospace" />
                        <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} fontFamily="monospace" />
                        <Tooltip contentStyle={{ backgroundColor: "rgba(15,15,20,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 10, fontFamily: "monospace", paddingTop: 10 }} />
                        <Bar dataKey="sales" fill="hsl(260,84%,65%)" radius={[4, 4, 0, 0]} name="Sales (Cr)" />
                        <Bar dataKey="netProfit" fill="hsl(142,71%,50%)" radius={[4, 4, 0, 0]} name="Net Profit (Cr)" />
                      </BarChart>
                    );
                  }

                  if (activeFinTab === "balanceSheet") {
                    return (
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <XAxis dataKey="period" stroke="rgba(255,255,255,0.3)" fontSize={10} fontFamily="monospace" />
                        <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} fontFamily="monospace" />
                        <Tooltip contentStyle={{ backgroundColor: "rgba(15,15,20,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 10, fontFamily: "monospace", paddingTop: 10 }} />
                        <Bar dataKey="reserves" fill="hsl(217,91%,66%)" radius={[4, 4, 0, 0]} name="Reserves" />
                        <Bar dataKey="borrowings" fill="hsl(22,95%,58%)" radius={[4, 4, 0, 0]} name="Borrowings" />
                      </BarChart>
                    );
                  }

                  if (activeFinTab === "cashFlows") {
                    return (
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <XAxis dataKey="period" stroke="rgba(255,255,255,0.3)" fontSize={10} fontFamily="monospace" />
                        <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} fontFamily="monospace" />
                        <Tooltip contentStyle={{ backgroundColor: "rgba(15,15,20,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 10, fontFamily: "monospace", paddingTop: 10 }} />
                        <Bar dataKey="operatingCash" fill="hsl(142,71%,50%)" radius={[4, 4, 0, 0]} name="Operating Cash Flow" />
                        <Bar dataKey="investingCash" fill="hsl(0,84%,62%)" radius={[4, 4, 0, 0]} name="Investing Cash Flow" />
                        <Bar dataKey="financingCash" fill="hsl(217,91%,66%)" radius={[4, 4, 0, 0]} name="Financing Cash Flow" />
                      </BarChart>
                    );
                  }

                  if (activeFinTab === "ratios") {
                    return (
                      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <XAxis dataKey="period" stroke="rgba(255,255,255,0.3)" fontSize={10} fontFamily="monospace" />
                        <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} fontFamily="monospace" />
                        <Tooltip contentStyle={{ backgroundColor: "rgba(15,15,20,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 10, fontFamily: "monospace", paddingTop: 10 }} />
                        <Line type="monotone" dataKey="roe" stroke="hsl(142,71%,50%)" strokeWidth={2} name="ROE %" activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="roce" stroke="hsl(260,84%,65%)" strokeWidth={2} name="ROCE %" activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="pe" stroke="hsl(38,96%,58%)" strokeWidth={2} name="PE Ratio" activeDot={{ r: 6 }} />
                      </LineChart>
                    );
                  }

                  return <div />;
                })()}
              </ResponsiveContainer>
            </div>
            )}

            {/* Table layout (Screener style) */}
            <div className="overflow-x-auto rounded-xl border border-white/5">
              {(() => {
                const dataset = isYearly ? "yearly" : "quarterly";
                const chartData = activeFinTab === "pnl"
                  ? financialData.profitAndLoss
                  : activeFinTab === "quarterly"
                    ? financialData.quarterlyResults
                    : financialData[activeFinTab][dataset];

                const headers = chartData.map((d: any) => d.period);

                let rows: { label: string; key: string; isPercent?: boolean }[] = [];
                if (activeFinTab === "shareholding") {
                  rows = [
                    { label: "Promoters %", key: "promoter", isPercent: true },
                    { label: "FIIs %", key: "fii", isPercent: true },
                    { label: "DIIs %", key: "dii", isPercent: true },
                    { label: "Government %", key: "govt", isPercent: true },
                    { label: "Public %", key: "public", isPercent: true }
                  ];
                } else if (activeFinTab === "pnl" || activeFinTab === "quarterly") {
                  rows = [
                    { label: "Sales (₹ Cr)", key: "sales" },
                    { label: "Expenses (₹ Cr)", key: "expenses" },
                    { label: "Operating Profit (₹ Cr)", key: "operatingProfit" },
                    { label: "OPM %", key: "opmPercent", isPercent: true },
                    { label: "Other Income (₹ Cr)", key: "otherIncome" },
                    { label: "Interest (₹ Cr)", key: "interest" },
                    { label: "Depreciation (₹ Cr)", key: "depreciation" },
                    { label: "Profit before Tax (₹ Cr)", key: "pbt" },
                    { label: "Tax %", key: "taxPercent", isPercent: true },
                    { label: "Net Profit (₹ Cr)", key: "netProfit" },
                    { label: "EPS (₹)", key: "eps" }
                  ];
                } else if (activeFinTab === "balanceSheet") {
                  rows = [
                    { label: "Share Capital", key: "shareCapital" },
                    { label: "Reserves", key: "reserves" },
                    { label: "Borrowings", key: "borrowings" },
                    { label: "Other Liabilities", key: "otherLiabilities" },
                    { label: "Total Liabilities", key: "totalLiabilities" },
                    { label: "Fixed Assets", key: "fixedAssets" },
                    { label: "CWIP", key: "cwip" },
                    { label: "Investments", key: "investments" },
                    { label: "Other Assets", key: "otherAssets" },
                    { label: "Total Assets", key: "totalAssets" }
                  ];
                } else if (activeFinTab === "cashFlows") {
                  rows = [
                    { label: "Cash from Operating Activity", key: "operatingCash" },
                    { label: "Cash from Investing Activity", key: "investingCash" },
                    { label: "Cash from Financing Activity", key: "financingCash" },
                    { label: "Net Cash Flow", key: "netCashFlow" }
                  ];
                } else if (activeFinTab === "ratios") {
                  rows = [
                    { label: "PE Ratio (x)", key: "pe" },
                    { label: "PB Ratio (x)", key: "pb" },
                    { label: "EV/EBITDA (x)", key: "evEbitda" },
                    { label: "ROE %", key: "roe", isPercent: true },
                    { label: "ROCE %", key: "roce", isPercent: true },
                    { label: "Debt to Equity (x)", key: "debtEquity" },
                    { label: "Interest Coverage (x)", key: "interestCoverage" },
                    { label: "Net Profit Margin %", key: "netProfitMargin", isPercent: true }
                  ];
                }

                return (
                  <table className="w-full">
                    <thead>
                      <tr className="bg-white/3 border-b border-white/5">
                        <th className="px-4 py-2.5 text-xs font-mono font-bold text-left text-white/50 uppercase tracking-wider">Metric</th>
                        {headers.map((h: string) => (
                          <th key={h} className="px-4 py-2.5 text-xs font-mono font-bold text-right text-white/50 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, rIdx) => (
                        <tr key={row.key} className="border-b border-white/4 last:border-0 hover:bg-white/2">
                          <td className="px-4 py-2 text-xs font-sans text-white/70">{row.label}</td>
                          {chartData.map((d: any, cIdx: number) => {
                            const val = d[row.key];
                            return (
                              <td key={cIdx} className="px-4 py-2 text-xs font-mono font-semibold text-right tabular-nums text-white/90">
                                {val !== null && val !== undefined
                                  ? `${val.toLocaleString("en-IN")}${row.isPercent ? "%" : ""}`
                                  : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
