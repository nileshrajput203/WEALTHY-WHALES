import "dotenv/config";
import fs from "fs";
import path from "path";
import { pool } from "../server/db";

async function main() {
  const sqlPath = path.resolve("migrations/0000_mighty_harpoon.sql");
  console.log("Reading SQL migration file from:", sqlPath);
  
  if (!fs.existsSync(sqlPath)) {
    console.error("Migration file does not exist!");
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlPath, "utf-8");
  
  // Split statements by drizzle-kit breakpoint comment
  const statements = sqlContent
    .split("--> statement-breakpoint")
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);

  console.log(`Found ${statements.length} SQL statements to execute.`);

  const client = await pool.connect();
  try {
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.split("\n")[0];
      console.log(`[${i + 1}/${statements.length}] Executing: ${preview}...`);
      try {
        await client.query(stmt);
      } catch (stmtErr: any) {
        // 42P07: relation already exists
        // 42710: duplicate_object (constraint, index already exists)
        // 42701: duplicate_column
        if (stmtErr.code === '42P07' || stmtErr.code === '42710' || stmtErr.code === '42701') {
          console.log(`  --> Ignored: ${stmtErr.message}`);
        } else {
          throw stmtErr;
        }
      }
    }
    console.log("All migration statements processed successfully!");
  } catch (err: any) {
    console.error("Migration execution failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
