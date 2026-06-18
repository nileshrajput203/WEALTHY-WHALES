import { db } from "./db";
import { apexPredictions, apexWeights } from "@shared/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getNowIST } from "./istUtils";
import { markJobStart, markJobDone, markJobFailed, logError } from "./jobLedger";
import { APEX_DEFAULT_WEIGHTS } from "./apexEngine";

/**
 * Computes individual directional accuracy for all 30 features.
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
    let correctCount = 0;
    let totalCount = 0;
    
    for (const pred of history) {
      const features = pred.features as Record<string, number> || {};
      const val = features[name];
      if (val === undefined || val === null) continue;
      
      const actualY = (pred.direction === "UP" && pred.isCorrect === true) || 
                      (pred.direction === "DOWN" && pred.isCorrect === false) ? 1 : -1;
                      
      const isCorrect = (val > 0.05 && actualY === 1) || (val < -0.05 && actualY === -1);
      
      if (isCorrect) {
        correctCount++;
      }
      totalCount++;
    }
    
    accuracies[name] = totalCount > 0 ? correctCount / totalCount : 0.5;
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
    // If somehow total is 0, return equal weights
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
    
    // 60/40 blend if samples < 100, 70/30 blend if samples >= 100
    const blendNew = totalSamples < 100 ? 0.4 : 0.3;
    const blendOld = 1.0 - blendNew;
    
    const newWeights: Record<string, number> = {};
    for (const name of Object.keys(oldWeights)) {
      const oldW = oldWeights[name] || 0.0;
      const targetW = accuracies[name] !== undefined ? accuracies[name] : 0.5;
      newWeights[name] = (blendOld * oldW) + (blendNew * targetW);
    }
    
    const normalized = normalizeWeights(newWeights);
    const notes = generateLearningNotes(oldWeights, normalized, totalSamples, accuracies);
    
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
      weights: normalized,
      accuracyRate: String(overallAccuracy),
      sampleSize: totalSamples,
      learningNotes: notes,
      isActive: true,
      createdAt: now
    });
    
    console.log(`[LearningEngine] Learning cycle complete. Weights evolved to Version ${newVersion}.`);
    
    const duration = Date.now() - startTime;
    await markJobDone("learning_cycle", duration);
  } catch (error: any) {
    console.error(`[LearningEngine] Job failed:`, error);
    await markJobFailed("learning_cycle", error);
  }
}
