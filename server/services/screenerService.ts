import axios from "axios";
import * as cheerio from "cheerio";
import { db } from "../db";
import { screenerCache } from "@shared/schema";
import { eq } from "drizzle-orm";

let lastRequestTime = 0;

async function enforceRateLimit() {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < 3000) {
    const delay = 3000 - timeSinceLast;
    console.log(`[Screener.in Rate Limiter] Delaying request by ${delay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  lastRequestTime = Date.now();
}

function parseScreenerTable($: cheerio.CheerioAPI, sectionId: string) {
  const section = $(`section#${sectionId}`);
  if (section.length === 0) return [];
  const table = section.find("table");
  if (table.length === 0) return [];

  const headers: string[] = [];
  table.find("thead tr th").each((_, th) => {
    headers.push($(th).text().trim());
  });

  // If thead is empty, try first row
  if (headers.length === 0) {
    table.find("tr").first().find("th, td").each((_, el) => {
      headers.push($(el).text().trim());
    });
  }

  const rows: any[] = [];
  table.find("tbody tr, tr").each((i, row) => {
    // Skip header row
    const firstCellText = $(row).find("th, td").first().text().trim();
    if ($(row).find("th").length > 0 && headers.includes(firstCellText)) {
      return;
    }
    const cols = $(row).find("td, th");
    if (cols.length === 0) return;

    const name = $(cols[0]).text().trim().replace(/\+$/, "").trim();
    if (!name || name.toLowerCase().includes("show") || name.toLowerCase().includes("source")) return;

    const rowData: Record<string, any> = { metric: name };
    for (let j = 1; j < cols.length; j++) {
      const headerName = headers[j] || `Col_${j}`;
      const valStr = $(cols[j]).text().trim().replace(/,/g, "");
      const valNum = parseFloat(valStr);
      rowData[headerName] = isNaN(valNum) ? valStr : valNum;
    }
    rows.push(rowData);
  });
  return rows;
}

export async function scrapeFinancials(symbol: string): Promise<any> {
  const cleanSymbol = symbol.replace(/\.(NS|BO|NSE|BSE)$/i, "").toUpperCase();
  const cacheKey = cleanSymbol;

  // 1. Check database cache
  try {
    const [cached] = await db
      .select()
      .from(screenerCache)
      .where(eq(screenerCache.symbol, cacheKey));

    if (cached && cached.scrapedAt) {
      const cacheAgeMs = Date.now() - new Date(cached.scrapedAt).getTime();
      const sixHoursMs = 6 * 60 * 60 * 1000;
      if (cacheAgeMs < sixHoursMs) {
        console.log(`[Screener.in Cache Hit] Using database cached financials for ${cleanSymbol}`);
        return cached.data;
      }
      console.log(`[Screener.in Cache Stale] Cached financials for ${cleanSymbol} expired`);
    }
  } catch (dbError: any) {
    console.error("[Screener.in DB Cache Query Error]:", dbError.message);
  }

  // 2. Rate limit and scrape
  await enforceRateLimit();

  const url = `https://www.screener.in/company/${cleanSymbol}/consolidated/`;
  console.log(`[Screener.in Scraper] Fetching data from: ${url}`);

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    // Parse Ratios from top-ratios list
    const ratios: Record<string, any> = {};
    $("#top-ratios li").each((_, el) => {
      const name = $(el).find(".name").text().trim().replace(/:$/, "");
      const valText = $(el).find(".number").text().trim().replace(/,/g, "");
      const valNum = parseFloat(valText);
      ratios[name] = isNaN(valNum) ? valText : valNum;
    });

    const parsedData = {
      ratios,
      tenYearPL: parseScreenerTable($, "profit-loss"),
      tenYearBS: parseScreenerTable($, "balance-sheet"),
      quarterlyResults: parseScreenerTable($, "quarters"),
      cashFlow: parseScreenerTable($, "cash-flow"),
      shareholding: parseScreenerTable($, "shareholding"),
      scraped_at: new Date().toISOString(),
    };

    // 3. Cache to database
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
      console.log(`[Screener.in Cache Saved] Financials stored in DB for ${cleanSymbol}`);
    } catch (saveError: any) {
      console.error("[Screener.in DB Cache Save Error]:", saveError.message);
    }

    return parsedData;
  } catch (error: any) {
    console.error(`[Screener.in Scraper Failed] ${cleanSymbol}:`, error.message);
    
    // If the consolidated URL fails, try standalone fallback (without /consolidated/)
    if (url.includes("/consolidated/")) {
      const fallbackUrl = `https://www.screener.in/company/${cleanSymbol}/`;
      console.log(`[Screener.in Fallback] Trying standalone page: ${fallbackUrl}`);
      try {
        const fallbackRes = await axios.get(fallbackUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          timeout: 10000,
        });
        const $ = cheerio.load(fallbackRes.data);
        const ratios: Record<string, any> = {};
        $("#top-ratios li").each((_, el) => {
          const name = $(el).find(".name").text().trim().replace(/:$/, "");
          const valText = $(el).find(".number").text().trim().replace(/,/g, "");
          const valNum = parseFloat(valText);
          ratios[name] = isNaN(valNum) ? valText : valNum;
        });

        const parsedData = {
          ratios,
          tenYearPL: parseScreenerTable($, "profit-loss"),
          tenYearBS: parseScreenerTable($, "balance-sheet"),
          quarterlyResults: parseScreenerTable($, "quarters"),
          cashFlow: parseScreenerTable($, "cash-flow"),
          shareholding: parseScreenerTable($, "shareholding"),
          scraped_at: new Date().toISOString(),
        };

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
        return parsedData;
      } catch (fallbackError: any) {
        console.error("[Screener.in Standalone Fallback Failed]:", fallbackError.message);
      }
    }

    return null;
  }
}
