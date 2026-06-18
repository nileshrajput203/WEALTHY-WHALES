import axios from "axios";
import { db } from "./db";
import { apexPredictions } from "@shared/schema";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { getNowIST } from "./istUtils";
import { markJobStart, markJobDone, markJobFailed, logError } from "./jobLedger";

/**
 * Fetches intraday 5-min candles from Yahoo and extracts 9:30 AM and 3:15 PM prices.
 */
export async function getIntradayPrices(symbol: string): Promise<{ openPrice: number; closePrice: number }> {
  const yahooSym = symbol.endsWith(".NS") ? symbol : `${symbol}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}`;
  
  const response = await axios.get(url, {
    params: {
      interval: "5m",
      range: "1d"
    },
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    },
    timeout: 8000
  });
  
  const result = response.data?.chart?.result?.[0];
  if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
    throw new Error(`No 5-minute chart data available for ${symbol}`);
  }
  
  const timestamps = result.timestamp as number[];
  const closes = result.indicators.quote[0].close as (number | null)[];
  
  let openPrice = 0;
  let closePrice = 0;
  
  let bestOpenDiff = Infinity;
  let bestCloseDiff = Infinity;
  
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const price = closes[i];
    if (price === null || isNaN(price) || !Number.isFinite(price)) continue;
    
    const date = new Date(ts * 1000);
    const utcHours = date.getUTCHours();
    const utcMinutes = date.getUTCMinutes();
    
    // Convert UTC to IST components (UTC+5:30)
    let istHours = utcHours + 5;
    let istMinutes = utcMinutes + 30;
    if (istMinutes >= 60) {
      istHours += 1;
      istMinutes -= 60;
    }
    istHours = istHours % 24;
    
    const istTotalMinutes = istHours * 60 + istMinutes;
    
    const targetOpenMinutes = 9 * 60 + 30; // 9:30 AM
    const targetCloseMinutes = 15 * 60 + 15; // 3:15 PM
    
    const openDiff = Math.abs(istTotalMinutes - targetOpenMinutes);
    const closeDiff = Math.abs(istTotalMinutes - targetCloseMinutes);
    
    // Match open within market pre-noon slot (9:15 to 11:59)
    if (istHours >= 9 && istHours < 12) {
      if (openDiff < bestOpenDiff) {
        bestOpenDiff = openDiff;
        openPrice = price;
      }
    }
    
    // Match close within market afternoon slot (14:30 to 15:30)
    if (istHours >= 14 && istHours <= 15) {
      if (closeDiff < bestCloseDiff) {
        bestCloseDiff = closeDiff;
        closePrice = price;
      }
    }
  }
  
  // Fallbacks if target ranges are empty (take first and last valid price)
  if (openPrice === 0) {
    const validCloses = closes.filter((c): c is number => c !== null && Number.isFinite(c));
    if (validCloses.length > 0) openPrice = validCloses[0];
  }
  if (closePrice === 0) {
    const validCloses = closes.filter((c): c is number => c !== null && Number.isFinite(c));
    if (validCloses.length > 0) closePrice = validCloses[validCloses.length - 1];
  }
  
  if (openPrice === 0 || closePrice === 0) {
    throw new Error(`Failed to resolve 9:30 AM and 3:15 PM prices for ${symbol}`);
  }
  
  return { openPrice, closePrice };
}

/**
 * Fills prediction outcomes for the current day. Run at 4:00 PM IST.
 */
export async function fillTodayOutcomes(): Promise<void> {
  const startTime = Date.now();
  await markJobStart("fill_outcomes");
  
  try {
    const now = getNowIST();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    
    const pending = await db.select()
      .from(apexPredictions)
      .where(
        and(
          gte(apexPredictions.predictionDate, startOfDay),
          isNull(apexPredictions.isCorrect)
        )
      );
      
    if (pending.length === 0) {
      console.log("[OutcomeTracker] No pending predictions to fill today.");
      const duration = Date.now() - startTime;
      await markJobDone("fill_outcomes", duration);
      return;
    }
    
    console.log(`[OutcomeTracker] Found ${pending.length} pending predictions to track.`);
    
    let processed = 0;
    for (const pred of pending) {
      try {
        const { openPrice, closePrice } = await getIntradayPrices(pred.symbol);
        const actualReturnPct = ((closePrice - openPrice) / openPrice) * 100;
        const actualDirection = actualReturnPct >= 0 ? "UP" : "DOWN";
        const isCorrect = pred.direction === actualDirection;
        
        await db.update(apexPredictions)
          .set({
            openPrice: String(openPrice),
            closePrice: String(closePrice),
            actualReturnPct: String(actualReturnPct),
            actualDirection,
            isCorrect,
            filledAt: now
          })
          .where(eq(apexPredictions.id, pred.id));
          
        processed++;
      } catch (err: any) {
        console.error(`[OutcomeTracker] Failed to fill outcome for ${pred.symbol}:`, err.message);
        await logError("fill_outcomes", err, pred.symbol);
      }
    }
    
    console.log(`[OutcomeTracker] Successfully processed outcomes for ${processed}/${pending.length} predictions.`);
    
    const duration = Date.now() - startTime;
    await markJobDone("fill_outcomes", duration);
  } catch (error: any) {
    console.error(`[OutcomeTracker] Job failed:`, error);
    await markJobFailed("fill_outcomes", error);
  }
}

/**
 * Returns composite accuracy statistics for a date.
 */
export async function getTodayAccuracy(date: Date = getNowIST()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  
  const results = await db.select()
    .from(apexPredictions)
    .where(
      and(
        gte(apexPredictions.predictionDate, start),
        lte(apexPredictions.predictionDate, end)
      )
    );
    
  const filled = results.filter(r => r.isCorrect !== null);
  if (filled.length === 0) return { total: 0, correct: 0, accuracy: 0.0 };
  
  const correct = filled.filter(r => r.isCorrect === true).length;
  return {
    total: filled.length,
    correct,
    accuracy: (correct / filled.length) * 100
  };
}
