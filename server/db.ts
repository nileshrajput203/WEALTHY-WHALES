// Database connection setup - referenced from javascript_database blueprint
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  console.warn(
    "[DB] DATABASE_URL not set — Postgres features disabled. App will run in RAM-only mode.",
  );
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/placeholder",
  // Resilient pool settings: fail fast instead of blocking for 30s
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 10,
});

pool.on("error", (err) => {
  console.warn("[Postgres Pool] Client error (running in resilient mode):", err.message);
});

export const db = drizzle({ client: pool, schema });

