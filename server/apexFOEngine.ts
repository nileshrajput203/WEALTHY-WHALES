import axios from "axios";
import { db } from "./db";
import { apexFoSignals } from "@shared/schema";
import { and, desc, eq, gte } from "drizzle-orm";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getNowIST } from "./istUtils";
import { markJobStart, markJobDone, markJobFailed, logError } from "./jobLedger";
import { getYahooStockQuote } from "./stockApi";
import { fetchNSEOptionChain } from "./services/nseService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load F&O stocks list dynamically
let FO_STOCKS: string[] = [];
try {
  const listPath = join(__dirname, "fo_stock_list.json");
  FO_STOCKS = JSON.parse(readFileSync(listPath, "utf8"));
} catch (err) {
  console.error("[FOEngine] Failed to load fo_stock_list.json:", err);
}

/**
 * Fetches option chain from NSE option chain worker and adapts keys.
 */
export async function fetchOptionChain(symbol: string): Promise<any> {
  const cleanSym = symbol.split(".")[0].toUpperCase();
  const nseData = await fetchNSEOptionChain(cleanSym);
  
  if (!nseData || !nseData.success) {
    throw new Error(`Failed to fetch NSE option chain for ${symbol}`);
  }
  
  const calls = (nseData.calls || []).map((c: any) => ({
    ...c,
    openInterest: c.oi,
  }));
  
  const puts = (nseData.puts || []).map((p: any) => ({
    ...p,
    openInterest: p.oi,
  }));
  
  const strikesSet = new Set<number>();
  calls.forEach((c: any) => strikesSet.add(c.strike));
  puts.forEach((p: any) => strikesSet.add(p.strike));
  const strikes = Array.from(strikesSet).sort((a, b) => a - b);
  
  return {
    quote: {
      regularMarketPrice: nseData.underlyingValue || 0,
    },
    calls,
    puts,
    strikes,
  };
}

/**
 * Computes Put-Call Ratio and total Open Interest.
 */
export function computePCR(calls: any[], puts: any[]): { pcr: number; callOi: number; putOi: number } {
  let callOi = 0;
  let putOi = 0;
  
  for (const c of calls) {
    callOi += c.openInterest || 0;
  }
  for (const p of puts) {
    putOi += p.openInterest || 0;
  }
  
  const pcr = callOi > 0 ? putOi / callOi : 1.0;
  return { pcr, callOi, putOi };
}

/**
 * Calculates Max Pain strike price.
 */
export function computeMaxPain(calls: any[], puts: any[], strikes: number[]): number {
  let minPain = Infinity;
  let maxPainStrike = strikes[0] || 0;
  
  for (const strike of strikes) {
    let totalPain = 0;
    
    // Call sellers pain
    for (const c of calls) {
      const cStrike = c.strike;
      const cOI = c.openInterest || 0;
      if (strike > cStrike) {
        totalPain += (strike - cStrike) * cOI;
      }
    }
    
    // Put sellers pain
    for (const p of puts) {
      const pStrike = p.strike;
      const pOI = p.openInterest || 0;
      if (strike < pStrike) {
        totalPain += (pStrike - strike) * pOI;
      }
    }
    
    if (totalPain < minPain) {
      minPain = totalPain;
      maxPainStrike = strike;
    }
  }
  
  return maxPainStrike;
}

/**
 * Calculates option Open Interest change direction.
 */
export function computeOIDirection(
  currentOI: number,
  prevOI: number | null,
  currentPrice: number,
  prevPrice: number | null
): string {
  if (prevOI === null || prevPrice === null || prevOI === 0 || prevPrice === 0) {
    return "NEUTRAL";
  }
  
  const priceIncrease = currentPrice > prevPrice;
  const oiIncrease = currentOI > prevOI;
  
  if (priceIncrease && oiIncrease) return "LONG_BUILDUP";
  if (!priceIncrease && oiIncrease) return "SHORT_BUILDUP";
  if (priceIncrease && !oiIncrease) return "SHORT_COVERING";
  if (!priceIncrease && !oiIncrease) return "LONG_UNWINDING";
  
  return "NEUTRAL";
}

/**
 * Computes composite signal and strength.
 */
export function computeFOSignal(
  pcr: number,
  oiDirection: string,
  maxPain: number,
  currentPrice: number
): { signal: string; strength: number } {
  let score = 50;
  
  if (pcr > 1.2) score += 15;
  else if (pcr > 1.0) score += 8;
  else if (pcr < 0.7) score -= 15;
  else if (pcr < 0.85) score -= 8;
  
  if (oiDirection === "LONG_BUILDUP") score += 20;
  else if (oiDirection === "SHORT_COVERING") score += 10;
  else if (oiDirection === "SHORT_BUILDUP") score -= 20;
  else if (oiDirection === "LONG_UNWINDING") score -= 10;
  
  const distancePct = (maxPain - currentPrice) / currentPrice;
  if (distancePct > 0.02) score += 10;
  else if (distancePct < -0.02) score -= 10;
  
  score = Math.max(0, Math.min(100, score));
  
  let signal = "NEUTRAL";
  if (score >= 60) signal = "BULLISH";
  else if (score <= 40) signal = "BEARISH";
  
  const strength = Math.abs(score - 50) * 2;
  
  return { signal, strength };
}

/**
 * Orchestrator job for F&O Options chains processing.
 */
export async function runFODataJob(): Promise<void> {
  const startTime = Date.now();
  await markJobStart("fo_data");
  
  try {
    const now = getNowIST();
    let processed = 0;
    
    const BATCH_SIZE = 5;
    for (let i = 0; i < FO_STOCKS.length; i += BATCH_SIZE) {
      const batch = FO_STOCKS.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (symbol) => {
        try {
          const chain = await fetchOptionChain(symbol);
          const currentPrice = chain.quote?.regularMarketPrice || 0;
          if (currentPrice === 0) return;
          
          const { pcr, callOi, putOi } = computePCR(chain.calls, chain.puts);
          const maxPain = computeMaxPain(chain.calls, chain.puts, chain.strikes);
          
          // Get previous signal
          const [prevSignal] = await db.select()
            .from(apexFoSignals)
            .where(eq(apexFoSignals.symbol, symbol))
            .orderBy(desc(apexFoSignals.signalDate))
            .limit(1);
            
          const currentTotalOI = callOi + putOi;
          const prevTotalOI = prevSignal ? parseFloat(prevSignal.callOi || "0") + parseFloat(prevSignal.putOi || "0") : null;
          const prevPrice = prevSignal ? (await getYahooStockQuote(symbol))?.price || null : null;
          
          const oiDirection = computeOIDirection(currentTotalOI, prevTotalOI, currentPrice, prevPrice);
          const { signal, strength } = computeFOSignal(pcr, oiDirection, maxPain, currentPrice);
          
          let oiChangePct = 0;
          if (prevTotalOI && prevTotalOI > 0) {
            oiChangePct = (currentTotalOI - prevTotalOI) / prevTotalOI;
          }
          
          await db.insert(apexFoSignals).values({
            signalDate: now,
            symbol,
            isFoStock: true,
            pcr: String(pcr),
            callOi: String(callOi),
            putOi: String(putOi),
            oiChangePct: String(oiChangePct),
            oiDirection,
            maxPain: String(maxPain),
            ivRank: "50.00",
            signal,
            signalStrength: String(strength),
          });
          
          processed++;
        } catch (err: any) {
          console.error(`[FOEngine] Failed for ${symbol}:`, err.message);
          await logError("fo_data", err, symbol);
        }
      }));
      
      console.log(`[FOEngine] Processed ${Math.min(i + BATCH_SIZE, FO_STOCKS.length)}/${FO_STOCKS.length} F&O stocks.`);
      if (i + BATCH_SIZE < FO_STOCKS.length) {
        await new Promise(res => setTimeout(res, 2000));
      }
    }
    
    const duration = Date.now() - startTime;
    await markJobDone("fo_data", duration);
  } catch (error: any) {
    console.error(`[FOEngine] Job failed:`, error);
    await markJobFailed("fo_data", error);
  }
}

/**
 * Retrieves the latest F&O option signal for a stock symbol.
 */
export async function getFOSignalForSymbol(symbol: string, date: Date = getNowIST()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  
  const [sig] = await db.select()
    .from(apexFoSignals)
    .where(
      and(
        eq(apexFoSignals.symbol, symbol),
        gte(apexFoSignals.signalDate, start)
      )
    )
    .orderBy(desc(apexFoSignals.signalDate))
    .limit(1);
    
  return sig || null;
}
