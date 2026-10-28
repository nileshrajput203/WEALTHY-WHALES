/**
 * VCP2 SCANNER — Rocket Base Hyper-Accurate Setup
 * ─────────────────────────────────────────────────────────────────────────────
 * Detects Mark Minervini's "Rocket Base" & "Cheat Pivot" setups with:
 *   - Multi-contraction footprint (e.g. 3T: -18.4% → -9.1% → -3.2%)
 *   - Ghost-Town Volume Dry-Up (VDU) + Institutional Pocket Pivots
 *   - Risk-First Trade Plan (Stop-Loss Risk % before Target %)
 */

import { type SwingScanResult } from "./stockApi";
import { NSE_UNIQUE, NIFTY_50, ETFS } from "./nseUniverse";
import { computeVcpFeatures, computeVcpScore, computeVcpEntrySLTarget } from "./vcpCore";
import { candleCache } from "./candleCache";

const ANALYSIS_BATCH = 40;

async function analyzeStockVcp2(sym: string): Promise<SwingScanResult | null> {
  try {
    const yahooSym = sym.includes(".") ? sym : `${sym}.NS`;
    const candles = await candleCache.getCandlesCached(yahooSym, "1y", "1d");
    if (!candles || candles.length < 210) return null;

    const vcp = computeVcpFeatures(candles, sym);
    if (!vcp || !vcp.passesAllFilters) return null;

    const score = computeVcpScore(vcp);
    const trade = computeVcpEntrySLTarget(vcp);

    const signals: string[] = [vcp.contractionFootprint];
    if (vcp.hasPocketPivot) signals.push("Pocket Pivot");
    if (vcp.volumeDryUp) signals.push(`VDU (${vcp.vduDaysLast10}d)`);
    if (vcp.hasShakeoutRecovery) signals.push("Shakeout+Recover");

    return {
      sr: 0,
      stockName: sym,
      symbol: sym,
      links: `${vcp.setupStage.replace(/_/g, " ")} · RS ${vcp.rsRating}`,
      changePercent: vcp.dailyChangePct,
      price: vcp.price,
      volume: vcp.turnover.toLocaleString("en-IN"),
      sector: signals.join(" · "),
      setup: `${vcp.contractionFootprint} · Pivot ₹${trade.entry} (${vcp.distanceToPivotPct >= 0 ? "-" : "+"}${Math.abs(vcp.distanceToPivotPct)}%) · SL ₹${trade.stopLoss} (-${trade.riskPct}%) · T1 ₹${trade.target} (+${trade.targetPct}%)`,
      atr: vcp.atr14,
      ema9: trade.entry,
      ema20: trade.stopLoss,
      ema50: trade.target,
      ema150: trade.riskPct,
      ema200: trade.riskRewardRatio,
      weekHigh52: vcp.pivotPoint,
      turnover: vcp.turnover,
      vcpScore: score,
      fundamentalScore: vcp.rsRating,
      atrCompression: Math.round((1 - vcp.tightCoilRatio) * 100) / 100,
      volumeRatio: vcp.volumeRatio,
      nearHighPct: vcp.nearHighPct,
      rsScore: vcp.rsScore,
    };
  } catch {
    return null;
  }
}

export async function runVcp2Scanner(): Promise<SwingScanResult[]> {
  const baseList = NSE_UNIQUE.filter(sym => !NIFTY_50.has(sym) && !ETFS.has(sym));
  const yahooSymbols = baseList.map(sym => sym.includes(".") ? sym : `${sym}.NS`);

  console.log(`[VCP2-ROCKET] Scanning ${baseList.length} stocks for hyper-accurate Rocket VCP setups...`);

  const startWarm = Date.now();
  await candleCache.preWarm(yahooSymbols, "1y", "1d", 25, 150);
  const warmMs = Date.now() - startWarm;

  const startAnalysis = Date.now();
  const results: SwingScanResult[] = [];

  for (let i = 0; i < baseList.length; i += ANALYSIS_BATCH) {
    const batch = baseList.slice(i, i + ANALYSIS_BATCH);
    const batchResults = await Promise.all(batch.map(analyzeStockVcp2));

    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }

  results.sort((a, b) => (b.vcpScore ?? 0) - (a.vcpScore ?? 0));
  results.forEach((r, idx) => {
    r.sr = idx + 1;
  });

  const analysisMs = Date.now() - startAnalysis;
  const cacheStats = candleCache.getStats();
  console.log(`[VCP2-ROCKET] Done: ${results.length} rockets in ${warmMs + analysisMs}ms (warm=${warmMs}ms, analysis=${analysisMs}ms, cache hit=${cacheStats.hitRate})`);

  return results;
}
