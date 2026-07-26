import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, TrendingUp, TrendingDown, RefreshCw, Calendar, 
  Activity, Newspaper, BarChart3, Clock, AlertTriangle, 
  CheckCircle2, XCircle, ShieldAlert, FileText, Settings, 
  Play, Database, Compass, ArrowUpRight, ArrowDownRight, Globe
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, BarChart, Bar, Legend, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";

/* ═══ Types ═══ */
interface ApexPrediction {
  id: number;
  predictionDate: string;
  symbol: string;
  direction: "UP" | "DOWN";
  confidenceScore: string;
  momentumScore: string;
  gapScore: string;
  newsScore: string;
  foScore: string;
  sectorScore: string;
  reasoning: string;
  openPrice: string | null;
  closePrice: string | null;
  actualReturnPct: string | null;
  actualDirection: string | null;
  isCorrect: boolean | null;
  filledAt: string | null;
  weightVersion: number;
  features: Record<string, number>;
  createdAt: string;
}

interface NewsSignal {
  id: number;
  signalDate: string;
  symbol: string | null;
  sector: string | null;
  headline: string;
  source: string;
  url: string;
  sentimentScore: string;
  catalystType: string;
  entityType: "STOCK" | "SECTOR" | "MACRO";
}

interface FOSignal {
  id: number;
  signalDate: string;
  symbol: string;
  isFoStock: boolean;
  pcr: string;
  callOi: string;
  putOi: string;
  oiChangePct: string;
  oiDirection: string;
  maxPain: string;
  ivRank: string;
  signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  signalStrength: string;
}

interface WeightVersion {
  id: number;
  version: number;
  weights: Record<string, number>;
  accuracyRate: string;
  sampleSize: number;
  learningNotes: string;
  isActive: boolean;
  createdAt: string;
}

interface JobState {
  id: number;
  jobName: string;
  lastRanAt: string | null;
  nextRunAt: string | null;
  status: "idle" | "running" | "failed" | "completed";
  runCount: number;
  lastError: string | null;
  lastDurationMs: number | null;
}

interface JobError {
  id: number;
  jobName: string;
  errorMessage: string;
  symbol: string | null;
  stackTrace: string | null;
  createdAt: string;
}

interface DashboardData {
  predictions: {
    upCalls: ApexPrediction[];
    downCalls: ApexPrediction[];
  };
  news: NewsSignal[];
  fo: FOSignal[];
  weights: WeightVersion[];
  system: {
    jobs: JobState[];
    errors: JobError[];
  };
  historical: ApexPrediction[];
}

export default function ApexAI() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("today");
  const [selectedWeightVersion, setSelectedWeightVersion] = useState<number | null>(null);

  // Fetch consolidated dashboard data
  const { data, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ["/api/apex/dashboard"],
    refetchInterval: 30000 // auto-refresh every 30s
  });

  // Manual Trigger Mutation
  const triggerMutation = useMutation({
    mutationFn: async (job: string) => {
      const response = await fetch(`/api/apex/trigger/${job}`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to trigger job");
      return response.json();
    },
    onSuccess: (res) => {
      toast({
        title: "Job Triggered",
        description: res.message,
      });
      setTimeout(() => refetch(), 1000); // refetch shortly after trigger
    },
    onError: (err: any) => {
      toast({
        title: "Trigger Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="w-10 h-10 animate-spin text-primary" />
        <p className="text-white/40 font-mono text-sm animate-pulse">Initializing Intraday APEX Engine...</p>
      </div>
    );
  }

  const dashboardData = data || {
    predictions: { upCalls: [], downCalls: [] },
    news: [],
    fo: [],
    weights: [],
    system: { jobs: [], errors: [] },
    historical: []
  };

  // Calculations for dashboard
  const activeWeight = dashboardData.weights.find(w => w.isActive) || dashboardData.weights[0];
  const activeWeightsData = activeWeight ? activeWeight.weights : {};
  const currentWeightVersion = activeWeight ? activeWeight.version : 1;

  const currentDisplayWeight = selectedWeightVersion 
    ? dashboardData.weights.find(w => w.version === selectedWeightVersion) || activeWeight
    : activeWeight;

  const radarChartData = Object.entries(currentDisplayWeight?.weights || {}).map(([name, val]) => ({
    feature: name.replace(/_/g, " ").substring(0, 15),
    weight: val * 100
  }));

  // Historical Accuracy stats
  const completedHistorical = dashboardData.historical.filter(p => p.isCorrect !== null);
  const totalCompleted = completedHistorical.length;
  const correctCompleted = completedHistorical.filter(p => p.isCorrect === true).length;
  const historicalWinRate = totalCompleted > 0 ? (correctCompleted / totalCompleted) * 100 : 50;

  const upWinRate = completedHistorical.filter(p => p.direction === "UP").length > 0
    ? (completedHistorical.filter(p => p.direction === "UP" && p.isCorrect === true).length / completedHistorical.filter(p => p.direction === "UP").length) * 100
    : 50;

  const downWinRate = completedHistorical.filter(p => p.direction === "DOWN").length > 0
    ? (completedHistorical.filter(p => p.direction === "DOWN" && p.isCorrect === true).length / completedHistorical.filter(p => p.direction === "DOWN").length) * 100
    : 50;

  // Build daily accuracy line chart data
  const groupedAccuracy = completedHistorical.reduce((acc, curr) => {
    const day = new Date(curr.predictionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    if (!acc[day]) acc[day] = { day, correct: 0, total: 0 };
    acc[day].total++;
    if (curr.isCorrect) acc[day].correct++;
    return acc;
  }, {} as Record<string, { day: string; correct: number; total: number }>);

  const dailyAccuracyData = Object.values(groupedAccuracy).map(g => ({
    day: g.day,
    rate: Math.round((g.correct / g.total) * 100)
  }));

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-primary to-violet-600 flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.3)]">
              <Zap className="w-6 h-6 text-white animate-bounce-slow" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Scalp Essentials
                <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary font-mono font-bold animate-pulse text-[10px]">
                  ACTIVE SCANNER
                </Badge>
              </h1>
              <p className="text-white/40 text-xs">Self-learning 30-factor real-time same-day stock predictive models</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 py-1.5 px-3 font-mono text-xs hidden sm:inline-flex">
            🎯 30-Day Win Rate: {historicalWinRate.toFixed(1)}% ({totalCompleted} trades)
          </Badge>
          <Button 
            onClick={() => {
              refetch();
              toast({ title: "Refreshing Engine Data", description: "Consolidated dashboard data has been updated." });
            }}
            variant="outline" 
            size="sm" 
            className="rounded-xl border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="border-b border-white/5 pb-2">
          <TabsList className="bg-white/5 border border-white/10 rounded-xl p-0.5 max-w-full overflow-x-auto flex flex-nowrap">
            <TabsTrigger value="today" className="rounded-lg text-xs py-1.5 px-3.5 data-[state=active]:bg-primary/20 data-[state=active]:text-white">
              <Activity className="w-3.5 h-3.5 mr-1.5" /> Today's Calls
            </TabsTrigger>
            <TabsTrigger value="accuracy" className="rounded-lg text-xs py-1.5 px-3.5 data-[state=active]:bg-primary/20 data-[state=active]:text-white">
              <TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Accuracy Tracker
            </TabsTrigger>
            <TabsTrigger value="news" className="rounded-lg text-xs py-1.5 px-3.5 data-[state=active]:bg-primary/20 data-[state=active]:text-white">
              <Newspaper className="w-3.5 h-3.5 mr-1.5" /> News Intelligence
            </TabsTrigger>
            <TabsTrigger value="fo" className="rounded-lg text-xs py-1.5 px-3.5 data-[state=active]:bg-primary/20 data-[state=active]:text-white">
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> F&O Option Signals
            </TabsTrigger>
            <TabsTrigger value="learning" className="rounded-lg text-xs py-1.5 px-3.5 data-[state=active]:bg-primary/20 data-[state=active]:text-white">
              <Compass className="w-3.5 h-3.5 mr-1.5" /> Learning Log
            </TabsTrigger>
            <TabsTrigger value="health" className="rounded-lg text-xs py-1.5 px-3.5 data-[state=active]:bg-primary/20 data-[state=active]:text-white">
              <Settings className="w-3.5 h-3.5 mr-1.5" /> System Health
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: TODAY'S CALLS */}
        <TabsContent value="today" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* BUY / UP SCANS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-l-4 border-emerald-500 pl-3">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Top 5 Intraday Bullish Calls</h3>
                <span className="text-white/30 text-xs font-mono">Target: UP Direction</span>
              </div>
              
              <div className="space-y-4">
                {dashboardData.predictions.upCalls.length === 0 ? (
                  <Card className="bg-white/3 border-white/5 rounded-2xl">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-white/30 font-mono text-xs">
                      No Bullish Calls generated for today.
                      <Button onClick={() => triggerMutation.mutate("scan")} size="sm" variant="outline" className="mt-3 text-[10px] h-7 px-3 border-white/10 bg-white/5 rounded-lg">
                        <Play className="w-3 h-3 mr-1" /> Run Morning Scan
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  dashboardData.predictions.upCalls.map((pred) => (
                    <PredictionCard key={pred.id} pred={pred} />
                  ))
                )}
              </div>
            </div>

            {/* SELL / DOWN SCANS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-l-4 border-red-500 pl-3">
                <TrendingDown className="w-5 h-5 text-red-400" />
                <h3 className="font-bold text-white text-base">Top 5 Intraday Bearish Calls</h3>
                <span className="text-white/30 text-xs font-mono">Target: DOWN Direction</span>
              </div>

              <div className="space-y-4">
                {dashboardData.predictions.downCalls.length === 0 ? (
                  <Card className="bg-white/3 border-white/5 rounded-2xl">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-white/30 font-mono text-xs">
                      No Bearish Calls generated for today.
                      <Button onClick={() => triggerMutation.mutate("scan")} size="sm" variant="outline" className="mt-3 text-[10px] h-7 px-3 border-white/10 bg-white/5 rounded-lg">
                        <Play className="w-3 h-3 mr-1" /> Run Morning Scan
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  dashboardData.predictions.downCalls.map((pred) => (
                    <PredictionCard key={pred.id} pred={pred} />
                  ))
                )}

              </div>
            </div>

          </div>
        </TabsContent>

        {/* TAB 2: ACCURACY TRACKER */}
        <TabsContent value="accuracy" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-white/3 border-white/5 rounded-2xl">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Overall Accuracy</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">{historicalWinRate.toFixed(1)}%</p>
                  <p className="text-[10px] text-white/20 mt-1 font-mono">{correctCompleted} Wins / {totalCompleted} Trades</p>
                </div>
                <Activity className="w-8 h-8 text-emerald-500/30" />
              </CardContent>
            </Card>
            <Card className="bg-white/3 border-white/5 rounded-2xl">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider">UP Calls Accuracy</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">{upWinRate.toFixed(1)}%</p>
                  <p className="text-[10px] text-white/20 mt-1 font-mono">Bullish Scanner performance</p>
                </div>
                <TrendingUp className="w-8 h-8 text-emerald-500/30" />
              </CardContent>
            </Card>
            <Card className="bg-white/3 border-white/5 rounded-2xl">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider">DOWN Calls Accuracy</p>
                  <p className="text-2xl font-bold text-red-400 mt-1">{downWinRate.toFixed(1)}%</p>
                  <p className="text-[10px] text-white/20 mt-1 font-mono">Bearish Scanner performance</p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-500/30" />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white/3 border-white/5 rounded-2xl">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-white">Daily Hit Rate History</CardTitle>
                <CardDescription className="text-xs text-white/40">Percentage of correct predictions on trading days</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                {dailyAccuracyData.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-white/20 font-mono text-xs">
                    Insufficient historical data.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyAccuracyData} margin={{ left: -20, right: 10, top: 10 }}>
                      <defs>
                        <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="rgb(139, 92, 246)" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="rgb(139, 92, 246)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="day" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                      <YAxis stroke="rgba(255,255,255,0.4)" domain={[0, 100]} tickFormatter={v => `${v}%`} fontSize={10} />
                      <RechartsTooltip contentStyle={{ background: "rgba(10,10,12,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }} />
                      <Area type="monotone" dataKey="rate" stroke="rgb(139, 92, 246)" strokeWidth={2} fillOpacity={1} fill="url(#colorRate)" name="Hit Rate" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white/3 border-white/5 rounded-2xl">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-white">Outcome Classification</CardTitle>
                <CardDescription className="text-xs text-white/40">Distribution of successful vs failed calls</CardDescription>
              </CardHeader>
              <CardContent className="h-72 flex flex-col justify-center">
                {totalCompleted === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-white/20 font-mono text-xs">
                    Insufficient completed outcome matches.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: "UP Calls", Wins: completedHistorical.filter(p => p.direction === "UP" && p.isCorrect === true).length, Losses: completedHistorical.filter(p => p.direction === "UP" && p.isCorrect === false).length },
                      { name: "DOWN Calls", Wins: completedHistorical.filter(p => p.direction === "DOWN" && p.isCorrect === true).length, Losses: completedHistorical.filter(p => p.direction === "DOWN" && p.isCorrect === false).length }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                      <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
                      <RechartsTooltip contentStyle={{ background: "rgba(10,10,12,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="Wins" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Losses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: NEWS INTELLIGENCE */}
        <TabsContent value="news" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="bg-white/3 border-white/5 rounded-2xl">
                <CardHeader className="pb-3 border-b border-white/5">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-sm font-semibold text-white">Scraped Intraday Headlines</CardTitle>
                      <CardDescription className="text-xs text-white/40">Processed headlines with NLP keywords sentiment mapping</CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">{dashboardData.news.length} items today</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0 max-h-[500px] overflow-y-auto">
                  {dashboardData.news.length === 0 ? (
                    <div className="p-8 text-center text-white/20 font-mono text-xs">
                      No processed news items for today. Run news ingest.
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {dashboardData.news.map((item) => (
                        <div key={item.id} className="p-4 hover:bg-white/2 transition-all flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                          <div className="flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {item.symbol && <Badge variant="secondary" className="bg-primary/20 text-white border-primary/20 text-[10px] py-0.5">{item.symbol}</Badge>}
                              {item.sector && <Badge variant="outline" className="text-white/45 border-white/10 text-[10px] py-0.5">{item.sector}</Badge>}
                              <Badge className={`text-[9px] py-0.5 ${
                                item.catalystType === "RESULT_BEAT" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                item.catalystType === "REGULATORY_NEGATIVE" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                item.catalystType === "ORDER_WIN" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                "bg-white/5 text-white/40 border-white/5"
                              }`}>
                                {item.catalystType}
                              </Badge>
                            </div>
                            <p className="text-xs font-medium text-white/80 leading-normal">{item.headline}</p>
                            <div className="flex items-center gap-2 text-[10px] text-white/30 font-mono">
                              <span>{item.source}</span>
                              <span>•</span>
                              <span>{new Date(item.signalDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5 sm:self-center">
                            <span className="text-[10px] font-mono text-white/40">Sentiment:</span>
                            <Badge className={`font-mono text-xs py-1 px-2.5 ${
                              parseFloat(item.sentimentScore) > 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                              parseFloat(item.sentimentScore) < 0 ? "bg-red-500/10 text-red-400 border-red-500/20" :
                              "bg-white/5 text-white/55 border-white/5"
                            }`}>
                              {parseFloat(item.sentimentScore) > 0 ? "+" : ""}{parseFloat(item.sentimentScore)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="bg-white/3 border-white/5 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-white">Aggregated Sectors Sentiment</CardTitle>
                  <CardDescription className="text-xs text-white/40">Leaderboard compiled from stock news flow</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dashboardData.news.filter(n => n.entityType === "SECTOR").length === 0 ? (
                    <div className="py-8 text-center text-white/20 font-mono text-xs">
                      No aggregated sector signals found.
                    </div>
                  ) : (
                    dashboardData.news.filter(n => n.entityType === "SECTOR").map((sectorItem) => (
                      <div key={sectorItem.id} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-white/80">{sectorItem.sector}</span>
                          <span className={`font-mono font-bold ${
                            parseFloat(sectorItem.sentimentScore) > 0 ? "text-emerald-400" :
                            parseFloat(sectorItem.sentimentScore) < 0 ? "text-red-400" :
                            "text-white/40"
                          }`}>
                            {parseFloat(sectorItem.sentimentScore) > 0 ? "+" : ""}{parseFloat(sectorItem.sentimentScore)}
                          </span>
                        </div>
                        <Progress 
                          value={50 + (parseFloat(sectorItem.sentimentScore) / 2)} 
                          className="h-1.5 bg-white/5 [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-violet-500" 
                        />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: F&O OPTIONS SIGNALS */}
        <TabsContent value="fo" className="space-y-6 outline-none">
          <Card className="bg-white/3 border-white/5 rounded-2xl">
            <CardHeader className="pb-3 border-b border-white/5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-white">Derivatives Option Chain Signals</CardTitle>
                <CardDescription className="text-xs text-white/40">Put-Call Ratio (PCR), Open Interest (OI) buildup direction, and Max Pain levels</CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs">{dashboardData.fo.length} symbols scanned</Badge>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {dashboardData.fo.length === 0 ? (
                <div className="p-12 text-center text-white/20 font-mono text-xs">
                  No derivatives signals available for today. Run F&O Ingest.
                </div>
              ) : (
                <table className="w-full text-left font-sans text-xs border-collapse">
                  <thead>
                    <tr className="bg-white/2 text-white/40 font-mono border-b border-white/5 text-[10px]">
                      <th className="py-3.5 px-4 font-normal">Symbol</th>
                      <th className="py-3.5 px-4 font-normal">Option PCR</th>
                      <th className="py-3.5 px-4 font-normal">Total Call OI</th>
                      <th className="py-3.5 px-4 font-normal">Total Put OI</th>
                      <th className="py-3.5 px-4 font-normal">OI Change %</th>
                      <th className="py-3.5 px-4 font-normal">OI Buildup Direction</th>
                      <th className="py-3.5 px-4 font-normal">Max Pain Strike</th>
                      <th className="py-3.5 px-4 font-normal">Signal Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-white/80">
                    {dashboardData.fo.map((sig) => (
                      <tr key={sig.id} className="hover:bg-white/2 transition-colors">
                        <td className="py-3 px-4 font-bold text-white">{sig.symbol}</td>
                        <td className="py-3 px-4 font-mono">{parseFloat(sig.pcr).toFixed(2)}</td>
                        <td className="py-3 px-4 font-mono">{parseInt(sig.callOi).toLocaleString("en-IN")}</td>
                        <td className="py-3 px-4 font-mono">{parseInt(sig.putOi).toLocaleString("en-IN")}</td>
                        <td className={`py-3 px-4 font-mono ${parseFloat(sig.oiChangePct) > 0 ? "text-emerald-400" : "text-white/40"}`}>
                          {(parseFloat(sig.oiChangePct) * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <Badge variant="outline" className={`text-[10px] ${
                            sig.oiDirection === "LONG_BUILDUP" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                            sig.oiDirection === "SHORT_BUILDUP" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                            sig.oiDirection === "SHORT_COVERING" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                            "bg-white/5 text-white/45 border-white/10"
                          }`}>
                            {sig.oiDirection}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-mono">₹{parseFloat(sig.maxPain).toLocaleString("en-IN")}</td>
                        <td className="py-3 px-4">
                          <Badge className={`text-[10px] ${
                            sig.signal === "BULLISH" ? "bg-emerald-500 text-white" :
                            sig.signal === "BEARISH" ? "bg-red-500 text-white" :
                            "bg-white/10 text-white/60 border-white/10"
                          }`}>
                            {sig.signal}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: LEARNING LOG */}
        <TabsContent value="learning" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <Card className="bg-white/3 border-white/5 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-white">Scoring Weights Timeline</CardTitle>
                  <CardDescription className="text-xs text-white/40">Versions trained by daily directional outcomes</CardDescription>
                </CardHeader>
                <CardContent className="p-0 max-h-[400px] overflow-y-auto">
                  {dashboardData.weights.length === 0 ? (
                    <div className="p-8 text-center text-white/20 font-mono text-xs">
                      No version history found. Seed weights.
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {dashboardData.weights.map((v) => (
                        <div 
                          key={v.id} 
                          onClick={() => setSelectedWeightVersion(v.version)}
                          className={`p-4 hover:bg-white/2 cursor-pointer transition-all flex flex-col gap-1.5 ${
                            (selectedWeightVersion === v.version || (!selectedWeightVersion && v.isActive)) 
                              ? "bg-primary/10 border-l-4 border-primary" 
                              : ""
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-white text-xs">Weights Version {v.version}</span>
                            {v.isActive && <Badge className="bg-primary/20 text-primary hover:bg-primary/20 text-[9px] py-0.5">ACTIVE</Badge>}
                          </div>
                          <p className="text-[10px] text-white/45 leading-normal">{v.learningNotes}</p>
                          <div className="flex justify-between items-center text-[10px] text-white/30 font-mono mt-1">
                            <span>Samples: {v.sampleSize}</span>
                            <span>Hit Rate: {(parseFloat(v.accuracyRate) * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <Card className="bg-white/3 border-white/5 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-white">
                    30-Feature Weights Distribution (Version {currentDisplayWeight?.version || 1})
                  </CardTitle>
                  <CardDescription className="text-xs text-white/40">
                    Calculated weight coefficient assigned to each indicator factor
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  {radarChartData.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-white/20 font-mono text-xs">
                      No weight details loaded.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarChartData}>
                        <PolarGrid stroke="rgba(255,255,255,0.05)" />
                        <PolarAngleAxis dataKey="feature" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 8 }} />
                        <PolarRadiusAxis angle={30} domain={[0, "auto"]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 8 }} />
                        <Radar name="Weights" dataKey="weight" stroke="rgb(139, 92, 246)" fill="rgb(139, 92, 246)" fillOpacity={0.35} />
                        <RechartsTooltip contentStyle={{ background: "rgba(10,10,12,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 6: SYSTEM HEALTH */}
        <TabsContent value="health" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* MANUAL TRIGGERS */}
            <div className="space-y-4">
              <Card className="bg-white/3 border-white/5 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-white">Engine Schedulers Actions</CardTitle>
                  <CardDescription className="text-xs text-white/40">Execute daily routine tasks immediately</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <div className="flex justify-between items-center gap-2 p-2.5 bg-white/2 rounded-xl border border-white/5">
                    <div>
                      <p className="text-xs font-semibold text-white/85">News scraping pipeline</p>
                      <p className="text-[10px] text-white/30">moneycontrol, ET & Business Standard</p>
                    </div>
                    <Button 
                      onClick={() => triggerMutation.mutate("news")}
                      disabled={triggerMutation.isPending}
                      size="sm" 
                      className="rounded-lg h-8 text-xs text-white bg-primary/20 hover:bg-primary/30"
                    >
                      <Play className="w-3.5 h-3.5 mr-1" /> Run
                    </Button>
                  </div>

                  <div className="flex justify-between items-center gap-2 p-2.5 bg-white/2 rounded-xl border border-white/5">
                    <div>
                      <p className="text-xs font-semibold text-white/85">Derivatives ingest</p>
                      <p className="text-[10px] text-white/30">Option chain Max pain & PCR</p>
                    </div>
                    <Button 
                      onClick={() => triggerMutation.mutate("fo")}
                      disabled={triggerMutation.isPending}
                      size="sm" 
                      className="rounded-lg h-8 text-xs text-white bg-primary/20 hover:bg-primary/30"
                    >
                      <Play className="w-3.5 h-3.5 mr-1" /> Run
                    </Button>
                  </div>

                  <div className="flex justify-between items-center gap-2 p-2.5 bg-white/2 rounded-xl border border-white/5">
                    <div>
                      <p className="text-xs font-semibold text-white/85">Morning prediction scan</p>
                      <p className="text-[10px] text-white/30">Evaluate 200 stocks features</p>
                    </div>
                    <Button 
                      onClick={() => triggerMutation.mutate("scan")}
                      disabled={triggerMutation.isPending}
                      size="sm" 
                      className="rounded-lg h-8 text-xs text-white bg-primary/20 hover:bg-primary/30"
                    >
                      <Play className="w-3.5 h-3.5 mr-1" /> Run
                    </Button>
                  </div>

                  <div className="flex justify-between items-center gap-2 p-2.5 bg-white/2 rounded-xl border border-white/5">
                    <div>
                      <p className="text-xs font-semibold text-white/85">Fill Today's outcomes</p>
                      <p className="text-[10px] text-white/30">Checks 9:30 open vs 3:15 close</p>
                    </div>
                    <Button 
                      onClick={() => triggerMutation.mutate("outcomes")}
                      disabled={triggerMutation.isPending}
                      size="sm" 
                      className="rounded-lg h-8 text-xs text-white bg-primary/20 hover:bg-primary/30"
                    >
                      <Play className="w-3.5 h-3.5 mr-1" /> Run
                    </Button>
                  </div>

                  <div className="flex justify-between items-center gap-2 p-2.5 bg-white/2 rounded-xl border border-white/5">
                    <div>
                      <p className="text-xs font-semibold text-white/85">Learning weights cycle</p>
                      <p className="text-[10px] text-white/30">Train scoring logic coefficients</p>
                    </div>
                    <Button 
                      onClick={() => triggerMutation.mutate("learning")}
                      disabled={triggerMutation.isPending}
                      size="sm" 
                      className="rounded-lg h-8 text-xs text-white bg-primary/20 hover:bg-primary/30"
                    >
                      <Play className="w-3.5 h-3.5 mr-1" /> Run
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* JOBS LEDGER */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="bg-white/3 border-white/5 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-white">System Job Ledger</CardTitle>
                  <CardDescription className="text-xs text-white/40">Persistent background runner status checks</CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  {dashboardData.system.jobs.length === 0 ? (
                    <div className="p-8 text-center text-white/20 font-mono text-xs">
                      No jobs currently registered in job ledger database.
                    </div>
                  ) : (
                    <table className="w-full text-left font-sans text-xs border-collapse">
                      <thead>
                        <tr className="bg-white/2 text-white/40 font-mono border-b border-white/5 text-[10px]">
                          <th className="py-2.5 px-4 font-normal">Job Name</th>
                          <th className="py-2.5 px-4 font-normal">Last Active</th>
                          <th className="py-2.5 px-4 font-normal">Status</th>
                          <th className="py-2.5 px-4 font-normal">Runs</th>
                          <th className="py-2.5 px-4 font-normal">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-white/85">
                        {dashboardData.system.jobs.map((job) => (
                          <tr key={job.id} className="hover:bg-white/1 transition-colors">
                            <td className="py-2.5 px-4 font-bold text-white font-mono">{job.jobName}</td>
                            <td className="py-2.5 px-4 font-mono text-white/45">
                              {job.lastRanAt ? new Date(job.lastRanAt).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Never"}
                            </td>
                            <td className="py-2.5 px-4 font-mono">
                              <Badge className={`text-[9px] ${
                                job.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                job.status === "running" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                job.status === "failed" ? "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse" :
                                "bg-white/5 text-white/45 border-white/5"
                              }`}>
                                {job.status}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-4 font-mono">{job.runCount}</td>
                            <td className="py-2.5 px-4 font-mono text-white/45">{job.lastDurationMs ? `${(job.lastDurationMs / 1000).toFixed(1)}s` : "0s"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

              {/* ERROR LOG */}
              <Card className="bg-white/3 border-white/5 rounded-2xl">
                <CardHeader className="pb-3 border-b border-white/5">
                  <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400" /> Error Event Logging
                  </CardTitle>
                  <CardDescription className="text-xs text-white/40">Non-swallowed failure reports from APEX workers</CardDescription>
                </CardHeader>
                <CardContent className="p-0 max-h-48 overflow-y-auto">
                  {dashboardData.system.errors.length === 0 ? (
                    <div className="p-8 text-center text-white/20 font-mono text-xs">
                      No error reports logged. System is operating at 100% health.
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5 font-mono text-[10px]">
                      {dashboardData.system.errors.map((err) => (
                        <div key={err.id} className="p-3 hover:bg-white/2 transition-colors flex flex-col gap-1 text-red-300">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-red-400">{err.jobName} {err.symbol ? `(${err.symbol})` : ""}</span>
                            <span className="text-white/25">{new Date(err.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-white/60 leading-normal">{err.errorMessage}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ═══ INNER COMPONENT: PREDICTION CARD ═══ */
function PredictionCard({ pred }: { pred: ApexPrediction }) {
  const isUp = pred.direction === "UP";
  const outcomeFilled = pred.isCorrect !== null;
  const isCorrect = pred.isCorrect;

  return (
    <Card className="relative bg-white/3 border-white/5 rounded-2xl overflow-hidden hover:bg-white/5 hover:border-white/10 transition-all duration-300 group shadow-md">
      
      {/* OUTCOME OVERLAY BRANDING */}
      {outcomeFilled && (
        <div className={`absolute top-0 right-0 py-1 px-3 text-[10px] font-mono font-bold rounded-bl-xl border-b border-l ${
          isCorrect 
            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
            : "bg-red-500/20 text-red-400 border-red-500/30"
        }`}>
          {isCorrect ? "✅ CORRECT" : "❌ INCORRECT"} {parseFloat(pred.actualReturnPct || "0") >= 0 ? "+" : ""}{parseFloat(pred.actualReturnPct || "0").toFixed(2)}%
        </div>
      )}

      <CardContent className="p-4 sm:p-5 flex gap-4">
        
        {/* DIRECTION COLUMN */}
        <div className="flex flex-col items-center justify-center gap-1.5 flex-shrink-0">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isUp 
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" 
              : "bg-red-500/15 text-red-400 border border-red-500/25"
          }`}>
            {isUp ? <ArrowUpRight className="w-7 h-7" /> : <ArrowDownRight className="w-7 h-7" />}
          </div>
          <span className={`text-[10px] font-bold font-mono ${isUp ? "text-emerald-400" : "text-red-400"}`}>
            {pred.direction}
          </span>
        </div>

        {/* DETAILS COLUMN */}
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <h4 className="text-base font-bold text-white tracking-tight leading-none">{pred.symbol}</h4>
            <span className="text-white/40 text-xs font-mono">
              Score: <span className="text-primary font-bold">{parseFloat(pred.confidenceScore).toFixed(1)}</span>
            </span>
          </div>

          <p className="text-xs text-white/60 leading-normal">{pred.reasoning}</p>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Badge variant="outline" className="text-[9px] py-0 px-2 font-mono text-white/40 border-white/10">
              Gap: {parseFloat(pred.gapScore).toFixed(0)}
            </Badge>
            <Badge variant="outline" className="text-[9px] py-0 px-2 font-mono text-white/40 border-white/10">
              F&O: {parseFloat(pred.foScore).toFixed(0)}
            </Badge>
            <Badge variant="outline" className="text-[9px] py-0 px-2 font-mono text-white/40 border-white/10">
              News: {parseFloat(pred.newsScore).toFixed(0)}
            </Badge>
            <Badge variant="outline" className="text-[9px] py-0 px-2 font-mono text-white/40 border-white/10">
              Mom: {parseFloat(pred.momentumScore).toFixed(0)}
            </Badge>
          </div>

          {outcomeFilled && pred.openPrice && pred.closePrice && (
            <div className="flex items-center gap-3 text-[10px] text-white/35 font-mono pt-1.5 border-t border-white/5 mt-1.5">
              <span>9:30 AM Entry: ₹{parseFloat(pred.openPrice).toLocaleString("en-IN")}</span>
              <span>•</span>
              <span>3:15 PM Exit: ₹{parseFloat(pred.closePrice).toLocaleString("en-IN")}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
