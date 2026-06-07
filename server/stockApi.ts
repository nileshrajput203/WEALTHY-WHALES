// Free Stock Data APIs - Multiple providers for redundancy
import axios from 'axios';
import { NSE_UNIQUE, NIFTY_50, ETFS } from './nseUniverse';

// Configuration for different free APIs
const API_CONFIGS = {
  // Yahoo Finance (no API key required) - Using unofficial endpoints
  yahoo: {
    baseUrl: 'https://query1.finance.yahoo.com/v8/finance/chart',
    newsUrl: 'https://feeds.finance.yahoo.com/rss/2.0/headline'
  },
  
  // Alpha Vantage (free tier - 5 calls per minute, 500 calls per day)
  alphaVantage: {
    baseUrl: 'https://www.alphavantage.co/query',
    apiKey: process.env.ALPHA_VANTAGE_API_KEY || 'demo' // Use demo key for testing
  },

  // Finnhub (free tier – realtime indices, news)
  finnhub: {
    baseUrl: 'https://finnhub.io/api/v1',
    apiKey: process.env.FINNHUB_API_KEY || ''
  },
  
  // IEX Cloud (free tier - 500,000 calls per month)
  iexCloud: {
    baseUrl: 'https://cloud.iexapis.com/stable',
    apiKey: process.env.IEX_CLOUD_API_KEY || 'pk_test_key' // Use test key for free tier
  },
  
  // Financial Modeling Prep (free tier - 250 calls per day)
  fmp: {
    baseUrl: 'https://financialmodelingprep.com/api/v3',
    apiKey: process.env.FMP_API_KEY || 'demo'
  },
  // StockData.org (US quotes/news)
  stockdata: {
    baseUrl: 'https://api.stockdata.org/v1',
    apiToken: process.env.STOCKDATA_API_TOKEN || ''
  }
};

// Indian stock symbols for NSE/BSE
export const INDIAN_STOCKS = {
  'RELIANCE': 'RELIANCE.NS',
  'TCS': 'TCS.NS',
  'HDFC': 'HDFC.NS',
  'INFY': 'INFY.NS',
  'HINDUNILVR': 'HINDUNILVR.NS',
  'ITC': 'ITC.NS',
  'KOTAKBANK': 'KOTAKBANK.NS',
  'BHARTIARTL': 'BHARTIARTL.NS',
  'ASIANPAINT': 'ASIANPAINT.NS',
  'MARUTI': 'MARUTI.NS'
};

// Market indices
const INDICES = {
  'NIFTY_50': '^NSEI',
  'SENSEX': '^BSESN',
  'BANK_NIFTY': '^NSEBANK',
  'NIFTY_IT': '^CNXIT',
  'NIFTY_PHARMA': '^CNXPHARMA'
};

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  high?: number;
  low?: number;
  open?: number;
  previousClose?: number;
  timestamp: Date;
  source: string;
}

export interface StockNews {
  title: string;
  description: string;
  url: string;
  publishedAt: Date;
  source: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface MarketIndex {
  name: string;
  symbol: string;
  value: number;
  change: number;
  changePercent: number;
  previousClose?: number;
  timestamp: Date;
}

// Get stock quote from Yahoo Finance (no API key required)
export async function getYahooStockQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const response = await axios.get(`${API_CONFIGS.yahoo.baseUrl}/${symbol}`, {
      params: {
        interval: '1d',
        range: '5d',
        includePrePost: false,
        useYfid: true,
        corsDomain: 'finance.yahoo.com'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const data = response.data;
    if (!data.chart?.result?.[0]?.meta) {
      return null;
    }

    const meta = data.chart.result[0].meta;
    const quoteData = data.chart.result[0].indicators?.quote?.[0];
    const timestamps = data.chart.result[0].timestamp;
    
    const currentPrice = meta.regularMarketPrice || meta.previousClose;
    const previousClose = meta.previousClose || 0;

    // Try multiple ways to get accurate change values
    let change = 0;
    let changePercent = 0;

    // Method 1: Use meta fields if available and non-zero
    if (meta.regularMarketChange && meta.regularMarketChange !== 0) {
      change = meta.regularMarketChange;
      changePercent = meta.regularMarketChangePercent || (previousClose ? (change / previousClose) * 100 : 0);
    }
    // Method 2: Compute from currentPrice vs previousClose
    else if (currentPrice && previousClose && currentPrice !== previousClose) {
      change = currentPrice - previousClose;
      changePercent = (change / previousClose) * 100;
    }
    // Method 3: Use last two candle closes (works when market is closed)
    else if (quoteData?.close && timestamps && timestamps.length >= 2) {
      const closes = quoteData.close.filter((c: any) => c != null && Number.isFinite(c));
      if (closes.length >= 2) {
        const lastClose = closes[closes.length - 1];
        const prevDayClose = closes[closes.length - 2];
        if (prevDayClose && prevDayClose !== 0) {
          change = lastClose - prevDayClose;
          changePercent = (change / prevDayClose) * 100;
        }
      }
    }

    return {
      symbol: meta.symbol,
      name: meta.longName || meta.shortName || symbol,
      price: currentPrice,
      change: change,
      changePercent: changePercent,
      volume: meta.regularMarketVolume,
      marketCap: meta.marketCap,
      high: meta.regularMarketDayHigh,
      low: meta.regularMarketDayLow,
      open: meta.regularMarketOpen,
      previousClose: previousClose,
      timestamp: new Date((meta.regularMarketTime ?? Math.floor(Date.now() / 1000)) * 1000),
      source: 'Yahoo Finance'
    };
  } catch (error) {
    console.error('Yahoo Finance API error:', error);
    return null;
  }
}

// Fetch Yahoo historical candles for basic indicators
export async function getYahooHistory(symbol: string, range: string = '6mo', interval: string = '1d') {
  try {
    const response = await axios.get(`${API_CONFIGS.yahoo.baseUrl}/${symbol}`, {
      params: { interval, range, includePrePost: false, useYfid: true, corsDomain: 'finance.yahoo.com' },
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 12000,
    });
    const r = response.data?.chart?.result?.[0];
    if (!r?.timestamp || !r?.indicators?.quote?.[0]) return [];
    const q = r.indicators.quote[0];
    return r.timestamp.map((t: number, i: number) => ({
      time: new Date(t * 1000),
      open: q.open?.[i],
      high: q.high?.[i],
      low: q.low?.[i],
      close: q.close?.[i],
      volume: q.volume?.[i],
    })).filter((c: any) => Number.isFinite(c.close));
  } catch (e) {
    return [];
  }
}

export function computeSMA(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < period) { out.push(null); continue; }
    const slice = values.slice(i + 1 - period, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / period;
    out.push(avg);
  }
  return out;
}

export function computeRSI(values: number[], period = 14): (number | null)[] {
  if (values.length < period + 1) return values.map(() => null);
  const changes = values.slice(1).map((v, i) => v - values[i]);
  let gains = 0, losses = 0;
  for (let i = 0; i < period; i++) {
    const c = changes[i];
    if (c >= 0) gains += c; else losses -= c;
  }
  const rsis: (number | null)[] = Array(period).fill(null);
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period; i < changes.length; i++) {
    const c = changes[i];
    avgGain = (avgGain * (period - 1) + Math.max(c, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-c, 0)) / period;
    const rs = avgLoss === 0 ? 100 : 100 - 100 / (1 + (avgGain / (avgLoss || 1e-9)));
    rsis.push(rs);
  }
  return rsis;
}

export function computeEMA(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let ema: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < period) { out.push(null); continue; }
    if (ema === null) {
      // Seed with SMA
      const slice = values.slice(i + 1 - period, i + 1);
      ema = slice.reduce((a, b) => a + b, 0) / period;
    } else {
      ema = values[i] * k + ema * (1 - k);
    }
    out.push(ema);
  }
  return out;
}

function computeATR(highs: number[], lows: number[], closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = [null];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    out.push(tr);
  }
  // ATR = EMA of TRs
  const trs = out.map(v => v ?? 0);
  const atr: (number | null)[] = [];
  let avg: number | null = null;
  for (let i = 0; i < trs.length; i++) {
    if (i + 1 < period) { atr.push(null); continue; }
    if (avg === null) {
      avg = trs.slice(i + 1 - period, i + 1).reduce((a, b) => a + b, 0) / period;
    } else {
      avg = (avg * (period - 1) + trs[i]) / period;
    }
    atr.push(avg);
  }
  return atr;
}

/* ═══════════════════════════════════════════════════════════
   SWING SCANNER — Real technical analysis on small/mid-cap
   NSE stocks (excluding Nifty 50/100/500 and ETFs).
   
   Filters (from user's Chartink-style screener):
   1. ATR(14) < ATR(14) 10 days ago        — ATR contracting
   2. ATR(14)/Close < 0.08                 — Low volatility vs price
   3. Close > 52-week high * 0.75          — Near highs
   4. EMA(50) > EMA(150)                   — Bullish structure
   5. EMA(150) > EMA(200)                  — Long-term uptrend
   6. Close > EMA(50)                      — Above intermediate MA
   7. Close > 10                           — No penny stocks
   8. Close * Volume > 1,000,000           — Minimum turnover
   9. Daily change > 0%                    — Positive day
   10. Daily change < 3%                   — Not too volatile
   11. Close > EMA(9)                      — Short-term bullish
   12. Close > EMA(20)                     — Above near-term MA
═══════════════════════════════════════════════════════════ */
export interface SwingScanResult {
  sr: number;
  stockName: string;
  symbol: string;
  links: string;
  changePercent: number;
  price: number;
  volume: string;
  sector: string;
  setup: string;
  atr: number;
  ema9: number;
  ema20: number;
  ema50: number;
  ema150: number;
  ema200: number;
  weekHigh52: number;
  turnover: number;
}

// Analyze a single stock: returns SwingScanResult or null if it fails any filter
async function analyzeStock(sym: string): Promise<SwingScanResult | null> {
  try {
    const yahooSym = sym.includes('.') ? sym : `${sym}.NS`;
    const candles = await getYahooHistory(yahooSym, '1y', '1d');
    if (!candles || candles.length < 210) return null;

    const closes = candles.map((c: any) => c.close as number);
    const highs  = candles.map((c: any) => c.high as number);
    const lows   = candles.map((c: any) => c.low as number);
    const vols   = candles.map((c: any) => c.volume as number);
    const n      = closes.length;
    const last   = closes[n - 1];
    const prev   = closes[n - 2];

    // Quick reject filters (cheapest first)
    if (last <= 10) return null;                          // F7
    const dailyChange = ((last - prev) / prev) * 100;
    if (dailyChange <= 0) return null;                    // F9
    if (dailyChange >= 3) return null;                    // F10
    const turnover = last * (vols[n - 1] || 0);
    if (turnover < 1_000_000) return null;                // F8

    // EMAs
    const e9   = computeEMA(closes, 9)[n - 1];
    const e20  = computeEMA(closes, 20)[n - 1];
    const e50  = computeEMA(closes, 50)[n - 1];
    const e150 = computeEMA(closes, 150)[n - 1];
    const e200 = computeEMA(closes, 200)[n - 1];
    if (e9 == null || e20 == null || e50 == null || e150 == null || e200 == null) return null;

    if (last <= e9)   return null;                        // F11
    if (last <= e20)  return null;                        // F12
    if (last <= e50)  return null;                        // F6
    if (e50 <= e150)  return null;                        // F4
    if (e150 <= e200) return null;                        // F5

    // ATR
    const atrArr = computeATR(highs, lows, closes, 14);
    const currentATR = atrArr[n - 1];
    const atr10ago   = atrArr[n - 11];
    if (currentATR == null || atr10ago == null) return null;
    if (currentATR >= atr10ago) return null;              // F1
    if ((currentATR / last) >= 0.08) return null;         // F2

    // 52-week high
    const lookback = Math.min(n, 260);
    const weekHigh52 = Math.max(...closes.slice(n - lookback));
    if (last < weekHigh52 * 0.75) return null;            // F3

    // ── PASSED ALL 12 FILTERS ──
    const cleanSym = sym.replace('.NS', '').replace('.BO', '');
    return {
      sr: 0,
      stockName: cleanSym,
      symbol: sym,
      links: 'P&F | F.A',
      changePercent: Number(dailyChange.toFixed(2)),
      price: Number(last.toFixed(2)),
      volume: (vols[n - 1] || 0).toLocaleString('en-IN'),
      sector: '',
      setup: `ATR↓ EMA stack ✓ ${((last / weekHigh52) * 100).toFixed(0)}% of 52WH`,
      atr: Number(currentATR.toFixed(2)),
      ema9: Number(e9.toFixed(2)),
      ema20: Number(e20.toFixed(2)),
      ema50: Number(e50.toFixed(2)),
      ema150: Number(e150.toFixed(2)),
      ema200: Number(e200.toFixed(2)),
      weekHigh52: Number(weekHigh52.toFixed(2)),
      turnover: Number(turnover.toFixed(0)),
    };
  } catch {
    return null;
  }
}

export async function runSwingScanner(): Promise<SwingScanResult[]> {
  const baseList = NSE_UNIQUE.filter(sym => {
    const clean = sym.replace('.NS', '').replace('.BO', '');
    if (NIFTY_50.has(clean)) return false;
    if (ETFS.has(clean)) return false;
    return true;
  });

  const scanList: string[] = [];
  for (const sym of baseList) {
    scanList.push(`${sym}.NS`);
    scanList.push(`${sym}.BO`);
  }

  console.log(`Swing scanner: scanning ${scanList.length} stocks (excluded ${NSE_UNIQUE.length - scanList.length} Nifty50/ETFs)`);

  const results: SwingScanResult[] = [];
  const batchSize = 15;       // 15 parallel requests per batch
  let scanned = 0;

  for (let b = 0; b < scanList.length; b += batchSize) {
    const batch = scanList.slice(b, b + batchSize);
    const batchResults = await Promise.all(batch.map(analyzeStock));

    for (const r of batchResults) {
      if (r) results.push(r);
    }

    scanned += batch.length;
    if (scanned % 100 === 0 || b + batchSize >= scanList.length) {
      console.log(`  Scanned ${scanned}/${scanList.length} → ${results.length} matches so far`);
    }

    // Small delay to avoid Yahoo rate limits
    if (b + batchSize < scanList.length) {
      await new Promise(res => setTimeout(res, 100));
    }
  }

  // Sort by change% descending
  results.sort((a, b) => b.changePercent - a.changePercent);
  results.forEach((r, i) => { r.sr = i + 1; });

  console.log(`Swing scanner complete: ${results.length} stocks passed all 12 filters`);
  return results;
}

// --- IPO Base Scanner ---
export async function runIpoScanner(): Promise<any[]> {
  // We scan the first 400 stocks of NSE_UNIQUE as that usually covers most liquid mid/small caps and new listings.
  // Alternatively, scanning the entire list is fine. To ensure it runs within limits, we'll scan all but with slightly larger batches.
  const scanList = NSE_UNIQUE.map(sym => sym.includes('.') ? sym : `${sym}.NS`);
  console.log(`IPO scanner: scanning ${scanList.length} stocks for recent listings...`);

  const results: any[] = [];
  const batchSize = 25; // 25 parallel requests to yahoo is usually safe
  let scanned = 0;

  for (let b = 0; b < scanList.length; b += batchSize) {
    const batch = scanList.slice(b, b + batchSize);
    const batchResults = await Promise.all(batch.map(async (sym) => {
      try {
        const candles = await getYahooHistory(sym, '1y', '1d');
        // If it's a recent IPO, the 1y history will be short. 
        // 90 calendar days is ~65 trading days. We allow 10 to 75 trading days (approx 2-3.5 months).
        if (!candles || candles.length < 10 || candles.length > 75) return null;
        
        const firstCandle = candles[0];
        const listingDate = new Date(firstCandle.time);
        const ageInDays = (Date.now() - listingDate.getTime()) / (1000 * 60 * 60 * 24);
        
        // Ensure it's between 10 and 110 calendar days old
        if (ageInDays < 10 || ageInDays > 110) return null;
        
        const closes = candles.map((c: any) => c.close as number);
        const highs = candles.map((c: any) => c.high as number);
        const lows = candles.map((c: any) => c.low as number);
        const vols = candles.map((c: any) => c.volume as number);
        
        const n = closes.length;
        const lastClose = closes[n - 1];
        const prevClose = closes[n - 2];
        const dailyChange = lastClose - prevClose;
        const dailyChangePercent = (dailyChange / prevClose) * 100;
        
        // 1. Total Base Depth: Should not exceed 35% from the listing peak
        const maxHighAll = Math.max(...highs);
        const minLowAll = Math.min(...lows);
        const totalDepth = (maxHighAll - minLowAll) / maxHighAll;
        if (totalDepth > 0.35) return null;
        
        // 2. Recent Consolidation: Last 10 trading days should be in a tight range (<= 15%)
        const lookback = Math.min(n, 10);
        const recentHighs = highs.slice(n - lookback);
        const recentLows = lows.slice(n - lookback);
        const maxRecent = Math.max(...recentHighs);
        const minRecent = Math.min(...recentLows);
        const recentDepth = (maxRecent - minRecent) / maxRecent;
        
        if (recentDepth > 0.15) return null;
        
        // 3. Liquidity Check: Average volume of the last 5 days
        const recentVols = vols.slice(n - Math.min(n, 5));
        const avgVol = recentVols.reduce((sum: number, v: number) => sum + (v || 0), 0) / recentVols.length;
        if (avgVol < 5000) return null; // Avoid totally illiquid penny stocks
        
        const cleanSym = sym.replace('.NS', '').replace('.BO', '');
        
        // Format to match ScannerData schema expected by frontend
        return {
          id: `ipo_${cleanSym}`,
          scannerType: 'ipo',
          stockSymbol: cleanSym,
          stockName: cleanSym, // Using symbol as name
          exchange: 'NSE',
          price: lastClose.toFixed(2),
          change: dailyChange.toFixed(2),
          changePercent: dailyChangePercent.toFixed(2),
          volume: vols[n - 1] ? vols[n - 1].toLocaleString('en-IN') : '0',
          marketCap: 'N/A', // Simple placeholder since we don't fetch full profile here
          createdAt: new Date().toISOString()
        };
      } catch (e) {
        return null; // Silent skip on error
      }
    }));

    for (const r of batchResults) {
      if (r) results.push(r);
    }
    
    scanned += batch.length;
    // Small delay between batches to avoid rate limits
    if (b + batchSize < scanList.length) {
      await new Promise(res => setTimeout(res, 80));
    }
  }

  // Sort by highest change percentage first
  results.sort((a, b) => parseFloat(b.changePercent) - parseFloat(a.changePercent));
  console.log(`IPO scanner complete: found ${results.length} stocks forming a base`);
  return results;
}




// --- Fundamentals via FMP ---
export async function getFmpFundamentals(symbol: string) {
  if (!API_CONFIGS.fmp.apiKey) return null;
  const key = API_CONFIGS.fmp.apiKey;
  try {
    // Normalize NSE/BSE symbols to FMP format when possible (remove .NS/.BO)
    const norm = symbol.replace(/\.(NS|NSE|BO|BSE)$/i, "");
    const [ratiosRes, metricsRes, profileRes] = await Promise.all([
      axios.get(`${API_CONFIGS.fmp.baseUrl}/ratios-ttm/${norm}`, { params: { apikey: key }, timeout: 12000 }),
      axios.get(`${API_CONFIGS.fmp.baseUrl}/key-metrics-ttm/${norm}`, { params: { apikey: key }, timeout: 12000 }),
      axios.get(`${API_CONFIGS.fmp.baseUrl}/profile/${norm}`, { params: { apikey: key }, timeout: 12000 }),
    ]);
    const ratios = Array.isArray(ratiosRes.data) ? ratiosRes.data[0] : ratiosRes.data?.[0];
    const metrics = Array.isArray(metricsRes.data) ? metricsRes.data[0] : metricsRes.data?.[0];
    const profile = Array.isArray(profileRes.data) ? profileRes.data[0] : profileRes.data?.[0];

    const out = {
      pe: ratios?.priceEarningsRatioTTM ?? metrics?.peRatioTTM ?? null,
      peg: ratios?.priceEarningsToGrowthRatioTTM ?? null,
      roe: ratios?.returnOnEquityTTM ?? null,
      roce: metrics?.roicTTM ?? null,
      opm: ratios?.netProfitMarginTTM ?? null,
      debtToEquity: ratios?.debtEquityRatioTTM ?? null,
      dividendYield: profile?.lastDiv ?? null,
      marketCap: profile?.mktCap ?? null,
    };
    return out;
  } catch {
    return null;
  }
}

// Get stock quote from Alpha Vantage (preferrable when API key provided)
export async function getAlphaVantageQuote(symbol: string): Promise<StockQuote | null> {
  try {
    if (!API_CONFIGS.alphaVantage.apiKey || API_CONFIGS.alphaVantage.apiKey === 'demo') {
      return null;
    }

    // TIME_SERIES_INTRADAY for near-realtime; fallback to GLOBAL_QUOTE for simplicity
    const response = await axios.get(API_CONFIGS.alphaVantage.baseUrl, {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol,
        apikey: API_CONFIGS.alphaVantage.apiKey,
      },
      timeout: 10000,
    });

    const quote = response.data?.['Global Quote'];
    if (!quote) return null;

    const price = Number(quote['05. price']);
    const previousClose = Number(quote['08. previous close']);
    const change = Number(quote['09. change']);
    const changePercentStr = quote['10. change percent'] as string | undefined;
    const changePercent = changePercentStr ? Number(changePercentStr.replace('%', '')) : (previousClose ? (change / previousClose) * 100 : 0);

    return {
      symbol: quote['01. symbol'] || symbol,
      name: symbol,
      price: price,
      change: isNaN(change) ? 0 : change,
      changePercent: isNaN(changePercent) ? 0 : changePercent,
      previousClose: previousClose,
      timestamp: new Date(),
      source: 'Alpha Vantage',
    };
  } catch (error) {
    console.error('Alpha Vantage API error:', error);
    return null;
  }
}

// Get stock news from Yahoo Finance RSS
export async function getYahooStockNews(symbol: string, limit: number = 10, opts?: { region?: string; lang?: string }): Promise<StockNews[]> {
  try {
    const response = await axios.get(API_CONFIGS.yahoo.newsUrl, {
      params: {
        s: symbol,
        region: opts?.region ?? 'IN',
        lang: opts?.lang ?? 'en-IN'
      },
      timeout: 10000
    });

    // Parse RSS XML (simplified parsing)
    const xmlText = response.data;
    const news: StockNews[] = [];
    
    // Simple regex-based parsing for RSS items
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    let count = 0;

    while ((match = itemRegex.exec(xmlText)) !== null && count < limit) {
      const itemContent = match[1];
      
      const titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
      const descriptionMatch = itemContent.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
      const linkMatch = itemContent.match(/<link>(.*?)<\/link>/);
      const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);

      if (titleMatch && linkMatch) {
        news.push({
          title: titleMatch[1],
          description: descriptionMatch ? descriptionMatch[1] : '',
          url: linkMatch[1],
          publishedAt: pubDateMatch ? new Date(pubDateMatch[1]) : new Date(),
          source: 'Yahoo Finance'
        });
        count++;
      }
    }

    return news;
  } catch (error) {
    console.error('Yahoo Finance News API error:', error);
    return [];
  }
}

// Get market indices – prefer Finnhub if key provided, fallback to Yahoo Finance
export async function getMarketIndices(): Promise<MarketIndex[]> {
  const out: MarketIndex[] = [];

  // Finnhub approach
  if (API_CONFIGS.finnhub.apiKey) {
    try {
      // Finnhub symbols for indices differ; use mapped symbols where available
      const map: Record<string, string> = {
        NIFTY_50: '^NSEI',
        SENSEX: '^BSESN',
        BANK_NIFTY: '^NSEBANK',
        NIFTY_IT: '^CNXIT',
        NIFTY_PHARMA: '^CNXPHARMA',
      };

      const requests = Object.entries(map).map(async ([name, symbol]) => {
        try {
          const r = await axios.get(`${API_CONFIGS.finnhub.baseUrl}/quote`, {
            params: { symbol, token: API_CONFIGS.finnhub.apiKey },
            timeout: 10000,
          });
          const q = r.data;
          if (q && typeof q.c === 'number' && q.c > 0) {
            const prevClose = typeof q.pc === 'number' ? q.pc : undefined;
            const computedChange = prevClose !== undefined ? q.c - prevClose : (typeof q.d === 'number' ? q.d : 0);
            const computedDp = prevClose && prevClose !== 0 ? (computedChange / prevClose) * 100 : (typeof q.dp === 'number' ? q.dp : 0);
            out.push({
              name: name.replace('_', ' '),
              symbol,
              value: q.c,
              change: computedChange,
              changePercent: computedDp,
              previousClose: prevClose,
              timestamp: new Date((q.t ?? Math.floor(Date.now() / 1000)) * 1000),
            });
          }
        } catch (e) {
          // swallow; we'll try Yahoo fallback below
        }
      });
      await Promise.all(requests);
    } catch (e) {
      // ignore; fallback below
    }
  }

  if (out.length > 0) return out;

  // Yahoo fallback
  for (const [name, symbol] of Object.entries(INDICES)) {
    try {
      const quote = await getYahooStockQuote(symbol);
      if (quote) {
        out.push({
          name: name.replace('_', ' '),
          symbol,
          value: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          previousClose: quote.previousClose,
          timestamp: quote.timestamp,
        });
      }
    } catch {
      // ignore item
    }
  }
  return out;
}

// Get multiple stock quotes
export async function getStockQuotes(symbols: string[]): Promise<StockQuote[]> {
  const quotes: StockQuote[] = [];
  
  // Process in batches to avoid overwhelming the API
  const batchSize = 5;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    // Try StockData.org first for US symbols
    const usSymbols = batch.filter(s => !/\.(NS|BO|BSE|NSE)$/i.test(s));
    if (API_CONFIGS.stockdata.apiToken && usSymbols.length > 0) {
      try {
        const sdoQuotes = await axios.get(`${API_CONFIGS.stockdata.baseUrl}/data/quote`, {
          params: { api_token: API_CONFIGS.stockdata.apiToken, symbols: usSymbols.join(','), key_by_ticker: false },
          timeout: 12000,
        });
        const data = Array.isArray(sdoQuotes.data?.data) ? sdoQuotes.data.data : [];
        data.forEach((q: any) => {
          const prev = Number(q.previous_close_price ?? 0);
          const price = Number(q.price ?? 0);
          const change = prev ? price - prev : Number(q.day_change ?? 0);
          const changePercent = prev ? (change / prev) * 100 : Number(q.day_change ?? 0);
          quotes.push({
            symbol: q.ticker,
            name: q.name || q.ticker,
            price,
            change,
            changePercent,
            volume: q.volume,
            marketCap: q.market_cap,
            high: q.day_high,
            low: q.day_low,
            open: q.day_open,
            previousClose: prev,
            timestamp: q.last_trade_time ? new Date(q.last_trade_time) : new Date(),
            source: 'StockData.org',
          });
        });
      } catch {}
    }

    const remaining = batch.filter(s => !quotes.find(q => q.symbol === s));
    const batchPromises = remaining.map(async (symbol) => {
      // Try Alpha Vantage first if key exists
      const av = await getAlphaVantageQuote(symbol);
      if (av) return av;
      return await getYahooStockQuote(symbol);
    });
    
    try {
      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          quotes.push(result.value);
        }
      });
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Batch error:', error);
    }
  }

  return quotes;
}

// Get Indian stock recommendations with real data
export async function getIndianStockRecommendations(): Promise<StockQuote[]> {
  const symbols = Object.values(INDIAN_STOCKS);
  return await getStockQuotes(symbols);
}

// Get financial news (general market news)
export async function getFinancialNews(limit: number = 20): Promise<StockNews[]> {
  try {
    // Prefer StockData.org if token provided
    if (API_CONFIGS.stockdata.apiToken) {
      const r = await axios.get(`${API_CONFIGS.stockdata.baseUrl}/news/all`, {
        params: { api_token: API_CONFIGS.stockdata.apiToken, language: 'en', limit, group_similar: true },
        timeout: 12000,
      });
      const items = Array.isArray(r.data?.data) ? r.data.data : [];
      return items.map((n: any) => ({
        title: n.title,
        description: n.description || n.snippet || '',
        url: n.url,
        publishedAt: new Date(n.published_at),
        source: n.source || 'StockData.org',
      }));
    }
    // Prefer Finnhub if key provided
    if (API_CONFIGS.finnhub.apiKey) {
      const r = await axios.get(`${API_CONFIGS.finnhub.baseUrl}/news`, {
        params: { category: 'general', token: API_CONFIGS.finnhub.apiKey },
        timeout: 10000,
      });
      const items = Array.isArray(r.data) ? r.data : [];
      const mapped: StockNews[] = items.slice(0, limit).map((n: any) => ({
        title: n.headline,
        description: n.summary,
        url: n.url,
        publishedAt: new Date((n.datetime ?? Math.floor(Date.now() / 1000)) * 1000),
        source: n.source || 'Finnhub',
      }));
      return mapped;
    }

    // Fallback to Yahoo Finance India RSS (finance/equity focus via ^NSEI)
    const results = await Promise.allSettled([
      getYahooStockNews('^NSEI', limit, { region: 'IN', lang: 'en-IN' }),
    ]);
    const all: StockNews[] = [];
    results.forEach((r) => { if (r.status === 'fulfilled') all.push(...r.value); });
    return all.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()).slice(0, limit);
  } catch (error) {
    console.error('Error fetching financial news:', error);
    return [];
  }
}

// Yahoo Finance symbol search with NSE/BSE support
export async function searchStocksYahoo(query: string): Promise<{ symbol: string; name: string; exchange?: string }[]> {
  try {
    const r = await axios.get('https://query2.finance.yahoo.com/v1/finance/search', {
      params: { q: query, quotesCount: 10, newsCount: 0, listsCount: 0 },
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const quotes = Array.isArray(r.data?.quotes) ? r.data.quotes : [];
    return quotes
      .filter((q: any) => q.symbol && q.shortname)
      .map((q: any) => ({ symbol: q.symbol as string, name: q.shortname as string, exchange: q.exchange }))
      .slice(0, 10);
  } catch (e) {
    return [];
  }
}

// Fallback to mock data if APIs fail
export function getMockStockData(): StockQuote[] {
  return [
    {
      symbol: 'RELIANCE.NS',
      name: 'Reliance Industries Limited',
      price: 2456.50,
      change: 23.40,
      changePercent: 0.96,
      volume: 1234567,
      marketCap: 16650000000000,
      high: 2467.80,
      low: 2433.10,
      open: 2440.20,
      previousClose: 2433.10,
      timestamp: new Date(),
      source: 'Mock Data'
    },
    {
      symbol: 'TCS.NS',
      name: 'Tata Consultancy Services Limited',
      price: 3847.25,
      change: -45.75,
      changePercent: -1.18,
      volume: 987654,
      marketCap: 14080000000000,
      high: 3892.00,
      low: 3820.50,
      open: 3880.75,
      previousClose: 3893.00,
      timestamp: new Date(),
      source: 'Mock Data'
    }
  ];
}

export function getMockNewsData(): StockNews[] {
  return [
    {
      title: 'Indian Markets Show Strong Performance in Q4',
      description: 'NSE and BSE indices reached new highs as investors showed confidence in the Indian economy.',
      url: 'https://example.com/news/indian-markets-q4',
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      source: 'Mock News',
      sentiment: 'positive'
    },
    {
      title: 'Tech Stocks Lead Market Rally',
      description: 'Technology companies saw significant gains as digital transformation continues across industries.',
      url: 'https://example.com/news/tech-stocks-rally',
      publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      source: 'Mock News',
      sentiment: 'positive'
    }
  ];
}
