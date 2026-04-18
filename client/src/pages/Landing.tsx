import { useState } from "react";
import { AuthModal } from "@/components/AuthModal";
import { AnimatedHero } from "@/components/AnimatedHero";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import { TrendingUp, BarChart3, Sparkles, Shield, Activity, Zap, LineChart } from "lucide-react";

const Skeleton = () => (
  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-neutral-200 dark:from-neutral-900 dark:to-neutral-800 to-neutral-100"></div>
);

const Features = [
  {
    title: "Real-time Market Data",
    description: "Get lightning-fast NSE/BSE updates without latency. Professional grade WebSockets deliver every tick.",
    icon: <Activity className="h-6 w-6 text-primary" />,
    header: (
        <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-card border border-border flex-col p-4 justify-end relative overflow-hidden">
            <div className="absolute inset-0 opacity-20">
                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <path d="M0,100 L20,80 L40,90 L60,40 L80,60 L100,20" fill="none" stroke="hsl(var(--success))" strokeWidth="2" />
                </svg>
            </div>
            <div className="text-2xl font-bold text-success z-10 w-full text-right font-mono tracking-tighter">NIFTY 50<br/>+1.2%</div>
        </div>
    )
  },
  {
    title: "AI-Powered Intelligence",
    description: "Our proprietary AI models analyze thousands of data points to deliver high-probability trade setups.",
    icon: <Sparkles className="h-6 w-6 text-amber-500" />,
    header: (
      <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-secondary/50 border border-border flex-col p-4 items-center justify-center relative overflow-hidden">
         <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent animate-pulse-glow" />
         <Sparkles className="w-12 h-12 text-amber-500/50" />
      </div>
    )
  },
  {
    title: "Institutional Technicals",
    description: "Advanced charting, custom indicators, and automated pattern recognition normally reserved for quants.",
    icon: <LineChart className="h-6 w-6 text-blue-500" />,
    header: (
        <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-card border border-border p-4 gap-2 columns-3 justify-end items-end pb-0">
             <div className="w-full bg-blue-500/30 rounded-t-sm h-[30%]"></div>
             <div className="w-full bg-blue-500/50 rounded-t-sm h-[60%]"></div>
             <div className="w-full bg-blue-500/80 rounded-t-sm h-[90%]"></div>
        </div>
    )
  },
  {
    title: "Expert Curation",
    description: "Verified analysts and top-tier algorithms provide daily swinging and positional recommendations.",
    icon: <Shield className="h-6 w-6 text-emerald-500" />,
    header: <Skeleton />
  },
  {
    title: "Instant Execution Readiness",
    description: "Connect your broker and execute trades directly from our enhanced analysis dashboard.",
    icon: <Zap className="h-6 w-6 text-yellow-500" />,
    header: <Skeleton />
  },
];

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

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-20 w-full relative z-10">
        <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-4">
                The Edge You&#39;ve Been Looking For
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
                Stop trading blind. Arm yourself with the tools the pros use.
            </p>
        </div>

        <BentoGrid className="mx-auto">
          {Features.map((item, i) => (
            <BentoGridItem
              key={i}
              index={i}
              title={item.title}
              description={item.description}
              header={item.header}
              icon={item.icon}
              className={i === 0 || i === 3 ? "md:col-span-2" : ""}
            />
          ))}
        </BentoGrid>
      </div>

      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} onSkip={handleSkip} />
    </div>
  );
}
