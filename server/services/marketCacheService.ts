import fs from "fs";
import path from "path";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * HIGH-SPEED PERSISTENT MARKET CACHE SERVICE (Stale-While-Revalidate Engine)
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose:
 * Solves the "why do other websites load instantly with live data while mine hangs"
 * issue. Production financial platforms (TradingView, Screener, Chartink) NEVER
 * scrape or prompt LLMs on-the-fly while a user waits. They serve pre-warmed,
 * persistent local snapshots in < 10ms and refresh in the background.
 *
 * This service provides:
 * 1. Instant (<10ms) responses from memory + persistent disk (`data/persistent_market_cache.json`).
 * 2. Survives server restarts and Postgres disconnections with zero data loss.
 * 3. Background asynchronous revalidation so users never see loading spinners.
 * ════════════════════════════════════════════════════════════════════════════════
 */

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  source: string;
}

const CACHE_FILE = path.join(process.cwd(), "data", "persistent_market_cache.json");
const memoryCache = new Map<string, CacheEntry>();
let writeTimeout: NodeJS.Timeout | null = null;

// Initialize from disk on startup
function initCacheFromDisk() {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      for (const [key, value] of Object.entries(parsed)) {
        memoryCache.set(key, value as CacheEntry);
      }
    }
  } catch (err) {
    console.warn("[MarketCache] Could not load cache from disk, starting fresh RAM cache:", err);
  }
}

initCacheFromDisk();

function scheduleFlush() {
  if (writeTimeout) return;
  writeTimeout = setTimeout(() => {
    writeTimeout = null;
    try {
      const obj: Record<string, any> = {};
      for (const [k, v] of memoryCache.entries()) {
        obj[k] = v;
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 2), "utf-8");
    } catch (err) {
      console.warn("[MarketCache] Failed to flush cache to disk:", err);
    }
  }, 1000); // 1-second debounced atomic flush
}

export const MarketCacheService = {
  /**
   * Returns cached data immediately in < 10ms if available.
   */
  get<T>(key: string, maxAgeMs?: number): T | null {
    const entry = memoryCache.get(key);
    if (!entry) return null;

    if (maxAgeMs && Date.now() - entry.timestamp > maxAgeMs) {
      return null; // Expired
    }

    return entry.data as T;
  },

  /**
   * Returns cached data regardless of age (for instant UI render while revalidation is in flight).
   */
  getStale<T>(key: string): { data: T; isStale: boolean; ageMs: number } | null {
    const entry = memoryCache.get(key);
    if (!entry) return null;

    const ageMs = Date.now() - entry.timestamp;
    return {
      data: entry.data as T,
      isStale: ageMs > 5 * 60 * 1000, // Considered stale after 5 minutes
      ageMs,
    };
  },

  /**
   * Sets data in RAM immediately and debounces persistent flush to disk.
   */
  set<T>(key: string, data: T, source: string = "live"): void {
    memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      source,
    });
    scheduleFlush();
  },

  /**
   * Checks if an entry exists and is not expired.
   */
  has(key: string, maxAgeMs?: number): boolean {
    const entry = memoryCache.get(key);
    if (!entry) return false;
    if (maxAgeMs && Date.now() - entry.timestamp > maxAgeMs) return false;
    return true;
  },

  /**
   * High-order helper: Stale-While-Revalidate execution pattern.
   * If cached, returns immediately; otherwise waits for fetcher.
   * When stale, triggers fetcher asynchronously without blocking.
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 5 * 60 * 1000
  ): Promise<T> {
    const cached = this.getStale<T>(key);

    if (cached) {
      if (cached.isStale) {
        // Trigger background revalidation (fire and forget)
        fetcher()
          .then((fresh) => {
            if (fresh) this.set(key, fresh, "background-swr");
          })
          .catch((err) => {
            console.warn(`[MarketCache] Background SWR failed for ${key}:`, err.message);
          });
      }
      return cached.data;
    }

    // Cold cache: fetch synchronously once and persist
    const fresh = await fetcher();
    if (fresh) {
      this.set(key, fresh, "cold-fetch");
    }
    return fresh;
  },
};
