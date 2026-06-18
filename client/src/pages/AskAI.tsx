import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Bot, User, Trash2 } from "lucide-react";
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
        userId: null,
        sessionId,
        message: userMessage,
        role: "user",
        stockContext: null,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, userMsg]);

      const response = await apiRequest("POST", "/api/chat", {
        message: userMessage,
        sessionId,
        role: "user",
      });
      return await response.json();
    },
    onSuccess: (aiResponse: ChatMessage & { aiModel?: string }) => {
      setMessages(prev => {
        const next = [...prev, aiResponse];
        const maxMessages = MAX_TURNS_LABEL * 2;
        if (next.length <= maxMessages) return next;
        return next.slice(-maxMessages);
      });
      setMessage("");
    },
    onError: (error) => {
      console.error("Chat error:", error);
      setMessages(prev => prev.slice(0, -1));
    },
  });

  const handleSend = () => {
    if (message.trim()) {
      sendMessageMutation.mutate(message);
    }
  };

  const handleClear = () => {
    localStorage.removeItem(SESSION_KEY);
    setMessages([]);
    window.location.reload();
  };

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" />
            Ask AI
          </h1>
          <p className="text-muted-foreground">
            Institutional equity research reports for any NSE/BSE stock (Gokul Agro report format)
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Powered by Google Gemini Flash API · Remembers your last {MAX_TURNS_LABEL} conversations
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleClear} className="shrink-0">
            <Trash2 className="w-4 h-4 mr-1" />
            New chat
          </Button>
        )}
      </div>

      <div className="flex-1 bg-card rounded-xl border border-card-border p-6 overflow-y-auto mb-4 space-y-4">
        {!historyLoaded && messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Loading conversation…
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Bot className="w-16 h-16 mx-auto text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Start a Conversation</h3>
              <p className="text-muted-foreground max-w-md">
                Ask about any stock (e.g. &quot;Analyze TCS&quot;, &quot;Research RELIANCE&quot;) for a full
                institutional report: business overview, management, financials, valuation, and final verdict.
              </p>
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
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === "user" ? "bg-primary" : "bg-secondary"
                }`}>
                  {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`rounded-lg p-4 ${
                  msg.role === "user" ? "bg-primary/20" : "bg-secondary"
                }`}>
                  {msg.role === "assistant" ? (
                    <>
                      <div className="prose prose-invert max-w-none prose-p:my-2 prose-headings:text-foreground prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-2 prose-table:w-full prose-th:font-semibold prose-th:px-3 prose-td:px-3 prose-th:py-2 prose-td:py-2 prose-thead:border-b prose-tr:border-b prose-blockquote:border-primary/40">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.message}</ReactMarkdown>
                      </div>
                      {(msg as ChatMessage & { aiModel?: string }).aiModel && (
                        <p className="text-[10px] text-muted-foreground/50 mt-2 font-mono">
                          via {(msg as ChatMessage & { aiModel?: string }).aiModel}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-foreground whitespace-pre-wrap">{msg.message}</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        {sendMessageMutation.isPending && (
          <div className="flex gap-3 justify-start">
            <div className="flex gap-3 max-w-3xl">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-secondary">
                <Bot className="w-4 h-4" />
              </div>
              <div className="rounded-lg p-4 bg-secondary">
                <p className="text-xs text-muted-foreground mb-2">Generating institutional research report…</p>
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse delay-75" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse delay-150" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Textarea
          placeholder="e.g. Analyze GOKULAGRO, Research TCS fundamentals, Is RELIANCE a buy?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="resize-none bg-card border-card-border"
          rows={3}
          data-testid="input-ai-message"
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || sendMessageMutation.isPending}
          className="bg-primary hover:bg-primary/90"
          data-testid="button-send-message"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
