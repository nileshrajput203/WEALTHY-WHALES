import { db } from "./db";
import { confluenceSignals, jobLedger } from "@shared/schema";
import { and, eq, gte, lte, desc, isNotNull } from "drizzle-orm";
import { getNowIST, getISTDateString } from "./istUtils";
import { markJobStart, markJobDone, markJobFailed } from "./jobLedger";
import { getIntradayPrices } from "./apexOutcomeTracker";

export interface ScalpPerformance {
  date: string;
  totalSignals: number;
  correctSignals: number;
  accuracy: number;
  avgReturn: number;
  maxReturn: number;
  minReturn: number;
}

/**
 * Monitors and evaluates the performance of the scalp engine.
 * Run daily at 4:15 PM IST.
 */
export async function runScalpMonitoringJob(): Promise<void> {
  const startTime = Date.now();
  await markJobStart("scalp_monitoring");

  try {
    const now = getNowIST();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    
    // Fetch signals generated today
    const signals = await db.select()
      .from(confluenceSignals)
      .where(
        and(
          gte(confluenceSignals.signalDate, startOfDay),
          isNotNull(confluenceSignals.confluenceScore)
        )
      );

    if (signals.length === 0) {
      console.log("[ScalpMonitor] No signals to monitor today.");
      await markJobDone("scalp_monitoring", Date.now() - startTime);
      return;
    }

    let correctCount = 0;
    let totalReturn = 0;
    let maxReturn = -Infinity;
    let minReturn = Infinity;
    let processedCount = 0;

    for (const signal of signals) {
      try {
        const { openPrice, closePrice } = await getIntradayPrices(signal.symbol);
        const actualReturnPct = ((closePrice - openPrice) / openPrice) * 100;
        
        // Determine if signal was correct based on recommendation
        const isBullish = signal.recommendation === 'STRONG_BUY' || signal.recommendation === 'BUY';
        const isCorrect = isBullish ? actualReturnPct > 0 : actualReturnPct < 0;
        
        if (isCorrect) correctCount++;
        
        const signalReturn = isBullish ? actualReturnPct : -actualReturnPct;
        totalReturn += signalReturn;
        maxReturn = Math.max(maxReturn, signalReturn);
        minReturn = Math.min(minReturn, signalReturn);
        processedCount++;

        // Update signal with outcome (using metadata if available or logging separately)
        // Note: For now we just calculate aggregate stats
      } catch (err) {
        console.error(`[ScalpMonitor] Error processing ${signal.symbol}:`, err);
      }
    }

    const accuracy = processedCount > 0 ? (correctCount / processedCount) * 100 : 0;
    const avgReturn = processedCount > 0 ? totalReturn / processedCount : 0;

    console.log(`[ScalpMonitor] Performance for ${getISTDateString(now)}:`);
    console.log(`- Total Signals: ${processedCount}`);
    console.log(`- Accuracy: ${accuracy.toFixed(2)}%`);
    console.log(`- Avg Return: ${avgReturn.toFixed(2)}%`);
    console.log(`- Max/Min: ${maxReturn.toFixed(2)}% / ${minReturn.toFixed(2)}%`);

    await markJobDone("scalp_monitoring", Date.now() - startTime);
  } catch (error: any) {
    console.error("[ScalpMonitor] Monitoring job failed:", error);
    await markJobFailed("scalp_monitoring", error);
  }
}

/**
 * Get historical performance summary
 */
export async function getScalpPerformanceHistory(days = 30): Promise<ScalpPerformance[]> {
  // Implementation to fetch from a performance log table if created
  // For now, this is a placeholder
  return [];
}
