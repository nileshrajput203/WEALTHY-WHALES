import { useState, useMemo, useEffect } from "react";
import {
  BookOpen, Plus, X, TrendingUp, TrendingDown, Calendar,
  Target, AlertTriangle, CheckCircle2, BarChart3, Smile, Frown, Meh,
  ArrowUpCircle, ArrowDownCircle, Trash2, Edit3, Save, Clock,
  DollarSign, Percent, Activity, Flame, Brain, Medal, ChevronDown,
} from "lucide-react";

/* ═══ Types ═══ */
interface Trade {
  id: string;
  date: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  stopLoss?: number;
  target?: number;
  strategy: string;
  notes: string;
  emotion: "confident" | "fearful" | "neutral" | "greedy" | "disciplined";
  setup: string;
  outcome: "win" | "loss" | "breakeven";
  riskRewardRatio?: number;
  holdingPeriod: string;
  tags: string[];
}

interface DailyEntry {
  date: string;
  trades: Trade[];
  dailyNote: string;
  mood: "great" | "good" | "neutral" | "bad" | "terrible";
  marketCondition: string;
  lessonsLearned: string;
  totalPnl: number;
  winRate: number;
}

/* ═══ Constants ═══ */
const EMOTIONS = [
  { value: "confident", label: "Confident", icon: "💪", color: "text-emerald-400" },
  { value: "disciplined", label: "Disciplined", icon: "🎯", color: "text-blue-400" },
  { value: "neutral", label: "Neutral", icon: "😐", color: "text-white/50" },
  { value: "fearful", label: "Fearful", icon: "😰", color: "text-yellow-400" },
  { value: "greedy", label: "Greedy", icon: "🤑", color: "text-red-400" },
];

const MOODS = [
  { value: "great", label: "Great", icon: "🔥", color: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30" },
  { value: "good", label: "Good", icon: "😊", color: "from-blue-500/20 to-blue-600/5 border-blue-500/30" },
  { value: "neutral", label: "Okay", icon: "😐", color: "from-white/10 to-white/5 border-white/20" },
  { value: "bad", label: "Bad", icon: "😞", color: "from-orange-500/20 to-orange-600/5 border-orange-500/30" },
  { value: "terrible", label: "Terrible", icon: "😩", color: "from-red-500/20 to-red-600/5 border-red-500/30" },
];

const SETUPS = ["Breakout", "Pullback", "Reversal", "Gap Fill", "Momentum", "Mean Reversion", "News Play", "Pattern", "Other"];
const STRATEGIES = ["Swing Trade", "Intraday", "Scalp", "Positional", "BTST", "Options", "Other"];
const HOLDING_PERIODS = ["Scalp (<5m)", "Intraday", "BTST", "2-5 Days", "1-2 Weeks", "2-4 Weeks", "1+ Month"];

/* ═══ localStorage persistence ═══ */
function loadJournal(): DailyEntry[] {
  try {
    const raw = localStorage.getItem("trading-journal");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveJournal(entries: DailyEntry[]) {
  localStorage.setItem("trading-journal", JSON.stringify(entries));
}

/* ═══ Component ═══ */
export default function TradingJournal() {
  const [entries, setEntries] = useState<DailyEntry[]>(loadJournal);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [activeTab, setActiveTab] = useState<"journal" | "stats" | "calendar">("journal");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [editingNote, setEditingNote] = useState(false);

  // Save to localStorage on change
  useEffect(() => { saveJournal(entries); }, [entries]);

  // Current day entry
  const todayEntry = entries.find(e => e.date === selectedDate) || {
    date: selectedDate,
    trades: [],
    dailyNote: "",
    mood: "neutral" as const,
    marketCondition: "",
    lessonsLearned: "",
    totalPnl: 0,
    winRate: 0,
  };

  const updateEntry = (updates: Partial<DailyEntry>) => {
    setEntries(prev => {
      const idx = prev.findIndex(e => e.date === selectedDate);
      const updated = { ...todayEntry, ...updates };
      // Recalculate stats
      updated.totalPnl = updated.trades.reduce((s, t) => s + t.pnl, 0);
      const wins = updated.trades.filter(t => t.outcome === "win").length;
      updated.winRate = updated.trades.length > 0 ? (wins / updated.trades.length) * 100 : 0;
      if (idx >= 0) { const copy = [...prev]; copy[idx] = updated; return copy; }
      return [...prev, updated];
    });
  };

  // Add trade form state
  const [tradeForm, setTradeForm] = useState({
    symbol: "", side: "LONG" as "LONG" | "SHORT",
    entryPrice: "", exitPrice: "", quantity: "",
    stopLoss: "", target: "", strategy: "Intraday",
    notes: "", emotion: "neutral", setup: "Breakout",
    holdingPeriod: "Intraday", tags: "",
  });

  const addTrade = () => {
    const entry = Number(tradeForm.entryPrice);
    const exit = Number(tradeForm.exitPrice);
    const qty = Number(tradeForm.quantity);
    if (!tradeForm.symbol || !entry || !exit || !qty) return;

    const pnl = tradeForm.side === "LONG" ? (exit - entry) * qty : (entry - exit) * qty;
    const pnlPercent = tradeForm.side === "LONG" ? ((exit - entry) / entry) * 100 : ((entry - exit) / entry) * 100;
    const sl = Number(tradeForm.stopLoss) || undefined;
    const tgt = Number(tradeForm.target) || undefined;
    const rr = sl && tgt ? Math.abs(tgt - entry) / Math.abs(entry - sl) : undefined;

    const trade: Trade = {
      id: Date.now().toString(),
      date: selectedDate,
      symbol: tradeForm.symbol.toUpperCase(),
      side: tradeForm.side,
      entryPrice: entry, exitPrice: exit, quantity: qty,
      pnl, pnlPercent,
      stopLoss: sl, target: tgt,
      strategy: tradeForm.strategy,
      notes: tradeForm.notes,
      emotion: tradeForm.emotion as Trade["emotion"],
      setup: tradeForm.setup,
      outcome: pnl > 0 ? "win" : pnl < 0 ? "loss" : "breakeven",
      riskRewardRatio: rr,
      holdingPeriod: tradeForm.holdingPeriod,
      tags: tradeForm.tags.split(",").map(t => t.trim()).filter(Boolean),
    };

    updateEntry({ trades: [...todayEntry.trades, trade] });
    setShowAddTrade(false);
    setTradeForm({ symbol: "", side: "LONG", entryPrice: "", exitPrice: "", quantity: "", stopLoss: "", target: "", strategy: "Intraday", notes: "", emotion: "neutral", setup: "Breakout", holdingPeriod: "Intraday", tags: "" });
  };

  const deleteTrade = (tradeId: string) => {
    updateEntry({ trades: todayEntry.trades.filter(t => t.id !== tradeId) });
  };

  /* ═══ Stats ═══ */
  const allTrades = entries.flatMap(e => e.trades);
  const stats = useMemo(() => {
    const total = allTrades.length;
    const wins = allTrades.filter(t => t.outcome === "win").length;
    const losses = allTrades.filter(t => t.outcome === "loss").length;
    const totalPnl = allTrades.reduce((s, t) => s + t.pnl, 0);
    const avgWin = wins > 0 ? allTrades.filter(t => t.outcome === "win").reduce((s, t) => s + t.pnl, 0) / wins : 0;
    const avgLoss = losses > 0 ? allTrades.filter(t => t.outcome === "loss").reduce((s, t) => s + t.pnl, 0) / losses : 0;
    const bestTrade = allTrades.length > 0 ? allTrades.reduce((best, t) => t.pnl > best.pnl ? t : best, allTrades[0]) : null;
    const worstTrade = allTrades.length > 0 ? allTrades.reduce((worst, t) => t.pnl < worst.pnl ? t : worst, allTrades[0]) : null;
    const profitFactor = Math.abs(avgLoss) > 0 ? Math.abs(avgWin / avgLoss) : 0;

    // Streak
    let maxWinStreak = 0, maxLossStreak = 0, curWin = 0, curLoss = 0;
    allTrades.forEach(t => {
      if (t.outcome === "win") { curWin++; curLoss = 0; maxWinStreak = Math.max(maxWinStreak, curWin); }
      else if (t.outcome === "loss") { curLoss++; curWin = 0; maxLossStreak = Math.max(maxLossStreak, curLoss); }
      else { curWin = 0; curLoss = 0; }
    });

    // By strategy
    const byStrategy: Record<string, { count: number; pnl: number; wins: number }> = {};
    allTrades.forEach(t => {
      const s = t.strategy;
      if (!byStrategy[s]) byStrategy[s] = { count: 0, pnl: 0, wins: 0 };
      byStrategy[s].count++;
      byStrategy[s].pnl += t.pnl;
      if (t.outcome === "win") byStrategy[s].wins++;
    });

    // By emotion
    const byEmotion: Record<string, { count: number; wins: number }> = {};
    allTrades.forEach(t => {
      if (!byEmotion[t.emotion]) byEmotion[t.emotion] = { count: 0, wins: 0 };
      byEmotion[t.emotion].count++;
      if (t.outcome === "win") byEmotion[t.emotion].wins++;
    });

    return { total, wins, losses, totalPnl, avgWin, avgLoss, bestTrade, worstTrade, profitFactor, maxWinStreak, maxLossStreak, byStrategy, byEmotion };
  }, [allTrades]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1 flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-primary" />
            Trading Journal
          </h1>
          <p className="text-sm text-white/40">
            Log every trade. Reflect. Improve. Repeat.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Tab switcher */}
          {(["journal", "stats", "calendar"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition-all
                ${activeTab === tab
                  ? "bg-primary/20 text-primary border border-primary/30 shadow-[0_0_12px_0_hsl(260,84%,65%,0.2)]"
                  : "text-white/40 hover:text-white/70 bg-white/5 border border-white/10"}`}>
              {tab === "journal" && <BookOpen className="w-3.5 h-3.5 inline mr-1.5" />}
              {tab === "stats" && <BarChart3 className="w-3.5 h-3.5 inline mr-1.5" />}
              {tab === "calendar" && <Calendar className="w-3.5 h-3.5 inline mr-1.5" />}
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ════════ JOURNAL TAB ════════ */}
      {activeTab === "journal" && (
        <div className="space-y-6">
          {/* Date + Mood + Add button */}
          <div className="flex items-center gap-3 flex-wrap">
            <input type="date" value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-sm focus:border-primary/50 focus:outline-none" />

            {/* Mood selector */}
            <div className="flex items-center gap-1">
              {MOODS.map(m => (
                <button key={m.value} onClick={() => updateEntry({ mood: m.value as DailyEntry["mood"] })}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all border
                    ${todayEntry.mood === m.value ? `bg-gradient-to-b ${m.color} scale-110 shadow-lg` : "bg-white/5 border-white/10 hover:bg-white/10 opacity-50 hover:opacity-100"}`}
                  title={m.label}>
                  {m.icon}
                </button>
              ))}
            </div>

            <button onClick={() => setShowAddTrade(true)}
              className="ml-auto px-4 py-2 rounded-xl bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-all text-sm font-bold flex items-center gap-2">
              <Plus className="w-4 h-4" /> Log Trade
            </button>
          </div>

          {/* Quick Stats for the day */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Trades", value: todayEntry.trades.length.toString(), icon: Activity, color: "text-blue-400" },
              { label: "P&L", value: `₹${todayEntry.totalPnl.toFixed(0)}`, icon: todayEntry.totalPnl >= 0 ? ArrowUpCircle : ArrowDownCircle, color: todayEntry.totalPnl >= 0 ? "text-emerald-400" : "text-red-400" },
              { label: "Win Rate", value: `${todayEntry.winRate.toFixed(0)}%`, icon: Target, color: todayEntry.winRate >= 50 ? "text-emerald-400" : "text-red-400" },
              { label: "Wins/Losses", value: `${todayEntry.trades.filter(t => t.outcome === "win").length}/${todayEntry.trades.filter(t => t.outcome === "loss").length}`, icon: BarChart3, color: "text-purple-400" },
            ].map(stat => (
              <div key={stat.label} className="glass-card rounded-xl p-3 border border-white/6">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  <span className="text-[10px] text-white/30 uppercase tracking-wider font-mono">{stat.label}</span>
                </div>
                <p className={`text-xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Trades list */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white/60 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Today's Trades
            </h3>
            {todayEntry.trades.length === 0 ? (
              <div className="glass-card rounded-2xl border border-white/6 p-12 text-center">
                <BookOpen className="w-12 h-12 mx-auto text-white/10 mb-3" />
                <p className="text-white/30 text-sm">No trades logged for this day. Click "Log Trade" to start.</p>
              </div>
            ) : (
              todayEntry.trades.map(trade => {
                const isWin = trade.outcome === "win";
                const emotionData = EMOTIONS.find(e => e.value === trade.emotion);
                return (
                  <div key={trade.id}
                    className={`glass-card rounded-xl border p-4 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 ${isWin ? "border-emerald-500/20" : trade.outcome === "loss" ? "border-red-500/20" : "border-white/10"}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono ${trade.side === "LONG" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-red-500/15 text-red-400 border border-red-500/30"}`}>
                          {trade.side}
                        </div>
                        <span className="text-white font-bold font-mono text-lg">{trade.symbol}</span>
                        <span className="text-[10px] font-mono text-white/20 bg-white/5 px-2 py-0.5 rounded">{trade.strategy}</span>
                        <span className="text-[10px] font-mono text-white/20 bg-white/5 px-2 py-0.5 rounded">{trade.setup}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span title={emotionData?.label}>{emotionData?.icon}</span>
                        <button onClick={() => deleteTrade(trade.id)} className="p-1.5 hover:bg-red-500/10 text-white/20 hover:text-red-400 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
                      <div>
                        <p className="text-white/30 mb-0.5">Entry</p>
                        <p className="text-white font-semibold">₹{trade.entryPrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-white/30 mb-0.5">Exit</p>
                        <p className="text-white font-semibold">₹{trade.exitPrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-white/30 mb-0.5">Qty</p>
                        <p className="text-white font-semibold">{trade.quantity}</p>
                      </div>
                      <div>
                        <p className="text-white/30 mb-0.5">P&L</p>
                        <p className={`font-bold ${isWin ? "text-emerald-400" : "text-red-400"}`}>
                          {trade.pnl >= 0 ? "+" : ""}₹{trade.pnl.toFixed(0)} ({trade.pnlPercent.toFixed(1)}%)
                        </p>
                      </div>
                      {trade.riskRewardRatio && (
                        <div>
                          <p className="text-white/30 mb-0.5">R:R</p>
                          <p className="text-white font-semibold">1:{trade.riskRewardRatio.toFixed(1)}</p>
                        </div>
                      )}
                    </div>
                    {trade.notes && <p className="text-xs text-white/40 mt-2 italic">"{trade.notes}"</p>}
                    {trade.tags.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {trade.tags.map(tag => (
                          <span key={tag} className="text-[9px] font-mono bg-primary/10 text-primary/60 px-2 py-0.5 rounded-full border border-primary/20">#{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Daily Notes */}
          <div className="glass-card rounded-2xl border border-white/6 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white/60 flex items-center gap-2">
                <Edit3 className="w-4 h-4" /> Daily Reflection
              </h3>
              <button onClick={() => setEditingNote(!editingNote)}
                className="text-xs text-primary hover:text-primary/80 font-mono transition-colors flex items-center gap-1">
                {editingNote ? <><Save className="w-3 h-3" /> Save</> : <><Edit3 className="w-3 h-3" /> Edit</>}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-1.5 block">Market Condition</label>
                <input
                  value={todayEntry.marketCondition}
                  onChange={e => updateEntry({ marketCondition: e.target.value })}
                  placeholder="e.g., Trending up, Rangebound, Volatile..."
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono placeholder:text-white/15 focus:border-primary/40 focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-1.5 block">Lessons Learned</label>
                <input
                  value={todayEntry.lessonsLearned}
                  onChange={e => updateEntry({ lessonsLearned: e.target.value })}
                  placeholder="What did you learn today?"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono placeholder:text-white/15 focus:border-primary/40 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-1.5 block">Daily Notes</label>
              <textarea
                value={todayEntry.dailyNote}
                onChange={e => updateEntry({ dailyNote: e.target.value })}
                rows={3}
                placeholder="Write your thoughts, observations, what went well, what to improve..."
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono placeholder:text-white/15 focus:border-primary/40 focus:outline-none resize-none" />
            </div>
          </div>
        </div>
      )}

      {/* ════════ STATS TAB ════════ */}
      {activeTab === "stats" && (
        <div className="space-y-6">
          {/* Top metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Trades", value: stats.total.toString(), icon: Activity, color: "text-blue-400" },
              { label: "Win Rate", value: `${stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(0) : 0}%`, icon: Target, color: stats.wins > stats.losses ? "text-emerald-400" : "text-red-400" },
              { label: "Total P&L", value: `₹${stats.totalPnl.toFixed(0)}`, icon: DollarSign, color: stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400" },
              { label: "Profit Factor", value: stats.profitFactor.toFixed(2), icon: Percent, color: stats.profitFactor > 1 ? "text-emerald-400" : "text-red-400" },
              { label: "Win Streak", value: stats.maxWinStreak.toString(), icon: Flame, color: "text-orange-400" },
              { label: "Loss Streak", value: stats.maxLossStreak.toString(), icon: AlertTriangle, color: "text-red-400" },
            ].map(s => (
              <div key={s.label} className="glass-card rounded-xl p-3 border border-white/6">
                <div className="flex items-center gap-1.5 mb-1">
                  <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                  <span className="text-[9px] text-white/25 uppercase tracking-wider font-mono">{s.label}</span>
                </div>
                <p className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Win/Loss distribution */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card rounded-xl p-4 border border-white/6">
              <h4 className="text-xs font-bold text-white/40 mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Wins</h4>
              <p className="text-3xl font-bold font-mono text-emerald-400">{stats.wins}</p>
              <p className="text-xs font-mono text-white/30 mt-1">Avg Win: ₹{stats.avgWin.toFixed(0)}</p>
              {stats.bestTrade && <p className="text-[10px] font-mono text-emerald-400/50 mt-1">Best: {stats.bestTrade.symbol} +₹{stats.bestTrade.pnl.toFixed(0)}</p>}
            </div>
            <div className="glass-card rounded-xl p-4 border border-white/6">
              <h4 className="text-xs font-bold text-white/40 mb-3 flex items-center gap-2"><X className="w-4 h-4 text-red-400" /> Losses</h4>
              <p className="text-3xl font-bold font-mono text-red-400">{stats.losses}</p>
              <p className="text-xs font-mono text-white/30 mt-1">Avg Loss: ₹{stats.avgLoss.toFixed(0)}</p>
              {stats.worstTrade && <p className="text-[10px] font-mono text-red-400/50 mt-1">Worst: {stats.worstTrade.symbol} ₹{stats.worstTrade.pnl.toFixed(0)}</p>}
            </div>
            <div className="glass-card rounded-xl p-4 border border-white/6">
              <h4 className="text-xs font-bold text-white/40 mb-3 flex items-center gap-2"><Medal className="w-4 h-4 text-yellow-400" /> Performance</h4>
              <div className="flex items-end gap-2">
                <p className={`text-3xl font-bold font-mono ${stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {stats.totalPnl >= 0 ? "+" : ""}₹{stats.totalPnl.toFixed(0)}
                </p>
              </div>
              <p className="text-xs font-mono text-white/30 mt-1">Across {entries.length} trading days</p>
            </div>
          </div>

          {/* By Strategy */}
          {Object.keys(stats.byStrategy).length > 0 && (
            <div className="glass-card rounded-2xl border border-white/6 p-5">
              <h4 className="text-sm font-bold text-white/60 mb-4 flex items-center gap-2"><Brain className="w-4 h-4 text-purple-400" /> By Strategy</h4>
              <div className="space-y-2">
                {Object.entries(stats.byStrategy).sort((a, b) => b[1].pnl - a[1].pnl).map(([strategy, data]) => (
                  <div key={strategy} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/3 transition-colors">
                    <span className="text-xs font-mono text-white/50 w-28 truncate">{strategy}</span>
                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${data.pnl >= 0 ? "bg-emerald-500/50" : "bg-red-500/50"}`}
                        style={{ width: `${Math.min(100, (data.wins / data.count) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-mono text-white/40">{data.count} trades</span>
                    <span className={`text-xs font-bold font-mono ${data.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {data.pnl >= 0 ? "+" : ""}₹{data.pnl.toFixed(0)}
                    </span>
                    <span className="text-[10px] font-mono text-white/30">{((data.wins / data.count) * 100).toFixed(0)}% WR</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Emotion */}
          {Object.keys(stats.byEmotion).length > 0 && (
            <div className="glass-card rounded-2xl border border-white/6 p-5">
              <h4 className="text-sm font-bold text-white/60 mb-4 flex items-center gap-2"><Smile className="w-4 h-4 text-yellow-400" /> Emotion vs Win Rate</h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {Object.entries(stats.byEmotion).map(([emotion, data]) => {
                  const emData = EMOTIONS.find(e => e.value === emotion);
                  const wr = data.count > 0 ? (data.wins / data.count) * 100 : 0;
                  return (
                    <div key={emotion} className="text-center p-3 rounded-xl bg-white/3 border border-white/5">
                      <p className="text-2xl mb-1">{emData?.icon}</p>
                      <p className="text-[10px] font-mono text-white/30 mb-1">{emData?.label}</p>
                      <p className={`text-lg font-bold font-mono ${wr >= 50 ? "text-emerald-400" : "text-red-400"}`}>{wr.toFixed(0)}%</p>
                      <p className="text-[9px] font-mono text-white/20">{data.count} trades</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════ CALENDAR TAB ════════ */}
      {activeTab === "calendar" && (
        <div className="glass-card rounded-2xl border border-white/6 p-5">
          <h4 className="text-sm font-bold text-white/60 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Trading Days
          </h4>
          {entries.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">No journal entries yet. Start logging trades!</p>
          ) : (
            <div className="space-y-2">
              {entries.sort((a, b) => b.date.localeCompare(a.date)).map(entry => {
                const isProfit = entry.totalPnl >= 0;
                const moodData = MOODS.find(m => m.value === entry.mood);
                return (
                  <div key={entry.date}
                    onClick={() => { setSelectedDate(entry.date); setActiveTab("journal"); }}
                    className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all hover:bg-white/5 border ${isProfit ? "border-emerald-500/10" : "border-red-500/10"}`}>
                    <div className="text-center min-w-[50px]">
                      <p className="text-lg font-bold font-mono text-white">
                        {new Date(entry.date + "T00:00:00").getDate()}
                      </p>
                      <p className="text-[10px] font-mono text-white/30">
                        {new Date(entry.date + "T00:00:00").toLocaleDateString("en-IN", { month: "short" })}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white">
                        {entry.trades.length} trade{entry.trades.length !== 1 ? "s" : ""}
                      </p>
                      <p className="text-[10px] text-white/30 truncate">
                        {entry.trades.map(t => t.symbol).join(", ") || "No trades"}
                      </p>
                    </div>
                    <div className="text-lg">{moodData?.icon}</div>
                    <div className="text-right">
                      <p className={`text-sm font-bold font-mono ${isProfit ? "text-emerald-400" : "text-red-400"}`}>
                        {isProfit ? "+" : ""}₹{entry.totalPnl.toFixed(0)}
                      </p>
                      <p className="text-[10px] font-mono text-white/30">
                        {entry.winRate.toFixed(0)}% WR
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════ ADD TRADE MODAL ════════ */}
        {showAddTrade && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
            onClick={() => setShowAddTrade(false)}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="w-full max-w-xl max-h-[85vh] overflow-y-auto glass-card rounded-2xl border border-white/10 p-6 space-y-4 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" /> Log New Trade
                </h3>
                <button onClick={() => setShowAddTrade(false)} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-white/40" />
                </button>
              </div>

              {/* Symbol + Side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-white/30 uppercase mb-1 block">Symbol</label>
                  <input value={tradeForm.symbol} onChange={e => setTradeForm(p => ({ ...p, symbol: e.target.value }))}
                    placeholder="e.g., TCS" className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-sm placeholder:text-white/15 focus:border-primary/40 focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-white/30 uppercase mb-1 block">Side</label>
                  <div className="flex gap-2">
                    {(["LONG", "SHORT"] as const).map(s => (
                      <button key={s} onClick={() => setTradeForm(p => ({ ...p, side: s }))}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-bold font-mono transition-all border
                          ${tradeForm.side === s
                            ? s === "LONG" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-red-500/15 text-red-400 border-red-500/30"
                            : "bg-white/5 text-white/30 border-white/10"}`}>
                        {s === "LONG" ? <ArrowUpCircle className="w-3.5 h-3.5 inline mr-1" /> : <ArrowDownCircle className="w-3.5 h-3.5 inline mr-1" />}
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Prices + Qty */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Entry Price", key: "entryPrice", ph: "₹0.00" },
                  { label: "Exit Price", key: "exitPrice", ph: "₹0.00" },
                  { label: "Quantity", key: "quantity", ph: "0" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] font-mono text-white/30 uppercase mb-1 block">{f.label}</label>
                    <input type="number" value={(tradeForm as any)[f.key]}
                      onChange={e => setTradeForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.ph}
                      className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-sm placeholder:text-white/15 focus:border-primary/40 focus:outline-none" />
                  </div>
                ))}
              </div>

              {/* SL + Target */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-white/30 uppercase mb-1 block">Stop Loss (optional)</label>
                  <input type="number" value={tradeForm.stopLoss}
                    onChange={e => setTradeForm(p => ({ ...p, stopLoss: e.target.value }))}
                    placeholder="₹0.00"
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-sm placeholder:text-white/15 focus:border-primary/40 focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-white/30 uppercase mb-1 block">Target (optional)</label>
                  <input type="number" value={tradeForm.target}
                    onChange={e => setTradeForm(p => ({ ...p, target: e.target.value }))}
                    placeholder="₹0.00"
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-sm placeholder:text-white/15 focus:border-primary/40 focus:outline-none" />
                </div>
              </div>

              {/* Strategy + Setup + Holding Period */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Strategy", key: "strategy", options: STRATEGIES },
                  { label: "Setup", key: "setup", options: SETUPS },
                  { label: "Holding Period", key: "holdingPeriod", options: HOLDING_PERIODS },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] font-mono text-white/30 uppercase mb-1 block">{f.label}</label>
                    <select value={(tradeForm as any)[f.key]}
                      onChange={e => setTradeForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-sm focus:border-primary/40 focus:outline-none appearance-none">
                      {f.options.map(o => <option key={o} value={o} className="bg-gray-900">{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* Emotion */}
              <div>
                <label className="text-[10px] font-mono text-white/30 uppercase mb-2 block">Emotion During Trade</label>
                <div className="flex gap-2 flex-wrap">
                  {EMOTIONS.map(em => (
                    <button key={em.value} onClick={() => setTradeForm(p => ({ ...p, emotion: em.value }))}
                      className={`px-3 py-2 rounded-lg text-xs font-mono transition-all border flex items-center gap-1.5
                        ${tradeForm.emotion === em.value
                          ? `${em.color} bg-white/10 border-white/20`
                          : "text-white/30 bg-white/3 border-white/5 hover:bg-white/5"}`}>
                      <span>{em.icon}</span> {em.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes + Tags */}
              <div>
                <label className="text-[10px] font-mono text-white/30 uppercase mb-1 block">Notes</label>
                <textarea value={tradeForm.notes} onChange={e => setTradeForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2} placeholder="Why did you take this trade? What was your conviction?"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-sm placeholder:text-white/15 focus:border-primary/40 focus:outline-none resize-none" />
              </div>
              <div>
                <label className="text-[10px] font-mono text-white/30 uppercase mb-1 block">Tags (comma separated)</label>
                <input value={tradeForm.tags} onChange={e => setTradeForm(p => ({ ...p, tags: e.target.value }))}
                  placeholder="e.g., breakout, high-volume, earnings"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-sm placeholder:text-white/15 focus:border-primary/40 focus:outline-none" />
              </div>

              {/* P&L Preview */}
              {tradeForm.entryPrice && tradeForm.exitPrice && tradeForm.quantity && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  {(() => {
                    const entry = Number(tradeForm.entryPrice); const exit = Number(tradeForm.exitPrice); const qty = Number(tradeForm.quantity);
                    const pnl = tradeForm.side === "LONG" ? (exit - entry) * qty : (entry - exit) * qty;
                    return (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-white/40">Estimated P&L:</span>
                        <span className={`text-lg font-bold font-mono ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {pnl >= 0 ? "+" : ""}₹{pnl.toFixed(0)}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Submit */}
              <button onClick={addTrade}
                className="w-full py-3 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 font-bold text-sm transition-all flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> Save Trade
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
