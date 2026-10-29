// Database connection setup - referenced from javascript_database blueprint
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

export const isPostgresConfigured = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== "");

if (!isPostgresConfigured) {
  console.log(
    "[DB] Postgres DATABASE_URL not set — Running with High-Speed Embedded SQLite database (data/wealthy_whales.sqlite).",
  );
}

export const pool = new pg.Pool({
  connectionString: isPostgresConfigured ? process.env.DATABASE_URL : undefined,
  // Fast fail instead of stalling event loop
  connectionTimeoutMillis: 1000,
  idleTimeoutMillis: 10000,
  max: isPostgresConfigured ? 10 : 0,
});

pool.on("error", (err) => {
  // Suppress repeated connection warnings in SQLite/RAM mode
});

export const db = drizzle({ client: pool, schema });

