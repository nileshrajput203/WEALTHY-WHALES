import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, TrendingUp, TrendingDown, Target, Zap, BarChart3,
  Activity, ChevronRight, RefreshCw, Clock, Shield, Eye,
  Layers, GitBranch, Award, AlertTriangle, CheckCircle2,
  XCircle, Minus, ArrowUpRight, ArrowDownRight, Sparkles,
  Cpu, Database, Radio
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  PolarAngleAxis, PolarRadiusAxis, BarChart, Bar, Legend,
  Tooltip as RechartsTooltip,
} from "recharts";

/* ═══ Types ═══ */
interface HermesSnapshot {
  id: number;
  symbol: string;
  scanDate: string;
  price: string;
  hermesScore: string;
  hermesVerdict: string;
  iqTotal: number;
  rsi14: string | null;
  sma20: string | null;
  sma50: string | null;
  macdHistogram: string | null;
  adx: string | null;
  pe: string | null;
  roe: string | null;
  debtToEquity: string | null;
  return1w: string | null;
  return1m: string | null;
  return3m: string | null;
  proximity52wHigh: string | null;
  rvol: string | null;
  sector: string | null;
  marketCapBucket: string | null;
  weightVersion: number;
  patternDetected: string | null;
  patternStage: string | null;
}

interface DashboardData {
  leaderboard: HermesSnapshot[];
  accuracy: {
    overall: { wins: number; losses: number; neutral: number; total: number; winRate: number };
    bySector: Record<string, { wins: number; total: number; winRate: number }>;
    byVerdict: Record<string, { wins: number; total: number; winRate: number }>;
  } | null;
  activeWeight: {
    version: number;
    accuracy: string;
    sampleSize: number;
    notes: string;
    weights: Record<string, number>;
  } | null;
  weightHistory: Array<{
    version: number;
    accuracy: string;
    sampleSize: number;
    notes: string;
    createdAt: string;
    isActive: boolean;
  }>;
  regime: Array<{
    regime: string;
    niftyPrice: string;
    niftyChange1w: string;
    niftyChange1m: string;
    marketBreadth: string;
    date: string;
  }>;
  recentOutcomes: Array<{
    snapshot: HermesSnapshot;
    outcome: {
      return5d: string | null;
      return10d: string | null;
      return20d: string | null;
      outcome5d: string | null;
      outcome10d: string | null;
      outcome20d: string | null;
    };
  }>;
  totalSnapshots: number;
  isScanRunning: boolean;
  schedulerStatus: {
    lastScanAt: string | null;
    lastOutcomeAt: string | null;
    lastLearningAt: string | null;
    nextScheduledScan: string | null;
    isRunning: boolean;
  };
}

/* ═══ Chart Colors ═══ */
const COLORS = {
  win: "#10b981",
  loss: "#ef4444",
  neutral: "#6b7280",
  primary: "#8b5cf6",
  secondary: "#06b6d4",
  accent: "#f59e0b",
  buy: "#10b981",
  hold: "#f59e0b",
  avoid: "#ef4444",
};

const PIE_COLORS = [COLORS.win, COLORS.loss, COLORS.neutral];

/* ═══ Verdict Badge ═══ */
function VerdictBadge({ verdict }: { verdict: string }) {
  const config: Record<string, { color: string; icon: React.ReactNode; bg: string }> = {
    BUY: { color: "text-emerald-400", icon: <TrendingUp className="w-3 h-3" />, bg: "bg-emerald-500/15 border-emerald-500/30" },
    HOLD: { color: "text-amber-400", icon: <Minus className="w-3 h-3" />, bg: "bg-amber-500/15 border-amber-500/30" },
    AVOID: { color: "text-red-400", icon: <TrendingDown className="w-3 h-3" />, bg: "bg-red-500/15 border-red-500/30" },
  };
  const c = config[verdict] || config.HOLD;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${c.bg} ${c.color}`}>
      {c.icon} {verdict}
    </span>
  );
}

/* ═══ Regime Badge ═══ */
function RegimeBadge({ regime }: { regime: string }) {
  const config: Record<string, { color: string; label: string }> = {
    TRENDING_UP: { color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "📈 Trending Up" },
    TRENDING_DOWN: { color: "bg-red-500/15 text-red-400 border-red-500/30", label: "📉 Trending Down" },
    RANGING: { color: "bg-blue-500/15 text-blue-400 border-blue-500/30", label: "↔ Ranging" },
    VOLATILE: { color: "bg-amber-500/15 text-amber-400 border-amber-500/30", label: "⚡ Volatile" },
  };
  const c = config[regime] || config.RANGING;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${c.color}`}>
      {c.label}
    </span>
  );
}

/* ═══ Outcome Badge ═══ */
function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return <span className="text-white/30 text-xs">—</span>;
  const config: Record<string, { icon: React.ReactNode; color: string }> = {
    WIN: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-emerald-400" },
    LOSS: { icon: <XCircle className="w-3.5 h-3.5" />, color: "text-red-400" },
    NEUTRAL: { icon: <Minus className="w-3.5 h-3.5" />, color: "text-gray-400" },
  };
  const c = config[outcome] || config.NEUTRAL;
  return <span className={`inline-flex items-center gap-0.5 ${c.color} font-medium text-xs`}>{c.icon} {outcome}</span>;
}

/* ═══ Stat Card ═══ */
function StatCard({ icon, label, value, sub, color = "from-violet-500/20 to-cyan-500/20" }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br ${color} backdrop-blur-xl p-4`}
    >
      <div className="absolute top-0 right-0 w-20 h-20 bg-white/[0.03] rounded-bl-full" />
      <div className="flex items-center gap-2 mb-2 text-white/50 text-xs font-medium">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
      {sub && <div className="text-xs text-white/40 mt-1">{sub}</div>}
    </motion.div>
  );
}

/* ═══ Main Dashboard ═══ */
export default function HermesAI({ hideHeader = false, ...props }: { hideHeader?: boolean; [key: string]: any }) {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: dashboard, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["/api/hermes/dashboard"],
    refetchInterval: 60000,
  });

  const scanMutation = useMutation({
    mutationFn: async (size: number) => {
      const res = await fetch("/api/hermes/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ universeSize: size }),
      });
      return res.json();
    },
    onSuccess: () => {
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/hermes/dashboard"] }), 5000);
    },
  });

  const learnMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/hermes/learn", { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/hermes/dashboard"] }), 3000);
    },
  });

  const accuracy = dashboard?.accuracy?.overall;
  const activeWeight = dashboard?.activeWeight;
  const currentRegime = dashboard?.regime?.[0];
  const leaderboard = dashboard?.leaderboard || [];

  // Pie chart data
  const pieData = accuracy ? [
    { name: "Wins", value: accuracy.wins },
    { name: "Losses", value: accuracy.losses },
    { name: "Neutral", value: accuracy.neutral },
  ] : [];

  // Sector accuracy bar data
  const sectorData = dashboard?.accuracy?.bySector
    ? Object.entries(dashboard.accuracy.bySector)
        .filter(([, v]) => v.total >= 5)
        .map(([sector, v]) => ({ sector, winRate: Number(v.winRate.toFixed(1)), total: v.total }))
        .sort((a, b) => b.winRate - a.winRate)
    : [];

  // Weight radar data
  const radarData = activeWeight?.weights
    ? Object.entries(activeWeight.weights)
        .slice(0, 12)
        .map(([key, val]) => ({
          feature: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          weight: Number((val * 100).toFixed(1)),
        }))
    : [];

  return (
    <div className="space-y-6" id="hermes-dashboard">
      {/* ═══ Hero Section ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-2xl border border-white/[0.06] p-6 md:p-8 ${hideHeader ? 'hidden' : ''}`}
        style={{
          background: "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(6,182,212,0.1) 50%, rgba(16,185,129,0.08) 100%)",
          backdropFilter: "blur(40px)",
        }}
      >
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-[40%] -right-[20%] w-[60%] h-[60%] rounded-full bg-violet-500/10 blur-[100px] animate-pulse" />
          <div className="absolute -bottom-[40%] -left-[20%] w-[50%] h-[50%] rounded-full bg-cyan-500/10 blur-[100px] animate-pulse" style={{ animationDelay: "1.5s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] rounded-full bg-emerald-500/5 blur-[80px] animate-pulse" style={{ animationDelay: "3s" }} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.4)]">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[hsl(var(--background))] animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-violet-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                HERMES AI
              </h1>
              <p className="text-sm text-white/40 mt-0.5">Self-Learning Stock Intelligence Engine</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {currentRegime && <RegimeBadge regime={currentRegime.regime} />}

            {activeWeight && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300">
                <Cpu className="w-3 h-3" /> v{activeWeight.version}
              </span>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => scanMutation.mutate(50)}
              disabled={scanMutation.isPending || dashboard?.isScanRunning}
              className="border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${scanMutation.isPending ? "animate-spin" : ""}`} />
              {scanMutation.isPending ? "Scanning..." : "Quick Scan (50)"}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ═══ Stat Cards ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Target className="w-3.5 h-3.5" />}
          label="Win Rate"
          value={accuracy ? `${accuracy.winRate.toFixed(1)}%` : "—"}
          sub={accuracy ? `${accuracy.wins}W / ${accuracy.losses}L / ${accuracy.neutral}N` : "No data yet"}
          color="from-emerald-500/15 to-emerald-500/5"
        />
        <StatCard
          icon={<Database className="w-3.5 h-3.5" />}
          label="Total Snapshots"
          value={dashboard?.totalSnapshots ?? 0}
          sub="Stocks scanned"
          color="from-violet-500/15 to-violet-500/5"
        />
        <StatCard
          icon={<GitBranch className="w-3.5 h-3.5" />}
          label="Brain Version"
          value={activeWeight ? `v${activeWeight.version}` : "v0"}
          sub={activeWeight ? `${activeWeight.sampleSize} training samples` : "Default weights"}
          color="from-cyan-500/15 to-cyan-500/5"
        />
        <StatCard
          icon={<Radio className="w-3.5 h-3.5" />}
          label="Market Regime"
          value={currentRegime?.regime?.replace("_", " ") ?? "Unknown"}
          sub={currentRegime ? `Nifty ${Number(currentRegime.niftyChange1w).toFixed(1)}% (1W)` : "No data"}
          color="from-amber-500/15 to-amber-500/5"
        />
      </div>

      {/* ═══ Tabs ═══ */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white/[0.03] border border-white/[0.06] p-1 rounded-xl">
          <TabsTrigger value="overview" className="data-[state=active]:bg-violet-500/20 rounded-lg text-xs">
            <Eye className="w-3.5 h-3.5 mr-1.5" /> Leaderboard
          </TabsTrigger>
          <TabsTrigger value="accuracy" className="data-[state=active]:bg-violet-500/20 rounded-lg text-xs">
            <Target className="w-3.5 h-3.5 mr-1.5" /> Accuracy
          </TabsTrigger>
          <TabsTrigger value="brain" className="data-[state=active]:bg-violet-500/20 rounded-lg text-xs">
            <Brain className="w-3.5 h-3.5 mr-1.5" /> Brain
          </TabsTrigger>
          <TabsTrigger value="outcomes" className="data-[state=active]:bg-violet-500/20 rounded-lg text-xs">
            <Activity className="w-3.5 h-3.5 mr-1.5" /> Outcomes
          </TabsTrigger>
          <TabsTrigger value="system" className="data-[state=active]:bg-violet-500/20 rounded-lg text-xs">
            <Cpu className="w-3.5 h-3.5 mr-1.5" /> System
          </TabsTrigger>
        </TabsList>

        {/* ═══ Tab: Leaderboard ═══ */}
        <TabsContent value="overview" className="space-y-4">
          <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="w-4 h-4 text-violet-400" />
                HERMES Top Picks
                <Badge variant="outline" className="text-[10px] ml-auto border-white/10 text-white/40">
                  {leaderboard.length} stocks
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-white/30">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading HERMES data...
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <Brain className="w-10 h-10 mx-auto text-white/20 mb-3" />
                  <p className="text-white/40 text-sm">No scan data yet. Trigger a scan to populate the leaderboard.</p>
                  <Button
                    size="sm"
                    className="mt-3 bg-violet-600 hover:bg-violet-700"
                    onClick={() => scanMutation.mutate(50)}
                    disabled={scanMutation.isPending}
                  >
                    <Zap className="w-3.5 h-3.5 mr-1.5" /> Run First Scan
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/30 text-[11px] uppercase tracking-wider border-b border-white/[0.04]">
                        <th className="text-left py-2 px-4">#</th>
                        <th className="text-left py-2 px-2">Symbol</th>
                        <th className="text-right py-2 px-2">HERMES</th>
                        <th className="text-center py-2 px-2">Verdict</th>
                        <th className="text-right py-2 px-2">StockIQ</th>
                        <th className="text-right py-2 px-2">Price</th>
                        <th className="text-right py-2 px-2">RSI</th>
                        <th className="text-right py-2 px-2">1W</th>
                        <th className="text-right py-2 px-2">1M</th>
                        <th className="text-left py-2 px-2">Sector</th>
                        <th className="text-center py-2 px-2">Cap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((s, i) => (
                        <motion.tr
                          key={s.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer"
                          onClick={() => window.location.href = `/stock/${s.symbol}`}
                        >
                          <td className="py-2.5 px-4 text-white/30 font-mono text-xs">{i + 1}</td>
                          <td className="py-2.5 px-2">
                            <div className="font-semibold text-white">{s.symbol}</div>
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <span className={`font-bold font-mono ${
                              Number(s.hermesScore) >= 70 ? "text-emerald-400" :
                              Number(s.hermesScore) >= 45 ? "text-amber-400" : "text-red-400"
                            }`}>
                              {Number(s.hermesScore).toFixed(0)}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <VerdictBadge verdict={s.hermesVerdict} />
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-white/60">{s.iqTotal}</td>
                          <td className="py-2.5 px-2 text-right font-mono text-white/70">₹{Number(s.price).toFixed(0)}</td>
                          <td className="py-2.5 px-2 text-right font-mono text-white/50">
                            {s.rsi14 ? Number(s.rsi14).toFixed(0) : "—"}
                          </td>
                          <td className={`py-2.5 px-2 text-right font-mono text-xs ${
                            s.return1w && Number(s.return1w) > 0 ? "text-emerald-400" : "text-red-400"
                          }`}>
                            {s.return1w ? `${Number(s.return1w) > 0 ? "+" : ""}${Number(s.return1w).toFixed(1)}%` : "—"}
                          </td>
                          <td className={`py-2.5 px-2 text-right font-mono text-xs ${
                            s.return1m && Number(s.return1m) > 0 ? "text-emerald-400" : "text-red-400"
                          }`}>
                            {s.return1m ? `${Number(s.return1m) > 0 ? "+" : ""}${Number(s.return1m).toFixed(1)}%` : "—"}
                          </td>
                          <td className="py-2.5 px-2 text-white/40 text-xs">{s.sector || "—"}</td>
                          <td className="py-2.5 px-2 text-center">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              s.marketCapBucket === "LARGE" ? "bg-blue-500/10 text-blue-400" :
                              s.marketCapBucket === "MID" ? "bg-violet-500/10 text-violet-400" :
                              "bg-orange-500/10 text-orange-400"
                            }`}>
                              {s.marketCapBucket || "—"}
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Tab: Accuracy ═══ */}
        <TabsContent value="accuracy" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Win/Loss Pie */}
            <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-400" /> Win/Loss Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 && accuracy && accuracy.total > 0 ? (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={180} height={180}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" strokeWidth={2} stroke="hsl(var(--background))">
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-sm text-white/60">Wins</span>
                        <span className="ml-auto font-bold text-emerald-400">{accuracy.wins}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-sm text-white/60">Losses</span>
                        <span className="ml-auto font-bold text-red-400">{accuracy.losses}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-500" />
                        <span className="text-sm text-white/60">Neutral</span>
                        <span className="ml-auto font-bold text-gray-400">{accuracy.neutral}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-white/30 text-sm">
                    <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Accuracy data will appear after outcome tracking fills forward returns.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sector Performance */}
            <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" /> Win Rate by Sector
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sectorData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={sectorData} layout="vertical" margin={{ left: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                      <YAxis type="category" dataKey="sector" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} width={55} />
                      <RechartsTooltip
                        contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                        labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                      />
                      <Bar dataKey="winRate" fill={COLORS.primary} radius={[0, 4, 4, 0]} name="Win Rate %" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-white/30 text-sm">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Sector data will appear after enough outcomes are tracked.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Verdict Accuracy */}
          {dashboard?.accuracy?.byVerdict && Object.keys(dashboard.accuracy.byVerdict).length > 0 && (
            <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-violet-400" /> Accuracy by Verdict
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(dashboard.accuracy.byVerdict).map(([verdict, stats]) => (
                    <div key={verdict} className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <VerdictBadge verdict={verdict} />
                      <div className="mt-3 text-2xl font-bold text-white">{stats.winRate.toFixed(1)}%</div>
                      <div className="text-xs text-white/30 mt-1">{stats.wins}/{stats.total} wins</div>
                      <Progress value={stats.winRate} className="mt-2 h-1" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ Tab: Brain (Weights) ═══ */}
        <TabsContent value="brain" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Weight Radar */}
            <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="w-4 h-4 text-violet-400" />
                  Active Weight Vector
                  {activeWeight && (
                    <Badge variant="outline" className="text-[10px] ml-auto border-violet-500/30 text-violet-300">
                      v{activeWeight.version}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.06)" />
                      <PolarAngleAxis dataKey="feature" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} />
                      <PolarRadiusAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 8 }} />
                      <Radar name="Weight" dataKey="weight" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.2} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-white/30 text-sm">
                    <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Weight data will appear after initialization.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Weight Evolution Timeline */}
            <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-cyan-400" /> Weight Evolution
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-cyan-400 hover:text-cyan-300"
                    onClick={() => learnMutation.mutate()}
                    disabled={learnMutation.isPending}
                  >
                    <Sparkles className={`w-3 h-3 mr-1 ${learnMutation.isPending ? "animate-spin" : ""}`} />
                    {learnMutation.isPending ? "Learning..." : "Trigger Learning"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {dashboard?.weightHistory && dashboard.weightHistory.length > 0 ? (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {dashboard.weightHistory.map((w) => (
                      <div
                        key={w.version}
                        className={`p-3 rounded-lg border ${
                          w.isActive
                            ? "border-violet-500/30 bg-violet-500/5"
                            : "border-white/[0.04] bg-white/[0.01]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-sm font-semibold text-white flex items-center gap-1.5">
                            v{w.version}
                            {w.isActive && (
                              <span className="text-[9px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full">ACTIVE</span>
                            )}
                          </span>
                          <span className="text-xs text-white/30">
                            {new Date(w.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/40">
                          <span>Accuracy: <span className="text-emerald-400 font-medium">{Number(w.accuracy).toFixed(1)}%</span></span>
                          <span>Samples: <span className="text-white/60">{w.sampleSize}</span></span>
                        </div>
                        {w.notes && (
                          <p className="text-[11px] text-white/25 mt-1.5 leading-relaxed">{w.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-white/30 text-sm">
                    <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No weight versions yet. Run a learning cycle after collecting outcomes.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ Tab: Outcomes ═══ */}
        <TabsContent value="outcomes" className="space-y-4">
          <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" /> Recent Prediction Outcomes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard?.recentOutcomes && dashboard.recentOutcomes.length > 0 ? (
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/30 text-[11px] uppercase tracking-wider border-b border-white/[0.04]">
                        <th className="text-left py-2 px-4">Symbol</th>
                        <th className="text-center py-2 px-2">Verdict</th>
                        <th className="text-right py-2 px-2">HERMES</th>
                        <th className="text-right py-2 px-2">Entry</th>
                        <th className="text-right py-2 px-2">5D Return</th>
                        <th className="text-center py-2 px-2">5D Result</th>
                        <th className="text-right py-2 px-2">10D Return</th>
                        <th className="text-center py-2 px-2">10D Result</th>
                        <th className="text-right py-2 px-2">20D Return</th>
                        <th className="text-center py-2 px-4">20D Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.recentOutcomes.map((row, i) => (
                        <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                          <td className="py-2 px-4 font-semibold text-white">{row.snapshot.symbol}</td>
                          <td className="py-2 px-2 text-center"><VerdictBadge verdict={row.snapshot.hermesVerdict} /></td>
                          <td className="py-2 px-2 text-right font-mono text-violet-300">{Number(row.snapshot.hermesScore).toFixed(0)}</td>
                          <td className="py-2 px-2 text-right font-mono text-white/50">₹{Number(row.snapshot.price).toFixed(0)}</td>
                          <td className={`py-2 px-2 text-right font-mono text-xs ${
                            row.outcome.return5d && Number(row.outcome.return5d) > 0 ? "text-emerald-400" : "text-red-400"
                          }`}>
                            {row.outcome.return5d ? `${Number(row.outcome.return5d) > 0 ? "+" : ""}${Number(row.outcome.return5d).toFixed(1)}%` : "—"}
                          </td>
                          <td className="py-2 px-2 text-center"><OutcomeBadge outcome={row.outcome.outcome5d} /></td>
                          <td className={`py-2 px-2 text-right font-mono text-xs ${
                            row.outcome.return10d && Number(row.outcome.return10d) > 0 ? "text-emerald-400" : "text-red-400"
                          }`}>
                            {row.outcome.return10d ? `${Number(row.outcome.return10d) > 0 ? "+" : ""}${Number(row.outcome.return10d).toFixed(1)}%` : "—"}
                          </td>
                          <td className="py-2 px-2 text-center"><OutcomeBadge outcome={row.outcome.outcome10d} /></td>
                          <td className={`py-2 px-2 text-right font-mono text-xs ${
                            row.outcome.return20d && Number(row.outcome.return20d) > 0 ? "text-emerald-400" : "text-red-400"
                          }`}>
                            {row.outcome.return20d ? `${Number(row.outcome.return20d) > 0 ? "+" : ""}${Number(row.outcome.return20d).toFixed(1)}%` : "—"}
                          </td>
                          <td className="py-2 px-4 text-center"><OutcomeBadge outcome={row.outcome.outcome20d} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-white/30 text-sm">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Outcomes will appear after the tracker fills forward returns (5-20 trading days after scan).
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Tab: System ═══ */}
        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scheduler Status */}
            <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" /> Scheduler Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    label: "Last Daily Scan",
                    value: dashboard?.schedulerStatus?.lastScanAt
                      ? new Date(dashboard.schedulerStatus.lastScanAt).toLocaleString()
                      : "Never",
                    icon: <RefreshCw className="w-3.5 h-3.5 text-violet-400" />,
                  },
                  {
                    label: "Last Outcome Fill",
                    value: dashboard?.schedulerStatus?.lastOutcomeAt
                      ? new Date(dashboard.schedulerStatus.lastOutcomeAt).toLocaleString()
                      : "Never",
                    icon: <Activity className="w-3.5 h-3.5 text-emerald-400" />,
                  },
                  {
                    label: "Last Learning Cycle",
                    value: dashboard?.schedulerStatus?.lastLearningAt
                      ? new Date(dashboard.schedulerStatus.lastLearningAt).toLocaleString()
                      : "Never",
                    icon: <Brain className="w-3.5 h-3.5 text-cyan-400" />,
                  },
                  {
                    label: "Next Scheduled Scan",
                    value: dashboard?.schedulerStatus?.nextScheduledScan
                      ? new Date(dashboard.schedulerStatus.nextScheduledScan).toLocaleString()
                      : "Not scheduled",
                    icon: <Clock className="w-3.5 h-3.5 text-amber-400" />,
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                    <div className="flex items-center gap-2 text-white/50 text-sm">
                      {item.icon} {item.label}
                    </div>
                    <span className="text-xs font-mono text-white/70">{item.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Manual Controls */}
            <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" /> Manual Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full bg-violet-600 hover:bg-violet-700 justify-start gap-2"
                  onClick={() => scanMutation.mutate(200)}
                  disabled={scanMutation.isPending || dashboard?.isScanRunning}
                >
                  <RefreshCw className={`w-4 h-4 ${scanMutation.isPending ? "animate-spin" : ""}`} />
                  {scanMutation.isPending ? "Scanning 200 stocks..." : "Full Scan (200 stocks)"}
                </Button>

                <Button
                  className="w-full bg-cyan-600 hover:bg-cyan-700 justify-start gap-2"
                  variant="secondary"
                  onClick={() => scanMutation.mutate(50)}
                  disabled={scanMutation.isPending || dashboard?.isScanRunning}
                >
                  <Zap className="w-4 h-4" />
                  Quick Scan (50 stocks)
                </Button>

                <Button
                  className="w-full justify-start gap-2"
                  variant="outline"
                  onClick={() => learnMutation.mutate()}
                  disabled={learnMutation.isPending}
                >
                  <Sparkles className={`w-4 h-4 ${learnMutation.isPending ? "animate-spin" : ""}`} />
                  {learnMutation.isPending ? "Learning..." : "Trigger Learning Cycle"}
                </Button>

                <div className="pt-2 border-t border-white/[0.04]">
                  <div className="text-[11px] text-white/20 space-y-1">
                    <div>• Daily scan runs at 6:30 PM IST (weekdays)</div>
                    <div>• Outcome tracker runs every 4 hours</div>
                    <div>• Learning cycle runs weekly on Sundays</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Regime History */}
          {dashboard?.regime && dashboard.regime.length > 0 && (
            <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-violet-400" /> Market Regime History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {dashboard.regime.map((r, i) => (
                    <div key={i} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <div className="flex items-center justify-between mb-2">
                        <RegimeBadge regime={r.regime} />
                      </div>
                      <div className="text-xs text-white/30 space-y-0.5">
                        <div>Nifty: ₹{Number(r.niftyPrice).toFixed(0)}</div>
                        <div>1W: <span className={Number(r.niftyChange1w) > 0 ? "text-emerald-400" : "text-red-400"}>
                          {Number(r.niftyChange1w).toFixed(1)}%
                        </span></div>
                        <div className="text-white/20">{new Date(r.date).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
