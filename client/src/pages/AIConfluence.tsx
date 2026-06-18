import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Brain, Activity, Sparkles, TrendingUp, ChevronRight,
  TrendingDown, RefreshCw, CheckCircle2, Award
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ConfluenceSignal {
  symbol: string;
  scanDate: string;
  hermesScore: number;
  hermesVerdict: string;
  fuguScore: number;
  compositeScore: number;
  eliteReasoning: string;
}

export default function AIConfluence() {
  const { data: signals = [], isLoading, refetch, isRefetching } = useQuery<ConfluenceSignal[]>({
    queryKey: ["/api/confluence-signals"],
    refetchInterval: 60000,
  });

  return (
    <div className="space-y-6" id="confluence-page">
      {/* ═══ Header banner ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-white/[0.06] p-6 md:p-8"
        style={{
          background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(255, 107, 107, 0.08) 50%, rgba(16, 185, 129, 0.06) 100%)",
          backdropFilter: "blur(40px)",
        }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-[30%] -right-[10%] w-[50%] h-[50%] rounded-full bg-violet-500/10 blur-[100px] animate-pulse" />
          <div className="absolute -bottom-[30%] -left-[10%] w-[45%] h-[45%] rounded-full bg-emerald-500/10 blur-[100px] animate-pulse" style={{ animationDelay: "1.5s" }} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.3)]">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[hsl(var(--background))] animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-violet-300 via-pink-200 to-emerald-200 bg-clip-text text-transparent">
                AI CONFLUENCE SIGNALS
              </h1>
              <p className="text-sm text-white/40 mt-0.5">High-conviction setups where HERMES AI and FUGU SCORE agree</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
              className="border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefetching ? "animate-spin" : ""}`} />
              Refresh Signals
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ═══ Page content ═══ */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl">
          <CardHeader className="pb-3 border-b border-white/[0.04]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="w-4 h-4 text-violet-400" />
                  Dual-Engine High-Conviction Setups
                </CardTitle>
                <CardDescription>
                  Showing stocks with HERMES Score &ge; 70 and FUGU Score &ge; 70 from the same scan day.
                </CardDescription>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 self-start">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Verified Matches
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-white/30 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-violet-500" />
                <span className="text-sm font-mono">Aligning predictive engines...</span>
              </div>
            ) : signals.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-white/10 rounded-xl">
                <Brain className="w-12 h-12 mx-auto text-white/20 mb-3" />
                <h3 className="text-white font-semibold">No Confluence Signals Yet</h3>
                <p className="text-white/40 text-sm max-w-sm mx-auto mt-1">
                  Once daily runs are executed, high-scoring stocks matched by both FUGU and HERMES will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/30 text-[10px] uppercase tracking-wider border-b border-white/[0.04] text-left">
                      <th className="py-3 px-4">Stock Ticker</th>
                      <th className="py-3 px-2">Scan Date</th>
                      <th className="py-3 px-2 text-center">HERMES Score</th>
                      <th className="py-3 px-2 text-center">FUGU Score</th>
                      <th className="py-3 px-2 text-center">Composite Score</th>
                      <th className="py-3 px-4">Catalyst & Rationale</th>
                      <th className="py-3 px-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map((sig, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors cursor-pointer group"
                        onClick={() => window.location.href = `/stock/${sig.symbol}`}
                      >
                        <td className="py-4 px-4 font-bold text-white text-base">
                          <div className="flex items-center gap-2">
                            {sig.symbol}
                            <span className="text-[10px] font-normal font-mono px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-300">
                              NSE
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-2 font-mono text-xs text-white/50">
                          {new Date(sig.scanDate).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                          })}
                        </td>
                        <td className="py-4 px-2 text-center font-mono">
                          <Badge className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {sig.hermesScore.toFixed(0)}
                          </Badge>
                        </td>
                        <td className="py-4 px-2 text-center font-mono">
                          <Badge className="bg-coral-500/10 text-red-300 border border-red-500/20" style={{ borderColor: "rgba(255,107,107,0.2)", color: "rgb(254,178,178)", background: "rgba(255,107,107,0.05)" }}>
                            {sig.fuguScore.toFixed(0)}
                          </Badge>
                        </td>
                        <td className="py-4 px-2 text-center">
                          <span className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-pink-300 to-amber-300 font-mono">
                            {sig.compositeScore}%
                          </span>
                        </td>
                        <td className="py-4 px-4 text-xs text-white/60 max-w-xs leading-relaxed italic">
                          "{sig.eliteReasoning}"
                        </td>
                        <td className="py-4 px-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-violet-400 group-hover:translate-x-1 transition-transform"
                          >
                            Analyze <ChevronRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
