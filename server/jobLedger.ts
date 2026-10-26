import { db } from "./db";
import { jobLedger, jobErrorLog } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const hasDb = Boolean(process.env.DATABASE_URL);
const ramLedger = new Map<string, { status: string; lastRanAt?: Date; runCount: number; lastDurationMs?: number }>();

/**
 * Checks if a job has exceeded its interval since the last run.
 * If the job does not exist, registers it and returns true.
 */
export async function shouldRunJob(name: string, intervalMinutes: number): Promise<boolean> {
  if (!hasDb) {
    const job = ramLedger.get(name);
    if (!job) {
      ramLedger.set(name, { status: "idle", runCount: 0 });
      return true;
    }
    if (job.status === "running") {
      if (job.lastRanAt && (Date.now() - job.lastRanAt.getTime() > 45 * 60 * 1000)) {
        return true;
      }
      return false;
    }
    if (!job.lastRanAt) return true;
    return Date.now() - job.lastRanAt.getTime() >= intervalMinutes * 60 * 1000;
  }

  try {
    const [job] = await db.select().from(jobLedger).where(eq(jobLedger.jobName, name)).limit(1);
    
    if (!job) {
      // First time, register the job and return true
      await db.insert(jobLedger).values({
        jobName: name,
        status: "idle",
        runCount: 0,
      }).onConflictDoNothing();
      return true;
    }
    
    if (job.status === "running") {
      // If it has been running for more than 45 minutes, assume it crashed and allow rerun
      if (job.lastRanAt && (Date.now() - new Date(job.lastRanAt).getTime() > 45 * 60 * 1000)) {
        console.warn(`[JobLedger] Job "${name}" has been in 'running' state for > 45m. Allowing run.`);
        return true;
      }
      return false;
    }
    
    if (!job.lastRanAt) {
      return true;
    }
    
    const timeSinceLastRun = Date.now() - new Date(job.lastRanAt).getTime();
    return timeSinceLastRun >= intervalMinutes * 60 * 1000;
  } catch (error) {
    return true; // Fallback to running the job if there's a DB issue
  }
}

/**
 * Marks a job as running in the job ledger, setting start time.
 */
export async function markJobStart(name: string): Promise<void> {
  const now = new Date();
  if (!hasDb) {
    const job = ramLedger.get(name) || { status: "running", runCount: 0 };
    job.status = "running";
    job.lastRanAt = now;
    ramLedger.set(name, job);
    return;
  }
  try {
    await db.insert(jobLedger)
      .values({
        jobName: name,
        status: "running",
        lastRanAt: now,
        runCount: 0,
      })
      .onConflictDoUpdate({
        target: jobLedger.jobName,
        set: {
          status: "running",
          lastRanAt: now,
        }
      });
  } catch (error) {}
}

/**
 * Marks a job as successfully done, updates statistics and duration.
 */
export async function markJobDone(name: string, durationMs: number): Promise<void> {
  if (!hasDb) {
    const job = ramLedger.get(name) || { status: "completed", runCount: 0 };
    job.status = "completed";
    job.lastDurationMs = durationMs;
    job.runCount = (job.runCount || 0) + 1;
    ramLedger.set(name, job);
    return;
  }
  try {
    await db.update(jobLedger)
      .set({
        status: "completed",
        lastDurationMs: durationMs,
        runCount: sql`${jobLedger.runCount} + 1`,
        lastError: null,
      })
      .where(eq(jobLedger.jobName, name));
  } catch (error) {}
}

/**
 * Log job errors in the database (never silently swallowed).
 */
export async function logError(jobName: string, error: Error | string | any, symbol?: string): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.warn(`[JobLedger] Job ${jobName}${symbol ? ` (${symbol})` : ""}:`, errorMessage);
  if (!hasDb) return;
  try {
    const stackTrace = error instanceof Error ? error.stack : undefined;
    await db.insert(jobErrorLog).values({
      jobName,
      errorMessage,
      symbol: symbol || null,
      stackTrace: stackTrace || null,
      retried: false,
    });
  } catch (_) {}
}

/**
 * Marks a job as failed, logs error details.
 */
export async function markJobFailed(name: string, error: Error | string | any): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  if (!hasDb) {
    const job = ramLedger.get(name) || { status: "failed", runCount: 0 };
    job.status = "failed";
    ramLedger.set(name, job);
    await logError(name, error);
    return;
  }
  try {
    await db.update(jobLedger)
      .set({
        status: "failed",
        lastError: errorMessage,
      })
      .where(eq(jobLedger.jobName, name));
      
    await logError(name, error);
  } catch (_) {}
}

/**
 * Executes a function safely, logging any thrown errors.
 */
export async function safeWithLog<T>(
  jobName: string,
  symbol: string | undefined,
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    await logError(jobName, error, symbol);
    return null;
  }
}
