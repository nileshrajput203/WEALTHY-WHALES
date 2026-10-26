import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useWatchlist } from "@/hooks/useWatchlist";
import {
  CalendarDays, ChevronLeft, ChevronRight, Bell, TrendingUp,
  Briefcase, FileText, DollarSign, AlertCircle, Star, Filter,
  Search, Globe, ArrowUpRight, CheckCircle2, Sparkles, Building2,
} from "lucide-react";

/* ═══ Types ═══ */
export interface StockEvent {
  id: string;
  symbol: string;
  title: string;
  date: string;           // YYYY-MM-DD
  type: "earnings" | "dividend" | "agm" | "board" | "result" | "split" | "bonus" | "other";
  description?: string;
}

const TYPE_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  earnings:  { label: "Earnings",     color: "text-emerald-400",  bg: "bg-emerald-500/15 border-emerald-500/30", icon: TrendingUp },
  dividend:  { label: "Dividend",     color: "text-yellow-400",   bg: "bg-yellow-500/15 border-yellow-500/30",   icon: DollarSign },
  board:     { label: "Board Meet",   color: "text-purple-400",   bg: "bg-purple-500/15 border-purple-500/30",   icon: FileText },
  agm:       { label: "AGM / EGM",    color: "text-blue-400",     bg: "bg-blue-500/15 border-blue-500/30",       icon: Briefcase },
  result:    { label: "Result",       color: "text-cyan-400",     bg: "bg-cyan-500/15 border-cyan-500/30",       icon: FileText },
  split:     { label: "Split",        color: "text-orange-400",   bg: "bg-orange-500/15 border-orange-500/30",   icon: AlertCircle },
  bonus:     { label: "Bonus",        color: "text-pink-400",     bg: "bg-pink-500/15 border-pink-500/30",       icon: Star },
  other:     { label: "Macro Event",  color: "text-indigo-400",   bg: "bg-indigo-500/15 border-indigo-500/30",   icon: Bell },
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function EventsCalendar() {
  const { watchlist, addStock, removeStock, isWatched } = useWatchlist();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [scope, setScope] = useState<"all" | "watchlist">("all");

  // Format symbols for query
  const watchlistClean = useMemo(() => {
    return watchlist.map(s => s.replace(/\.NS$|\.BO$/i, "").toUpperCase());
  }, [watchlist]);

  // Fetch corporate events
  const { data: eventsData, isLoading } = useQuery<{ events: StockEvent[] }>({
    queryKey: ["/api/nse/events", watchlistClean.length > 0 ? watchlistClean.join(",") : "market"],
    staleTime: 5 * 60 * 1000,
  });

  const rawEvents = useMemo(() => eventsData?.events ?? [], [eventsData]);

  // Scope filter: All vs Watchlist
  const scopedEvents = useMemo(() => {
    if (scope === "watchlist") {
      if (watchlistClean.length === 0) return [];
      return rawEvents.filter(e => watchlistClean.includes(e.symbol.toUpperCase()));
    }
    return rawEvents;
  }, [rawEvents, scope, watchlistClean]);

  // Type & Search filter
  const filteredEvents = useMemo(() => {
    return scopedEvents.filter(e => {
      const matchesType = !filterType || e.type === filterType;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || 
        e.symbol.toLowerCase().includes(q) || 
        e.title.toLowerCase().includes(q) || 
        (e.description && e.description.toLowerCase().includes(q));
      return matchesType && matchesSearch;
    });
  }, [scopedEvents, filterType, searchQuery]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().split("T")[0];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const jumpToToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(now.toISOString().split("T")[0]);
  };

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, StockEvent[]> = {};
    filteredEvents.forEach(e => {
      (map[e.date] ||= []).push(e);
    });
    return map;
  }, [filteredEvents]);

  // Events for selected day
  const selectedDayEvents = selectedDay ? (eventsByDate[selectedDay] || []) : [];

  // Upcoming events (Next 14 days)
  const upcoming = useMemo(() => {
    const t = new Date(); 
    t.setHours(0,0,0,0);
    const end = new Date(t); 
    end.setDate(end.getDate() + 14);
    
    return filteredEvents.filter(e => {
      const d = new Date(e.date + "T00:00:00");
      return d >= t && d <= end;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredEvents]);

  // Build calendar grid days
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  // Quick populate sample stocks to watchlist
  const handleAddSampleWatchlist = () => {
    ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "CYIENT.NS"].forEach(s => {
      if (!watchlist.includes(s)) addStock(s);
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header & Stats ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
              <CalendarDays className="w-3 h-3 text-primary" />
              Institutional Corporate Feed
            </span>
            <span className="text-xs text-white/40 font-mono">
              NSE · BSE · SEBI Filings
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white flex items-center gap-2">
            Corporate Events Calendar
          </h1>
          <p className="text-xs sm:text-sm text-white/50">
            Track board meetings, Q2/Q3 quarterly earnings announcements, interim dividends, AGMs, splits, and RBI macro events.
          </p>
        </div>

        {/* View Scope Tabs: All vs Watchlist */}
        <div className="flex items-center gap-2 bg-neutral-900/80 p-1.5 rounded-xl border border-white/10 self-start md:self-auto">
          <button
            onClick={() => setScope("all")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              scope === "all"
                ? "bg-primary text-black shadow-md shadow-primary/20"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            All Market Events
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${scope === "all" ? "bg-black/20 text-black" : "bg-white/10 text-white/60"}`}>
              {rawEvents.length}
            </span>
          </button>

          <button
            onClick={() => setScope("watchlist")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              scope === "watchlist"
                ? "bg-amber-400 text-black shadow-md shadow-amber-400/20"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            My Watchlist
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${scope === "watchlist" ? "bg-black/20 text-black" : "bg-white/10 text-white/60"}`}>
              {watchlistClean.length}
            </span>
          </button>
        </div>
      </div>

      {/* ── Empty Watchlist Banner when in Watchlist scope ────────────── */}
      {scope === "watchlist" && watchlistClean.length === 0 && (
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <Star className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-300">Your Watchlist is currently empty</p>
              <p className="text-[11px] text-white/50">Add stocks to track their customized earnings calls, dividends, and board meetings.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddSampleWatchlist}
              className="px-3 py-1.5 bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-300 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Add Top Stocks (Reliance, TCS, Cyient)
            </button>
            <button
              onClick={() => setScope("all")}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 rounded-lg text-xs font-mono transition"
            >
              View All Market
            </button>
          </div>
        </div>
      )}

      {/* ── Search & Filter Bar ───────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:max-w-xs">
          <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search symbol (e.g. CYIENT, RELIANCE) or event..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-900/80 border border-white/10 focus:border-primary/50 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-white/30 font-mono focus:outline-none transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs font-mono"
            >
              ×
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterType(null)}
            className={`px-3 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all ${
              !filterType
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-white/40 hover:text-white/70 bg-white/5 border border-white/10"
            }`}
          >
            All Types
          </button>
          {Object.entries(TYPE_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setFilterType(filterType === key ? null : key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all flex items-center gap-1.5 ${
                filterType === key
                  ? `${meta.bg} ${meta.color} border`
                  : "text-white/40 hover:text-white/70 bg-white/5 border border-white/10"
              }`}
            >
              <meta.icon className="w-3 h-3" />
              {meta.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Layout: Calendar + Right Panel ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left 2 Columns: Calendar Matrix ─────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card rounded-2xl border border-white/8 overflow-hidden shadow-2xl">
            {/* Month Header & Controls */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b border-white/8"
              style={{ background: "linear-gradient(135deg, rgba(20,20,35,0.95), rgba(10,10,20,0.95))" }}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors border border-white/5"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors border border-white/5"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <h2 className="text-base sm:text-lg font-bold text-white font-mono tracking-wide ml-2">
                  {MONTHS[month]} {year}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={jumpToToday}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 transition"
                >
                  Today
                </button>
                <span className="text-[11px] font-mono text-white/40 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                  {filteredEvents.length} events
                </span>
              </div>
            </div>

            {/* Day of week headers */}
            <div className="grid grid-cols-7 border-b border-white/5 bg-white/2">
              {DAYS.map(d => (
                <div key={d} className="text-center text-[11px] font-mono text-white/35 py-2.5 uppercase tracking-wider font-semibold">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Days Matrix */}
            <div className="grid grid-cols-7 divide-x divide-y divide-white/5">
              {calendarDays.map((day, i) => {
                if (day === null) {
                  return <div key={`empty-${i}`} className="min-h-[90px] bg-neutral-950/40" />;
                }

                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayEvents = eventsByDate[dateStr] || [];
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDay;

                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                    className={`min-h-[90px] p-1.5 sm:p-2 cursor-pointer transition-all relative flex flex-col justify-between ${
                      isToday ? "bg-primary/10 ring-1 ring-primary/50" : ""
                    } ${
                      isSelected ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-white/4"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-mono font-bold ${
                        isToday ? "text-primary" : isSelected ? "text-white" : "text-white/50"
                      }`}>
                        {day}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[9px] font-mono px-1 rounded bg-white/10 text-white/70 font-bold">
                          {dayEvents.length}
                        </span>
                      )}
                    </div>

                    {/* Event pills on the day cell */}
                    <div className="space-y-1 mt-1">
                      {dayEvents.slice(0, 2).map((ev) => {
                        const meta = TYPE_META[ev.type] || TYPE_META.other;
                        return (
                          <div
                            key={ev.id}
                            className={`text-[9px] font-mono truncate px-1 py-0.5 rounded border ${meta.bg} ${meta.color} font-medium`}
                            title={`${ev.symbol}: ${ev.title}`}
                          >
                            <span className="font-bold">{ev.symbol}</span> · {meta.label}
                          </div>
                        );
                      })}
                      {dayEvents.length > 2 && (
                        <div className="text-[8px] font-mono text-white/40 pl-1">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right Column: Selected Day Inspector & Upcoming Feed ─────── */}
        <div className="space-y-4">
          {/* Selected Day Details */}
          {selectedDay && (
            <div className="glass-card rounded-2xl border border-primary/30 bg-primary/5 overflow-hidden animate-in fade-in duration-200 shadow-xl">
              <div className="px-4 py-3 border-b border-primary/20 flex items-center justify-between bg-primary/10">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold font-mono text-white">
                    {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="text-white/40 hover:text-white text-xs font-mono"
                >
                  Close
                </button>
              </div>

              <div className="p-3 space-y-2.5 max-h-[300px] overflow-y-auto">
                {selectedDayEvents.length === 0 ? (
                  <p className="text-xs text-white/40 text-center py-4 font-mono">
                    No scheduled corporate events on this date.
                  </p>
                ) : (
                  selectedDayEvents.map((ev) => {
                    const meta = TYPE_META[ev.type] || TYPE_META.other;
                    const Icon = meta.icon;
                    const cleanSymbol = ev.symbol.toUpperCase();
                    const inWatchlist = isWatched(cleanSymbol) || isWatched(`${cleanSymbol}.NS`);

                    return (
                      <div
                        key={ev.id}
                        className={`p-3 rounded-xl border ${meta.bg} space-y-1.5 transition`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                            <span className={`text-[11px] font-bold font-mono uppercase ${meta.color}`}>
                              {meta.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                const fullSym = `${cleanSymbol}.NS`;
                                if (inWatchlist) {
                                  removeStock(cleanSymbol);
                                  removeStock(fullSym);
                                } else {
                                  addStock(fullSym);
                                }
                              }}
                              className={`p-1 rounded text-xs transition ${
                                inWatchlist ? "text-amber-400 hover:text-amber-300" : "text-white/30 hover:text-white"
                              }`}
                              title={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
                            >
                              <Star className={`w-3.5 h-3.5 ${inWatchlist ? "fill-amber-400" : ""}`} />
                            </button>
                            <Link
                              href={`/stock/${cleanSymbol}`}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-0.5"
                            >
                              Analyze
                              <ArrowUpRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>

                        <div className="text-xs font-bold text-white font-sans">
                          {ev.title}
                        </div>
                        {ev.description && (
                          <p className="text-[11px] text-white/60 leading-relaxed font-sans">
                            {ev.description}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Upcoming 14 Days List */}
          <div className="glass-card rounded-2xl border border-white/8 overflow-hidden shadow-xl">
            <div
              className="px-4 py-3 border-b border-white/8 flex items-center justify-between"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Upcoming 14 Days
                </span>
              </div>
              <span className="text-[10px] font-mono text-white/50 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                {upcoming.length} events
              </span>
            </div>

            <div className="p-3 space-y-2 max-h-[460px] overflow-y-auto divide-y divide-white/5">
              {upcoming.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs text-white/40 font-mono">No upcoming events matching filter.</p>
                </div>
              ) : (
                upcoming.map((ev) => {
                  const meta = TYPE_META[ev.type] || TYPE_META.other;
                  const Icon = meta.icon;
                  const d = new Date(ev.date + "T00:00:00");
                  const daysDiff = Math.ceil((d.getTime() - Date.now()) / 86400000);
                  const cleanSymbol = ev.symbol.toUpperCase();
                  const inWatchlist = isWatched(cleanSymbol) || isWatched(`${cleanSymbol}.NS`);

                  return (
                    <div
                      key={ev.id}
                      className="pt-2 first:pt-0 flex items-start gap-2.5 group hover:bg-white/3 p-1.5 rounded-lg transition"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${meta.bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-bold text-white font-mono flex items-center gap-1 truncate">
                            {ev.symbol}
                            {inWatchlist && (
                              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0" />
                            )}
                          </span>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold shrink-0 ${
                              daysDiff <= 1
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : daysDiff <= 5
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-white/5 text-white/40"
                            }`}
                          >
                            {daysDiff === 0 ? "Today" : daysDiff === 1 ? "Tomorrow" : `In ${daysDiff}d`}
                          </span>
                        </div>

                        <p className="text-[11px] text-white/70 line-clamp-2 font-sans mb-1">
                          {ev.title}
                        </p>

                        <div className="flex items-center justify-between text-[10px] font-mono text-white/40">
                          <span>
                            {d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedDay(ev.date);
                                setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
                              }}
                              className="text-primary hover:underline"
                            >
                              View Date
                            </button>
                            <span>·</span>
                            <Link href={`/stock/${cleanSymbol}`} className="text-white/60 hover:text-white flex items-center gap-0.5">
                              Chart
                              <ArrowUpRight className="w-2.5 h-2.5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
