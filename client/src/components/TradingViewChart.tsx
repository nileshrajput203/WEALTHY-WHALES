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
 */
import { useEffect, useRef, useState } from "react";

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
export function toTVSymbol(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (s.includes(":"))        return s;            // already "NSE:RELIANCE"
  if (s.endsWith(".NS"))      return `NSE:${s.slice(0, -3)}`;
  if (s.endsWith(".NSE"))     return `NSE:${s.slice(0, -4)}`;
  if (s.endsWith(".BO"))      return `BSE:${s.slice(0, -3)}`;
  if (s.endsWith(".BSE"))     return `BSE:${s.slice(0, -4)}`;
  if (s === "^NSEI")          return "NSE:NIFTY";
  if (s === "^BSESN")         return "BSE:SENSEX";
  if (s === "^NSEBANK")       return "NSE:BANKNIFTY";
  if (s === "^CNXIT")         return "NSE:CNXIT";
  if (s === "^CNXPHARMA")     return "NSE:CNXPHARMA";
  // Default: assume NSE (covers plain symbols from admin panel)
  return `NSE:${s}`;
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
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState(false);

  // Build final TV symbol
  const tvSymbol = (() => {
    const s = toTVSymbol(symbol);
    // If exchange override provided and symbol doesn't already have a prefix
    if (exchange && !symbol.includes(":") && !symbol.endsWith(".NS") && !symbol.endsWith(".BO")) {
      return `${exchange.toUpperCase()}:${symbol.toUpperCase()}`;
    }
    return s;
  })();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setLoading(true);
    setError(false);

    // Clear previous widget
    while (container.firstChild) container.removeChild(container.firstChild);

    const chartDiv = document.createElement("div");
    chartDiv.id = widgetId.current;
    Object.assign(chartDiv.style, { width: "100%", height: "100%" });
    container.appendChild(chartDiv);

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
      } catch (e) {
        console.error("TradingView widget error:", e);
        setError(true);
        setLoading(false);
      }
    });

    // After a timeout assume loaded even if no callback (TV doesn't fire one)
    const t = setTimeout(() => setLoading(false), 3000);

    return () => {
      clearTimeout(t);
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  }, [tvSymbol, interval, showToolbar, studies.join(",")]);

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
      {error && (
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
