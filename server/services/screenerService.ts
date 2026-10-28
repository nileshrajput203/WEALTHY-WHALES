import axios from "axios";
import * as cheerio from "cheerio";
import { db } from "../db";
import { screenerCache } from "@shared/schema";
import { eq } from "drizzle-orm";

// L1 Memory Cache (6 hours) & Single-Flight Deduplication
const screenerL1Cache = new Map<string, { data: any; ts: number }>();
const screenerInflight = new Map<string, Promise<any>>();
const SCREENER_CACHE_TTL = 6 * 60 * 60 * 1000;

// Promise Mutex Queue: ensures strictly sequential outbound calls to Screener.in with >= 2.5s delay
let screenerMutexQueue = Promise.resolve();
let lastRequestTime = 0;

function runWithScreenerMutex<T>(fn: () => Promise<T>): Promise<T> {
  const job = screenerMutexQueue.then(async () => {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < 2500) {
      const wait = 2500 - elapsed;
      console.log(`[Screener.in Mutex Queue] Pacing request, waiting ${wait}ms...`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    lastRequestTime = Date.now();
    return fn();
  });
  screenerMutexQueue = job.then(() => { }).catch(() => { });
  return job;
}

function parseTableElement(table: cheerio.Cheerio<any>): any[] {
  if (table.length === 0) return [];

  const headers: string[] = [];
  table.find("thead tr th").each((_, th) => {
    headers.push(cheerio.load(th).text().trim());
  });

  // If thead is empty, try first row
  if (headers.length === 0) {
    table.find("tr").first().find("th, td").each((_, el) => {
      headers.push(cheerio.load(el).text().trim());
    });
  }

  const rows: any[] = [];
  table.find("tbody tr, tr").each((i, row) => {
    const $row = cheerio.load(row);
    // Skip header row
    const firstCellText = $row("th, td").first().text().trim();
    if ($row("th").length > 0 && headers.includes(firstCellText)) {
      return;
    }
    const cols = $row("td, th");
    if (cols.length === 0) return;

    const rawName = $row(cols[0]).text();
    const name = rawName
      .replace(/\u00a0/g, " ")
      .trim()
      .replace(/\+$/, "")
      .trim();

    if (!name || name.toLowerCase().includes("show") || name.toLowerCase().includes("source")) return;

    const rowData: Record<string, any> = { metric: name };
    for (let j = 1; j < cols.length; j++) {
      const headerName = headers[j] || `Col_${j}`;
      const valStr = $row(cols[j]).text().trim().replace(/,/g, "").replace(/%$/, "");
      const valNum = parseFloat(valStr);
      rowData[headerName] = isNaN(valNum) ? valStr : valNum;
    }
    rows.push(rowData);
  });
  return rows;
}

function parseScreenerTable($: cheerio.CheerioAPI, sectionId: string): any[] {
  const section = $(`section#${sectionId}`);
  if (section.length === 0) return [];
  const table = section.find("table").first();
  return parseTableElement(table);
}

function parseShareholdingTables($: cheerio.CheerioAPI) {
  const section = $("section#shareholding");
  if (section.length === 0) return { quarterly: [], yearly: [] };
  const tables = section.find("table");
  const quarterly = tables.length > 0 ? parseTableElement(tables.eq(0)) : [];
  const yearly = tables.length > 1 ? parseTableElement(tables.eq(1)) : [];
  return { quarterly, yearly };
}

function parseScreenerHtml(html: string) {
  const $ = cheerio.load(html);

  // Parse Ratios from top-ratios list
  const ratios: Record<string, any> = {};
  $("#top-ratios li").each((_, el) => {
    const name = $(el).find(".name").text().trim().replace(/:$/, "");
    const valText = $(el).find(".number").text().trim().replace(/,/g, "");
    const valNum = parseFloat(valText);
    ratios[name] = isNaN(valNum) ? valText : valNum;
  });

  const sh = parseShareholdingTables($);

  return {
    ratios,
    tenYearPL: parseScreenerTable($, "profit-loss"),
    tenYearBS: parseScreenerTable($, "balance-sheet"),
    quarterlyResults: parseScreenerTable($, "quarters"),
    cashFlow: parseScreenerTable($, "cash-flow"),
    shareholding: sh.quarterly,
    shareholdingYearly: sh.yearly,
    scraped_at: new Date().toISOString(),
  };
}

function isScreenerDataValid(data: any): boolean {
  if (!data) return false;
  const qRows = data.quarterlyResults || [];
  if (qRows.length === 0) return false;
  // Verify that the table has at least 2 columns besides metric
  const cols = Object.keys(qRows[0] || {}).filter(
    (k) => k !== "metric" && k !== "scraped_at" && k !== "id"
  );
  if (cols.length < 2) return false;

  // Check that at least some ratio has a non-empty value
  const hasRatios = Object.values(data.ratios || {}).some(
    (v) => v !== "" && v !== null && v !== undefined
  );
  return hasRatios || cols.length >= 2;
}

export async function scrapeFinancials(symbol: string): Promise<any> {
  const cleanSymbol = symbol.replace(/\.(NS|BO|NSE|BSE)$/i, "").toUpperCase();
  const cacheKey = cleanSymbol;

  // 1. Check L1 RAM Cache (0ms)
  const l1 = screenerL1Cache.get(cacheKey);
  if (l1 && Date.now() - l1.ts < SCREENER_CACHE_TTL && isScreenerDataValid(l1.data)) {
    return l1.data;
  }

  // 2. Single-Flight Inflight Deduplication
  const existingInflight = screenerInflight.get(cacheKey);
  if (existingInflight) {
    return existingInflight;
  }

  const fetchJob = (async () => {
    // 3. Check database cache
    try {
      const [cached] = await db
        .select()
        .from(screenerCache)
        .where(eq(screenerCache.symbol, cacheKey));

      if (cached && cached.scrapedAt) {
        const cacheAgeMs = Date.now() - new Date(cached.scrapedAt).getTime();
        if (cacheAgeMs < SCREENER_CACHE_TTL && isScreenerDataValid(cached.data)) {
          screenerL1Cache.set(cacheKey, { data: cached.data, ts: Date.now() });
          return cached.data;
        }
      }
    } catch (dbError: any) {
      console.warn("[Screener.in DB Cache Query Error]:", dbError.message);
    }

    // 4. Rate-limited execution via Mutex Queue
    return await runWithScreenerMutex(async () => {
      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      };

      let parsedData: any = null;

      // Try consolidated first
      const consUrl = `https://www.screener.in/company/${cleanSymbol}/consolidated/`;
      try {
        console.log(`[Screener.in Scraper] Fetching data from: ${consUrl}`);
        const response = await axios.get(consUrl, { headers, timeout: 10000 });
        const candidate = parseScreenerHtml(response.data);
        if (isScreenerDataValid(candidate)) {
          parsedData = candidate;
        } else {
          console.log(`[Screener.in] Consolidated data for ${cleanSymbol} is incomplete, trying standalone...`);
        }
      } catch (err: any) {
        console.warn(`[Screener.in] Consolidated fetch failed for ${cleanSymbol}: ${err.message}`);
      }

      // If consolidated is empty or failed, fetch standalone page
      if (!parsedData) {
        const standUrl = `https://www.screener.in/company/${cleanSymbol}/`;
        try {
          console.log(`[Screener.in Scraper] Fetching standalone data from: ${standUrl}`);
          const response = await axios.get(standUrl, { headers, timeout: 10000 });
          const candidate = parseScreenerHtml(response.data);
          if (isScreenerDataValid(candidate)) {
            parsedData = candidate;
          }
        } catch (err: any) {
          console.error(`[Screener.in] Standalone fetch failed for ${cleanSymbol}: ${err.message}`);
        }
      }

      if (!parsedData) {
        return null;
      }

      // Store in L1 RAM cache
      screenerL1Cache.set(cacheKey, { data: parsedData, ts: Date.now() });

      // Cache to database if valid
      try {
        await db
          .insert(screenerCache)
          .values({
            symbol: cacheKey,
            data: parsedData,
            scrapedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: screenerCache.symbol,
            set: {
              data: parsedData,
              scrapedAt: new Date(),
            },
          });
      } catch (saveError: any) {
        // Ignore DB errors in RAM mode
      }

      return parsedData;
    });
  })();

  screenerInflight.set(cacheKey, fetchJob);
  try {
    return await fetchJob;
  } finally {
    screenerInflight.delete(cacheKey);
  }
}
