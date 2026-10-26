import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, User, Trash2, LineChart, FileText } from "lucide-react";
import type { ChatMessage } from "@shared/schema";

const SESSION_KEY = "ask-ai-session-id";
const MAX_TURNS_LABEL = 7;

function getOrCreateSessionId(): string {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const id = `session-${Date.now()}`;
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

const SAMPLE_PROMPTS = [
  "Comprehensive deep dive into TCS fundamentals",
  "Analyze RELIANCE debt-equity and margin sustainability",
  "HDFC Bank quarterly performance & asset quality",
  "Tata Motors EV expansion & free cash flow outlook",
];

export default function AskAI() {
  const [message, setMessage] = useState("");
  const [sessionId] = useState(getOrCreateSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat/${encodeURIComponent(sessionId)}`);
        if (!res.ok) return;
        const data: ChatMessage[] = await res.json();
        if (!cancelled && data.length) {
          setMessages(data);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const sendMessageMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        message: userMessage,
        createdAt: new Date(),
        sessionId,
        userId: null,
        stockContext: null,
      };
      setMessages((prev) => [...prev, userMsg]);

      const res = await apiRequest("POST", "/api/chat", {
        sessionId,
        message: userMessage,
      });
      return res.json();
    },
    onSuccess: (data: ChatMessage) => {
      setMessages((prev) => [...prev, data]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          message: "Unable to generate research report. Please verify your connection and try again.",
          createdAt: new Date(),
          sessionId,
          userId: null,
          stockContext: null,
        },
      ]);
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!message.trim() || sendMessageMutation.isPending) return;
    const msg = message;
    setMessage("");
    sendMessageMutation.mutate(msg);
  };

  const handleClear = async () => {
    try {
      await fetch(`/api/chat/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
    } catch {
      /* ignore */
    }
    setMessages([]);
  };

  const handlePromptClick = (prompt: string) => {
    if (sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(prompt);
  };

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground tracking-tight flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-primary" />
            Market Research Copilot
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Institutional equity dossiers, audited financial metrics, peer comparisons, and quantitative valuation checks.
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleClear} className="shrink-0 text-xs">
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            New Dossier
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4 rounded-2xl bg-card/40 border border-border/50">
        {!historyLoaded ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-mono">
            Loading research dossier history…
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center py-10">
            <div className="text-center max-w-lg">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-primary/10 border border-primary/20 text-primary">
                <LineChart className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold font-display text-foreground mb-1.5">
                Institutional Equity Research
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                Query any listed stock for institutional-grade breakdowns: business moats, capital allocation, P&L trends, ROCE/ROE metrics, and technical key levels.
              </p>
              <div className="space-y-2 text-left">
                <span className="text-[11px] font-mono text-muted-foreground uppercase font-bold tracking-wider block text-center mb-2">
                  Recommended Inquiries
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SAMPLE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handlePromptClick(prompt)}
                      className="text-left p-3 rounded-xl border border-border/60 bg-muted/40 hover:bg-muted/80 hover:border-primary/40 text-xs text-foreground font-medium transition-all shadow-2xs"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              data-testid={`message-${msg.role}-${msg.id}`}
            >
              <div className={`flex gap-3 max-w-4xl ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : "RC"}
                </div>
                <div
                  className={`rounded-xl p-4 shadow-2xs ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 border border-border text-foreground"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <>
                      <div className="prose dark:prose-invert max-w-none text-sm prose-p:my-2 prose-headings:text-foreground prose-h2:text-base prose-h2:font-bold prose-h2:mt-4 prose-h2:mb-2 prose-table:w-full prose-th:font-semibold prose-th:px-3 prose-td:px-3 prose-th:py-1.5 prose-td:py-1.5 prose-thead:border-b prose-tr:border-b prose-blockquote:border-primary/50">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.message}</ReactMarkdown>
                      </div>
                      {(msg as ChatMessage & { aiModel?: string }).aiModel && (
                        <p className="text-[10px] text-muted-foreground mt-2 font-mono">
                          Source: Research Engine ({(msg as ChatMessage & { aiModel?: string }).aiModel})
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        {sendMessageMutation.isPending && (
          <div className="flex gap-3 justify-start">
            <div className="flex gap-3 max-w-3xl">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground border border-border text-xs font-bold">
                RC
              </div>
              <div className="rounded-xl p-3.5 bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground font-mono mb-2">Analyzing financial data & compiling report…</p>
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2.5">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask for an equity research dossier (e.g. 'Analyze Reliance', 'Evaluate TCS vs Infosys')..."
          className="min-h-[50px] max-h-[120px] resize-none bg-card border-border/80 text-sm focus-visible:ring-primary/40 rounded-xl"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          data-testid="input-chat-message"
        />
        <Button
          type="submit"
          disabled={!message.trim() || sendMessageMutation.isPending}
          className="self-end h-[50px] px-5 rounded-xl font-semibold"
          data-testid="button-send-message"
        >
          <Send className="w-4 h-4 mr-1.5" />
          Send
        </Button>
      </form>
    </div>
  );
}
