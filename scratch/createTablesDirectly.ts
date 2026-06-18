import "dotenv/config";
import { db } from "../server/db.js";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Creating APEX tables directly...");
  try {
    // 1. job_ledger
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS job_ledger (
        id SERIAL PRIMARY KEY,
        job_name TEXT NOT NULL UNIQUE,
        last_ran_at TIMESTAMP,
        next_run_at TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'idle',
        run_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        last_duration_ms INTEGER
      );
    `);
    console.log("job_ledger table checked/created.");

    // 2. apex_predictions
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS apex_predictions (
        id SERIAL PRIMARY KEY,
        prediction_date TIMESTAMP NOT NULL,
        symbol TEXT NOT NULL,
        direction TEXT NOT NULL,
        confidence_score NUMERIC(5, 2),
        momentum_score NUMERIC(5, 2),
        gap_score NUMERIC(5, 2),
        news_score NUMERIC(5, 2),
        fo_score NUMERIC(5, 2),
        sector_score NUMERIC(5, 2),
        reasoning TEXT,
        open_price NUMERIC(10, 2),
        close_price NUMERIC(10, 2),
        actual_return_pct NUMERIC(8, 4),
        actual_direction TEXT,
        is_correct BOOLEAN,
        filled_at TIMESTAMP,
        weight_version INTEGER,
        features JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_apex_predictions_date ON apex_predictions(prediction_date);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_apex_predictions_symbol ON apex_predictions(symbol);`);
    console.log("apex_predictions table checked/created.");

    // 3. apex_news_signals
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS apex_news_signals (
        id SERIAL PRIMARY KEY,
        signal_date TIMESTAMP NOT NULL,
        symbol TEXT,
        sector TEXT,
        headline TEXT NOT NULL,
        source TEXT,
        url TEXT,
        sentiment_score NUMERIC(5, 2),
        catalyst_type TEXT,
        entity_type TEXT,
        processed_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_apex_news_date ON apex_news_signals(signal_date);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_apex_news_symbol ON apex_news_signals(symbol);`);
    console.log("apex_news_signals table checked/created.");

    // 4. apex_fo_signals
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS apex_fo_signals (
        id SERIAL PRIMARY KEY,
        signal_date TIMESTAMP NOT NULL,
        symbol TEXT NOT NULL,
        is_fo_stock BOOLEAN NOT NULL DEFAULT FALSE,
        pcr NUMERIC(8, 4),
        call_oi NUMERIC(15, 0),
        put_oi NUMERIC(15, 0),
        oi_change_pct NUMERIC(8, 4),
        oi_direction TEXT,
        max_pain NUMERIC(10, 2),
        iv_rank NUMERIC(5, 2),
        signal TEXT,
        signal_strength NUMERIC(5, 2),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_apex_fo_date ON apex_fo_signals(signal_date);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_apex_fo_symbol ON apex_fo_signals(symbol);`);
    console.log("apex_fo_signals table checked/created.");

    // 5. apex_weights
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS apex_weights (
        id SERIAL PRIMARY KEY,
        version INTEGER NOT NULL UNIQUE,
        weights JSONB NOT NULL,
        accuracy_rate NUMERIC(5, 4),
        sample_size INTEGER,
        learning_notes TEXT,
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("apex_weights table checked/created.");

    // 6. job_error_log
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS job_error_log (
        id SERIAL PRIMARY KEY,
        job_name TEXT NOT NULL,
        error_message TEXT NOT NULL,
        symbol TEXT,
        stack_trace TEXT,
        retried BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_job_error_log_job ON job_error_log(job_name);`);
    console.log("job_error_log table checked/created.");

    console.log("All APEX tables created successfully!");
  } catch (err) {
    console.error("Failed to create tables directly:", err);
  }
}

main().then(() => process.exit(0));
