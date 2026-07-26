import axios from "axios";

export async function getUSDINR(): Promise<number> {
  try {
    const r = await axios.get("https://open.er-api.com/v6/latest/USD", { timeout: 8000 });
    if (r.status === 200 && r.data?.rates?.INR) {
      return r.data.rates.INR;
    }
    return 83.50; // Fallback
  } catch (error: any) {
    console.error("Error fetching USD/INR exchange rate:", error.message);
    return 83.50; // Fallback
  }
}

export interface CryptoCorrelation {
  btcChange24h: number;
  goldChange24h: number;
}

export async function getCryptoCorrelation(): Promise<CryptoCorrelation> {
  try {
    // Note: CoinGecko doesn't track gold by "gold" in the simple price API since gold isn't a cryptocurrency.
    // Instead we can fetch pax-gold (PAXG) which is a gold-backed cryptocurrency tracking gold price 1:1, or mock gold change.
    const r = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,pax-gold&vs_currencies=usd&include_24hr_change=true",
      { timeout: 8000 }
    );
    
    if (r.status === 200) {
      const btcChange = r.data?.bitcoin?.usd_24h_change ?? 1.5;
      const goldChange = r.data?.["pax-gold"]?.usd_24h_change ?? -0.2;
      return {
        btcChange24h: round(btcChange, 2),
        goldChange24h: round(goldChange, 2)
      };
    }
    return { btcChange24h: 1.5, goldChange24h: -0.2 }; // Mocks
  } catch (error: any) {
    console.error("Error fetching crypto correlation from Coingecko:", error.message);
    return { btcChange24h: 1.25, goldChange24h: -0.15 }; // Mocks
  }
}

function round(val: number, precision: number): number {
  const factor = Math.pow(10, precision);
  return Math.round(val * factor) / factor;
}
