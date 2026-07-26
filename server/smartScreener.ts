/**
 * Smart NLP Screener — Plain English → Structured Filters → Stock Results
 *
 * "IT stocks under ₹500 with rising profits" → JSON filters → filtered results
 */
import axios from "axios";
import {
  getYahooStockQuote,
  getStockQuotes,
  getFmpFundamentals,
  type StockQuote,
} from "./stockApi";
import { calculateStockIQ, type StockIQResult } from "./stockiq";
import { generateWithRetry } from "./gemini";

const MODEL = "gemini-flash-latest";

/* ═══ Types ═══ */
export interface ScreenerFilters {
  sectors?: string[];
  minPrice?: number;
  maxPrice?: number;
  minMarketCap?: string; // "small" | "mid" | "large"
  maxPE?: number;
  minROE?: number;
  minDividendYield?: number;
  maxDebtToEquity?: number;
  near52WeekHigh?: boolean;
  near52WeekLow?: boolean;
  momentum?: "bullish" | "bearish" | "any";
  sortBy?: string;
  limit?: number;
  rawQuery: string;
}

export interface ScreenerResult {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap?: number;
  pe?: number | null;
  roe?: number | null;
  debtToEquity?: number | null;
  stockiqScore?: number;
  stockiqGrade?: string;
  matchReason: string;
}

/* ═══ Stock Universe for Screening ═══ */
const SCREENER_UNIVERSE: { symbol: string; sector: string }[] = [
  // IT
  { symbol: "TCS", sector: "IT" }, { symbol: "INFY", sector: "IT" }, { symbol: "WIPRO", sector: "IT" },
  { symbol: "HCLTECH", sector: "IT" }, { symbol: "TECHM", sector: "IT" }, { symbol: "LTIM", sector: "IT" },
  { symbol: "MPHASIS", sector: "IT" }, { symbol: "COFORGE", sector: "IT" },
  // Banking
  { symbol: "HDFCBANK", sector: "Banking" }, { symbol: "ICICIBANK", sector: "Banking" },
  { symbol: "SBIN", sector: "Banking" }, { symbol: "KOTAKBANK", sector: "Banking" },
  { symbol: "AXISBANK", sector: "Banking" }, { symbol: "INDUSINDBK", sector: "Banking" },
  { symbol: "BANDHANBNK", sector: "Banking" }, { symbol: "FEDERALBNK", sector: "Banking" },
  // Pharma
  { symbol: "SUNPHARMA", sector: "Pharma" }, { symbol: "CIPLA", sector: "Pharma" },
  { symbol: "DRREDDY", sector: "Pharma" }, { symbol: "DIVISLAB", sector: "Pharma" },
  { symbol: "AUROPHARMA", sector: "Pharma" }, { symbol: "BIOCON", sector: "Pharma" },
  // Auto
  { symbol: "TATAMOTORS", sector: "Auto" }, { symbol: "MARUTI", sector: "Auto" },
  { symbol: "M&M", sector: "Auto" }, { symbol: "BAJAJ-AUTO", sector: "Auto" },
  { symbol: "HEROMOTOCO", sector: "Auto" }, { symbol: "EICHERMOT", sector: "Auto" },
  // FMCG
  { symbol: "HINDUNILVR", sector: "FMCG" }, { symbol: "ITC", sector: "FMCG" },
  { symbol: "NESTLEIND", sector: "FMCG" }, { symbol: "BRITANNIA", sector: "FMCG" },
  { symbol: "DABUR", sector: "FMCG" }, { symbol: "MARICO", sector: "FMCG" },
  // Energy
  { symbol: "RELIANCE", sector: "Energy" }, { symbol: "NTPC", sector: "Energy" },
  { symbol: "POWERGRID", sector: "Energy" }, { symbol: "ONGC", sector: "Energy" },
  { symbol: "BPCL", sector: "Energy" }, { symbol: "IOC", sector: "Energy" },
  // Metals
  { symbol: "TATASTEEL", sector: "Metals" }, { symbol: "JSWSTEEL", sector: "Metals" },
  { symbol: "HINDALCO", sector: "Metals" }, { symbol: "VEDL", sector: "Metals" },
  // Infrastructure
  { symbol: "LT", sector: "Infrastructure" }, { symbol: "ADANIENT", sector: "Infrastructure" },
  { symbol: "ADANIPORTS", sector: "Infrastructure" },
  // Finance
  { symbol: "BAJFINANCE", sector: "Finance" }, { symbol: "BAJAJFINSV", sector: "Finance" },
  { symbol: "SBILIFE", sector: "Finance" }, { symbol: "HDFCLIFE", sector: "Finance" },
  // Others
  { symbol: "TITAN", sector: "Consumer" }, { symbol: "ASIANPAINT", sector: "Consumer" },
  { symbol: "ULTRACEMCO", sector: "Cement" }, { symbol: "GRASIM", sector: "Cement" },
  { symbol: "BHARTIARTL", sector: "Telecom" }, { symbol: "ZOMATO", sector: "Internet" },
];

/* ═══ NLP → Structured Filters via Gemini ═══ */
export async function parseScreenerQuery(query: string): Promise<ScreenerFilters> {
  const systemPrompt = `You are a stock screener query parser for Indian NSE/BSE markets.
Convert the user's natural language query into a structured JSON filter.

Available sectors: IT, Banking, Pharma, Auto, FMCG, Energy, Metals, Infrastructure, Finance, Consumer, Cement, Telecom, Internet

Return ONLY valid JSON (no markdown, no explanation):
{
  "sectors": ["sector1", "sector2"],   // or empty [] for all sectors
  "minPrice": null,                     // minimum stock price in INR
  "maxPrice": null,                     // maximum stock price in INR  
  "minMarketCap": null,                // "small" | "mid" | "large" | null
  "maxPE": null,                       // max P/E ratio
  "minROE": null,                      // min ROE percentage (e.g., 15 for 15%)
  "minDividendYield": null,            // min dividend yield percentage
  "maxDebtToEquity": null,             // max debt-to-equity ratio
  "near52WeekHigh": false,             // stocks near 52-week high
  "near52WeekLow": false,              // stocks near 52-week low
  "momentum": "any",                   // "bullish" | "bearish" | "any"
  "sortBy": "stockiqScore",            // "stockiqScore" | "price" | "change" | "marketCap"
  "limit": 20                          // max results
}

Interpret common phrases:
- "under ₹500" → maxPrice: 500
- "rising profits" / "growing" → minROE: 10, momentum: "bullish"
- "low debt" → maxDebtToEquity: 0.5
- "high dividend" → minDividendYield: 2
- "undervalued" / "cheap" → maxPE: 20
- "blue chip" / "large cap" → minMarketCap: "large"
- "small cap" → minMarketCap: "small"
- "near highs" / "52 week high" → near52WeekHigh: true`;

  try {
    const response = await generateWithRetry({
      model: MODEL,
      contents: query,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    });

    const text = response?.text || "{}";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in Gemini response");

    const parsed = JSON.parse(match[0]);
    return { ...parsed, rawQuery: query };
  } catch (err) {
    console.error("Smart screener parse error:", err);
    // Fallback: return broad filter
    return { rawQuery: query, limit: 20 };
  }
}

/* ═══ Execute Screener ═══ */
export async function executeScreener(filters: ScreenerFilters): Promise<ScreenerResult[]> {
  // 1. Filter universe by sector
  let candidates = [...SCREENER_UNIVERSE];
  if (filters.sectors && filters.sectors.length > 0) {
    const sectorLower = filters.sectors.map((s) => s.toLowerCase());
    candidates = candidates.filter((c) => sectorLower.includes(c.sector.toLowerCase()));
  }

  // Limit candidates
  const limit = Math.min(filters.limit || 20, 50);
  if (candidates.length > limit * 2) {
    candidates = candidates.slice(0, limit * 2); // fetch extra in case some fail filters
  }

  // 2. Fetch quotes + fundamentals in parallel
  const results: ScreenerResult[] = [];
  const batchSize = 5;

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);

    const batchResults = await Promise.allSettled(
      batch.map(async (stock) => {
        const yahooSym = `${stock.symbol}.NS`;
        const [quoteRes, fundRes] = await Promise.allSettled([
          getStockQuotes([yahooSym]),
          getFmpFundamentals(stock.symbol),
        ]);

        const quote = quoteRes.status === "fulfilled" ? quoteRes.value[0] : null;
        const fund = fundRes.status === "fulfilled" ? fundRes.value : null;
        if (!quote) return null;

        // Apply filters
        const price = quote.price;
        if (filters.minPrice && price < filters.minPrice) return null;
        if (filters.maxPrice && price > filters.maxPrice) return null;

        const pe = fund?.pe;
        if (filters.maxPE && pe != null && pe > filters.maxPE) return null;

        const roe = fund?.roe;
        if (filters.minROE && roe != null) {
          const roePercent = typeof roe === "number" && roe < 1 ? roe * 100 : roe;
          if (roePercent < filters.minROE) return null;
        }

        const de = fund?.debtToEquity;
        if (filters.maxDebtToEquity != null && de != null && de > filters.maxDebtToEquity) return null;

        // Get StockIQ score
        let stockiqScore = 0;
        let stockiqGrade = "—";
        try {
          const iq = await calculateStockIQ(stock.symbol);
          stockiqScore = iq.totalScore;
          stockiqGrade = iq.grade;
        } catch {}

        return {
          symbol: stock.symbol,
          name: quote.name || stock.symbol,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          marketCap: quote.marketCap,
          pe: pe ?? null,
          roe: roe ?? null,
          debtToEquity: de ?? null,
          stockiqScore,
          stockiqGrade,
          matchReason: `Matched: ${stock.sector} sector`,
        } as ScreenerResult;
      })
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value) {
        results.push(r.value);
      }
    }

    // Delay between batches
    if (i + batchSize < candidates.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // Sort
  if (filters.sortBy === "price") results.sort((a, b) => b.price - a.price);
  else if (filters.sortBy === "change") results.sort((a, b) => b.changePercent - a.changePercent);
  else results.sort((a, b) => (b.stockiqScore || 0) - (a.stockiqScore || 0));

  return results.slice(0, limit);
}

/* ═══ Suggested Queries ═══ */
export function getSuggestedQueries(): string[] {
  return [
    "IT stocks under ₹2000 with high ROE",
    "Banking stocks with low debt",
    "Pharma companies with rising momentum",
    "Large cap stocks with high dividends",
    "Undervalued FMCG stocks",
    "Auto stocks near 52-week high",
    "Small cap stocks with strong fundamentals",
    "Energy stocks with low P/E ratio",
  ];
}
