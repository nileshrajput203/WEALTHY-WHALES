import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, CheckCircle2, AlertCircle } from "lucide-react";

interface DataFreshnessBadgeProps {
  lastUpdated?: string | Date;
  source?: string;
  isLive?: boolean;
}

export function DataFreshnessBadge({
  lastUpdated,
  source = "NSE / Free Feed",
  isLive = false,
}: DataFreshnessBadgeProps) {
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    const formatTime = () => {
      const now = lastUpdated ? new Date(lastUpdated) : new Date();
      setTimeStr(
        now.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };

    formatTime();
    const interval = setInterval(formatTime, 10000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 font-medium shadow-sm hover:border-slate-700 transition-colors cursor-pointer">
          <span className="relative flex h-2 w-2">
            {isLive ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500/80"></span>
            )}
          </span>
          <span className="tabular-nums font-mono">
            {timeStr ? `Updated ${timeStr} IST` : "Syncing..."}
          </span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400 font-sans">
            {isLive ? "Live (Best-effort)" : "~15m delayed"}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="bg-slate-900 border border-slate-800 text-slate-200 text-xs p-3 max-w-xs shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-slate-100">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>Market Data Transparency</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Source: <span className="text-slate-200">{source}</span>.
          </p>
          <p className="text-[11px] text-slate-400">
            In accordance with our 100% Free & Honest mandate, zero paid vendor feeds are utilized. Free market data is delayed by approximately 15 minutes during trading hours.
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default DataFreshnessBadge;
