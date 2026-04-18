import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function FundamentalDetail() {
  const [match, params] = useRoute("/stock/:symbol/fundamentals");
  const symbol = params?.symbol || "";
  const [ai, setAi] = useState<string>("");

  useEffect(() => {
    let live = true;
    async function loadAi() {
      const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}/fundamentals/ai`);
      const json = await res.json();
      if (live) setAi(json.markdown || "");
    }
    if (symbol) loadAi();
    return () => { live = false; };
  }, [symbol]);

  if (!symbol) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{symbol} · Fundamentals</h1>
      {ai ? (
        <div className="prose prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{ai}</ReactMarkdown>
        </div>
      ) : (
        <div className="h-40 rounded-xl border border-card-border bg-secondary animate-pulse" />
      )}
    </div>
  );
}


