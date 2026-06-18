import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Zap } from "lucide-react";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, YAxis,
} from "recharts";

/* ─── Static mock chart data ─────────────────────────────── */
const chartData = [
  { v: 100 }, { v: 101.2 }, { v: 98.5 }, { v: 103.1 }, { v: 105.4 },
  { v: 102.9 }, { v: 107.6 }, { v: 109.2 }, { v: 106.8 }, { v: 111.3 },
  { v: 114.7 }, { v: 112.1 }, { v: 116.9 }, { v: 119.4 }, { v: 117.2 },
  { v: 121.8 }, { v: 124.3 }, { v: 122.6 }, { v: 126.9 }, { v: 129.7 },
  { v: 127.4 }, { v: 131.2 }, { v: 134.6 }, { v: 132.1 }, { v: 136.8 },
  { v: 139.4 }, { v: 137.9 }, { v: 142.3 }, { v: 145.1 }, { v: 148.6 },
];

/* ─── Floating ticker chip component ────────────────────── */
function TickerChip({
  symbol, change, positive, delay,
}: {
  symbol: string; change: string; positive: boolean; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
        glass-card text-xs font-mono font-semibold
        ${positive
          ? "text-emerald-400 border-emerald-500/20"
          : "text-red-400 border-red-500/20"
        }
      `}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full animate-pulse ${positive ? "bg-emerald-400" : "bg-red-400"}`}
      />
      {symbol}
      <span>{positive ? "▲" : "▼"} {change}</span>
    </motion.div>
  );
}

/* ─── Mock dashboard preview ─────────────────────────────── */
function MockDashboard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full max-w-4xl mx-auto"
    >
      {/* Fade-out bottom gradient so it blends into the page */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent z-20 pointer-events-none rounded-b-2xl" />

      {/* Outer glow */}
      <div className="absolute -inset-1 rounded-2xl bg-gradient-to-b from-primary/20 to-transparent blur-xl opacity-60 pointer-events-none" />

      {/* Terminal chrome */}
      <div className="relative rounded-2xl overflow-hidden border border-white/8 shadow-2xl glass-card">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6 bg-white/2">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
          <div className="flex-1 mx-4">
            <div className="h-5 w-56 mx-auto rounded-md bg-white/6 flex items-center justify-center">
              <span className="text-[10px] text-white/30 font-mono">genai-stock.app / check-stock</span>
            </div>
          </div>
        </div>

        {/* Dashboard body */}
        <div className="p-5 bg-[#070708]">
          {/* Top stat row */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: "NIFTY 50", val: "24,853.15", chg: "+1.38%", up: true },
              { label: "SENSEX",   val: "81,947.13", chg: "+1.22%", up: true },
              { label: "BANKNIFTY",val: "53,209.40", chg: "-0.29%", up: false },
              { label: "INDIA VIX",val: "12.94",     chg: "-3.10%", up: false },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-3 bg-white/3 border border-white/5">
                <div className="text-[10px] text-white/40 font-mono uppercase tracking-wider mb-1">{s.label}</div>
                <div className="text-sm font-mono font-bold text-white tabular-nums">{s.val}</div>
                <div className={`text-[11px] font-mono font-semibold ${s.up ? "text-emerald-400" : "text-red-400"}`}>
                  {s.chg}
                </div>
              </div>
            ))}
          </div>

          {/* Chart + sidebar */}
          <div className="grid grid-cols-[1fr_140px] gap-3">
            {/* Area chart */}
            <div className="rounded-xl p-3 bg-white/2 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[10px] text-white/40 font-mono">RELIANCE.NS</div>
                  <div className="text-lg font-mono font-bold text-white tabular-nums">₹2,948.65</div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs font-mono text-emerald-400">+2.41%</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={100}>
                <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="heroGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6d28d9" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#6d28d9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis domain={["dataMin - 2", "dataMax + 2"]} hide />
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="px-2 py-1 rounded-lg glass-card text-[10px] text-white font-mono">
                          ₹{(payload[0].value as number).toFixed(2)}
                        </div>
                      ) : null
                    }
                  />
                  <Area
                    type="monotoneX"
                    dataKey="v"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    fill="url(#heroGradient)"
                    isAnimationActive={true}
                    animationDuration={1200}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* AI insight panel */}
            <div className="rounded-xl p-3 bg-white/2 border border-white/5 flex flex-col gap-2">
              <div className="text-[10px] text-white/40 font-mono uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 text-primary" /> AI Signal
              </div>
              <div className="flex-1 flex flex-col items-center justify-center gap-2">
                {/* SVG gauge ring */}
                <div className="relative w-16 h-16">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="14" fill="none"
                      stroke="hsl(142,71%,50%)" strokeWidth="3"
                      strokeDasharray="63 88"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-emerald-400">BUY</span>
                    <span className="text-[9px] text-white/40">78%</span>
                  </div>
                </div>
                <div className="w-full space-y-1.5 text-[10px] font-mono">
                  <div className="flex justify-between text-emerald-400">
                    <span>Buy</span><span>78%</span>
                  </div>
                  <div className="flex justify-between text-yellow-400/70">
                    <span>Hold</span><span>15%</span>
                  </div>
                  <div className="flex justify-between text-red-400/60">
                    <span>Sell</span><span>7%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main hero ──────────────────────────────────────────── */
interface AnimatedHeroProps {
  onGetStarted: () => void;
  onExploreFree: () => void;
}

export function AnimatedHero({ onGetStarted, onExploreFree }: AnimatedHeroProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  return (
    <div
      ref={ref}
      className="relative overflow-hidden w-full min-h-[95vh] flex flex-col items-center justify-center py-20 lg:py-28"
    >
      {/* ── Layer 1: Base background ─────────────── */}
      <div className="absolute inset-0 bg-background" />

      {/* ── Layer 2: Animated grid ───────────────── */}
      <div className="absolute inset-0 grid-bg-animated opacity-60 pointer-events-none" />

      {/* ── Layer 3: Radial gradient orbs ────────── */}
      {/* Indigo orb — top left */}
      <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, hsl(260 84% 65% / 0.18) 0%, transparent 70%)",
          filter: "blur(60px)",
          animation: "pulse-glow 4s ease-in-out infinite",
        }}
      />
      {/* Emerald orb — bottom right */}
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, hsl(142 71% 50% / 0.12) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "pulse-glow 5s ease-in-out infinite 1.5s",
        }}
      />
      {/* Subtle indigo center top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70%] h-[40%] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, hsl(260 84% 60% / 0.10) 0%, transparent 60%)",
          filter: "blur(40px)",
        }}
      />

      {/* ── Content ──────────────────────────────── */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 w-full flex flex-col items-center text-center">

        {/* Live badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm font-medium text-foreground mb-8"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_2px_hsl(142,71%,50%,0.6)]" />
          <span className="text-white/70">Live NSE/BSE</span>
          <span className="w-px h-3 bg-white/15" />
          <span className="text-primary font-semibold">Powered by AI</span>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl md:text-7xl lg:text-8xl font-display font-bold tracking-tight text-foreground mb-6 leading-[1.05]"
        >
          Institutional Grade
          <br className="hidden sm:block" />
          <span className="text-shimmer">
            Stock Intelligence
          </span>
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="text-base md:text-lg text-white/50 max-w-xl mx-auto mb-10 leading-relaxed"
        >
          Elevate your trading with AI-powered insights, real-time technical analysis,
          and curated stock recommendations — professional tools, now for everyone.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          className="flex flex-col sm:flex-row gap-3 justify-center mb-6"
        >
          <Button
            size="lg"
            onClick={onGetStarted}
            className="h-13 px-8 text-sm font-semibold rounded-full group relative overflow-hidden
              bg-primary text-primary-foreground
              hover:glow-border transition-all duration-300"
            style={{
              boxShadow: "0 0 0 1px hsl(260 84% 65% / 0.3), 0 0 24px 0px hsl(260 84% 65% / 0.25)",
            }}
          >
            <span className="relative z-10 flex items-center gap-2">
              Start Trading Now
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
            {/* Hover shimmer overlay */}
            <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={onExploreFree}
            className="h-13 px-8 text-sm font-semibold rounded-full
              glass-card border-white/10 text-white/80
              hover:text-white hover:border-white/20 hover:bg-white/5
              transition-all duration-300"
          >
            Explore Dashboard
          </Button>
        </motion.div>

        {/* Floating ticker chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.45 }}
          className="flex flex-wrap items-center justify-center gap-2 mb-14"
        >
          <TickerChip symbol="RELIANCE" change="2.41%" positive delay={0.5} />
          <TickerChip symbol="NIFTY 50" change="1.38%" positive delay={0.6} />
          <TickerChip symbol="TCS" change="0.87%" positive delay={0.7} />
          <TickerChip symbol="HDFC" change="0.31%" positive={false} delay={0.8} />
          <TickerChip symbol="INFY" change="1.59%" positive delay={0.9} />
        </motion.div>

        {/* Mock dashboard (desktop only) */}
        <div className="hidden md:block w-full">
          <MockDashboard />
        </div>
      </div>
    </div>
  );
}
