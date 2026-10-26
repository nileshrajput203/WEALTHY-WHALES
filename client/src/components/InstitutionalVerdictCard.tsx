import {
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  Activity,
  Flame,
  Award,
  Layers,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { InstitutionalVerdictData } from "@shared/types";

interface InstitutionalVerdictCardProps {
  verdictData?: InstitutionalVerdictData;
  symbol: string;
  price: number;
}

export function InstitutionalVerdictCard({ verdictData, symbol, price }: InstitutionalVerdictCardProps) {
  if (!verdictData) return null;

  const {
    primaryVerdict,
    actionableSummary,
    vetoTriggered,
    weinsteinStage,
    weinsteinStageName,
    pctBelow52WHigh,
    pillars,
    forensics,
    cpr,
    tradeZones,
  } = verdictData;

  const isBuy = primaryVerdict === "STRONG BUY" || primaryVerdict === "ACCUMULATE / BUY";
  const isSell = primaryVerdict === "STRONG SELL / AVOID" || primaryVerdict === "REDUCE / BOOK PROFIT";

  // Badge Styling
  let badgeColor = "bg-amber-950/80 text-amber-300 border-amber-500/40";
  if (primaryVerdict === "STRONG BUY") {
    badgeColor = "bg-emerald-950/95 text-emerald-200 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.3)]";
  } else if (primaryVerdict === "ACCUMULATE / BUY") {
    badgeColor = "bg-emerald-950/70 text-emerald-300 border-emerald-500/40";
  } else if (primaryVerdict === "STRONG SELL / AVOID") {
    badgeColor = "bg-rose-950/95 text-rose-200 border-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.3)]";
  } else if (primaryVerdict === "REDUCE / BOOK PROFIT") {
    badgeColor = "bg-orange-950/80 text-orange-300 border-orange-500/40";
  }

  // Weinstein stage color
  let stageColor = "text-slate-300 bg-slate-900 border-slate-700";
  if (weinsteinStage === "STAGE_2_ADVANCING") {
    stageColor = "text-emerald-300 bg-emerald-950/80 border-emerald-500/50 shadow-xs";
  } else if (weinsteinStage === "STAGE_4_DECLINING") {
    stageColor = "text-rose-300 bg-rose-950/80 border-rose-500/50 shadow-xs";
  } else if (weinsteinStage === "STAGE_3_DISTRIBUTION_OR_PULLBACK") {
    stageColor = "text-amber-300 bg-amber-950/80 border-amber-500/40";
  }

  return (
    <div className="glass-card rounded-2xl border border-slate-800 p-6 bg-[#0c1017] space-y-6 shadow-xl">
      {/* Top Verdict Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
              INSTITUTIONAL QUANT VERDICT
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              5-PILLAR + HARD-VETO SYSTEM
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className={`px-4 py-1.5 rounded-xl text-base sm:text-lg font-mono font-black border tracking-wider uppercase inline-flex items-center gap-2 ${badgeColor}`}>
              {isBuy && <TrendingUp className="w-5 h-5 text-emerald-400" />}
              {isSell && <TrendingDown className="w-5 h-5 text-rose-400" />}
              {!isBuy && !isSell && <Activity className="w-5 h-5 text-amber-400" />}
              {primaryVerdict}
            </span>

            <span className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border ${stageColor}`}>
              {weinsteinStageName}
            </span>

            <span className="text-xs font-mono text-slate-400">
              52W High Dist: <strong className={pctBelow52WHigh <= 10 ? "text-emerald-400" : "text-slate-200"}>-{pctBelow52WHigh}%</strong>
            </span>
          </div>

          <p className="text-sm text-slate-200 font-sans mt-2 max-w-3xl leading-relaxed">
            {actionableSummary}
          </p>
        </div>

        {/* CPR & Quick Specs */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono space-y-1.5 min-w-[220px]">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Central Pivot (CPR):</span>
            <span className="font-bold text-white">₹{cpr.pivot}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">CPR Width:</span>
            <span className={`font-bold ${cpr.isNarrowTrendingCPR ? "text-emerald-400" : "text-slate-300"}`}>
              {cpr.cprWidthPct}% {cpr.isNarrowTrendingCPR ? "(Narrow Trend)" : ""}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Smart-Money Flow:</span>
            <span className={`font-bold ${forensics.weakToStrongTransfer ? "text-emerald-400" : "text-slate-300"}`}>
              {forensics.fiiDiiFlowTrend}
            </span>
          </div>
        </div>
      </div>

      {/* Hard-Veto Alert (If Triggered) */}
      {vetoTriggered && (
        <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/50 text-xs text-rose-200 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold font-mono text-rose-300 uppercase block mb-0.5">INSTITUTIONAL HARD-VETO ACTIVE</strong>
            <span>{vetoTriggered}</span>
          </div>
        </div>
      )}

      {/* Dual Horizon Execution Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Horizon 1: Swing / Positional (1–8 Weeks) */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-xs font-mono font-bold text-indigo-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              SWING / POSITIONAL PLAN (1–8 WEEKS)
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              R:R <strong className="text-emerald-400 font-bold">{tradeZones.riskRewardRatio}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
            <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase">Buy Zone</span>
              <strong className="text-indigo-300 text-sm">₹{tradeZones.swingEntryZone.low} - {tradeZones.swingEntryZone.high}</strong>
            </div>

            <div className="p-2 rounded bg-rose-950/40 border border-rose-800/40 text-rose-300">
              <span className="text-[10px] text-rose-400/70 block uppercase">Stop Loss</span>
              <strong className="text-rose-400 text-sm">₹{tradeZones.swingStopLoss.price}</strong>
              <span className="text-[9px] block text-rose-400/80">(-{tradeZones.swingStopLoss.pct}%)</span>
            </div>

            <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300">
              <span className="text-[10px] text-emerald-400/70 block uppercase">Target 1</span>
              <strong className="text-emerald-400 text-sm">₹{tradeZones.swingTarget1.price}</strong>
              <span className="text-[9px] block text-emerald-400/80">(+{tradeZones.swingTarget1.pct}%)</span>
            </div>

            <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300">
              <span className="text-[10px] text-emerald-400/70 block uppercase">Target 2</span>
              <strong className="text-emerald-300 text-sm">₹{tradeZones.swingTarget2.price}</strong>
              <span className="text-[9px] block text-emerald-400/80">(+{tradeZones.swingTarget2.pct}%)</span>
            </div>
          </div>
        </div>

        {/* Horizon 2: Long-Term Investor (6–24 Months) */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-amber-400" />
              LONG-TERM INVESTOR VERDICT (6–24 MONTHS)
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
              tradeZones.valuationStatus === "UNDERVALUED"
                ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
                : tradeZones.valuationStatus === "OVERVALUED"
                ? "bg-rose-950/80 text-rose-300 border-rose-500/40"
                : "bg-slate-800 text-slate-300 border-slate-700"
            }`}>
              {tradeZones.valuationStatus}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono px-1">
            <span className="text-slate-400">Fundamental Fair Value:</span>
            <strong className="text-white text-sm">₹{tradeZones.longTermFairValue}</strong>
          </div>

          <div className="space-y-1 text-[11px] font-sans text-slate-300">
            {tradeZones.bullThesis.slice(0, 2).map((thesis, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>{thesis}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* The 5 Institutional Pillars Breakdown */}
      <div className="space-y-2.5 pt-2">
        <span className="text-xs font-mono text-slate-400 uppercase tracking-widest block">
          5-PILLAR INSTITUTIONAL SCORING BREAKDOWN
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {[
            { label: "Pillar 1: Earnings Acceleration", score: pillars.earningsMomentumScore, weight: "25%" },
            { label: "Pillar 2: Shareholding Forensics", score: pillars.shareholdingForensicsScore, weight: "20%" },
            { label: "Pillar 3: Weinstein Stage 2", score: pillars.weinsteinStageScore, weight: "25%" },
            { label: "Pillar 4: Quant Models Consensus", score: pillars.quantConsensusScore, weight: "15%" },
            { label: "Pillar 5: Catalyst & F&O Buildup", score: pillars.catalystScore, weight: "15%" },
          ].map((p, i) => (
            <div key={i} className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-mono">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>{p.weight}</span>
                <strong className="text-white font-bold">{p.score}/100</strong>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full transition-all ${
                    p.score >= 70 ? "bg-emerald-400" : p.score >= 50 ? "bg-amber-400" : "bg-rose-400"
                  }`}
                  style={{ width: `${p.score}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-300 leading-tight block truncate" title={p.label}>
                {p.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
