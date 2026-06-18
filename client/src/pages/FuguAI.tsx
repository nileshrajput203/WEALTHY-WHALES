import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, TrendingUp, TrendingDown, Target, Zap, BarChart3,
  Activity, ChevronRight, RefreshCw, Clock, Shield, Eye,
  Layers, GitBranch, Award, AlertTriangle, CheckCircle2,
  XCircle, Minus, ArrowUpRight, ArrowDownRight, Sparkles,
  Cpu, Database, Radio, CheckSquare, PlayCircle, BarChart,
  Star
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, BarChart as RechartsBarChart, Bar, Legend,
  Tooltip as RechartsTooltip, LineChart, Line
} from "recharts";

/* ═══ Types ═══ */
interface FuguSnapshot {
  id: number;
  symbol: string;
  scannerSource: string;
  scanDate: string;
  price: string;
  technicalScore: number;
  patternScore: number;
  patternConfidence: number;
  candlestickScore: number;
  fundamentalScore: number;
  sectorScore: number;
  macroScore: number;
  fuguScore: string;
  similarityToWinners: string;
  similarityToLosers: string;
  features: Record<string, any>;
  weightVersion: number;
  eliteReasoning: string | null;
}

interface DashboardData {
  elitePicks: Array<{
    pick: {
      id: number;
      snapshotId: number;
      symbol: string;
      fuguScore: string;
      reasoning: string;
      verdict: string;
      isActive: boolean;
    };
    snapshot: FuguSnapshot;
  }>;
  activeWeight: {
    version: number;
    accuracy: string;
    sampleSize: number;
    notes: string;
    weights: Record<string, number>;
  };
  weightHistory: Array<{
    id: number;
    version: number;
    createdAt: string;
    weights: Record<string, number>;
    accuracy: string;
    sampleSize: number;
    notes: string;
    isActive: boolean;
  }>;
  learningLogs: Array<{
    id: number;
    createdAt: string;
    insightType: string;
    findings: string;
    geminiReasoning: string | null;
  }>;
  patterns: Array<{
    id: number;
    patternName: string;
    totalOccurrences: number;
    winRate5d: string;
    winRate20d: string;
    winRate60d: string;
  }>;
  candlesticks: Array<{
    id: number;
    candlestickName: string;
    totalOccurrences: number;
    winRate5d: string;
    winRate20d: string;
    winRate60d: string;
  }>;
  sectors: Array<{
    id: number;
    sectorName: string;
    totalOccurrences: number;
    winRate5d: string;
    winRate20d: string;
    winRate60d: string;
    momentumScore: string;
  }>;
  recentOutcomes: Array<{
    outcome: {
      id: number;
      price5d: string | null;
      price10d: string | null;
      price20d: string | null;
      price30d: string | null;
      price60d: string | null;
      price90d: string | null;
      return5d: string | null;
      return10d: string | null;
      return20d: string | null;
      return30d: string | null;
      return60d: string | null;
      return90d: string | null;
      maxDrawdown: string | null;
      volatility: string | null;
      benchmarkPerformance: string | null;
      outcome5d: string | null;
      outcome20d: string | null;
    };
    snapshot: FuguSnapshot;
  }>;
  totalCount: number;
  isScanRunning: boolean;
  schedulerStatus: {
    lastScanAt: string | null;
    lastScanResult: any | null;
    lastOutcomeAt: string | null;
    lastLearningAt: string | null;
    lastLearningResult: any | null;
    nextScheduledScan: string | null;
    isRunning: boolean;
  };
}

const COLORS = {
  win: "#10b981", // green
  loss: "#ef4444", // red
  neutral: "#6b7280",
  primary: "#ff6b6b", // Coral
  secondary: "#f59e0b", // Gold
  accent: "#06b6d4",
};

export default function FuguAI({ hideHeader = false, ...props }: { hideHeader?: boolean; [key: string]: any }) {
  const [activeTab, setActiveTab] = useState("elite");

  const { data: dashboard, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["/api/fugu/dashboard"],
    refetchInterval: 30000,
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/fugu/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      return res.json();
    },
    onSuccess: () => {
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/fugu/dashboard"] }), 5000);
    },
  });

  const learnMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/fugu/learn", { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/fugu/dashboard"] }), 3000);
    },
  });

  const outcomesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/fugu/track-outcomes", { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/fugu/dashboard"] }), 3000);
    },
  });

  const activeWeight = dashboard?.activeWeight;
  const elitePicks = dashboard?.elitePicks || [];
  const patterns = dashboard?.patterns || [];
  const candlesticks = dashboard?.candlesticks || [];
  const sectors = dashboard?.sectors || [];
  const learningLogs = dashboard?.learningLogs || [];
  const recentOutcomes = dashboard?.recentOutcomes || [];

  // Parse dynamic weight radar data
  const radarData = activeWeight?.weights
    ? Object.entries(activeWeight.weights).map(([key, val]) => ({
        feature: key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        weight: Number((val * 100).toFixed(1)),
      }))
    : [];

  // Format line chart data for weight history
  const weightHistoryLineData = dashboard?.weightHistory
    ? [...dashboard.weightHistory].reverse().map(w => {
        const item: Record<string, any> = { name: `v${w.version}`, accuracy: Number(w.accuracy) };
        Object.entries(w.weights).forEach(([k, v]) => {
          item[k] = Number((v * 100).toFixed(1));
        });
        return item;
      })
    : [];

  return (
    <div className="space-y-6" id="fugu-dashboard">
      {/* ═══ Header banner ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-2xl border border-white/[0.06] p-6 md:p-8 ${hideHeader ? 'hidden' : ''}`}
        style={{
          background: "linear-gradient(135deg, rgba(255,107,107,0.15) 0%, rgba(245,158,11,0.08) 50%, rgba(6,182,212,0.06) 100%)",
          backdropFilter: "blur(40px)",
        }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-[30%] -right-[10%] w-[50%] h-[50%] rounded-full bg-red-500/10 blur-[100px] animate-pulse" />
          <div className="absolute -bottom-[30%] -left-[10%] w-[45%] h-[45%] rounded-full bg-amber-500/10 blur-[100px] animate-pulse" style={{ animationDelay: "1.5s" }} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center shadow-[0_0_30px_rgba(255,107,107,0.3)]">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[hsl(var(--background))] animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-red-300 via-amber-200 to-cyan-200 bg-clip-text text-transparent">
                FUGU SCORE V1
              </h1>
              <p className="text-sm text-white/40 mt-0.5">Self-Learning Institutional Stock Ranking Agent</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeWeight && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-full border border-red-500/30 bg-red-500/10 text-red-300">
                <Cpu className="w-3.5 h-3.5" /> Brain: v{activeWeight.version} (Acc: {activeWeight.accuracy}%)
              </span>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending || dashboard?.isScanRunning}
              className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${scanMutation.isPending ? "animate-spin" : ""}`} />
              {scanMutation.isPending ? "Gathering Candidates..." : "Run Fugu Scan"}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ═══ Stats Cards ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-white/50 text-xs font-medium">
            <Target className="w-3.5 h-3.5 text-red-400" /> Active Win Rate
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {activeWeight ? `${Number(activeWeight.accuracy).toFixed(1)}%` : "—"}
          </div>
          <div className="text-[10px] text-white/35 mt-1">Based on {activeWeight?.sampleSize ?? 0} outcomes</div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-white/50 text-xs font-medium">
            <Database className="w-3.5 h-3.5 text-amber-400" /> Total Snapshots
          </div>
          <div className="text-2xl font-bold text-white mt-2">{dashboard?.totalCount ?? 0}</div>
          <div className="text-[10px] text-white/35 mt-1">Scans logged to database</div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-white/50 text-xs font-medium">
            <Activity className="w-3.5 h-3.5 text-cyan-400" /> Outcomes Logged
          </div>
          <div className="text-2xl font-bold text-white mt-2">{recentOutcomes.length}</div>
          <div className="text-[10px] text-white/35 mt-1">Active outcome channels</div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-white/50 text-xs font-medium">
            <Radio className="w-3.5 h-3.5 text-emerald-400" /> Agent Network
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">Active</div>
          <div className="text-[10px] text-white/35 mt-1">10 nodes active on LangGraph</div>
        </div>
      </div>

      {/* ═══ Tabs System ═══ */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white/[0.03] border border-white/[0.06] p-1 rounded-xl flex flex-wrap gap-1">
          <TabsTrigger value="elite" className="data-[state=active]:bg-red-500/20 rounded-lg text-xs">
            <Award className="w-3.5 h-3.5 mr-1" /> Elite Picks
          </TabsTrigger>
          <TabsTrigger value="learning" className="data-[state=active]:bg-red-500/20 rounded-lg text-xs">
            <Brain className="w-3.5 h-3.5 mr-1" /> Learning Engine
          </TabsTrigger>
          <TabsTrigger value="patterns" className="data-[state=active]:bg-red-500/20 rounded-lg text-xs">
            <Layers className="w-3.5 h-3.5 mr-1" /> Patterns
          </TabsTrigger>
          <TabsTrigger value="candlesticks" className="data-[state=active]:bg-red-500/20 rounded-lg text-xs">
            <Activity className="w-3.5 h-3.5 mr-1" /> Candlesticks
          </TabsTrigger>
          <TabsTrigger value="weights" className="data-[state=active]:bg-red-500/20 rounded-lg text-xs">
            <GitBranch className="w-3.5 h-3.5 mr-1" /> Weights
          </TabsTrigger>
          <TabsTrigger value="sectors" className="data-[state=active]:bg-red-500/20 rounded-lg text-xs">
            <BarChart3 className="w-3.5 h-3.5 mr-1" /> Sectors
          </TabsTrigger>
          <TabsTrigger value="outcomes" className="data-[state=active]:bg-red-500/20 rounded-lg text-xs">
            <Clock className="w-3.5 h-3.5 mr-1" /> Outcomes
          </TabsTrigger>
          <TabsTrigger value="health" className="data-[state=active]:bg-red-500/20 rounded-lg text-xs">
            <Shield className="w-3.5 h-3.5 mr-1" /> System Health
          </TabsTrigger>
          <TabsTrigger value="agents" className="data-[state=active]:bg-red-500/20 rounded-lg text-xs">
            <Cpu className="w-3.5 h-3.5 mr-1" /> Agent Status
          </TabsTrigger>
        </TabsList>

        {/* ═══ Tab: Elite Picks ═══ */}
        <TabsContent value="elite" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-white/30">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading Elite recommendations...
              </div>
            ) : elitePicks.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-white/10 rounded-xl">
                <Brain className="w-12 h-12 mx-auto text-white/20 mb-3 animate-pulse" />
                <h3 className="text-white font-semibold">No Elite Picks Calculated</h3>
                <p className="text-white/40 text-sm max-w-sm mx-auto mt-1">Run Fugu Scan to parse candidates through the agent state graph and output the top recommendations.</p>
                <Button size="sm" onClick={() => scanMutation.mutate()} className="mt-4 bg-red-500 hover:bg-red-600 text-white">
                  <PlayCircle className="w-3.5 h-3.5 mr-1.5" /> Execute Fugu Agent Runner
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Hermes Elite Top 5 Showcases */}
                <div 
                  className="rounded-2xl border border-amber-500/20 p-5 md:p-6 backdrop-blur-xl relative overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(255,107,107,0.03) 50%, transparent 100%)"
                  }}
                >
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-[40%] -right-[10%] w-[35%] h-[60%] rounded-full bg-amber-500/5 blur-[80px]" />
                  </div>

                  <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 mb-5">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-400" />
                      <div>
                        <h2 className="text-base font-bold text-white tracking-wide">
                          HERMES ELITE TOP 5 — HIGH PROBABILITY SETUPS
                        </h2>
                        <p className="text-[11px] text-white/40">Self-improving AI picks matching historical success profiles & real-time sentiment catalysts</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300 text-[10px] uppercase font-mono px-2 py-0.5">
                      Guaranteed Setup Model
                    </Badge>
                  </div>

                  <div className="relative z-10 grid grid-cols-1 md:grid-cols-5 gap-4">
                    {elitePicks.slice(0, 5).map((ep, idx) => {
                      const sentiment = Number(ep.snapshot.features?.sentimentScore ?? 50);
                      const catalyst = ep.snapshot.features?.catalyst ?? "No major news catalysts detected.";
                      const score = Number(ep.pick.fuguScore);

                      // Calculate rating stars: >=80 -> 5, >=75 -> 4, >=70 -> 3, else 2
                      let stars = 5;
                      if (score >= 80) stars = 5;
                      else if (score >= 75) stars = 4;
                      else if (score >= 70) stars = 3;
                      else stars = 2;

                      return (
                        <motion.div
                          key={ep.pick.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          className="relative overflow-hidden rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 flex flex-col justify-between hover:border-amber-500/30 hover:bg-white/[0.04] cursor-pointer group"
                          onClick={() => window.location.href = `/stock/${ep.pick.symbol}`}
                        >
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[10px] text-amber-400 font-bold font-mono">
                            #{idx + 1}
                          </div>

                          <div>
                            <div className="text-lg font-extrabold text-white group-hover:text-amber-200 transition-colors">
                              {ep.pick.symbol}
                            </div>
                            <div className="text-[9px] text-white/35 font-mono uppercase mt-0.5">
                              {ep.snapshot.scannerSource}
                            </div>

                            {/* Stars rating */}
                            <div className="flex items-center gap-0.5 mt-2">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3 h-3 ${i < stars ? "text-amber-400 fill-amber-400" : "text-white/10"}`}
                                />
                              ))}
                            </div>

                            {/* Fugu Score display */}
                            <div className="flex items-baseline gap-1 mt-3">
                              <span className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-amber-300 to-amber-200 font-mono">
                                {score.toFixed(0)}
                              </span>
                              <span className="text-[8px] text-white/35 font-mono uppercase">Score</span>
                            </div>

                            {/* Sentiment Indicator */}
                            <div className="mt-3 flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${
                                sentiment >= 65 ? "bg-emerald-500" :
                                sentiment <= 35 ? "bg-red-500" :
                                "bg-amber-500"
                              }`} />
                              <span className={`text-[9px] font-bold ${
                                sentiment >= 65 ? "text-emerald-400" :
                                sentiment <= 35 ? "text-red-400" :
                                "text-amber-400"
                              }`}>
                                {sentiment >= 65 ? "Bullish" :
                                 sentiment <= 35 ? "Bearish" :
                                 "Neutral"} ({sentiment}/100)
                              </span>
                            </div>

                            {/* Catalyst */}
                            <p className="text-[10px] text-white/50 leading-relaxed mt-2.5 line-clamp-3 italic">
                              "{catalyst}"
                            </p>
                          </div>

                          <div className="mt-4 pt-3 border-t border-white/[0.04] text-[10px] flex items-center justify-between text-white/40 font-mono">
                            <span>Win Prob:</span>
                            <span className="font-bold text-emerald-400">
                              {Number(ep.snapshot.similarityToWinners).toFixed(0)}%
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* All Active Picks */}
                <div>
                  <h3 className="text-xs font-semibold text-white/45 uppercase tracking-wider mb-3">All Active Elite Picks</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {elitePicks.map((ep, idx) => (
                      <motion.div
                        key={ep.pick.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 flex flex-col justify-between hover:border-red-500/20 hover:bg-white/[0.02] cursor-pointer"
                        onClick={() => window.location.href = `/stock/${ep.pick.symbol}`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xl font-bold text-white">{ep.pick.symbol}</span>
                              <span className="text-[10px] text-white/40 ml-2 font-mono uppercase bg-white/5 px-1.5 py-0.5 rounded">
                                {ep.snapshot.scannerSource}
                              </span>
                            </div>
                            <Badge className={`${
                              ep.pick.verdict === "ELITE_85" ? "bg-rose-500/20 text-rose-300 border-rose-500/45" :
                              ep.pick.verdict === "ELITE_80" ? "bg-amber-500/20 text-amber-300 border-amber-500/45" :
                              ep.pick.verdict === "TOP_5" ? "bg-red-500/25 text-red-300 border-red-500/40" :
                              ep.pick.verdict === "TOP_10" ? "bg-amber-500/25 text-amber-300 border-amber-500/40" :
                              "bg-cyan-500/25 text-cyan-300 border-cyan-500/40"
                            } border`}>
                              {ep.pick.verdict.replace("_", " ")}
                            </Badge>
                          </div>

                          {/* Score display */}
                          <div className="flex items-baseline gap-1.5 mt-3">
                            <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-amber-300 font-mono">
                              {Number(ep.pick.fuguScore).toFixed(0)}
                            </span>
                            <span className="text-[10px] text-white/30 font-mono uppercase">Fugu Score</span>
                          </div>

                          <p className="text-xs text-white/60 leading-relaxed mt-4 line-clamp-3">
                            {ep.pick.reasoning}
                          </p>
                        </div>

                        <div className="mt-5 pt-4 border-t border-white/[0.04]">
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-white/[0.01] rounded py-1.5">
                              <div className="text-[10px] text-white/30">Technicals</div>
                              <div className="text-xs font-semibold text-white mt-0.5">{ep.snapshot.technicalScore}</div>
                            </div>
                            <div className="bg-white/[0.01] rounded py-1.5">
                              <div className="text-[10px] text-white/30">Fundamentals</div>
                              <div className="text-xs font-semibold text-white mt-0.5">{ep.snapshot.fundamentalScore}</div>
                            </div>
                            <div className="bg-white/[0.01] rounded py-1.5">
                              <div className="text-[10px] text-white/30">Similarity</div>
                              <div className="text-xs font-semibold text-emerald-400 mt-0.5">
                                {Number(ep.snapshot.similarityToWinners).toFixed(0)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══ Tab: Learning Engine ═══ */}
        <TabsContent value="learning" className="space-y-4">
          <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Fugu Learning Memory</CardTitle>
                  <CardDescription>Evolving insights generated by LLM analysis of successes and failures</CardDescription>
                </div>
                <Button size="sm" onClick={() => learnMutation.mutate()} disabled={learnMutation.isPending} className="bg-amber-500 hover:bg-amber-600 text-white">
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  {learnMutation.isPending ? "Generating Insights..." : "Run Learning Loop"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {learningLogs.length === 0 ? (
                <div className="text-center py-12 text-white/30 text-sm">
                  No learning logs recorded yet. Once outcome tracking has accumulated successes/failures, the learning engine will analyze the characteristics.
                </div>
              ) : (
                <div className="space-y-4">
                  {learningLogs.map((log) => (
                    <div key={log.id} className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                      <div className="flex items-center justify-between mb-2">
                        <Badge className={`${
                          log.insightType === "WINNER_PATTERN" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
                          log.insightType === "LOSER_PATTERN" ? "bg-red-500/20 text-red-300 border-red-500/30" :
                          "bg-blue-500/20 text-blue-300 border-blue-500/30"
                        } border text-[10px]`}>
                          {log.insightType.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-white/30">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-white/70 leading-relaxed font-mono whitespace-pre-wrap">{log.findings}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Tab: Pattern Performance ═══ */}
        <TabsContent value="patterns" className="space-y-4">
          <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-base">Chart Pattern Predictive Stats</CardTitle>
              <CardDescription>Historical win rates tracked for specific geometric price patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/30 text-[11px] uppercase tracking-wider border-b border-white/[0.04]">
                      <th className="text-left py-2 px-2">Pattern</th>
                      <th className="text-right py-2 px-2">Total Occurrences</th>
                      <th className="text-right py-2 px-2">5D Win Rate</th>
                      <th className="text-right py-2 px-2">20D Win Rate</th>
                      <th className="text-right py-2 px-2">60D Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patterns.map((pat) => (
                      <tr key={pat.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 px-2 font-semibold text-white">{pat.patternName}</td>
                        <td className="py-2.5 px-2 text-right font-mono text-white/60">{pat.totalOccurrences}</td>
                        <td className="py-2.5 px-2 text-right font-mono text-emerald-400">{pat.winRate5d}%</td>
                        <td className="py-2.5 px-2 text-right font-mono text-cyan-400">{pat.winRate20d}%</td>
                        <td className="py-2.5 px-2 text-right font-mono text-violet-400">{pat.winRate60d}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Tab: Candlestick Performance ═══ */}
        <TabsContent value="candlesticks" className="space-y-4">
          <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-base">Candlestick Success Stats</CardTitle>
              <CardDescription>Historical win rates of short-term Japanese candlestick signals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/30 text-[11px] uppercase tracking-wider border-b border-white/[0.04]">
                      <th className="text-left py-2 px-2">Candlestick Signal</th>
                      <th className="text-right py-2 px-2">Total Occurrences</th>
                      <th className="text-right py-2 px-2">5D Win Rate</th>
                      <th className="text-right py-2 px-2">20D Win Rate</th>
                      <th className="text-right py-2 px-2">60D Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candlesticks.map((cand) => (
                      <tr key={cand.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 px-2 font-semibold text-white">{cand.candlestickName}</td>
                        <td className="py-2.5 px-2 text-right font-mono text-white/60">{cand.totalOccurrences}</td>
                        <td className="py-2.5 px-2 text-right font-mono text-emerald-400">{cand.winRate5d}%</td>
                        <td className="py-2.5 px-2 text-right font-mono text-cyan-400">{cand.winRate20d}%</td>
                        <td className="py-2.5 px-2 text-right font-mono text-violet-400">{cand.winRate60d}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Tab: Weight Evolution ═══ */}
        <TabsContent value="weights" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-sm">Factor Weight Distribution Radar</CardTitle>
              </CardHeader>
              <CardContent>
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.06)" />
                      <PolarAngleAxis dataKey="feature" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} />
                      <PolarRadiusAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 8 }} />
                      <Radar name="Active Weight" dataKey="weight" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.2} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-white/30 text-sm">
                    No active weights set up.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-sm">Accuracy & Score Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                {weightHistoryLineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={weightHistoryLineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                      <RechartsTooltip contentStyle={{ background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.1)" }} />
                      <Legend wrapperStyle={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} />
                      <Line type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2} name="Accuracy %" />
                      <Line type="monotone" dataKey="technical" stroke="#ef4444" strokeWidth={1} name="Technical Wt" />
                      <Line type="monotone" dataKey="fundamental" stroke="#ff6b6b" strokeWidth={1.5} name="Fundamental Wt" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-white/30 text-sm">
                    No historical versions recorded yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ Tab: Sector Intelligence ═══ */}
        <TabsContent value="sectors" className="space-y-4">
          <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-base">Sector Rotation & Strength Leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/30 text-[11px] uppercase tracking-wider border-b border-white/[0.04]">
                      <th className="text-left py-2 px-2">Sector</th>
                      <th className="text-right py-2 px-2">Win Rate (20D)</th>
                      <th className="text-right py-2 px-2">Momentum Score</th>
                      <th className="text-right py-2 px-2">Scans Tracked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectors.map((sec) => (
                      <tr key={sec.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 px-2 font-semibold text-white">{sec.sectorName}</td>
                        <td className="py-2.5 px-2 text-right font-mono text-emerald-400">{sec.winRate20d}%</td>
                        <td className="py-2.5 px-2 text-right font-mono text-cyan-400">{sec.momentumScore}</td>
                        <td className="py-2.5 px-2 text-right font-mono text-white/50">{sec.totalOccurrences}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Tab: Outcome Tracking ═══ */}
        <TabsContent value="outcomes" className="space-y-4">
          <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Quant Outcomes Log</CardTitle>
                  <CardDescription>Actual prices and returns filled at 5d/10d/20d/30d/60d/90d intervals</CardDescription>
                </div>
                <Button size="sm" onClick={() => outcomesMutation.mutate()} disabled={outcomesMutation.isPending} className="bg-cyan-500 hover:bg-cyan-600 text-white">
                  <Activity className="w-3.5 h-3.5 mr-1" />
                  {outcomesMutation.isPending ? "Tracking..." : "Sync Outcomes"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentOutcomes.length === 0 ? (
                <div className="text-center py-12 text-white/30 text-sm">
                  No outcomes stored in the database yet. Outcomes require calendar days to pass after running a scan.
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/30 text-[10px] uppercase tracking-wider border-b border-white/[0.04]">
                        <th className="text-left py-2 px-4">Symbol</th>
                        <th className="text-right py-2 px-2">Score</th>
                        <th className="text-right py-2 px-2">5D Ret</th>
                        <th className="text-right py-2 px-2">20D Ret</th>
                        <th className="text-right py-2 px-2">90D Ret</th>
                        <th className="text-right py-2 px-2">Drawdown</th>
                        <th className="text-right py-2 px-2">Volatility</th>
                        <th className="text-center py-2 px-2">5D Out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOutcomes.map((row, i) => (
                        <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                          <td className="py-2.5 px-4 font-semibold text-white">{row.snapshot.symbol}</td>
                          <td className="py-2.5 px-2 text-right font-mono text-red-300">{Number(row.snapshot.fuguScore).toFixed(0)}</td>
                          <td className={`py-2.5 px-2 text-right font-mono text-xs ${
                            row.outcome.return5d && Number(row.outcome.return5d) > 0 ? "text-emerald-400" : "text-red-400"
                          }`}>
                            {row.outcome.return5d ? `${Number(row.outcome.return5d) > 0 ? "+" : ""}${Number(row.outcome.return5d).toFixed(1)}%` : "—"}
                          </td>
                          <td className={`py-2.5 px-2 text-right font-mono text-xs ${
                            row.outcome.return20d && Number(row.outcome.return20d) > 0 ? "text-emerald-400" : "text-red-400"
                          }`}>
                            {row.outcome.return20d ? `${Number(row.outcome.return20d) > 0 ? "+" : ""}${Number(row.outcome.return20d).toFixed(1)}%` : "—"}
                          </td>
                          <td className={`py-2.5 px-2 text-right font-mono text-xs ${
                            row.outcome.return90d && Number(row.outcome.return90d) > 0 ? "text-emerald-400" : "text-red-400"
                          }`}>
                            {row.outcome.return90d ? `${Number(row.outcome.return90d) > 0 ? "+" : ""}${Number(row.outcome.return90d).toFixed(1)}%` : "—"}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-xs text-red-400">
                            {row.outcome.maxDrawdown ? `-${row.outcome.maxDrawdown}%` : "—"}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-xs text-cyan-400">
                            {row.outcome.volatility ? `${row.outcome.volatility}%` : "—"}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              row.outcome.outcome5d === "WIN" ? "bg-emerald-500/10 text-emerald-400" :
                              row.outcome.outcome5d === "LOSS" ? "bg-red-500/10 text-red-400" :
                              "bg-gray-500/10 text-gray-400"
                            }`}>
                              {row.outcome.outcome5d || "—"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Tab: System Health ═══ */}
        <TabsContent value="health" className="space-y-4">
          <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                FUGU Background Scheduler Timing (IST UTC+5:30)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  label: "Last Daily Pipeline Scan",
                  value: dashboard?.schedulerStatus?.lastScanAt
                    ? new Date(dashboard.schedulerStatus.lastScanAt).toLocaleString()
                    : "Never executed",
                  icon: <RefreshCw className="w-4 h-4 text-red-400" />
                },
                {
                  label: "Last Outcomes Tracker Run",
                  value: dashboard?.schedulerStatus?.lastOutcomeAt
                    ? new Date(dashboard.schedulerStatus.lastOutcomeAt).toLocaleString()
                    : "Never executed",
                  icon: <Activity className="w-4 h-4 text-cyan-400" />
                },
                {
                  label: "Last Learning Cycle Optimizer Run",
                  value: dashboard?.schedulerStatus?.lastLearningAt
                    ? new Date(dashboard.schedulerStatus.lastLearningAt).toLocaleString()
                    : "Never executed",
                  icon: <Brain className="w-4 h-4 text-amber-400" />
                },
                {
                  label: "Next Scheduled Scan",
                  value: dashboard?.schedulerStatus?.nextScheduledScan
                    ? new Date(dashboard.schedulerStatus.nextScheduledScan).toLocaleString()
                    : "Not scheduled",
                  icon: <Clock className="w-4 h-4 text-purple-400" />
                }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
                  <div className="flex items-center gap-2 text-white/60 text-sm">
                    {item.icon} {item.label}
                  </div>
                  <span className="font-mono text-xs text-white/80">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Tab: Agent Status ═══ */}
        <TabsContent value="agents" className="space-y-4">
          <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-base">FUGU LangGraph Agent States</CardTitle>
              <CardDescription>Network status of FUGU SCORE nodes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { name: "Scanner Agent", desc: "Collects candidate stocks from Swing, IPO, Patterns, Screener.", status: "Idle", col: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" },
                  { name: "Technical Agent", desc: "Calculates RSI, EMAs, SMAs, ATR, RVOL.", status: "Idle", col: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" },
                  { name: "Pattern Agent", desc: "Heuristics lookup on Cup & Handle, Double Bottom, Flags.", status: "Idle", col: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" },
                  { name: "Candlestick Agent", desc: "Checks Hammer, Engulfing, Morning Star, Inside Bar.", status: "Idle", col: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" },
                  { name: "Fundamental Agent", desc: "Calculates DuPont ROE/ROCE, Debt, margins, and valuation.", status: "Idle", col: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" },
                  { name: "Sector Agent", desc: "Computes sector relative rotation & strength metrics.", status: "Idle", col: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" },
                  { name: "Macro Agent", desc: "Trend indexing, correlations, USDINR/Gold/Bitcoin checks.", status: "Idle", col: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" },
                  { name: "Outcome Agent", desc: "Fills prices and checks performance at 5d to 90d intervals.", status: "Idle", col: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" },
                  { name: "Learning Agent", desc: "Weekly statistical analysis and Gemini-powered reviews.", status: "Idle", col: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" },
                  { name: "Weight Optimizer Agent", desc: "Evolves scoring factor weights based on outcomes.", status: "Idle", col: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" },
                  { name: "Elite Ranking Agent", desc: "Ranks stock candidates to generate Top 5/10/20 picks.", status: "Idle", col: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" }
                ].map((item, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border ${item.col} flex flex-col justify-between`}>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white text-sm">{item.name}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-white/10 rounded">
                          {item.status}
                        </span>
                      </div>
                      <p className="text-xs text-white/50 mt-2 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
