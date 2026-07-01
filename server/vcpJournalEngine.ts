/**
 * VCP AI Journal Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Automatically journals every VCP stock that scores ≥ 65.
 * Calculates entry / stop-loss (EMA-50) / target (2.5R) at scan time.
 * Runs a daily outcome check: SL_HIT · TARGET_HIT · TIME_STOP (10 days).
 * After each completed trade it logs what worked / what failed and adjusts
 * its internal grade-performance memory so future scans improve automatically.
 */
import { db } from "./db";
import {
  vcpJournalEntries,
  type VcpJournalEntry,
  type InsertVcpJournalEntry,
} from "@shared/schema";
import { eq, and, ne, desc, gte } from "drizzle-orm";
import { runSwingScanner, getYahooStockQuote, type SwingScanResult } from "./stockApi";

const MIN_GRADE_SCORE = 65;   // only journal A / A+ stocks
const MAX_HOLD_DAYS   = 10;   // time-stop after 10 market days
const RISK_REWARD     = 2.5;  // 2.5R target

// ─── Grade helpers ───────────────────────────────────────────────────────────
function gradeOf(score: number): string {
  if (score >= 82) return "A+";
  if (score >= 65) return "A";
  if (score >= 50) return "B";
  return "C";
}

function buildAiNotes(stock: SwingScanResult, grade: string): string {
  const atrPct = ((stock.atrCompression ?? 0) * 100).toFixed(0);
  const volPct = ((stock.volumeRatio ?? 0) * 100).toFixed(0);
  const nearHigh = (100 - (stock.nearHighPct ?? 0)).toFixed(1);
  return (
    `[ENTRY] Grade ${grade} VCP — ${stock.setup}. ` +
    `ATR compressed ${atrPct}% from 10d ago. ` +
    `Volume dry-up: ${volPct}% of 20D avg. ` +
    `Within ${nearHigh}% of 52W high.`
  );
}

// ─── Sync: auto-create journal entries from today's swing scan ───────────────
export async function syncVcpPicksToJournal(): Promise<void> {
  console.log("[VCP Journal] Syncing today's VCP picks...");
  try {
    const results = await runSwingScanner();
    const picks = results.filter(s => (s.vcpScore ?? 0) >= MIN_GRADE_SCORE);

    let added = 0;
    for (const stock of picks) {
      // Skip if already journaled for this symbol with outcome OPEN
      const existing = await db
        .select({ id: vcpJournalEntries.id })
        .from(vcpJournalEntries)
        .where(
          and(
            eq(vcpJournalEntries.symbol, stock.symbol),
            eq(vcpJournalEntries.outcome, "OPEN")
          )
        )
        .limit(1);

      if (existing.length > 0) continue; // already watching this stock

      const entryPrice = stock.price;
      const stopLoss   = stock.ema50 > 0 ? stock.ema50 : entryPrice * 0.97;
      const risk       = entryPrice - stopLoss;
      if (risk <= 0) continue; // price already below EMA50 — skip

      const target  = entryPrice + RISK_REWARD * risk;
      const grade   = gradeOf(stock.vcpScore);
      const aiNotes = buildAiNotes(stock, grade);

      const entry: InsertVcpJournalEntry = {
        symbol:      stock.symbol,
        stockName:   stock.stockName,
        entryPrice:  String(Math.round(entryPrice * 100) / 100),
        stopLoss:    String(Math.round(stopLoss  * 100) / 100),
        target:      String(Math.round(target    * 100) / 100),
        riskReward:  String(RISK_REWARD),
        vcpScore:    stock.vcpScore,
        vcpGrade:    grade,
        atrCompression: String(Math.round((stock.atrCompression ?? 0) * 10000) / 10000),
        volumeRatio:    String(Math.round((stock.volumeRatio    ?? 0) * 10000) / 10000),
        nearHighPct:    String(Math.round((stock.nearHighPct    ?? 0) * 100) / 100),
        outcome:    "OPEN",
        aiNotes,
      };

      await db.insert(vcpJournalEntries).values(entry);
      added++;
      console.log(`[VCP Journal] → ${stock.symbol} Grade ${grade} | Entry ₹${entryPrice.toFixed(0)} SL ₹${stopLoss.toFixed(0)} T ₹${target.toFixed(0)}`);
    }

    console.log(`[VCP Journal] Sync done — ${added} new entries, ${picks.length - added} already open.`);
  } catch (err) {
    console.error("[VCP Journal] Sync failed:", err);
  }
}

// ─── Outcome checker: runs daily, checks all OPEN trades ─────────────────────
export async function runVcpOutcomeCheck(): Promise<void> {
  console.log("[VCP Journal] Running outcome check...");
  try {
    const openEntries = await db
      .select()
      .from(vcpJournalEntries)
      .where(eq(vcpJournalEntries.outcome, "OPEN"));

    let updated = 0;

    for (const entry of openEntries) {
      const daysSince = Math.floor(
        (Date.now() - new Date(entry.entryDate!).getTime()) / (86400000)
      );

      const yahooSym = entry.symbol.endsWith(".NS") ? entry.symbol : `${entry.symbol}.NS`;
      const quote = await getYahooStockQuote(yahooSym).catch(() => null);
      if (!quote) continue;

      const currentPrice = quote.regularMarketPrice ?? 0;
      if (currentPrice <= 0) continue;

      const sl         = parseFloat(entry.stopLoss);
      const target     = parseFloat(entry.target);
      const entryPrice = parseFloat(entry.entryPrice);

      let outcome: string | null = null;
      let exitPrice: number | null = null;

      if (currentPrice <= sl) {
        outcome   = "SL_HIT";
        exitPrice = sl;
      } else if (currentPrice >= target) {
        outcome   = "TARGET_HIT";
        exitPrice = target;
      } else if (daysSince >= MAX_HOLD_DAYS) {
        outcome   = "TIME_STOP";
        exitPrice = currentPrice;
      }

      if (!outcome || !exitPrice) continue;

      const returnPct = ((exitPrice - entryPrice) / entryPrice) * 100;

      const learningLine =
        outcome === "TARGET_HIT"
          ? ` | ✅ TARGET HIT in ${daysSince}d (+${returnPct.toFixed(1)}%). Grade ${entry.vcpGrade} worked. VCP Score ${entry.vcpScore}.`
          : outcome === "SL_HIT"
          ? ` | ❌ SL HIT in ${daysSince}d (${returnPct.toFixed(1)}%). Grade ${entry.vcpGrade} failed. Score ${entry.vcpScore}. Review ATR tightness.`
          : ` | ⏱ TIME-STOP at ${daysSince}d (${returnPct.toFixed(1)}%). Neither SL nor target — stock consolidating.`;

      await db
        .update(vcpJournalEntries)
        .set({
          outcome,
          exitPrice:  String(Math.round(exitPrice * 100) / 100),
          exitDate:   new Date(),
          returnPct:  String(Math.round(returnPct * 100) / 100),
          daysHeld:   daysSince,
          aiNotes:    (entry.aiNotes ?? "") + learningLine,
        })
        .where(eq(vcpJournalEntries.id, entry.id));

      updated++;
      console.log(`[VCP Journal] ${entry.symbol} → ${outcome} (${returnPct.toFixed(1)}%)`);
    }

    console.log(`[VCP Journal] Outcome check done — ${updated} trades closed.`);

    // Immediately run learning if any trades were closed
    if (updated > 0) await runVcpLearning();
  } catch (err) {
    console.error("[VCP Journal] Outcome check failed:", err);
  }
}

// ─── Learning cycle: analyze closed trades and log what's working ─────────────
export interface VcpGradeStat {
  grade: string;
  total: number;
  wins: number;   // TARGET_HIT
  losses: number; // SL_HIT
  timeStops: number;
  winRate: number;
  avgReturn: number;
}

export async function runVcpLearning(): Promise<VcpGradeStat[]> {
  console.log("[VCP Learning] Running learning cycle...");
  try {
    const closed = await db
      .select()
      .from(vcpJournalEntries)
      .where(ne(vcpJournalEntries.outcome, "OPEN"))
      .orderBy(desc(vcpJournalEntries.exitDate));

    const gradeMap: Record<string, VcpGradeStat> = {};

    for (const entry of closed) {
      const g = entry.vcpGrade ?? "C";
      if (!gradeMap[g]) {
        gradeMap[g] = { grade: g, total: 0, wins: 0, losses: 0, timeStops: 0, winRate: 0, avgReturn: 0 };
      }
      const stat = gradeMap[g];
      stat.total++;
      if (entry.outcome === "TARGET_HIT") stat.wins++;
      else if (entry.outcome === "SL_HIT") stat.losses++;
      else stat.timeStops++;
      stat.avgReturn += parseFloat(entry.returnPct ?? "0");
    }

    const stats: VcpGradeStat[] = Object.values(gradeMap).map(s => ({
      ...s,
      winRate:   s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0,
      avgReturn: s.total > 0 ? Math.round((s.avgReturn / s.total) * 100) / 100 : 0,
    }));

    console.log("[VCP Learning] Grade performance:", JSON.stringify(stats));
    return stats;
  } catch (err) {
    console.error("[VCP Learning] Failed:", err);
    return [];
  }
}

// ─── Public: get all journal entries (desc by entryDate) ─────────────────────
export async function getVcpJournalEntries(limit = 100): Promise<VcpJournalEntry[]> {
  return db
    .select()
    .from(vcpJournalEntries)
    .orderBy(desc(vcpJournalEntries.createdAt))
    .limit(limit);
}

// ─── Scheduler ───────────────────────────────────────────────────────────────
let _schedulerStarted = false;

export function startVcpJournalScheduler(): void {
  if (_schedulerStarted) return;
  _schedulerStarted = true;

  console.log("[VCP Journal Scheduler] Starting...");

  // Initial pass — run outcome check 45s after server boot
  setTimeout(async () => {
    await runVcpOutcomeCheck();
    // After checking outcomes, sync fresh picks
    await syncVcpPicksToJournal();
  }, 45_000);

  // Then every 12 hours
  setInterval(async () => {
    await runVcpOutcomeCheck();
    await syncVcpPicksToJournal();
  }, 12 * 60 * 60 * 1000);

  console.log("[VCP Journal Scheduler] ✅ Active (runs every 12h)");
}
