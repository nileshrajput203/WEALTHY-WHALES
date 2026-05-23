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
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, Target, ShieldCheck, AlertTriangle,
  ChevronLeft, ChevronRight, Sparkles, BookOpen, PhoneCall,
  BarChart3, Zap, Clock, ArrowUpRight, ArrowDownRight, Info,
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

/* ─── Main component ─────────────────────────────────────────── */
export function FundamentalDashboard({ symbol }: { symbol: string }) {
  const [data, setData]     = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

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
    </motion.div>
  );
}
