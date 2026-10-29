/**
 * CANDLE CACHE — Shared In-Memory Candle Store for All Scanners
 * ─────────────────────────────────────────────────────────────────────────────
 * Problem: VCP2, Swing, IPO, Hermes, and Pattern scanners all call
 *          getYahooHistory() independently for the same symbols, causing:
 *          - 800+ redundant HTTP calls per scan cycle
 *          - Yahoo rate-limiting / throttling
 *          - 5-10 minute scan times
 *
 * Solution: Centralized candle cache with configurable TTL. All scanners
 *           call getCandlesCached() instead of getYahooHistory() directly.
 *           First scan populates the cache; subsequent scanners get instant hits.
 *
 * Design:
 *   - RAM-only (no Postgres dependency) — survives DB outages
 *   - Per-symbol TTL (default 15 minutes for intraday freshness)
 *   - LRU eviction at MAX_SYMBOLS (1000) to cap memory at ~100MB
 *   - Pre-warm API for bulk-loading ahead of scan cycles
 *   - Stats tracking for monitoring cache efficiency
 */

import axios from "axios";

interface CandleCacheEntry {
  candles: any[];
  fetchedAt: number;
  accessedAt: number;
  range: string;
  interval: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  errors: number;
}

const MAX_SYMBOLS = 1000;
const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

class CandleCache {
  private store: Map<string, CandleCacheEntry> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, evictions: 0, errors: 0 };
  private inflightRequests: Map<string, Promise<any[]>> = new Map();

  /** Cache key from symbol + range + interval */
  private key(symbol: string, range: string, interval: string): string {
    return `${symbol}|${range}|${interval}`;
  }

  /**
   * Get candles with caching. Deduplicates concurrent requests for the same symbol.
   * If two scanners request TCS.NS|1y|1d at the same time, only one HTTP call fires.
   */
  async getCandlesCached(
    symbol: string,
    range: string = "1y",
    interval: string = "1d",
    ttlMs: number = DEFAULT_TTL_MS
  ): Promise<any[]> {
    const k = this.key(symbol, range, interval);

    // 1. Check cache
    const cached = this.store.get(k);
    if (cached && Date.now() - cached.fetchedAt < ttlMs) {
      cached.accessedAt = Date.now();
      this.stats.hits++;
      return cached.candles;
    }

    // 2. Check for in-flight request (dedup concurrent calls)
    const inflight = this.inflightRequests.get(k);
    if (inflight) {
      this.stats.hits++;
      return inflight;
    }

    // 3. Fetch fresh data
    this.stats.misses++;
    const fetchPromise = this._fetchAndStore(k, symbol, range, interval);
    this.inflightRequests.set(k, fetchPromise);

    try {
      const result = await fetchPromise;
      return result;
    } finally {
      this.inflightRequests.delete(k);
    }
  }

  private async _fetchAndStore(
    key: string,
    symbol: string,
    range: string,
    interval: string
  ): Promise<any[]> {
    try {
      const params: any = { interval, includePrePost: false, useYfid: true, corsDomain: 'finance.yahoo.com' };
      if (range === 'max' || range === '10y') {
        params.period1 = 0;
        params.period2 = Math.floor(Date.now() / 1000);
      } else {
        params.range = range;
      }
      const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`, {
        params,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 15000,
      });

      const r = response.data?.chart?.result?.[0];
      if (!r?.timestamp || !r?.indicators?.quote?.[0]) return [];
      const q = r.indicators.quote[0];
      const candles = r.timestamp.map((t: number, i: number) => ({
        time: new Date(t * 1000),
        open: q.open?.[i],
        high: q.high?.[i],
        low: q.low?.[i],
        close: q.close?.[i],
        volume: q.volume?.[i],
      })).filter((c: any) => Number.isFinite(c.close));

      // Evict LRU if at capacity
      if (this.store.size >= MAX_SYMBOLS && !this.store.has(key)) {
        this._evictLRU();
      }

      this.store.set(key, {
        candles,
        fetchedAt: Date.now(),
        accessedAt: Date.now(),
        range,
        interval,
      });

      return candles;
    } catch (err) {
      this.stats.errors++;
      return [];
    }
  }

  /**
   * Pre-warm cache for a batch of symbols in parallel.
   * Used before scan cycles to front-load all Yahoo API calls efficiently.
   * 
   * @param symbols - List of Yahoo symbols (e.g., ["TCS.NS", "RELIANCE.NS"])
   * @param range - History range (default "1y")
   * @param interval - Candle interval (default "1d")
   * @param concurrency - Max parallel Yahoo calls (default 25)
   * @param batchDelayMs - Delay between batches to avoid throttling (default 150ms)
   */
  async preWarm(
    symbols: string[],
    range: string = "1y",
    interval: string = "1d",
    concurrency: number = 25,
    batchDelayMs: number = 150
  ): Promise<{ warmed: number; skipped: number; errors: number }> {
    let warmed = 0;
    let skipped = 0;
    let errors = 0;

    // Filter out already-cached symbols
    const toFetch = symbols.filter(sym => {
      const k = this.key(sym, range, interval);
      const cached = this.store.get(k);
      if (cached && Date.now() - cached.fetchedAt < DEFAULT_TTL_MS) {
        skipped++;
        return false;
      }
      return true;
    });

    console.log(`[CandleCache] Pre-warming ${toFetch.length} symbols (${skipped} already cached)...`);

    for (let i = 0; i < toFetch.length; i += concurrency) {
      const batch = toFetch.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map(sym => this.getCandlesCached(sym, range, interval))
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value.length > 0) {
          warmed++;
        } else {
          errors++;
        }
      }

      // Progress logging every 100 symbols
      if ((i + concurrency) % 100 < concurrency) {
        console.log(`  [CandleCache] Progress: ${Math.min(i + concurrency, toFetch.length)}/${toFetch.length} → ${warmed} warmed, ${errors} errors`);
      }

      if (i + concurrency < toFetch.length) {
        await new Promise(r => setTimeout(r, batchDelayMs));
      }
    }

    console.log(`[CandleCache] Pre-warm complete: ${warmed} warmed, ${skipped} already cached, ${errors} errors`);
    return { warmed, skipped, errors };
  }

  /** Get cache statistics */
  getStats(): CacheStats & { size: number; hitRate: string } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.store.size,
      hitRate: total > 0 ? `${((this.stats.hits / total) * 100).toFixed(1)}%` : "N/A",
    };
  }

  /** Clear all cached candles */
  clear() {
    this.store.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0, errors: 0 };
  }

  private _evictLRU() {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [k, v] of this.store) {
      if (v.accessedAt < oldestTime) {
        oldestTime = v.accessedAt;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      this.store.delete(oldestKey);
      this.stats.evictions++;
    }
  }
}

/** Singleton — import this in all scanners */
export const candleCache = new CandleCache();
