/**
 * VCP2 SCANNER — Rocket Base Hyper-Accurate Setup
 * ─────────────────────────────────────────────────────────────────────────────
 * Detects the "Cheat" or "Rocket Base" setups where price is extremely tight
 * and ready for a 10%+ breakout move.
 */

import { getYahooHistory, type SwingScanResult } from "./stockApi";
import { NSE_UNIQUE, NIFTY_50, ETFS } from "./nseUniverse";
import { computeVcpFeatures, computeVcpScore, computeVcpEntrySLTarget } from "./vcpCore";

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 200;

async function analyzeStockVcp2(sym: string): Promise<SwingScanResult | null> {
  try {
    const yahooSym = sym.includes(".") ? sym : `${sym}.NS`;
    const candles = await getYahooHistory(yahooSym, "1y", "1d");
    if (!candles || candles.length < 210) return null;

    const vcp = computeVcpFeatures(candles, sym);
    if (!vcp || !vcp.passesAllFilters) return null;

    const score = computeVcpScore(vcp);
    const trade = computeVcpEntrySLTarget(vcp);

    return {
      sr: 0,
      stockName: sym,
      symbol: sym,
      links: "VCP2 | ROCKET",
      changePercent: vcp.dailyChangePct,
      price: vcp.price,
      volume: vcp.turnover.toLocaleString(),
      sector: "",
      setup: `ROCKET: Tightness ${vcp.lastContractionDepth.toFixed(1)}% · Pivot ${vcp.pivotPoint.toFixed(2)} · Target +${trade.targetPct.toFixed(1)}%`,
      atr: vcp.atr14,
      ema9: 0, // Not used in this simplified result
      ema20: 0,
      ema50: 0,
      ema150: 0,
      ema200: 0,
      weekHigh52: 0,
      turnover: vcp.turnover,
      vcpScore: score,
      fundamentalScore: 0,
      atrCompression: 1 - vcp.tightCoilRatio,
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
  const results: SwingScanResult[] = [];

  console.log(`[VCP2-ROCKET] Scanning ${baseList.length} stocks for hyper-accurate setups...`);

  for (let i = 0; i < baseList.length; i += BATCH_SIZE) {
    const batch = baseList.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(analyzeStockVcp2));
    
    for (const r of batchResults) {
      if (r) results.push(r);
    }

    if (i % 100 === 0) {
      console.log(`  [VCP2] Progress: ${i}/${baseList.length} → ${results.length} rockets found`);
    }
    
    await new Promise(res => setTimeout(res, BATCH_DELAY_MS));
  }

  return results.sort((a, b) => (b.vcpScore ?? 0) - (a.vcpScore ?? 0));
}
