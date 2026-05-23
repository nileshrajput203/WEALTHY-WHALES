import { useState, useMemo } from "react";
import { useWatchlist } from "@/hooks/useWatchlist";
import {
  CalendarDays, ChevronLeft, ChevronRight, Bell, TrendingUp,
  Briefcase, FileText, DollarSign, AlertCircle, Star, Filter,
} from "lucide-react";

/* ═══ Types ═══ */
interface StockEvent {
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
  agm:       { label: "AGM",          color: "text-blue-400",     bg: "bg-blue-500/15 border-blue-500/30",       icon: Briefcase },
  board:     { label: "Board Meet",   color: "text-purple-400",   bg: "bg-purple-500/15 border-purple-500/30",   icon: FileText },
  result:    { label: "Result",       color: "text-cyan-400",     bg: "bg-cyan-500/15 border-cyan-500/30",       icon: FileText },
  split:     { label: "Split",        color: "text-orange-400",   bg: "bg-orange-500/15 border-orange-500/30",   icon: AlertCircle },
  bonus:     { label: "Bonus",        color: "text-pink-400",     bg: "bg-pink-500/15 border-pink-500/30",       icon: Star },
  other:     { label: "Event",        color: "text-white/60",     bg: "bg-white/5 border-white/10",              icon: Bell },
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

/* ═══ Helper: Generate sample events from watchlist ═══ */
function generateWatchlistEvents(watchlist: string[]): StockEvent[] {
  const events: StockEvent[] = [];
  const today = new Date();
  const types: StockEvent["type"][] = ["earnings","dividend","agm","board","result","split","bonus"];
  const descriptions: Record<string, string> = {
    earnings: "Quarterly earnings announcement",
    dividend: "Ex-dividend date",
    agm: "Annual General Meeting",
    board: "Board meeting scheduled",
    result: "Financial results declaration",
    split: "Stock split record date",
    bonus: "Bonus share record date",
  };

  watchlist.forEach((sym, sIdx) => {
    const clean = sym.replace(".NS","").replace(".BO","");
    // Generate 2-4 events per stock spread across the next 3 months
    const count = 2 + (sIdx % 3);
    for (let i = 0; i < count; i++) {
      const daysAhead = Math.floor(Math.random() * 90) - 15; // some in past, most in future
      const d = new Date(today);
      d.setDate(d.getDate() + daysAhead);
      const type = types[(sIdx + i) % types.length];
      events.push({
        id: `${clean}-${i}`,
        symbol: clean,
        title: `${clean} — ${descriptions[type] || "Corporate event"}`,
        date: d.toISOString().split("T")[0],
        type,
        description: descriptions[type],
      });
    }
  });
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

/* ═══ Calendar Component ═══ */
export default function EventsCalendar() {
  const { watchlist } = useWatchlist();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  // Generate events from watchlist (in a real app, this would come from an API)
  const allEvents = useMemo(() => generateWatchlistEvents(watchlist), [watchlist]);

  const events = useMemo(() => {
    if (!filterType) return allEvents;
    return allEvents.filter(e => e.type === filterType);
  }, [allEvents, filterType]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().split("T")[0];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Events grouped by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, StockEvent[]> = {};
    events.forEach(e => { (map[e.date] ||= []).push(e); });
    return map;
  }, [events]);

  // Events for the selected day
  const selectedDayEvents = selectedDay ? (eventsByDate[selectedDay] || []) : [];

  // Upcoming events (next 14 days)
  const upcoming = useMemo(() => {
    const t = new Date(); t.setHours(0,0,0,0);
    const end = new Date(t); end.setDate(end.getDate() + 14);
    return events.filter(e => {
      const d = new Date(e.date);
      return d >= t && d <= end;
    });
  }, [events]);

  // Build calendar grid
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1 flex items-center gap-3">
          <CalendarDays className="w-7 h-7 text-primary" />
          Events Calendar
        </h1>
        <p className="text-sm text-white/40">
          {watchlist.length > 0
            ? `Tracking events for ${watchlist.length} stock${watchlist.length > 1 ? "s" : ""} in your watchlist`
            : "Add stocks to your watchlist to see upcoming corporate events"}
        </p>
      </div>

      {watchlist.length === 0 ? (
        <div className="glass-card rounded-2xl border border-white/6 p-16 text-center">
          <CalendarDays className="w-16 h-16 mx-auto text-white/15 mb-4" />
          <h3 className="text-xl font-semibold text-white/60 mb-2">No Watchlist Stocks</h3>
          <p className="text-sm text-white/30 max-w-md mx-auto">
            Add stocks to your watchlist first. The calendar will automatically populate with
            earnings dates, dividends, AGMs, and other corporate events.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Calendar Grid ──────────────── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filter bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-white/30" />
              <button
                onClick={() => setFilterType(null)}
                className={`px-3 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all
                  ${!filterType ? "bg-primary/20 text-primary border border-primary/30" : "text-white/40 hover:text-white/70 bg-white/5 border border-white/10"}`}
              >
                All
              </button>
              {Object.entries(TYPE_META).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setFilterType(filterType === key ? null : key)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all
                    ${filterType === key ? `${meta.bg} ${meta.color} border` : "text-white/40 hover:text-white/70 bg-white/5 border border-white/10"}`}
                >
                  {meta.label}
                </button>
              ))}
            </div>

            {/* Calendar card */}
            <div className="glass-card rounded-2xl border border-white/6 overflow-hidden">
              {/* Month header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5"
                style={{ background: "linear-gradient(135deg, rgba(26,26,46,0.9), rgba(13,13,26,0.9))" }}>
                <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-bold text-white font-mono tracking-wide">
                  {MONTHS[month]} {year}
                </h2>
                <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-white/5">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-[11px] font-mono text-white/30 py-2.5 uppercase tracking-wider">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, i) => {
                  if (day === null) return <div key={`empty-${i}`} className="h-20 border-b border-r border-white/3" />;
                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const dayEvents = eventsByDate[dateStr] || [];
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDay;

                  return (
                    <div
                      key={dateStr}
                      onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                      className={`h-20 p-1.5 border-b border-r border-white/3 cursor-pointer transition-all relative
                        ${isToday ? "bg-primary/5" : ""}
                        ${isSelected ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-white/3"}`}
                    >
                      <span className={`text-xs font-mono font-bold block mb-0.5
                        ${isToday ? "text-primary" : "text-white/50"}`}>
                        {day}
                      </span>
                      {/* Event dots */}
                      <div className="flex flex-wrap gap-0.5">
                        {dayEvents.slice(0, 3).map((ev, j) => {
                          const meta = TYPE_META[ev.type] || TYPE_META.other;
                          return (
                            <span
                              key={j}
                              className={`w-1.5 h-1.5 rounded-full ${meta.color.replace("text-", "bg-")}`}
                              title={ev.title}
                            />
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <span className="text-[8px] text-white/40 font-mono">+{dayEvents.length - 3}</span>
                        )}
                      </div>
                      {/* Compact event labels */}
                      {dayEvents.slice(0, 2).map((ev, j) => {
                        const meta = TYPE_META[ev.type] || TYPE_META.other;
                        return (
                          <div key={j} className={`text-[8px] font-mono truncate mt-0.5 px-1 py-0.5 rounded ${meta.bg} ${meta.color}`}>
                            {ev.symbol}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Right Panel: Selected Day + Upcoming ──────── */}
          <div className="space-y-4">
            {/* Selected day detail */}
            {selectedDay && (
                <div
                  key={selectedDay}
                  className="glass-card rounded-2xl border border-white/6 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
                >
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2"
                    style={{ background: "rgba(255,255,255,0.02)" }}>
                    <CalendarDays className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold text-white font-mono">
                      {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                    </span>
                  </div>
                  <div className="p-4 space-y-3">
                    {selectedDayEvents.length === 0 ? (
                      <p className="text-sm text-white/30 text-center py-4">No events on this day</p>
                    ) : (
                      selectedDayEvents.map(ev => {
                        const meta = TYPE_META[ev.type] || TYPE_META.other;
                        const Icon = meta.icon;
                        return (
                          <div key={ev.id} className={`p-3 rounded-xl border ${meta.bg} transition-colors`}>
                            <div className="flex items-center gap-2 mb-1">
                              <Icon className={`w-4 h-4 ${meta.color}`} />
                              <span className={`text-xs font-bold font-mono ${meta.color}`}>{meta.label}</span>
                              <span className="ml-auto text-[10px] font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded">{ev.symbol}</span>
                            </div>
                            <p className="text-sm text-white/70">{ev.title}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

            {/* Upcoming events */}
            <div className="glass-card rounded-2xl border border-white/6 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2"
                style={{ background: "rgba(255,255,255,0.02)" }}>
                <Bell className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-bold text-white">Upcoming (14 days)</span>
                <span className="ml-auto text-[10px] font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded">{upcoming.length}</span>
              </div>
              <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
                {upcoming.length === 0 ? (
                  <p className="text-sm text-white/30 text-center py-6">No upcoming events</p>
                ) : (
                  upcoming.map(ev => {
                    const meta = TYPE_META[ev.type] || TYPE_META.other;
                    const Icon = meta.icon;
                    const d = new Date(ev.date + "T00:00:00");
                    const daysDiff = Math.ceil((d.getTime() - Date.now()) / 86400000);
                    return (
                      <div key={ev.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/3 transition-colors cursor-pointer"
                        onClick={() => { setSelectedDay(ev.date); setCurrentDate(d); }}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.bg}`}>
                          <Icon className={`w-4 h-4 ${meta.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{ev.symbol}</p>
                          <p className="text-[10px] text-white/40 truncate">{ev.description}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[10px] font-mono text-white/40">
                            {d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </p>
                          <p className={`text-[10px] font-mono font-bold ${daysDiff <= 3 ? "text-red-400" : daysDiff <= 7 ? "text-yellow-400" : "text-white/30"}`}>
                            {daysDiff === 0 ? "Today" : daysDiff === 1 ? "Tomorrow" : `${daysDiff}d`}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
