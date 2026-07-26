import axios from "axios";
import { db } from "./db";
import { stockNewsCache } from "@shared/schema";
import { eq, gte, lte } from "drizzle-orm";
import { getNowIST } from "./istUtils";

export interface CorporateEvent {
  symbol: string;
  title: string;
  date: Date;
  type: 'earnings' | 'dividend' | 'agm' | 'board' | 'split' | 'bonus' | 'result' | 'other';
  description: string;
  impact?: 'high' | 'medium' | 'low';
}

/**
 * Event Calendar Service
 * Fetches and manages corporate events for watchlist stocks
 */

// NSE Board Meetings Parser
export async function parseBoardMeetings(): Promise<CorporateEvent[]> {
  try {
    // Fetch from NSE website or use cached data
    const events: CorporateEvent[] = [];
    
    // Placeholder: In production, this would scrape NSE announcements
    // For now, return empty array (to be populated by real data source)
    
    return events;
  } catch (err) {
    console.error("[EventCalendar] Board meetings parse error:", err);
    return [];
  }
}

// NSE Corporate Actions Parser
export async function parseCorporateActions(): Promise<CorporateEvent[]> {
  try {
    const events: CorporateEvent[] = [];
    
    // Placeholder: In production, this would scrape NSE corporate actions
    
    return events;
  } catch (err) {
    console.error("[EventCalendar] Corporate actions parse error:", err);
    return [];
  }
}

/**
 * Generate synthetic events for watchlist stocks based on historical patterns
 * Used as fallback when real data is unavailable
 */
export async function generateEventsForWatchlist(symbols: string[]): Promise<CorporateEvent[]> {
  const events: CorporateEvent[] = [];
  const now = getNowIST();
  
  for (const symbol of symbols) {
    try {
      // Earnings typically quarterly
      const nextEarnings = new Date(now);
      nextEarnings.setMonth(nextEarnings.getMonth() + 1);
      nextEarnings.setDate(15);
      
      events.push({
        symbol,
        title: `Q${Math.ceil((nextEarnings.getMonth() + 1) / 3)} Earnings`,
        date: nextEarnings,
        type: 'earnings',
        description: `Quarterly earnings announcement for ${symbol}`,
        impact: 'high',
      });
      
      // Dividend typically annual
      const nextDividend = new Date(now);
      nextDividend.setMonth(nextDividend.getMonth() + 3);
      nextDividend.setDate(1);
      
      events.push({
        symbol,
        title: 'Dividend Announcement',
        date: nextDividend,
        type: 'dividend',
        description: `Dividend announcement for ${symbol}`,
        impact: 'medium',
      });
      
      // AGM typically annual
      const nextAGM = new Date(now);
      nextAGM.setMonth(5); // June
      nextAGM.setDate(15);
      
      if (nextAGM < now) {
        nextAGM.setFullYear(nextAGM.getFullYear() + 1);
      }
      
      events.push({
        symbol,
        title: 'Annual General Meeting',
        date: nextAGM,
        type: 'agm',
        description: `AGM for ${symbol}`,
        impact: 'medium',
      });
    } catch (err) {
      console.error(`[EventCalendar] Error generating events for ${symbol}:`, err);
    }
  }
  
  return events;
}

/**
 * Get all events for watchlist stocks
 */
export async function getEventsForWatchlist(symbols: string[]): Promise<CorporateEvent[]> {
  if (symbols.length === 0) return [];
  
  const [boardMeetings, corporateActions] = await Promise.all([
    parseBoardMeetings(),
    parseCorporateActions(),
  ]);
  
  let allEvents = [...boardMeetings, ...corporateActions];
  
  // Filter to requested symbols
  allEvents = allEvents.filter(e => symbols.includes(e.symbol));
  
  // Generate fallback events for symbols without real data
  const symbolsWithEvents = new Set(allEvents.map(e => e.symbol));
  const symbolsWithoutEvents = symbols.filter(s => !symbolsWithEvents.has(s));
  
  if (symbolsWithoutEvents.length > 0) {
    const generatedEvents = await generateEventsForWatchlist(symbolsWithoutEvents);
    allEvents = [...allEvents, ...generatedEvents];
  }
  
  // Sort by date
  allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  return allEvents;
}

/**
 * Get upcoming events (next 30 days)
 */
export async function getUpcomingEvents(symbols: string[], daysAhead = 30): Promise<CorporateEvent[]> {
  const allEvents = await getEventsForWatchlist(symbols);
  const now = getNowIST();
  const futureDate = new Date(now);
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return allEvents.filter(e => e.date >= now && e.date <= futureDate);
}

/**
 * Get events by type
 */
export async function getEventsByType(
  symbols: string[],
  type: 'earnings' | 'dividend' | 'agm' | 'board' | 'split' | 'bonus' | 'result' | 'other'
): Promise<CorporateEvent[]> {
  const allEvents = await getEventsForWatchlist(symbols);
  return allEvents.filter(e => e.type === type);
}

/**
 * Get high-impact events (earnings, dividends, AGM)
 */
export async function getHighImpactEvents(symbols: string[]): Promise<CorporateEvent[]> {
  const allEvents = await getEventsForWatchlist(symbols);
  return allEvents.filter(e => e.impact === 'high' || e.type === 'earnings');
}

/**
 * Cache event data for performance
 */
export async function cacheEventData(symbol: string, events: CorporateEvent[]): Promise<void> {
  try {
    const now = getNowIST();
    
    await db.insert(stockNewsCache).values({
      symbol,
      headlines: events.map(e => ({
        title: e.title,
        date: e.date.toISOString(),
        type: e.type,
      })),
      fetchedAt: now,
    }).onConflictDoUpdate({
      target: stockNewsCache.symbol,
      set: {
        headlines: events.map(e => ({
          title: e.title,
          date: e.date.toISOString(),
          type: e.type,
        })),
        fetchedAt: now,
      },
    });
  } catch (err) {
    console.error(`[EventCalendar] Cache error for ${symbol}:`, err);
  }
}

/**
 * Get cached events
 */
export async function getCachedEvents(symbol: string): Promise<CorporateEvent[]> {
  try {
    const cached = await db.select()
      .from(stockNewsCache)
      .where(eq(stockNewsCache.symbol, symbol))
      .limit(1);
    
    if (cached.length === 0) return [];
    
    const headlines = cached[0].headlines as any[];
    if (!Array.isArray(headlines)) return [];
    
    return headlines.map(h => ({
      symbol,
      title: h.title,
      date: new Date(h.date),
      type: h.type || 'other',
      description: h.title,
    }));
  } catch (err) {
    console.error(`[EventCalendar] Fetch cached error for ${symbol}:`, err);
    return [];
  }
}

/**
 * Sync events for all watchlist stocks (called by scheduler)
 */
export async function syncWatchlistEvents(symbols: string[]): Promise<void> {
  for (const symbol of symbols) {
    try {
      const events = await getEventsForWatchlist([symbol]);
      await cacheEventData(symbol, events);
    } catch (err) {
      console.error(`[EventCalendar] Sync error for ${symbol}:`, err);
    }
  }
}
