import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Zap } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";

const chartData = [
  { v: 100 }, { v: 101.2 }, { v: 98.5 }, { v: 103.1 }, { v: 105.4 },
  { v: 102.9 }, { v: 107.6 }, { v: 109.2 }, { v: 106.8 }, { v: 111.3 },
  { v: 114.7 }, { v: 112.1 }, { v: 116.9 }, { v: 119.4 }, { v: 117.2 },
  { v: 121.8 }, { v: 124.3 }, { v: 122.6 }, { v: 126.9 }, { v: 129.7 },
  { v: 127.4 }, { v: 131.2 }, { v: 134.6 }, { v: 132.1 }, { v: 136.8 },
  { v: 139.4 }, { v: 137.9 }, { v: 142.3 }, { v: 145.1 }, { v: 148.6 },
];

const indexStats = [
  { label: "NIFTY 50", val: "24,853", chg: "+1.38%", up: true },
  { label: "SENSEX",   val: "81,947", chg: "+1.22%", up: true },
  { label: "BANKNIFTY",val: "53,209", chg: "−0.29%", up: false },
  { label: "INDIA VIX",val: "12.94",  chg: "−3.10%", up: false },
];

function LiveIndexBar() {
  return (
    <div className="w-full flex items-center gap-0 mb-10 md:mb-14 overflow-x-auto no-scrollbar">
      {indexStats.map((s, i) => (
        <div key={s.label} className="flex items-center">
          <div className="flex flex-col px-4 md:px-6 py-2">
            <span className="text-[10px] font-mono text-foreground/35 uppercase tracking-widest mb-0.5">{s.label}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-sm md:text-base font-mono font-bold text-foreground tabular-nums">{s.val}</span>
              <span className={`text-[11px] font-mono font-semibold tabular-nums ${s.up ? "text-emerald-400" : "text-rose-400"}`}>{s.chg}</span>
            </div>
          </div>
          {i < indexStats.length - 1 && <div className="w-px h-8 bg-white/8 flex-shrink-0" />}
        </div>
      ))}
    </div>
  );
}

function DashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full"
    >
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-primary/15 via-transparent to-transparent blur-xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none rounded-b-2xl" />

      <div className="relative rounded-2xl overflow-hidden border border-white/8" style={{ background: "hsl(0 0% 5%)" }}>
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/6" style={{ background: "hsl(0 0% 6%)" }}>
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
          <div className="flex-1 mx-3">
            <div className="h-5 w-52 mx-auto rounded bg-white/5 flex items-center justify-center">
              <span className="text-[9px] text-white/25 font-mono tracking-wide">wealthywhales.app / stock-lab</span>
            </div>
          </div>
        </div>

        <div className="p-4" style={{ background: "hsl(0 0% 5%)" }}>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {indexStats.map(s => (
              <div key={s.label} className="rounded-lg p-2.5 border border-white/5" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="text-[9px] text-white/35 font-mono uppercase tracking-wider mb-1">{s.label}</div>
                <div className="text-xs font-mono font-bold text-white tabular-nums">{s.val}</div>
                <div className={`text-[10px] font-mono font-semibold ${s.up ? "text-emerald-400" : "text-rose-400"}`}>{s.chg}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[1fr_120px] gap-2">
            <div className="rounded-lg p-3 border border-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-[9px] text-white/35 font-mono">RELIANCE.NS</div>
                  <div className="text-sm font-mono font-bold text-white tabular-nums">₹2,948.65</div>
                </div>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
                  <span className="text-[10px] font-mono text-emerald-400">+2.41%</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(260,84%,65%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(260,84%,65%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis domain={["dataMin - 2", "dataMax + 2"]} hide />
                  <Area type="monotoneX" dataKey="v" stroke="hsl(260,84%,65%)" strokeWidth={1.5} fill="url(#heroGrad)" isAnimationActive animationDuration={1400} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg p-3 border border-white/5 flex flex-col gap-2.5" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="text-[9px] text-white/35 font-mono uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-2 h-2 text-primary" /> AI Signal
              </div>
              <div className="flex-1 flex flex-col items-center justify-center gap-2">
                <div className="relative w-14 h-14">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="13" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                    <circle cx="18" cy="18" r="13" fill="none" stroke="hsl(142,71%,50%)" strokeWidth="2.5" strokeDasharray="58 82" strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[9px] font-bold text-emerald-400 leading-none">BUY</span>
                    <span className="text-[8px] text-white/35 leading-none mt-0.5">78%</span>
                  </div>
                </div>
                <div className="w-full space-y-1 text-[9px] font-mono">
                  <div className="flex justify-between text-emerald-400"><span>Buy</span><span>78%</span></div>
                  <div className="flex justify-between text-amber-400/70"><span>Hold</span><span>15%</span></div>
                  <div className="flex justify-between text-rose-400/60"><span>Sell</span><span>7%</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface AnimatedHeroProps {
  onGetStarted: () => void;
  onExploreFree: () => void;
}

export function AnimatedHero({ onGetStarted, onExploreFree }: AnimatedHeroProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  return (
    <div ref={ref} className="relative w-full overflow-hidden" style={{ background: "hsl(var(--background))" }}>
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div
        className="absolute top-0 right-0 w-[60%] h-[70%] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 100% 0%, hsl(260 84% 65% / 0.10) 0%, transparent 65%)", filter: "blur(60px)" }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-8 lg:px-12 pt-16 pb-10 md:pt-24 md:pb-14">

        {/* Signature element: live index strip — unique to this page */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <LiveIndexBar />
        </motion.div>

        {/* Asymmetric two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-start">

          {/* Left — copy */}
          <div className="flex flex-col">

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: 0.05 }}
              className="inline-flex self-start items-center gap-2 px-3 py-1.5 rounded-full mb-6"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_hsl(142,71%,50%,0.5)]" />
              <span className="text-xs font-mono text-foreground/55 tracking-wide">NSE · BSE · Live Data</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="font-display font-bold leading-[1.02] tracking-tight text-foreground mb-5"
              style={{ fontSize: "clamp(2.4rem, 5vw, 4.2rem)" }}
            >
              Trade with the<br />
              <span className="text-shimmer">data the pros</span><br />
              actually use.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.18, ease: "easeOut" }}
              className="text-base text-foreground/45 mb-8 leading-relaxed max-w-md"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Three self-learning AI engines scan every NSE/BSE stock daily —
              intraday scalp setups, swing entries, and pattern breakouts.
              No noise. Just signal.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.25, ease: "easeOut" }}
              className="flex flex-col sm:flex-row gap-3 mb-10"
            >
              <Button
                size="lg"
                onClick={onGetStarted}
                className="h-12 px-7 text-sm font-semibold rounded-xl group relative overflow-hidden bg-primary text-primary-foreground"
                style={{ boxShadow: "0 0 0 1px hsl(260 84% 65% / 0.35), 0 4px 20px 0 hsl(260 84% 65% / 0.25)" }}
              >
                <span className="relative z-10 flex items-center gap-2">
                  Get Full Access
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
                <span className="absolute inset-0 bg-white/8 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </Button>

              <Button
                size="lg"
                variant="outline"
                onClick={onExploreFree}
                className="h-12 px-7 text-sm font-semibold rounded-xl border-white/10 text-foreground/65 hover:text-foreground hover:border-white/18 hover:bg-white/4 transition-all duration-200"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                Browse Free
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap gap-x-6 gap-y-2"
            >
              {[
                { num: "3", label: "AI engines" },
                { num: "1,200+", label: "stocks tracked" },
                { num: "89%", label: "backtest accuracy" },
              ].map(s => (
                <div key={s.label} className="flex items-baseline gap-1.5">
                  <span className="text-xl font-mono font-bold text-foreground tabular-nums">{s.num}</span>
                  <span className="text-xs text-foreground/35 font-sans">{s.label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — dashboard preview (desktop only) */}
          <div className="hidden lg:block">
            <DashboardPreview />
          </div>
        </div>
      </div>
    </div>
  );
}
