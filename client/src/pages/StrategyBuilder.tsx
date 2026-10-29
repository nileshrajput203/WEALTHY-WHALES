import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Code,
  Layers,
  Sparkles,
  Play,
  Plus,
  Trash2,
  TrendingUp,
  LineChart,
  Sliders,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { Link, useLocation } from "wouter";

interface StrategyRule {
  id?: string;
  category: "MARKETSMITH" | "SCREENER" | "CHARTINK_FO";
  indicator: string;
  timeframe: "5m" | "15m" | "1h" | "Daily" | "Weekly";
  operator: ">" | "<" | ">=" | "<=" | "==" | "CROSSES_ABOVE" | "CROSSES_BELOW";
  value: number | string;
}

interface CustomStrategy {
  name: string;
  description: string;
  formulaDSL?: string;
  rules: StrategyRule[];
}

interface ScanResult {
  symbol: string;
  companyName: string;
  price: number;
  changePercent: number;
  matchedRulesCount: number;
  totalRulesCount: number;
  rsRating: number;
  roce: number;
  roe: number;
  debtToEquity: number;
  volumeRatio: number;
  hitRate90d: number;
  profitFactor: number;
  setupSignal: "BUY" | "SELL";
  chartOverlays: {
    ema9: number;
    ema20: number;
    ema50: number;
    vwap: number;
    spotEntry: number;
    stopLoss: number;
    target1: number;
    target2: number;
  };
}

export default function StrategyBuilder() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"VISUAL" | "DSL" | "AI_PROMPT" | "CHARTINK">("VISUAL");
  const [strategyName, setStrategyName] = useState("My Quantitative Edge");
  const [strategyDesc, setStrategyDesc] = useState("Custom multi-layered scan combining MarketSmith RS and 20 EMA pullback.");
  const [formulaDSL, setFormulaDSL] = useState("CLOSE > EMA(20) AND LOW <= EMA(20) * 1.003 AND RS_RATING >= 80 AND VOLUME > SMA(VOLUME, 20) * 1.4");
  const [aiPrompt, setAiPrompt] = useState("Find F&O stocks retesting 20 EMA with rising OI and ROE > 18%");
  const [chartinkClause, setChartinkClause] = useState("( {cash} ( latest close > latest sma( close, 20 ) and latest volume > 100000 ) )");
  const [compiledStrategy, setCompiledStrategy] = useState<any>(null);
  const [copiedDsl, setCopiedDsl] = useState(false);
  const [copiedChartink, setCopiedChartink] = useState(false);

  const [rules, setRules] = useState<StrategyRule[]>([
    { category: "MARKETSMITH", indicator: "RS_RATING", timeframe: "Daily", operator: ">=", value: 80 },
    { category: "SCREENER", indicator: "ROCE", timeframe: "Daily", operator: ">=", value: 20 },
    { category: "CHARTINK_FO", indicator: "EMA_20_RETEST", timeframe: "15m", operator: ">=", value: "EMA_20" },
    { category: "CHARTINK_FO", indicator: "VOLUME_RATIO", timeframe: "Daily", operator: ">=", value: 1.3 },
  ]);

  // Fetch pre-built templates
  const { data: templates } = useQuery<any[]>({
    queryKey: ["/api/strategies/templates"],
  });

  // Scan mutation
  const scanMutation = useMutation<ScanResult[], Error, CustomStrategy>({
    mutationFn: async (strat) => {
      const res = await fetch("/api/strategies/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(strat),
      });
      return res.json();
    },
  });

  // Chartink reverse-engineered mutation
  const chartinkMutation = useMutation<{ success: boolean; source: string; count: number; stocks: any[] }, Error, string>({
    mutationFn: async (clause) => {
      const res = await fetch("/api/chartink/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clause }),
      });
      return res.json();
    },
  });

  // AI Prompt compiler mutation
  const compileMutation = useMutation<any, Error, string>({
    mutationFn: async (promptText) => {
      const res = await fetch("/api/strategies/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to compile strategy prompt");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setCompiledStrategy(data);
      setStrategyName(data.name || strategyName);
      setStrategyDesc(data.description || strategyDesc);
      if (data.formulaDSL) setFormulaDSL(data.formulaDSL);
      if (data.rules && data.rules.length > 0) setRules(data.rules);
      if (data.chartinkClause) setChartinkClause(data.chartinkClause);
      scanMutation.mutate(data);
    },
  });

  const handleAddRule = () => {
    setRules([
      ...rules,
      { category: "CHARTINK_FO", indicator: "RSI", timeframe: "Daily", operator: "<=", value: 40 },
    ]);
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleRuleChange = (index: number, field: keyof StrategyRule, val: any) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], [field]: val };
    setRules(updated);
  };

  const handleLoadTemplate = (template: any) => {
    setStrategyName(template.name);
    setStrategyDesc(template.description);
    if (template.formulaDSL) setFormulaDSL(template.formulaDSL);
    if (template.rules) setRules(template.rules);
    scanMutation.mutate(template);
  };

  const handleRunScan = () => {
    const strategyPayload: CustomStrategy = {
      name: strategyName,
      description: strategyDesc,
      formulaDSL,
      rules,
    };
    scanMutation.mutate(strategyPayload);
  };

  const handleDeployToChart = (symbol: string) => {
    setLocation(`/stock/${symbol}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sliders className="w-6 h-6 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
              Custom Strategy & Monopoly Scanner
            </h1>
          </div>
          <p className="text-sm text-white/50 font-sans">
            Unifies MarketSmith (RS 1–99 & VCP) + Screener.in (ROCE, FCF & D/E) + Chartink (Multi-TF EMAs, OI & PCR).
          </p>
        </div>

        <button
          onClick={handleRunScan}
          disabled={scanMutation.isPending}
          className="px-5 py-2.5 rounded-xl font-mono text-sm font-bold bg-primary hover:bg-primary/90 text-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20"
        >
          <Play className="w-4 h-4 fill-black" />
          {scanMutation.isPending ? "Executing Scan..." : "Run Scanner & Backtest"}
        </button>
      </div>

      {/* Pre-built Templates Quick Bar */}
      {templates && templates.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-mono text-white/40 whitespace-nowrap">Institutional Presets:</span>
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => handleLoadTemplate(tpl)}
              className="px-3 py-1.5 rounded-lg text-xs font-mono bg-white/3 hover:bg-white/8 text-white/70 hover:text-white border border-white/8 whitespace-nowrap transition-colors"
            >
              {tpl.name}
            </button>
          ))}
        </div>
      )}

      {/* Strategy Input Tabs: Visual Builder vs Formula DSL vs AI Prompt */}
      <div className="glass-card rounded-2xl border border-white/8 p-6">
        <div className="flex border-b border-white/10 mb-6 gap-2">
          <button
            onClick={() => setActiveTab("VISUAL")}
            className={`px-4 py-2.5 text-xs font-mono font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "VISUAL"
                ? "border-primary text-primary"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Visual Rule Builder
          </button>
          <button
            onClick={() => setActiveTab("DSL")}
            className={`px-4 py-2.5 text-xs font-mono font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "DSL"
                ? "border-primary text-primary"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            Formula / Pine DSL
          </button>
          <button
            onClick={() => setActiveTab("AI_PROMPT")}
            className={`px-4 py-2.5 text-xs font-mono font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "AI_PROMPT"
                ? "border-primary text-primary"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Natural Language AI Compiler
          </button>
          <button
            onClick={() => setActiveTab("CHARTINK")}
            className={`px-4 py-2.5 text-xs font-mono font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "CHARTINK"
                ? "border-primary text-primary"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            Live Chartink Scanner (Reverse-Engineered)
          </button>
        </div>

        {/* Tab 1: Visual Rule Builder */}
        {activeTab === "VISUAL" && (
          <div className="space-y-4">
            <div className="space-y-3">
              {rules.map((rule, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-white/2 border border-white/5"
                >
                  <span className="text-xs font-mono text-white/30 w-6">#{idx + 1}</span>

                  {/* Category Layer */}
                  <select
                    value={rule.category}
                    onChange={(e) => handleRuleChange(idx, "category", e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs font-mono text-slate-100"
                  >
                    <option value="MARKETSMITH" className="bg-[#0c1017] text-slate-100">MarketSmith</option>
                    <option value="SCREENER" className="bg-[#0c1017] text-slate-100">Screener.in</option>
                    <option value="CHARTINK_FO" className="bg-[#0c1017] text-slate-100">Chartink & F&O</option>
                  </select>

                  {/* Indicator */}
                  <select
                    value={rule.indicator}
                    onChange={(e) => handleRuleChange(idx, "indicator", e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs font-mono text-slate-100"
                  >
                    {rule.category === "MARKETSMITH" && (
                      <>
                        <option value="RS_RATING" className="bg-[#0c1017] text-slate-100">RS Rating (1–99)</option>
                        <option value="VCP_CONTRACTIONS" className="bg-[#0c1017] text-slate-100">VCP Contraction Count</option>
                        <option value="NEAR_52W_HIGH" className="bg-[#0c1017] text-slate-100">Within % of 52W High</option>
                        <option value="EPS_GROWTH" className="bg-[#0c1017] text-slate-100">EPS Growth % (YoY)</option>
                      </>
                    )}
                    {rule.category === "SCREENER" && (
                      <>
                        <option value="ROCE" className="bg-[#0c1017] text-slate-100">ROCE %</option>
                        <option value="ROE" className="bg-[#0c1017] text-slate-100">ROE %</option>
                        <option value="DEBT_TO_EQUITY" className="bg-[#0c1017] text-slate-100">Debt to Equity Ratio</option>
                        <option value="PE_RATIO" className="bg-[#0c1017] text-slate-100">PE vs 5Y Median PE</option>
                        <option value="FREE_CASH_FLOW" className="bg-[#0c1017] text-slate-100">Free Cash Flow Positive</option>
                      </>
                    )}
                    {rule.category === "CHARTINK_FO" && (
                      <>
                        <option value="CLOSE" className="bg-[#0c1017] text-slate-100">Close Price</option>
                        <option value="EMA_20_RETEST" className="bg-[#0c1017] text-slate-100">20 EMA Pullback Retest</option>
                        <option value="OI_CHANGE_PCT" className="bg-[#0c1017] text-slate-100">Live OI Change %</option>
                        <option value="VOLUME_RATIO" className="bg-[#0c1017] text-slate-100">Volume vs 20 SMA</option>
                        <option value="RSI" className="bg-[#0c1017] text-slate-100">RSI (14)</option>
                        <option value="PUT_OI_WALL" className="bg-[#0c1017] text-slate-100">Near Put OI Wall</option>
                      </>
                    )}
                  </select>

                  {/* Timeframe */}
                  <select
                    value={rule.timeframe}
                    onChange={(e) => handleRuleChange(idx, "timeframe", e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs font-mono text-slate-300"
                  >
                    <option value="5m" className="bg-[#0c1017] text-slate-100">5m</option>
                    <option value="15m" className="bg-[#0c1017] text-slate-100">15m</option>
                    <option value="1h" className="bg-[#0c1017] text-slate-100">1h</option>
                    <option value="Daily" className="bg-[#0c1017] text-slate-100">Daily</option>
                    <option value="Weekly" className="bg-[#0c1017] text-slate-100">Weekly</option>
                  </select>

                  {/* Operator */}
                  <select
                    value={rule.operator}
                    onChange={(e) => handleRuleChange(idx, "operator", e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs font-mono text-emerald-400 font-bold"
                  >
                    <option value=">=" className="bg-[#0c1017] text-slate-100">&gt;=</option>
                    <option value="<=" className="bg-[#0c1017] text-slate-100">&lt;=</option>
                    <option value=">" className="bg-[#0c1017] text-slate-100">&gt;</option>
                    <option value="<" className="bg-[#0c1017] text-slate-100">&lt;</option>
                    <option value="==" className="bg-[#0c1017] text-slate-100">==</option>
                    <option value="CROSSES_ABOVE" className="bg-[#0c1017] text-slate-100">Crosses Above</option>
                  </select>

                  {/* Value */}
                  <input
                    type="text"
                    value={String(rule.value)}
                    onChange={(e) => handleRuleChange(idx, "value", e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white w-28"
                  />

                  {/* Delete Button */}
                  <button
                    onClick={() => handleRemoveRule(idx)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={handleAddRule}
              className="px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Condition
            </button>
          </div>
        )}

        {/* Tab 2: Formula / Pine DSL */}
        {activeTab === "DSL" && (
          <div className="space-y-3">
            <p className="text-xs font-mono text-white/40">
              Enter formulas using multi-indicator syntax with Boolean operators (AND / OR).
            </p>
            <textarea
              rows={4}
              value={formulaDSL}
              onChange={(e) => setFormulaDSL(e.target.value)}
              className="w-full p-4 rounded-xl bg-black/40 border border-white/10 font-mono text-xs text-emerald-400 focus:outline-none focus:border-primary leading-relaxed"
            />
          </div>
        )}

        {/* Tab 3: Natural Language AI Compiler */}
        {activeTab === "AI_PROMPT" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono text-white/50">
                Type plain English instructions — our quantitative router compiles it into AST filters, Pine DSL, and Chartink clauses:
              </p>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/25">
                QUANT ROUTER ACTIVE
              </span>
            </div>

            {/* Quick Prompts Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-white/30 py-1">Try Prompts:</span>
              {[
                { label: "Bullish Marubozu 9 & 20 EMA", text: "best bullish marubuzo between 9 and 20 ema" },
                { label: "F&O 20 EMA Retest + Rising OI", text: "Find F&O stocks retesting 20 EMA with rising OI and ROE > 18%" },
                { label: "MarketSmith RS 85+ VCP Breakout", text: "High RS rating >= 85 with tight VCP contraction coiling and volume surge" },
                { label: "Debt-Free Quality Compounders", text: "Quality compounders with ROCE >= 22% and debt-free" },
              ].map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    setAiPrompt(p.text);
                    compileMutation.mutate(p.text);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white/3 hover:bg-amber-500/10 text-white/70 hover:text-amber-300 border border-white/8 hover:border-amber-500/30 transition-all"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && aiPrompt.trim()) {
                    compileMutation.mutate(aiPrompt);
                  }
                }}
                placeholder="e.g. best bullish marubuzo between 9 and 20 ema"
                className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/10 font-sans text-xs text-white focus:outline-none focus:border-amber-400/60 shadow-inner"
              />
              <button
                onClick={() => compileMutation.mutate(aiPrompt)}
                disabled={compileMutation.isPending || !aiPrompt.trim()}
                className="px-5 py-3 rounded-xl font-mono text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black flex items-center gap-2 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
              >
                {compileMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Compiling AST...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>AI Compile</span>
                  </>
                )}
              </button>
            </div>

            {/* In-Flight Compiling Progress */}
            {compileMutation.isPending && (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-center gap-3 animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin text-amber-400 shrink-0" />
                <div>
                  <div className="text-xs font-mono font-bold text-amber-300">
                    Compiling Quantitative AST Strategy...
                  </div>
                  <p className="text-[11px] text-white/50 font-sans mt-0.5">
                    Parsing candlestick formations, multi-EMA dynamic channels, and generating dual Pine & Chartink expressions.
                  </p>
                </div>
              </div>
            )}

            {/* Error Alert */}
            {compileMutation.isError && (
              <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-center justify-between text-xs font-mono text-rose-300">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Compilation Error: {compileMutation.error?.message || "Failed to compile prompt"}</span>
                </div>
                <button
                  onClick={() => compileMutation.mutate(aiPrompt)}
                  className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 font-bold"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Compiled Strategy Inspection Card */}
            {compiledStrategy && (
              <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-black/40 to-emerald-500/5 p-5 space-y-4 shadow-lg shadow-black/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/8 pb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> COMPILED SUCCESSFULLY
                      </span>
                      <span className="text-[10px] font-mono text-white/40">
                        {compiledStrategy.rules?.length || 0} Filters Synthesized
                      </span>
                    </div>
                    <h3 className="text-base font-display font-bold text-white">
                      {compiledStrategy.name}
                    </h3>
                    <p className="text-xs text-white/60 font-sans mt-0.5">
                      {compiledStrategy.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => scanMutation.mutate(compiledStrategy)}
                      disabled={scanMutation.isPending}
                      className="px-4 py-2 rounded-xl font-mono text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20"
                    >
                      <Play className="w-3.5 h-3.5 fill-black" />
                      {scanMutation.isPending ? "Scanning..." : "Run NSE Scan"}
                    </button>
                    <button
                      onClick={() => {
                        if (compiledStrategy.chartinkClause) {
                          setChartinkClause(compiledStrategy.chartinkClause);
                          setActiveTab("CHARTINK");
                          chartinkMutation.mutate(compiledStrategy.chartinkClause);
                        }
                      }}
                      className="px-3 py-2 rounded-xl font-mono text-xs font-bold bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 transition-all flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Chartink Scanner</span>
                    </button>
                  </div>
                </div>

                {/* Extracted Rules Chips */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider block">
                    Synthesized AST Parameters:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {compiledStrategy.rules?.map((rule: StrategyRule, idx: number) => {
                      const isPattern = rule.indicator === "CANDLE_PATTERN";
                      const isEma = rule.indicator.includes("EMA") || rule.indicator === "CLOSE";
                      const isVol = rule.indicator.includes("VOLUME");
                      const color = isPattern
                        ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                        : isEma
                        ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                        : isVol
                        ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                        : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";

                      return (
                        <div
                          key={idx}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-2 ${color}`}
                        >
                          <span className="font-bold opacity-75">{rule.category}:</span>
                          <span className="font-semibold">{rule.indicator}</span>
                          <span className="opacity-60">{rule.operator}</span>
                          <span className="font-bold text-white">{rule.value}</span>
                          <span className="text-[10px] opacity-50 px-1 py-0.5 rounded bg-black/30 font-sans">
                            {rule.timeframe}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Formula DSL / Chartink Clause Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                      Compiled Formula DSL:
                    </span>
                    <button
                      onClick={() => {
                        if (compiledStrategy.formulaDSL) {
                          navigator.clipboard.writeText(compiledStrategy.formulaDSL);
                          setCopiedDsl(true);
                          setTimeout(() => setCopiedDsl(false), 2000);
                        }
                      }}
                      className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1"
                    >
                      {copiedDsl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedDsl ? "Copied" : "Copy DSL"}
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-black/60 border border-white/10 font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {compiledStrategy.formulaDSL || "—"}
                  </pre>
                </div>

                {compiledStrategy.chartinkClause && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                        Reverse-Engineered Chartink Scan Clause:
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(compiledStrategy.chartinkClause);
                          setCopiedChartink(true);
                          setTimeout(() => setCopiedChartink(false), 2000);
                        }}
                        className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1"
                      >
                        {copiedChartink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedChartink ? "Copied" : "Copy Clause"}
                      </button>
                    </div>
                    <pre className="p-3 rounded-xl bg-black/60 border border-white/10 font-mono text-[11px] text-cyan-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {compiledStrategy.chartinkClause}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Live Chartink Clause Scanner (Reverse-Engineered) */}
        {activeTab === "CHARTINK" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono text-white/50">
                Directly run Chartink scan clauses with zero API keys. Automated CSRF & session handling extracts real-time matches directly from live NSE market data.
              </p>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                CSRF BYPASS ACTIVE
              </span>
            </div>

            {/* Quick Chartink Presets */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs font-mono text-white/30 py-1">Presets:</span>
              {[
                {
                  label: "Price > 20 SMA & Vol > 100k",
                  clause: "( {cash} ( latest close > latest sma( close, 20 ) and latest volume > 100000 ) )",
                },
                {
                  label: "Bullish 15m 20 EMA Breakout",
                  clause: "( {cash} ( latest close > latest ema( close, 20 ) and 1 day ago close <= 1 day ago ema( close, 20 ) and latest volume > 200000 ) )",
                },
                {
                  label: "High Volume Movers (> 3x 20d Avg)",
                  clause: "( {cash} ( latest volume > latest sma( volume, 20 ) * 3 and latest close > latest open ) )",
                },
              ].map((p) => (
                <button
                  key={p.label}
                  onClick={() => setChartinkClause(p.clause)}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white/3 hover:bg-white/8 text-white/70 hover:text-white border border-white/8 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={chartinkClause}
              onChange={(e) => setChartinkClause(e.target.value)}
              className="w-full p-4 rounded-xl bg-black/40 border border-white/10 font-mono text-xs text-emerald-400 focus:outline-none focus:border-primary leading-relaxed"
            />

            <div className="flex justify-between items-center">
              <span className="text-[11px] font-mono text-white/40">
                Segment: Cash / Futures / Options
              </span>
              <button
                onClick={() => chartinkMutation.mutate(chartinkClause)}
                disabled={chartinkMutation.isPending}
                className="px-5 py-2.5 rounded-xl font-mono text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                {chartinkMutation.isPending ? "Connecting to Chartink Engine..." : "Run Live Chartink Scan"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Chartink Live Scan Results */}
      {chartinkMutation.data && (
        <div className="glass-card rounded-2xl border border-emerald-500/30 bg-emerald-500/3 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-display font-bold text-white">
                  Chartink Scanned Matches ({chartinkMutation.data.count} Stocks)
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {chartinkMutation.data.source}
                </span>
              </div>
              <p className="text-xs text-white/40 font-mono mt-0.5">
                Real-time stock candidates filtered directly from NSE via reverse-engineered Chartink pipeline
              </p>
            </div>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-mono text-white/40 uppercase">
                  <th className="py-2.5 px-3">Symbol / Name</th>
                  <th className="py-2.5 px-3">Price</th>
                  <th className="py-2.5 px-3 text-center">Change %</th>
                  <th className="py-2.5 px-3 text-center">Traded Volume</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs font-mono">
                {chartinkMutation.data.stocks?.map((stk: any) => (
                  <tr key={stk.symbol} className="hover:bg-white/2">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-white text-sm">{stk.symbol}</div>
                      <div className="text-[10px] text-white/40 font-sans truncate max-w-xs">{stk.name}</div>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">₹{stk.price}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`font-bold ${stk.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {stk.changePercent >= 0 ? "+" : ""}{stk.changePercent}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-white/60">
                      {Number(stk.volume).toLocaleString("en-IN")}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        href={`/stock/${stk.symbol}`}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white/5 hover:bg-primary text-white hover:text-black border border-white/10 transition-colors inline-flex items-center gap-1"
                      >
                        Chart <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Instant 90-Day Backtest & Universe Scan Results */}
      {scanMutation.data && (
        <div className="glass-card rounded-2xl border border-slate-800 p-6 bg-[#0c1017]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                <LineChart className="w-5 h-5 text-emerald-400" />
                Scanner Matches & 90-Day Backtest Results ({scanMutation.data.length} Stocks)
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Historical hit-rate and profit factor computed across last 90 trading sessions
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase">
                  <th className="py-3 px-3">Stock / Company</th>
                  <th className="py-3 px-3">Price / Chg</th>
                  <th className="py-3 px-3 text-center">RS Rating</th>
                  <th className="py-3 px-3 text-center">ROCE / ROE</th>
                  <th className="py-3 px-3 text-center">90-Day Hit Rate</th>
                  <th className="py-3 px-3 text-center">Profit Factor</th>
                  <th className="py-3 px-3 text-right">Deploy to Chart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs font-mono">
                {scanMutation.data.map((stock) => (
                  <tr key={stock.symbol} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-white text-sm font-mono tracking-tight">{stock.symbol}</div>
                      <div className="text-[11px] text-slate-400 font-sans">{stock.companyName}</div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-white font-mono">₹{stock.price}</div>
                      <div className={`text-[10px] font-mono ${stock.changePercent >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}`}>
                        {stock.changePercent >= 0 ? "+" : ""}{stock.changePercent}%
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded font-bold font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-500/40">
                        {stock.rsRating}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <div className="text-slate-100 font-bold font-mono">{stock.roce}% ROCE</div>
                      <div className="text-[10px] text-slate-400 font-mono">{stock.roe}% ROE</div>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-md font-bold font-mono bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 shadow-xs">
                        {stock.hitRate90d}% Win Rate
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center font-bold font-mono text-emerald-400">
                      {stock.profitFactor}x
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <button
                        onClick={() => handleDeployToChart(stock.symbol)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold font-mono bg-indigo-600 hover:bg-indigo-500 text-white transition-all inline-flex items-center gap-1 shadow-md shadow-indigo-600/30"
                      >
                        Deploy to Chart <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
