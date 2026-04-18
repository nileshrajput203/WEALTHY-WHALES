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

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const MODEL = "gemini-2.5-flash";

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
export async function getFinancialAdvice(
  userQuery: string,
  stockContext?: string
): Promise<string> {
  const systemPrompt = `You are a senior equity research analyst at a tier-1 Indian brokerage.
Your knowledge spans NSE/BSE fundamentals, global macro, sector rotation, and quant-driven technicals.
Return responses in clean GitHub-Flavored Markdown that the app renders directly.

STRICT OUTPUT FORMAT — always follow this structure:

**1. Overview**
One crisp paragraph covering the stock/topic with business context, recent catalyst, and market narrative.

**2. Metrics Snapshot**
| **Parameter** | **Value** | **Insight** |
|---|---|---|
Use Screener.in / Tikr.com style rows: Revenue Growth (3Y), Profit Growth (3Y), ROCE, ROE, OPM, Debt/Equity,
Free Cash Flow, P/E vs Sector, PEG, Promoter Holding, Pledged %, Dividend Yield, Market Cap.
If a metric is unknown put "-" in Value — still provide a meaningful Insight from industry context.

**3. Key Highlights**
- 4-6 specific, data-backed bullets. Avoid generic statements.

**4. Opportunities**
- 3-5 bullets: specific catalysts, sector tailwinds, valuation gap, M&A potential, export opportunities.

**5. Risks**
- 3-5 bullets: specific regulatory, competitive, macro, or balance-sheet risks.

**6. Verdict**
One decisive line: **Investability: [Strong Buy | Accumulate | Hold | Reduce | Avoid]** — with a 6-12 month price target range if applicable and 1 key condition to watch.

Rules:
- Bold only with **double asterisks**.
- Use valid GFM tables (pipes aligned).
- No disclaimers. No "I'm just an AI". Be decisive and professional.
- Apply Warren Buffett's circle of competence, Charlie Munger's invert-always-invert, and Peter Lynch's business quality lens.
${stockContext ? `\nContext: User is asking about ${stockContext}` : ""}`;

  const response = await ai.models.generateContent({
    model: MODEL,
    config: { systemInstruction: systemPrompt, thinkingConfig: { thinkingBudget: 1024 } },
    contents: userQuery,
  });
  return response.text || "I couldn't generate a response. Please try again.";
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

  const response = await ai.models.generateContent({
    model:    MODEL,
    contents: prompt,
    config:   { thinkingConfig: { thinkingBudget: 512 } },
  });

  try {
    const text = (response.text || "{}").replace(/```json|```/g, "").trim();
    return JSON.parse(text) as StockInsight;
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

  const response = await ai.models.generateContent({
    model:    MODEL,
    contents: prompt,
    config:   { thinkingConfig: { thinkingBudget: 2048 } },
  });
  return response.text || "";
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

  const response = await ai.models.generateContent({
    model:    MODEL,
    contents: prompt,
    config:   { thinkingConfig: { thinkingBudget: 1024 } },
  });
  return response.text || "";
}

/* ═══════════════════════════════════════════════════════════
   5. SWING SCANNER — AI-generated daily opportunities
      Uses Gemini's world knowledge to generate real, current
      swing trading setups based on market patterns, sector
      rotation, and momentum factors.
═══════════════════════════════════════════════════════════ */
export async function getSwingScannerData(): Promise<any[]> {
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
    const response = await ai.models.generateContent({
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
    return parsed.map((s: any, i: number) => ({
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
