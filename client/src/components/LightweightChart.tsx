import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import { Activity, Radio, RefreshCw } from "lucide-react";

interface LightweightChartProps {
  symbol: string;
  height?: number | string;
  interval?: string;
  currentPrice?: number;
  className?: string;
}

interface HoverData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  changePct: number;
}

export function LightweightChart({
  symbol,
  height = 520,
  interval = "D",
  currentPrice,
  className = "",
}: LightweightChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  const [lastCandle, setLastCandle] = useState<HoverData | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  const cleanSymbol = symbol.replace(/\.(NS|BO)$/i, "").toUpperCase();

  useEffect(() => {
    if (!containerRef.current) return;

    setLoading(true);
    setError(false);

    // Initialize Lightweight Chart
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: typeof height === "number" ? height : 520,
      layout: {
        background: {
          type: ColorType.Solid,
          color: isDark ? "#080C14" : "#FFFFFF",
        },
        textColor: isDark ? "rgba(255,255,255,0.4)" : "#64748B",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: {
          color: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)",
        },
        horzLines: {
          color: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)",
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: isDark ? "rgba(99, 102, 241, 0.4)" : "rgba(99, 102, 241, 0.6)",
          width: 1,
          style: 2, // Dashed
          labelBackgroundColor: "#6366F1",
        },
        horzLine: {
          color: isDark ? "rgba(99, 102, 241, 0.4)" : "rgba(99, 102, 241, 0.6)",
          width: 1,
          style: 2,
          labelBackgroundColor: "#6366F1",
        },
      },
      rightPriceScale: {
        borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)",
        scaleMargins: {
          top: 0.1,
          bottom: 0.22, // Leaves space for volume overlay at bottom
        },
      },
      timeScale: {
        borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Add Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10B981",
      downColor: "#F43F5E",
      borderVisible: false,
      wickUpColor: "#10B981",
      wickDownColor: "#F43F5E",
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.05,
      },
    });
    candleSeriesRef.current = candleSeries;

    // Add Volume Series (Overlayed at bottom)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "volume_overlay",
    });
    volumeSeriesRef.current = volumeSeries;

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8, // Volume bars sit in bottom 20%
        bottom: 0,
      },
    });

    // Add SMA 20 (Electric Indigo) & SMA 50 (Signal Amber)
    const sma20Series = chart.addSeries(LineSeries, {
      color: "rgba(99, 102, 241, 0.85)",
      lineWidth: 1,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });

    const sma50Series = chart.addSeries(LineSeries, {
      color: "rgba(245, 158, 11, 0.85)",
      lineWidth: 1,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });

    // Fetch Technicals & Historical Candles
    fetch(`/api/stock/${encodeURIComponent(cleanSymbol)}/technicals?range=6mo`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.candles || data.candles.length === 0) {
          setError(true);
          setLoading(false);
          return;
        }

        const rawCandles: any[] = data.candles;
        const candleMap = new Map<string, CandlestickData<Time>>();
        const volumeMap = new Map<string, HistogramData<Time>>();

        rawCandles.forEach((c) => {
          const d = new Date(c.time);
          const dateStr = d.toISOString().slice(0, 10);
          const open = Number(c.open);
          const high = Number(c.high);
          const low = Number(c.low);
          const close = Number(c.close);
          const vol = Number(c.volume || 0);

          if (!isNaN(close) && !isNaN(open)) {
            candleMap.set(dateStr, {
              time: dateStr as Time,
              open,
              high,
              low,
              close,
            });

            volumeMap.set(dateStr, {
              time: dateStr as Time,
              value: vol,
              color: close >= open ? "rgba(16, 185, 129, 0.35)" : "rgba(244, 63, 94, 0.35)",
            });
          }
        });

        // ── Ensure today's active session is accurately attached ──
        const todayStr = new Date().toISOString().slice(0, 10);
        const effectivePrice = currentPrice || (rawCandles.at(-1)?.close);

        if (effectivePrice && !isNaN(effectivePrice)) {
          const existingToday = candleMap.get(todayStr);
          if (existingToday) {
            existingToday.close = effectivePrice;
            existingToday.high = Math.max(existingToday.high, effectivePrice);
            existingToday.low = Math.min(existingToday.low, effectivePrice);
          } else {
            const prevClose = rawCandles.at(-1)?.close || effectivePrice;
            candleMap.set(todayStr, {
              time: todayStr as Time,
              open: prevClose,
              high: Math.max(prevClose, effectivePrice),
              low: Math.min(prevClose, effectivePrice),
              close: effectivePrice,
            });
            volumeMap.set(todayStr, {
              time: todayStr as Time,
              value: 150000,
              color: effectivePrice >= prevClose ? "rgba(16, 185, 129, 0.35)" : "rgba(244, 63, 94, 0.35)",
            });
          }
        }

        const sortedCandles = Array.from(candleMap.values()).sort((a, b) =>
          String(a.time).localeCompare(String(b.time))
        );
        const sortedVolumes = Array.from(volumeMap.values()).sort((a, b) =>
          String(a.time).localeCompare(String(b.time))
        );

        candleSeries.setData(sortedCandles);
        volumeSeries.setData(sortedVolumes);

        // Compute SMA 20 & SMA 50
        const closes = sortedCandles.map((c) => c.close);
        const sma20Data: LineData<Time>[] = [];
        const sma50Data: LineData<Time>[] = [];

        sortedCandles.forEach((c, idx) => {
          if (idx >= 19) {
            const slice20 = closes.slice(idx - 19, idx + 1);
            const avg20 = slice20.reduce((acc, v) => acc + v, 0) / 20;
            sma20Data.push({ time: c.time, value: avg20 });
          }
          if (idx >= 49) {
            const slice50 = closes.slice(idx - 49, idx + 1);
            const avg50 = slice50.reduce((acc, v) => acc + v, 0) / 50;
            sma50Data.push({ time: c.time, value: avg50 });
          }
        });

        sma20Series.setData(sma20Data);
        sma50Series.setData(sma50Data);

        // Fit content into viewport
        chart.timeScale().fitContent();

        // Save last candle for default display
        if (sortedCandles.length > 0) {
          const finalC = sortedCandles[sortedCandles.length - 1];
          const finalVol = sortedVolumes[sortedVolumes.length - 1]?.value || 0;
          const prevC = sortedCandles[sortedCandles.length - 2];
          const chg = prevC ? ((finalC.close - prevC.close) / prevC.close) * 100 : 0;

          setLastCandle({
            time: String(finalC.time),
            open: finalC.open,
            high: finalC.high,
            low: finalC.low,
            close: finalC.close,
            volume: finalVol,
            changePct: chg,
          });
        }

        setLoading(false);
      })
      .catch((err) => {
        console.error("[LightweightChart] Fetch failed:", err);
        setError(true);
        setLoading(false);
      });

    // Crosshair move handler
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData) {
        setHoverData(null);
        return;
      }

      const cData = param.seriesData.get(candleSeries) as CandlestickData<Time> | undefined;
      const vData = param.seriesData.get(volumeSeries) as HistogramData<Time> | undefined;

      if (cData) {
        const chg = ((cData.close - cData.open) / cData.open) * 100;
        setHoverData({
          time: String(param.time),
          open: cData.open,
          high: cData.high,
          low: cData.low,
          close: cData.close,
          volume: vData?.value || 0,
          changePct: chg,
        });
      }
    });

    // Handle container resize
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !chartRef.current) return;
      const { width } = entries[0].contentRect;
      chartRef.current.applyOptions({ width });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [cleanSymbol, height, isDark]);

  // Live real-time tick sync
  useEffect(() => {
    if (!candleSeriesRef.current || !currentPrice || isNaN(currentPrice)) return;
    const todayStr = new Date().toISOString().slice(0, 10);

    try {
      const activeData = hoverData || lastCandle;
      const currentHigh = activeData ? Math.max(activeData.high, currentPrice) : currentPrice;
      const currentLow = activeData ? Math.min(activeData.low, currentPrice) : currentPrice;
      const currentOpen = activeData?.open || currentPrice;

      candleSeriesRef.current.update({
        time: todayStr as Time,
        open: currentOpen,
        high: currentHigh,
        low: currentLow,
        close: currentPrice,
      });

      setLastCandle((prev) =>
        prev
          ? {
              ...prev,
              time: todayStr,
              high: Math.max(prev.high, currentPrice),
              low: Math.min(prev.low, currentPrice),
              close: currentPrice,
              changePct: ((currentPrice - prev.open) / prev.open) * 100,
            }
          : null
      );
    } catch {}
  }, [currentPrice]);

  const active = hoverData || lastCandle;

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-white/8 bg-[#080C14] ${className}`}
      style={{ height: typeof height === "number" ? height : 520 }}
    >
      {/* ── Top Institutional HUD Bar ── */}
      <div className="absolute top-0 left-0 right-0 z-10 px-4 py-2.5 bg-gradient-to-b from-[#080C14]/95 via-[#080C14]/75 to-transparent flex flex-wrap items-center justify-between gap-3 text-xs font-mono pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white font-bold tracking-wider">{cleanSymbol}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              NSE LIVE
            </span>
          </div>

          {active && (
            <div className="hidden sm:flex items-center gap-3 text-[11px] text-white/70">
              <span className="text-white/40">{active.time}</span>
              <span>
                O: <strong className="text-white font-bold">₹{active.open.toFixed(2)}</strong>
              </span>
              <span>
                H: <strong className="text-white font-bold">₹{active.high.toFixed(2)}</strong>
              </span>
              <span>
                L: <strong className="text-white font-bold">₹{active.low.toFixed(2)}</strong>
              </span>
              <span>
                C:{" "}
                <strong className={active.close >= active.open ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  ₹{active.close.toFixed(2)}
                </strong>
              </span>
              <span
                className={`font-bold px-1.5 py-0.5 rounded ${
                  active.changePct >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                }`}
              >
                {active.changePct >= 0 ? "+" : ""}
                {active.changePct.toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {/* Indicator Badges */}
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-[#6366F1] font-semibold flex items-center gap-1">
            <span className="w-2 h-0.5 bg-[#6366F1] inline-block" /> SMA 20
          </span>
          <span className="text-[#F59E0B] font-semibold flex items-center gap-1">
            <span className="w-2 h-0.5 bg-[#F59E0B] inline-block" /> SMA 50
          </span>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#080C14]/90 backdrop-blur-sm">
          <RefreshCw className="w-6 h-6 text-primary animate-spin mb-2" />
          <span className="text-xs font-mono text-white/50">Streaming live NSE candles...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#080C14]">
          <Activity className="w-8 h-8 text-rose-400 mb-2" />
          <span className="text-sm font-mono text-white/70">Chart feed temporarily reconnecting...</span>
        </div>
      )}

      {/* Canvas container */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
