import { useState } from "react";
import { type StockIQResult, type SubScore } from "@shared/types";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";

interface StockIQBreakdownProps {
  data: StockIQResult;
}

export default function StockIQBreakdown({ data }: StockIQBreakdownProps) {
  const { fundamentals, technicals, momentum, insider } = data;
  const [activeTab, setActiveTab] = useState("fundamentals");

  const getInterpretationStyles = (interpretation: string) => {
    switch (interpretation) {
      case "Strong":
        return {
          bg: "bg-emerald-500/10 border-emerald-500/20",
          text: "text-emerald-600 dark:text-emerald-400",
          icon: <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 dark:text-emerald-400" />,
        };
      case "Average":
        return {
          bg: "bg-amber-500/10 border-amber-500/20",
          text: "text-amber-600 dark:text-amber-400",
          icon: <HelpCircle className="h-4.5 w-4.5 text-amber-500 dark:text-amber-400" />,
        };
      default:
        return {
          bg: "bg-rose-500/10 border-rose-500/20",
          text: "text-rose-600 dark:text-rose-400",
          icon: <AlertCircle className="h-4.5 w-4.5 text-rose-500 dark:text-rose-400" />,
        };
    }
  };

  const getPillarStyles = (pillar: string) => {
    switch (pillar) {
      case "fundamentals":
        return {
          gradient: "from-blue-600/20 via-blue-900/5 to-transparent",
          border: "border-blue-500/25",
          tabGlow: "shadow-[0_0_12px_rgba(59,130,246,0.2)]",
          scoreBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        };
      case "technicals":
        return {
          gradient: "from-orange-600/20 via-orange-900/5 to-transparent",
          border: "border-orange-500/25",
          tabGlow: "shadow-[0_0_12px_rgba(249,115,22,0.2)]",
          scoreBg: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
        };
      case "momentum":
        return {
          gradient: "from-rose-600/20 via-rose-900/5 to-transparent",
          border: "border-rose-500/25",
          tabGlow: "shadow-[0_0_12px_rgba(244,63,94,0.2)]",
          scoreBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
        };
      case "insider":
        return {
          gradient: "from-emerald-600/20 via-emerald-900/5 to-transparent",
          border: "border-emerald-500/25",
          tabGlow: "shadow-[0_0_12px_rgba(16,185,129,0.2)]",
          scoreBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        };
      default:
        return {
          gradient: "from-primary/20 to-transparent",
          border: "border-primary/25",
          tabGlow: "",
          scoreBg: "",
        };
    }
  };

  const currentStyles = getPillarStyles(activeTab);

  const renderMetricGrid = (pillarData: SubScore) => {
    if (!pillarData.metrics || pillarData.metrics.length === 0) {
      return (
        <div className="text-center py-6 text-muted-foreground text-xs">
          No metrics available for this pillar.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pillarData.metrics.map((m, idx) => {
          const metricStyle = getInterpretationStyles(m.interpretation);
          return (
            <Card
              key={idx}
              className={cn(
                "relative overflow-hidden border border-border bg-card backdrop-blur-md transition-all duration-300 hover:border-border/80 hover:bg-muted/30"
              )}
            >
              <CardContent className="p-4 flex flex-col justify-between h-full min-h-[110px]">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    {m.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {metricStyle.icon}
                    <Badge className={cn("text-[9px] font-bold uppercase px-1.5 py-0.2 border", metricStyle.bg, metricStyle.text)}>
                      {m.interpretation}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-baseline justify-between mt-3">
                  <span className="text-2xl font-black font-display text-foreground">
                    {m.value ?? "—"}
                  </span>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-muted-foreground font-medium">Contrib</span>
                    <span className="text-[11px] font-bold text-foreground/80">{m.contribution}/100</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <Card className={cn("relative overflow-hidden border border-border bg-card/45 backdrop-blur-xl shadow-2xl transition-all duration-500", currentStyles.border)}>
      {/* Background radial spotlight */}
      <div className={cn("absolute -left-1/4 -top-1/4 w-3/4 h-3/4 rounded-full blur-3xl opacity-10 bg-gradient-to-br", currentStyles.gradient)} />

      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold font-display text-foreground">StockIQ Analytical Breakdown</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Explore granular details, weight contributions, and sub-score evaluations.</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 bg-muted border border-border p-1 rounded-xl gap-1 mb-6">
            <TabsTrigger
              value="fundamentals"
              className={cn(
                "rounded-lg text-xs font-semibold py-2 transition-all cursor-pointer",
                activeTab === "fundamentals" && "bg-card text-blue-600 dark:text-blue-400 font-bold " + getPillarStyles("fundamentals").tabGlow
              )}
            >
              🏗️ Fundamentals
            </TabsTrigger>
            <TabsTrigger
              value="technicals"
              className={cn(
                "rounded-lg text-xs font-semibold py-2 transition-all cursor-pointer",
                activeTab === "technicals" && "bg-card text-orange-600 dark:text-orange-400 font-bold " + getPillarStyles("technicals").tabGlow
              )}
            >
              📊 Technicals
            </TabsTrigger>
            <TabsTrigger
              value="momentum"
              className={cn(
                "rounded-lg text-xs font-semibold py-2 transition-all cursor-pointer",
                activeTab === "momentum" && "bg-card text-rose-600 dark:text-rose-400 font-bold " + getPillarStyles("momentum").tabGlow
              )}
            >
              🚀 Momentum
            </TabsTrigger>
            <TabsTrigger
              value="insider"
              className={cn(
                "rounded-lg text-xs font-semibold py-2 transition-all cursor-pointer",
                activeTab === "insider" && "bg-card text-emerald-600 dark:text-emerald-400 font-bold " + getPillarStyles("insider").tabGlow
              )}
            >
              👁️ Insider
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fundamentals" className="mt-0 focus-visible:outline-none">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Weight: 30%</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Pillar Score:</span>
                <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold font-mono", getPillarStyles("fundamentals").scoreBg)}>
                  {fundamentals.score}/100
                </span>
              </div>
            </div>
            {renderMetricGrid(fundamentals)}
          </TabsContent>

          <TabsContent value="technicals" className="mt-0 focus-visible:outline-none">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Weight: 25%</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Pillar Score:</span>
                <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold font-mono", getPillarStyles("technicals").scoreBg)}>
                  {technicals.score}/100
                </span>
              </div>
            </div>
            {renderMetricGrid(technicals)}
          </TabsContent>

          <TabsContent value="momentum" className="mt-0 focus-visible:outline-none">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Weight: 25%</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Pillar Score:</span>
                <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold font-mono", getPillarStyles("momentum").scoreBg)}>
                  {momentum.score}/100
                </span>
              </div>
            </div>
            {renderMetricGrid(momentum)}
          </TabsContent>

          <TabsContent value="insider" className="mt-0 focus-visible:outline-none">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Weight: 20%</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Pillar Score:</span>
                <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold font-mono", getPillarStyles("insider").scoreBg)}>
                  {insider.score}/100
                </span>
              </div>
            </div>
            {renderMetricGrid(insider)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
