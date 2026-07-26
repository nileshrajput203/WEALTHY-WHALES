import { db } from "./db";
import { apexPredictions, apexWeights, engineLearningLog } from "@shared/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getNowIST } from "./istUtils";
import { markJobStart, markJobDone, markJobFailed, logError } from "./jobLedger";
import { APEX_DEFAULT_WEIGHTS } from "./apexEngine";
import { generateWithRetry } from "./gemini";
import { getTemporalWeight, getAdaptiveLearningRate, backtestWeightAccuracy } from "./istUtils";
import { runGenomeEvolution, type TradeOutcome } from "./selfImprovingCore";

/**
 * Computes individual directional accuracy for all 30 features with temporal decay.
 */
export async function computeFeatureAccuracies(lookbackDays = 30): Promise<{
  accuracies: Record<string, number>;
  totalSamples: number;
}> {
  const now = getNowIST();
  const lookbackDate = new Date(now);
  lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);
  
  // Get historical completed predictions
  const history = await db.select()
    .from(apexPredictions)
    .where(
      and(
        gte(apexPredictions.predictionDate, lookbackDate),
        sql`${apexPredictions.isCorrect} IS NOT NULL`
      )
    );
    
  if (history.length === 0) {
    return { accuracies: {}, totalSamples: 0 };
  }
  
  const featureNames = Object.keys(history[0].features as Record<string, number> || {});
  const accuracies: Record<string, number> = {};
  
  for (const name of featureNames) {
    let correctWeight = 0;
    let totalWeight = 0;
    
    for (const pred of history) {
      const features = pred.features as Record<string, number> || {};
      const val = features[name];
      if (val === undefined || val === null) continue;
      
      const actualY = (pred.direction === "UP" && pred.isCorrect === true) || 
                      (pred.direction === "DOWN" && pred.isCorrect === false) ? 1 : -1;
                      
      const isCorrect = (val > 0.05 && actualY === 1) || (val < -0.05 && actualY === -1);
      
      // Use shorter 15-day half-life for intraday model temporal decay
      const temporalW = getTemporalWeight(pred.predictionDate, 15);
      
      if (isCorrect) {
        correctWeight += temporalW;
      }
      totalWeight += temporalW;
    }
    
    accuracies[name] = totalWeight > 0 ? correctWeight / totalWeight : 0.5;
  }
  
  return { accuracies, totalSamples: history.length };
}

/**
 * Normalizes a weights vector to sum exactly to 1.0.
 */
export function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const normalized: Record<string, number> = {};
  let total = 0;
  
  for (const w of Object.values(weights)) {
    total += w;
  }
  
  if (total === 0) {
    const keys = Object.keys(weights);
    const equalW = 1.0 / keys.length;
    for (const k of keys) {
      normalized[k] = equalW;
    }
    return normalized;
  }
  
  for (const [k, w] of Object.entries(weights)) {
    normalized[k] = parseFloat((w / total).toFixed(4));
  }
  
  return normalized;
}

/**
 * Builds learning changelog for UI reporting.
 */
export function generateLearningNotes(
  oldWeights: Record<string, number>,
  newWeights: Record<string, number>,
  samples: number,
  accuracies: Record<string, number>
): string {
  const diffs = Object.keys(oldWeights).map(name => {
    const diff = newWeights[name] - oldWeights[name];
    return { name, diff, winRate: accuracies[name] || 0.5 };
  });
  
  diffs.sort((a, b) => b.diff - a.diff);
  const gains = diffs.slice(0, 3).map(d => `${d.name} (+${(d.diff * 100).toFixed(2)}%, WinRate: ${(d.winRate * 100).toFixed(1)}%)`);
  
  diffs.sort((a, b) => a.diff - b.diff);
  const losses = diffs.slice(0, 3).map(d => `${d.name} (${(d.diff * 100).toFixed(2)}%, WinRate: ${(d.winRate * 100).toFixed(1)}%)`);
  
  return `Version evolved using ${samples} completed trade outcomes. 
Top weight gains: [${gains.join(", ")}].
Top weight drops: [${losses.join(", ")}].`;
}

/**
 * Orchestrator job for the self-learning loop. Runs daily at 4:30 PM IST.
 */
export async function runLearningCycle(): Promise<void> {
  const startTime = Date.now();
  await markJobStart("learning_cycle");
  
  try {
    const now = getNowIST();
    const { accuracies, totalSamples } = await computeFeatureAccuracies();
    
    if (totalSamples < 10) {
      console.log(`[LearningEngine] Insufficient outcomes data (${totalSamples} samples). Minimum needed is 10. Skipping learning.`);
      const duration = Date.now() - startTime;
      await markJobDone("learning_cycle", duration);
      return;
    }
    
    const [active] = await db.select()
      .from(apexWeights)
      .where(eq(apexWeights.isActive, true))
      .orderBy(desc(apexWeights.version))
      .limit(1);
      
    const oldWeights: Record<string, number> = active ? (active.weights as Record<string, number>) : APEX_DEFAULT_WEIGHTS;
    const oldVersion = active ? active.version : 1;
    
    // Adaptive learning rate
    const learningRate = getAdaptiveLearningRate(totalSamples);
    const blendOld = 1.0 - learningRate;
    console.log(`[APEX Learning] Adaptive learning rate: ${(learningRate * 100).toFixed(0)}% new evidence`);
    
    const newWeights: Record<string, number> = {};
    const prunedFeatures: string[] = [];
    
    for (const name of Object.keys(oldWeights)) {
      const oldW = oldWeights[name] || 0.0;
      const targetW = accuracies[name] !== undefined ? accuracies[name] : 0.5;
      
      // Feature Pruning: If feature has < 45% accuracy, soft prune it
      if (accuracies[name] !== undefined && accuracies[name] < 0.45) {
        prunedFeatures.push(name);
        newWeights[name] = 0.001; // soft prune
      } else {
        newWeights[name] = (blendOld * oldW) + (learningRate * targetW);
      }
    }
    
    const normalized = normalizeWeights(newWeights);
    const notes = generateLearningNotes(oldWeights, normalized, totalSamples, accuracies);
    
    // A/B Validation: backtest over recent predictions
    const history = await db.select()
      .from(apexPredictions)
      .where(sql`${apexPredictions.isCorrect} IS NOT NULL`)
      .orderBy(desc(apexPredictions.predictionDate))
      .limit(50);
      
    const backtestSamples = history.map(pred => {
      const features = pred.features as Record<string, number> || {};
      const featureConditions: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(features)) {
        featureConditions[k] = v > 0.05;
      }
      const actualY = (pred.direction === "UP" && pred.isCorrect === true) || 
                      (pred.direction === "DOWN" && pred.isCorrect === false);
      return {
        featureConditions,
        isWin: actualY,
      };
    });
    
    const oldAccuracy = backtestWeightAccuracy(backtestSamples, oldWeights, 50);
    const newAccuracy = backtestWeightAccuracy(backtestSamples, normalized, 50);
    const shouldPromote = newAccuracy.accuracy >= oldAccuracy.accuracy - 0.02; // 2% tolerance for daily noise
    console.log(`[APEX Learning] A/B Validation — Old: ${(oldAccuracy.accuracy * 100).toFixed(1)}%, New: ${(newAccuracy.accuracy * 100).toFixed(1)}% → ${shouldPromote ? 'PROMOTED' : 'REJECTED'}`);
    
    // Gemini Meta-Learning Analysis
    let geminiInsights = "";
    try {
      const winSamples = history
        .filter((row) => row.isCorrect === true)
        .slice(0, 5)
        .map((row) => ({
          symbol: row.symbol,
          direction: row.direction,
          confidence: row.confidenceScore,
        }));

      const lossSamples = history
        .filter((row) => row.isCorrect === false)
        .slice(0, 5)
        .map((row) => ({
          symbol: row.symbol,
          direction: row.direction,
          confidence: row.confidenceScore,
        }));

      const learningPrompt = `You are the APEX Intraday Prediction Learning Agent. Analyze these pre-market predictions and outcomes:
WINNING PREDICTIONS:
${JSON.stringify(winSamples, null, 2)}

LOSING PREDICTIONS:
${JSON.stringify(lossSamples, null, 2)}

Explain key reasons why winning predictions succeeded and why losing predictions failed.
Identify patterns in confidence score vs direction.`;

      const geminiRes = await generateWithRetry({
        model: "gemini-flash-latest",
        contents: learningPrompt,
        config: {
          systemInstruction:
            "You are an expert quantitative research assistant analyzing intraday trading results.",
        },
      });

      geminiInsights = geminiRes?.text || "";
    } catch (err: any) {
      console.error("[APEX Learning] Gemini meta-learning failed:", err.message);
    }
    
    const weightsToSave = shouldPromote ? normalized : oldWeights;
    
    // De-activate old weights
    if (active) {
      await db.update(apexWeights)
        .set({ isActive: false })
        .where(eq(apexWeights.id, active.id));
    }
    
    // Insert new weight version
    const newVersion = oldVersion + 1;
    
    // Calculate composite accuracy rate for the new weights version
    const successPredictions = await db.select()
      .from(apexPredictions)
      .where(sql`${apexPredictions.isCorrect} = true`);
      
    const allCompletedPredictions = await db.select()
      .from(apexPredictions)
      .where(sql`${apexPredictions.isCorrect} IS NOT NULL`);
      
    const overallAccuracy = allCompletedPredictions.length > 0 ? successPredictions.length / allCompletedPredictions.length : 0.5;
    
    await db.insert(apexWeights).values({
      version: newVersion,
      weights: weightsToSave,
      accuracyRate: String(overallAccuracy),
      sampleSize: totalSamples,
      learningNotes: [
        notes,
        shouldPromote ? 'PROMOTED' : 'REJECTED (old weights kept)',
        prunedFeatures.length > 0 ? `Pruned features: [${prunedFeatures.join(', ')}]` : ''
      ].filter(Boolean).join(' | '),
      isActive: true,
      createdAt: now
    });
    
    // Log unified metrics to engineLearningLog
    await db.insert(engineLearningLog).values({
      engine: "APEX",
      weightVersionFrom: oldVersion,
      weightVersionTo: newVersion,
      sampleSize: totalSamples,
      accuracyBefore: String(oldAccuracy.accuracy.toFixed(4)),
      accuracyAfter: String(newAccuracy.accuracy.toFixed(4)),
      wasPromoted: shouldPromote,
      regime: null, // APEX is same-day global model
      geminiInsights,
      prunedFeatures: prunedFeatures,
      calibrationCurve: null,
    });
    
    // ─── Self-Improving Genome Evolution for APEX ─────────────────────
    // After learning weights, also evolve the scan parameters themselves
    // (confidence threshold, picks per day, feature group proportions)
    try {
      const genomeTrades: TradeOutcome[] = history
        .filter(p => p.isCorrect !== null)
        .map(p => ({
          returnPct: p.actualReturnPct ? parseFloat(p.actualReturnPct) : (p.isCorrect ? 2.0 : -2.0),
          vcpScore: p.confidenceScore ? Math.round(parseFloat(p.confidenceScore)) : undefined,
          newsScore: p.newsScore ? parseFloat(p.newsScore) - 50 : undefined,
        }));

      const genomeResult = await runGenomeEvolution("APEX", genomeTrades, {
        mutations: 20,
        minImprovement: 0.2,
      });
      console.log(
        `[APEX] Genome evolution: ${genomeResult.promoted ? "✅ PROMOTED" : "⬤ unchanged"} | avg return ${genomeResult.oldAvgReturn.toFixed(2)}% → ${genomeResult.newAvgReturn.toFixed(2)}%`,
      );
    } catch (genomeErr: any) {
      console.error("[APEX] Genome evolution failed (non-fatal):", genomeErr.message);
    }
    
    console.log(`[LearningEngine] Learning cycle complete. Weights evolved to Version ${newVersion}.`);
    
    const duration = Date.now() - startTime;
    await markJobDone("learning_cycle", duration);
  } catch (error: any) {
    console.error(`[LearningEngine] Job failed:`, error);
    await markJobFailed("learning_cycle", error);
  }
}
