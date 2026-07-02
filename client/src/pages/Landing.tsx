import { useState } from "react";
import { AuthModal } from "@/components/AuthModal";
import { AnimatedHero } from "@/components/AnimatedHero";
import { TrendingUp, BarChart3, Sparkles, Shield, Activity, Zap, LineChart, Brain, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: <Activity className="h-5 w-5 text-emerald-400" />,
    title: "Tick-level NSE/BSE data",
    description: "Every listed stock. Real quotes, not delayed. The same feed institutional desks pay thousands for.",
    accent: "emerald",
  },
  {
    icon: <Brain className="h-5 w-5 text-primary" />,
    title: "Three self-learning AI engines",
    description: "APEX for intraday, HERMES for swing, FUGU for multi-factor. Each evolves its own weights from live market outcomes.",
    accent: "violet",
  },
  {
    icon: <LineChart className="h-5 w-5 text-sky-400" />,
    title: "Pattern recognition at scale",
    description: "Cup & handle, breakouts, VCP setups — scanned across 1,200+ stocks daily without you lifting a finger.",
    accent: "sky",
  },
  {
    icon: <Shield className="h-5 w-5 text-amber-400" />,
    title: "Analyst-vetted picks",
    description: "Curated trade setups with entry, target, and stop-loss. Designed for execution, not just inspiration.",
    accent: "amber",
  },
  {
    icon: <BarChart3 className="h-5 w-5 text-violet-400" />,
    title: "Deep fundamental drill-down",
    description: "P&L, balance sheet, cash flow, promoter holding — pulled directly from Screener.in and FMP.",
    accent: "violet",
  },
  {
    icon: <Zap className="h-5 w-5 text-rose-400" />,
    title: "Instant Telegram alerts",
    description: "Signal fires → Telegram ping within seconds. No dashboard-watching required.",
    accent: "rose",
  },
];

const accentMap: Record<string, string> = {
  emerald: "border-emerald-500/15 hover:border-emerald-500/30",
  violet: "border-violet-500/15 hover:border-violet-500/30",
  sky: "border-sky-500/15 hover:border-sky-500/30",
  amber: "border-amber-500/15 hover:border-amber-500/30",
  rose: "border-rose-500/15 hover:border-rose-500/30",
};

export default function Landing() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [hasSkipped, setHasSkipped] = useState(false);

  const handleSkip = () => {
    setHasSkipped(true);
    setShowAuthModal(false);
  };

  if (hasSkipped) {
    window.location.href = "/check-stock";
    return null;
  }

  return (
    <div className="min-h-screen bg-background w-full max-w-full overflow-x-hidden">
      <AnimatedHero
        onGetStarted={() => setShowAuthModal(true)}
        onExploreFree={handleSkip}
      />

      {/* ── What's inside ──────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-5 md:px-8 lg:px-12 py-20 md:py-28">

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-mono text-foreground/50 tracking-wide">What's inside</span>
          </div>
          <h2 className="font-display font-bold text-foreground leading-tight tracking-tight mb-4"
            style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)" }}>
            Built for traders who<br className="hidden md:block" /> already know what they're doing.
          </h2>
          <p className="text-base text-foreground/40 max-w-lg leading-relaxed">
            No "how to invest" tutorials. Six real tools used by active NSE/BSE traders every session.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className={`rounded-2xl p-5 border transition-all duration-200 ${accentMap[f.accent]}`}
              style={{ background: "rgba(255,255,255,0.025)" }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4 flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                {f.icon}
              </div>
              <h3 className="text-[14px] font-semibold text-foreground/85 mb-2 leading-snug font-sans">{f.title}</h3>
              <p className="text-[13px] text-foreground/40 leading-relaxed font-sans">{f.description}</p>
            </motion.div>
          ))}
        </div>

        {/* ── Bottom CTA ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="mt-20 text-center"
        >
          <div className="inline-flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={() => setShowAuthModal(true)}
              className="group inline-flex items-center gap-2 px-7 h-12 rounded-xl text-sm font-semibold text-primary-foreground bg-primary transition-all duration-200"
              style={{ boxShadow: "0 0 0 1px hsl(260 84% 65% / 0.35), 0 4px 20px 0 hsl(260 84% 65% / 0.2)" }}
            >
              Get full access
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={handleSkip}
              className="text-sm text-foreground/40 hover:text-foreground/65 transition-colors underline underline-offset-4 decoration-foreground/20"
            >
              Browse as guest
            </button>
          </div>
          <p className="text-[11px] text-foreground/25 font-mono mt-4">No credit card · Sign in with Google</p>
        </motion.div>
      </div>

      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} onSkip={handleSkip} />
    </div>
  );
}
