/**
 * FUGU SCORE — Background Scheduler
 *
 * Schedules:
 *   - Daily scanner candidate gathering & ranking: 6:45 PM IST
 *   - Outcome tracker: Every 4 hours
 *   - Learning cycle & Weight optimizer: Daily (every 24 hours)
 *
 * Skips weekends. All times in IST (UTC+5:30).
 */

import {
  runFuguPipeline,
  runFuguOutcomeTracker,
  runFuguLearningCycle,
  initializeFugu,
} from "./fuguEngine";
import { db } from "./db";
import { fuguSnapshots } from "@shared/schema";
import { sql } from "drizzle-orm";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getISTDate(): Date {
  const now = new Date();
  return new Date(now.getTime() + IST_OFFSET_MS + now.getTimezoneOffset() * 60 * 1000);
}

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6; // 0 = Sunday, 6 = Saturday
}

interface FuguStatus {
  lastScanAt: string | null;
  lastScanResult: { scanned: number; processed: number; eliteCount: number; errors: number } | null;
  lastOutcomeAt: string | null;
  lastLearningAt: string | null;
  lastLearningResult: { insightsAdded: number; weightsOptimized: boolean } | null;
  nextScheduledScan: string | null;
  isRunning: boolean;
}

let status: FuguStatus = {
  lastScanAt: null,
  lastScanResult: null,
  lastOutcomeAt: null,
  lastLearningAt: null,
  lastLearningResult: null,
  nextScheduledScan: null,
  isRunning: false,
};

export function getFuguStatus(): FuguStatus {
  return { ...status };
}

/* ═══ Manual Trigger Helpers ═══ */

export async function triggerManualFuguScan(limitSize = 1000): Promise<typeof status.lastScanResult> {
  if (status.isRunning) {
    console.log("[FUGU Scheduler] A scan is already running.");
    return null;
  }

  status.isRunning = true;
  try {
    const result = await runFuguPipeline(limitSize);
    status.lastScanAt = new Date().toISOString();
    status.lastScanResult = result;
    return result;
  } catch (e) {
    console.error("[FUGU Scheduler] Manual scan failed:", e);
    return null;
  } finally {
    status.isRunning = false;
  }
}

export async function triggerManualFuguOutcome() {
  try {
    const result = await runFuguOutcomeTracker();
    status.lastOutcomeAt = new Date().toISOString();
    return result;
  } catch (e) {
    console.error("[FUGU Scheduler] Outcome tracker failed:", e);
    return null;
  }
}

export async function triggerManualFuguLearning() {
  try {
    const result = await runFuguLearningCycle();
    status.lastLearningAt = new Date().toISOString();
    status.lastLearningResult = result;
    return result;
  } catch (e) {
    console.error("[FUGU Scheduler] Learning cycle failed:", e);
    return null;
  }
}

/* ═══ Database Check Helper ═══ */
async function hasScannedToday(dayKey: string): Promise<boolean> {
  try {
    const todayScanExists = await db
      .select({ id: fuguSnapshots.id })
      .from(fuguSnapshots)
      .where(sql`DATE(${fuguSnapshots.scanDate}) = ${dayKey}`)
      .limit(1);
    return todayScanExists.length > 0;
  } catch (err) {
    console.error("[FUGU Scheduler] Error checking scan status in DB:", err);
    return false;
  }
}

/* ═══ Scheduled Execution ═══ */

let scanInterval: ReturnType<typeof setInterval> | null = null;
let outcomeInterval: ReturnType<typeof setInterval> | null = null;
let learningInterval: ReturnType<typeof setInterval> | null = null;

export function startFuguScheduler(): void {
  console.log("[FUGU Scheduler] Starting background scheduler...");

  // Seed default weights/stats on boot
  initializeFugu().catch((e) => console.error("[FUGU] Init failed:", e));

  // Catch-up scan check on startup (runs 20s after server boot)
  setTimeout(async () => {
    try {
      const ist = getISTDate();
      const hour = ist.getHours();
      const minute = ist.getMinutes();
      const dayKey = ist.toISOString().slice(0, 10);
      if (isWeekday(ist) && (hour > 18 || (hour === 18 && minute >= 45))) {
        const scanned = await hasScannedToday(dayKey);
        if (!scanned && !status.isRunning) {
          console.log(`[FUGU Scheduler] Catch-up scan triggered on startup for ${dayKey}`);
          status.isRunning = true;
          const result = await runFuguPipeline();
          status.lastScanAt = new Date().toISOString();
          status.lastScanResult = result;
        }
      }
    } catch (e) {
      console.error("[FUGU Scheduler] Catch-up scan on startup error:", e);
    } finally {
      status.isRunning = false;
    }
  }, 20 * 1000);

  /**
   * Daily Scan Check — runs every 30 minutes, executes scan at ~6:45 PM IST
   */
  scanInterval = setInterval(async () => {
    const ist = getISTDate();
    const hour = ist.getHours();
    const minute = ist.getMinutes();
    const dayKey = ist.toISOString().slice(0, 10); // YYYY-MM-DD

    // Only scan on weekdays, after 6:40 PM IST
    if (!isWeekday(ist)) return;
    if (hour < 18 || (hour === 18 && minute < 40)) return; 

    // Check database to see if we already scanned today
    const scanned = await hasScannedToday(dayKey);
    if (scanned) return;

    if (status.isRunning) return;

    console.log(`[FUGU Scheduler] Triggering daily self-learning scan for ${dayKey} (db-verified)`);
    status.isRunning = true;
    try {
      const result = await runFuguPipeline();
      status.lastScanAt = new Date().toISOString();
      status.lastScanResult = result;
    } catch (e) {
      console.error("[FUGU Scheduler] Daily scan error:", e);
    } finally {
      status.isRunning = false;
    }
  }, 30 * 60 * 1000); // Check every 30 minutes

  /**
   * Outcome Tracker — runs every 4 hours
   */
  outcomeInterval = setInterval(async () => {
    try {
      await runFuguOutcomeTracker();
      status.lastOutcomeAt = new Date().toISOString();
    } catch (e) {
      console.error("[FUGU Scheduler] Outcome tracker error:", e);
    }
  }, 4 * 60 * 60 * 1000); // Every 4 hours

  /**
   * Learning Cycle — runs every 24 hours (daily)
   */
  learningInterval = setInterval(async () => {
    try {
      const result = await runFuguLearningCycle();
      status.lastLearningAt = new Date().toISOString();
      status.lastLearningResult = result;
    } catch (e) {
      console.error("[FUGU Scheduler] Learning cycle error:", e);
    }
  }, 24 * 60 * 60 * 1000); // Check daily

  // Compute next scheduled scan time
  const now = getISTDate();
  const nextScan = new Date(now);
  nextScan.setHours(18, 45, 0, 0);
  if (now > nextScan) {
    nextScan.setDate(nextScan.getDate() + 1);
  }
  // Skip weekends
  while (!isWeekday(nextScan)) {
    nextScan.setDate(nextScan.getDate() + 1);
  }
  status.nextScheduledScan = nextScan.toISOString();

  console.log(`[FUGU Scheduler] ✅ Scheduler active. Next scan: ${status.nextScheduledScan}`);
}

export function stopFuguScheduler(): void {
  if (scanInterval) clearInterval(scanInterval);
  if (outcomeInterval) clearInterval(outcomeInterval);
  if (learningInterval) clearInterval(learningInterval);
  scanInterval = null;
  outcomeInterval = null;
  learningInterval = null;
  console.log("[FUGU Scheduler] Stopped.");
}
