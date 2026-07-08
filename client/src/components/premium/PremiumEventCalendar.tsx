import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { PremiumCard, PremiumBadge } from './PremiumCard';
import { Calendar, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { MOTION_VARIANTS } from './DesignTokens';

interface CalendarEvent {
  id: string;
  symbol: string;
  title: string;
  date: string;
  type: 'earnings' | 'dividend' | 'agm' | 'board' | 'split' | 'bonus' | 'result' | 'other';
  description?: string;
  impact?: 'high' | 'medium' | 'low';
}

interface PremiumEventCalendarProps {
  watchlistSymbols: string[];
  onEventClick?: (event: CalendarEvent) => void;
}

export const PremiumEventCalendar: React.FC<PremiumEventCalendarProps> = ({
  watchlistSymbols,
  onEventClick,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');

  // Fetch events for watchlist
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events', watchlistSymbols],
    queryFn: async () => {
      if (watchlistSymbols.length === 0) return [];
      
      const res = await fetch(`/api/nse/events/${watchlistSymbols.join(',')}`);
      if (!res.ok) throw new Error('Failed to fetch events');
      const data = await res.json();
      return data.events || [];
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    
    events.forEach((event: CalendarEvent) => {
      const date = new Date(event.date).toDateString();
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(event);
    });
    
    return grouped;
  }, [events]);

  // Get events for selected date
  const selectedDateEvents = selectedDate
    ? eventsByDate[selectedDate.toDateString()] || []
    : [];

  // Get upcoming events (next 14 days)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const twoWeeksAhead = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    
    return events
      .filter((e: CalendarEvent) => {
        const eventDate = new Date(e.date);
        return eventDate >= now && eventDate <= twoWeeksAhead;
      })
      .sort((a: CalendarEvent, b: CalendarEvent) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
  }, [events]);

  const getEventColor = (type: string) => {
    const colors: Record<string, string> = {
      earnings: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
      dividend: 'bg-green-500/20 border-green-500/30 text-green-400',
      agm: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
      board: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400',
      split: 'bg-orange-500/20 border-orange-500/30 text-orange-400',
      bonus: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
      result: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400',
      other: 'bg-neutral-500/20 border-neutral-500/30 text-neutral-400',
    };
    return colors[type] || colors.other;
  };

  const getImpactIcon = (impact?: string) => {
    if (impact === 'high') return <AlertCircle className="h-4 w-4 text-red-400" />;
    if (impact === 'medium') return <TrendingUp className="h-4 w-4 text-yellow-400" />;
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <motion.div
      variants={MOTION_VARIANTS.fadeIn}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      {/* View Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('list')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'list'
              ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50'
              : 'bg-neutral-800/50 text-neutral-400 border border-neutral-700/50'
          }`}
        >
          <Calendar className="h-4 w-4 inline mr-2" />
          List View
        </button>
        <button
          onClick={() => setViewMode('month')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'month'
              ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50'
              : 'bg-neutral-800/50 text-neutral-400 border border-neutral-700/50'
          }`}
        >
          <Calendar className="h-4 w-4 inline mr-2" />
          Calendar
        </button>
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white">Upcoming Events (14 days)</h3>
          
          <AnimatePresence>
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event: CalendarEvent, idx: number) => (
                <motion.div
                  key={event.id}
                  variants={MOTION_VARIANTS.slideInUp}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => onEventClick?.(event)}
                >
                  <PremiumCard
                    variant="glass"
                    hover
                    className="cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{event.symbol}</span>
                          <PremiumBadge
                            label={event.type}
                            variant={event.impact === 'high' ? 'danger' : 'info'}
                            size="sm"
                          />
                        </div>
                        <p className="text-neutral-300">{event.title}</p>
                        <div className="flex items-center gap-2 text-sm text-neutral-400">
                          <Clock className="h-4 w-4" />
                          {new Date(event.date).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      {getImpactIcon(event.impact)}
                    </div>
                  </PremiumCard>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-8 text-neutral-400">
                No upcoming events in the next 14 days
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Mini Calendar */}
          <div className="lg:col-span-1">
            <PremiumCard variant="glass">
              <div className="space-y-4">
                <h3 className="font-semibold text-white">Calendar</h3>
                <div className="text-sm text-neutral-400">
                  {/* Simplified calendar - in production, use a full calendar library */}
                  <div className="grid grid-cols-7 gap-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="text-center font-medium text-xs py-1">
                        {day}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </PremiumCard>
          </div>

          {/* Events for Selected Date */}
          <div className="lg:col-span-2">
            <PremiumCard variant="glass">
              <div className="space-y-4">
                <h3 className="font-semibold text-white">
                  Events for {selectedDate?.toLocaleDateString('en-IN') || 'Today'}
                </h3>
                
                <AnimatePresence>
                  {selectedDateEvents.length > 0 ? (
                    selectedDateEvents.map((event: CalendarEvent, idx: number) => (
                      <motion.div
                        key={event.id}
                        variants={MOTION_VARIANTS.slideInUp}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ delay: idx * 0.05 }}
                        className={`p-3 rounded-lg border ${getEventColor(event.type)} cursor-pointer hover:scale-105 transition-transform`}
                        onClick={() => onEventClick?.(event)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-medium">{event.title}</p>
                            <p className="text-xs opacity-75">{event.symbol}</p>
                          </div>
                          {getImpactIcon(event.impact)}
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-neutral-400 text-sm">No events scheduled</p>
                  )}
                </AnimatePresence>
              </div>
            </PremiumCard>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default PremiumEventCalendar;
