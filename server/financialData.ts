/**
 * Deterministic Financial Statement Generator
 * Produces highly realistic, consistent financial sheets (yearly and quarterly) for any stock symbol.
 * Seed-based randomness ensures that numbers match the stock size, sector profile, and sum up correctly.
 */

// Simple LCG pseudo-random generator
function createSeedRandom(seedStr: string) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  }
  return function (min = 0, max = 1) {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    const r = (h >>> 0) / 4294967296;
    return min + r * (max - min);
  };
}

export interface FinancialsResponse {
  symbol: string;
  sector: string;
  scale: string; // "Cr" for crores
  shareholding: {
    yearly: any[];
    quarterly: any[];
  };
  ratios: {
    yearly: any[];
    quarterly: any[];
  };
  cashFlows: {
    yearly: any[];
    quarterly: any[];
  };
  balanceSheet: {
    yearly: any[];
    quarterly: any[];
  };
  profitAndLoss: any[]; // Yearly
  quarterlyResults: any[]; // Quarterly
}

// Map common symbols to sectors to make data look authentic
const SYMBOL_SECTORS: Record<string, string> = {
  RELIANCE: "Energy & Petrochemicals",
  TCS: "Information Technology",
  INFY: "Information Technology",
  WIPRO: "Information Technology",
  HCLTECH: "Information Technology",
  LTIM: "Information Technology",
  HDFCBANK: "Banking & Finance",
  ICICIBANK: "Banking & Finance",
  SBIN: "Banking & Finance",
  KOTAKBANK: "Banking & Finance",
  AXISBANK: "Banking & Finance",
  TATAMOTORS: "Automotive",
  MARUTI: "Automotive",
  M_M: "Automotive",
  SUNPHARMA: "Pharmaceuticals",
  CIPLA: "Pharmaceuticals",
  DRREDDY: "Pharmaceuticals",
  DIVISLAB: "Pharmaceuticals",
  ITC: "FMCG & Diversified",
  HINDUNILVR: "FMCG & Consumer Goods",
  NESTLEIND: "FMCG & Consumer Goods",
  BRITANNIA: "FMCG & Consumer Goods",
  TATASTEEL: "Metals & Mining",
  JSWSTEEL: "Metals & Mining",
  HINDALCO: "Metals & Mining",
  LT: "Infrastructure & Engineering",
  ADANIPORTS: "Infrastructure & Logistics",
  DLF: "Real Estate",
  GODREJPROP: "Real Estate",
};

export function getFinancialData(rawSymbol: string): FinancialsResponse {
  const symbol = rawSymbol.replace(/\.(NS|BO|NSE|BSE)$/i, "").toUpperCase();
  const rand = createSeedRandom(symbol);

  // Determine sector and baseline sizing
  let sector = SYMBOL_SECTORS[symbol];
  if (!sector) {
    const sectors = ["Banking & Finance", "Information Technology", "Pharmaceuticals", "Automotive", "FMCG & Consumer Goods", "Energy & Power", "Infrastructure & Materials", "Real Estate"];
    sector = sectors[Math.floor(rand(0, sectors.length))];
  }

  // Size base (sales scale)
  // Large cap vs Mid cap vs Small cap based on symbol hashing
  const capSeed = rand(0, 100);
  let baseSales = 2000; // Small cap base (annual in Cr)
  if (capSeed > 80) {
    baseSales = 150000; // Mega cap (Reliance, TCS size)
  } else if (capSeed > 40) {
    baseSales = 35000; // Large/Mid cap
  } else if (capSeed > 15) {
    baseSales = 8000; // Mid cap
  }

  const isBank = sector.includes("Bank") || sector.includes("Finance");

  // Growth & Profitability metrics based on sector
  let opmBase = 0.18; // 18% average margin
  let debtEquityBase = 0.4;
  let taxRate = 0.25;

  if (sector === "Information Technology") {
    opmBase = 0.24;
    debtEquityBase = 0.05;
  } else if (sector === "Banking & Finance") {
    opmBase = 0.45; // NIM / Spread margins
    debtEquityBase = 6.5; // High leverage is normal for banks (Liabilities/Equity)
  } else if (sector === "Pharmaceuticals") {
    opmBase = 0.22;
    debtEquityBase = 0.2;
  } else if (sector === "Real Estate") {
    opmBase = 0.3;
    debtEquityBase = 0.85;
  }

  // Historical yearly trajectory (past 5 years)
  // FY20, FY21, FY22, FY23, FY24
  const yearlyPeriods = ["FY2022", "FY2023", "FY2024", "FY2025", "FY2026"];
  const quarterlyPeriods = [
    "Jun 23", "Sep 23", "Dec 23", "Mar 24",
    "Jun 24", "Sep 24", "Dec 24", "Mar 25",
    "Jun 25", "Sep 25", "Dec 25", "Mar 26"
  ];

  // 1. Shareholding Pattern
  // Promoter holding, FII, DII, Government, Public
  const promoterBase = rand(35, 75);
  const fiiBase = rand(5, 25);
  const diiBase = rand(5, 20);
  const govtBase = rand(0, 5) > 4 ? rand(0.5, 10) : 0;
  const publicBase = 100 - (promoterBase + fiiBase + diiBase + govtBase);

  const getShareholdingData = (periods: string[]) => {
    let p = promoterBase;
    let f = fiiBase;
    let d = diiBase;
    let g = govtBase;
    let pb = publicBase;

    return periods.map((period) => {
      // Small quarterly drifts
      const driftP = rand(-0.2, 0.2);
      const driftF = rand(-0.6, 0.6);
      const driftD = rand(-0.4, 0.4);

      p = Math.max(0, Math.min(100, Number((p + driftP).toFixed(2))));
      f = Math.max(0, Math.min(100, Number((f + driftF).toFixed(2))));
      d = Math.max(0, Math.min(100, Number((d + driftD).toFixed(2))));
      pb = Number((100 - (p + f + d + g)).toFixed(2));

      return { period, promoter: p, fii: f, dii: d, govt: g, public: pb };
    });
  };

  // 2. Profit & Loss (Yearly) & Quarterly Results (Quarterly)
  const yearlyGrowth = rand(0.06, 0.18); // 6% to 18% CAGR
  const profitAndLoss = yearlyPeriods.map((period, idx) => {
    const factor = Math.pow(1 + yearlyGrowth, idx) * rand(0.95, 1.05);
    const sales = Math.round(baseSales * factor);
    const opm = opmBase + rand(-0.02, 0.02);
    const expenses = Math.round(sales * (1 - opm));
    const operatingProfit = sales - expenses;
    const otherIncome = Math.round(sales * rand(0.01, 0.03));
    const interest = isBank ? 0 : Math.round(operatingProfit * debtEquityBase * 0.06 * rand(0.8, 1.2));
    const depreciation = Math.round(sales * rand(0.025, 0.05));
    const pbt = operatingProfit + otherIncome - interest - depreciation;
    const tax = pbt > 0 ? Math.round(pbt * taxRate) : 0;
    const netProfit = pbt - tax;
    const eps = Number((netProfit / (sales / rand(200, 400))).toFixed(2));

    return {
      period,
      sales,
      expenses,
      operatingProfit,
      opmPercent: Number((opm * 100).toFixed(1)),
      otherIncome,
      interest,
      depreciation,
      pbt,
      taxPercent: taxRate * 100,
      tax,
      netProfit,
      eps
    };
  });

  const quarterlyResults = quarterlyPeriods.map((period, idx) => {
    // Settle quarterly sales around 25% of annual + seasonality fluctuation
    const factor = Math.pow(1 + yearlyGrowth, 4 + idx / 4) * 0.25 * rand(0.92, 1.08);
    const sales = Math.round(baseSales * factor);
    const opm = opmBase + rand(-0.015, 0.015);
    const expenses = Math.round(sales * (1 - opm));
    const operatingProfit = sales - expenses;
    const otherIncome = Math.round(sales * rand(0.008, 0.02));
    const interest = isBank ? 0 : Math.round(operatingProfit * debtEquityBase * 0.06 * 0.25 * rand(0.9, 1.1));
    const depreciation = Math.round(sales * rand(0.025, 0.045));
    const pbt = operatingProfit + otherIncome - interest - depreciation;
    const tax = pbt > 0 ? Math.round(pbt * taxRate) : 0;
    const netProfit = pbt - tax;
    const eps = Number((netProfit / (sales / rand(50, 100))).toFixed(2));

    return {
      period,
      sales,
      expenses,
      operatingProfit,
      opmPercent: Number((opm * 100).toFixed(1)),
      otherIncome,
      interest,
      depreciation,
      pbt,
      taxPercent: taxRate * 100,
      tax,
      netProfit,
      eps
    };
  });

  // 3. Balance Sheet (Yearly and Quarterly)
  const getBalanceSheet = (periods: string[], isYearly: boolean) => {
    return periods.map((period, idx) => {
      const annualIdx = isYearly ? idx : 4 + Math.floor(idx / 4);
      const refPL = profitAndLoss[Math.min(profitAndLoss.length - 1, annualIdx)];
      
      const sales = refPL?.sales ?? baseSales;
      const netProfit = refPL?.netProfit ?? (sales * 0.1);

      // Sizing capital structure
      const equityCapital = Math.round(sales * rand(0.04, 0.08));
      const reserves = Math.round(sales * 0.4 + netProfit * (isYearly ? idx : idx * 0.25) * rand(0.95, 1.05));
      const borrowings = isBank 
        ? Math.round((equityCapital + reserves) * debtEquityBase * rand(0.92, 1.02))
        : Math.round((equityCapital + reserves) * debtEquityBase * rand(0.7, 1.3));
      
      const otherLiabilities = Math.round(sales * rand(0.1, 0.2));
      const totalLiabilities = equityCapital + reserves + borrowings + otherLiabilities;

      // Assets (must match liabilities)
      const fixedAssets = isBank ? Math.round(totalLiabilities * 0.02) : Math.round(totalLiabilities * 0.45 * rand(0.9, 1.1));
      const cwip = isBank ? 0 : Math.round(fixedAssets * rand(0.02, 0.08));
      const investments = isBank ? Math.round(totalLiabilities * 0.45 * rand(0.9, 1.05)) : Math.round(totalLiabilities * 0.25 * rand(0.8, 1.2));
      const otherAssets = totalLiabilities - (fixedAssets + cwip + investments);

      return {
        period,
        shareCapital: equityCapital,
        reserves,
        borrowings,
        otherLiabilities,
        totalLiabilities,
        fixedAssets,
        cwip,
        investments,
        otherAssets,
        totalAssets: totalLiabilities
      };
    });
  };

  // 4. Cash Flows (Yearly and Quarterly)
  const getCashFlows = (periods: string[], bsData: any[]) => {
    return periods.map((period, idx) => {
      const bs = bsData[idx];
      const prevBs = bsData[idx - 1] || bs;

      const reservesDiff = bs.reserves - prevBs.reserves;
      const borrowingsDiff = bs.borrowings - prevBs.borrowings;

      // Operations cash should track net profit/change in reserves
      const operatingCash = Math.round(reservesDiff * rand(1.1, 1.3));
      const investingCash = -Math.round(operatingCash * rand(0.6, 0.85));
      const financingCash = borrowingsDiff - Math.round(bs.shareCapital * 0.05);
      const netCashFlow = operatingCash + investingCash + financingCash;

      return { period, operatingCash, investingCash, financingCash, netCashFlow };
    });
  };

  // 5. Ratios
  const getRatios = (periods: string[], bsData: any[], plData: any[]) => {
    return periods.map((period, idx) => {
      const bs = bsData[idx];
      const pl = plData[idx];

      const equity = bs.shareCapital + bs.reserves;
      const debt = bs.borrowings;

      const roe = pl ? (pl.netProfit / equity) * 100 : rand(12, 22);
      const roce = pl ? ((pl.operatingProfit) / (equity + debt)) * 100 : rand(14, 26);
      
      const debtEquity = isBank ? debtEquityBase * rand(0.9, 1.1) : (debt / equity);
      const interestCoverage = pl && pl.interest > 0 ? (pl.operatingProfit / pl.interest) : 99;
      
      const netProfitMargin = pl ? (pl.netProfit / pl.sales) * 100 : (opmBase * 75);

      const pe = rand(15, 45);
      const pb = roe / 4.5;
      const evEbitda = pe * 0.65;

      return {
        period,
        pe: Number(pe.toFixed(1)),
        pb: Number(pb.toFixed(1)),
        evEbitda: Number(evEbitda.toFixed(1)),
        roce: Number(roce.toFixed(1)),
        roe: Number(roe.toFixed(1)),
        debtEquity: Number(debtEquity.toFixed(2)),
        interestCoverage: Number(interestCoverage.toFixed(1)),
        netProfitMargin: Number(netProfitMargin.toFixed(1))
      };
    });
  };

  const bsYearly = getBalanceSheet(yearlyPeriods, true);
  const bsQuarterly = getBalanceSheet(quarterlyPeriods, false);

  const cfYearly = getCashFlows(yearlyPeriods, bsYearly);
  const cfQuarterly = getCashFlows(quarterlyPeriods, bsQuarterly);

  // Generate ratios based on matching length inputs
  const ratioYearly = getRatios(yearlyPeriods, bsYearly, profitAndLoss);
  const ratioQuarterly = getRatios(quarterlyPeriods, bsQuarterly, quarterlyResults);

  return {
    symbol,
    sector,
    scale: "Cr (₹)",
    shareholding: {
      yearly: getShareholdingData(yearlyPeriods),
      quarterly: getShareholdingData(quarterlyPeriods),
    },
    ratios: {
      yearly: ratioYearly,
      quarterly: ratioQuarterly,
    },
    cashFlows: {
      yearly: cfYearly,
      quarterly: cfQuarterly,
    },
    balanceSheet: {
      yearly: bsYearly,
      quarterly: bsQuarterly,
    },
    profitAndLoss,
    quarterlyResults,
  };
}
