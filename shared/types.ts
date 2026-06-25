/**
 * Shared types used by both client and server.
 * Import from "@shared/types" — never import from server/ in client code.
 */

// ── StockIQ ──────────────────────────────────────────────────────────────────

export interface SubScore {
  score: number;       // 0–100
  weight: number;      // 0–1
  metrics: {
    name: string;
    value: string | number | null;
    interpretation: string; // "Strong" | "Average" | "Weak"
    contribution: number;   // points contributed to sub-score
  }[];
}

export interface StockIQResult {
  symbol: string;
  companyName: string;
  price: number | null;
  totalScore: number;   // weighted 0–100
  grade: string;        // A+ to F
  verdict: string;      // "Exceptional" | "Strong" | "Average" | "Weak" | "Avoid"
  simpleVerdict: string; // Beginner-friendly 1-liner
  fundamentals: SubScore;
  technicals: SubScore;
  momentum: SubScore;
  insider: SubScore;
  computedAt: string;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  isAdmin?: boolean | null;
  telegramChatId?: string | null;
}
