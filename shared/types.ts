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

export interface InstitutionalVerdictData {
  primaryVerdict: "STRONG BUY" | "ACCUMULATE / BUY" | "HOLD / TRAIL SL" | "REDUCE / BOOK PROFIT" | "STRONG SELL / AVOID";
  actionableSummary: string;
  vetoTriggered?: string | null;
  weinsteinStage: "STAGE_1_BASING" | "STAGE_2_ADVANCING" | "STAGE_3_DISTRIBUTION_OR_PULLBACK" | "STAGE_4_DECLINING";
  weinsteinStageName: string;
  pctBelow52WHigh: number;
  pillars: {
    earningsMomentumScore: number;
    shareholdingForensicsScore: number;
    weinsteinStageScore: number;
    quantConsensusScore: number;
    catalystScore: number;
  };
  forensics: {
    promoterHoldingPct?: number;
    promoterPledgePct?: number;
    fiiDiiFlowTrend: "ACCUMULATING" | "NEUTRAL" | "DISTRIBUTING";
    weakToStrongTransfer: boolean;
    rocePct?: number;
    roePct?: number;
    debtToEquity?: number;
    operatingCashFlowPositive: boolean;
  };
  cpr: {
    pivot: number;
    topCentral: number;
    bottomCentral: number;
    cprWidthPct: number;
    isNarrowTrendingCPR: boolean;
  };
  tradeZones: {
    swingEntryZone: { low: number; high: number };
    swingStopLoss: { price: number; pct: number };
    swingTarget1: { price: number; pct: number };
    swingTarget2: { price: number; pct: number };
    riskRewardRatio: string;
    longTermFairValue: number;
    valuationStatus: "UNDERVALUED" | "FAIR_VALUE" | "OVERVALUED";
    bullThesis: string[];
    bearRisks: string[];
  };
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
  institutionalVerdict?: InstitutionalVerdictData;
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

declare global {
  namespace Express {
    interface User extends AuthUser {}
  }
}

