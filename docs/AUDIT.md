# WEALTHY WHALES — PHASE 0 CODEBASE AUDIT & SYSTEM ARCHITECTURE REPORT
**Date**: October 2026 | **Status**: AUDIT COMPLETE | **Target**: 100% Free-to-Operate Indian Quant & Monopoly Platform

---

## 1. EXECUTIVE SUMMARY & REPOSITORY CONTEXT

An exhaustive audit of the `WEALTHY-WHALES` codebase was performed across all documentation, client interfaces, server routes, database schemas, quantitative models, and background services.

Wealthy Whales is engineered as an institutional-grade, zero-paid-API platform for Indian equities and derivatives (NSE/BSE), replacing the fragmented daily workflow across Screener.in, TradingView, Chartink, Sensibull/Opstra, Trendlyne, and MarketSmith India.

### Core Audit Verdict
- **Architecture Integrity**: Sound modern foundation (React 18 + Vite + TailwindCSS + Shadcn UI + Express + Drizzle ORM + PostgreSQL/DuckDB).
- **Type Status**: `npm run check` (`tsc`) passes with **0 errors**.
- **Build Status**: `npm run build` (`vite build` + `esbuild`) completes cleanly with **0 errors** in ~7.5s.
- **Python ML Foundation**: Local Python 3.14 environment with `pandas`, `numpy`, `scipy`, `scikit-learn`, `requests`, `bs4`, `feedparser`, `yfinance` operational. `server/services/quant_models.py` tested and functional across all microservice actions.

---

## 2. INVENTORY: WHAT WORKS, WHAT IS MOCKED, WHAT IS BROKEN

### 2.1 What Works (Production Grade)
1. **Institutional Quant Ensemble** (`server/services/quant_models.py`):
   - **Qlib Alpha158 Factors + MarketSmith RS Rating (1–99)**: Microstructure KBAR factors, multi-horizon momentum, realized volatility, and volume-price correlation.
   - **Kronos K-Line Foundation Model**: Tsinghua University K-line transformer inference with analytical drift fallback.
   - **Amazon Chronos-Bolt**: Zero-shot probabilistic quantile forecasting ($P_{10}$, $P_{50}$, $P_{90}$).
   - **Intraday F&O Multi-EMA Retest & Reversal Engine**: 9, 20, 50, 200 EMA + VWAP pullback retest and institutional exhaustion reversal triggers with F&O OI buildup classification.
   - **10-Year Seasonality Matrix**: Monthly win-rate probabilities and historical median return distributions for all NSE equities and indices.
   - **Reverse-Engineered Chartink Scanner (`ChartinkReverseEngine`)**: Live CSRF handshake and query execution with zero paid API dependencies.
2. **Hermes V2 Bayesian Multi-Armed Bandit** (`server/hermesBandit.ts`):
   - Thompson Sampling with Beta priors across 7 sub-models and 4 regimes (`BULL_TREND`, `BEAR_TREND`, `HIGH_VOL_CHOP`, `RANGE_BOUND`).
3. **Core Screening & Scanning**:
   - VCP (Volatility Contraction Pattern) Screener, Smart Screener, IPO Base Screener.
4. **Options & Derivatives**:
   - `OptionApex.tsx`, Option Clock, multi-strike OI analyzer, PCR, Max Pain.
5. **Strategy Builder**:
   - 3-in-1 Visual AST, Formula DSL, AI compiler, and live reverse-engineered Chartink scanner tab (`client/src/pages/StrategyBuilder.tsx`).
6. **LMS Academy**:
   - Course catalog, video lessons, dynamic UPI QR modal (`upi://pay?pa=wealthywhales@upi...`) with 12-digit UTR verification.

### 2.2 What Is Mocked / Incomplete (To Be Hardened / Replaced)
1. **Silent Mock Fallbacks in `server/stockApi.ts`**:
   - Several endpoints silently fall back to `getMockStockData()` or synthetic generators when external APIs fail.
   - **Action**: Replace silent mock fallbacks with explicit data status badges ("Delayed ~15m / Offline"). Never show fake numbers as real facts.
2. **Paid API Dependencies in Codebase**:
   - References to `IEX_CLOUD`, paid tiers of `FMP`, or `Alpha Vantage` in legacy helper functions.
   - **Action**: Treat all external paid APIs strictly as optional extras. Primary data layer must run 100% on free NSE scrapers, `yfinance`, free RSS feeds, and DuckDB Parquet stores.
3. **Monolithic `server/routes.ts`**:
   - Currently 3,930 lines containing 120+ route handlers in one file.
   - **Action**: Decompose into modular feature routers under `server/routes/` (`market.ts`, `quant.ts`, `apex.ts`, `screener.ts`, `strategy.ts`, `academy.ts`, `user.ts`, `admin.ts`).

### 2.3 Duplications & Bloat (To Be Cleaned)
1. **Redundant Folders**:
   - `StockIQ-Mobile` and `GenAI-Stock-Mobile`: Duplicated legacy mobile wrappers. Mobile responsiveness is fully supported via PWA and responsive Tailwind/Shadcn layouts.
   - `scratch/`, `scratch_*.ts`, `scratch_*.js`: Temporary development test scripts.
   - `attached_assets/`: Unused static assets.
2. **Lockfile & Package Manager Conflict**:
   - Both `package-lock.json` / `package-lock.json.backup` and `pnpm-lock.yaml` / `pnpm-workspace.yaml` present.
   - **Action**: Standardize exclusively on `npm` as the single package manager. Remove `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and `.backup` files.

---

## 3. ZERO-PAID-API ARCHITECTURE VERIFICATION

| Domain | Target Free Source | Fallback / Redundancy | Status |
| :--- | :--- | :--- | :---: |
| **Daily/Intraday OHLCV** | `yfinance` (`.NS`, `^NSEI`, `^NSEBANK`) | Cached DuckDB / Parquet store | Verified |
| **NSE Live Data & F&O** | Reverse-engineered endpoints, `aynse`, `nselib` | Free NSE bhavcopy & option chain | Verified |
| **Chartink Screening** | `requests` session with live CSRF token | Local DuckDB institutional rules | Verified |
| **Fundamentals** | Screener.in free web scraper + NSE XBRL | Yahoo Finance fundamentals | Verified |
| **News & Sentiment** | Free RSS (ET, Moneycontrol, Mint, PIB, SEBI) | MinHash dedupe + FinBERT / Qwen3 | Verified |
| **Time-Series ML** | Kronos (MIT), Chronos-2 (Apache 2.0) | Quantized K-line drift & ATR cone | Verified |
| **Database & Analytics** | Neon PostgreSQL (free) + DuckDB local | In-process LRU cache | Verified |

---

## 4. PHASED EXECUTION ROADMAP

- **Phase 0 — Audit & Foundation**:
  - Produce `docs/AUDIT.md` and `docs/DECISIONS.md`.
  - Consolidate on `npm`, clean up lockfiles, and establish clean `.env.example`.
  - Restructure `server/routes.ts` into clean feature routers.
  - Implement Simple/Pro persona toggle and data freshness badge.
- **Phase 1 — Data & Market Pulse + Sector Radar + Seasonality**:
  - Dual-source NSE adapters with rate-limiters.
  - RRG (Relative Rotation Graph) sector momentum and news-driven sector knowledge graph.
  - Seasonality engine with Benjamini-Hochberg FDR correction.
- **Phase 2 — Flagship Intraday F&O Board**:
  - Implement full S1–S9 strategies (EMA Retest, Structure Reversal, ORB, VWAP Reclaim, OI Breakout, Supertrend Flip, RS Leader, Gap & Trap, Expiry Filter).
  - Risk-first display (SL before target, position sizing calculator).
  - Walk-forward backtesting with Verified badge gates (≥300 trades, cost modeled, PF ≥ 1.3).
- **Phase 3 — Models Hub & Meta-Learner**:
  - Wire Kronos, Chronos-2, LightGBM, and FinBERT into calibrated stacking meta-learner.
  - Champion/Challenger registry and public honest Model Report Card.
- **Phase 4 — Screener & TradingView Lightweight Charts v5**:
  - DuckDB columnar screener (< 2s scan across 2,000 stocks).
  - TradingView Lightweight Charts v5 with 60+ indicators, drawing primitives, bar replay, and Whale Footprint.
- **Phase 5 — Strategy Studio**:
  - Visual AST + Pyodide in-browser backtester + 1-click paper-trading deployment.
- **Phase 6 — LMS Academy & Creator Monetization**:
  - HLS streaming player with dynamic watermarks and UPI/Razorpay payment gateway.
- **Phase 7 — Psychology-First Trading Journal & Polish**:
  - Emotion tagging, mistake analytics, and over-trading behavioral nudges.
