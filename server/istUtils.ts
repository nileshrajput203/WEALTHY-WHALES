/**
 * IST Timezone Utilities using Intl.DateTimeFormat (no fragile manual offset calculations)
 */

export function getNowIST(): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const map: Record<string, string> = {};
  parts.forEach(p => map[p.type] = p.value);
  
  return new Date(
    parseInt(map.year),
    parseInt(map.month) - 1,
    parseInt(map.day),
    parseInt(map.hour),
    parseInt(map.minute),
    parseInt(map.second)
  );
}

export function getISTHour(date: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false
  });
  return parseInt(formatter.format(date));
}

export function getISTMinute(date: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    minute: 'numeric'
  });
  return parseInt(formatter.format(date));
}

export function isWeekdayIST(date: Date = new Date()): boolean {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short'
  });
  const weekday = formatter.format(date); // 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
  return weekday !== 'Sat' && weekday !== 'Sun';
}

export function getISTDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  parts.forEach(p => map[p.type] = p.value);
  return `${map.year}-${map.month}-${map.day}`;
}

/* ═══════════════════════════════════════════════════════════
   SELF-IMPROVING ENGINE UTILITIES
   Shared helpers for adaptive learning across HERMES, FUGU & APEX
═══════════════════════════════════════════════════════════ */

/**
 * Temporal decay — recent outcomes are weighted more than older ones.
 * Uses exponential decay with a configurable half-life (default 60 days).
 * A 60-day-old outcome has ~50% weight; a 120-day-old outcome has ~25%.
 */
export function getTemporalWeight(
  outcomeDate: Date,
  halfLifeDays: number = 60,
): number {
  const daysAgo =
    (Date.now() - outcomeDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo <= 0) return 1.0;
  return Math.exp((-0.693 * daysAgo) / halfLifeDays);
}

/**
 * Adaptive learning rate — models learn faster when data is scarce,
 * slower (more conservative) when mature.
 */
export function getAdaptiveLearningRate(sampleSize: number): number {
  if (sampleSize < 50) return 0.50;   // Aggressive: mostly new evidence
  if (sampleSize < 200) return 0.35;
  if (sampleSize < 500) return 0.25;
  if (sampleSize < 1000) return 0.15;
  return 0.10;                         // Conservative fine-tuning
}

/**
 * Compute adaptive WIN/LOSS thresholds from recent return distributions.
 * Uses P75 for win, P25 for loss, clamped to safe ranges.
 */
export function computeAdaptiveThresholds(
  recentReturns: number[],
  defaults: { win: number; loss: number } = { win: 5.0, loss: -4.0 },
): { win: number; loss: number } {
  if (recentReturns.length < 20) return defaults;

  const sorted = [...recentReturns].sort((a, b) => a - b);
  const p25Idx = Math.floor(sorted.length * 0.25);
  const p75Idx = Math.floor(sorted.length * 0.75);

  const rawWin = sorted[p75Idx];
  const rawLoss = sorted[p25Idx];

  return {
    win: Math.max(2.0, Math.min(8.0, rawWin)),
    loss: Math.min(-2.0, Math.max(-8.0, rawLoss)),
  };
}

/**
 * A/B backtest: score a set of completed outcomes with a weight vector
 * and return the accuracy. Used to compare old vs new weights.
 */
export function backtestWeightAccuracy(
  outcomes: Array<{
    featureConditions: Record<string, boolean>;
    isWin: boolean;
  }>,
  weights: Record<string, number>,
  scoreThreshold: number = 60,
): { accuracy: number; totalTested: number } {
  if (outcomes.length === 0) return { accuracy: 0.5, totalTested: 0 };

  let correct = 0;
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;

  for (const o of outcomes) {
    let score = 0;
    for (const [key, met] of Object.entries(o.featureConditions)) {
      if (met) score += weights[key] || 0;
    }
    const normalizedScore = (score / totalWeight) * 100;
    const predicted = normalizedScore >= scoreThreshold;
    if (predicted === o.isWin) correct++;
  }

  return {
    accuracy: correct / outcomes.length,
    totalTested: outcomes.length,
  };
}

/**
 * Build a calibration curve: group scores into buckets and compute
 * actual win rate per bucket. Returns a map from bucket to actual win rate.
 */
export function buildCalibrationCurve(
  scoredOutcomes: Array<{ score: number; isWin: boolean }>,
  bucketSize: number = 20,
): Record<string, { count: number; wins: number; winRate: number }> {
  const buckets: Record<string, { count: number; wins: number; winRate: number }> = {};

  for (let start = 0; start < 100; start += bucketSize) {
    const key = `${start}-${start + bucketSize}`;
    buckets[key] = { count: 0, wins: 0, winRate: 0 };
  }

  for (const { score, isWin } of scoredOutcomes) {
    const bucketStart = Math.min(
      Math.floor(score / bucketSize) * bucketSize,
      100 - bucketSize,
    );
    const key = `${bucketStart}-${bucketStart + bucketSize}`;
    if (buckets[key]) {
      buckets[key].count++;
      if (isWin) buckets[key].wins++;
    }
  }

  for (const bucket of Object.values(buckets)) {
    bucket.winRate = bucket.count > 0 ? bucket.wins / bucket.count : 0;
  }

  return buckets;
}

/**
 * Apply a calibration curve to a raw score — returns the calibrated confidence.
 */
export function applyCalibratedConfidence(
  rawScore: number,
  calibration: Record<string, { winRate: number }>,
  bucketSize: number = 20,
): number {
  const bucketStart = Math.min(
    Math.floor(rawScore / bucketSize) * bucketSize,
    100 - bucketSize,
  );
  const key = `${bucketStart}-${bucketStart + bucketSize}`;
  const bucket = calibration[key];
  if (!bucket || bucket.winRate === 0) return rawScore; // fallback to raw
  return Math.round(bucket.winRate * 100);
}
