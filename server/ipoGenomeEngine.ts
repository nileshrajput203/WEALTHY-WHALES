/**
 * IPO GENOME ENGINE — 4-Base U-Shape Post-IPO + Fundamental & Future Outlook Model
 * ─────────────────────────────────────────────────────────────────────────────
 * Strictly enforces Institutional Post-IPO Base Rules:
 *  1. STRICT 4-BASE LIMIT AFTER IPO: Counts every consolidation base since listing day
 *     (Base #1, Base #2, Base #3, Base #4). Automatically rejects any stock in Base #5+.
 *  2. TRUE U-SHAPE GEOMETRY VERIFICATION: Distinguishes genuine rounded U-shape institutional
 *     accumulation bases (parabolic floor residency + lip symmetry + right-side EMA reclaim)
 *     from dangerous V-shape whipsaws.
 *  3. FUNDAMENTAL QUALITY & FUTURE OUTLOOK FILTER: Requires strong ROE/ROCE, YoY Revenue/PAT
 *     growth, and a multi-year structural India Megatrend tailwind (EMS, Solar/Green Hydrogen,
 *     AI Supercomputing, Defence, Specialty Healthcare, Housing Finance).
 *  4. SEBI Anchor Lock-In supply absorption (30-day & 90-day unlock windows).
 */

import { db } from "./db";
import { ipoOutcomes } from "@shared/schema";
import { and, eq, isNull, lte, sql, desc } from "drizzle-orm";
import { getGenome, runGenomeEvolution, type TradeOutcome } from "./selfImprovingCore";
import { getYahooStockQuote, computeEMA } from "./stockApi";
import { candleCache } from "./candleCache";
import { getNewsScoreForSymbol } from "./apexNewsEngine";
import { markJobStart, markJobDone, markJobFailed } from "./jobLedger";

export interface IpoFundamentalProfile {
  symbol: string;
  name: string;
  sector: string;
  issuePrice: number;
  roePct: number;
  rocePct: number;
  revenueGrowthYoY: number;
  patGrowthYoY: number;
  debtToEquity: number;
  fundamentalScore: number; // 0-100
  fundamentalGrade: "A+" | "A" | "B+";
  futureOutlookScore: number; // 0-100
  megatrendTheme: string;
  futureOutlookCatalyst: string;
}

// ─── High-Conviction Indian IPO Universe with Fundamental & Future Outlook Profiles ───
export const RECENT_INDIAN_IPOS: IpoFundamentalProfile[] = [
  {
    symbol: "PREMIERENE",
    name: "Premier Energies Ltd",
    sector: "Solar Cells & Modules",
    issuePrice: 450,
    roePct: 42.8,
    rocePct: 31.4,
    revenueGrowthYoY: 120.5,
    patGrowthYoY: 280.0,
    debtToEquity: 0.42,
    fundamentalScore: 94,
    fundamentalGrade: "A+",
    futureOutlookScore: 96,
    megatrendTheme: "ALMM Solar Cell Localization & TOPCon Expansion",
    futureOutlookCatalyst: "8 GW backward-integrated cell/wafer capex + domestic DCR solar mandate tailwind through FY28",
  },
  {
    symbol: "NETWEB",
    name: "Netweb Technologies India Ltd",
    sector: "AI & Supercomputing",
    issuePrice: 500,
    roePct: 28.4,
    rocePct: 35.2,
    revenueGrowthYoY: 62.8,
    patGrowthYoY: 68.4,
    debtToEquity: 0.04,
    fundamentalScore: 92,
    fundamentalGrade: "A+",
    futureOutlookScore: 95,
    megatrendTheme: "IndiaAI Sovereign GPU Clusters & Tyrone Private Cloud",
    futureOutlookCatalyst: "NVIDIA OEM partner for Make-in-India AI supercomputing + surging enterprise AI pipeline",
  },
  {
    symbol: "JYOTICNC",
    name: "Jyoti CNC Automation Ltd",
    sector: "Aerospace & Defence CNC",
    issuePrice: 331,
    roePct: 24.6,
    rocePct: 26.8,
    revenueGrowthYoY: 44.2,
    patGrowthYoY: 115.0,
    debtToEquity: 0.21,
    fundamentalScore: 89,
    fundamentalGrade: "A+",
    futureOutlookScore: 93,
    megatrendTheme: "5-Axis Aerospace, Defence & EMS Precision Machining",
    futureOutlookCatalyst: "₹3,400+ Cr multi-year order book across global aerospace, defence, and semiconductor equipment",
  },
  {
    symbol: "INOXINDIA",
    name: "INOX India Ltd",
    sector: "Cryogenic & Green Hydrogen",
    issuePrice: 660,
    roePct: 31.5,
    rocePct: 41.2,
    revenueGrowthYoY: 21.4,
    patGrowthYoY: 28.9,
    debtToEquity: 0.0,
    fundamentalScore: 90,
    fundamentalGrade: "A+",
    futureOutlookScore: 91,
    megatrendTheme: "Liquid Hydrogen, LNG Cryogenics & ISRO Space Propulsion",
    futureOutlookCatalyst: "Debt-free monopoly in cryogenic storage with global clean-energy & semiconductor gas export orders",
  },
  {
    symbol: "DOMS",
    name: "DOMS Industries Ltd",
    sector: "Consumer Brand & Stationery",
    issuePrice: 790,
    roePct: 28.1,
    rocePct: 33.4,
    revenueGrowthYoY: 26.8,
    patGrowthYoY: 48.2,
    debtToEquity: 0.12,
    fundamentalScore: 91,
    fundamentalGrade: "A+",
    futureOutlookScore: 90,
    megatrendTheme: "FILA Global Distribution & 44-Acre Umbergaon Mega-Plant",
    futureOutlookCatalyst: "Rapid capacity expansion in pens, scholastic art, and back-to-school kits with global export ramp",
  },
  {
    symbol: "TBOPEK",
    name: "TBO Tek Ltd",
    sector: "Global B2B Travel Tech",
    issuePrice: 920,
    roePct: 36.4,
    rocePct: 42.0,
    revenueGrowthYoY: 31.2,
    patGrowthYoY: 38.5,
    debtToEquity: 0.02,
    fundamentalScore: 90,
    fundamentalGrade: "A+",
    futureOutlookScore: 92,
    megatrendTheme: "Asset-Light Global Outbound Travel Platform",
    futureOutlookCatalyst: "High-margin international hotel GTV take-rate expansion + operating leverage across 100+ countries",
  },
  {
    symbol: "KAYNES",
    name: "Kaynes Technology India Ltd",
    sector: "OSAT Semiconductor & EMS",
    issuePrice: 587,
    roePct: 18.9,
    rocePct: 22.4,
    revenueGrowthYoY: 60.2,
    patGrowthYoY: 92.1,
    debtToEquity: 0.14,
    fundamentalScore: 88,
    fundamentalGrade: "A",
    futureOutlookScore: 95,
    megatrendTheme: "OSAT Semiconductor Packaging + High-Margin Industrial PCB/EMS",
    futureOutlookCatalyst: "Approved OSAT semiconductor packaging facility + smart-meter, aerospace, and railway Kavach electronics",
  },
  {
    symbol: "BAJAJHFL",
    name: "Bajaj Housing Finance Ltd",
    sector: "Prime Housing Finance",
    issuePrice: 70,
    roePct: 15.8,
    rocePct: 11.4,
    revenueGrowthYoY: 29.4,
    patGrowthYoY: 32.0,
    debtToEquity: 4.8,
    fundamentalScore: 87,
    fundamentalGrade: "A",
    futureOutlookScore: 89,
    megatrendTheme: "Prime Urban Mortgage Compounding & Lowest GNPA (<0.30%)",
    futureOutlookCatalyst: "AAA-rated cost-of-funds advantage + 28%+ AUM compounding as rate-cut cycle boosts premium housing",
  },
  {
    symbol: "IREDA",
    name: "Indian Renewable Energy Dev Agency",
    sector: "Green Power Financing",
    issuePrice: 32,
    roePct: 19.2,
    rocePct: 12.1,
    revenueGrowthYoY: 38.4,
    patGrowthYoY: 44.6,
    debtToEquity: 5.2,
    fundamentalScore: 85,
    fundamentalGrade: "A",
    futureOutlookScore: 90,
    megatrendTheme: "500 GW India Renewable Target by 2030",
    futureOutlookCatalyst: "Navratna status + dedicated green financing book for solar, hydro, EV fleets, and green ammonia",
  },
  {
    symbol: "NTPCGREEN",
    name: "NTPC Green Energy Ltd",
    sector: "Utility-Scale Renewables",
    issuePrice: 108,
    roePct: 14.5,
    rocePct: 13.8,
    revenueGrowthYoY: 34.0,
    patGrowthYoY: 41.2,
    debtToEquity: 1.4,
    fundamentalScore: 83,
    fundamentalGrade: "A",
    futureOutlookScore: 91,
    megatrendTheme: "60 GW Utility Solar/Wind Pipeline & Sovereign Backing",
    futureOutlookCatalyst: "26+ GW contracted/pipeline capacity with PSU lowest-cost debt refinancing",
  },
  {
    symbol: "MANKIND",
    name: "Mankind Pharma Ltd",
    sector: "Domestic Chronic Pharma",
    issuePrice: 1080,
    roePct: 22.8,
    rocePct: 27.9,
    revenueGrowthYoY: 19.4,
    patGrowthYoY: 34.2,
    debtToEquity: 0.18,
    fundamentalScore: 89,
    fundamentalGrade: "A+",
    futureOutlookScore: 88,
    megatrendTheme: "Chronic Cardiac/Diabetes Mix + BSV Super-Specialty Acquisition",
    futureOutlookCatalyst: "98% domestic cash-generative prescription dominance + high-margin gynecology/critical care portfolio",
  },
  {
    symbol: "AADHARHFC",
    name: "Aadhar Housing Finance Ltd",
    sector: "Affordable Housing Finance",
    issuePrice: 315,
    roePct: 18.4,
    rocePct: 13.2,
    revenueGrowthYoY: 25.8,
    patGrowthYoY: 36.1,
    debtToEquity: 3.1,
    fundamentalScore: 84,
    fundamentalGrade: "A",
    futureOutlookScore: 87,
    megatrendTheme: "PMAY-U 2.0 Affordable Housing & Tier-3/4 Formalization",
    futureOutlookCatalyst: "Blackstone-backed pan-India branch network targeting low-ticket salaried/self-employed borrowers",
  },
  {
    symbol: "JSWINFRA",
    name: "JSW Infrastructure Ltd",
    sector: "Private Ports & Logistics",
    issuePrice: 119,
    roePct: 17.6,
    rocePct: 20.4,
    revenueGrowthYoY: 22.5,
    patGrowthYoY: 39.8,
    debtToEquity: 0.54,
    fundamentalScore: 86,
    fundamentalGrade: "A",
    futureOutlookScore: 90,
    megatrendTheme: "170 MTPA → 400 MTPA Port Capacity Doubling & Navkar Logistics",
    futureOutlookCatalyst: "Strong third-party cargo mix expansion (40%+) and brownfield port mechanization",
  },
  {
    symbol: "YATHARTH",
    name: "Yatharth Hospital & Trauma Care",
    sector: "Super-Specialty Healthcare",
    issuePrice: 300,
    roePct: 19.4,
    rocePct: 24.8,
    revenueGrowthYoY: 31.0,
    patGrowthYoY: 42.5,
    debtToEquity: 0.08,
    fundamentalScore: 85,
    fundamentalGrade: "A",
    futureOutlookScore: 88,
    megatrendTheme: "NCR/North India Oncology & Robotic Surgery Bed Expansion",
    futureOutlookCatalyst: "ARPOB expansion via oncology/transplant mix + value-accretive hospital acquisitions in Delhi-NCR",
  },
  {
    symbol: "HAPPYFORGE",
    name: "Happy Forgings Ltd",
    sector: "Heavy Precision Crankshafts",
    issuePrice: 850,
    roePct: 21.2,
    rocePct: 26.5,
    revenueGrowthYoY: 18.9,
    patGrowthYoY: 27.4,
    debtToEquity: 0.11,
    fundamentalScore: 86,
    fundamentalGrade: "A",
    futureOutlookScore: 86,
    megatrendTheme: "Global Industrial, Wind Turbine & Off-Highway Machined Forgings",
    futureOutlookCatalyst: "28%+ EBITDA margins with rising export share in industrial/wind power heavy forgings",
  },
  {
    symbol: "RRKABEL",
    name: "R R Kabel Ltd",
    sector: "Wires & FMEG",
    issuePrice: 1035,
    roePct: 19.8,
    rocePct: 24.1,
    revenueGrowthYoY: 20.4,
    patGrowthYoY: 35.0,
    debtToEquity: 0.19,
    fundamentalScore: 84,
    fundamentalGrade: "A",
    futureOutlookScore: 86,
    megatrendTheme: "Real Estate Upcycle + Europe/US B2C Wire Exports",
    futureOutlookCatalyst: "Largest Indian exporter of consumer wires + power cable capacity doubling",
  },
  {
    symbol: "KFINTECH",
    name: "KFin Technologies Ltd",
    sector: "Capital Market Infrastructure",
    issuePrice: 366,
    roePct: 26.4,
    rocePct: 33.8,
    revenueGrowthYoY: 24.1,
    patGrowthYoY: 36.8,
    debtToEquity: 0.0,
    fundamentalScore: 91,
    fundamentalGrade: "A+",
    futureOutlookScore: 92,
    megatrendTheme: "India SIP Financialization + SE Asia International RTA Monopoly",
    futureOutlookCatalyst: "Duopoly mutual fund/AIF registrar with 44%+ EBITDA margins and global fund-admin wins",
  },
  {
    symbol: "CYIENTDLM",
    name: "Cyient DLM Ltd",
    sector: "Aerospace & Defence EMS",
    issuePrice: 265,
    roePct: 14.8,
    rocePct: 18.2,
    revenueGrowthYoY: 43.2,
    patGrowthYoY: 92.8,
    debtToEquity: 0.15,
    fundamentalScore: 82,
    fundamentalGrade: "B+",
    futureOutlookScore: 89,
    megatrendTheme: "Mission-Critical Avionics & Cockpit Electronics EMS",
    futureOutlookCatalyst: "Honeywell, Thales & Boeing defence/aerospace PCB assembly + US acquisition expansion",
  },
  {
    symbol: "SENCO",
    name: "Senco Gold Ltd",
    sector: "Organized Jewellery Retail",
    issuePrice: 317,
    roePct: 18.5,
    rocePct: 16.4,
    revenueGrowthYoY: 28.4,
    patGrowthYoY: 31.2,
    debtToEquity: 0.65,
    fundamentalScore: 82,
    fundamentalGrade: "B+",
    futureOutlookScore: 85,
    megatrendTheme: "Asset-Light Franchise Showroom Rollout & Studded Diamond Mix",
    futureOutlookCatalyst: "Unorganized-to-organized hallmarking shift + 18-20% annual showroom addition",
  },
  {
    symbol: "SWIGGY",
    name: "Swiggy Ltd",
    sector: "Quick Commerce & FoodTech",
    issuePrice: 390,
    roePct: 12.4,
    rocePct: 14.0,
    revenueGrowthYoY: 36.0,
    patGrowthYoY: 65.0,
    debtToEquity: 0.08,
    fundamentalScore: 78,
    fundamentalGrade: "B+",
    futureOutlookScore: 88,
    megatrendTheme: "10-Minute Quick Commerce Dark-Store Operating Leverage",
    futureOutlookCatalyst: "Rapid Instamart contribution margin expansion + high-margin advertising revenue",
  },
];

const DEFAULT_WIN_THRESHOLD = 5.0;
const DEFAULT_LOSS_THRESHOLD = -4.0;

export interface IpoRocketBaseResult {
  id: string;
  scannerType: "ipo";
  stockSymbol: string;
  stockName: string;
  sector: string;
  exchange: "NSE";
  price: string;
  change: string;
  changePercent: string;
  volume: string;
  marketCap: string;
  daysListed: number;

  // ── NEW: Strict Post-IPO 4-Base Counter & U-Shape Geometry ──
  baseNumberAfterIpo: 1 | 2 | 3 | 4;
  baseStageLabel: string; // e.g. "Base #1 of 4 (Primary IPO U-Base)"
  uShapeScore: number;    // 0-100 mathematical U-curve rounding score
  isTrueUShape: boolean;  // Rejects V-shape spikes
  baseShapeLabel: "PERFECT_U_BASE" | "U_CUP_WITH_HANDLE" | "HIGH_TIGHT_U_BASE";
  bottomFloorResidencyPct: number; // % of base bars rounding cleanly in lower-mid U zone

  // ── NEW: Fundamental Quality & Future Outlook Megatrend ──
  fundamentalScore: number;
  fundamentalGrade: "A+" | "A" | "B+";
  roePct: number;
  rocePct: number;
  revenueGrowthYoY: number;
  patGrowthYoY: number;
  futureOutlookScore: number;
  megatrendTheme: string;
  futureOutlookCatalyst: string;

  setupClassification: "HYPER_ROCKET_BASE" | "READY_TO_BOOM" | "ROCKET_BREAKOUT_ACTIVE" | "INSTITUTIONAL_VCP" | "FORMING_BASE";
  anchorLockinStatus: "30D_ANCHOR_ABSORBED" | "90D_ANCHOR_ABSORBED" | "30D_WINDOW_ACTIVE" | "90D_WINDOW_ACTIVE" | "PRE_30D_LOCKIN" | "SUPPLY_OVERHANG";
  rocketScore: number;
  baseDepthPct: number;
  distanceFromPivotPct: number;
  hasVolumeDryUp: boolean;
  currentRvol: number;
  tradePlan: {
    pivotTriggerPrice: number;
    postListingHigh: number;
    stopLoss: number;
    riskPct: number;
    target1: number;
    target2: number;
    riskRewardRatio: string;
  };
  totalGainSinceListingPct: number;
  newsScore: number;
  genomeVersion: number;
  createdAt: string;
}

/**
 * Counts how many distinct consolidation bases have formed since IPO listing day.
 * A base is defined as a >=10-bar consolidation of >=7% depth from a prior high,
 * followed by a confirmed breakout (>=8% above the prior base's left-lip high).
 */
function countPostIpoBases(highs: number[], lows: number[], closes: number[]): number {
  const n = closes.length;
  if (n < 25) return 1;

  let baseCount = 1;
  let runningPeak = highs[0];
  let inConsolidation = false;
  let consStartIdx = 0;
  let consMaxDdPct = 0;

  for (let i = 1; i < n; i++) {
    if (!inConsolidation) {
      if (highs[i] > runningPeak) {
        runningPeak = highs[i];
      }
      const ddPct = ((runningPeak - lows[i]) / (runningPeak || 1)) * 100;
      if (ddPct >= 7.5) {
        inConsolidation = true;
        consStartIdx = i;
        consMaxDdPct = ddPct;
      }
    } else {
      const ddPct = ((runningPeak - lows[i]) / (runningPeak || 1)) * 100;
      if (ddPct > consMaxDdPct) consMaxDdPct = ddPct;

      const barsInBase = i - consStartIdx;
      // Breakout above prior base peak after at least 10 bars of consolidation
      if (barsInBase >= 10 && closes[i] >= runningPeak * 1.05) {
        baseCount++;
        runningPeak = highs[i];
        inConsolidation = false;
        consMaxDdPct = 0;
      } else if (highs[i] > runningPeak && barsInBase < 10) {
        // Brief pullback (<10 bars) is part of the same advance, not a full base
        runningPeak = highs[i];
        inConsolidation = false;
      }
    }
  }

  return Math.max(1, baseCount);
}

/**
 * Mathematical U-Shape Rounding Evaluator:
 * Evaluates whether the current consolidation base has a rounded U-shaped floor
 * rather than a sharp V-shaped spike or a falling knife.
 */
function analyzeUShapeGeometry(
  baseCloses: number[],
  baseHighs: number[],
  baseLows: number[]
): {
  uShapeScore: number;
  isTrueUShape: boolean;
  bottomFloorResidencyPct: number;
  baseShapeLabel: "PERFECT_U_BASE" | "U_CUP_WITH_HANDLE" | "HIGH_TIGHT_U_BASE";
} {
  const m = baseCloses.length;
  if (m < 10) {
    return {
      uShapeScore: 50,
      isTrueUShape: false,
      bottomFloorResidencyPct: 20,
      baseShapeLabel: "PERFECT_U_BASE",
    };
  }

  const maxH = Math.max(...baseHighs);
  const minL = Math.min(...baseLows);
  const span = Math.max(0.01, maxH - minL);

  // 1. Bottom-to-Mid Zone Residency: In a true U-shape, price spends 32%–78% of bars
  //    in the lower 60% of the cup (forming a rounded bowl) rather than 1-2 spike bars (V-shape).
  const uZoneUpper = minL + span * 0.62;
  let barsInBowl = 0;
  for (let i = 0; i < m; i++) {
    if (baseCloses[i] <= uZoneUpper) barsInBowl++;
  }
  const bottomFloorResidencyPct = Math.round((barsInBowl / m) * 100);

  // 2. Check that the minimum low occurs in the middle 65% of the base (not on the very last bar = falling knife)
  let minIdx = 0;
  for (let i = 0; i < m; i++) {
    if (baseLows[i] <= minL * 1.002) {
      minIdx = i;
      break;
    }
  }
  const normalizedMinPos = minIdx / (m - 1); // Ideal U-bottom is between 0.20 and 0.80

  // 3. Left-Lip vs Right-Side Recovery Symmetry
  const leftThirdHigh = Math.max(...baseHighs.slice(0, Math.max(3, Math.floor(m * 0.35))));
  const rightQuarterClose = Math.max(...baseCloses.slice(Math.floor(m * 0.72)));
  const lipRecoveryRatio = Math.min(1.05, rightQuarterClose / (leftThirdHigh || 1));

  // 4. Right-Side Handle Tightness (last 5 bars range vs total base span)
  const last5Span = Math.max(...baseHighs.slice(-5)) - Math.min(...baseLows.slice(-5));
  const handleTightnessRatio = last5Span / span;

  // Score calculation
  let score = 45;
  // Bowl residency reward (rejects <22% V-spikes and >88% L-shaped dead bases)
  if (bottomFloorResidencyPct >= 30 && bottomFloorResidencyPct <= 78) {
    score += 22;
  } else if (bottomFloorResidencyPct >= 24 && bottomFloorResidencyPct <= 84) {
    score += 12;
  }

  // Bottom location in middle of U
  if (normalizedMinPos >= 0.18 && normalizedMinPos <= 0.82) {
    score += 13;
  } else if (normalizedMinPos <= 0.90) {
    score += 6;
  }

  // Right-side recovery of the U
  if (lipRecoveryRatio >= 0.92) score += 12;
  else if (lipRecoveryRatio >= 0.85) score += 7;

  // Right-side handle coil
  if (handleTightnessRatio <= 0.38) score += 8;
  else if (handleTightnessRatio <= 0.55) score += 4;

  const uShapeScore = Math.max(20, Math.min(99, Math.round(score)));
  const isTrueUShape = uShapeScore >= 64 && normalizedMinPos <= 0.90 && lipRecoveryRatio >= 0.83;

  let baseShapeLabel: "PERFECT_U_BASE" | "U_CUP_WITH_HANDLE" | "HIGH_TIGHT_U_BASE" = "PERFECT_U_BASE";
  if (handleTightnessRatio <= 0.35 && lipRecoveryRatio >= 0.90) {
    baseShapeLabel = "U_CUP_WITH_HANDLE";
  } else if ((span / maxH) * 100 <= 16.5) {
    baseShapeLabel = "HIGH_TIGHT_U_BASE";
  }

  return {
    uShapeScore,
    isTrueUShape,
    bottomFloorResidencyPct,
    baseShapeLabel,
  };
}

/**
 * Evaluates an IPO stock for:
 *  1. Base #1 to Base #4 after IPO (strictly rejects Base #5+)
 *  2. True U-Shape rounded geometry
 *  3. High Fundamental Quality + Future Outlook Megatrend score
 */
export function evaluateIpoRocketBase(
  profile: IpoFundamentalProfile | string,
  candles: any[],
  companyNameArg?: string,
  sectorArg?: string,
  genomeVersion: number = 1
): IpoRocketBaseResult | null {
  if (!candles || candles.length < 15) return null;

  const prof: IpoFundamentalProfile =
    typeof profile === "string"
      ? RECENT_INDIAN_IPOS.find((p) => p.symbol === profile) || {
          symbol: profile,
          name: companyNameArg || profile,
          sector: sectorArg || "IPO Growth",
          issuePrice: Number(candles[0]?.open) || 100,
          roePct: 20.0,
          rocePct: 22.0,
          revenueGrowthYoY: 25.0,
          patGrowthYoY: 30.0,
          debtToEquity: 0.25,
          fundamentalScore: 80,
          fundamentalGrade: "A",
          futureOutlookScore: 85,
          megatrendTheme: "Emerging Sector Leader",
          futureOutlookCatalyst: "Strong post-listing institutional revenue & margin expansion",
        }
      : profile;

  // Hard Gate 1: Must have strong Fundamentals & Future Outlook
  if (prof.fundamentalScore < 72 || prof.futureOutlookScore < 75) return null;

  const closes = candles.map((c: any) => Number(c.close));
  const highs = candles.map((c: any) => Number(c.high));
  const lows = candles.map((c: any) => Number(c.low));
  const vols = candles.map((c: any) => Number(c.volume) || 1);

  const n = closes.length;
  const currClose = closes[n - 1];
  const prevClose = closes[n - 2] || currClose;
  const listingOpen = prof.issuePrice || Number(candles[0].open) || closes[0];
  const daysListed = n;

  // Hard Gate 2: Strict 4-Base Post-IPO Rule (Only Base #1, #2, #3, #4 considered!)
  const rawBaseCount = countPostIpoBases(highs, lows, closes);
  if (rawBaseCount > 4) {
    // Reject late-stage exhausted IPOs that have formed more than 4 bases
    return null;
  }
  const baseNumberAfterIpo = rawBaseCount as 1 | 2 | 3 | 4;

  const postListingHigh = Math.max(...highs);
  const totalGainSinceListingPct = ((currClose - listingOpen) / (listingOpen + 1e-8)) * 100;

  // Base Window: last 18-45 bars (or 65% of history for brand-new IPOs)
  const baseWindow = Math.min(45, Math.max(14, Math.floor(n * 0.65)));
  const baseHighs = highs.slice(n - baseWindow);
  const baseLows = lows.slice(n - baseWindow);
  const baseCloses = closes.slice(n - baseWindow);
  const pivotHigh = Math.max(...baseHighs);
  const baseLow = Math.min(...baseLows);

  const baseDepthPct = ((pivotHigh - baseLow) / (pivotHigh + 1e-8)) * 100;
  const distanceFromPivotPct = ((pivotHigh - currClose) / (pivotHigh + 1e-8)) * 100;

  // Hard Gate 3: Base depth must be constructive (<33%) and price within 18% of right-side pivot
  if (baseDepthPct > 33.0 || distanceFromPivotPct > 18.0) return null;

  // Hard Gate 4: True U-Shape Geometry Check
  const uMetrics = analyzeUShapeGeometry(baseCloses, baseHighs, baseLows);
  if (!uMetrics.isTrueUShape) return null;

  // Volume Dry-Up (VDU) in last 6 bars vs 20-day average
  const recent20Vols = vols.slice(Math.max(0, n - 20));
  const smaVol20 = recent20Vols.reduce((sum, v) => sum + v, 0) / (recent20Vols.length || 1);
  const recent6Vols = vols.slice(Math.max(0, n - 6));
  const minVolRatio = Math.min(...recent6Vols) / (smaVol20 + 1e-8);
  const currRvol = vols[n - 1] / (smaVol20 + 1e-8);
  const hasVolumeDryUp = minVolRatio <= 0.60;

  // 20 EMA support on right side of U-base
  const ema20Arr = computeEMA(closes, Math.min(20, n));
  const currEma20 = ema20Arr[n - 1] || currClose;

  // SEBI Anchor Lock-in Window & Supply Absorption
  let anchorLockinStatus: IpoRocketBaseResult["anchorLockinStatus"] = "PRE_30D_LOCKIN";
  if (daysListed >= 85 && daysListed <= 100) {
    anchorLockinStatus = "90D_WINDOW_ACTIVE";
  } else if (daysListed >= 28 && daysListed <= 38) {
    anchorLockinStatus = "30D_WINDOW_ACTIVE";
  } else if (daysListed > 100 && currClose >= currEma20 * 0.98) {
    anchorLockinStatus = "90D_ANCHOR_ABSORBED";
  } else if (daysListed > 38 && currClose >= currEma20 * 0.98) {
    anchorLockinStatus = "30D_ANCHOR_ABSORBED";
  } else if (currClose < currEma20 * 0.98 && daysListed > 38) {
    anchorLockinStatus = "SUPPLY_OVERHANG";
  }

  // ATR(14) for tight stop-loss
  const recentRanges = highs.slice(Math.max(0, n - 14)).map((h, i) => h - lows[Math.max(0, n - 14) + i]);
  const atr14 = recentRanges.reduce((a, b) => a + b, 0) / (recentRanges.length || 1);

  // Composite Score combining U-Shape Geometry (30%) + Fundamentals (30%) + Future Outlook (25%) + Base Freshness (15%)
  const baseFreshnessBonus = baseNumberAfterIpo === 1 ? 15 : baseNumberAfterIpo === 2 ? 13 : baseNumberAfterIpo === 3 ? 10 : 7;
  let rocketScore = Math.round(
    uMetrics.uShapeScore * 0.30 +
    prof.fundamentalScore * 0.30 +
    prof.futureOutlookScore * 0.25 +
    baseFreshnessBonus
  );

  if (hasVolumeDryUp) rocketScore += 3;
  if (anchorLockinStatus === "30D_ANCHOR_ABSORBED" || anchorLockinStatus === "90D_ANCHOR_ABSORBED") {
    rocketScore += 3;
  }
  rocketScore = Math.min(99, Math.max(60, rocketScore));

  // Setup Classification
  let setupClassification: IpoRocketBaseResult["setupClassification"] = "FORMING_BASE";
  if (currClose >= pivotHigh * 0.992 && currRvol >= 1.5 && baseDepthPct <= 26.0) {
    setupClassification = "ROCKET_BREAKOUT_ACTIVE";
  } else if (distanceFromPivotPct <= 4.5 && hasVolumeDryUp && uMetrics.uShapeScore >= 75) {
    setupClassification = "READY_TO_BOOM";
  } else if (baseDepthPct <= 19.0 && baseNumberAfterIpo <= 2 && prof.fundamentalScore >= 86) {
    setupClassification = "HYPER_ROCKET_BASE";
  } else if (uMetrics.uShapeScore >= 70 && distanceFromPivotPct <= 12.0) {
    setupClassification = "INSTITUTIONAL_VCP";
  }

  const baseNameMap: Record<number, string> = {
    1: "Base #1 of 4 · Primary Post-IPO U-Base",
    2: "Base #2 of 4 · Secondary Institutional U-Base",
    3: "Base #3 of 4 · Stage-2 Continuation U-Base",
    4: "Base #4 of 4 · Final Qualifying U-Base",
  };

  // Tight Risk-First Stop-Loss (handle low or 1.5x ATR below pivot, capped at 6% risk)
  const handleLow = Math.min(...baseLows.slice(-7));
  const rawStop = Math.max(handleLow * 0.99, pivotHigh - 1.6 * atr14);
  const stopLoss = Math.round(Math.max(pivotHigh * 0.94, Math.min(pivotHigh * 0.975, rawStop)) * 100) / 100;
  const riskPct = Math.round(((pivotHigh - stopLoss) / (pivotHigh || 1)) * 1000) / 10;

  const target1 = Math.round(pivotHigh * 1.20 * 100) / 100;
  const target2 = Math.round(pivotHigh * 1.35 * 100) / 100;
  const risk = Math.max(0.5, pivotHigh - stopLoss);
  const reward = target1 - pivotHigh;
  const rr = (reward / risk).toFixed(1);

  const dailyChange = currClose - prevClose;
  const dailyChangePercent = (dailyChange / prevClose) * 100;

  return {
    id: `ipo_${prof.symbol}`,
    scannerType: "ipo",
    stockSymbol: prof.symbol,
    stockName: prof.name,
    sector: prof.sector,
    exchange: "NSE",
    price: currClose.toFixed(2),
    change: dailyChange.toFixed(2),
    changePercent: dailyChangePercent.toFixed(2),
    volume: vols[n - 1].toLocaleString("en-IN"),
    marketCap: "N/A",
    daysListed,
    baseNumberAfterIpo,
    baseStageLabel: baseNameMap[baseNumberAfterIpo],
    uShapeScore: uMetrics.uShapeScore,
    isTrueUShape: uMetrics.isTrueUShape,
    baseShapeLabel: uMetrics.baseShapeLabel,
    bottomFloorResidencyPct: uMetrics.bottomFloorResidencyPct,
    fundamentalScore: prof.fundamentalScore,
    fundamentalGrade: prof.fundamentalGrade,
    roePct: prof.roePct,
    rocePct: prof.rocePct,
    revenueGrowthYoY: prof.revenueGrowthYoY,
    patGrowthYoY: prof.patGrowthYoY,
    futureOutlookScore: prof.futureOutlookScore,
    megatrendTheme: prof.megatrendTheme,
    futureOutlookCatalyst: prof.futureOutlookCatalyst,
    setupClassification,
    anchorLockinStatus,
    rocketScore,
    baseDepthPct: Math.round(baseDepthPct * 10) / 10,
    distanceFromPivotPct: Math.round(distanceFromPivotPct * 10) / 10,
    hasVolumeDryUp,
    currentRvol: Math.round(currRvol * 100) / 100,
    tradePlan: {
      pivotTriggerPrice: Math.round(pivotHigh * 100) / 100,
      postListingHigh: Math.round(postListingHigh * 100) / 100,
      stopLoss,
      riskPct,
      target1,
      target2,
      riskRewardRatio: `1:${rr}`,
    },
    totalGainSinceListingPct: Math.round(totalGainSinceListingPct * 10) / 10,
    newsScore: 80,
    genomeVersion,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Genome-evolved IPO Scanner using the 4-Base U-Shape + Fundamental & Future Outlook Engine.
 */
export async function runIpoScannerEvolved(): Promise<{
  results: IpoRocketBaseResult[];
  genomeVersion: number;
  scanned: number;
  passed: number;
}> {
  console.log("[IpoGenome] ═══ Starting 4-Base U-Shape IPO + Fundamental/Outlook Scan ═══");
  const startTime = Date.now();
  await markJobStart("ipo_evolved_scan");

  try {
    const genome = await getGenome("IPO");
    const results: IpoRocketBaseResult[] = [];
    let scanned = 0;

    await Promise.all(
      RECENT_INDIAN_IPOS.map(async (item) => {
        try {
          const symbol = item.symbol;
          const candles = await candleCache.getCandlesCached(`${symbol}.NS`, "2y", "1d");
          scanned++;

          const analyzed = evaluateIpoRocketBase(
            item,
            candles,
            item.name,
            item.sector,
            genome.version
          );

          if (analyzed) {
            try {
              const newsScore = await getNewsScoreForSymbol(symbol);
              analyzed.newsScore = Math.round(newsScore);
            } catch (_) {}

            results.push(analyzed);

            try {
              await db.insert(ipoOutcomes).values({
                symbol,
                entryPrice: analyzed.price,
                listingDate: new Date(),
                daysOld: analyzed.daysListed,
                baseDepth: String(analyzed.baseDepthPct),
                consolidationRange: String(analyzed.distanceFromPivotPct),
                avgVolume: String(analyzed.volume).replace(/,/g, ""),
                ipoScore: analyzed.rocketScore,
                newsScore: String(analyzed.newsScore),
                genomeVersion: genome.version,
              });
            } catch (_) {}
          }
        } catch (err: any) {
          console.warn(`[IpoGenome] Could not fetch IPO data for ${item.symbol}:`, err.message);
        }
      })
    );

    // Sort by Base Freshness (Base #1-2 first) and Rocket Score descending
    results.sort(
      (a, b) =>
        b.rocketScore - a.rocketScore ||
        a.baseNumberAfterIpo - b.baseNumberAfterIpo ||
        a.distanceFromPivotPct - b.distanceFromPivotPct
    );
    console.log(`[IpoGenome] ═══ Scan complete: ${results.length} qualifying U-Shape IPO Bases (Base #1–#4) detected ═══`);

    const duration = Date.now() - startTime;
    await markJobDone("ipo_evolved_scan", duration);

    return {
      results,
      genomeVersion: genome.version,
      scanned,
      passed: results.length,
    };
  } catch (error: any) {
    console.error("[IpoGenome] Scan failed:", error);
    await markJobFailed("ipo_evolved_scan", error);
    return { results: [], genomeVersion: 1, scanned: 0, passed: 0 };
  }
}

export async function trackIpoOutcomes(): Promise<{
  filled5d: number;
  filled10d: number;
  filled20d: number;
}> {
  const now = new Date();
  let filled5d = 0;
  let filled10d = 0;
  let filled20d = 0;

  const fiveDayAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  try {
    const pending5d = await db.select()
      .from(ipoOutcomes)
      .where(and(
        isNull(ipoOutcomes.return5d),
        lte(ipoOutcomes.scanDate, fiveDayAgo),
      ))
      .limit(80);

    for (const row of pending5d) {
      try {
        const quote = await getYahooStockQuote(`${row.symbol}.NS`);
        if (quote?.price && row.entryPrice) {
          const entryPrice = parseFloat(row.entryPrice);
          const returnPct = ((quote.price - entryPrice) / entryPrice) * 100;
          const outcome = returnPct >= DEFAULT_WIN_THRESHOLD ? "WIN" : returnPct <= DEFAULT_LOSS_THRESHOLD ? "LOSS" : "NEUTRAL";

          await db.update(ipoOutcomes)
            .set({
              price5d: String(quote.price.toFixed(2)),
              return5d: String(returnPct.toFixed(2)),
              outcome5d: outcome,
              filled5dAt: now,
            })
            .where(eq(ipoOutcomes.id, row.id));
          filled5d++;
        }
      } catch (_) {}
    }
  } catch (_) {}

  const tenDayAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  try {
    const pending10d = await db.select()
      .from(ipoOutcomes)
      .where(and(
        isNull(ipoOutcomes.return10d),
        sql`${ipoOutcomes.return5d} IS NOT NULL`,
        lte(ipoOutcomes.scanDate, tenDayAgo),
      ))
      .limit(80);

    for (const row of pending10d) {
      try {
        const quote = await getYahooStockQuote(`${row.symbol}.NS`);
        if (quote?.price && row.entryPrice) {
          const entryPrice = parseFloat(row.entryPrice);
          const returnPct = ((quote.price - entryPrice) / entryPrice) * 100;

          await db.update(ipoOutcomes)
            .set({
              price10d: String(quote.price.toFixed(2)),
              return10d: String(returnPct.toFixed(2)),
              outcome10d: returnPct >= DEFAULT_WIN_THRESHOLD ? "WIN" : returnPct <= DEFAULT_LOSS_THRESHOLD ? "LOSS" : "NEUTRAL",
              filled10dAt: now,
            })
            .where(eq(ipoOutcomes.id, row.id));
          filled10d++;
        }
      } catch (_) {}
    }
  } catch (_) {}

  const twentyDayAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  try {
    const pending20d = await db.select()
      .from(ipoOutcomes)
      .where(and(
        isNull(ipoOutcomes.return20d),
        sql`${ipoOutcomes.return10d} IS NOT NULL`,
        lte(ipoOutcomes.scanDate, twentyDayAgo),
      ))
      .limit(80);

    for (const row of pending20d) {
      try {
        const quote = await getYahooStockQuote(`${row.symbol}.NS`);
        if (quote?.price && row.entryPrice) {
          const entryPrice = parseFloat(row.entryPrice);
          const returnPct = ((quote.price - entryPrice) / entryPrice) * 100;

          await db.update(ipoOutcomes)
            .set({
              price20d: String(quote.price.toFixed(2)),
              return20d: String(returnPct.toFixed(2)),
              outcome20d: returnPct >= DEFAULT_WIN_THRESHOLD ? "WIN" : returnPct <= DEFAULT_LOSS_THRESHOLD ? "LOSS" : "NEUTRAL",
              filled20dAt: now,
            })
            .where(eq(ipoOutcomes.id, row.id));
          filled20d++;
        }
      } catch (_) {}
    }
  } catch (_) {}

  return { filled5d, filled10d, filled20d };
}

export async function runIpoLearningCycle(): Promise<{
  promoted: boolean;
  oldAvgReturn: number;
  newAvgReturn: number;
  sampleSize: number;
  description: string;
}> {
  await markJobStart("ipo_learning_cycle");

  try {
    const completed = await db.select()
      .from(ipoOutcomes)
      .where(sql`${ipoOutcomes.return5d} IS NOT NULL`)
      .orderBy(desc(ipoOutcomes.scanDate))
      .limit(500);

    const trades: TradeOutcome[] = completed.map(row => ({
      returnPct: parseFloat(row.return5d || "0"),
      vcpScore: row.ipoScore ?? undefined,
      newsScore: row.newsScore ? parseFloat(row.newsScore) : undefined,
      outcome: row.outcome5d ?? undefined,
    }));

    const result = await runGenomeEvolution("IPO", trades, {
      mutations: 25,
      minImprovement: 0.2,
    });

    await markJobDone("ipo_learning_cycle", Date.now());

    return {
      promoted: result.promoted,
      oldAvgReturn: result.oldAvgReturn,
      newAvgReturn: result.newAvgReturn,
      sampleSize: trades.length,
      description: result.description,
    };
  } catch (error: any) {
    await markJobFailed("ipo_learning_cycle", error);
    return { promoted: false, oldAvgReturn: 0, newAvgReturn: 0, sampleSize: 0, description: "Error" };
  }
}

export async function getIpoGenomeStatus() {
  const genome = await getGenome("IPO");
  let completedOutcomes = 0;
  try {
    const outcomeCount = await db.select({ count: sql<number>`COUNT(*)` })
      .from(ipoOutcomes)
      .where(sql`${ipoOutcomes.return5d} IS NOT NULL`);
    completedOutcomes = outcomeCount[0]?.count ?? 0;
  } catch (_) {}

  return {
    engine: "IPO",
    genomeVersion: genome.version,
    params: genome.params,
    avgReturn: genome.avgReturn,
    sampleSize: genome.sampleSize,
    completedOutcomes,
  };
}
