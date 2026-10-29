// @ts-ignore
import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

const DATA_DIR = path.resolve(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "wealthy_whales.sqlite");

// Initialize DatabaseSync instance
let dbInstance: any = null;

export function getSqliteDb(): any {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    
    // Performance PRAGMAs
    dbInstance.exec("PRAGMA journal_mode = WAL;");
    dbInstance.exec("PRAGMA synchronous = NORMAL;");
    dbInstance.exec("PRAGMA foreign_keys = ON;");
    dbInstance.exec("PRAGMA cache_size = -64000;"); // 64MB cache

    initTables(dbInstance);
  }
  return dbInstance;
}

function initTables(db: any) {
  db.exec(`
    -- 1. Daily Candles with Delivery Statistics
    CREATE TABLE IF NOT EXISTS daily_candles (
      symbol TEXT NOT NULL,
      date TEXT NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume INTEGER NOT NULL,
      delivery_qty INTEGER,
      delivery_pct REAL,
      PRIMARY KEY (symbol, date)
    );
    CREATE INDEX IF NOT EXISTS idx_daily_candles_sym_date ON daily_candles(symbol, date DESC);

    -- 2. Authentic Quarterly Financial Results
    CREATE TABLE IF NOT EXISTS quarterly_results (
      symbol TEXT NOT NULL,
      quarter_end TEXT NOT NULL,
      sales REAL,
      expenses REAL,
      operating_profit REAL,
      opm_pct REAL,
      other_income REAL,
      interest REAL,
      depreciation REAL,
      profit_before_tax REAL,
      tax_pct REAL,
      net_profit REAL,
      eps REAL,
      raw_json TEXT,
      PRIMARY KEY (symbol, quarter_end)
    );
    CREATE INDEX IF NOT EXISTS idx_quarterly_sym_date ON quarterly_results(symbol, quarter_end DESC);

    -- 3. Precomputed Seasonality Return Grids
    CREATE TABLE IF NOT EXISTS seasonality_cache (
      symbol TEXT PRIMARY KEY,
      grid_json TEXT NOT NULL,
      stats_json TEXT NOT NULL,
      last_candle_date TEXT,
      computed_at INTEGER NOT NULL
    );

    -- 4. Sector Rotation Matrix
    CREATE TABLE IF NOT EXISTS sector_rotation (
      sector_name TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      momentum_3m REAL,
      earnings_trend TEXT,
      cycle_phase TEXT,
      updated_at INTEGER NOT NULL
    );

    -- 5. FII & DII Flows
    CREATE TABLE IF NOT EXISTS fii_dii_flows (
      date TEXT PRIMARY KEY,
      fii_buy REAL,
      fii_sell REAL,
      fii_net REAL,
      dii_buy REAL,
      dii_sell REAL,
      dii_net REAL,
      updated_at INTEGER NOT NULL
    );

    -- 6. Stock Company Master
    CREATE TABLE IF NOT EXISTS stock_master (
      symbol TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sector TEXT,
      industry TEXT,
      market_cap REAL,
      pe REAL,
      roce REAL,
      roe REAL,
      updated_at INTEGER NOT NULL
    );
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA ACCESS LAYER (DAO)
// ─────────────────────────────────────────────────────────────────────────────

export interface DbCandle {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  delivery_qty?: number | null;
  delivery_pct?: number | null;
}

export const sqliteDb = {
  // ─── CANDLES ───────────────────────────────────────────────────────────────
  getCandles(symbol: string, limit: number = 2000): DbCandle[] {
    const db = getSqliteDb();
    const cleanSym = symbol.replace(/\.(NS|BO)$/i, "").toUpperCase().trim();
    const stmt = db.prepare(`
      SELECT symbol, date, open, high, low, close, volume, delivery_qty, delivery_pct
      FROM daily_candles
      WHERE symbol = ?
      ORDER BY date ASC
      LIMIT ?
    `);
    return stmt.all(cleanSym, limit) as DbCandle[];
  },

  getLatestCandleDate(symbol: string): string | null {
    const db = getSqliteDb();
    const cleanSym = symbol.replace(/\.(NS|BO)$/i, "").toUpperCase().trim();
    const stmt = db.prepare(`
      SELECT date FROM daily_candles
      WHERE symbol = ?
      ORDER BY date DESC
      LIMIT 1
    `);
    const row = stmt.get(cleanSym) as any;
    return row ? row.date : null;
  },

  saveCandles(symbol: string, candles: DbCandle[]): void {
    if (!candles || candles.length === 0) return;
    const db = getSqliteDb();
    const cleanSym = symbol.replace(/\.(NS|BO)$/i, "").toUpperCase().trim();

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO daily_candles 
      (symbol, date, open, high, low, close, volume, delivery_qty, delivery_pct)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec("BEGIN TRANSACTION;");
    try {
      for (const c of candles) {
        insertStmt.run(
          cleanSym,
          c.date,
          c.open,
          c.high,
          c.low,
          c.close,
          c.volume,
          c.delivery_qty ?? null,
          c.delivery_pct ?? null
        );
      }
      db.exec("COMMIT;");
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }
  },

  // ─── VOLUME & DELIVERY STATS ───────────────────────────────────────────────
  getVolumeAnalysis(symbol: string): {
    todayVolume: number;
    todayDeliveryPct: number | null;
    yesterdayVolume: number;
    yesterdayDeliveryPct: number | null;
    weekAvgVolume: number;
    monthAvgVolume: number;
  } | null {
    const db = getSqliteDb();
    const cleanSym = symbol.replace(/\.(NS|BO)$/i, "").toUpperCase().trim();
    const stmt = db.prepare(`
      SELECT date, volume, delivery_pct
      FROM daily_candles
      WHERE symbol = ?
      ORDER BY date DESC
      LIMIT 30
    `);
    const rows = stmt.all(cleanSym) as any[];
    if (rows.length === 0) return null;

    const todayVolume = rows[0]?.volume || 0;
    const todayDeliveryPct = rows[0]?.delivery_pct ?? null;
    const yesterdayVolume = rows[1]?.volume || 0;
    const yesterdayDeliveryPct = rows[1]?.delivery_pct ?? null;

    const weekSlice = rows.slice(0, 5);
    const weekAvgVolume = Math.round(
      weekSlice.reduce((sum, r) => sum + (r.volume || 0), 0) / (weekSlice.length || 1)
    );

    const monthAvgVolume = Math.round(
      rows.reduce((sum, r) => sum + (r.volume || 0), 0) / (rows.length || 1)
    );

    return {
      todayVolume,
      todayDeliveryPct,
      yesterdayVolume,
      yesterdayDeliveryPct,
      weekAvgVolume,
      monthAvgVolume,
    };
  },

  // ─── SEASONALITY ───────────────────────────────────────────────────────────
  getSeasonality(symbol: string): {
    grid: any[];
    stats: any;
    lastCandleDate: string;
  } | null {
    const db = getSqliteDb();
    const cleanSym = symbol.replace(/\.(NS|BO)$/i, "").toUpperCase().trim();
    const stmt = db.prepare(`
      SELECT grid_json, stats_json, last_candle_date, computed_at
      FROM seasonality_cache
      WHERE symbol = ?
    `);
    const row = stmt.get(cleanSym) as any;
    if (!row) return null;

    try {
      return {
        grid: JSON.parse(row.grid_json),
        stats: JSON.parse(row.stats_json),
        lastCandleDate: row.last_candle_date,
      };
    } catch {
      return null;
    }
  },

  saveSeasonality(
    symbol: string,
    grid: any[],
    stats: any,
    lastCandleDate: string | null
  ): void {
    const db = getSqliteDb();
    const cleanSym = symbol.replace(/\.(NS|BO)$/i, "").toUpperCase().trim();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO seasonality_cache 
      (symbol, grid_json, stats_json, last_candle_date, computed_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      cleanSym,
      JSON.stringify(grid),
      JSON.stringify(stats),
      lastCandleDate || null,
      Date.now()
    );
  },

  // ─── QUARTERLY RESULTS ─────────────────────────────────────────────────────
  getQuarterlyResults(symbol: string): any[] {
    const db = getSqliteDb();
    const cleanSym = symbol.replace(/\.(NS|BO)$/i, "").toUpperCase().trim();
    const stmt = db.prepare(`
      SELECT quarter_end, sales, expenses, operating_profit, opm_pct, other_income,
             interest, depreciation, profit_before_tax, tax_pct, net_profit, eps, raw_json
      FROM quarterly_results
      WHERE symbol = ?
      ORDER BY quarter_end ASC
    `);
    return stmt.all(cleanSym);
  },

  saveQuarterlyResults(symbol: string, results: any[]): void {
    if (!results || results.length === 0) return;
    const db = getSqliteDb();
    const cleanSym = symbol.replace(/\.(NS|BO)$/i, "").toUpperCase().trim();

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO quarterly_results
      (symbol, quarter_end, sales, expenses, operating_profit, opm_pct, other_income,
       interest, depreciation, profit_before_tax, tax_pct, net_profit, eps, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec("BEGIN TRANSACTION;");
    try {
      for (const r of results) {
        stmt.run(
          cleanSym,
          r.quarterEnd || r.quarter_end || r.period,
          r.sales ?? r.revenue ?? null,
          r.expenses ?? null,
          r.operatingProfit ?? r.operating_profit ?? null,
          r.opmPct ?? r.opm_pct ?? null,
          r.otherIncome ?? r.other_income ?? null,
          r.interest ?? null,
          r.depreciation ?? null,
          r.profitBeforeTax ?? r.profit_before_tax ?? null,
          r.taxPct ?? r.tax_pct ?? null,
          r.netProfit ?? r.net_profit ?? r.pat ?? null,
          r.eps ?? null,
          r.rawJson ? JSON.stringify(r.rawJson) : null
        );
      }
      db.exec("COMMIT;");
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }
  },

  // ─── SECTOR ROTATION ───────────────────────────────────────────────────────
  getSectorRotation(): any[] {
    const db = getSqliteDb();
    const stmt = db.prepare(`
      SELECT sector_name, symbol, momentum_3m, earnings_trend, cycle_phase, updated_at
      FROM sector_rotation
      ORDER BY momentum_3m DESC
    `);
    return stmt.all();
  },

  saveSectorRotation(sectors: any[]): void {
    if (!sectors || sectors.length === 0) return;
    const db = getSqliteDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO sector_rotation
      (sector_name, symbol, momentum_3m, earnings_trend, cycle_phase, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    db.exec("BEGIN TRANSACTION;");
    try {
      for (const s of sectors) {
        stmt.run(
          s.sectorName || s.name || s.sector,
          s.symbol,
          s.momentum3m ?? s.momentum_3m ?? 0,
          s.earningsTrend ?? s.earnings_trend ?? "Neutral",
          s.cyclePhase ?? s.cycle_phase ?? "Mid-Cycle Expansion",
          Date.now()
        );
      }
      db.exec("COMMIT;");
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }
  },

  // ─── FII & DII FLOWS ───────────────────────────────────────────────────────
  getFiiDiiFlows(limit: number = 30): any[] {
    const db = getSqliteDb();
    const stmt = db.prepare(`
      SELECT date, fii_buy, fii_sell, fii_net, dii_buy, dii_sell, dii_net, updated_at
      FROM fii_dii_flows
      ORDER BY date DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  },

  saveFiiDiiFlows(flows: any[]): void {
    if (!flows || flows.length === 0) return;
    const db = getSqliteDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO fii_dii_flows
      (date, fii_buy, fii_sell, fii_net, dii_buy, dii_sell, dii_net, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec("BEGIN TRANSACTION;");
    try {
      for (const f of flows) {
        stmt.run(
          f.date,
          f.fiiBuy ?? f.fii_buy ?? null,
          f.fiiSell ?? f.fii_sell ?? null,
          f.fiiNet ?? f.fii_net ?? null,
          f.diiBuy ?? f.dii_buy ?? null,
          f.diiSell ?? f.dii_sell ?? null,
          f.diiNet ?? f.dii_net ?? null,
          Date.now()
        );
      }
      db.exec("COMMIT;");
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }
  },
};
