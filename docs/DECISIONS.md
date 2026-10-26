# WEALTHY WHALES — ARCHITECTURAL DECISIONS LOG (`docs/DECISIONS.md`)

This document records all architectural choices, free-tier replacements, model licenses, and trade-offs.

---

## DECISION 001: Sole Package Manager Standardization
- **Decision**: Standardize exclusively on `npm` as the package manager for the Node.js application.
- **Context**: The repository had dual lockfiles (`package-lock.json` and `pnpm-lock.yaml`).
- **Rationale**: `package.json` scripts (`npm run check`, `npm run build`, `npm run dev`) natively rely on standard npm resolution. Consolidating eliminates dependency divergence.
- **Action**: Removed `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and `package-lock.json.backup`.

---

## DECISION 002: 100% Free Zero-Paid-API Data Strategy
- **Decision**: Remove all hard dependencies on paid market data APIs (`IEX_CLOUD`, paid tiers of `FMP` or `Alpha Vantage`).
- **Context**: The platform must operate with $0 ongoing API overhead.
- **Free Replacements**:
  - Daily & Intraday historical OHLCV: `yfinance` (`.NS` / `.BO` tickers) + local DuckDB Parquet storage.
  - Live NSE Quotes & Option Chain: Direct reverse-engineered NSE session cookies, `nselib`, and `jugaad-data` / `aynse`.
  - Live Stock Scans: Reverse-engineered Chartink CSRF token query processor + local DuckDB fallback.
  - Financial Fundamentals: Screener.in web scraper + Yahoo Finance balance sheets.
  - Financial News & Macro: Free Indian financial RSS feeds (ET, Moneycontrol, Mint, Business Standard, SEBI, PIB).
- **Honesty Guardrail**: When upstream endpoints are unavailable or delayed, the UI explicitly renders a "Delayed (~15m) / Best-Effort" status badge. Silent generation of synthetic "mock" data disguised as real market ticks is forbidden.

---

## DECISION 003: Model Licenses & Foundation Time-Series Architecture
- **Decision**: Deploy only permissively licensed, free open-weight models that run efficiently on local CPU / free infrastructure:
  1. **Kronos** (`NeoQuasar/Kronos-*` / `shiyu-coder/Kronos`): **MIT License**. Tsinghua University's K-line foundation transformer trained directly on candlestick microstructure.
  2. **Chronos-2 / Chronos-Bolt** (`amazon/chronos-bolt-tiny` / `amazon/chronos-2`): **Apache 2.0 License**. Zero-shot probabilistic quantile forecaster.
  3. **FinBERT / Qwen3**: **Apache 2.0 / Permissive**. Fast CPU-friendly sentiment and financial entity extraction.
  4. **Prohibition**: Google's `TimesFM-3` weights carry research/non-commercial restrictions and are strictly excluded from the production engine.

---

## DECISION 004: TradingView Lightweight Charts v5
- **Decision**: Adopt official **TradingView Lightweight Charts v5** (Apache-2.0, lightweight ~35KB) for all interactive charting.
- **Context**: TradingView Advanced Charts / Trading Platform requires proprietary commercial agreements.
- **Solution**: Build custom indicators, drawing tools, multi-timeframe synchronization, and bar replay natively on top of Lightweight Charts v5 primitives and plugins.

---

## DECISION 005: Parquet + DuckDB Local Columnar Analytics
- **Decision**: Augment PostgreSQL with local Parquet files queried via DuckDB for bulk historical OHLCV, 10-year seasonality matrices, and high-speed multi-criteria stock screening.
- **Rationale**: Running complex 2,000-stock screener calculations across 10 years of daily bars is 50x faster in DuckDB columnar format than PostgreSQL row queries, and costs $0 in cloud database storage.
