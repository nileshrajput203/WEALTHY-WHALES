import { useViewMode } from "@/hooks/useViewMode";
import { type StockIQResult } from "@shared/types";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, ShieldAlert, Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface StockIQScoreProps {
  data: StockIQResult;
  onGenerateReport?: () => void;
  reportLoading?: boolean;
}

export default function StockIQScore({ data, onGenerateReport, reportLoading }: StockIQScoreProps) {
  const { isPro } = useViewMode();
  const { totalScore, grade, verdict, simpleVerdict, fundamentals, technicals, momentum, insider } = data;

  // Color helper based on score
  const getScoreColor = (score: number) => {
    if (score >= 80) return {
      text: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
      stroke: "#10b981",
      glow: "shadow-[0_0_20px_rgba(16,185,129,0.3)]",
      gradient: "from-emerald-500 to-teal-500",
    };
    if (score >= 60) return {
      text: "text-green-400",
      bg: "bg-green-500/10 border-green-500/20",
      stroke: "#22c55e",
      glow: "shadow-[0_0_15px_rgba(34,197,94,0.25)]",
      gradient: "from-green-500 to-emerald-500",
    };
    if (score >= 40) return {
      text: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
      stroke: "#f59e0b",
      glow: "shadow-[0_0_15px_rgba(245,158,11,0.25)]",
      gradient: "from-amber-500 to-yellow-500",
    };
    return {
      text: "text-rose-400",
      bg: "bg-rose-500/10 border-rose-500/20",
      stroke: "#f43f5e",
      glow: "shadow-[0_0_15px_rgba(244,63,94,0.25)]",
      gradient: "from-rose-500 to-red-500",
    };
  };

  const colors = getScoreColor(totalScore);
  const radius = 60;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (totalScore / 100) * circumference;

  return (
    <Card className="relative overflow-hidden border border-border bg-card/45 backdrop-blur-xl shadow-xl">
      {/* Background glow */}
      <div className={cn("absolute -right-20 -top-20 w-48 h-48 rounded-full blur-3xl opacity-20 bg-gradient-to-br", colors.gradient)} />
      
      <CardContent className="p-6">
        {!isPro ? (
          /* ================= SIMPLE VIEW ================= */
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Proprietary Stock Rating
                </span>
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-bold font-display text-foreground">StockIQ Verdict</h3>
                  <Badge className={cn("px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider border", colors.bg, colors.text)}>
                    {verdict}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Traffic light indicator */}
                <div className="flex items-center gap-1.5 bg-muted/30 px-3 py-1.5 rounded-full border border-border shadow-inner">
                  <span className={cn("w-3.5 h-3.5 rounded-full transition-all duration-500", totalScore < 40 ? "bg-rose-500 animate-pulse shadow-[0_0_8px_#f43f5e]" : "bg-muted-foreground/30")} />
                  <span className={cn("w-3.5 h-3.5 rounded-full transition-all duration-500", totalScore >= 40 && totalScore < 60 ? "bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]" : "bg-muted-foreground/30")} />
                  <span className={cn("w-3.5 h-3.5 rounded-full transition-all duration-500", totalScore >= 60 ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" : "bg-muted-foreground/30")} />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-extrabold font-display leading-none text-foreground">{totalScore}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Score</span>
                </div>
              </div>
            </div>

            {/* Verdict Box */}
            <div className="bg-muted/40 border border-border rounded-xl p-4 flex items-start gap-3 shadow-inner">
              {totalScore >= 60 ? (
                <Award className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
              ) : totalScore >= 40 ? (
                <TrendingUp className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-rose-500 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {simpleVerdict}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Overall rating grade is <span className="font-bold text-foreground">{grade}</span>. Based on underlying fundamentals, momentum trends, tech setups, and cap size stability.
                </p>
              </div>
            </div>

            {/* Report Button */}
            {onGenerateReport && (
              <button
                onClick={onGenerateReport}
                disabled={reportLoading}
                className={cn(
                  "w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white font-semibold text-xs tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-[0_0_12px_rgba(124,58,237,0.3)] hover:shadow-[0_0_16px_rgba(124,58,237,0.5)] active:scale-95 disabled:opacity-50"
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {reportLoading ? "GENERATING REPORT..." : "GENERATE AI DEEP DIVE REPORT"}
              </button>
            )}
          </div>
        ) : (
          /* ================= PRO MODE VIEW ================= */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            
            {/* Left: Gauge Circle */}
            <div className="md:col-span-5 flex flex-col items-center justify-center">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90">
                  {/* Track */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    className="stroke-muted"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                  />
                  {/* Score circle */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    stroke={colors.stroke}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                {/* Center score details */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-muted-foreground uppercase tracking-widest leading-none mb-1">StockIQ</span>
                  <span className={cn("text-5xl font-black font-display leading-none", colors.text)}>
                    {totalScore}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-1">
                    Grade {grade}
                  </span>
                </div>
              </div>
              <Badge className={cn("mt-4 px-3 py-1 font-semibold uppercase tracking-wider border", colors.bg, colors.text)}>
                {verdict} Verdict
              </Badge>
            </div>

            {/* Right: Radial sub-scores */}
            <div className="md:col-span-7 flex flex-col gap-4">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Proprietary Scoring Engine
                </span>
                <h3 className="text-2xl font-bold font-display text-foreground">Analysis Pillars</h3>
              </div>

              <div className="space-y-3">
                {/* Fundamentals */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-foreground/80">🏗️ Fundamentals (30%)</span>
                    <span className={cn("font-bold", getScoreColor(fundamentals.score).text)}>{fundamentals.score}/100</span>
                  </div>
                  <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 bottom-0 left-0 rounded-full transition-all duration-700 bg-gradient-to-r from-blue-500 to-indigo-500"
                      style={{ width: `${fundamentals.score}%` }}
                    />
                  </div>
                </div>

                {/* Technicals */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-foreground/80">📊 Technicals (25%)</span>
                    <span className={cn("font-bold", getScoreColor(technicals.score).text)}>{technicals.score}/100</span>
                  </div>
                  <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 bottom-0 left-0 rounded-full transition-all duration-700 bg-gradient-to-r from-orange-500 to-amber-500"
                      style={{ width: `${technicals.score}%` }}
                    />
                  </div>
                </div>

                {/* Momentum */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-foreground/80">🚀 Momentum (25%)</span>
                    <span className={cn("font-bold", getScoreColor(momentum.score).text)}>{momentum.score}/100</span>
                  </div>
                  <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 bottom-0 left-0 rounded-full transition-all duration-700 bg-gradient-to-r from-rose-500 to-pink-500"
                      style={{ width: `${momentum.score}%` }}
                    />
                  </div>
                </div>

                {/* Insider Activity */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-foreground/80">👁️ Insider Activity (20%)</span>
                    <span className={cn("font-bold", getScoreColor(insider.score).text)}>{insider.score}/100</span>
                  </div>
                  <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 bottom-0 left-0 rounded-full transition-all duration-700 bg-gradient-to-r from-emerald-500 to-teal-500"
                      style={{ width: `${insider.score}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {onGenerateReport && (
                <div className="pt-2 mt-1">
                  <button
                    onClick={onGenerateReport}
                    disabled={reportLoading}
                    className={cn(
                      "w-full py-2 px-4 rounded-lg bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white font-semibold text-xs tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-[0_0_12px_rgba(124,58,237,0.3)] hover:shadow-[0_0_16px_rgba(124,58,237,0.5)] active:scale-95 disabled:opacity-50"
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {reportLoading ? "GENERATING AI REPORT..." : "GENERATE DETAILED AI RESEARCH REPORT"}
                  </button>
                </div>
              )}

            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
