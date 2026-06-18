import { getNowIST, getISTHour, getISTMinute, isWeekdayIST, getISTDateString } from "./istUtils";
import { shouldRunJob } from "./jobLedger";
import { runNewsIngestJob } from "./apexNewsEngine";
import { runFODataJob } from "./apexFOEngine";
import { runMorningScan } from "./apexEngine";
import { fillTodayOutcomes } from "./apexOutcomeTracker";
import { runLearningCycle } from "./apexLearningEngine";
import { db } from "./db";
import { jobLedger } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Checks if a job has already run successfully today in IST.
 */
async function hasJobRanToday(name: string): Promise<boolean> {
  try {
    const [job] = await db.select().from(jobLedger).where(eq(jobLedger.jobName, name)).limit(1);
    if (!job || !job.lastRanAt) return false;
    
    const lastRanStr = getISTDateString(new Date(job.lastRanAt));
    const todayStr = getISTDateString(getNowIST());
    
    return lastRanStr === todayStr && job.status === "completed";
  } catch (error) {
    console.error(`[APEXScheduler] Error checking job ledger for ${name}:`, error);
    return false;
  }
}

/**
 * Boot catch-up logic to trigger missed jobs on server restart.
 */
export async function catchUpOnBoot(): Promise<void> {
  const now = getNowIST();
  const hour = getISTHour(now);
  const isWeekday = isWeekdayIST(now);
  
  if (!isWeekday) {
    console.log("[APEXScheduler] Weekend. Skipping catch-up on boot.");
    return;
  }
  
  console.log(`[APEXScheduler] Running catch-up checks (Current IST time: ${getISTDateString(now)} ${hour}:${getISTMinute(now)})...`);
  
  // News and F&O data load catch-up
  if (hour >= 8) {
    const newsRan = await hasJobRanToday("news_ingest");
    if (!newsRan) {
      console.log("[APEXScheduler] Catch-up: news_ingest was missed today. Starting...");
      runNewsIngestJob().catch(e => console.error(e));
    }
    const foRan = await hasJobRanToday("fo_data");
    if (!foRan) {
      console.log("[APEXScheduler] Catch-up: fo_data was missed today. Starting...");
      runFODataJob().catch(e => console.error(e));
    }
  }
  
  // Morning scanner scan catch-up
  if (hour >= 10) {
    const scanRan = await hasJobRanToday("morning_scan");
    if (!scanRan) {
      console.log("[APEXScheduler] Catch-up: morning_scan was missed today. Starting...");
      runMorningScan().catch(e => console.error(e));
    }
  }
  
  // EOD outcomes tracking and weights learning catch-up
  if (hour >= 17) {
    const outcomesRan = await hasJobRanToday("fill_outcomes");
    if (!outcomesRan) {
      console.log("[APEXScheduler] Catch-up: fill_outcomes was missed today. Starting...");
      fillTodayOutcomes().catch(e => console.error(e));
    }
    const learningRan = await hasJobRanToday("learning_cycle");
    if (!learningRan) {
      console.log("[APEXScheduler] Catch-up: learning_cycle was missed today. Starting...");
      runLearningCycle().catch(e => console.error(e));
    }
  }
}

/**
 * Main persistent scheduler daemon. Checks job intervals every 60 seconds.
 */
export function startApexScheduler(): void {
  console.log("[APEXScheduler] Starting persistent DB-based scheduler...");
  
  // Catch up on boot
  catchUpOnBoot().catch(err => console.error("[APEXScheduler] Error in catchUpOnBoot:", err));
  
  // Poll every 60 seconds
  setInterval(async () => {
    try {
      const now = getNowIST();
      const hour = getISTHour(now);
      const minute = getISTMinute(now);
      const isWeekday = isWeekdayIST(now);
      
      if (!isWeekday) {
        return; // Skip weekends
      }
      
      // 8:00 AM IST -> runNewsIngestJob + runFODataJob
      if (hour === 8 && minute === 0) {
        if (await shouldRunJob("news_ingest", 60)) {
          runNewsIngestJob().catch(e => console.error(e));
        }
        if (await shouldRunJob("fo_data", 60)) {
          runFODataJob().catch(e => console.error(e));
        }
      }
      
      // 9:10 AM IST -> runMorningScan
      if (hour === 9 && minute === 10) {
        if (await shouldRunJob("morning_scan", 60)) {
          runMorningScan().catch(e => console.error(e));
        }
      }
      
      // 4:00 PM IST (16:00) -> fillTodayOutcomes
      if (hour === 16 && minute === 0) {
        if (await shouldRunJob("fill_outcomes", 60)) {
          fillTodayOutcomes().catch(e => console.error(e));
        }
      }
      
      // 4:30 PM IST (16:30) -> runLearningCycle
      if (hour === 16 && minute === 30) {
        if (await shouldRunJob("learning_cycle", 60)) {
          runLearningCycle().catch(e => console.error(e));
        }
      }
    } catch (error) {
      console.error("[APEXScheduler] Scheduler polling error:", error);
    }
  }, 60000);
}
