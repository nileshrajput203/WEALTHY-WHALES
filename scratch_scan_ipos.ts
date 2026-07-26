import "dotenv/config";
import { NSE_UNIQUE } from "./server/nseUniverse";
import { getYahooHistory } from "./server/stockApi";

async function analyzeIpoStock(sym: string): Promise<any | null> {
  try {
    const yahooSym = sym.includes('.') ? sym : `${sym}.NS`;
    const candles = await getYahooHistory(yahooSym, '1y', '1d');
    if (!candles || candles.length < 5) return null;
    
    const firstCandle = candles[0];
    const listingDate = new Date(firstCandle.time);
    const ageInDays = (Date.now() - listingDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // Log if it is a recent IPO (e.g. within 120 days)
    console.log(`Symbol: ${sym}, Listing Date: ${listingDate.toISOString().split('T')[0]}, Age: ${Math.round(ageInDays)} days, Candles: ${candles.length}`);
    
    const closes = candles.map((c: any) => c.close as number);
    const highs = candles.map((c: any) => c.high as number);
    const lows = candles.map((c: any) => c.low as number);
    const n = closes.length;
    
    const last10Closes = closes.slice(-10);
    const maxLast10 = Math.max(...last10Closes);
    const minLast10 = Math.min(...last10Closes);
    const tightRange = (maxLast10 - minLast10) / maxLast10;
    
    console.log(`  Last 10 days close range: ${(tightRange * 100).toFixed(2)}%`);
    
    const maxHighAll = Math.max(...highs);
    const minLowAll = Math.min(...lows);
    const totalDepth = (maxHighAll - minLowAll) / maxHighAll;
    console.log(`  Total high-low depth: ${(totalDepth * 100).toFixed(2)}%`);
    
    return null;
  } catch (error) {
    return null;
  }
}

async function main() {
  const list = [
    'NTPCGREEN', 'SWIGGY', 'BAJAJHSG', 'PREMIERENE', 'WAREEENER', 
    'ACMESOLAR', 'KRN', 'AWFIS', 'IXIGO', 'KRONOX', 'JNKINDIA', 'BFI',
    'KIRLFER'
  ];
  console.log(`Scanning specific potential IPO symbols: ${list.join(', ')}`);
  for (const sym of list) {
    await analyzeIpoStock(sym);
  }
  console.log("Test scan complete.");
}

main().then(() => process.exit(0));
