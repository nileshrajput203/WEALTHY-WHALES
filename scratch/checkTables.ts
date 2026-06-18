import "dotenv/config";
import { db } from "../server/db.js";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log("Database Tables:");
    console.log(tables.rows.map(r => r.table_name));
  } catch (err) {
    console.error("Failed to query tables:", err);
  }
}

main().then(() => process.exit(0));
