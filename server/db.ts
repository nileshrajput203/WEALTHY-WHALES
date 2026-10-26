// Database connection setup - referenced from javascript_database blueprint
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.on("error", (err) => {
  console.warn("[Postgres Pool] Client error (running in resilient mode):", err.message);
});

export const db = drizzle({ client: pool, schema });

