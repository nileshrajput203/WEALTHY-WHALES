import { useState, useMemo } from "react";
import { Triangle, TrendingUp, TrendingDown, Zap, Shield, Target, ChevronDown } from "lucide-react";

type Strategy = "bull-call" | "bear-put" | "straddle" | "strangle" | "iron-condor" | "covered-call";

interface StrategyConfig {
  name: string;
  legs: string[];
  maxProfit: string;
  maxLoss: string;
  breakeven: string;
  sentiment: "Bullish" | "Bearish" | "Neutral" | "Volatile";
  description: string;
  color: string;
}

const strategies: Record<Strategy, StrategyConfig> = {
  "bull-call": {
    name: "Bull Call Spread",
    legs: ["Buy ATM Call", "Sell OTM Call"],
    maxProfit: "Strike Diff - Premium Paid",
    maxLoss: "Net Premium Paid",
    breakeven: "Lower Strike + Premium",
    sentiment: "Bullish",
    description: "Limited risk bullish play. Profit when stock rises moderately. Lower cost than naked call.",
    color: "emerald",
  },
  "bear-put": {
    name: "Bear Put Spread",
    legs: ["Buy ATM Put", "Sell OTM Put"],
    maxProfit: "Strike Diff - Premium Paid",
    maxLoss: "Net Premium Paid",
    breakeven: "Higher Strike - Premium",
    sentiment: "Bearish",
    description: "Limited risk bearish play. Profit when stock drops. Cost-effective downside bet.",
    color: "red",
  },
  straddle: {
    name: "Long Straddle",
    legs: ["Buy ATM Call", "Buy ATM Put"],
    maxProfit: "Unlimited",
    maxLoss: "Total Premium Paid",
    breakeven: "Strike ± Premium",
    sentiment: "Volatile",
    description: "Profit from big moves in either direction. Ideal before earnings or events.",
    color: "purple",
  },
  strangle: {
    name: "Long Strangle",
    legs: ["Buy OTM Call", "Buy OTM Put"],
    maxProfit: "Unlimited",
    maxLoss: "Total Premium Paid",
    breakeven: "Call Strike + Premium / Put Strike - Premium",
    sentiment: "Volatile",
    description: "Cheaper than straddle but needs bigger move. Great for high-impact event plays.",
    color: "cyan",
  },
  "iron-condor": {
    name: "Iron Condor",
    legs: ["Sell OTM Call", "Buy Further OTM Call", "Sell OTM Put", "Buy Further OTM Put"],
    maxProfit: "Net Premium Received",
    maxLoss: "Strike Width - Premium",
    breakeven: "Narrow range between short strikes",
    sentiment: "Neutral",
    description: "Profit from low volatility. Stock stays in range. Theta decay works in your favor.",
    color: "yellow",
  },
  "covered-call": {
    name: "Covered Call",
    legs: ["Own Stock", "Sell OTM Call"],
    maxProfit: "Strike - Stock Price + Premium",
    maxLoss: "Stock drops to zero",
    breakeven: "Stock Price - Premium",
    sentiment: "Neutral",
    description: "Generate income from existing holdings. Cap upside for immediate premium income.",
    color: "blue",
  },
};

function GreeksCalculator() {
  const [spotPrice, setSpotPrice] = useState(24000);
  const [strikePrice, setStrikePrice] = useState(24000);
  const [daysToExpiry, setDaysToExpiry] = useState(7);
  const [iv, setIv] = useState(15);
  const [optionType, setOptionType] = useState<"Call" | "Put">("Call");

  // Black-Scholes approximation for Greeks
  const greeks = useMemo(() => {
    const S = spotPrice, K = strikePrice, T = daysToExpiry / 365, sigma = iv / 100, r = 0.065;
    if (T <= 0 || sigma <= 0) return { delta: 0, gamma: 0, theta: 0, vega: 0, premium: 0 };

    const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);

    // Normal CDF approximation
    const normCDF = (x: number) => {
      const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
      const p = 0.3275911;
      const sign = x < 0 ? -1 : 1;
      x = Math.abs(x) / Math.sqrt(2);
      const t = 1 / (1 + p * x);
      const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
      return 0.5 * (1 + sign * y);
    };
    const normPDF = (x: number) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);

    const Nd1 = normCDF(d1), Nd2 = normCDF(d2);
    const nd1 = normPDF(d1);

    let delta, premium;
    if (optionType === "Call") {
      delta = Nd1;
      premium = S * Nd1 - K * Math.exp(-r * T) * Nd2;
    } else {
      delta = Nd1 - 1;
      premium = K * Math.exp(-r * T) * (1 - Nd2) - S * (1 - Nd1);
    }

    const gamma = nd1 / (S * sigma * Math.sqrt(T));
    const theta = -(S * nd1 * sigma) / (2 * Math.sqrt(T)) / 365;
    const vega = S * nd1 * Math.sqrt(T) / 100;

    return {
      delta: Number(delta.toFixed(4)),
      gamma: Number(gamma.toFixed(6)),
      theta: Number(theta.toFixed(2)),
      vega: Number(vega.toFixed(2)),
      premium: Number(premium.toFixed(2)),
    };
  }, [spotPrice, strikePrice, daysToExpiry, iv, optionType]);

  return (
    <div className="glass-card rounded-2xl border border-white/6 p-5">
      <h3 className="text-sm font-semibold text-white/60 mb-4 flex items-center gap-2">
        <Zap className="w-4 h-4 text-yellow-400" />
        Greeks Calculator
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {[
          { label: "Spot", val: spotPrice, set: setSpotPrice, step: 50 },
          { label: "Strike", val: strikePrice, set: setStrikePrice, step: 50 },
          { label: "DTE", val: daysToExpiry, set: setDaysToExpiry, step: 1 },
          { label: "IV %", val: iv, set: setIv, step: 1 },
        ].map(f => (
          <div key={f.label}>
            <label className="text-[9px] font-mono uppercase text-white/25 mb-1 block">{f.label}</label>
            <input
              type="number"
              value={f.val}
              onChange={e => f.set(Number(e.target.value))}
              step={f.step}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm font-mono text-white focus:outline-none focus:border-primary/50"
            />
          </div>
        ))}
        <div>
          <label className="text-[9px] font-mono uppercase text-white/25 mb-1 block">Type</label>
          <div className="flex gap-1">
            {(["Call", "Put"] as const).map(t => (
              <button
                key={t}
                onClick={() => setOptionType(t)}
                className={`flex-1 px-2 py-2 rounded-lg text-xs font-mono font-bold border transition-all ${
                  optionType === t
                    ? t === "Call" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-red-500/20 border-red-500/40 text-red-400"
                    : "bg-white/3 border-white/8 text-white/40"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Greeks Output */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Premium", val: `₹${greeks.premium}`, color: "text-white" },
          { label: "Delta (Δ)", val: greeks.delta.toFixed(4), color: greeks.delta > 0 ? "text-emerald-400" : "text-red-400" },
          { label: "Gamma (Γ)", val: greeks.gamma.toFixed(6), color: "text-purple-400" },
          { label: "Theta (Θ)", val: greeks.theta.toFixed(2), color: "text-red-400" },
          { label: "Vega (ν)", val: greeks.vega.toFixed(2), color: "text-cyan-400" },
        ].map(g => (
          <div key={g.label} className="text-center p-3 rounded-xl bg-white/3 border border-white/5">
            <p className="text-[9px] font-mono uppercase text-white/25 mb-1">{g.label}</p>
            <p className={`text-lg font-mono font-bold ${g.color}`}>{g.val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OptionApex() {
  const [selected, setSelected] = useState<Strategy>("bull-call");
  const config = strategies[selected];

  const sentimentColors: Record<string, string> = {
    Bullish: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    Bearish: "text-red-400 bg-red-500/10 border-red-500/20",
    Neutral: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    Volatile: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1 flex items-center gap-2">
          <Triangle className="w-6 h-6 text-primary" />
          Option Apex
        </h1>
        <p className="text-sm text-white/40 font-sans">
          Strategy builder · Payoff analysis · Greeks calculator
        </p>
      </div>

      {/* Strategy Selector */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(strategies) as [Strategy, StrategyConfig][]).map(([key, s]) => (
          <button
            key={key}
            onClick={() => setSelected(key)}
            className={`px-3 py-2 rounded-xl text-xs font-mono font-semibold border transition-all ${
              selected === key
                ? "bg-primary/20 border-primary/40 text-primary"
                : "bg-white/3 border-white/8 text-white/40 hover:text-white/60"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Strategy Detail */}
      <div className="glass-card rounded-2xl border border-white/6 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-display font-bold text-white mb-1">{config.name}</h2>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${sentimentColors[config.sentiment]}`}>
              {config.sentiment === "Bullish" ? <TrendingUp className="w-2.5 h-2.5" /> : config.sentiment === "Bearish" ? <TrendingDown className="w-2.5 h-2.5" /> : <Target className="w-2.5 h-2.5" />}
              {config.sentiment}
            </span>
          </div>
        </div>

        <p className="text-sm text-white/50 mb-4">{config.description}</p>

        {/* Legs */}
        <div className="mb-4">
          <p className="text-[10px] font-mono uppercase tracking-wider text-white/25 mb-2">Strategy Legs</p>
          <div className="flex flex-wrap gap-2">
            {config.legs.map((leg, i) => (
              <span key={i} className="px-3 py-1.5 rounded-lg text-xs font-mono bg-white/5 border border-white/10 text-white/60">
                {i + 1}. {leg}
              </span>
            ))}
          </div>
        </div>

        {/* Risk/Reward */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl p-3 bg-emerald-500/5 border border-emerald-500/10">
            <p className="text-[9px] font-mono uppercase text-emerald-400/50 mb-1">Max Profit</p>
            <p className="text-sm font-mono font-bold text-emerald-400">{config.maxProfit}</p>
          </div>
          <div className="rounded-xl p-3 bg-red-500/5 border border-red-500/10">
            <p className="text-[9px] font-mono uppercase text-red-400/50 mb-1">Max Loss</p>
            <p className="text-sm font-mono font-bold text-red-400">{config.maxLoss}</p>
          </div>
          <div className="rounded-xl p-3 bg-yellow-500/5 border border-yellow-500/10">
            <p className="text-[9px] font-mono uppercase text-yellow-400/50 mb-1">Breakeven</p>
            <p className="text-sm font-mono font-bold text-yellow-400">{config.breakeven}</p>
          </div>
        </div>
      </div>

      {/* Greeks Calculator */}
      <GreeksCalculator />
    </div>
  );
}
