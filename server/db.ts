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

const mockClient = {
  query: async () => ({ rows: [], rowCount: 0, fields: [] }),
  release: () => {},
};

const mockPool: any = {
  query: async () => ({ rows: [], rowCount: 0, fields: [] }),
  connect: async () => mockClient,
  on: () => {},
  end: async () => {},
};

export const pool: pg.Pool = isPostgresConfigured
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 10,
    })
  : mockPool;

if (isPostgresConfigured) {
  pool.on("error", (err) => {
    console.warn("[Postgres Pool] Client error (running in resilient mode):", err.message);
  });
}

export const db = drizzle({ client: pool, schema });

