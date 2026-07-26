/**
 * SELF IMPROVING SCHEDULER — Meta-scheduler for Self-Improving Engines
 * ─────────────────────────────────────────────────────────────────────────────
 * Coordinates background execution for Swing Watch, IPO Radar, and News Scorer:
 *  - Runs scanners daily at market EOD (7:00 PM IST)
 *  - Periodically tracks outcomes (every 4 hours)
 *  - Runs learning and genome evolution cycles daily (8:00 PM IST)
 */

import { runSwingScannerEvolved, trackSwingOutcomes, runSwingLearningCycle } from "./swingGenomeEngine";
import { runIpoScannerEvolved, trackIpoOutcomes, runIpoLearningCycle } from "./ipoGenomeEngine";
import { fillNewsImpactOutcomes } from "./newsImpactScorer";
import { getNowIST, getISTHour, getISTMinute, isWeekdayIST } from "./istUtils";
import { shouldRunJob } from "./jobLedger";

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isJobRunning = false;

export function startSelfImprovingScheduler(): void {
  console.log("[SelfImprovingScheduler] Starting background scheduler...");

  // Boot catch-up checks (runs 30s after startup)
  setTimeout(async () => {
    try {
      console.log("[SelfImprovingScheduler] Boot check starting...");
      
      // Track outcomes to catch up
      await fillNewsImpactOutcomes().catch(e => console.error("[SelfImprovingScheduler] News tracker boot fail:", e));
      await trackSwingOutcomes().catch(e => console.error("[SelfImprovingScheduler] Swing tracker boot fail:", e));
      await trackIpoOutcomes().catch(e => console.error("[SelfImprovingScheduler] IPO tracker boot fail:", e));

      // Trigger learning catch-up if needed
      const now = getNowIST();
      const hour = getISTHour(now);
      if (hour >= 20) {
        if (await shouldRunJob("swing_learning_cycle", 1440)) {
          await runSwingLearningCycle().catch(e => console.error(e));
        }
        if (await shouldRunJob("ipo_learning_cycle", 1440)) {
          await runIpoLearningCycle().catch(e => console.error(e));
        }
      }
    } catch (err: any) {
      console.error("[SelfImprovingScheduler] Boot check failed:", err.message);
    }
  }, 30 * 1000);

  // Main daemon loop (checks every 60s)
  schedulerInterval = setInterval(async () => {
    if (isJobRunning) return;

    try {
      const now = getNowIST();
      const hour = getISTHour(now);
      const minute = getISTMinute(now);
      const isWeekday = isWeekdayIST(now);

      // Scans are only relevant on weekdays post-market
      if (isWeekday) {
        // 1. Daily EOD Scan: 7:00 PM IST (19:00)
        if (hour === 19 && minute === 0) {
          if (await shouldRunJob("swing_evolved_scan", 60)) {
            isJobRunning = true;
            console.log("[SelfImprovingScheduler] Triggering Daily Swing Evolved Scan...");
            await runSwingScannerEvolved().catch(e => console.error(e));
            isJobRunning = false;
          }
          if (await shouldRunJob("ipo_evolved_scan", 60)) {
            isJobRunning = true;
            console.log("[SelfImprovingScheduler] Triggering Daily IPO Evolved Scan...");
            await runIpoScannerEvolved().catch(e => console.error(e));
            isJobRunning = false;
          }
        }

        // 2. Daily Learning Cycles: 8:00 PM IST (20:00)
        if (hour === 20 && minute === 0) {
          if (await shouldRunJob("swing_learning_cycle", 60)) {
            isJobRunning = true;
            console.log("[SelfImprovingScheduler] Running Swing Genome Learning Cycle...");
            await runSwingLearningCycle().catch(e => console.error(e));
            isJobRunning = false;
          }
          if (await shouldRunJob("ipo_learning_cycle", 60)) {
            isJobRunning = true;
            console.log("[SelfImprovingScheduler] Running IPO Genome Learning Cycle...");
            await runIpoLearningCycle().catch(e => console.error(e));
            isJobRunning = false;
          }
        }
      }

      // 3. Outcome Tracker and News Scorer Outcomes (Every 4 hours, runs 24/7)
      if (await shouldRunJob("self_improving_outcome_tracker", 240)) {
        isJobRunning = true;
        console.log("[SelfImprovingScheduler] Running periodic outcome tracking...");
        
        await fillNewsImpactOutcomes().catch(e => console.error("[SelfImprovingScheduler] News tracker fail:", e));
        await trackSwingOutcomes().catch(e => console.error("[SelfImprovingScheduler] Swing tracker fail:", e));
        await trackIpoOutcomes().catch(e => console.error("[SelfImprovingScheduler] IPO tracker fail:", e));
        
        isJobRunning = false;
      }

    } catch (error: any) {
      console.error("[SelfImprovingScheduler] Polling loop error:", error.message);
      isJobRunning = false;
    }
  }, 60000);

  console.log("[SelfImprovingScheduler] Scheduler active.");
}

export function stopSelfImprovingScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  console.log("[SelfImprovingScheduler] Stopped.");
}
