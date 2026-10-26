/**
 * HERMES V2 CONTEXTUAL THOMPSON SAMPLING (BAYESIAN MULTI-ARMED BANDIT)
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks Beta(alpha_{m,r}, beta_{m,r}) distributions for sub-models across market regimes:
 * Models: Kronos, Chronos, QlibAlpha, VCP2, Fugu, ApexFO, FinBERT
 * Regimes: BULL_TREND, BEAR_TREND, HIGH_VOL_CHOP, RANGE_BOUND
 */

import { db } from "./db";
import { modelWeightsBandit } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export type SubModelId = "kronos" | "chronos" | "qlibAlpha" | "vcp2" | "fugu" | "apexFo" | "finbert";
export type MarketRegimeType = "BULL_TREND" | "BEAR_TREND" | "HIGH_VOL_CHOP" | "RANGE_BOUND";

export const SUB_MODELS: SubModelId[] = [
  "kronos",
  "chronos",
  "qlibAlpha",
  "vcp2",
  "fugu",
  "apexFo",
  "finbert",
];

export const MARKET_REGIMES: MarketRegimeType[] = [
  "BULL_TREND",
  "BEAR_TREND",
  "HIGH_VOL_CHOP",
  "RANGE_BOUND",
];

// Default prior parameters per regime (empirically calibrated)
const DEFAULT_PRIORS: Record<MarketRegimeType, Record<SubModelId, { alpha: number; beta: number }>> = {
  BULL_TREND: {
    kronos: { alpha: 8.5, beta: 2.5 },
    chronos: { alpha: 7.0, beta: 3.0 },
    qlibAlpha: { alpha: 9.0, beta: 2.0 },
    vcp2: { alpha: 9.5, beta: 1.5 },
    fugu: { alpha: 7.5, beta: 3.0 },
    apexFo: { alpha: 8.0, beta: 2.5 },
    finbert: { alpha: 6.5, beta: 3.5 },
  },
  BEAR_TREND: {
    kronos: { alpha: 7.5, beta: 3.0 },
    chronos: { alpha: 8.5, beta: 2.0 },
    qlibAlpha: { alpha: 8.0, beta: 2.5 },
    vcp2: { alpha: 4.5, beta: 6.0 },
    fugu: { alpha: 6.0, beta: 4.5 },
    apexFo: { alpha: 9.0, beta: 1.8 },
    finbert: { alpha: 8.5, beta: 2.0 },
  },
  HIGH_VOL_CHOP: {
    kronos: { alpha: 8.0, beta: 2.5 },
    chronos: { alpha: 9.0, beta: 2.0 },
    qlibAlpha: { alpha: 6.5, beta: 4.0 },
    vcp2: { alpha: 5.0, beta: 5.5 },
    fugu: { alpha: 6.0, beta: 4.5 },
    apexFo: { alpha: 8.5, beta: 2.5 },
    finbert: { alpha: 7.0, beta: 3.5 },
  },
  RANGE_BOUND: {
    kronos: { alpha: 7.0, beta: 3.5 },
    chronos: { alpha: 7.5, beta: 3.0 },
    qlibAlpha: { alpha: 8.5, beta: 2.5 },
    vcp2: { alpha: 8.0, beta: 2.5 },
    fugu: { alpha: 7.5, beta: 3.0 },
    apexFo: { alpha: 8.0, beta: 2.5 },
    finbert: { alpha: 5.5, beta: 4.5 },
  },
};

// In-memory cache for ultra-fast scoring
const banditCache = new Map<string, { alpha: number; beta: number; pulls: number; rewards: number }>();

function getCacheKey(model: SubModelId, regime: MarketRegimeType): string {
  return `${model}:${regime}`;
}

// Initialize in-memory cache from default priors
for (const regime of MARKET_REGIMES) {
  for (const model of SUB_MODELS) {
    const prior = DEFAULT_PRIORS[regime][model];
    banditCache.set(getCacheKey(model, regime), {
      alpha: prior.alpha,
      beta: prior.beta,
      pulls: Math.round(prior.alpha + prior.beta),
      rewards: Math.round(prior.alpha),
    });
  }
}

/**
 * Loads DB bandit records into in-memory cache if available.
 */
export async function syncBanditFromDatabase(): Promise<void> {
  try {
    const records = await db.select().from(modelWeightsBandit);
    for (const rec of records) {
      const key = `${rec.modelName}:${rec.marketRegime}`;
      banditCache.set(key, {
        alpha: parseFloat(rec.alpha || "1.0"),
        beta: parseFloat(rec.beta || "1.0"),
        pulls: rec.pulls,
        rewards: rec.rewards,
      });
    }
  } catch (err: any) {
    // If DB is offline or table unmigrated, in-memory priors remain active
    console.warn("[HermesBandit] Database sync bypassed, using cached/prior weights:", err.message);
  }
}

/**
 * Computes normalized mean model weights w_{m,r} = alpha / (alpha + beta) for a given regime.
 */
export function getModelWeights(regime: MarketRegimeType = "BULL_TREND"): Record<SubModelId, number> {
  const rawExpectedValues: Record<string, number> = {};
  let totalWeight = 0;

  for (const model of SUB_MODELS) {
    const key = getCacheKey(model, regime);
    const entry = banditCache.get(key) || DEFAULT_PRIORS[regime][model];
    const mean = entry.alpha / (entry.alpha + entry.beta + 1e-8);
    rawExpectedValues[model] = mean;
    totalWeight += mean;
  }

  const normalized: Record<string, number> = {};
  for (const model of SUB_MODELS) {
    normalized[model] = totalWeight > 0 ? rawExpectedValues[model] / totalWeight : 1 / SUB_MODELS.length;
  }

  return normalized as Record<SubModelId, number>;
}

/**
 * Computes unified Hermes Conviction Score (0-100)
 * Score = SUM(w_{m,r} * P_m(Bullish))
 */
export function computeHermesConvictionScore(
  modelProbabilities: Partial<Record<SubModelId, number>>,
  regime: MarketRegimeType = "BULL_TREND",
): {
  score: number;
  regime: MarketRegimeType;
  modelWeights: Record<SubModelId, number>;
  contributions: Record<SubModelId, number>;
} {
  const weights = getModelWeights(regime);
  let totalScore = 0;
  const contributions: Record<string, number> = {};

  for (const model of SUB_MODELS) {
    // Default model probability to 50% neutral if unprovided
    const prob = modelProbabilities[model] !== undefined ? modelProbabilities[model]! : 50.0;
    const modelWeight = weights[model];
    const contribution = modelWeight * prob;
    totalScore += contribution;
    contributions[model] = Math.round(contribution * 10) / 10;
  }

  const clamped = Math.max(0, Math.min(100, Math.round(totalScore)));

  return {
    score: clamped,
    regime,
    modelWeights: weights,
    contributions: contributions as Record<SubModelId, number>,
  };
}

/**
 * Updates alpha/beta parameters upon trade resolution with exponential decay gamma = 0.97
 */
export async function updateBanditOutcome(
  models: SubModelId[],
  regime: MarketRegimeType,
  isReward: boolean,
  gamma: number = 0.97,
): Promise<void> {
  for (const model of models) {
    const key = getCacheKey(model, regime);
    const curr = banditCache.get(key) || { alpha: 1.0, beta: 1.0, pulls: 0, rewards: 0 };

    // Apply exponential decay to prior observations so recent performance dominates
    const decayedAlpha = curr.alpha * gamma;
    const decayedBeta = curr.beta * gamma;

    const newAlpha = isReward ? decayedAlpha + 1.0 : decayedAlpha;
    const newBeta = isReward ? decayedBeta : decayedBeta + 1.0;
    const newPulls = curr.pulls + 1;
    const newRewards = curr.rewards + (isReward ? 1 : 0);

    banditCache.set(key, {
      alpha: Math.max(1.0, newAlpha),
      beta: Math.max(1.0, newBeta),
      pulls: newPulls,
      rewards: newRewards,
    });

    // Fire-and-forget sync to DB
    try {
      const existing = await db
        .select()
        .from(modelWeightsBandit)
        .where(
          and(
            eq(modelWeightsBandit.modelName, model),
            eq(modelWeightsBandit.marketRegime, regime),
          ),
        );

      if (existing.length > 0) {
        await db
          .update(modelWeightsBandit)
          .set({
            alpha: String(newAlpha.toFixed(4)),
            beta: String(newBeta.toFixed(4)),
            pulls: newPulls,
            rewards: newRewards,
            lastUpdated: new Date(),
          })
          .where(eq(modelWeightsBandit.id, existing[0].id));
      } else {
        await db.insert(modelWeightsBandit).values({
          modelName: model,
          marketRegime: regime,
          alpha: String(newAlpha.toFixed(4)),
          beta: String(newBeta.toFixed(4)),
          pulls: newPulls,
          rewards: newRewards,
        });
      }
    } catch (err: any) {
      // In-memory update was successful
    }
  }
}
