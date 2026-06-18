import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useRoute } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function TechnicalDetail() {
  const [match, params] = useRoute("/stock/:symbol/technicals");
  const symbol = params?.symbol || "";
  const [data, setData] = useState<any | null>(null);
  const [ai, setAi] = useState<string>("");
  const [range, setRange] = useState<'1mo'|'6mo'|'2y'>('6mo');

  useEffect(() => {
    let live = true;
    async function load() {
      const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}/technicals?range=${range}`);
      const json = await res.json();
      if (live) setData(json);
    }
    if (symbol) load();
    async function loadAi() {
      const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}/technicals/ai?range=${range}`);
      const json = await res.json();
      if (live) setAi(json.markdown || "");
    }
    if (symbol) loadAi();
    return () => { live = false; };
  }, [symbol, range]);

  if (!symbol) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{symbol} · Technicals</h1>
      {data ? (
        <>
          <div className="flex gap-3 mb-2">
            {[
              { k: '1mo', l: 'short' },
              { k: '6mo', l: 'mid' },
              { k: '2y', l: 'long' },
            ].map(o => (
              <button key={o.k} onClick={() => setRange(o.k as any)} className={`px-3 py-1 rounded-full ${range===o.k ? 'bg-primary text-white' : 'bg-secondary'}`}>{o.l}</button>
            ))}
          </div>
          <div className="rounded-xl border border-card-border p-4 bg-card">
            <ChartContainer config={{ price: { label: "Price", color: "hsl(var(--primary))" } }} className="h-80">
              <AreaChart data={data.candles.map((c: any, i: number) => ({ i, close: c.close }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="i" hide />
                <YAxis hide />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="close" stroke="var(--color-price)" fill="var(--color-price)" fillOpacity={0.15} />
              </AreaChart>
            </ChartContainer>
          </div>
          <div className="rounded-xl border border-card-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="text-left px-4 py-2">Parameter</th>
                  <th className="text-left px-4 py-2">Value</th>
                  <th className="text-left px-4 py-2">Insight</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-card-border">
                  <td className="px-4 py-2 font-semibold">Trend</td>
                  <td className="px-4 py-2">{data.trend}</td>
                  <td className="px-4 py-2">SMA50 vs price</td>
                </tr>
                <tr className="border-t border-card-border">
                  <td className="px-4 py-2 font-semibold">Momentum (RSI 14)</td>
                  <td className="px-4 py-2">{Math.round(data.indicators.rsi14 || 0)}</td>
                  <td className="px-4 py-2">{'>'}55 bullish, {'<'}45 bearish</td>
                </tr>
                <tr className="border-t border-card-border">
                  <td className="px-4 py-2 font-semibold">SMA20</td>
                  <td className="px-4 py-2">{Math.round(data.indicators.sma20 || 0)}</td>
                  <td className="px-4 py-2">Short-term mean</td>
                </tr>
                <tr className="border-t border-card-border">
                  <td className="px-4 py-2 font-semibold">SMA50</td>
                  <td className="px-4 py-2">{Math.round(data.indicators.sma50 || 0)}</td>
                  <td className="px-4 py-2">Medium-term mean</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="h-80 rounded-xl border border-card-border bg-secondary animate-pulse" />
      )}

      {ai ? (
        <div className="prose prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{ai}</ReactMarkdown>
        </div>
      ) : (
        <div className="h-20 rounded-xl border border-card-border bg-secondary animate-pulse" />
      )}
    </div>
  );
}


