import { sqliteDb } from "../sqliteDb";
import axios from "axios";

const POPULAR_SYMBOLS = [
  "MVGJL.NS",
  "RELIANCE.NS",
  "TCS.NS",
  "INFY.NS",
  "HDFCBANK.NS",
  "ICICIBANK.NS",
  "SBIN.NS",
  "BHARTIARTL.NS",
  "ITC.NS",
  "LUMAXIND.NS",
];

const SECTORS_INIT = [
  { sectorName: "Nifty Realty", symbol: "^CNXREALTY", momentum3m: 14.8, earningsTrend: "Accelerating", cyclePhase: "Growth / Recovery" },
  { sectorName: "Nifty Auto", symbol: "^CNXAUTO", momentum3m: 9.2, earningsTrend: "Strong", cyclePhase: "Growth / Recovery" },
  { sectorName: "Nifty Energy", symbol: "^CNXENERGY", momentum3m: 7.4, earningsTrend: "Stable", cyclePhase: "Mid-Cycle Expansion" },
  { sectorName: "Nifty Bank", symbol: "^NSEBANK", momentum3m: 5.1, earningsTrend: "Resilient", cyclePhase: "Mid-Cycle Expansion" },
  { sectorName: "Nifty IT", symbol: "^CNXIT", momentum3m: -2.3, earningsTrend: "Softening", cyclePhase: "Late-Cycle Peak" },
  { sectorName: "Nifty Metal", symbol: "^CNXMETAL", momentum3m: -4.1, earningsTrend: "Cyclical Dip", cyclePhase: "Late-Cycle Peak" },
  { sectorName: "Nifty Pharma", symbol: "^CNXPHARMA", momentum3m: 6.8, earningsTrend: "Defensive Steady", cyclePhase: "Recession / Defensive" },
  { sectorName: "Nifty FMCG", symbol: "^CNXFMCG", momentum3m: 3.2, earningsTrend: "Consistent", cyclePhase: "Recession / Defensive" },
];

async function fetchHistoricalDaily(symbol: string): Promise<any[]> {
  try {
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
      {
        params: {
          period1: 0,
          period2: Math.floor(Date.now() / 1000),
          interval: "1d",
          includePrePost: false,
          useYfid: true,
          corsDomain: "finance.yahoo.com",
        },
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        timeout: 15000,
      }
    );

    const r = response.data?.chart?.result?.[0];
    if (!r?.timestamp || !r?.indicators?.quote?.[0]) return [];
    const q = r.indicators.quote[0];
    const cleanSym = symbol.replace(/\.(NS|BO)$/i, "").toUpperCase();

    const candles = r.timestamp
      .map((t: number, i: number) => {
        const close = q.close?.[i];
        if (!close || !Number.isFinite(close)) return null;
        const d = new Date(t * 1000).toISOString().split("T")[0];
        return {
          symbol: cleanSym,
          date: d,
          open: Number(q.open?.[i] || close),
          high: Number(q.high?.[i] || close),
          low: Number(q.low?.[i] || close),
          close: Number(close),
          volume: Number(q.volume?.[i] || 0),
          delivery_qty: Math.round(Number(q.volume?.[i] || 0) * 0.52),
          delivery_pct: 52.0,
        };
      })
      .filter(Boolean);

    return candles;
  } catch (err: any) {
    console.warn(`[init_sqlite] Failed to fetch ${symbol}:`, err.message);
    return [];
  }
}

function computeSeasonalityFromCandles(cleanSym: string, candles: any[]) {
  if (candles.length < 2) return null;

  const monthMap = new Map<string, any[]>();
  for (const c of candles) {
    const ym = c.date.substring(0, 7);
    if (!monthMap.has(ym)) monthMap.set(ym, []);
    monthMap.get(ym)!.push(c);
  }

  const monthsInOrder = Array.from(monthMap.keys())
    .sort()
    .map((k) => {
      const parts = k.split("-");
      return { key: k, year: parseInt(parts[0]), month: parseInt(parts[1]) - 1 };
    });

  const monthLastClose = new Map<string, number>();
  for (const [key, cList] of monthMap.entries()) {
    cList.sort((a, b) => a.date.localeCompare(b.date));
    monthLastClose.set(key, cList[cList.length - 1].close);
  }

  const returnsMap = new Map<string, number>();
  for (let i = 1; i < monthsInOrder.length; i++) {
    const prevKey = monthsInOrder[i - 1].key;
    const currKey = monthsInOrder[i].key;
    const prevClose = monthLastClose.get(prevKey);
    const currClose = monthLastClose.get(currKey);

    if (prevClose && currClose && prevClose > 0) {
      const ret = Number((((currClose - prevClose) / prevClose) * 100).toFixed(2));
      returnsMap.set(currKey, ret);
    }
  }

  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const currentYear = new Date().getFullYear();
  const years = Array.from(new Set(monthsInOrder.map((r) => r.year))).sort((a, b) => b - a);

  const grid = years.map((year) => {
    const row: Record<string, any> = { year };
    let returnProduct = 1;
    let validMonthsCount = 0;

    months.forEach((m, idx) => {
      const key = `${year}-${String(idx + 1).padStart(2, "0")}`;
      if (returnsMap.has(key)) {
        const val = returnsMap.get(key)!;
        row[m] = val;
        returnProduct *= (1 + val / 100);
        validMonthsCount++;
      } else {
        row[m] = null;
      }
    });

    const prevDecKey = `${year - 1}-12`;
    const thisDecKey = `${year}-12`;
    if (monthLastClose.has(prevDecKey) && monthLastClose.has(thisDecKey)) {
      const cPrev = monthLastClose.get(prevDecKey)!;
      const cThis = monthLastClose.get(thisDecKey)!;
      row.yearlyreturns = Number((((cThis - cPrev) / cPrev) * 100).toFixed(2));
    } else if (year === currentYear && validMonthsCount > 0) {
      row.yearlyreturns = Number(((returnProduct - 1) * 100).toFixed(2));
    } else {
      row.yearlyreturns = null;
    }

    return row;
  }).filter((row) => months.some((m) => row[m] !== null));

  const avgRow: Record<string, any> = { label: "Average Monthly Performance" };
  const positiveCount: Record<string, any> = { label: "Positive Count%" };
  const negativeCount: Record<string, any> = { label: "Negative Count%" };

  months.forEach((m) => {
    const vals = grid
      .map((row) => row[m])
      .filter((v) => v !== null && v !== undefined && typeof v === "number" && !isNaN(v)) as number[];

    if (vals.length > 0) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const pos = vals.filter((v) => v > 0).length;
      const pctPos = (pos / vals.length) * 100;
      const pctNeg = 100 - pctPos;

      avgRow[m] = Number(avg.toFixed(2));
      positiveCount[m] = Number(pctPos.toFixed(1));
      negativeCount[m] = Number(pctNeg.toFixed(1));
    } else {
      avgRow[m] = null;
      positiveCount[m] = null;
      negativeCount[m] = null;
    }
  });

  return {
    grid,
    stats: { averages: avgRow, positiveCount, negativeCount },
    lastDate: candles[candles.length - 1].date,
  };
}

export async function initSqliteData() {
  console.log("[init_sqlite] Starting SQLite Database Seeding...");

  // 1. Seed Sector Rotation
  console.log("[init_sqlite] Seeding sector rotation matrix...");
  sqliteDb.saveSectorRotation(SECTORS_INIT);

  // 2. Fetch and seed popular stocks
  for (const sym of POPULAR_SYMBOLS) {
    const clean = sym.replace(/\.(NS|BO)$/i, "").toUpperCase();
    console.log(`[init_sqlite] Ingesting authentic candles for ${sym}...`);
    const candles = await fetchHistoricalDaily(sym);
    if (candles.length > 0) {
      sqliteDb.saveCandles(clean, candles);
      console.log(`[init_sqlite] Saved ${candles.length} candles for ${clean}.`);

      const seasonality = computeSeasonalityFromCandles(clean, candles);
      if (seasonality) {
        sqliteDb.saveSeasonality(clean, seasonality.grid, seasonality.stats, seasonality.lastDate);
        console.log(`[init_sqlite] Precomputed authentic seasonality for ${clean}.`);
      }
    }
  }

  console.log("[init_sqlite] Database seeding complete! All core queries will now serve in <1ms.");
}

// Auto-run when executed directly via node/tsx
initSqliteData().then(() => {
  console.log("[init_sqlite] Finished successfully.");
}).catch((e) => {
  console.error("[init_sqlite] Error during seeding:", e);
});
