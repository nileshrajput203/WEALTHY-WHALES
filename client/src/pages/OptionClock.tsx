import { useQuery } from "@tanstack/react-query";
import { Clock, TrendingUp, TrendingDown, Target, Activity, BarChart2 } from "lucide-react";
import { useState, useEffect } from "react";

interface OptionData {
  index: string;
  spot: number;
  maxPain: number;
  pcr: number;
  totalCallOI: number;
  totalPutOI: number;
  topCallStrikes: { strike: number; oi: number; change: number }[];
  topPutStrikes: { strike: number; oi: number; change: number }[];
  ivPercentile: number;
  expiryDate: string;
}

function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const expiry = new Date(targetDate + "T15:30:00+05:30");
      const diff = expiry.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
}

export default function OptionClock() {
  const [selectedIndex, setSelectedIndex] = useState<"NIFTY" | "BANKNIFTY">("NIFTY");

  const { data, isLoading } = useQuery<{ data: OptionData }>({
    queryKey: ["/api/option-chain", selectedIndex],
    staleTime: 60 * 1000,
  });

  const od = data?.data;
  const countdown = useCountdown(od?.expiryDate ?? new Date().toISOString().split("T")[0]);

  const pcrColor = !od ? "text-white/40"
    : od.pcr > 1.2 ? "text-emerald-400"
    : od.pcr < 0.8 ? "text-red-400"
    : "text-yellow-400";

  const pcrLabel = !od ? "—"
    : od.pcr > 1.2 ? "Bullish"
    : od.pcr < 0.8 ? "Bearish"
    : "Neutral";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1 flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary" />
            Option Clock
          </h1>
          <p className="text-sm text-white/40 font-sans">
            Expiry countdown · PCR gauge · Max Pain · OI analysis
          </p>
        </div>
        <div className="flex gap-1.5">
          {(["NIFTY", "BANKNIFTY"] as const).map(idx => (
            <button
              key={idx}
              onClick={() => setSelectedIndex(idx)}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                selectedIndex === idx
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-white/3 border-white/8 text-white/40 hover:text-white/60"
              }`}
            >
              {idx}
            </button>
          ))}
        </div>
      </div>

      {/* Countdown Timer */}
      <div className="glass-card rounded-2xl border border-white/6 p-6">
        <p className="text-[10px] font-mono uppercase tracking-widest text-white/25 mb-3">
          ⏰ Time to Expiry {od?.expiryDate ? `(${od.expiryDate})` : ""}
        </p>
        <div className="flex items-center gap-4 justify-center">
          {[
            { val: countdown.days, label: "Days" },
            { val: countdown.hours, label: "Hours" },
            { val: countdown.minutes, label: "Min" },
            { val: countdown.seconds, label: "Sec" },
          ].map(u => (
            <div key={u.label} className="text-center">
              <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
                <span className="text-2xl font-mono font-bold text-primary tabular-nums">
                  {String(u.val).padStart(2, "0")}
                </span>
              </div>
              <p className="text-[9px] font-mono text-white/25 mt-1 uppercase">{u.label}</p>
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-white/3 animate-pulse border border-white/5" />
          ))}
        </div>
      ) : od ? (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-white/6 p-4 glass-card">
              <div className="flex items-center gap-1.5 mb-2">
                <Activity className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] font-mono uppercase text-white/25">Spot Price</span>
              </div>
              <p className="text-xl font-mono font-bold text-white">{od.spot.toLocaleString("en-IN")}</p>
            </div>
            <div className="rounded-2xl border border-white/6 p-4 glass-card">
              <div className="flex items-center gap-1.5 mb-2">
                <Target className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-[10px] font-mono uppercase text-white/25">Max Pain</span>
              </div>
              <p className="text-xl font-mono font-bold text-yellow-400">{od.maxPain.toLocaleString("en-IN")}</p>
              <p className="text-[9px] font-mono text-white/20 mt-0.5">
                {od.spot > od.maxPain ? "Spot above pain" : "Spot below pain"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/6 p-4 glass-card">
              <div className="flex items-center gap-1.5 mb-2">
                <BarChart2 className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[10px] font-mono uppercase text-white/25">PCR</span>
              </div>
              <p className={`text-xl font-mono font-bold ${pcrColor}`}>{od.pcr.toFixed(2)}</p>
              <p className={`text-[9px] font-mono mt-0.5 ${pcrColor}`}>{pcrLabel}</p>
            </div>
            <div className="rounded-2xl border border-white/6 p-4 glass-card">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] font-mono uppercase text-white/25">IV Percentile</span>
              </div>
              <p className="text-xl font-mono font-bold text-cyan-400">{od.ivPercentile}%</p>
              <p className="text-[9px] font-mono text-white/20 mt-0.5">
                {od.ivPercentile > 70 ? "High IV — sell premium" : od.ivPercentile < 30 ? "Low IV — buy options" : "Normal IV"}
              </p>
            </div>
          </div>

          {/* OI Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Call OI */}
            <div className="glass-card rounded-2xl border border-white/6 p-4">
              <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" /> Top Call OI (Resistance)
              </h3>
              <div className="space-y-2">
                {od.topCallStrikes.map(s => {
                  const maxOI = Math.max(...od.topCallStrikes.map(x => x.oi));
                  const pct = (s.oi / maxOI) * 100;
                  return (
                    <div key={s.strike} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-white/50 w-16 text-right">{s.strike}</span>
                      <div className="flex-1 h-5 bg-white/3 rounded-lg overflow-hidden relative">
                        <div className="h-full bg-red-500/30 rounded-lg transition-all" style={{ width: `${pct}%` }} />
                        <span className="absolute right-2 top-0.5 text-[9px] font-mono text-white/40">
                          {(s.oi / 100000).toFixed(1)}L
                        </span>
                      </div>
                      <span className={`text-[10px] font-mono w-12 text-right ${s.change >= 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {s.change >= 0 ? "+" : ""}{(s.change / 1000).toFixed(0)}K
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Put OI */}
            <div className="glass-card rounded-2xl border border-white/6 p-4">
              <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Top Put OI (Support)
              </h3>
              <div className="space-y-2">
                {od.topPutStrikes.map(s => {
                  const maxOI = Math.max(...od.topPutStrikes.map(x => x.oi));
                  const pct = (s.oi / maxOI) * 100;
                  return (
                    <div key={s.strike} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-white/50 w-16 text-right">{s.strike}</span>
                      <div className="flex-1 h-5 bg-white/3 rounded-lg overflow-hidden relative">
                        <div className="h-full bg-emerald-500/30 rounded-lg transition-all" style={{ width: `${pct}%` }} />
                        <span className="absolute right-2 top-0.5 text-[9px] font-mono text-white/40">
                          {(s.oi / 100000).toFixed(1)}L
                        </span>
                      </div>
                      <span className={`text-[10px] font-mono w-12 text-right ${s.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {s.change >= 0 ? "+" : ""}{(s.change / 1000).toFixed(0)}K
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-16 glass-card rounded-2xl border border-white/6">
          <Clock className="w-12 h-12 mx-auto text-white/15 mb-3" />
          <h3 className="text-base font-semibold text-white/60 mb-1">Option data loading…</h3>
          <p className="text-sm text-white/30">Option chain data refreshes every minute</p>
        </div>
      )}
    </div>
  );
}
