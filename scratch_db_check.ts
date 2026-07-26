import "dotenv/config";
import { db } from "./server/db";
import { scannerData } from "./shared/schema";

async function main() {
  try {
    const results = await db.select().from(scannerData);
    console.log("Scanner Data Records Count:", results.length);
    console.log("Unique Scanner Types:", [...new Set(results.map(r => r.scannerType))]);
    console.log("Sample Records:", results.slice(0, 5));
  } catch (err) {
    console.error("Database query failed:", err);
  }
}

main().then(() => process.exit(0));
