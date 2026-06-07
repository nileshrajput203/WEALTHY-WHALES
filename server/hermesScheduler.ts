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
import { db } from "./db";
import { hermesSnapshots } from "@shared/schema";
import { sql } from "drizzle-orm";

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
    } catch (e) {
      console.error("[HERMES Scheduler] Catch-up scan on startup error:", e);
    } finally {
      status.isRunning = false;
    }
  }, 15 * 1000);

  /**
   * Daily Scan Check — runs every 30 minutes, executes scan at ~6:30 PM IST
   */
  scanInterval = setInterval(async () => {
    const ist = getISTDate();
    const hour = ist.getHours();
    const dayKey = ist.toISOString().slice(0, 10); // YYYY-MM-DD

    // Only scan on weekdays, after 6:15 PM IST
    if (!isWeekday(ist)) return;
    if (hour < 18) return; 

    // Check if daily scan already exists in DB (survives server restarts)
    const scanned = await hasScannedToday(dayKey);
    if (scanned) return;

    if (status.isRunning) return;

    console.log(`[HERMES Scheduler] Triggering daily scan for ${dayKey} (db-verified)`);
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
  }, 30 * 60 * 1000); // Check every 30 minutes

  /**
   * Outcome Tracker — runs every 4 hours
   */
  outcomeInterval = setInterval(async () => {
    try {
      await runOutcomeTracker();
      status.lastOutcomeAt = new Date().toISOString();
    } catch (e) {
      console.error("[HERMES Scheduler] Outcome tracker error:", e);
    }
  }, 4 * 60 * 60 * 1000); // Every 4 hours

  /**
   * Learning Cycle — runs every 24 hours (daily)
   */
  learningInterval = setInterval(async () => {
    try {
      const result = await runLearningCycle();
      status.lastLearningAt = new Date().toISOString();
      status.lastLearningResult = result;
    } catch (e) {
      console.error("[HERMES Scheduler] Learning cycle error:", e);
    }
  }, 24 * 60 * 60 * 1000); // Check daily

  // Compute next scheduled scan time
  const now = getISTDate();
  const nextScan = new Date(now);
  nextScan.setHours(18, 30, 0, 0);
  if (now > nextScan) {
    nextScan.setDate(nextScan.getDate() + 1);
  }
  // Skip weekends
  while (!isWeekday(nextScan)) {
    nextScan.setDate(nextScan.getDate() + 1);
  }
  status.nextScheduledScan = nextScan.toISOString();

  console.log(`[HERMES Scheduler] ✅ Scheduler active. Next scan: ${status.nextScheduledScan}`);
}

export function stopHermesScheduler(): void {
  if (scanInterval) clearInterval(scanInterval);
  if (outcomeInterval) clearInterval(outcomeInterval);
  if (learningInterval) clearInterval(learningInterval);
  scanInterval = null;
  outcomeInterval = null;
  learningInterval = null;
  console.log("[HERMES Scheduler] Stopped.");
}
