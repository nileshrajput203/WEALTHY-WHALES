/**
 * TradingViewChart — wraps the FREE TradingView Advanced Chart widget.
 *
 * No API key required. Works for NSE, BSE, global exchanges.
 * Uses a module-level singleton pattern so the TradingView script is loaded
 * only once across all chart instances (production-grade).
 *
 * Symbol auto-conversion:
 *   "RELIANCE.NS" → "NSE:RELIANCE"
 *   "TCS.BO"      → "BSE:TCS"
 *   "RELIANCE"    → "NSE:RELIANCE"  (assumes NSE)
 *   "NSE:HDFC"    → "NSE:HDFC"      (passthrough)
 *
 * FALLBACK: If TradingView can't display a symbol (small-cap / micro-cap not
 * in TV database), automatically switches to a canvas-based line chart using
 * Yahoo price data from our own API.
 */
import { useEffect, useRef, useState, useCallback } from "react";

/* ── Global singleton script loader ──────────────────────── */
declare global {
  interface Window {
    TradingView: any;
  }
}

let _tvLoaded = false;
let _tvLoading = false;
const _tvQueue: (() => void)[] = [];

function loadTVScript(cb: () => void) {
  if (_tvLoaded) { cb(); return; }
  _tvQueue.push(cb);
  if (_tvLoading) return;
  _tvLoading = true;
  const s = document.createElement("script");
  s.src   = "https://s3.tradingview.com/tv.js";
  s.async = true;
  s.onload = () => {
    _tvLoaded  = true;
    _tvLoading = false;
    _tvQueue.forEach(fn => fn());
    _tvQueue.length = 0;
  };
  s.onerror = () => {
    _tvLoading = false;
    // Keep queue so next attempt retries
  };
  document.head.appendChild(s);
}

/* ── Symbol normalizer ───────────────────────────────────── */
/**
 * Convert Yahoo/plain symbols to TradingView widget format.
 * IMPORTANT: We use BSE: prefix (not NSE:) because TradingView's FREE
 * embeddable widget restricts NSE data (requires paid subscription),
 * but BSE data is freely available. Most Indian stocks are listed on both.
 */
export function toTVSymbol(raw: string, exchange?: string): string {
  let s = raw.trim().toUpperCase();
  if (!s) return "BSE:SENSEX"; // fallback for empty

  // Determine original suffix-based exchange before stripping
  let detectedExchange = exchange;
  if (!detectedExchange) {
    if (s.endsWith(".NS") || s.endsWith(".NSE")) {
      // For the embeddable free widget, we prefer BSE even if the suffix is .NS,
      // because TradingView's free widget restricts NSE data (needs paid plan).
      detectedExchange = "BSE";
    } else if (s.endsWith(".BO") || s.endsWith(".BSE")) {
      detectedExchange = "BSE";
    }
  }

  // Strip Yahoo suffixes iteratively to clean any double-suffixed symbols like LLOYDSME.BO.NS
  let changed = true;
  while (changed) {
    changed = false;
    if (s.endsWith(".NS"))      { s = s.slice(0, -3); changed = true; }
    else if (s.endsWith(".NSE")) { s = s.slice(0, -4); changed = true; }
    else if (s.endsWith(".BO"))  { s = s.slice(0, -3); changed = true; }
    else if (s.endsWith(".BSE")) { s = s.slice(0, -4); changed = true; }
  }

  if (s.includes(":"))        return s;            // already "NSE:RELIANCE" — passthrough
  // Index symbols
  if (s === "^NSEI" || s === "NSEI")          return "BSE:SENSEX";
  if (s === "^BSESN" || s === "BSESN")         return "BSE:SENSEX";
  if (s === "^NSEBANK" || s === "NSEBANK")       return "BSE:BANKNIFTY";
  if (s === "^CNXIT" || s === "CNXIT")         return "BSE:CNXIT";
  if (s === "^CNXPHARMA" || s === "CNXPHARMA")     return "BSE:CNXPHARMA";
  // Default: assume BSE for free widget data
  const finalExchange = (detectedExchange || "BSE").toUpperCase();
  return `${finalExchange}:${s}`;
}

/* ── Fallback Canvas Chart ───────────────────────────────── */
function FallbackChart({ symbol, height }: { symbol: string; height: number | string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [candles, setCandles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hoveredCandle, setHoveredCandle] = useState<any>(null);

  // Fetch data from our Yahoo proxy
  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/stock/${encodeURIComponent(symbol)}/technicals?range=6mo`)
      .then(r => r.json())
      .then(data => {
        if (data.candles && data.candles.length > 0) {
          setCandles(data.candles);
        } else {
          setError(true);
        }
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [symbol]);

  // Draw the chart
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || candles.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    // Chart area with padding
    const padTop = 40, padBottom = 50, padLeft = 10, padRight = 80;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;

    // Background
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);

    // Data range
    const closes = candles.map((c: any) => Number(c.close));
    const highs  = candles.map((c: any) => Number(c.high));
    const lows   = candles.map((c: any) => Number(c.low));
    const minPrice = Math.min(...lows) * 0.995;
    const maxPrice = Math.max(...highs) * 1.005;
    const priceRange = maxPrice - minPrice;

    const toX = (i: number) => padLeft + (i / (candles.length - 1)) * chartW;
    const toY = (p: number) => padTop + chartH - ((p - minPrice) / priceRange) * chartH;

    // Grid lines (horizontal)
    const gridSteps = 6;
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    ctx.font = "11px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.textAlign = "right";
    for (let i = 0; i <= gridSteps; i++) {
      const price = minPrice + (i / gridSteps) * priceRange;
      const y = toY(price);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(W - padRight, y);
      ctx.stroke();
      ctx.fillText(`₹${price.toFixed(2)}`, W - 8, y + 4);
    }

    // Draw candlesticks
    const candleWidth = Math.max(1, Math.min(8, chartW / candles.length * 0.6));
    candles.forEach((c: any, i: number) => {
      const x = toX(i);
      const open  = Number(c.open);
      const close = Number(c.close);
      const high  = Number(c.high);
      const low   = Number(c.low);

      const bullish = close >= open;
      const color = bullish ? "#10b981" : "#ef4444";

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, toY(high));
      ctx.lineTo(x, toY(low));
      ctx.stroke();

      // Body
      const bodyTop = toY(Math.max(open, close));
      const bodyBot = toY(Math.min(open, close));
      const bodyHeight = Math.max(1, bodyBot - bodyTop);
      ctx.fillStyle = color;
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });

    // Draw SMA 20 line
    if (closes.length >= 20) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(168,85,247,0.6)";
      ctx.lineWidth = 1.5;
      let started = false;
      for (let i = 19; i < closes.length; i++) {
        const slice = closes.slice(i - 19, i + 1);
        const avg = slice.reduce((a, b) => a + b, 0) / 20;
        const x = toX(i);
        const y = toY(avg);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Draw SMA 50 line
    if (closes.length >= 50) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(251,191,36,0.5)";
      ctx.lineWidth = 1.5;
      let started = false;
      for (let i = 49; i < closes.length; i++) {
        const slice = closes.slice(i - 49, i + 1);
        const avg = slice.reduce((a, b) => a + b, 0) / 50;
        const x = toX(i);
        const y = toY(avg);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // X-axis labels (dates)
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.textAlign = "center";
    ctx.font = "10px monospace";
    const labelStep = Math.max(1, Math.floor(candles.length / 8));
    for (let i = 0; i < candles.length; i += labelStep) {
      const c = candles[i];
      const date = new Date(c.date || c.timestamp);
      const label = date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      ctx.fillText(label, toX(i), H - padBottom + 20);
    }

    // Symbol title
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "left";
    const displaySym = symbol.replace(/\.(NS|BO)$/i, "");
    ctx.fillText(`${displaySym} · 6M · Yahoo Finance`, padLeft + 8, 24);

    // Legend
    ctx.font = "10px monospace";
    const legendX = W - padRight - 160;
    ctx.fillStyle = "rgba(168,85,247,0.8)";
    ctx.fillText("— SMA 20", legendX, 18);
    ctx.fillStyle = "rgba(251,191,36,0.7)";
    ctx.fillText("— SMA 50", legendX + 75, 18);

    // Hovered candle info
    if (hoveredCandle) {
      const c = hoveredCandle;
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.fillRect(padLeft + 8, 30, 260, 22);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "10px monospace";
      const d = new Date(c.date || c.timestamp).toLocaleDateString("en-IN");
      ctx.fillText(`${d}  O:₹${Number(c.open).toFixed(2)}  H:₹${Number(c.high).toFixed(2)}  L:₹${Number(c.low).toFixed(2)}  C:₹${Number(c.close).toFixed(2)}`, padLeft + 12, 44);
    }
  }, [candles, symbol, hoveredCandle]);

  useEffect(() => { drawChart(); }, [drawChart]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => drawChart());
    ro.observe(container);
    return () => ro.disconnect();
  }, [drawChart]);

  // Mouse hover for crosshair
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const padLeft = 10, padRight = 80;
    const chartW = rect.width - padLeft - padRight;
    const idx = Math.round(((mx - padLeft) / chartW) * (candles.length - 1));
    if (idx >= 0 && idx < candles.length) {
      setHoveredCandle(candles[idx]);
    }
  }, [candles]);

  if (loading) {
    return (
      <div style={{ height }} className="flex items-center justify-center bg-[#0a0a0a] rounded-xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-xs text-white/30 font-mono">Loading chart data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height }} className="flex items-center justify-center bg-[#0a0a0a] rounded-xl">
        <div className="flex flex-col items-center gap-3 text-white/40">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3l18 18M10.5 6H6a2 2 0 00-2 2v10c0 1.1.9 2 2 2h12a2 2 0 002-2v-3.5" />
          </svg>
          <span className="text-sm font-mono">No chart data available</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ height }} className="relative w-full bg-[#0a0a0a] rounded-xl overflow-hidden cursor-crosshair">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredCandle(null)}
      />
    </div>
  );
}

/* ── Props ───────────────────────────────────────────────── */
export interface TradingViewChartProps {
  /** Yahoo-style or plain symbol — auto-converted to TradingView format */
  symbol: string;
  /** exchange override — "NSE" | "BSE". Ignored when symbol already has prefix. */
  exchange?: string;
  /** Chart interval: "1", "5", "15", "30", "60", "D", "W", "M" */
  interval?: string;
  height?:  number | string;
  className?: string;
  /** Array of study IDs to show by default */
  studies?: string[];
  showToolbar?: boolean;
  allowSymbolChange?: boolean;
}

/* ── Main component ──────────────────────────────────────── */
export function TradingViewChart({
  symbol,
  exchange,
  interval      = "D",
  height        = 500,
  className     = "",
  studies       = ["RSI@tv-basicstudies", "MAExp@tv-basicstudies"],
  showToolbar   = true,
  allowSymbolChange = true,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId     = useRef(`tv_${Math.random().toString(36).slice(2, 9)}`);
  const [loading, setLoading]       = useState(true);
  const [tvError, setTvError]       = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  // Build final TV symbol
  const tvSymbol = toTVSymbol(symbol, exchange);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setLoading(true);
    setTvError(false);
    setUseFallback(false);

    // Clear previous widget
    while (container.firstChild) container.removeChild(container.firstChild);

    const chartDiv = document.createElement("div");
    chartDiv.id = widgetId.current;
    Object.assign(chartDiv.style, { width: "100%", height: "100%" });
    container.appendChild(chartDiv);

    // Listen for TradingView "symbol_not_found" type errors via iframe communication
    // TV widget shows a notification popup when symbol isn't available.
    // We detect this by checking for the error notification after a delay.
    let errorCheckTimer: ReturnType<typeof setTimeout>;

    loadTVScript(() => {
      if (!window.TradingView || !container.contains(chartDiv)) return;
      try {
        new window.TradingView.widget({
          autosize:             true,
          symbol:               tvSymbol,
          interval,
          timezone:             "Asia/Kolkata",
          theme:                "dark",
          style:                "1",           // Candlestick
          locale:               "en",
          toolbar_bg:           "#0a0a0a",
          enable_publishing:    false,
          allow_symbol_change:  allowSymbolChange,
          hide_top_toolbar:     !showToolbar,
          hide_legend:          false,
          save_image:           false,
          withdateranges:       true,
          hide_side_toolbar:    false,
          studies,
          container_id:         widgetId.current,
          loading_screen:       { backgroundColor: "#0a0a0a", foregroundColor: "#7c3aed" },
          overrides: {
            "paneProperties.background":           "#0a0a0a",
            "paneProperties.backgroundType":       "solid",
            "scalesProperties.textColor":          "#666",
            "scalesProperties.fontSize":           11,
          },
        });
        setLoading(false);

        // Check for "symbol not found" by looking at the iframe content after 5s
        // TradingView shows OHLC as "O0 H0 L0 C0 0 (0%)" when symbol doesn't exist
        errorCheckTimer = setTimeout(() => {
          try {
            const iframe = container.querySelector("iframe");
            // If no iframe loaded, or symbol shows 0 values, switch to fallback
            if (!iframe) {
              console.log("TradingView: no iframe found, switching to fallback chart");
              setUseFallback(true);
              return;
            }
            // Check the widget header text for error indicators
            const headerText = container.textContent || "";
            if (headerText.includes("O0 H0 L0 C0 0 (0%)") || headerText.includes("O0 H0 L0 C0")) {
              console.log(`TradingView: symbol "${tvSymbol}" shows zero data, switching to fallback`);
              setUseFallback(true);
            }
          } catch {
            // Cross-origin, can't inspect — stay with TV
          }
        }, 6000);
      } catch (e) {
        console.error("TradingView widget error:", e);
        setTvError(true);
        setUseFallback(true);
        setLoading(false);
      }
    });

    // After a timeout assume loaded even if no callback (TV doesn't fire one)
    const t = setTimeout(() => setLoading(false), 3000);

    return () => {
      clearTimeout(t);
      clearTimeout(errorCheckTimer);
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  }, [tvSymbol, interval, showToolbar, studies.join(",")]);

  // If fallback mode, show our own chart
  if (useFallback) {
    return (
      <div className={`relative w-full rounded-xl overflow-hidden bg-[#0a0a0a] ${className}`}>
        <FallbackChart symbol={symbol} height={typeof height === "number" ? height : 500} />
      </div>
    );
  }

  return (
    <div
      className={`relative w-full rounded-xl overflow-hidden bg-[#0a0a0a] ${className}`}
      style={{ height }}
    >
      {/* Loading skeleton */}
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col gap-3 p-4 bg-[#0a0a0a]">
          <div className="h-8 w-48 rounded-lg bg-white/5 animate-pulse" />
          <div className="flex-1 rounded-lg bg-white/3 animate-pulse" />
          <div className="h-20 rounded-lg bg-white/3 animate-pulse" />
        </div>
      )}

      {/* Error fallback */}
      {tvError && !useFallback && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-white/40 gap-3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3l18 18M10.5 6H6a2 2 0 00-2 2v10c0 1.1.9 2 2 2h12a2 2 0 002-2v-3.5" />
            <path d="M14 2v4h4" /><path d="M14 2l6 6" />
          </svg>
          <span className="text-sm font-mono">Chart unavailable — check your connection</span>
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
