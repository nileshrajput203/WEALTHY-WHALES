/**
 * In-memory Ask AI chat history — retains last 7 conversation turns per session.
 */

import type { ChatHistoryTurn } from "./researchReportPrompt";

/** One turn = user message + assistant reply (2 messages) */
export const MAX_CONVERSATION_TURNS = 7;
const MAX_MESSAGES = MAX_CONVERSATION_TURNS * 2;

const sessions = new Map<string, ChatHistoryTurn[]>();

export function getChatHistory(sessionId: string): ChatHistoryTurn[] {
  return [...(sessions.get(sessionId) ?? [])];
}

export function appendChatMessage(sessionId: string, role: "user" | "assistant", message: string): ChatHistoryTurn[] {
  const list = sessions.get(sessionId) ?? [];
  list.push({ role, message });
  while (list.length > MAX_MESSAGES) {
    list.shift();
  }
  sessions.set(sessionId, list);
  return [...list];
}

export function clearChatSession(sessionId: string): void {
  sessions.delete(sessionId);
}

import { INDIAN_STOCKS } from "./stockApi";
import { NSE_UNIVERSE } from "./nseUniverse";

const KNOWN_SYMBOLS = [
  ...new Set([...Object.keys(INDIAN_STOCKS), ...NSE_UNIVERSE]),
].sort((a, b) => b.length - a.length);

/** Detect NSE symbol from natural-language query (longest ticker match) */
export function detectStockSymbol(query: string, stockContext?: string | null): string | null {
  if (stockContext?.trim()) {
    return stockContext.trim().toUpperCase().replace(/\.(NS|BO|NSE|BSE)$/i, "");
  }
  const upper = query.toUpperCase();
  for (const sym of KNOWN_SYMBOLS) {
    const re = new RegExp(`\\b${sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (re.test(upper)) return sym;
  }
  const tickerMatch = upper.match(/\b([A-Z][A-Z0-9&-]{2,19})\b/);
  return tickerMatch?.[1] ?? null;
}
