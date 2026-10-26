/**
 * ORDER BLOCK & SMART MONEY CONCEPTS (SMC) ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Modeled after institutional Smart Money Concepts (ICT / OrderBlock.com):
 *  1. Order Blocks (OB): Bullish (+OB Demand) and Bearish (-OB Supply)
 *  2. Fair Value Gaps (FVG) / Liquidity Imbalances
 *  3. Market Structure: Break of Structure (BOS) & Change of Character (CHoCH)
 *  4. Liquidity Pools & Sweeps: Buy-Side (BSL) and Sell-Side (SSL)
 *  5. Premium vs. Discount Equilibrium Zone Analysis
 *  6. Confirmation Score (0-100) & Actionable Institutional Setup
 */

import { candleCache } from "./candleCache";
import { NIFTY_50, NSE_UNIVERSE } from "./nseUniverse";

export interface OrderBlockZone {
  id: string;
  type: "BULLISH_OB" | "BEARISH_OB";
  high: number;
  low: number;
  meanThreshold: number; // 50% midpoint of the order block
  candleIndex: number;
  timestamp: string;
  status: "UNMITIGATED" | "MITIGATED" | "BREACHED";
  volume: number;
  volumeRatio: number; // vs 20 SMA volume
  displacementPct: number; // % move generated after the block
  hasFvgConfluence: boolean;
  distanceFromSpotPct: number; // % difference to current price
  strength: "ELITE" | "HIGH" | "MODERATE";
}

export interface FairValueGap {
  id: string;
  type: "BULLISH_FVG" | "BEARISH_FVG";
  top: number;
  bottom: number;
  midpoint: number;
  timestamp: string;
  status: "OPEN" | "PARTIALLY_FILLED" | "FILLED";
  fillPercentage: number;
}

export interface LiquidityPool {
  id: string;
  type: "BUY_SIDE_LIQUIDITY" | "SELL_SIDE_LIQUIDITY";
  level: number;
  status: "UNTAPPED" | "SWEPT";
  sweepTimestamp?: string;
  touchCount: number;
}

export interface OrderBlockAnalysisResult {
  symbol: string;
  lastClose: number;
  timestamp: string;
  orderBlocks: {
    activeDemandOB: OrderBlockZone | null;
    activeSupplyOB: OrderBlockZone | null;
    allZones: OrderBlockZone[];
  };
  fairValueGaps: FairValueGap[];
  liquidityPools: LiquidityPool[];
  marketStructure: {
    bias: "BULLISH" | "BEARISH" | "RANGING";
    lastStructureBreak: "BOS_UP" | "BOS_DOWN" | "CHOCH_UP" | "CHOCH_DOWN" | "NONE";
    structureBreakPrice: number;
    breakTimestamp?: string;
  };
  pricingMatrix: {
    dealingRangeHigh: number;
    dealingRangeLow: number;
    equilibrium50: number;
    zone: "DISCOUNT" | "PREMIUM" | "EQUILIBRIUM";
    discountDepthPct: number;
  };
  confirmation: {
    score: number; // 0 - 100
    grade: "PRIME_A+" | "STRONG_A" | "VALID_B" | "NEUTRAL_C" | "AVOID";
    actionableSetup: string;
    confluenceFactors: string[];
    riskRewardRatio: string;
    suggestedTrade: {
      action: "BUY_LIMIT" | "SELL_LIMIT" | "WAIT_PULLBACK" | "WATCH";
      entryZone: string;
      stopLoss: number;
      target1: number;
      target2: number;
    };
  };
}

/**
 * Detect Order Blocks, FVGs, Liquidity Pools, and Market Structure from candle series.
 */
export function computeOrderBlockAnalysis(candles: any[], symbol: string): OrderBlockAnalysisResult | null {
  if (!candles || candles.length < 50) return null;

  const n = candles.length;
  const closes = candles.map(c => Number(c.close));
  const opens  = candles.map(c => Number(c.open));
  const highs  = candles.map(c => Number(c.high));
  const lows   = candles.map(c => Number(c.low));
  const vols   = candles.map(c => Number(c.volume || 0));
  const lastClose = closes[n - 1];

  // Compute 20-period average volume
  const avgVols = vols.map((_, i) => {
    const start = Math.max(0, i - 19);
    const slice = vols.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / Math.max(1, slice.length);
  });

  // ── 1. FAIR VALUE GAPS (FVG / Imbalances) ──────────────────────────────────
  const fvgs: FairValueGap[] = [];
  for (let i = 2; i < n - 1; i++) {
    // Bullish FVG: Candle 1 High < Candle 3 Low
    if (lows[i] > highs[i - 2]) {
      const top = lows[i];
      const bottom = highs[i - 2];
      const midpoint = (top + bottom) / 2;

      // Check fill status in subsequent candles
      let lowestTouch = top;
      for (let j = i + 1; j < n; j++) {
        if (lows[j] < lowestTouch) lowestTouch = lows[j];
      }

      let fillPct = 0;
      if (lowestTouch <= bottom) {
        fillPct = 100;
      } else if (lowestTouch < top) {
        fillPct = Math.round(((top - lowestTouch) / (top - bottom)) * 100);
      }

      const status = fillPct >= 95 ? "FILLED" : fillPct > 15 ? "PARTIALLY_FILLED" : "OPEN";

      fvgs.push({
        id: `fvg_bull_${i}`,
        type: "BULLISH_FVG",
        top: Number(top.toFixed(2)),
        bottom: Number(bottom.toFixed(2)),
        midpoint: Number(midpoint.toFixed(2)),
        timestamp: new Date(candles[i - 1].time).toISOString(),
        status,
        fillPercentage: fillPct,
      });
    }

    // Bearish FVG: Candle 1 Low > Candle 3 High
    if (highs[i] < lows[i - 2]) {
      const top = lows[i - 2];
      const bottom = highs[i];
      const midpoint = (top + bottom) / 2;

      let highestTouch = bottom;
      for (let j = i + 1; j < n; j++) {
        if (highs[j] > highestTouch) highestTouch = highs[j];
      }

      let fillPct = 0;
      if (highestTouch >= top) {
        fillPct = 100;
      } else if (highestTouch > bottom) {
        fillPct = Math.round(((highestTouch - bottom) / (top - bottom)) * 100);
      }

      const status = fillPct >= 95 ? "FILLED" : fillPct > 15 ? "PARTIALLY_FILLED" : "OPEN";

      fvgs.push({
        id: `fvg_bear_${i}`,
        type: "BEARISH_FVG",
        top: Number(top.toFixed(2)),
        bottom: Number(bottom.toFixed(2)),
        midpoint: Number(midpoint.toFixed(2)),
        timestamp: new Date(candles[i - 1].time).toISOString(),
        status,
        fillPercentage: fillPct,
      });
    }
  }

  // ── 2. ORDER BLOCKS (Institutional Footprints) ──────────────────────────────
  const orderBlocks: OrderBlockZone[] = [];
  const lookback = Math.min(n - 5, 120);

  for (let i = n - lookback; i < n - 3; i++) {
    const isBearishCandle = closes[i] < opens[i];
    const isBullishCandle = closes[i] > opens[i];

    // Bullish OB (+OB): Last down candle before an explosive move up that breaks the high of preceding 5 candles
    if (isBearishCandle) {
      const nextMove = (closes[i + 2] - closes[i]) / closes[i];
      const nextHigh = Math.max(highs[i + 1], highs[i + 2], highs[i + 3]);
      const prevLocalHigh = Math.max(...highs.slice(Math.max(0, i - 5), i));

      if (nextMove > 0.02 && nextHigh > prevLocalHigh) {
        const obHigh = Math.max(opens[i], highs[i]);
        const obLow = lows[i];
        const mean = (obHigh + obLow) / 2;
        const volRatio = vols[i] / Math.max(1, avgVols[i]);

        // Check subsequent mitigation
        let mitigated = false;
        let breached = false;
        for (let k = i + 3; k < n; k++) {
          if (lows[k] <= obHigh && closes[k] >= obLow) mitigated = true;
          if (closes[k] < obLow) breached = true;
        }

        const status = breached ? "BREACHED" : mitigated ? "MITIGATED" : "UNMITIGATED";
        const distPct = ((lastClose - obHigh) / obHigh) * 100;

        // Check if an FVG was formed immediately after
        const hasFvg = fvgs.some(f => f.type === "BULLISH_FVG" && Math.abs(f.bottom - obHigh) / obHigh < 0.025);

        orderBlocks.push({
          id: `ob_bull_${i}`,
          type: "BULLISH_OB",
          high: Number(obHigh.toFixed(2)),
          low: Number(obLow.toFixed(2)),
          meanThreshold: Number(mean.toFixed(2)),
          candleIndex: i,
          timestamp: new Date(candles[i].time).toISOString(),
          status,
          volume: vols[i],
          volumeRatio: Number(volRatio.toFixed(2)),
          displacementPct: Number((nextMove * 100).toFixed(2)),
          hasFvgConfluence: hasFvg,
          distanceFromSpotPct: Number(distPct.toFixed(2)),
          strength: volRatio > 1.8 && hasFvg ? "ELITE" : volRatio > 1.2 ? "HIGH" : "MODERATE",
        });
      }
    }

    // Bearish OB (-OB): Last up candle before an explosive move down that breaks preceding local low
    if (isBullishCandle) {
      const nextMove = (closes[i] - closes[i + 2]) / closes[i];
      const nextLow = Math.min(lows[i + 1], lows[i + 2], lows[i + 3]);
      const prevLocalLow = Math.min(...lows.slice(Math.max(0, i - 5), i));

      if (nextMove > 0.02 && nextLow < prevLocalLow) {
        const obHigh = highs[i];
        const obLow = Math.min(opens[i], lows[i]);
        const mean = (obHigh + obLow) / 2;
        const volRatio = vols[i] / Math.max(1, avgVols[i]);

        let mitigated = false;
        let breached = false;
        for (let k = i + 3; k < n; k++) {
          if (highs[k] >= obLow && closes[k] <= obHigh) mitigated = true;
          if (closes[k] > obHigh) breached = true;
        }

        const status = breached ? "BREACHED" : mitigated ? "MITIGATED" : "UNMITIGATED";
        const distPct = ((obLow - lastClose) / lastClose) * 100;
        const hasFvg = fvgs.some(f => f.type === "BEARISH_FVG" && Math.abs(f.top - obLow) / obLow < 0.025);

        orderBlocks.push({
          id: `ob_bear_${i}`,
          type: "BEARISH_OB",
          high: Number(obHigh.toFixed(2)),
          low: Number(obLow.toFixed(2)),
          meanThreshold: Number(mean.toFixed(2)),
          candleIndex: i,
          timestamp: new Date(candles[i].time).toISOString(),
          status,
          volume: vols[i],
          volumeRatio: Number(volRatio.toFixed(2)),
          displacementPct: Number((nextMove * 100).toFixed(2)),
          hasFvgConfluence: hasFvg,
          distanceFromSpotPct: Number(distPct.toFixed(2)),
          strength: volRatio > 1.8 && hasFvg ? "ELITE" : volRatio > 1.2 ? "HIGH" : "MODERATE",
        });
      }
    }
  }

  // Find the closest active unbreached Bullish Demand OB and Bearish Supply OB
  const validDemandOBs = orderBlocks
    .filter(ob => ob.type === "BULLISH_OB" && ob.status !== "BREACHED" && ob.high <= lastClose * 1.02)
    .sort((a, b) => Math.abs(lastClose - a.high) - Math.abs(lastClose - b.high));

  const validSupplyOBs = orderBlocks
    .filter(ob => ob.type === "BEARISH_OB" && ob.status !== "BREACHED" && ob.low >= lastClose * 0.98)
    .sort((a, b) => Math.abs(a.low - lastClose) - Math.abs(b.low - lastClose));

  const activeDemandOB = validDemandOBs[0] || null;
  const activeSupplyOB = validSupplyOBs[0] || null;

  // ── 3. LIQUIDITY POOLS (Buy-Side BSL & Sell-Side SSL) ──────────────────────
  const liquidityPools: LiquidityPool[] = [];
  const swingWindow = 5;

  for (let i = swingWindow; i < n - swingWindow; i++) {
    const isSwingHigh = highs.slice(i - swingWindow, i).every(h => h <= highs[i]) &&
                        highs.slice(i + 1, i + swingWindow + 1).every(h => h <= highs[i]);

    const isSwingLow = lows.slice(i - swingWindow, i).every(l => l >= lows[i]) &&
                       lows.slice(i + 1, i + swingWindow + 1).every(l => l >= lows[i]);

    if (isSwingHigh) {
      const level = highs[i];
      let swept = false;
      let sweepTime: string | undefined;

      for (let j = i + 1; j < n; j++) {
        if (highs[j] > level) {
          swept = true;
          sweepTime = new Date(candles[j].time).toISOString();
          break;
        }
      }

      liquidityPools.push({
        id: `liq_bsl_${i}`,
        type: "BUY_SIDE_LIQUIDITY",
        level: Number(level.toFixed(2)),
        status: swept ? "SWEPT" : "UNTAPPED",
        sweepTimestamp: sweepTime,
        touchCount: highs.filter(h => Math.abs(h - level) / level < 0.005).length,
      });
    }

    if (isSwingLow) {
      const level = lows[i];
      let swept = false;
      let sweepTime: string | undefined;

      for (let j = i + 1; j < n; j++) {
        if (lows[j] < level) {
          swept = true;
          sweepTime = new Date(candles[j].time).toISOString();
          break;
        }
      }

      liquidityPools.push({
        id: `liq_ssl_${i}`,
        type: "SELL_SIDE_LIQUIDITY",
        level: Number(level.toFixed(2)),
        status: swept ? "SWEPT" : "UNTAPPED",
        sweepTimestamp: sweepTime,
        touchCount: lows.filter(l => Math.abs(l - level) / level < 0.005).length,
      });
    }
  }

  // ── 4. PREMIUM VS. DISCOUNT DEALING RANGE MATRIX ───────────────────────────
  const rangeLookback = Math.min(n, 60);
  const dealingRangeHigh = Math.max(...highs.slice(n - rangeLookback));
  const dealingRangeLow  = Math.min(...lows.slice(n - rangeLookback));
  const equilibrium50 = (dealingRangeHigh + dealingRangeLow) / 2;
  const rangeSpan = Math.max(1, dealingRangeHigh - dealingRangeLow);
  const positionInRange = (lastClose - dealingRangeLow) / rangeSpan;

  const zone: "DISCOUNT" | "PREMIUM" | "EQUILIBRIUM" =
    positionInRange < 0.45 ? "DISCOUNT" : positionInRange > 0.55 ? "PREMIUM" : "EQUILIBRIUM";

  const discountDepthPct = Number(((1 - positionInRange) * 100).toFixed(1));

  // ── 5. MARKET STRUCTURE (BOS vs CHoCH) ────────────────────────────────────
  const recentHighs = highs.slice(n - 20);
  const recentLows = lows.slice(n - 20);
  const prevPeak = Math.max(...recentHighs.slice(0, 10));
  const prevTrough = Math.min(...recentLows.slice(0, 10));

  let lastStructureBreak: "BOS_UP" | "BOS_DOWN" | "CHOCH_UP" | "CHOCH_DOWN" | "NONE" = "NONE";
  let structureBreakPrice = 0;

  if (lastClose > prevPeak) {
    lastStructureBreak = closes[n - 2] <= prevPeak ? "CHOCH_UP" : "BOS_UP";
    structureBreakPrice = prevPeak;
  } else if (lastClose < prevTrough) {
    lastStructureBreak = closes[n - 2] >= prevTrough ? "CHOCH_DOWN" : "BOS_DOWN";
    structureBreakPrice = prevTrough;
  }

  const ema50 = closes.slice(Math.max(0, n - 50)).reduce((a, b) => a + b, 0) / Math.min(n, 50);
  const bias: "BULLISH" | "BEARISH" | "RANGING" =
    lastClose > ema50 && (lastStructureBreak === "BOS_UP" || lastStructureBreak === "CHOCH_UP")
      ? "BULLISH"
      : lastClose < ema50 && (lastStructureBreak === "BOS_DOWN" || lastStructureBreak === "CHOCH_DOWN")
      ? "BEARISH"
      : "RANGING";

  // ── 6. INSTITUTIONAL CONFIRMATION SCORE (0-100) ───────────────────────────
  let score = 50;
  const confluenceFactors: string[] = [];

  // Check proximity to Active Demand OB
  if (activeDemandOB) {
    const distToDemand = Math.abs(lastClose - activeDemandOB.high) / activeDemandOB.high;
    if (distToDemand < 0.02) {
      score += 20;
      confluenceFactors.push(`Trading inside +OB Demand Zone (₹${activeDemandOB.low} - ₹${activeDemandOB.high})`);
    } else if (distToDemand < 0.05) {
      score += 10;
      confluenceFactors.push(`Approaching unmitigated Demand OB (${(distToDemand * 100).toFixed(1)}% away)`);
    }
    if (activeDemandOB.hasFvgConfluence) {
      score += 10;
      confluenceFactors.push("High-Volume Displacement with Fair Value Gap confluence");
    }
  }

  // Discount vs Premium Alignment
  if (zone === "DISCOUNT") {
    score += 12;
    confluenceFactors.push(`Priced in Deep Institutional Discount (${discountDepthPct}% below dealing high)`);
  } else if (zone === "PREMIUM") {
    score -= 10;
    confluenceFactors.push("Caution: Priced in Premium Zone (Unfavorable for fresh long orders)");
  }

  // Market Structure alignment
  if (bias === "BULLISH") {
    score += 12;
    confluenceFactors.push("Market Structure Bullish with confirmed upward displacement");
  } else if (bias === "BEARISH") {
    score -= 15;
    confluenceFactors.push("Market Structure Bearish with lower highs and lower lows");
  }

  // Untapped Buy-Side Liquidity above
  const untappedBsl = liquidityPools.find(p => p.type === "BUY_SIDE_LIQUIDITY" && p.status === "UNTAPPED" && p.level > lastClose);
  if (untappedBsl) {
    score += 8;
    confluenceFactors.push(`Clear Buy-Side Liquidity (BSL) target overhead at ₹${untappedBsl.level}`);
  }

  score = Math.max(10, Math.min(96, score));

  const grade: "PRIME_A+" | "STRONG_A" | "VALID_B" | "NEUTRAL_C" | "AVOID" =
    score >= 82 ? "PRIME_A+" : score >= 70 ? "STRONG_A" : score >= 55 ? "VALID_B" : score >= 40 ? "NEUTRAL_C" : "AVOID";

  // Trade Setup Plan
  const stopLoss = activeDemandOB ? activeDemandOB.low * 0.99 : lastClose * 0.96;
  const target1 = untappedBsl ? untappedBsl.level : activeSupplyOB ? activeSupplyOB.low : lastClose * 1.06;
  const target2 = target1 * 1.04;
  const risk = Math.max(1, lastClose - stopLoss);
  const reward = Math.max(1, target1 - lastClose);
  const rrRatio = (reward / risk).toFixed(1);

  let action: "BUY_LIMIT" | "SELL_LIMIT" | "WAIT_PULLBACK" | "WATCH" = "WATCH";
  let actionableSetup = "Observe price action; waiting for institutional displacement or liquidity sweep.";

  if (grade === "PRIME_A+" || grade === "STRONG_A") {
    action = activeDemandOB && Math.abs(lastClose - activeDemandOB.high) / lastClose < 0.015 ? "BUY_LIMIT" : "WAIT_PULLBACK";
    actionableSetup = `High-probability institutional demand retest. Accumulate in +OB zone (₹${activeDemandOB?.low || (lastClose * 0.98).toFixed(1)} - ₹${activeDemandOB?.high || lastClose.toFixed(1)}). Stop Loss at ₹${stopLoss.toFixed(1)}.`;
  } else if (zone === "PREMIUM" && activeSupplyOB && Math.abs(lastClose - activeSupplyOB.low) / lastClose < 0.02) {
    action = "SELL_LIMIT";
    actionableSetup = `Institutional supply mitigation zone. Resistance active at ₹${activeSupplyOB.low} - ₹${activeSupplyOB.high}. Take profits or seek short setups.`;
  }

  return {
    symbol: symbol.toUpperCase(),
    lastClose: Number(lastClose.toFixed(2)),
    timestamp: new Date().toISOString(),
    orderBlocks: {
      activeDemandOB,
      activeSupplyOB,
      allZones: orderBlocks.slice(-8).reverse(),
    },
    fairValueGaps: fvgs.slice(-8).reverse(),
    liquidityPools: liquidityPools.slice(-8).reverse(),
    marketStructure: {
      bias,
      lastStructureBreak,
      structureBreakPrice: Number(structureBreakPrice.toFixed(2)),
      breakTimestamp: new Date(candles[n - 2].time).toISOString(),
    },
    pricingMatrix: {
      dealingRangeHigh: Number(dealingRangeHigh.toFixed(2)),
      dealingRangeLow: Number(dealingRangeLow.toFixed(2)),
      equilibrium50: Number(equilibrium50.toFixed(2)),
      zone,
      discountDepthPct,
    },
    confirmation: {
      score,
      grade,
      actionableSetup,
      confluenceFactors,
      riskRewardRatio: `1:${rrRatio}`,
      suggestedTrade: {
        action,
        entryZone: activeDemandOB ? `₹${activeDemandOB.low} - ₹${activeDemandOB.high}` : `₹${(lastClose * 0.98).toFixed(1)} - ₹${lastClose.toFixed(1)}`,
        stopLoss: Number(stopLoss.toFixed(2)),
        target1: Number(target1.toFixed(2)),
        target2: Number(target2.toFixed(2)),
      },
    },
  };
}

/**
 * Scan top F&O stocks for active Order Block retests (for Order Block live board).
 */
export async function scanOrderBlocksUniverse(limit: number = 30): Promise<OrderBlockAnalysisResult[]> {
  const candidates = Array.from(new Set([...Array.from(NIFTY_50), ...NSE_UNIVERSE])).slice(0, 40);
  const results: OrderBlockAnalysisResult[] = [];

  for (const sym of candidates) {
    try {
      const yahooSym = sym.includes(".") ? sym : `${sym}.NS`;
      const candles = await candleCache.getCandlesCached(yahooSym, "6mo", "1d");
      if (!candles || candles.length < 50) continue;

      const analysis = computeOrderBlockAnalysis(candles, sym);
      if (analysis) {
        results.push(analysis);
      }
    } catch (_) {}
  }

  // Sort by highest Confirmation Score descending
  return results.sort((a, b) => b.confirmation.score - a.confirmation.score).slice(0, limit);
}
