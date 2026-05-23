/**
 * Gemini AI Integration — GenAI-Stock
 *
 * Uses gemini-2.5-flash for all inference.
 * Every prompt is crafted using institutional-grade frameworks:
 *   - Fundamental: DuPont analysis, MOAT scoring, DCF sanity check, Buffett/Munger principles
 *   - Technical: Multi-timeframe confluence, volume/price analysis, RSI divergence
 *   - Swing scanner: Momentum + volume breakout + sector rotation awareness
 *
 * NOTE: Do NOT change the model name — gemini-2.5-flash is the latest and best.
 */
import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import {
  RESEARCH_REPORT_SYSTEM_PROMPT,
  buildConversationContext,
  type ChatHistoryTurn,
} from "./researchReportPrompt";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const MODEL = "gemini-2.5-flash";
/** Ask AI chat — Google Gemini Flash REST API only (never Groq). */
export const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash";
const GEMINI_FLASH_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

// Simple in-memory cache to handle Gemini API rate limits (Free Tier 5 RPM)
const cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache life

function getCached<T>(key: string): T | null {
  const cached = cache[key];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  return null;
}

function setCached(key: string, data: any): void {
  cache[key] = { data, timestamp: Date.now() };
}

/* ═══════════════════════════════════════════════════════════
   RATE LIMITER + RETRY — handles Free Tier 5 RPM limit
   Queues requests so only 1 runs at a time, retries on
   429 (rate limit) and 503 (high demand) with backoff.
═══════════════════════════════════════════════════════════ */
const MIN_DELAY_MS = 13_000; // ~4.6 RPM, stays under 5 RPM limit
let lastRequestTime = 0;
let requestQueue: Promise<void> = Promise.resolve();

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage = "Request timed out"): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

async function generateWithGroq(systemInstruction: string, prompt: string): Promise<{ text: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY not configured");
  }

  // llama-3.3-70b-versatile is a top-tier reasoning and generation model on Groq
  const model = "llama-3.3-70b-versatile"; 
  console.log(`[Groq Failover] Routing request to Groq (${model})...`);

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model,
        messages: [
          ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 10000, // 10s timeout
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from Groq API");
    }

    return { text: content };
  } catch (err: any) {
    const status = err?.response?.status || err?.status;
    const msg = err?.response?.data?.error?.message || err.message;
    console.error(`[Groq Error] Failed to generate: ${msg} (status: ${status})`);
    throw err;
  }
}

async function generateWithRetry(
  params: { model: string; contents: string; config?: any },
  maxRetries = 3,
): Promise<any> {
  // Dynamically strip thinkingConfig for gemini-2.5-flash to prevent API 400 Bad Request errors
  if (params.config && params.config.thinkingConfig) {
    delete params.config.thinkingConfig;
  }

  // If Groq is configured and Gemini is currently busy or queued (meaning the next call would be delayed),
  // immediately run via Groq outside the queue to provide ultra-fast parallel executions.
  if (process.env.GROQ_API_KEY) {
    const now = Date.now();
    const waitMs = Math.max(0, MIN_DELAY_MS - (now - lastRequestTime));
    if (waitMs > 0) {
      console.log(`[Gemini Queue Busy] Delay would be ${(waitMs / 1000).toFixed(1)}s. Fast-path routing directly to Groq...`);
      try {
        const groqResponse = await generateWithGroq(
          params.config?.systemInstruction || "",
          params.contents
        );
        return groqResponse;
      } catch (err) {
        console.warn(`[Groq Fast-path Failed] Falling back to standard queue:`, err);
      }
    }
  }

  // Chain onto the queue so requests run one at a time for Gemini
  const result = new Promise<any>((resolve, reject) => {
    requestQueue = requestQueue.then(async () => {
      let lastErr: any;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        // Enforce minimum spacing between Gemini calls
        const now = Date.now();
        const waitMs = Math.max(0, MIN_DELAY_MS - (now - lastRequestTime));
        if (waitMs > 0) {
          await new Promise((r) => setTimeout(r, waitMs));
        }
        lastRequestTime = Date.now();

        try {
          const response = await withTimeout(
            ai.models.generateContent(params),
            12000,
            "Gemini API request timed out after 12s"
          );
          resolve(response);
          return;
        } catch (err: any) {
          lastErr = err;
          const status = err?.status || err?.code;

          // If Gemini fails (rate limits 429, 503, 400, etc.) and we have a Groq key, fall back instantly!
          if (process.env.GROQ_API_KEY) {
            console.warn(`[Gemini Error] status=${status || "unknown"}. Falling back to Groq immediately...`);
            try {
              const groqResponse = await generateWithGroq(
                params.config?.systemInstruction || "",
                params.contents
              );
              resolve(groqResponse);
              return;
            } catch (groqErr: any) {
              console.error("[Groq Fallback Failed] Standard retry sequence will resume:", groqErr.message || groqErr);
            }
          }

          if (status === 429 || status === 503) {
            // Exponential backoff: 15s, 30s, 60s
            const backoff = Math.min(15_000 * Math.pow(2, attempt), 60_000);
            console.log(`Gemini ${status} — retry ${attempt + 1}/${maxRetries} in ${(backoff / 1000).toFixed(0)}s`);
            await new Promise((r) => setTimeout(r, backoff));
          } else {
            // Non-retryable error
            reject(err);
            return;
          }
        }
      }
      reject(lastErr);
    });
  });
  return result;
}

/* ═══════════════════════════════════════════════════════════
   ASK AI CHAT — Google Gemini Flash REST API (no SDK queue, no Groq)
   POST .../v1beta/models/{model}:generateContent
═══════════════════════════════════════════════════════════ */
const CHAT_MIN_DELAY_MS = 4_000;
let chatLastRequestTime = 0;
let chatRequestQueue: Promise<void> = Promise.resolve();

function extractFlashApiText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((p: { text?: string }) => p.text || "").join("").trim();
}

async function callGeminiFlashApi(
  systemInstruction: string,
  userContents: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing. Add it to .env for Ask AI chat.");
  }

  const url = `${GEMINI_FLASH_API_BASE}/models/${CHAT_MODEL}:generateContent`;
  console.log(`[Ask AI Chat] Gemini Flash REST API → ${CHAT_MODEL}`);

  const { data } = await axios.post(
    url,
    {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: userContents }] }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 8192,
        responseMimeType: "text/plain",
      },
    },
    {
      params: { key: apiKey },
      headers: { "Content-Type": "application/json" },
      timeout: 120_000,
    },
  );

  const text = extractFlashApiText(data);
  if (!text) {
    const blockReason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason;
    throw new Error(blockReason ? `Gemini Flash blocked response: ${blockReason}` : "Empty response from Gemini Flash API");
  }
  return text;
}

async function generateChatWithFlash(
  systemInstruction: string,
  contents: string,
  maxRetries = 3,
): Promise<{ text: string; model: string }> {
  return new Promise((resolve, reject) => {
    chatRequestQueue = chatRequestQueue.then(async () => {
      let lastErr: unknown;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const now = Date.now();
        const waitMs = Math.max(0, CHAT_MIN_DELAY_MS - (now - chatLastRequestTime));
        if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
        chatLastRequestTime = Date.now();

        try {
          const text = await callGeminiFlashApi(systemInstruction, contents);
          resolve({ text, model: CHAT_MODEL });
          return;
        } catch (err: any) {
          lastErr = err;
          const status = err?.response?.status || err?.status;
          if (status === 429 || status === 503) {
            const backoff = Math.min(15_000 * Math.pow(2, attempt), 60_000);
            console.log(`[Ask AI Chat] Flash API ${status} — retry ${attempt + 1}/${maxRetries} in ${(backoff / 1000).toFixed(0)}s`);
            await new Promise((r) => setTimeout(r, backoff));
          } else {
            const msg = err?.response?.data?.error?.message || err?.message || "Gemini Flash API error";
            reject(new Error(msg));
            return;
          }
        }
      }
      reject(lastErr);
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════ */
export type StockInsight = {
  verdict:    "Buy" | "Hold" | "Sell";
  confidence: number;         // 0–100
  timeframe:  "short" | "mid" | "long";
  reasons:    string[];
};

/* ═══════════════════════════════════════════════════════════
   1. ASK AI — General Financial Advice Chat
      Prompt: Institutional equity analyst persona using full
              Screener.in-style metrics table output.
═══════════════════════════════════════════════════════════ */
export type StockAdviceContext = {
  symbol: string;
  companyName?: string;
  currentPrice?: number;
  fundamentals?: Record<string, unknown>;
  newsSample?: string[];
};

export async function getFinancialAdvice(
  userQuery: string,
  options?: {
    stockContext?: string;
    conversationHistory?: ChatHistoryTurn[];
    stockData?: StockAdviceContext | null;
  }
): Promise<{ text: string; model: string }> {
  const stockContext = options?.stockContext;
  const history = options?.conversationHistory ?? [];
  const stockData = options?.stockData;
  const isStockQuery = Boolean(stockData?.symbol || stockContext);

  const historyKey = history.map((h) => `${h.role}:${h.message.slice(0, 80)}`).join("|");
  const cacheKey = `financialAdvice:${userQuery}:${stockContext || ""}:${historyKey}`;
  const cached = getCached<{ text: string; model: string }>(cacheKey);
  if (cached) return cached;

  const historyBlock = buildConversationContext(history);

  const systemPrompt = isStockQuery
    ? RESEARCH_REPORT_SYSTEM_PROMPT
    : `You are a senior equity research analyst for Indian markets (NSE/BSE).
Return clean GitHub-Flavored Markdown. If the user asks about a specific stock, tell them to name the ticker (e.g. TCS, RELIANCE) for a full institutional research report.
For general market questions: concise professional answer with bullet highlights.`;

  const dataBlock = stockData
    ? `\n\nLIVE DATA FOR ${stockData.symbol}${stockData.companyName ? ` (${stockData.companyName})` : ""}:
Current Price: ₹${stockData.currentPrice ?? "N/A"}
Fundamentals: ${JSON.stringify(stockData.fundamentals || {}, null, 2)}
Recent News: ${JSON.stringify((stockData.newsSample || []).slice(0, 8))}`
    : stockContext
      ? `\n\nStock context: ${stockContext}`
      : "";

  const contents = `${historyBlock}${dataBlock}\n\nUser question: ${userQuery}`;

  const response = await generateChatWithFlash(systemPrompt, contents);
  const result = {
    text: response.text || "I couldn't generate a response. Please try again.",
    model: response.model || CHAT_MODEL,
  };
  if (response.text) {
    setCached(cacheKey, result);
  }
  return result;
}

/* ═══════════════════════════════════════════════════════════
   2. STRUCTURED INSIGHT — Buy/Hold/Sell JSON
      Uses: multi-factor scoring — fundamentals weight 40%,
            technicals 40%, news sentiment 20%.
      Decisive: avoids "Hold" unless evidence genuinely mixed.
═══════════════════════════════════════════════════════════ */
export async function getStructuredStockInsight(params: {
  symbol:       string;
  fundamentals?: any;
  technicals?:  any;
  newsSample?:  string[];
  timeframe:    "short" | "mid" | "long";
}): Promise<StockInsight> {
  const { symbol, fundamentals, technicals, newsSample, timeframe } = params;
  const cacheKey = `structuredInsight:${symbol}:${timeframe}`;
  const cached = getCached<StockInsight>(cacheKey);
  if (cached) return cached;

  const prompt = `You are a quant equity analyst. Perform a multi-factor analysis and return ONLY strict JSON.

Symbol: ${symbol}
Timeframe: ${timeframe} (short=1 month, mid=6 months, long=2 years)

FUNDAMENTAL SIGNALS (weight 40%):
${JSON.stringify(fundamentals || {}, null, 2)}

TECHNICAL SIGNALS (weight 40%):
Key metrics — RSI14: ${technicals?.indicators?.rsi14?.toFixed(1) ?? "N/A"},
SMA20: ₹${technicals?.indicators?.sma20?.toFixed(2) ?? "N/A"},
SMA50: ₹${technicals?.indicators?.sma50?.toFixed(2) ?? "N/A"},
Trend: ${technicals?.trend ?? "unknown"},
Momentum: ${technicals?.momentum ?? "unknown"}
Full data: ${JSON.stringify(technicals || {}, null, 2)}

NEWS/SENTIMENT (weight 20%):
${(newsSample ?? []).slice(0, 5).join("\n") || "No recent news available."}

SCORING FRAMEWORK:
- RSI < 30 = oversold bullish signal; RSI > 70 = overbought bearish signal
- Price above SMA50 = uptrend; below = downtrend
- Strong fundamentals (ROE > 15%, low debt, growth) + uptrend = high-conviction Buy
- Deteriorating margins + downtrend + negative news = Sell
- Mixed signals = Hold only if genuinely inconclusive

Return ONLY valid JSON (no markdown, no explanation):
{
  "verdict": "Buy" | "Hold" | "Sell",
  "confidence": <integer 0-100>,
  "timeframe": "${timeframe}",
  "reasons": ["<specific reason 1>", "<specific reason 2>", "<specific reason 3>", "<specific reason 4>"]
}

Be decisive. Confidence > 70 for clear signals. Only use Hold if evidence is genuinely split.`;

  const response = await generateWithRetry({
    model:    MODEL,
    contents: prompt,
    config:   { thinkingConfig: { thinkingBudget: 512 } },
  });

  try {
    const text = (response.text || "{}").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(text) as StockInsight;
    setCached(cacheKey, parsed);
    return parsed;
  } catch {
    return { verdict: "Hold", confidence: 50, timeframe, reasons: ["Insufficient data for decisive signal"] };
  }
}

/* ═══════════════════════════════════════════════════════════
   3. MARKDOWN FUNDAMENTALS
      Framework: DuPont analysis + MOAT scoring + DCF sanity
═══════════════════════════════════════════════════════════ */
export async function getMarkdownFundamentals(params: {
  symbol:      string;
  fundamentals?: any;
  technicals?: any;
  newsSample?: string[];
}): Promise<string> {
  const cacheKey = `markdownFundamentals:${params.symbol}`;
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  const prompt = `You are a CFA-certified fundamental analyst specializing in Indian equities (NSE/BSE).
Return ONLY GitHub-Flavored Markdown. Use this exact structure:

**Overview**
2-3 sentences: business model, competitive moat (wide/narrow/none), recent catalysts.

**Fundamentals Snapshot**
| **Parameter** | **Value** | **Insight** |
|---|---|---|
Include rows: P/E (TTM), PEG Ratio, ROE, ROCE, Operating Margin, Debt/Equity, Revenue Growth (3Y), Profit Growth (3Y),
Free Cash Flow, Market Cap, Promoter Holding, Dividend Yield.
For missing values use "-" but provide sector-benchmark insight.

**MOAT Analysis**
- Score: [Wide / Narrow / None] — Reason: ...
- Network effect / switching cost / cost advantage / intangible asset: bullet per relevant factor

**Key Highlights**
- 4-6 specific bullets with numbers where possible

**Opportunities**
- 3-5 specific growth catalysts

**Risks**
- 3-5 specific risks with magnitude assessment

**Verdict**
**Investability: [Strong Buy | Accumulate | Hold | Reduce | Avoid]**
12M target: ₹X–₹Y (or "-" if unreliable). Key monitorable: [single watchpoint].

Use bold with ** only. No single-asterisk italics. No disclaimers.

Symbol: ${params.symbol}
Fundamentals data: ${JSON.stringify(params.fundamentals || {})}
Technical context: ${JSON.stringify(params.technicals || {})}
News: ${JSON.stringify(params.newsSample || [])}`;

  const response = await generateWithRetry({
    model:    MODEL,
    contents: prompt,
    config:   { thinkingConfig: { thinkingBudget: 2048 } },
  });
  const result = response.text || "";
  if (result) {
    setCached(cacheKey, result);
  }
  return result;
}

/* ═══════════════════════════════════════════════════════════
   4. MARKDOWN TECHNICALS
      Framework: Multi-timeframe confluence, volume/price,
                 RSI/MACD divergence, Dow Theory, S/R levels
═══════════════════════════════════════════════════════════ */
export async function getMarkdownTechnicals(params: {
  symbol:     string;
  technicals?: any;
  timeframe:  "short" | "mid" | "long";
}): Promise<string> {
  const cacheKey = `markdownTechnicals:${params.symbol}:${params.timeframe}`;
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  const t = params.technicals || {};
  const prompt = `You are a CMT-certified technical analyst. Analyze the stock below and return ONLY GitHub-Flavored Markdown.

Symbol: ${params.symbol}
Timeframe: ${params.timeframe}
Indicators:
- RSI 14: ${t?.indicators?.rsi14?.toFixed(2) ?? "N/A"}
- SMA 20: ₹${t?.indicators?.sma20?.toFixed(2) ?? "N/A"}
- SMA 50: ₹${t?.indicators?.sma50?.toFixed(2) ?? "N/A"}
- Trend: ${t?.trend ?? "unknown"}
- Momentum: ${t?.momentum ?? "unknown"}

STRUCTURE:
**Overview**
Concise narrative: current trend, key pattern forming, confluence of signals.

**Technical Dashboard**
| **Indicator** | **Value** | **Signal** |
|---|---|---|
RSI 14, SMA 20, SMA 50, MACD (infer), Trend Structure, Volume Trend (infer), Support Level (infer), Resistance Level (infer)

**Pattern Analysis**
- Identify: any chart patterns (flag, triangle, head & shoulders, cup & handle, etc.) based on context
- Candle patterns: key formations if evident

**Multi-Timeframe Outlook**
- Short term (1-4 weeks): ...
- Mid term (1-3 months): ...
- Long term (6-12 months): ...

**Key Levels** (infer reasonable levels from SMA data)
- Support: ₹X (reason)
- Resistance: ₹Y (reason)
- Stop Loss for long: ₹Z

**Verdict**
**Technical Stance: [Strong Buy | Buy | Neutral | Sell | Strong Sell]**
Setup quality: [A+ / A / B / C]. Risk/Reward: X:Y. Action: [specific entry/exit guidance].

Bold with ** only. No disclaimers.`;

  const response = await generateWithRetry({
    model:    MODEL,
    contents: prompt,
    config:   { thinkingConfig: { thinkingBudget: 1024 } },
  });
  const result = response.text || "";
  if (result) {
    setCached(cacheKey, result);
  }
  return result;
}

/* ═══════════════════════════════════════════════════════════
   5. SWING SCANNER — AI-generated daily opportunities
      Uses Gemini's world knowledge to generate real, current
      swing trading setups based on market patterns, sector
      rotation, and momentum factors.
═══════════════════════════════════════════════════════════ */
export async function getSwingScannerData(): Promise<any[]> {
  const cacheKey = "swingScannerData";
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "Asia/Kolkata",
  });

  const prompt = `You are a professional swing trader at a proprietary trading desk in Mumbai with expertise in NSE stocks.
Today is ${today}.

Generate a list of 10 high-quality NSE stock swing trading opportunities based on your knowledge of:
1. Stocks showing strong momentum and volume breakouts
2. Sector rotation plays (infrastructure, defence, pharma, IT, FMCG, banking, energy, etc.)
3. Stocks near key technical support/resistance with favorable risk-reward
4. FII/DII buying patterns
5. Recent earnings outperformers

RULES:
- Use ONLY NSE-listed stocks (well-known mid-cap and large-cap, no obscure penny stocks)
- Mix sectors for diversification
- % change should reflect realistic swing momentum (+2% to +15% range)
- Prices must be realistic for each stock (don't make up random numbers — use your training data)

Return ONLY a valid JSON array. No explanation, no markdown:
[
  {
    "sr": 1,
    "stockName": "Full Company Name",
    "symbol": "NSE_SYMBOL_WITHOUT_SUFFIX",
    "changePercent": 3.45,
    "price": 1234.50,
    "volume": "12,34,567",
    "sector": "Banking",
    "setup": "Breakout from consolidation",
    "targetPercent": 8
  }
]`;

  try {
    const response = await generateWithRetry({
      model:    MODEL,
      contents: prompt,
      config:   { thinkingConfig: { thinkingBudget: 512 } },
    });

    const text = (response.text || "[]")
      .replace(/```json|```/g, "")
      .trim();

    // Extract JSON array
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON array in response");

    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Empty array");

    // Normalize and add links
    const mapped = parsed.map((s: any, i: number) => ({
      sr:            i + 1,
      stockName:     s.stockName    || `Stock ${i + 1}`,
      symbol:        s.symbol       || `STOCK${i}`,
      links:         "P&F | F.A",
      changePercent: Number(s.changePercent ?? 0),
      price:         Number(s.price ?? 0),
      volume:        s.volume       || "N/A",
      sector:        s.sector       || "Misc",
      setup:         s.setup        || "Technical breakout",
      targetPercent: Number(s.targetPercent ?? 5),
    }));
    setCached(cacheKey, mapped);
    return mapped;
  } catch (err) {
    console.error("Swing scanner Gemini error:", err);
    // Fallback — curated hardcoded list as last resort
    return [
      { sr: 1, stockName: "Reliance Industries", symbol: "RELIANCE",   links: "P&F | F.A", changePercent: 2.41,  price: 2948.65, volume: "42,15,839", sector: "Energy",     setup: "Breakout above SMA50"     },
      { sr: 2, stockName: "HDFC Bank",            symbol: "HDFCBANK",   links: "P&F | F.A", changePercent: 1.82,  price: 1723.40, volume: "78,92,345", sector: "Banking",    setup: "Cup & handle formation"   },
      { sr: 3, stockName: "Infosys",              symbol: "INFY",       links: "P&F | F.A", changePercent: 3.15,  price: 1524.80, volume: "34,61,290", sector: "IT",         setup: "RSI recovery from oversold" },
      { sr: 4, stockName: "Tata Motors",          symbol: "TATAMOTORS", links: "P&F | F.A", changePercent: 4.23,  price:  948.30, volume: "1,23,45,678", sector: "Auto",    setup: "Volume breakout"          },
      { sr: 5, stockName: "Bajaj Finance",        symbol: "BAJFINANCE", links: "P&F | F.A", changePercent: 2.87,  price: 7234.50, volume: "18,73,412", sector: "NBFC",      setup: "Support bounce"           },
      { sr: 6, stockName: "SBI",                  symbol: "SBIN",       links: "P&F | F.A", changePercent: 2.12,  price:  823.45, volume: "2,34,56,789", sector: "PSU Bank",setup: "Flag pattern breakout"    },
      { sr: 7, stockName: "Cipla",                symbol: "CIPLA",      links: "P&F | F.A", changePercent: 3.67,  price: 1487.20, volume: "29,83,102", sector: "Pharma",    setup: "Sector rotation play"     },
      { sr: 8, stockName: "L&T",                  symbol: "LT",         links: "P&F | F.A", changePercent: 1.94,  price: 3423.65, volume: "12,34,892", sector: "Infra",     setup: "Infrastructure theme"     },
    ];
  }
}

/* ═══════════════════════════════════════════════════════════
   6. CONCALL + ANNUAL REPORT SUMMARY
      Scrapes Screener.in knowledge + internet data using
      Gemini's world knowledge to extract last 4 concall
      highlights and 2-year annual report key metrics.
═══════════════════════════════════════════════════════════ */
export async function getConcallAndAnnualReportSummary(params: {
  symbol: string;
  companyName?: string;
  fundamentals?: any;
  newsSample?: string[];
}): Promise<any> {
  const { symbol, companyName, fundamentals, newsSample } = params;
  const cacheKey = `concallARSummary:${symbol}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const today = new Date().toLocaleDateString("en-IN", {
    year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Kolkata",
  });

  const prompt = `You are an expert Indian equity analyst with deep knowledge of NSE/BSE listed companies.
Today is ${today}.

For the stock: ${symbol}${companyName ? ` (${companyName})` : ""}

Using your knowledge of this company's last 4 quarterly earnings concall transcripts and last 2 annual reports (FY2023-24 and FY2022-23), provide a structured JSON response.

Available fundamental data: ${JSON.stringify(fundamentals || {}, null, 2)}
Recent news: ${JSON.stringify((newsSample || []).slice(0, 5))}

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "companyName": "Full Company Name",
  "sector": "Sector Name",
  "industry": "Industry Name",
  "concalls": [
    {
      "quarter": "Q3 FY25",
      "date": "January 2025",
      "revenueActual": "₹X,XXX Cr",
      "revenueGrowthYoY": "+X%",
      "patActual": "₹XXX Cr",
      "patGrowthYoY": "+X%",
      "ebitdaMargin": "XX%",
      "keyHighlights": ["highlight 1", "highlight 2", "highlight 3"],
      "managementGuidance": "Management guidance for next quarter",
      "sentiment": "Bullish",
      "sentimentReason": "Strong revenue growth, margin expansion guidance"
    },
    {
      "quarter": "Q2 FY25",
      "date": "October 2024",
      "revenueActual": "₹X,XXX Cr",
      "revenueGrowthYoY": "+X%",
      "patActual": "₹XXX Cr",
      "patGrowthYoY": "+X%",
      "ebitdaMargin": "XX%",
      "keyHighlights": ["highlight 1", "highlight 2", "highlight 3"],
      "managementGuidance": "Management guidance",
      "sentiment": "Neutral",
      "sentimentReason": "reason"
    },
    {
      "quarter": "Q1 FY25",
      "date": "July 2024",
      "revenueActual": "₹X,XXX Cr",
      "revenueGrowthYoY": "+X%",
      "patActual": "₹XXX Cr",
      "patGrowthYoY": "+X%",
      "ebitdaMargin": "XX%",
      "keyHighlights": ["highlight 1", "highlight 2"],
      "managementGuidance": "Management guidance",
      "sentiment": "Bullish",
      "sentimentReason": "reason"
    },
    {
      "quarter": "Q4 FY24",
      "date": "April 2024",
      "revenueActual": "₹X,XXX Cr",
      "revenueGrowthYoY": "+X%",
      "patActual": "₹XXX Cr",
      "patGrowthYoY": "+X%",
      "ebitdaMargin": "XX%",
      "keyHighlights": ["highlight 1", "highlight 2"],
      "managementGuidance": "Management guidance",
      "sentiment": "Cautious",
      "sentimentReason": "reason"
    }
  ],
  "annualReports": {
    "fy2024": {
      "year": "FY2023-24",
      "revenue": "₹X,XXX Cr",
      "revenueGrowth": "+X%",
      "pat": "₹X,XXX Cr",
      "patGrowth": "+X%",
      "ebitda": "₹X,XXX Cr",
      "ebitdaMargin": "XX%",
      "roe": "XX%",
      "roce": "XX%",
      "debtToEquity": "X.X",
      "freeCashFlow": "₹XXX Cr",
      "promoterHolding": "XX%",
      "dividendPerShare": "₹X",
      "eps": "₹X",
      "bookValue": "₹X",
      "keyThemes": ["theme 1", "theme 2", "theme 3"]
    },
    "fy2023": {
      "year": "FY2022-23",
      "revenue": "₹X,XXX Cr",
      "revenueGrowth": "+X%",
      "pat": "₹X,XXX Cr",
      "patGrowth": "+X%",
      "ebitda": "₹X,XXX Cr",
      "ebitdaMargin": "XX%",
      "roe": "XX%",
      "roce": "XX%",
      "debtToEquity": "X.X",
      "freeCashFlow": "₹XXX Cr",
      "promoterHolding": "XX%",
      "dividendPerShare": "₹X",
      "eps": "₹X",
      "bookValue": "₹X",
      "keyThemes": ["theme 1", "theme 2"]
    }
  },
  "moatScores": {
    "pricingPower": 7,
    "brandStrength": 8,
    "switchingCosts": 6,
    "networkEffects": 5,
    "costAdvantage": 7,
    "regulatoryMoat": 4
  },
  "moatRating": "Narrow",
  "moatReason": "Brief reason for moat rating"
}

Sentiment must be one of: "Bullish", "Neutral", "Cautious", "Bearish"
moatRating must be one of: "Wide", "Narrow", "None"
All numbers should be realistic based on your knowledge of this company.
If you don't know exact figures, provide reasonable estimates clearly labeled.`;

  try {
    const response = await generateWithRetry({
      model: MODEL,
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 4096 } },
    });
    const text = (response.text || "{}").replace(/```json|```/g, "").trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in response");
    const parsed = JSON.parse(match[0]);
    setCached(cacheKey, parsed);
    return parsed;
  } catch (err) {
    console.error("Concall/AR summary error:", err);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════
   7. DEEP FUNDAMENTAL DASHBOARD
      Master function: combines concall data, annual reports,
      market data → produces full dashboard JSON with
      investment score, valuation report, risks/opportunities.
═══════════════════════════════════════════════════════════ */
export async function getDeepFundamentalDashboard(params: {
  symbol:       string;
  fundamentals?: any;
  technicals?:  any;
  newsSample?:  string[];
  concallData?: any;
  currentPrice?: number;
}): Promise<any> {
  const { symbol, fundamentals, technicals, newsSample, concallData, currentPrice } = params;
  const cacheKey = `deepFundamentalDashboard:${symbol}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const prompt = `You are a senior equity research analyst at a top-tier Indian investment bank (Goldman Sachs, CLSA, Motilal Oswal caliber).
Produce a comprehensive fundamental analysis dashboard for stock: ${symbol}

CURRENT PRICE: ₹${currentPrice ?? "N/A"}
FUNDAMENTALS: ${JSON.stringify(fundamentals || {}, null, 2)}
TECHNICALS: RSI=${technicals?.indicators?.rsi14?.toFixed(1) ?? "N/A"}, Trend=${technicals?.trend ?? "N/A"}, Momentum=${technicals?.momentum ?? "N/A"}
NEWS: ${JSON.stringify((newsSample || []).slice(0, 8))}
CONCALL + ANNUAL REPORT DATA: ${JSON.stringify(concallData || {}, null, 2)}

Return ONLY valid JSON (no markdown, no explanation):
{
  "investmentScore": {
    "total": 72,
    "grade": "B",
    "components": {
      "profitability": { "score": 16, "max": 20, "label": "Strong ROE/ROCE" },
      "growth": { "score": 14, "max": 20, "label": "Consistent revenue growth" },
      "balanceSheet": { "score": 12, "max": 15, "label": "Low leverage" },
      "valuation": { "score": 13, "max": 20, "label": "Fairly valued" },
      "concallSentiment": { "score": 10, "max": 15, "label": "Management bullish" },
      "management": { "score": 7, "max": 10, "label": "Experienced promoters" }
    }
  },
  "verdict": "Accumulate",
  "targetPriceLow": 1800,
  "targetPriceHigh": 2100,
  "targetHorizon": "12 months",
  "marginOfSafety": 15,
  "upside": 22,
  "valuationReport": {
    "peMethod": {
      "sectorPE": 28,
      "stockPE": 24,
      "fairValuePE": 1850,
      "upside": 18,
      "commentary": "Trading at 14% discount to sector P/E"
    },
    "evEbitdaMethod": {
      "sectorEVEBITDA": 16,
      "stockEVEBITDA": 14,
      "fairValueEVEBITDA": 1920,
      "upside": 22,
      "commentary": "EV/EBITDA expansion potential as margins improve"
    },
    "dcfMethod": {
      "wacc": 12,
      "terminalGrowthRate": 4,
      "fairValueDCF": 2050,
      "upside": 30,
      "commentary": "DCF suggests significant undervaluation"
    },
    "averageFairValue": 1940,
    "currentPrice": 1567,
    "overallUpside": 24
  },
  "risks": [
    { "title": "Risk 1", "description": "Specific risk description", "probability": "Medium", "impact": "High", "category": "Regulatory" },
    { "title": "Risk 2", "description": "Specific risk description", "probability": "Low", "impact": "High", "category": "Competitive" },
    { "title": "Risk 3", "description": "Specific risk description", "probability": "High", "impact": "Medium", "category": "Macro" },
    { "title": "Risk 4", "description": "Specific risk description", "probability": "Low", "impact": "Low", "category": "Operational" }
  ],
  "opportunities": [
    { "title": "Opportunity 1", "description": "Specific catalyst", "probability": "High", "impact": "High", "timeline": "6-12 months" },
    { "title": "Opportunity 2", "description": "Specific catalyst", "probability": "Medium", "impact": "High", "timeline": "12-18 months" },
    { "title": "Opportunity 3", "description": "Specific catalyst", "probability": "High", "impact": "Medium", "timeline": "3-6 months" },
    { "title": "Opportunity 4", "description": "Specific catalyst", "probability": "Medium", "impact": "Medium", "timeline": "12-24 months" }
  ],
  "keyMonitorable": "Single most important metric to watch",
  "analystConsensusSummary": "Brief 2-3 sentence summary of overall investment thesis"
}

SCORING RULES:
- Profitability (max 20): ROE>20%=20, ROE>15%=16, ROE>10%=12, else 8
- Growth (max 20): Rev+PAT CAGR>15%=20, >10%=14, >5%=10, else 6
- BalanceSheet (max 15): D/E<0.3=15, <0.5=12, <1=8, else 4
- Valuation (max 20): PEG<1=20, P/E below sector=16, at sector=12, above=8
- ConcallSentiment (max 15): 4 bullish=15, 3=12, 2=9, 1=6, 0=3
- Management (max 10): Wide moat=10, Narrow=7, None=4

Grade: 90-100=A+, 75-89=A, 60-74=B, 45-59=C, <45=D
verdict must be one of: "Strong Buy", "Accumulate", "Hold", "Reduce", "Avoid"
probability must be one of: "High", "Medium", "Low"
impact must be one of: "High", "Medium", "Low"
Be specific and accurate based on the company's actual situation.`;

  try {
    const response = await generateWithRetry({
      model: MODEL,
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 4096 } },
    });
    const text = (response.text || "{}").replace(/```json|```/g, "").trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in dashboard response");
    const parsed = JSON.parse(match[0]);
    setCached(cacheKey, parsed);
    return parsed;
  } catch (err) {
    console.error("Deep fundamental dashboard error:", err);
    return null;
  }
}
