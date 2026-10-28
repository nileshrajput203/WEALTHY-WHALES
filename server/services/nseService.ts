import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// ESM way to get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKER_PATH = path.resolve(__dirname, "nse_worker.py");

let FO_STOCKS: string[] = [];
try {
  const listPath = path.resolve(__dirname, "../fo_stock_list.json");
  if (fs.existsSync(listPath)) {
    FO_STOCKS = JSON.parse(fs.readFileSync(listPath, "utf8"));
  }
} catch (err) {
  console.error("[nseService] Failed to load fo_stock_list.json:", err);
}

export function isFnOSymbol(symbol: string): boolean {
  if (!symbol) return false;
  const clean = symbol.replace(/\.(NS|BO)$/i, "").toUpperCase().trim();
  const indices = new Set(["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50"]);
  return indices.has(clean) || FO_STOCKS.includes(clean);
}

// Detect best python executable
function getPythonCommand(): string {
  const py314Path = "C:\\Users\\USER\\AppData\\Local\\Programs\\Python\\Python314\\python.exe";
  if (fs.existsSync(py314Path)) {
    return py314Path;
  }
  return "python";
}

// Concurrency Semaphore: prevent Python worker subprocess fork-bomb (Max 2 concurrent workers)
const MAX_CONCURRENT_WORKERS = 2;
let activeWorkers = 0;
const workerQueue: (() => void)[] = [];

function acquireWorkerSlot(): Promise<void> {
  if (activeWorkers < MAX_CONCURRENT_WORKERS) {
    activeWorkers++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    workerQueue.push(() => {
      activeWorkers++;
      resolve();
    });
  });
}

function releaseWorkerSlot(): void {
  activeWorkers--;
  if (workerQueue.length > 0) {
    const next = workerQueue.shift();
    if (next) next();
  }
}

// Worker L1 Cache & Single-Flight Coalescing
interface WorkerCacheEntry {
  data: any;
  ts: number;
}
const nseWorkerCache = new Map<string, WorkerCacheEntry>();
const nseInflightWorker = new Map<string, Promise<any>>();
const WORKER_CACHE_TTL_MS = 60 * 1000; // 60 seconds

async function runPythonWorker(action: string, symbol?: string, extraArgs?: { text?: string; horizon?: number }): Promise<any> {
  const cleanSym = symbol ? symbol.replace(/\.(NS|BO)$/i, "").toUpperCase().trim() : "";
  const cacheKey = `${action}_${cleanSym}_${extraArgs?.text || ""}_${extraArgs?.horizon || ""}`;

  // 1. Check L1 Memory Cache (0ms)
  const cached = nseWorkerCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < WORKER_CACHE_TTL_MS) {
    return cached.data;
  }

  // 2. Check Single-Flight Inflight
  const existingInflight = nseInflightWorker.get(cacheKey);
  if (existingInflight) {
    return existingInflight;
  }

  // 3. Queue and execute via semaphore
  const executionPromise = (async () => {
    await acquireWorkerSlot();
    try {
      const pyExe = getPythonCommand();
      const args: string[] = [WORKER_PATH, "--action", action];
      if (cleanSym) {
        args.push("--symbol", cleanSym);
      }
      if (extraArgs?.text) {
        args.push("--text", extraArgs.text);
      }
      if (extraArgs?.horizon) {
        args.push("--horizon", String(extraArgs.horizon));
      }

      return await new Promise<any>((resolve) => {
        execFile(
          pyExe,
          args,
          {
            maxBuffer: 10 * 1024 * 1024,
            timeout: 25000,
          },
          (error, stdout, stderr) => {
            if (error) {
              console.error(`Error running Python worker [${action}]:`, stderr || error.message);
              resolve(getFallbackData(action, cleanSym));
              return;
            }

            try {
              const parsed = JSON.parse(stdout.trim());
              nseWorkerCache.set(cacheKey, { data: parsed, ts: Date.now() });
              resolve(parsed);
            } catch (parseError) {
              console.error(`JSON Parse error from Python worker [${action}]:`, stdout);
              resolve(getFallbackData(action, cleanSym));
            }
          }
        );
      });
    } finally {
      releaseWorkerSlot();
      nseInflightWorker.delete(cacheKey);
    }
  })();

  nseInflightWorker.set(cacheKey, executionPromise);
  return executionPromise;
}

function getFallbackData(action: string, symbol?: string): any {
  console.warn(`Providing fallback/mock data for action: ${action}`);
  const todayStr = new Date().toISOString().split("T")[0];
  
  if (action === "quote") {
    return {
      success: true,
      price: 1500.0,
      change: 15.0,
      changePercent: 1.0,
      volume: 500000,
      deliveryPct: 50.0,
      mocked: true
    };
  } else if (action === "option-chain") {
    const cleanSym = (symbol || "").replace(/\.(NS|BO)$/i, "").toUpperCase();
    const isFnO = isFnOSymbol(cleanSym);
    if (!isFnO) {
      return {
        success: false,
        isFnO: false,
        symbol: cleanSym,
        message: `${cleanSym} is an Equity Cash segment stock. It is not traded in the NSE F&O derivatives segment, so no Option Chain or Strikes exist for this stock.`,
        calls: [],
        puts: [],
        mocked: false
      };
    }
    const expiry = "28-May-2026";
    const calls = [];
    const puts = [];
    for (let s = 1450; s <= 1550; s += 20) {
      calls.push({ strike: s, expiry, ltp: 15.0, oi: 5000, oiChg: 100, iv: 18.5 });
      puts.push({ strike: s, expiry, ltp: 15.0, oi: 4000, oiChg: -200, iv: 18.5 });
    }
    return {
      success: true,
      isFnO: true,
      underlyingValue: 1500.0,
      expiryDates: [expiry],
      calls,
      puts,
      mocked: true
    };
  } else if (action === "bulk-deals") {
    return {
      success: true,
      deals: [
        { symbol: symbol || "RELIANCE", name: "Reliance Industries Ltd", clientName: "SOCIETE GENERALE", dealType: "Buy", quantity: 1450000, price: 2465.20, date: todayStr }
      ],
      mocked: true
    };
  } else if (action === "insider-trades") {
    return {
      success: true,
      trades: [
        { symbol: "RELIANCE", company: "Reliance Industries Ltd", insider: "Anant Ambani", relation: "Promoter Group", txnType: "Buy", quantity: 150000, price: 2450.00, value: 367500000, date: todayStr, holdingChange: 0.05 },
        { symbol: "TCS", company: "Tata Consultancy Services", insider: "Tata Sons Pvt Ltd", relation: "Promoter", txnType: "Buy", quantity: 450000, price: 3812.30, value: 1715535000, date: todayStr, holdingChange: 0.12 }
      ],
      mocked: true
    };
  } else if (action === "quant-forecast") {
    const cleanSym = (symbol || "RELIANCE").replace(/\.(NS|BO)$/i, "").toUpperCase();
    const isFnO = isFnOSymbol(cleanSym);
    return {
      symbol: cleanSym,
      isFnO,
      marketSegment: isFnO ? "F&O" : "CASH",
      timestamp: new Date().toISOString(),
      kronos: {
        model: "Kronos-Fallback",
        lastPrice: 1500.0,
        horizon: 10,
        predictedBars: Array.from({ length: 10 }, (_, i) => ({
          barIndex: i + 1,
          open: 1500 + i * 2,
          high: 1505 + i * 2,
          low: 1498 + i * 2,
          close: 1503 + i * 2,
          volume: 250000
        })),
        breakoutProbability: 65.0,
        bias: "BULLISH",
        expectedVolatilityRange: { lowerBound: 1450.0, upperBound: 1580.0, atr: 22.0, volatilityPct: 1.5 }
      },
      chronos: {
        model: "Chronos-Bolt",
        lastPrice: 1500.0,
        horizon: 10,
        quantiles: {
          p10: Array.from({ length: 10 }, (_, i) => 1490 - i * 3),
          p50: Array.from({ length: 10 }, (_, i) => 1502 + i * 3),
          p90: Array.from({ length: 10 }, (_, i) => 1515 + i * 6)
        },
        p50Target: 1530.0,
        p10LowerBound: 1460.0,
        p90UpperBound: 1575.0,
        expectedReturnPct: 2.0
      },
      alpha158: {
        kbar: { bodyRatio: 0.012, rangeRatio: 0.024, solidRatio: 0.5, upperShadowRatio: 0.2, lowerShadowRatio: 0.3 },
        momentum: { roc5: 2.5, roc10: 4.8, roc20: 7.2, roc60: 16.5 },
        volumeFactors: { volumePriceCorr: 0.32, volumeRatio: 1.4, obvSlope: 45000, isAccumulation: true },
        relativeStrength: { rsRating: 84, perf3M: 12.5, perf6M: 25.0, perf12M: 42.0, isLeader: true }
      },
      intradayFO: {
        isFnO,
        segment: isFnO ? "F&O" : "CASH",
        segmentLabel: isFnO ? "NSE Derivatives (F&O)" : "Cash Segment Only (Non-F&O)",
        setupType: "CONSOLIDATION_WATCH",
        direction: "NEUTRAL",
        confidence: 50,
        foBuildup: isFnO ? "NEUTRAL_OI" : "NOT_APPLICABLE",
        pcr: isFnO ? 1.0 : null,
        optionStrikeSuggestion: isFnO ? "1500 Straddle / Rangebound" : null,
        cashTradeSuggestion: isFnO ? null : "Cash / MIS Setup: Trade within support and resistance zones",
        levels: { spotEntry: 1500, stopLoss: 1475, target1: 1535, target2: 1560, vwap: 1502, atr14: 22 },
        emaStack: { ema9: 1501, ema20: 1500, ema50: 1495, ema200: 1480, aboveAllEmas: true, belowAllEmas: false },
        indicators: { rsi14: 52, volumeSpikeRatio: 1.0 }
      },
      consensus: { bias: "NEUTRAL", rsRating: 84, breakoutProbability: 65.0, p50Target: 1530.0 },
      mocked: true
    };
  } else if (action === "alpha158") {
    return {
      kbar: { bodyRatio: 0.012, rangeRatio: 0.024, solidRatio: 0.5, upperShadowRatio: 0.2, lowerShadowRatio: 0.3 },
      momentum: { roc5: 2.5, roc10: 4.8, roc20: 7.2, roc60: 16.5 },
      volumeFactors: { volumePriceCorr: 0.32, volumeRatio: 1.4, obvSlope: 45000, isAccumulation: true },
      relativeStrength: { rsRating: 84, perf3M: 12.5, perf6M: 25.0, perf12M: 42.0, isLeader: true },
      mocked: true
    };
  } else if (action === "sentiment") {
    return {
      sentimentScore: 0.55,
      catalystType: "ORDER_WIN",
      affectedSectors: ["ENERGY", "INFRA"],
      affectedTickers: [symbol || "RELIANCE"],
      urgency: 7,
      label: "BULLISH",
      mocked: true
    };
  }
  return { success: false, error: "Unknown action" };
}

export async function fetchNSEQuote(symbol: string) {
  const result = await runPythonWorker("quote", symbol);
  return result;
}

export async function fetchNSEOptionChain(symbol: string) {
  const result = await runPythonWorker("option-chain", symbol);
  return result;
}

export async function fetchBulkDeals(date?: string) {
  const result = await runPythonWorker("bulk-deals", date);
  return result;
}

export async function fetchInsiderTrades() {
  const result = await runPythonWorker("insider-trades");
  return result;
}

export async function fetchQuantModelForecast(symbol: string, horizon: number = 10) {
  const result = await runPythonWorker("quant-forecast", symbol, { horizon });
  return result;
}

export async function fetchAlpha158Factors(symbol: string) {
  const result = await runPythonWorker("alpha158", symbol);
  return result;
}

export async function analyzeHeadlineSentiment(text: string, symbol?: string) {
  const result = await runPythonWorker("sentiment", symbol, { text });
  return result;
}

export async function fetchChartinkScan(clause: string) {
  const result = await runPythonWorker("chartink", undefined, { text: clause });
  return result;
}
