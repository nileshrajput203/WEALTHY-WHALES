import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Bot, User } from "lucide-react";
import type { ChatMessage } from "@shared/schema";

export default function AskAI() {
  const [message, setMessage] = useState("");
  const [sessionId] = useState(() => `session-${Date.now()}`);

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat", sessionId],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      return await apiRequest("POST", "/api/chat", {
        message: userMessage,
        sessionId,
        role: "user",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat", sessionId] });
      setMessage("");
    },
  });

  const handleSend = () => {
    if (message.trim()) {
      sendMessageMutation.mutate(message);
    }
  };

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-primary" />
          Ask AI
        </h1>
        <p className="text-muted-foreground">Get AI-powered insights about stocks and market trends</p>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 bg-card rounded-xl border border-card-border p-6 overflow-y-auto mb-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Bot className="w-16 h-16 mx-auto text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Start a Conversation</h3>
              <p className="text-muted-foreground max-w-md">
                Ask me anything about stocks, market trends, or investment strategies
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              data-testid={`message-${msg.role}-${msg.id}`}
            >
              <div className={`flex gap-3 max-w-3xl ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' ? 'bg-primary' : 'bg-secondary'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`rounded-lg p-4 ${
                  msg.role === 'user' ? 'bg-primary/20' : 'bg-secondary'
                }`}>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{msg.message}</p>
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

      {/* Input Area */}
      <div className="flex gap-3">
        <Textarea
          placeholder="Ask about stocks, market trends, or get investment advice..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
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
