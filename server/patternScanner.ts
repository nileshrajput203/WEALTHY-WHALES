import { getYahooHistory } from "./stockApi";
import { NSE_UNIQUE } from "./nseUniverse";
import { calculateStockIQ } from "./stockiq";

interface PatternMatch {
  symbol: string;
  stockName: string;
  price: number;
  changePercent: number;
  volume: string;
  pattern: string;
  stage: "Near Breakout" | "Breakout Confirmed" | "Consolidation" | "Pullback";
  details: string;
}

// Memory cache for pattern scans
let patternCache: Record<string, { data: PatternMatch[]; ts: number }> = {};
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Technical heuristics to detect chart patterns
 */
function detectCupAndHandle(closes: number[], highs: number[], lows: number[]): { match: boolean; stage: PatternMatch["stage"]; details: string } | null {
  const n = closes.length;
  if (n < 60) return null;

  // Look back at the last 60 days
  const subCloses = closes.slice(n - 60);
  const current = subCloses[subCloses.length - 1];

  // 1. Find a major peak around 20-50 days ago (Left Cup Rim)
  let leftRimIdx = -1;
  let leftRimVal = 0;
  for (let i = 10; i < 40; i++) {
    const price = subCloses[i];
    if (price > leftRimVal && price > subCloses[i - 5] && price > subCloses[i + 5]) {
      leftRimVal = price;
      leftRimIdx = i;
    }
  }
  if (leftRimIdx === -1) return null;

  // 2. Find the lowest point in the cup bottom between left rim and 10 days ago
  let cupBottomVal = leftRimVal;
  let cupBottomIdx = -1;
  for (let i = leftRimIdx + 5; i < 50; i++) {
    if (subCloses[i] < cupBottomVal) {
      cupBottomVal = subCloses[i];
      cupBottomIdx = i;
    }
  }
  if (cupBottomIdx === -1) return null;

  // Drawdown of cup bottom must be between 10% and 30% (tighter)
  const cupDepth = (leftRimVal - cupBottomVal) / leftRimVal;
  if (cupDepth < 0.10 || cupDepth > 0.30) return null;

  // 3. Right Cup Rim: Price should recover back to within 5% of left rim around 5-15 days ago
  let rightRimIdx = -1;
  let rightRimVal = 0;
  for (let i = cupBottomIdx + 5; i < 55; i++) {
    const price = subCloses[i];
    if (Math.abs(price - leftRimVal) / leftRimVal <= 0.05) {
      if (price > rightRimVal) {
        rightRimVal = price;
        rightRimIdx = i;
      }
    }
  }
  if (rightRimIdx === -1) return null;

  // 4. Handle: A shallow pullback after the right rim
  let handleBottomVal = rightRimVal;
  for (let i = rightRimIdx + 1; i < subCloses.length; i++) {
    if (subCloses[i] < handleBottomVal) {
      handleBottomVal = subCloses[i];
    }
  }

  const handlePullback = (rightRimVal - handleBottomVal) / rightRimVal;
  // Handle should be shallow, between 1.5% and 10% max (tighter)
  if (handlePullback < 0.015 || handlePullback > 0.10) return null;

  // 5. Breakout or Consolidation check
  const isBreakingOut = current >= rightRimVal * 0.99;
  const stage = isBreakingOut ? "Breakout Confirmed" : "Near Breakout";

  return {
    match: true,
    stage,
    details: `U-shaped cup depth: ${(cupDepth * 100).toFixed(1)}%, handle consolidation: -${(handlePullback * 100).toFixed(1)}%`
  };
}

function detectFlagAndPole(closes: number[], highs: number[], lows: number[], vols: number[]): { match: boolean; stage: PatternMatch["stage"]; details: string } | null {
  const n = closes.length;
  if (n < 30) return null;

  // 1. Look for a sharp rise (Pole) of > 15% in a 4-8 day window in the last 15 days (tighter)
  let poleStart = -1;
  let poleEnd = -1;
  let maxPoleGain = 0;

  for (let i = n - 20; i < n - 5; i++) {
    for (let len = 4; len <= 8; len++) {
      if (i + len >= n) continue;
      const startPrice = closes[i];
      const endPrice = closes[i + len];
      const gain = (endPrice - startPrice) / startPrice;
      if (gain > maxPoleGain && gain >= 0.15) {
        maxPoleGain = gain;
        poleStart = i;
        poleEnd = i + len;
      }
    }
  }
  if (poleStart === -1) return null;

  // 2. Look for a consolidation flag immediately following the pole
  const flagCloses = closes.slice(poleEnd + 1);
  if (flagCloses.length < 3 || flagCloses.length > 12) return null;

  const flagMax = Math.max(...flagCloses);
  const flagMin = Math.min(...flagCloses);
  const flagSpread = (flagMax - flagMin) / flagMax;

  // Flag must be narrow consolidation (spread < 5%) and sloping down or flat (tighter)
  if (flagSpread > 0.05) return null;

  const poleEndPrice = closes[poleEnd];
  // Price shouldn't drop below 50% of the pole gain
  const poleBasePrice = closes[poleStart];
  const midPolePrice = poleBasePrice + (poleEndPrice - poleBasePrice) * 0.45;
  if (flagMin < midPolePrice) return null;

  // 3. Confirm Stage
  const current = closes[n - 1];
  const isBreakingOut = current > flagMax * 0.985;
  const stage = isBreakingOut ? "Breakout Confirmed" : "Pullback";

  return {
    match: true,
    stage,
    details: `Flagpole rally: +${(maxPoleGain * 100).toFixed(1)}%, flag consolidation range: ${(flagSpread * 100).toFixed(1)}%`
  };
}

function detectDoubleBottom(closes: number[], highs: number[], lows: number[]): { match: boolean; stage: PatternMatch["stage"]; details: string } | null {
  const n = closes.length;
  if (n < 60) return null;

  const lookback = 60;
  const subLows = lows.slice(n - lookback);
  const subCloses = closes.slice(n - lookback);
  const current = subCloses[subCloses.length - 1];

  // Find two distinct local lows (within last 55 days)
  let low1Idx = -1;
  let low1Val = Infinity;
  let low2Idx = -1;
  let low2Val = Infinity;

  // Find first bottom (low1) in first half of window
  for (let i = 5; i < 30; i++) {
    if (subLows[i] < low1Val && subLows[i] <= subLows[i - 3] && subLows[i] <= subLows[i + 3]) {
      low1Val = subLows[i];
      low1Idx = i;
    }
  }

  // Find second bottom (low2) in second half
  for (let i = 32; i < 55; i++) {
    if (subLows[i] < low2Val && subLows[i] <= subLows[i - 3] && subLows[i] <= subLows[i + 3]) {
      low2Val = subLows[i];
      low2Idx = i;
    }
  }

  if (low1Idx === -1 || low2Idx === -1) return null;
  if (low2Idx - low1Idx < 12) return null; // bottoms must be separated by time

  // Bottom values must be within 1.5% of each other (tighter)
  const difference = Math.abs(low1Val - low2Val) / Math.max(low1Val, low2Val);
  if (difference > 0.015) return null;

  // There must be a peak between them (Neckline)
  let peakVal = 0;
  let peakIdx = -1;
  for (let i = low1Idx + 2; i < low2Idx - 2; i++) {
    if (subCloses[i] > peakVal) {
      peakVal = subCloses[i];
      peakIdx = i;
    }
  }
  if (peakIdx === -1) return null;

  // Neckline peak should represent a rebound of at least 5% from first bottom (tighter)
  const rebound = (peakVal - low1Val) / low1Val;
  if (rebound < 0.05) return null;

  // Confirm setup: current price is rising from bottom 2
  if (current < low2Val) return null;

  const isBreakingOut = current >= peakVal * 0.985;
  const stage = isBreakingOut ? "Breakout Confirmed" : "Consolidation";

  return {
    match: true,
    stage,
    details: `Bottom divergence: ${(difference * 100).toFixed(1)}%, neckline resistance: ₹${peakVal.toFixed(1)}`
  };
}

function detectHeadAndShoulders(closes: number[], highs: number[], lows: number[]): { match: boolean; stage: PatternMatch["stage"]; details: string } | null {
  const n = closes.length;
  if (n < 60) return null;

  // We look for inverse Head & Shoulders (bullish breakout variant)
  const subLows = lows.slice(n - 60);
  const current = closes[n - 1];

  // Find three troughs
  // Head (trough 2) should be the lowest
  let headIdx = -1;
  let headVal = Infinity;
  for (let i = 20; i < 40; i++) {
    if (subLows[i] < headVal && subLows[i] < subLows[i-3] && subLows[i] < subLows[i+3]) {
      headVal = subLows[i];
      headIdx = i;
    }
  }
  if (headIdx === -1) return null;

  // Left Shoulder (trough 1)
  let leftVal = Infinity;
  let leftIdx = -1;
  for (let i = 5; i < headIdx - 5; i++) {
    if (subLows[i] < leftVal && subLows[i] < subLows[i-2] && subLows[i] < subLows[i+2]) {
      leftVal = subLows[i];
      leftIdx = i;
    }
  }

  // Right Shoulder (trough 3)
  let rightVal = Infinity;
  let rightIdx = -1;
  for (let i = headIdx + 5; i < 55; i++) {
    if (subLows[i] < rightVal && subLows[i] < subLows[i-2] && subLows[i] < subLows[i+2]) {
      rightVal = subLows[i];
      rightIdx = i;
    }
  }

  if (leftIdx === -1 || rightIdx === -1) return null;

  // Head must be lower than both shoulders
  if (headVal >= leftVal || headVal >= rightVal) return null;

  // Left and Right shoulders must be within 2% of each other in price (tighter)
  const shoulderDiff = Math.abs(leftVal - rightVal) / Math.max(leftVal, rightVal);
  if (shoulderDiff > 0.02) return null;

  // Find neckline resistance levels (peaks between shoulders)
  let peak1 = 0;
  for (let i = leftIdx; i < headIdx; i++) {
    if (closes[n - 60 + i] > peak1) peak1 = closes[n - 60 + i];
  }
  let peak2 = 0;
  for (let i = headIdx; i < rightIdx; i++) {
    if (closes[n - 60 + i] > peak2) peak2 = closes[n - 60 + i];
  }

  const averageNeckline = (peak1 + peak2) / 2;
  // Neckline should be higher than right shoulder
  if (averageNeckline <= rightVal) return null;

  // Is price breaking out of neckline?
  const isBreakingOut = current >= averageNeckline * 0.985;
  const stage = isBreakingOut ? "Breakout Confirmed" : "Pullback";

  return {
    match: true,
    stage,
    details: `Inverse H&S shoulders symmetry: ${(shoulderDiff * 100).toFixed(1)}%, neckline breakout zone: ₹${averageNeckline.toFixed(1)}`
  };
}

function detectAscendingTriangle(closes: number[], highs: number[], lows: number[]): { match: boolean; stage: PatternMatch["stage"]; details: string } | null {
  const n = closes.length;
  if (n < 50) return null;

  const subHighs = highs.slice(n - 45);
  const subLows = lows.slice(n - 45);
  const current = closes[n - 1];

  // 1. Check for flat resistance on top (multiple highs within 1.5% of each other)
  let peakVal = 0;
  let peakCount = 0;
  
  // Find local peaks
  const localPeaks: { val: number; idx: number }[] = [];
  for (let i = 3; i < 42; i++) {
    const val = subHighs[i];
    if (val > subHighs[i - 3] && val > subHighs[i + 3]) {
      localPeaks.push({ val, idx: i });
    }
  }

  if (localPeaks.length < 2) return null;

  // Find flat level (tighter 1%)
  let resistanceLevel = 0;
  for (let i = 0; i < localPeaks.length; i++) {
    let matches = 1;
    const ref = localPeaks[i].val;
    for (let j = i + 1; j < localPeaks.length; j++) {
      if (Math.abs(localPeaks[j].val - ref) / ref <= 0.01) {
        matches++;
      }
    }
    if (matches >= 2 && ref > resistanceLevel) {
      resistanceLevel = ref;
    }
  }
  if (resistanceLevel === 0) return null;

  // 2. Check for rising swing lows underneath
  const localLows: { val: number; idx: number }[] = [];
  for (let i = 3; i < 42; i++) {
    const val = subLows[i];
    if (val < subLows[i - 3] && val < subLows[i + 3]) {
      localLows.push({ val, idx: i });
    }
  }
  if (localLows.length < 2) return null;

  // Make sure the troughs are ascending
  let isAscending = true;
  let ascendingCount = 0;
  for (let i = 1; i < localLows.length; i++) {
    if (localLows[i].val > localLows[i - 1].val) {
      ascendingCount++;
    }
  }
  if (ascendingCount < 1) return null;

  // 3. Current price should be consolidating near resistance
  if (current > resistanceLevel * 1.05) return null; // already ran too far
  if (current < localLows[localLows.length - 1].val) return null; // broken to the downside

  const isBreakingOut = current >= resistanceLevel * 0.99;
  const stage = isBreakingOut ? "Breakout Confirmed" : "Consolidation";

  return {
    match: true,
    stage,
    details: `Ascending lows, flat resistance overhead at ₹${resistanceLevel.toFixed(1)}`
  };
}

/**
 * Scan NSE universe for a specific pattern
 */
export async function runPatternScanner(
  patternType: string,
  options: { cap?: string; fundamentals?: boolean; momentum?: boolean } = {}
): Promise<PatternMatch[]> {
  const normPattern = patternType.toLowerCase().replace(/[-_]/g, "");
  const cacheKey = `${normPattern}_${options.cap || "all"}_${options.fundamentals ? "f" : ""}_${options.momentum ? "m" : ""}`;

  // Return cached results if fresh
  if (patternCache[cacheKey] && Date.now() - patternCache[cacheKey].ts < CACHE_TTL) {
    console.log(`[Pattern Scanner] Returning cached matches for ${cacheKey}`);
    return patternCache[cacheKey].data;
  }

  console.log(`[Pattern Scanner] Running scan for: ${cacheKey} over NSE universe...`);
  const rawMatches: PatternMatch[] = [];

  // Batch process top 160 active stocks to avoid Yahoo rate limits and maintain responsive speed
  const baseList = NSE_UNIQUE.slice(0, 160); 
  const batchSize = 15;

  for (let i = 0; i < baseList.length; i += batchSize) {
    const batch = baseList.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async (sym) => {
        try {
          const yahooSym = sym.includes(".") ? sym : `${sym}.NS`;
          const candles = await getYahooHistory(yahooSym, "6mo", "1d");
          if (!candles || candles.length < 50) return;

          const closes = candles.map((c: any) => Number(c.close));
          const highs = candles.map((c: any) => Number(c.high));
          const lows = candles.map((c: any) => Number(c.low));
          const vols = candles.map((c: any) => Number(c.volume));

          const lastClose = closes[closes.length - 1];
          const prevClose = closes[closes.length - 2];
          const chg = ((lastClose - prevClose) / prevClose) * 100;
          const volStr = (vols[vols.length - 1] || 0).toLocaleString("en-IN");
          const cleanSym = sym.replace(/\.(NS|BO)$/i, "");

          let result: { match: boolean; stage: PatternMatch["stage"]; details: string } | null = null;

          if (normPattern === "cupandhandle") {
            result = detectCupAndHandle(closes, highs, lows);
          } else if (normPattern === "flagandpole") {
            result = detectFlagAndPole(closes, highs, lows, vols);
          } else if (normPattern === "doublebottom") {
            result = detectDoubleBottom(closes, highs, lows);
          } else if (normPattern === "headandshoulders" || normPattern === "inverseheadandshoulders") {
            result = detectHeadAndShoulders(closes, highs, lows);
          } else if (normPattern === "ascendingtriangle") {
            result = detectAscendingTriangle(closes, highs, lows);
          }

          if (result && result.match) {
            rawMatches.push({
              symbol: yahooSym,
              stockName: cleanSym,
              price: Number(lastClose.toFixed(2)),
              changePercent: Number(chg.toFixed(2)),
              volume: volStr,
              pattern: patternType,
              stage: result.stage,
              details: result.details,
            });
          }
        } catch (e) {
          // ignore failures for individual tickers
        }
      })
    );

    if (i + batchSize < baseList.length) {
      await new Promise((res) => setTimeout(res, 80));
    }
  }

  // Now apply fundamentals, momentum, and cap filters to matched stocks
  const finalMatches: PatternMatch[] = [];
  for (const match of rawMatches) {
    let passed = true;
    if (options.fundamentals || options.momentum || (options.cap && options.cap !== "all")) {
      try {
        const stockIq = await calculateStockIQ(match.symbol);
        
        if (options.fundamentals && stockIq.fundamentals.score < 60) {
          passed = false;
        }
        if (options.momentum && stockIq.momentum.score < 60) {
          passed = false;
        }
        if (options.cap && options.cap !== "all") {
          const capMetric = stockIq.insider.metrics.find((m) => m.name === "Market Cap");
          const capStr = String(capMetric?.value || "").toLowerCase();
          if (!capStr.includes(options.cap.toLowerCase())) {
            passed = false;
          }
        }
        if (passed) {
          // Add extra details about why it passed
          match.details += ` | StockIQ: F${stockIq.fundamentals.score}/M${stockIq.momentum.score}`;
        }
      } catch (err) {
        // If we can't fetch StockIQ, and strict filters are on, we drop it.
        passed = false;
      }
    }
    
    if (passed) {
      finalMatches.push(match);
    }
  }

  // Sort matches by changePercent descending
  finalMatches.sort((a, b) => b.changePercent - a.changePercent);

  // Cache results
  patternCache[cacheKey] = { data: finalMatches, ts: Date.now() };
  return finalMatches;
}
