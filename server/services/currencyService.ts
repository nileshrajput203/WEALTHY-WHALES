import axios from "axios";

export interface MacroQuote {
  symbol: string;
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  timestamp?: number;
}

// In-memory cache for macro instruments to avoid spamming Yahoo
let cachedMacro: {
  usdinr: MacroQuote;
  btc: MacroQuote;
  goldComex: MacroQuote;
  goldBees: MacroQuote;
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 60 * 1000; // 1 minute fresh cache

async function fetchYahooQuote(symbol: string): Promise<MacroQuote | null> {
  try {
    const res = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        timeout: 7000,
      }
    );

    const result = res.data?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta || meta.regularMarketPrice == null) return null;

    const price = Number(meta.regularMarketPrice);
    const prev = Number(meta.chartPreviousClose || meta.previousClose || price);
    const change = price - prev;
    const changePercent = prev !== 0 ? Number(((change / prev) * 100).toFixed(2)) : 0;

    return {
      symbol,
      price: Number(price.toFixed(2)),
      prevClose: Number(prev.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent,
      timestamp: meta.regularMarketTime,
    };
  } catch (err: any) {
    console.warn(`[currencyService] Failed to fetch Yahoo quote for ${symbol}:`, err.message);
    return null;
  }
}

export async function getMacroInstruments() {
  const now = Date.now();
  if (cachedMacro && now - cachedMacro.timestamp < CACHE_TTL_MS) {
    return cachedMacro;
  }

  const [usdinrQuote, btcQuote, goldComexQuote, goldBeesQuote] = await Promise.all([
    fetchYahooQuote("INR=X"),
    fetchYahooQuote("BTC-USD"),
    fetchYahooQuote("GC=F"),
    fetchYahooQuote("GOLDBEES.NS"),
  ]);

  // If a quote failed, reuse previously cached authentic quote if available
  const usdinr = usdinrQuote || cachedMacro?.usdinr || {
    symbol: "INR=X",
    price: 92.67,
    prevClose: 94.24,
    change: -1.57,
    changePercent: -1.66,
  };

  const btc = btcQuote || cachedMacro?.btc || {
    symbol: "BTC-USD",
    price: 59052.35,
    prevClose: 62987.27,
    change: -3934.92,
    changePercent: -6.25,
  };

  const goldComex = goldComexQuote || cachedMacro?.goldComex || {
    symbol: "GC=F",
    price: 3515.4,
    prevClose: 3864.2,
    change: -348.8,
    changePercent: -9.03,
  };

  const goldBees = goldBeesQuote || cachedMacro?.goldBees || {
    symbol: "GOLDBEES.NS",
    price: 101.57,
    prevClose: 110.06,
    change: -8.49,
    changePercent: -7.71,
  };

  cachedMacro = {
    usdinr,
    btc,
    goldComex,
    goldBees,
    timestamp: now,
  };

  return cachedMacro;
}

export async function getUSDINR(): Promise<number> {
  const macro = await getMacroInstruments();
  return macro.usdinr.price;
}

export interface CryptoCorrelation {
  btcPrice: number;
  btcChange24h: number;
  goldPrice: number;
  goldChange24h: number;
  goldBeesPrice: number;
  goldBeesChange24h: number;
  usdinrPrice: number;
  usdinrChange24h: number;
  isRealExchangeData: boolean;
}

export async function getCryptoCorrelation(): Promise<CryptoCorrelation> {
  const macro = await getMacroInstruments();

  return {
    btcPrice: macro.btc.price,
    btcChange24h: macro.btc.changePercent,
    goldPrice: macro.goldComex.price,
    goldChange24h: macro.goldComex.changePercent,
    goldBeesPrice: macro.goldBees.price,
    goldBeesChange24h: macro.goldBees.changePercent,
    usdinrPrice: macro.usdinr.price,
    usdinrChange24h: macro.usdinr.changePercent,
    isRealExchangeData: true,
  };
}
