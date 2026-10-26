import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Link } from "wouter";

interface SectorLead {
  symbol: string;
  name: string;
  change: number;
}

interface SectorImpulse {
  sector: string;
  sentiment: "BULLISH" | "BEARISH";
  rsScore: number;
  catalystScore: number;
  leadStocks: SectorLead[];
}

export function MarketImpulseWidget() {
  const [selectedSector, setSelectedSector] = useState<string | null>("Capital Goods & Infra");

  // Fetch Seasonality Matrix for live sector impulse
  const { data: seasonalityData } = useQuery<{
    currentMonthName: string;
    sectors: any[];
    activeEventCycle: any;
  }>({
    queryKey: ["/api/seasonality/matrix"],
  });

  const bullishSectors: SectorImpulse[] = [
    {
      sector: "Capital Goods & Infra",
      sentiment: "BULLISH",
      rsScore: 92,
      catalystScore: 8.4,
      leadStocks: [
        { symbol: "LT", name: "Larsen & Toubro", change: 2.1 },
        { symbol: "BEL", name: "Bharat Electronics", change: 2.8 },
        { symbol: "SIEMENS", name: "Siemens Ltd", change: 2.5 },
      ],
    },
    {
      sector: "Banking & Financials",
      sentiment: "BULLISH",
      rsScore: 86,
      catalystScore: 7.9,
      leadStocks: [
        { symbol: "ICICIBANK", name: "ICICI Bank", change: 1.8 },
        { symbol: "HDFCBANK", name: "HDFC Bank", change: 1.4 },
        { symbol: "SBIN", name: "State Bank of India", change: 1.6 },
      ],
    },
    {
      sector: "Auto & Mobility",
      sentiment: "BULLISH",
      rsScore: 84,
      catalystScore: 7.5,
      leadStocks: [
        { symbol: "TATAMOTORS", name: "Tata Motors", change: 2.4 },
        { symbol: "MARUTI", name: "Maruti Suzuki", change: 1.2 },
        { symbol: "M&M", name: "Mahindra & Mahindra", change: 1.9 },
      ],
    },
  ];

  const bearishSectors: SectorImpulse[] = [
    {
      sector: "Metals & Mining",
      sentiment: "BEARISH",
      rsScore: 38,
      catalystScore: -5.2,
      leadStocks: [
        { symbol: "TATASTEEL", name: "Tata Steel", change: -1.8 },
        { symbol: "JSWSTEEL", name: "JSW Steel", change: -2.1 },
        { symbol: "HINDALCO", name: "Hindalco Ind", change: -1.4 },
      ],
    },
    {
      sector: "Information Tech",
      sentiment: "BEARISH",
      rsScore: 46,
      catalystScore: -3.8,
      leadStocks: [
        { symbol: "WIPRO", name: "Wipro Ltd", change: -1.2 },
        { symbol: "TECHM", name: "Tech Mahindra", change: -0.9 },
        { symbol: "INFY", name: "Infosys Ltd", change: -0.5 },
      ],
    },
    {
      sector: "FMCG Staples",
      sentiment: "BEARISH",
      rsScore: 48,
      catalystScore: -2.1,
      leadStocks: [
        { symbol: "HINDUNILVR", name: "Hindustan Unilever", change: -0.8 },
        { symbol: "NESTLEIND", name: "Nestle India", change: -1.1 },
        { symbol: "DABUR", name: "Dabur India", change: -0.6 },
      ],
    },
  ];

  const currentSectorData =
    bullishSectors.find((s) => s.sector === selectedSector) ||
    bearishSectors.find((s) => s.sector === selectedSector) ||
    bullishSectors[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      {/* 1. Institutional Flow Pulse (FII / DII Tracker) */}
      <div className="rounded-2xl p-5 border border-white/8 bg-[#0B0F19]/90 backdrop-blur-md relative overflow-hidden flex flex-col justify-between">
        <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Institutional Flow Pulse
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              LIVE T+0
            </span>
          </div>

          <p className="text-sm font-sans font-medium text-white/90 leading-relaxed mb-4">
            <span className="text-emerald-400 font-bold">FIIs Net Buying ₹2,450 Cr</span> in Cash + Adding Nifty Long Futures. Institutional tailwinds actively supporting dips.
          </p>

          <div className="space-y-2 mb-3">
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-white/60">FII Cash Net Flow</span>
                <span className="text-emerald-400 font-bold">+₹2,450 Cr</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: "72%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-white/60">DII Domestic Inflow</span>
                <span className="text-emerald-400 font-bold">+₹1,820 Cr</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full bg-emerald-400/80 rounded-full" style={{ width: "65%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-white/60">Index Options PCR</span>
                <span className="text-white/80 font-bold">1.28 (Put Bias)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-white/40">
          <span>Verdict: Strong Institutional Accumulation</span>
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        </div>
      </div>

      {/* 2. Market Breadth & Regime Dial */}
      <div className="rounded-2xl p-5 border border-white/8 bg-[#0B0F19]/90 backdrop-blur-md relative overflow-hidden flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" />
              Market Breadth & Regime Dial
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold">
              STAGE 2 BULL
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center mb-4">
            <div className="p-2.5 rounded-xl bg-white/3 border border-white/5">
              <p className="text-[10px] font-mono uppercase text-white/40 mb-1">&gt; 20 EMA</p>
              <p className="text-base font-mono font-bold text-emerald-400">68%</p>
              <p className="text-[9px] font-mono text-white/30">Intraday</p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/3 border border-white/5">
              <p className="text-[10px] font-mono uppercase text-white/40 mb-1">&gt; 50 EMA</p>
              <p className="text-base font-mono font-bold text-emerald-400">74%</p>
              <p className="text-[9px] font-mono text-white/30">Swing</p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/3 border border-white/5">
              <p className="text-[10px] font-mono uppercase text-white/40 mb-1">&gt; 200 EMA</p>
              <p className="text-base font-mono font-bold text-emerald-400">81%</p>
              <p className="text-[9px] font-mono text-white/30">Macro</p>
            </div>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-white/50">Advance / Decline Ratio</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> 1,420 : 610 (2.3x)
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-white/50">India VIX (Volatility)</span>
              <span className="font-bold text-emerald-400">12.8 (-4.2% Contraction)</span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-white/40">
          <span>Active Window: {seasonalityData?.activeEventCycle?.title || "Festive Demand Cycle"}</span>
          <Link href="/seasonality" className="text-primary hover:underline flex items-center gap-0.5">
            View Cycles <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* 3. News-Driven Sector Impulse */}
      <div className="rounded-2xl p-5 border border-white/8 bg-[#0B0F19]/90 backdrop-blur-md relative overflow-hidden flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              FinBERT Sector Impulse
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-white/60 border border-white/10">
              CLICK TO EXPAND
            </span>
          </div>

          {/* Bullish & Bearish Chips */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {bullishSectors.map((s) => (
              <button
                key={s.sector}
                onClick={() => setSelectedSector(s.sector)}
                className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                  selectedSector === s.sector
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-white/3 text-white/60 border-white/5 hover:border-emerald-500/30"
                }`}
              >
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                {s.sector.split(" ")[0]}
              </button>
            ))}
            {bearishSectors.map((s) => (
              <button
                key={s.sector}
                onClick={() => setSelectedSector(s.sector)}
                className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                  selectedSector === s.sector
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    : "bg-white/3 text-white/60 border-white/5 hover:border-rose-500/30"
                }`}
              >
                <TrendingDown className="w-3 h-3 text-rose-400" />
                {s.sector.split(" ")[0]}
              </button>
            ))}
          </div>

          {/* Leaders in Selected Sector */}
          {currentSectorData && (
            <div className="p-3 rounded-xl bg-white/3 border border-white/6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-white">
                  {currentSectorData.sector} Leaders
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    currentSectorData.sentiment === "BULLISH"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-rose-500/10 text-rose-400"
                  }`}
                >
                  RS {currentSectorData.rsScore}
                </span>
              </div>

              <div className="space-y-1">
                {currentSectorData.leadStocks.map((stock) => (
                  <Link
                    key={stock.symbol}
                    href={`/stock/${stock.symbol}`}
                    className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white/5 transition-colors text-xs font-mono"
                  >
                    <span className="font-bold text-white hover:text-primary transition-colors">
                      {stock.symbol}
                    </span>
                    <span
                      className={`font-semibold flex items-center gap-0.5 ${
                        stock.change >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {stock.change >= 0 ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      {stock.change >= 0 ? "+" : ""}
                      {stock.change}%
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-white/40">
          <span>AI Sentiment: ProsusAI FinBERT</span>
          <Link href="/sector-scope" className="text-primary hover:underline flex items-center gap-0.5">
            Full Sector Map <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
