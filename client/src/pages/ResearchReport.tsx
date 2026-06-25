import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useViewMode } from "@/hooks/useViewMode";
import { useQuery } from "@tanstack/react-query";
import { type StockIQResult } from "@shared/types";
import AIResearchReport from "@/components/AIResearchReport";
import StockIQScore from "@/components/StockIQScore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, ArrowLeft, Loader2, AlertCircle } from "lucide-react";

export default function ResearchReport() {
  const [, params] = useRoute("/stock/:symbol/report");
  const rawSymbol = params?.symbol || "";
  const symbol = rawSymbol.toUpperCase();

  const { isPro } = useViewMode();
  const [reportText, setReportText] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client-side cache check
  useEffect(() => {
    const cached = localStorage.getItem(`genai-report-${symbol}`);
    if (cached) {
      setReportText(cached);
    }
  }, [symbol]);

  // Fetch StockIQ score for context
  const { data: stockIq, isLoading: iqLoading } = useQuery<StockIQResult>({
    queryKey: [`/api/stockiq/${symbol}`],
    enabled: !!symbol,
  });

  const handleGenerate = () => {
    setIsGenerating(true);
    setReportText("");
    setStatusMessage("Connecting to research server...");
    setError(null);

    const eventSource = new EventSource(`/api/research-report/${symbol}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "status") {
          setStatusMessage(data.message);
        } else if (data.type === "section") {
          setReportText((prev) => prev + "\n\n" + data.content);
        } else if (data.type === "complete") {
          setReportText(data.fullReport);
          setIsGenerating(false);
          setStatusMessage("");
          eventSource.close();
          // Save to client-side localStorage
          localStorage.setItem(`genai-report-${symbol}`, data.fullReport);
        } else if (data.type === "error") {
          setError(data.message || "Failed to generate report");
          setIsGenerating(false);
          eventSource.close();
        }
      } catch (err) {
        console.error("SSE parse error:", err);
        setError("Error parsing server updates");
        setIsGenerating(false);
        eventSource.close();
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE connection error:", err);
      setError("Disconnected from research stream. Please try again.");
      setIsGenerating(false);
      eventSource.close();
    };
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-3 print:hidden">
        <Link href={`/stock/${symbol}`}>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-semibold gap-1 hover:bg-white/5 cursor-pointer">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to {symbol} Dashboard
          </Button>
        </Link>
      </div>

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4 border-b border-white/5">
        <div>
          <span className="text-[10px] font-bold text-primary uppercase tracking-widest block mb-1">
            GenAI Analyst Room
          </span>
          <h2 className="text-3xl font-extrabold font-display text-white">
            {symbol} Research Report
          </h2>
          <p className="text-sm text-white/40 mt-1">
            Real-time multi-dimensional AI equity research for Indian Markets.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: StockIQ Card & Controls */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24 print:hidden">
          {stockIq && (
            <StockIQScore data={stockIq} />
          )}

          <Card className="border border-white/5 bg-black/40 backdrop-blur-xl">
            <CardContent className="p-5 space-y-4">
              <h4 className="text-xs font-bold text-white/60 uppercase tracking-widest">Analyst Controls</h4>
              
              {!reportText && !isGenerating && (
                <div className="space-y-3">
                  <p className="text-xs text-white/40 leading-relaxed">
                    No report has been compiled for {symbol} yet. Click generate to initiate live data mining & AI analysis.
                  </p>
                  <Button
                    onClick={handleGenerate}
                    className="w-full h-10 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white font-bold text-xs tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(124,58,237,0.3)] hover:shadow-[0_0_16px_rgba(124,58,237,0.5)] active:scale-95 cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    GENERATE NEW REPORT
                  </Button>
                </div>
              )}

              {isGenerating && (
                <div className="space-y-3 text-center py-2">
                  <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white">Compiling Report...</p>
                    <p className="text-[10px] text-white/40 animate-pulse">{statusMessage}</p>
                  </div>
                  <p className="text-[10px] text-white/30 italic">Usually takes about 30-45 seconds</p>
                </div>
              )}

              {reportText && !isGenerating && (
                <div className="space-y-3">
                  <p className="text-xs text-white/40 leading-relaxed">
                    Report is fully generated and cached client-side. You can overwrite it by compiling a fresh one.
                  </p>
                  <Button
                    onClick={handleGenerate}
                    variant="outline"
                    className="w-full h-10 border-white/10 hover:border-white/20 text-white hover:bg-white/5 font-semibold text-xs tracking-wider flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    RE-GENERATE REPORT
                  </Button>
                </div>
              )}

              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-xs font-medium leading-normal">{error}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Report Content */}
        <div className="lg:col-span-8 space-y-6">
          {reportText ? (
            <AIResearchReport
              symbol={symbol}
              companyName={stockIq?.companyName || symbol}
              reportText={reportText}
              isStreaming={isGenerating}
            />
          ) : (
            !isGenerating && (
              <div className="flex flex-col items-center justify-center text-center py-20 bg-black/20 border border-dashed border-white/5 rounded-2xl p-6">
                <Sparkles className="h-10 w-10 text-white/15 mb-4 animate-pulse" />
                <h4 className="text-sm font-bold text-white/60 uppercase tracking-widest">Ready to Analyse</h4>
                <p className="text-xs text-white/45 max-w-sm mt-1 mb-6 leading-relaxed">
                  Trigger the AI to mine balance sheets, profit margins, charts, and news to assemble a complete report.
                </p>
                <Button
                  onClick={handleGenerate}
                  className="bg-gradient-to-r from-primary to-violet-600 text-white font-bold text-xs tracking-wider px-6 h-10 rounded-lg cursor-pointer"
                >
                  COMPILE RESEARCH REPORT
                </Button>
              </div>
            )
          )}

          {/* Streaming display block if report is loading and we have partial content */}
          {isGenerating && reportText && (
            <div className="border border-white/5 bg-black/10 rounded-xl p-4">
              <h5 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2 animate-pulse">
                Stream Output:
              </h5>
              <div className="text-xs font-mono text-white/30 truncate">
                {reportText.substring(reportText.length - 200)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
