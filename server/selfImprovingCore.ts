/**
 * SELF-IMPROVING CORE ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages "genome" evolution for all AI engines (HERMES, SWING, APEX, IPO).
 *
 * Unlike "self-learning" (adjusting feature weights), self-improving means
 * the engine can MUTATE its own scanning parameters:
 *  - minimum score thresholds
 *  - ATR/volume/proximity filter thresholds
 *  - hold period and risk-reward parameters
 *  - feature group proportions (APEX)
 *
 * Algorithm:
 *  1. Load current genome for an engine
 *  2. Collect last N completed outcomes
 *  3. Simulate: what picks WOULD the mutated genome produce on past data?
 *  4. Evaluate: which genome produces higher avg returns toward the 5-10% goal?
 *  5. If mutation wins with statistical significance → promote + log change
 *  6. Gemini explains the mutation in human-readable terms
 */

import { db } from "./db";
import { engineGenome, genomeEvolutionLog } from "@shared/schema";
import { eq } from "drizzle-orm";
import { generateWithRetry } from "./gemini";

export type EngineId = "HERMES" | "SWING" | "APEX" | "IPO" | "FUGU";

// ─── Default Genome Params per Engine ───────────────────────────────────────

export const DEFAULT_GENOMES: Record<EngineId, Record<string, number>> = {
  HERMES: {
    min_score_threshold:      65,    // minimum HERMES score to include a stock
    news_weight:               0.20, // news score contribution to composite
    fundamental_weight:        0.25, // fundamental score contribution
    technical_weight:          0.55, // technical/VCP score contribution
    prune_accuracy_floor:      0.45, // feature accuracy below which to prune
    max_scan_universe:        300,   // how many stocks to scan per run
    atr_compression_min:       0.10, // ATR must have fallen at least X% vs 10d
    volume_dryup_max:          0.85, // volume must be below X × 20d avg
    near_high_pct_max:         0.15, // price within X% of 52w high
    fundamental_min_roe:      10.0,  // minimum ROE% to qualify in fundamental tier
  },
  SWING: {
    min_grade_score:           65,   // minimum VCP score to journal
    max_hold_days:             10,   // time-stop after X market days
    risk_reward:                2.5, // target = entry + (entry - SL) × R
    atr_tightness_max:          0.06, // ATR/price must be below X (6%)
    volume_dryup_max:           0.85, // volume below X × 20d avg
    near_high_pct_max:          0.15, // within X% of 52w high
    sl_pct_max:                 0.06, // stop-loss max 6% from entry
    target_return_goal:         7.5,  // avg return goal (5-10% range midpoint)
  },
  APEX: {
    news_group_weight:          0.20, // proportion of score from news features
    fo_group_weight:            0.20, // F&O options features
    technical_group_weight:     0.30, // technical indicators
    gap_group_weight:           0.20, // gap + volume surge
    macro_group_weight:         0.10, // macro/market context
    min_confidence_threshold:   55,   // min confidence score to publish a call
    max_picks_per_day:           5,   // top N calls per direction (UP/DOWN)
    target_return_goal:          7.5, // avg return goal for picks
  },
  IPO: {
    min_days_since_listing:     10,   // IPO must be at least X days old
    max_days_since_listing:    110,   // IPO must be less than X days old
    max_base_depth_pct:         0.35, // base must not be deeper than X% from peak
    consolidation_range_pct:    0.15, // last 10 days within X% range
    min_avg_volume:           5000,   // minimum avg daily volume
    target_return_goal:          7.5, // avg return goal
    min_score_threshold:        50,   // minimum IPO score to flag
  },
  FUGU: {
    min_elite_score:            70,   // minimum FUGU composite score for elite list
    news_weight:                0.20,
    fundamental_weight:         0.20,
    technical_weight:           0.35,
    pattern_weight:             0.15,
    candlestick_weight:         0.10,
    max_scan_universe:         300,
    target_return_goal:          7.5,
  },
};

// Bounds for each parameter [min, max] — mutations stay within these
const GENOME_BOUNDS: Record<string, [number, number]> = {
  min_score_threshold:       [45, 85],
  news_weight:                [0.05, 0.40],
  fundamental_weight:         [0.05, 0.45],
  technical_weight:           [0.20, 0.75],
  prune_accuracy_floor:       [0.35, 0.60],
  max_scan_universe:         [100, 500],
  atr_compression_min:        [0.05, 0.25],
  volume_dryup_max:           [0.60, 0.95],
  near_high_pct_max:          [0.05, 0.30],
  fundamental_min_roe:        [5, 25],
  min_grade_score:            [50, 80],
  max_hold_days:              [5, 20],
  risk_reward:                [1.5, 4.0],
  atr_tightness_max:          [0.03, 0.10],
  sl_pct_max:                 [0.03, 0.10],
  target_return_goal:         [5.0, 10.0],
  news_group_weight:          [0.05, 0.40],
  fo_group_weight:            [0.05, 0.40],
  technical_group_weight:     [0.15, 0.50],
  gap_group_weight:           [0.05, 0.35],
  macro_group_weight:         [0.05, 0.25],
  min_confidence_threshold:   [40, 75],
  max_picks_per_day:          [3, 10],
  min_days_since_listing:     [5, 20],
  max_days_since_listing:     [60, 180],
  max_base_depth_pct:         [0.20, 0.50],
  consolidation_range_pct:    [0.08, 0.25],
  min_avg_volume:            [1000, 50000],
  min_score_threshold_ipo:    [35, 70],
  min_elite_score:            [55, 85],
  pattern_weight:             [0.05, 0.30],
  candlestick_weight:         [0.05, 0.25],
};

// ─── Load / Seed Genome ───────────────────────────────────────────────────────

export async function getGenome(engine: EngineId): Promise<{
  params: Record<string, number>;
  version: number;
  avgReturn: number;
  sampleSize: number;
}> {
  try {
    const [row] = await db.select().from(engineGenome).where(eq(engineGenome.engine, engine));
    if (row) {
      return {
        params: row.params as Record<string, number>,
        version: row.version,
        avgReturn: row.avgReturn ? parseFloat(row.avgReturn) : 0,
        sampleSize: row.sampleSize ?? 0,
      };
    }
  } catch (err) {
    console.error(`[Genome] Failed to load genome for ${engine}:`, err);
  }

  // Seed default genome
  const defaults = DEFAULT_GENOMES[engine];
  try {
    await db.insert(engineGenome).values({
      engine,
      version: 1,
      params: defaults,
      avgReturn: "0",
      winRate: "0.5",
      sampleSize: 0,
      notes: `Initial default genome for ${engine}`,
    }).onConflictDoNothing();
  } catch (_) {}

  return { params: defaults, version: 1, avgReturn: 0, sampleSize: 0 };
}

// ─── Mutate Genome ────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Generates a mutated copy of the genome.
 * Each parameter is randomly shifted ±5-15% of its current value,
 * then clamped to its allowed bounds.
 */
export function mutateGenome(
  params: Record<string, number>,
  mutationStrength = 0.12,
): Record<string, number> {
  const mutated: Record<string, number> = {};
  for (const [key, val] of Object.entries(params)) {
    const direction = Math.random() > 0.5 ? 1 : -1;
    const magnitude = mutationStrength * (0.5 + Math.random() * 0.5);
    const delta = val * magnitude * direction;
    const newVal = val + delta;
    const bounds = GENOME_BOUNDS[key];
    mutated[key] = bounds ? clamp(newVal, bounds[0], bounds[1]) : newVal;
  }

  // If weights need to sum to 1, re-normalize weight keys
  const weightKeys = Object.keys(mutated).filter(k => k.endsWith("_weight"));
  if (weightKeys.length > 1) {
    const total = weightKeys.reduce((s, k) => s + mutated[k], 0);
    if (total > 0) {
      for (const k of weightKeys) mutated[k] = mutated[k] / total;
    }
  }

  return mutated;
}

/**
 * Crossover: combine best parameters from two parent genomes.
 * Uniform crossover — each param randomly picked from either parent.
 */
export function crossoverGenome(
  parent1: Record<string, number>,
  parent2: Record<string, number>,
): Record<string, number> {
  const child: Record<string, number> = {};
  for (const key of Object.keys(parent1)) {
    // 50% chance from each parent, with slight blend
    if (Math.random() > 0.5) {
      child[key] = parent1[key];
    } else {
      child[key] = parent2[key];
    }
    // 20% chance of blended value (average of parents)
    if (Math.random() < 0.2) {
      child[key] = (parent1[key] + parent2[key]) / 2;
    }
    const bounds = GENOME_BOUNDS[key];
    if (bounds) child[key] = clamp(child[key], bounds[0], bounds[1]);
  }

  // Re-normalize weight keys
  const weightKeys = Object.keys(child).filter(k => k.endsWith("_weight"));
  if (weightKeys.length > 1) {
    const total = weightKeys.reduce((s, k) => s + child[k], 0);
    if (total > 0) {
      for (const k of weightKeys) child[k] = child[k] / total;
    }
  }
  return child;
}

/**
 * Adaptive mutation: larger mutations for immature genomes, narrower for mature ones.
 * Maturity is measured by genome version + sample size.
 */
export function getAdaptiveMutationStrength(version: number, sampleSize: number): number {
  // Immature (v1, <20 samples): strong exploration (0.20)
  // Moderate (v5, ~100 samples): balanced (0.12)
  // Mature (v20+, 500+ samples): fine-tuning (0.05)
  const maturity = Math.min(1.0, (version / 20) * 0.5 + (sampleSize / 500) * 0.5);
  return 0.20 - (maturity * 0.15); // Range: 0.20 → 0.05
}

/**
 * Statistical significance test (simplified).
 * Returns true if improvement is statistically meaningful given sample size.
 * Uses a conservative threshold: improvement must exceed noise floor.
 */
function isStatisticallySignificant(
  oldReturn: number,
  newReturn: number,
  sampleSize: number,
): boolean {
  // Noise floor shrinks as sqrt(N): more data → smaller noise
  const noiseFloor = 2.0 / Math.sqrt(Math.max(10, sampleSize));
  const improvement = newReturn - oldReturn;
  return improvement > noiseFloor;
}

// ─── Evaluate a Genome Against a Trade History ───────────────────────────────

export interface TradeOutcome {
  returnPct: number;
  vcpScore?: number;        // or IPO score, confidence score
  newsScore?: number;
  holdDays?: number;
  outcome?: string;         // TARGET_HIT | SL_HIT | TIME_STOP
}

/**
 * Multi-objective genome evaluation.
 * Scores genomes on avg return, win rate, AND risk-adjusted returns.
 * Goal: find genomes that consistently produce 5-10% returners.
 */
export function evaluateGenome(
  params: Record<string, number>,
  trades: TradeOutcome[],
): { avgReturn: number; winRate: number; filteredCount: number; fitnessScore: number; sharpeProxy: number } {
  const minScore = params.min_score_threshold ?? params.min_grade_score ?? params.min_score_threshold_ipo ?? 0;

  const filtered = trades.filter(t => {
    if (t.vcpScore !== undefined && t.vcpScore < minScore) return false;
    // News filter: if genome has news weight, consider news score
    if (params.news_weight && params.news_weight > 0.1 && t.newsScore !== undefined) {
      if (t.newsScore < -30) return false; // Skip stocks with very negative news
    }
    return true;
  });

  if (filtered.length === 0) return { avgReturn: 0, winRate: 0, filteredCount: 0, fitnessScore: 0, sharpeProxy: 0 };

  const returns = filtered.map(t => t.returnPct);
  const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
  const targetGoal = params.target_return_goal ?? 7.5;
  const wins = filtered.filter(t => t.returnPct >= Math.max(3, targetGoal * 0.5)).length;
  const winRate = wins / filtered.length;

  // Sharpe-like ratio (return / volatility proxy)
  const mean = avgReturn;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  const stdDev = Math.sqrt(variance) || 1;
  const sharpeProxy = mean / stdDev;

  // Multi-objective fitness: weighted combination
  // 50% avg return (toward 5-10% goal)
  // 30% win rate
  // 20% risk-adjusted (sharpe proxy)
  const returnScore = Math.min(1, Math.max(0, avgReturn / 10)); // 10% = perfect
  const winScore = winRate;
  const sharpeScore = Math.min(1, Math.max(0, (sharpeProxy + 1) / 3)); // normalize

  const fitnessScore = 0.50 * returnScore + 0.30 * winScore + 0.20 * sharpeScore;

  return { avgReturn, winRate, filteredCount: filtered.length, fitnessScore, sharpeProxy };
}

// ─── Main Evolution Cycle ─────────────────────────────────────────────────────

/**
 * Runs one genome evolution cycle for an engine.
 * Generates K candidate mutations, picks the best, promotes if it beats
 * the current genome with at least MIN_IMPROVEMENT.
 */
export async function runGenomeEvolution(
  engine: EngineId,
  trades: TradeOutcome[],
  options: { mutations?: number; minImprovement?: number } = {},
): Promise<{
  promoted: boolean;
  oldAvgReturn: number;
  newAvgReturn: number;
  newParams?: Record<string, number>;
  description: string;
}> {
  if (trades.length < 10) {
    return {
      promoted: false,
      oldAvgReturn: 0,
      newAvgReturn: 0,
      description: `Insufficient trade history (${trades.length}/10 needed).`,
    };
  }

  const { mutations = 20, minImprovement = 0.2 } = options;
  const current = await getGenome(engine);
  const currentEval = evaluateGenome(current.params, trades);

  // Adaptive mutation strength: stronger exploration for immature genomes
  const mutStrength = getAdaptiveMutationStrength(current.version, current.sampleSize);

  console.log(`[Genome:${engine}] Current: avg=${currentEval.avgReturn.toFixed(2)}% | win=${(currentEval.winRate * 100).toFixed(1)}% | fitness=${currentEval.fitnessScore.toFixed(3)} | sharpe=${currentEval.sharpeProxy.toFixed(2)} | mutStr=${mutStrength.toFixed(3)} | ${trades.length} trades`);

  // ─── Phase 1: Generate K random mutations ──────────────────────────
  const candidates: { params: Record<string, number>; eval: ReturnType<typeof evaluateGenome> }[] = [];

  for (let i = 0; i < mutations; i++) {
    const candidate = mutateGenome(current.params, mutStrength);
    const candidateEval = evaluateGenome(candidate, trades);
    if (candidateEval.filteredCount >= Math.max(5, trades.length * 0.25)) {
      candidates.push({ params: candidate, eval: candidateEval });
    }
  }

  // ─── Phase 2: Crossover — breed top candidates ────────────────────
  // Sort candidates by multi-objective fitness
  candidates.sort((a, b) => b.eval.fitnessScore - a.eval.fitnessScore);
  const topN = candidates.slice(0, Math.min(5, candidates.length));

  for (let i = 0; i < topN.length - 1; i++) {
    for (let j = i + 1; j < topN.length; j++) {
      const child = crossoverGenome(topN[i].params, topN[j].params);
      // Apply light mutation to crossover child
      const mutatedChild = mutateGenome(child, mutStrength * 0.5);
      const childEval = evaluateGenome(mutatedChild, trades);
      if (childEval.filteredCount >= Math.max(5, trades.length * 0.25)) {
        candidates.push({ params: mutatedChild, eval: childEval });
      }
    }
  }

  // ─── Phase 3: Select best by multi-objective fitness ──────────────
  candidates.sort((a, b) => b.eval.fitnessScore - a.eval.fitnessScore);

  let bestMutated = current.params;
  let bestEval = currentEval;

  if (candidates.length > 0 && candidates[0].eval.fitnessScore > currentEval.fitnessScore) {
    bestMutated = candidates[0].params;
    bestEval = candidates[0].eval;
  }

  const improvement = bestEval.avgReturn - currentEval.avgReturn;
  const fitnessImprovement = bestEval.fitnessScore - currentEval.fitnessScore;

  // ─── Phase 4: Statistical significance check ──────────────────────
  const statSig = isStatisticallySignificant(currentEval.avgReturn, bestEval.avgReturn, trades.length);
  const shouldPromote =
    fitnessImprovement > 0.01 &&  // Fitness must improve
    improvement >= minImprovement &&  // Avg return must improve
    bestEval !== currentEval &&
    (statSig || trades.length < 30); // Skip stat test for small samples (bootstrap phase)

  // Build diff description
  const diffs: string[] = [];
  for (const [key, newVal] of Object.entries(bestMutated)) {
    const oldVal = current.params[key];
    if (oldVal !== undefined && Math.abs(newVal - oldVal) > 0.001) {
      const pct = oldVal !== 0 ? ((newVal - oldVal) / oldVal) * 100 : 0;
      diffs.push(`${key}: ${oldVal.toFixed(3)} → ${newVal.toFixed(3)} (${pct > 0 ? "+" : ""}${pct.toFixed(1)}%)`);
    }
  }
  const description = diffs.length > 0
    ? `Mutations: ${diffs.slice(0, 6).join(", ")}`
    : "No significant parameter changes";

  // Gemini analysis
  let geminiAnalysis = "";
  if (shouldPromote) {
    try {
      const prompt = `You are an AI trading system meta-optimizer. The ${engine} engine's self-improving genome evolved:

Current genome avg return: ${currentEval.avgReturn.toFixed(2)}%
New genome avg return: ${bestEval.avgReturn.toFixed(2)}%
Win rate: ${(bestEval.winRate * 100).toFixed(1)}%
Fitness score: ${currentEval.fitnessScore.toFixed(3)} → ${bestEval.fitnessScore.toFixed(3)}
Sharpe proxy: ${currentEval.sharpeProxy.toFixed(2)} → ${bestEval.sharpeProxy.toFixed(2)}
Mutation strength: ${mutStrength.toFixed(3)} (adaptive)
Sample size: ${trades.length} completed trades
Target return goal: 5-10% per trade
Statistically significant: ${statSig ? 'YES' : 'NO (bootstrap phase)'}

Parameter changes:
${diffs.join("\n")}

In 2-3 sentences, explain what this parameter evolution means for the ${engine} engine's trading strategy and why it should improve returns toward the 5-10% goal.`;

      const res = await generateWithRetry({
        model: "gemini-flash-latest",
        contents: prompt,
        config: { systemInstruction: "You are a concise quantitative trading analyst." },
      });
      geminiAnalysis = res?.text ?? "";
    } catch (_) {}
  }

  // Persist to DB
  if (shouldPromote) {
    const newVersion = current.version + 1;
    await db.update(engineGenome)
      .set({
        version: newVersion,
        params: bestMutated,
        avgReturn: String(bestEval.avgReturn.toFixed(4)),
        winRate: String(bestEval.winRate.toFixed(4)),
        sampleSize: trades.length,
        promotedAt: new Date(),
        notes: `v${newVersion}: fitness=${bestEval.fitnessScore.toFixed(3)} sharpe=${bestEval.sharpeProxy.toFixed(2)} | ${description}`,
      })
      .where(eq(engineGenome.engine, engine));

    console.log(`[Genome:${engine}] ✅ Promoted v${current.version} → v${newVersion} | avg ${currentEval.avgReturn.toFixed(2)}% → ${bestEval.avgReturn.toFixed(2)}% | fitness ${currentEval.fitnessScore.toFixed(3)} → ${bestEval.fitnessScore.toFixed(3)}`);
  } else {
    console.log(`[Genome:${engine}] ⬤ No promotion — best improvement: ${improvement.toFixed(2)}% (need ${minImprovement}%) | stat_sig: ${statSig}`);
  }

  // Always log the attempt
  try {
    await db.insert(genomeEvolutionLog).values({
      engine,
      versionFrom: current.version,
      versionTo: shouldPromote ? current.version + 1 : current.version,
      oldParams: current.params,
      newParams: shouldPromote ? bestMutated : current.params,
      oldAvgReturn: String(currentEval.avgReturn.toFixed(4)),
      newAvgReturn: String(bestEval.avgReturn.toFixed(4)),
      wasPromoted: shouldPromote,
      mutationDescription: description,
      geminiAnalysis,
      sampleSize: trades.length,
    });
  } catch (_) {}

  return {
    promoted: shouldPromote,
    oldAvgReturn: currentEval.avgReturn,
    newAvgReturn: bestEval.avgReturn,
    newParams: shouldPromote ? bestMutated : undefined,
    description,
  };
}

// ─── Public Getters ───────────────────────────────────────────────────────────

export async function getGenomeHistory(engine: EngineId, limit = 20) {
  const { desc } = await import("drizzle-orm");
  return db.select().from(genomeEvolutionLog)
    .where(eq(genomeEvolutionLog.engine, engine))
    .orderBy(desc(genomeEvolutionLog.cycleDate))
    .limit(limit);
}

export async function getAllGenomes() {
  return db.select().from(engineGenome);
}
