/**
 * HERMES AI — Background Scheduler
 *
 * Schedules:
 *   - Daily scan: 6:30 PM IST (after market close)
 *   - Outcome tracker: Every 4 hours
 *   - Learning cycle: Daily (every 24 hours)
 *   - Regime classification: Daily with scan
 *
 * Skips weekends. All times in IST (UTC+5:30).
 */

import {
  runDailyScan,
  runOutcomeTracker,
  runLearningCycle,
  classifyMarketRegime,
  initializeHermes,
} from "./hermesEngine";
import { runSwingLearningCycle } from "./swingGenomeEngine";
import { runIpoLearningCycle } from "./ipoGenomeEngine";
import { db } from "./db";
import { hermesSnapshots } from "@shared/schema";
import { sql } from "drizzle-orm";
import { shouldRunJob } from "./jobLedger";

/* ═══ IST Time Helpers ═══ */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getISTDate(): Date {
  const now = new Date();
  return new Date(now.getTime() + IST_OFFSET_MS + now.getTimezoneOffset() * 60 * 1000);
}

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6; // 0 = Sunday, 6 = Saturday
}

/* ═══ Status Tracking ═══ */
interface HermesStatus {
  lastScanAt: string | null;
  lastScanResult: { scanned: number; inserted: number; errors: number; duration: string } | null;
  lastOutcomeAt: string | null;
  lastLearningAt: string | null;
  lastLearningResult: { newVersion: number; accuracy: number; sampleSize: number } | null;
  nextScheduledScan: string | null;
  isRunning: boolean;
}

let status: HermesStatus = {
  lastScanAt: null,
  lastScanResult: null,
  lastOutcomeAt: null,
  lastLearningAt: null,
  lastLearningResult: null,
  nextScheduledScan: null,
  isRunning: false,
};

export function getHermesStatus(): HermesStatus {
  return { ...status };
}

/* ═══ Manual Trigger Helpers ═══ */
export async function triggerManualScan(universeSize?: number) {
  if (status.isRunning) return null;
  status.isRunning = true;
  try {
    await classifyMarketRegime();
    const result = await runDailyScan(universeSize);
    status.lastScanAt = new Date().toISOString();
    status.lastScanResult = result;
    return result;
  } catch (e) {
    console.error("[HERMES Scheduler] Manual scan failed:", e);
    return null;
  } finally {
    status.isRunning = false;
  }
}

export async function triggerOutcomeTracker() {
  try {
    const result = await runOutcomeTracker();
    status.lastOutcomeAt = new Date().toISOString();
    return result;
  } catch (e) {
    console.error("[HERMES Scheduler] Outcome tracker failed:", e);
    return null;
  }
}

export async function triggerLearningCycle() {
  try {
    const result = await runLearningCycle();
    status.lastLearningAt = new Date().toISOString();
    status.lastLearningResult = result;
    return result;
  } catch (e) {
    console.error("[HERMES Scheduler] Learning cycle failed:", e);
    return null;
  }
}

/* ═══ Database Check Helper ═══ */
async function hasScannedToday(dayKey: string): Promise<boolean> {
  try {
    const todayScanExists = await db
      .select({ id: hermesSnapshots.id })
      .from(hermesSnapshots)
      .where(sql`DATE(${hermesSnapshots.scanDate}) = ${dayKey}`)
      .limit(1);
    return todayScanExists.length > 0;
  } catch (err) {
    console.error("[HERMES Scheduler] Error checking scan status in DB:", err);
    return false;
  }
}

/* ═══ Scheduled Execution ═══ */

let scanInterval: ReturnType<typeof setInterval> | null = null;
let outcomeInterval: ReturnType<typeof setInterval> | null = null;
let learningInterval: ReturnType<typeof setInterval> | null = null;

export function startHermesScheduler(): void {
  console.log("[HERMES Scheduler] Starting background scheduler...");

  // Initialize default weights on startup
  initializeHermes().catch((e) => console.error("[HERMES] Init failed:", e));

  // Catch-up scan check on startup (runs 15s after server boot)
  setTimeout(async () => {
    try {
      const ist = getISTDate();
      const hour = ist.getHours();
      const dayKey = ist.toISOString().slice(0, 10);
      if (isWeekday(ist) && hour >= 18) {
        const scanned = await hasScannedToday(dayKey);
        if (!scanned && !status.isRunning) {
          console.log(`[HERMES Scheduler] Catch-up scan triggered on startup for ${dayKey}`);
          status.isRunning = true;
          await classifyMarketRegime();
          const result = await runDailyScan();
          status.lastScanAt = new Date().toISOString();
          status.lastScanResult = result;
        }
      }

      // Catch up on missed outcomes and learning if they missed their intervals
      if (await shouldRunJob("hermes_outcome_tracker", 240)) {
        await runOutcomeTracker();
      }
      if (await shouldRunJob("hermes_learning_cycle", 1440)) {
        await runLearningCycle();
      }

    } catch (e) {
      console.error("[HERMES Scheduler] Catch-up scan on startup error:", e);
    } finally {
      status.isRunning = false;
    }
  }, 15 * 1000);

  /**
   * Main persistent scheduler daemon. Checks job intervals every 60 seconds.
   */
  scanInterval = setInterval(async () => {
    try {
      const ist = getISTDate();
      const hour = ist.getHours();
      const minute = ist.getMinutes();

      // 1. Daily Scan Check: ~6:30 PM IST (18:30)
      if (isWeekday(ist) && hour === 18 && minute === 30) {
        if (await shouldRunJob("hermes_daily_scan", 60)) {
          if (!status.isRunning) {
            status.isRunning = true;
            try {
              await classifyMarketRegime();
              const result = await runDailyScan();
              status.lastScanAt = new Date().toISOString();
              status.lastScanResult = result;
            } catch (e) {
              console.error("[HERMES Scheduler] Daily scan error:", e);
            } finally {
              status.isRunning = false;
            }
          }
        }
      }

      // 2. Outcome Tracker: Every 4 hours (240 mins)
      if (await shouldRunJob("hermes_outcome_tracker", 240)) {
        try {
          await runOutcomeTracker();
          status.lastOutcomeAt = new Date().toISOString();
        } catch (e) {
          console.error("[HERMES Scheduler] Outcome tracker error:", e);
        }
      }

      // 3. Learning Cycle: Daily (1440 mins)
      if (await shouldRunJob("hermes_learning_cycle", 1440)) {
        try {
          const result = await runLearningCycle();
          status.lastLearningAt = new Date().toISOString();
          status.lastLearningResult = result;
        } catch (e) {
          console.error("[HERMES Scheduler] Learning cycle error:", e);
        }
      }

      // 4. Swing Genome Evolution: 7:00 PM IST (19:00), every 12 hours
      if (isWeekday(ist) && hour === 19 && minute === 0) {
        if (await shouldRunJob("swing_genome_evolution", 720)) {
          try {
            console.log("[HERMES Scheduler] Running Swing genome evolution...");
            await runSwingLearningCycle();
            console.log("[HERMES Scheduler] ✅ Swing genome evolution complete.");
          } catch (e) {
            console.error("[HERMES Scheduler] Swing genome evolution error:", e);
          }
        }
      }

      // 5. IPO Genome Evolution: 7:15 PM IST (19:15), every 12 hours
      if (isWeekday(ist) && hour === 19 && minute === 15) {
        if (await shouldRunJob("ipo_genome_evolution", 720)) {
          try {
            console.log("[HERMES Scheduler] Running IPO genome evolution...");
            await runIpoLearningCycle();
            console.log("[HERMES Scheduler] ✅ IPO genome evolution complete.");
          } catch (e) {
            console.error("[HERMES Scheduler] IPO genome evolution error:", e);
          }
        }
      }

    } catch (e) {
      console.error("[HERMES Scheduler] Polling error:", e);
    }
  }, 60000); // Check every 60 seconds

  // Compute next scheduled scan time for UI
  const now = getISTDate();
  const nextScan = new Date(now);
  nextScan.setHours(18, 30, 0, 0);
  if (now > nextScan) {
    nextScan.setDate(nextScan.getDate() + 1);
  }
  while (!isWeekday(nextScan)) {
    nextScan.setDate(nextScan.getDate() + 1);
  }
  status.nextScheduledScan = nextScan.toISOString();

  console.log(`[HERMES Scheduler] ✅ Persistent Scheduler active. Next scan: ${status.nextScheduledScan}`);
}

export function stopHermesScheduler(): void {
  if (scanInterval) clearInterval(scanInterval);
  scanInterval = null;
  console.log("[HERMES Scheduler] Stopped.");
}
