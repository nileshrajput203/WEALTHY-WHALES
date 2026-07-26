import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

// ESM way to get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKER_PATH = path.resolve(__dirname, "nse_worker.py");

function runPythonWorker(action: string, symbol?: string): Promise<any> {
  return new Promise((resolve) => {
    let command = `python "${WORKER_PATH}" --action ${action}`;
    if (symbol) {
      command += ` --symbol "${symbol}"`;
    }

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error running Python worker [${action}]:`, stderr || error.message);
        resolve(getFallbackData(action, symbol));
        return;
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (parseError) {
        console.error(`JSON Parse error from Python worker [${action}]:`, stdout);
        resolve(getFallbackData(action, symbol));
      }
    });
  });
}

function getFallbackData(action: string, symbol?: string): any {
  console.warn(`Providing fallback/mock data for action: ${action}`);
  const todayStr = new Date().toISOString().split("T")[0];
  
  if (action === "quote") {
    return {
      success: true,
      price: 1500.0,
      change: 15.0,
      changePercent: 1.0,
      volume: 500000,
      deliveryPct: 50.0,
      mocked: true
    };
  } else if (action === "option-chain") {
    const expiry = "28-May-2026";
    const calls = [];
    const puts = [];
    for (let s = 1450; s <= 1550; s += 20) {
      calls.push({ strike: s, expiry, ltp: 15.0, oi: 5000, oiChg: 100, iv: 18.5 });
      puts.push({ strike: s, expiry, ltp: 15.0, oi: 4000, oiChg: -200, iv: 18.5 });
    }
    return {
      success: true,
      underlyingValue: 1500.0,
      expiryDates: [expiry],
      calls,
      puts,
      mocked: true
    };
  } else if (action === "bulk-deals") {
    return {
      success: true,
      deals: [
        { symbol: symbol || "RELIANCE", name: "Reliance Industries Ltd", clientName: "SOCIETE GENERALE", dealType: "Buy", quantity: 1450000, price: 2465.20, date: todayStr }
      ],
      mocked: true
    };
  } else if (action === "insider-trades") {
    return {
      success: true,
      trades: [
        { symbol: "RELIANCE", company: "Reliance Industries Ltd", insider: "Anant Ambani", relation: "Promoter Group", txnType: "Buy", quantity: 150000, price: 2450.00, value: 367500000, date: todayStr, holdingChange: 0.05 },
        { symbol: "TCS", company: "Tata Consultancy Services", insider: "Tata Sons Pvt Ltd", relation: "Promoter", txnType: "Buy", quantity: 450000, price: 3812.30, value: 1715535000, date: todayStr, holdingChange: 0.12 }
      ],
      mocked: true
    };
  }
  return { success: false, error: "Unknown action" };
}

export async function fetchNSEQuote(symbol: string) {
  const result = await runPythonWorker("quote", symbol);
  return result;
}

export async function fetchNSEOptionChain(symbol: string) {
  const result = await runPythonWorker("option-chain", symbol);
  return result;
}

export async function fetchBulkDeals(date?: string) {
  const result = await runPythonWorker("bulk-deals", date);
  return result;
}

export async function fetchInsiderTrades() {
  const result = await runPythonWorker("insider-trades");
  return result;
}
