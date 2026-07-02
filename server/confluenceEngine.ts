import { getHermesStockSnapshot } from "./hermesEngine";
import { getFuguStockSnapshot } from "./fuguEngine";
import { getApexPrediction } from "./apexEngine";
import { db } from "./db";
import { confluenceSignals } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Computes the unified confluence score for a given symbol by aggregating
 * predictions and signals from HERMES, FUGU, and APEX engines.
 */
export async function computeConfluenceScore(symbol: string): Promise<{
  symbol: string;
  confluenceScore: number;
  enginesAgreeing: string[];
  conflictingEngines: string[];
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'AVOID' | 'STRONG_AVOID';
  scores: {
    hermes: number | null;
    fugu: number | null;
    apex: number | null;
  };
}> {
  const symbolUpper = symbol.toUpperCase();

  const [snapHermes, snapFugu, predApex] = await Promise.all([
    getHermesStockSnapshot(symbolUpper),
    getFuguStockSnapshot(symbolUpper),
    getApexPrediction(symbolUpper),
  ]);

  const hermesScore = snapHermes ? Number(snapHermes.hermesScore) : null;
  const fuguScore = snapFugu ? Number(snapFugu.fuguScore) : null;
  const apexScore = predApex ? Number(predApex.confidenceScore) : null;

  // Classify signals per engine: BUY/UP is positive (+1), AVOID/DOWN is negative (-1), HOLD/NEUTRAL is 0
  let hermesSignal = 0;
  if (hermesScore !== null) {
    hermesSignal = hermesScore >= 70 ? 1 : hermesScore <= 45 ? -1 : 0;
  }

  let fuguSignal = 0;
  if (fuguScore !== null) {
    fuguSignal = fuguScore >= 68 ? 1 : fuguScore <= 45 ? -1 : 0;
  }

  let apexSignal = 0;
  if (predApex !== null) {
    apexSignal = predApex.direction === "UP" ? 1 : -1;
  }

  const scoresList = [hermesScore, fuguScore, apexScore].filter((s): s is number => s !== null);
  
  if (scoresList.length === 0) {
    return {
      symbol: symbolUpper,
      confluenceScore: 50,
      enginesAgreeing: [],
      conflictingEngines: [],
      recommendation: 'HOLD',
      scores: { hermes: null, fugu: null, apex: null }
    };
  }

  let avgScore = scoresList.reduce((a, b) => a + b, 0) / scoresList.length;

  const enginesAgreeing: string[] = [];
  const conflictingEngines: string[] = [];
  
  const signals = [
    { name: "HERMES", signal: hermesSignal, val: hermesScore },
    { name: "FUGU", signal: fuguSignal, val: fuguScore },
    { name: "APEX", signal: apexSignal, val: apexScore },
  ].filter(s => s.val !== null);

  // Group signals by direction
  const positive = signals.filter(s => s.signal === 1);
  const negative = signals.filter(s => s.signal === -1);

  if (positive.length > 0 && negative.length === 0) {
    enginesAgreeing.push(...positive.map(s => s.name));
    // Confluence bonus: add +4 per agreeing engine if multiple
    if (positive.length >= 2) {
      avgScore += positive.length * 4;
    }
  } else if (negative.length > 0 && positive.length === 0) {
    enginesAgreeing.push(...negative.map(s => s.name));
    // Confluence penalty: reduce score for alignment on avoid/down
    avgScore -= negative.length * 4;
  } else {
    // Signals are conflicting
    conflictingEngines.push(...positive.map(s => s.name), ...negative.map(s => s.name));
  }

  const confluenceScore = Math.max(0, Math.min(100, Math.round(avgScore)));

  let recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'AVOID' | 'STRONG_AVOID' = 'HOLD';
  if (confluenceScore >= 75) recommendation = 'STRONG_BUY';
  else if (confluenceScore >= 60) recommendation = 'BUY';
  else if (confluenceScore >= 40) recommendation = 'HOLD';
  else if (confluenceScore >= 25) recommendation = 'AVOID';
  else recommendation = 'STRONG_AVOID';

  return {
    symbol: symbolUpper,
    confluenceScore,
    enginesAgreeing,
    conflictingEngines,
    recommendation,
    scores: {
      hermes: hermesScore,
      fugu: fuguScore,
      apex: apexScore,
    }
  };
}

/**
 * Inserts a computed confluence signal to the DB for outcome tracking.
 */
export async function trackConfluenceSignal(symbol: string): Promise<void> {
  try {
    const result = await computeConfluenceScore(symbol);
    
    await db.insert(confluenceSignals).values({
      symbol: result.symbol,
      hermesScore: result.scores.hermes ? String(result.scores.hermes) : null,
      fuguScore: result.scores.fugu ? String(result.scores.fugu) : null,
      apexScore: result.scores.apex ? String(result.scores.apex) : null,
      confluenceScore: String(result.confluenceScore),
      enginesAgreeing: result.enginesAgreeing.length,
      recommendation: result.recommendation,
    });
  } catch (err: any) {
    console.error(`[Confluence Engine] Failed to track confluence signal for ${symbol}:`, err.message);
  }
}
