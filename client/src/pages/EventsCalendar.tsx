import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useWatchlist } from "@/hooks/useWatchlist";
import {
  CalendarDays, ChevronLeft, ChevronRight, Bell, TrendingUp,
  Briefcase, FileText, DollarSign, AlertCircle, Star, Filter,
  Search, ArrowUpRight, Plus, X, Sparkles, Building2,
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
  other:     { label: "Event",        color: "text-white/60",     bg: "bg-white/5 border-white/10",              icon: Bell },
};

const POPULAR_SUGGESTIONS = [
  "CYIENT", "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "TATAMOTORS", "SBIN"
];

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function EventsCalendar() {
  const { watchlist, addStock, removeStock } = useWatchlist();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [newStockInput, setNewStockInput] = useState("");

  // Normalize watchlist symbols
  const watchlistClean = useMemo(() => {
    return Array.from(new Set(
      watchlist.map(s => s.replace(/\.NS$|\.BO$/i, "").trim().toUpperCase()).filter(Boolean)
    ));
  }, [watchlist]);

  // Fetch corporate events strictly for watchlist symbols
  const { data: eventsData, isLoading } = useQuery<{ events: StockEvent[] }>({
    queryKey: ["/api/nse/events", watchlistClean.length > 0 ? watchlistClean.join(",") : "none"],
    enabled: watchlistClean.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Strictly filter to ONLY symbols in the user's watchlist
  const watchlistEvents = useMemo(() => {
    if (watchlistClean.length === 0) return [];
    const list = eventsData?.events ?? [];
    return list.filter(e => watchlistClean.includes(e.symbol.toUpperCase()));
  }, [eventsData, watchlistClean]);

  // Apply optional category and text filters
  const filteredEvents = useMemo(() => {
    return watchlistEvents.filter(e => {
      const matchesType = !filterType || e.type === filterType;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q ||
        e.symbol.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q));
      return matchesType && matchesSearch;
    });
  }, [watchlistEvents, filterType, searchQuery]);

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

  // Group events by date (only watchlist stocks)
  const eventsByDate = useMemo(() => {
    const map: Record<string, StockEvent[]> = {};
    filteredEvents.forEach(e => {
      (map[e.date] ||= []).push(e);
    });
    return map;
  }, [filteredEvents]);

  // Events for selected day
  const selectedDayEvents = selectedDay ? (eventsByDate[selectedDay] || []) : [];

  // Upcoming events (Next 14 days) strictly for watchlist
  const upcoming = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const end = new Date(t);
    end.setDate(end.getDate() + 14);

    return filteredEvents
      .filter(e => {
        const d = new Date(e.date + "T00:00:00");
        return d >= t && d <= end;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredEvents]);

  // Build calendar grid days
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  // Add stock to watchlist
  const handleAddStock = (sym: string) => {
    const clean = sym.replace(/\.NS$|\.BO$/i, "").trim().toUpperCase();
    if (!clean) return;
    const full = `${clean}.NS`;
    if (!watchlist.includes(full) && !watchlist.includes(clean)) {
      addStock(full);
    }
    setNewStockInput("");
  };

  // Remove stock from watchlist
  const handleRemoveStock = (cleanSym: string) => {
    removeStock(cleanSym);
    removeStock(`${cleanSym}.NS`);
    removeStock(`${cleanSym}.BO`);
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-amber-400/10 text-amber-400 border border-amber-400/20 flex items-center gap-1.5">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              Watchlist-Only Calendar
            </span>
            <span className="text-xs text-white/40 font-mono">
              Dedicated Corporate Schedule
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white flex items-center gap-2">
            Watchlist Events Calendar
          </h1>
          <p className="text-xs sm:text-sm text-white/50">
            Monitoring upcoming board meetings, quarterly earnings calls, dividend record dates, and AGMs exclusively for stocks in your watchlist.
          </p>
        </div>

        {/* Quick Add Stock Input */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="relative">
            <input
              type="text"
              placeholder="+ Add stock to watchlist (e.g. TCS)..."
              value={newStockInput}
              onChange={(e) => setNewStockInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddStock(newStockInput);
              }}
              className="bg-neutral-900 border border-white/15 focus:border-amber-400/60 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/30 font-mono focus:outline-none transition w-64"
            />
          </div>
          <button
            onClick={() => handleAddStock(newStockInput)}
            disabled={!newStockInput.trim()}
            className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black rounded-xl text-xs font-mono font-bold transition flex items-center gap-1 shadow-md"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      </div>

      {/* ── Active Watchlist Chips ────────────────────────────────────── */}
      <div className="glass-card rounded-2xl border border-white/8 p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-white/60 font-semibold uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-400" />
            Monitored Watchlist Stocks ({watchlistClean.length})
          </span>
          <span className="text-[11px] font-mono text-white/40">
            {filteredEvents.length} scheduled event{filteredEvents.length === 1 ? "" : "s"} total
          </span>
        </div>

        {watchlistClean.length === 0 ? (
          <div className="py-6 text-center space-y-3 border border-dashed border-white/10 rounded-xl bg-white/1">
            <Star className="w-8 h-8 text-amber-400/40 mx-auto" />
            <div>
              <p className="text-sm font-bold text-white">Your watchlist is currently empty</p>
              <p className="text-xs text-white/40 max-w-md mx-auto mt-0.5">
                The Events Calendar displays dates strictly for your watchlist stocks. Add stocks below to populate your calendar:
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
              {POPULAR_SUGGESTIONS.map(sym => (
                <button
                  key={sym}
                  onClick={() => handleAddStock(sym)}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white/5 hover:bg-amber-400/20 hover:text-amber-300 hover:border-amber-400/40 border border-white/10 text-white/70 transition flex items-center gap-1"
                >
                  <Plus className="w-3 h-3 text-amber-400" />
                  {sym}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {watchlistClean.map(sym => {
              const eventCount = watchlistEvents.filter(e => e.symbol.toUpperCase() === sym).length;
              return (
                <div
                  key={sym}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 text-white text-xs font-mono font-bold flex items-center gap-2 transition group"
                >
                  <Link href={`/stock/${sym}`} className="hover:text-primary transition">
                    {sym}
                  </Link>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-400/15 text-amber-300 border border-amber-400/20">
                    {eventCount} evt
                  </span>
                  <button
                    onClick={() => handleRemoveStock(sym)}
                    className="text-white/30 hover:text-red-400 transition ml-0.5"
                    title={`Remove ${sym} from watchlist`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            {/* Quick Suggestions to add more */}
            <div className="flex items-center gap-1.5 ml-auto text-[11px] font-mono text-white/40">
              <span>Quick add:</span>
              {POPULAR_SUGGESTIONS.filter(s => !watchlistClean.includes(s)).slice(0, 3).map(sym => (
                <button
                  key={sym}
                  onClick={() => handleAddStock(sym)}
                  className="text-primary hover:underline"
                >
                  +{sym}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {watchlistClean.length > 0 && (
        <>
          {/* ── Search & Filter Controls ──────────────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full md:max-w-xs">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter watchlist events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-900 border border-white/10 focus:border-amber-400/50 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/30 font-mono focus:outline-none transition"
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
                    ? "bg-amber-400 text-black font-bold shadow-xs"
                    : "text-white/40 hover:text-white/70 bg-white/5 border border-white/10"
                }`}
              >
                All Events
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

          {/* ── Calendar & Inspector Layout ───────────────────────────────── */}
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
                    <span className="text-[11px] font-mono text-amber-300 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20 font-bold">
                      {filteredEvents.length} watchlist events
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

                {/* Calendar Days Matrix (Strictly Watchlist Stocks) */}
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
                          isToday ? "bg-amber-400/10 ring-1 ring-amber-400/50" : ""
                        } ${
                          isSelected ? "bg-amber-400/20 ring-2 ring-amber-400" : "hover:bg-white/4"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-mono font-bold ${
                            isToday ? "text-amber-400" : isSelected ? "text-white" : "text-white/50"
                          }`}>
                            {day}
                          </span>
                          {dayEvents.length > 0 && (
                            <span className="text-[9px] font-mono px-1 rounded bg-amber-400/20 text-amber-300 font-bold">
                              {dayEvents.length}
                            </span>
                          )}
                        </div>

                        {/* Watchlist Event pills */}
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
                <div className="glass-card rounded-2xl border border-amber-400/30 bg-amber-400/5 overflow-hidden animate-in fade-in duration-200 shadow-xl">
                  <div className="px-4 py-3 border-b border-amber-400/20 flex items-center justify-between bg-amber-400/10">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-amber-400" />
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
                        No watchlist events on this date.
                      </p>
                    ) : (
                      selectedDayEvents.map((ev) => {
                        const meta = TYPE_META[ev.type] || TYPE_META.other;
                        const Icon = meta.icon;
                        const cleanSymbol = ev.symbol.toUpperCase();

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
                              <Link
                                href={`/stock/${cleanSymbol}`}
                                className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-0.5"
                              >
                                {cleanSymbol} Chart
                                <ArrowUpRight className="w-3 h-3" />
                              </Link>
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

              {/* Upcoming 14 Days (Watchlist Only) */}
              <div className="glass-card rounded-2xl border border-white/8 overflow-hidden shadow-xl">
                <div
                  className="px-4 py-3 border-b border-white/8 flex items-center justify-between"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                >
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      Upcoming Watchlist Events
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 font-bold">
                    {upcoming.length} events
                  </span>
                </div>

                <div className="p-3 space-y-2 max-h-[460px] overflow-y-auto divide-y divide-white/5">
                  {upcoming.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-xs text-white/40 font-mono">No upcoming events in next 14 days for your watchlist.</p>
                    </div>
                  ) : (
                    upcoming.map((ev) => {
                      const meta = TYPE_META[ev.type] || TYPE_META.other;
                      const Icon = meta.icon;
                      const d = new Date(ev.date + "T00:00:00");
                      const daysDiff = Math.ceil((d.getTime() - Date.now()) / 86400000);
                      const cleanSymbol = ev.symbol.toUpperCase();

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
                                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0" />
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
                                  className="text-amber-400 hover:underline"
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
        </>
      )}
    </div>
  );
}
