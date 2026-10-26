import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Calculator,
  ShieldCheck,
  TrendingUp,
  Percent,
  Copy,
  Check,
  Layers,
  ArrowRight,
  Sparkles,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface PositionSizerModalProps {
  open: boolean;
  onClose: () => void;
  symbol: string;
  defaultEntry?: number;
  defaultStopLoss?: number;
  defaultTarget1?: number;
  defaultTarget2?: number;
  onOpenTimeMachine?: () => void;
}

const CAPITAL_PRESETS = [
  { label: "₹50K", value: 50000 },
  { label: "₹1 Lakh", value: 100000 },
  { label: "₹2.5 Lakh", value: 250000 },
  { label: "₹5 Lakh", value: 500000 },
  { label: "₹10 Lakh", value: 1000000 },
];

const RISK_PRESETS = [
  { label: "0.5%", value: 0.5 },
  { label: "1.0%", value: 1.0 },
  { label: "1.5%", value: 1.5 },
  { label: "2.0%", value: 2.0 },
];

export function PositionSizerModal({
  open,
  onClose,
  symbol,
  defaultEntry = 1000,
  defaultStopLoss = 960,
  defaultTarget1 = 1080,
  defaultTarget2 = 1140,
  onOpenTimeMachine,
}: PositionSizerModalProps) {
  const { toast } = useToast();
  const [accountCapital, setAccountCapital] = useState<number>(200000);
  const [riskPct, setRiskPct] = useState<number>(1.0);
  const [customRiskRupees, setCustomRiskRupees] = useState<string>("");
  const [useFixedRupeeRisk, setUseFixedRupeeRisk] = useState<boolean>(false);
  const [tradeMode, setTradeMode] = useState<"DELIVERY" | "INTRADAY_MIS">("DELIVERY");

  const [entryPrice, setEntryPrice] = useState<number>(defaultEntry);
  const [stopLoss, setStopLoss] = useState<number>(defaultStopLoss);
  const [target1, setTarget1] = useState<number>(defaultTarget1);
  const [target2, setTarget2] = useState<number>(defaultTarget2);
  const [copied, setCopied] = useState<boolean>(false);

  // Sync when defaults change
  React.useEffect(() => {
    if (defaultEntry) setEntryPrice(defaultEntry);
    if (defaultStopLoss) setStopLoss(defaultStopLoss);
    if (defaultTarget1) setTarget1(defaultTarget1);
    if (defaultTarget2) setTarget2(defaultTarget2);
  }, [defaultEntry, defaultStopLoss, defaultTarget1, defaultTarget2]);

  // Sizing Calculations
  const calculations = useMemo(() => {
    const entry = Number(entryPrice) || 0;
    const sl = Number(stopLoss) || 0;
    const t1 = Number(target1) || 0;
    const t2 = Number(target2) || 0;

    const perShareRisk = Math.abs(entry - sl);
    const rewardT1 = Math.abs(t1 - entry);
    const rewardT2 = Math.abs(t2 - entry);
    const rrRatio = perShareRisk > 0 ? (rewardT1 / perShareRisk).toFixed(2) : "0";

    // Max Rupee Risk
    const maxLossBudget = useFixedRupeeRisk && Number(customRiskRupees) > 0
      ? Number(customRiskRupees)
      : Math.round((accountCapital * (riskPct / 100)));

    // Exact quantity (shares)
    const exactQty = perShareRisk > 0 ? Math.floor(maxLossBudget / perShareRisk) : 0;

    // Total position cost
    const totalPositionValue = exactQty * entry;

    // Margin required (Intraday MIS typically 5x leverage on NSE equities)
    const marginRequired = tradeMode === "INTRADAY_MIS"
      ? Math.round(totalPositionValue / 5)
      : totalPositionValue;

    const portfolioAllocationPct = accountCapital > 0
      ? Math.round((marginRequired / accountCapital) * 1000) / 10
      : 0;

    const actualRupeeRisk = exactQty * perShareRisk;
    const actualProfitT1 = exactQty * rewardT1;
    const actualProfitT2 = exactQty * rewardT2;

    // 3-Stage Trailing Exit Blueprint
    // Stage 1: 50% shares at Target 1
    const stage1Qty = Math.floor(exactQty * 0.5);
    const stage1Profit = stage1Qty * rewardT1;

    // Stage 2: 30% shares at Target 2
    const stage2Qty = Math.floor(exactQty * 0.3);
    const stage2Profit = stage2Qty * rewardT2;

    // Stage 3: Remaining 20% runner shares
    const stage3Qty = exactQty - stage1Qty - stage2Qty;

    return {
      perShareRisk,
      rewardT1,
      rewardT2,
      rrRatio,
      maxLossBudget,
      exactQty,
      totalPositionValue,
      marginRequired,
      portfolioAllocationPct,
      actualRupeeRisk,
      actualProfitT1,
      actualProfitT2,
      stage1Qty,
      stage1Profit,
      stage2Qty,
      stage2Profit,
      stage3Qty,
    };
  }, [accountCapital, riskPct, customRiskRupees, useFixedRupeeRisk, tradeMode, entryPrice, stopLoss, target1, target2]);

  const copyBlueprint = () => {
    const text = `🎯 [WEALTHY-WHALES] INSTITUTIONAL TRADE BLUEPRINT: ${symbol.toUpperCase()}
• Direction: BUY / LONG (${tradeMode})
• Entry Price: ₹${entryPrice}
• Stop Loss: ₹${stopLoss} (-₹${calculations.perShareRisk}/sh)
• Target 1: ₹${target1} (+₹${calculations.rewardT1}/sh | R:R 1:${calculations.rrRatio})
• Target 2: ₹${target2} (+₹${calculations.rewardT2}/sh)
─────────────────────────────
• Account Capital: ₹${accountCapital.toLocaleString("en-IN")}
• Sized Quantity: ${calculations.exactQty} shares
• Total Investment: ₹${calculations.marginRequired.toLocaleString("en-IN")} (${calculations.portfolioAllocationPct}% portfolio)
• Maximum Capital at Risk: ₹${calculations.actualRupeeRisk.toLocaleString("en-IN")}
─────────────────────────────
📋 MULTI-STAGE TRAILING EXIT PLAN:
1. Book 50% (${calculations.stage1Qty} sh) at ₹${target1} → Lock ₹${calculations.stage1Profit.toLocaleString("en-IN")}
2. Book 30% (${calculations.stage2Qty} sh) at ₹${target2} → Lock ₹${calculations.stage2Profit.toLocaleString("en-IN")} (Move SL to ₹${entryPrice} Breakeven)
3. Trail 20% (${calculations.stage3Qty} sh) with 20 EMA runner`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: "Trade Blueprint Copied",
      description: `Exact size of ${calculations.exactQty} shares copied to clipboard.`,
    });
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto bg-slate-950 border-slate-800 text-slate-100 p-4 sm:p-6 shadow-2xl">
        <DialogHeader className="border-b border-slate-800/80 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-mono font-bold flex items-center gap-2">
                  <span>POSITION SIZER & RISK BUDGET</span>
                  <span className="text-emerald-400 font-extrabold">{symbol?.toUpperCase()}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Fixed-fractional capital allocation & 3-stage trailing exit planner
                </DialogDescription>
              </div>
            </div>

            <Badge variant="outline" className="font-mono text-xs px-2.5 py-1 bg-emerald-950/40 text-emerald-300 border-emerald-700/50">
              1% RULE ALIGNED
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Capital & Risk Input Matrix */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-3">
            {/* Account Capital */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-mono text-slate-300 uppercase font-semibold">
                  Account Trading Capital
                </label>
                <span className="text-xs font-mono font-bold text-white">
                  ₹{accountCapital.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CAPITAL_PRESETS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setAccountCapital(p.value)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
                      accountCapital === p.value
                        ? "bg-emerald-600 text-white font-bold"
                        : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <Input
                  type="number"
                  value={accountCapital}
                  onChange={e => setAccountCapital(Number(e.target.value))}
                  className="w-28 h-7 text-xs font-mono bg-slate-950 border-slate-800 ml-auto"
                  placeholder="Custom ₹"
                />
              </div>
            </div>

            {/* Risk Tolerance */}
            <div className="pt-2 border-t border-slate-800/60">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-mono text-slate-300 uppercase font-semibold">
                  Risk Tolerance Per Trade
                </label>
                <span className="text-xs font-mono font-bold text-rose-400">
                  Max Loss: ₹{calculations.maxLossBudget.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {RISK_PRESETS.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => {
                      setRiskPct(r.value);
                      setUseFixedRupeeRisk(false);
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
                      !useFixedRupeeRisk && riskPct === r.value
                        ? "bg-rose-600 text-white font-bold"
                        : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-[10px] font-mono text-slate-500">OR ₹:</span>
                  <Input
                    type="number"
                    value={customRiskRupees}
                    onChange={e => {
                      setCustomRiskRupees(e.target.value);
                      setUseFixedRupeeRisk(true);
                    }}
                    className="w-24 h-7 text-xs font-mono bg-slate-950 border-slate-800"
                    placeholder="Fixed ₹"
                  />
                </div>
              </div>
            </div>

            {/* Product Mode */}
            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Product Order Mode</span>
              <div className="flex rounded-md overflow-hidden border border-slate-800">
                <button
                  type="button"
                  onClick={() => setTradeMode("DELIVERY")}
                  className={`px-3 py-1 text-xs font-mono transition-colors ${
                    tradeMode === "DELIVERY"
                      ? "bg-indigo-600 text-white font-bold"
                      : "bg-slate-950 text-slate-400 hover:text-white"
                  }`}
                >
                  CNC / Delivery (1x)
                </button>
                <button
                  type="button"
                  onClick={() => setTradeMode("INTRADAY_MIS")}
                  className={`px-3 py-1 text-xs font-mono transition-colors ${
                    tradeMode === "INTRADAY_MIS"
                      ? "bg-indigo-600 text-white font-bold"
                      : "bg-slate-950 text-slate-400 hover:text-white"
                  }`}
                >
                  Intraday MIS (5x Margin)
                </button>
              </div>
            </div>
          </div>

          {/* Sizing Outputs Display */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-200">
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block">
                Recommended Qty
              </span>
              <div className="text-2xl font-mono font-black text-white">
                {calculations.exactQty} <span className="text-xs text-emerald-400 font-normal">shares</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Risk: ₹{calculations.perShareRisk.toFixed(2)}/sh
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Capital Required
              </span>
              <div className="text-lg sm:text-xl font-mono font-black text-slate-100">
                ₹{calculations.marginRequired.toLocaleString("en-IN")}
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {calculations.portfolioAllocationPct}% of account
              </span>
            </div>

            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-300">
              <span className="text-[10px] font-mono text-rose-400 uppercase tracking-wider block">
                Total Max Risk
              </span>
              <div className="text-lg sm:text-xl font-mono font-black text-rose-400">
                -₹{calculations.actualRupeeRisk.toLocaleString("en-IN")}
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                If Stop Hit @ ₹{stopLoss}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-300">
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block">
                Profit at Target 1
              </span>
              <div className="text-lg sm:text-xl font-mono font-black text-emerald-400">
                +₹{calculations.actualProfitT1.toLocaleString("en-IN")}
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                R:R 1:{calculations.rrRatio}
              </span>
            </div>
          </div>

          {/* 3-Stage Multi-Exit Blueprint */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5">
            <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              INSTITUTIONAL MULTI-STAGE TRAILING EXIT BLUEPRINT
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-bold text-emerald-400">STAGE 1: 50% EXIT</span>
                  <span>Target 1</span>
                </div>
                <div className="text-sm font-bold text-white">
                  Sell {calculations.stage1Qty} sh @ ₹{target1}
                </div>
                <div className="text-[10px] text-emerald-400/90 font-medium">
                  Locks in +₹{calculations.stage1Profit.toLocaleString("en-IN")} profit
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-bold text-cyan-400">STAGE 2: 30% EXIT</span>
                  <span>Target 2</span>
                </div>
                <div className="text-sm font-bold text-white">
                  Sell {calculations.stage2Qty} sh @ ₹{target2}
                </div>
                <div className="text-[10px] text-cyan-400/90 font-medium">
                  +₹{calculations.stage2Profit.toLocaleString("en-IN")} (Move SL to ₹{entryPrice} BE)
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-bold text-indigo-400">STAGE 3: 20% RUNNER</span>
                  <span>Trailing</span>
                </div>
                <div className="text-sm font-bold text-white">
                  Hold {calculations.stage3Qty} sh Runner
                </div>
                <div className="text-[10px] text-indigo-300/90 font-medium">
                  Trail using daily 20 EMA or swing low
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
            {onOpenTimeMachine && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenTimeMachine();
                }}
                className="h-8 text-xs font-mono border-indigo-700/50 text-indigo-300 hover:bg-indigo-950/40 flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                <span>Simulate Odds in Time Machine</span>
              </Button>
            )}

            <Button
              onClick={copyBlueprint}
              className="h-8 text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white ml-auto flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Blueprint Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Trade Blueprint</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
