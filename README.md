<p align="center">
  <img src="https://img.shields.io/badge/GenAI--Stock-v1.0.0-blueviolet?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Node.js-20-339933?style=for-the-badge&logo=node.js" alt="Node.js" />
</p>

# 🐋 WEALTHY-WHALES (GenAI-Stock)

> **An AI-Powered Indian Stock Market Intelligence Platform** — combining self-learning AI engines, real-time market data, technical/fundamental analysis, and automated trading signals for NSE & BSE markets.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Database Schema](#-database-schema)
- [AI Engines](#-ai-engines)
- [API Reference](#-api-reference)
- [Frontend Pages & Routes](#-frontend-pages--routes)
- [External Data Sources](#-external-data-sources)
- [PineScript Indicator](#-pinescript-indicator)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

---

## 🌟 Overview

**Wealthy-Whales** (internally codenamed *GenAI-Stock*) is a full-stack, AI-driven stock market platform focused on the **Indian equity market** (NSE/BSE). It provides:

- 🤖 **Three self-learning AI engines** (HERMES, FUGU, APEX) that scan, score, and predict stock movements
- 📊 **Real-time market data** via multiple free & premium API integrations
- 🔍 **Technical & fundamental analysis** with 30+ indicators
- 📈 **VCP (Volatility Contraction Pattern)** detection with Mark Minervini-style scoring
- 🧠 **Gemini AI-powered chat** for conversational stock research
- 📰 **Automated news sentiment analysis** with RSS feed processing
- 📓 **Trading journal** with automated outcome tracking
- 🔔 **Telegram alerts** for real-time notifications

---

## 🚀 Key Features

### AI Trading Engines
| Engine | Focus | Timeframe | Key Capability |
|--------|-------|-----------|----------------|
| **HERMES** | Swing trading & positional | 5–20 day holds | Self-learning weights, StockIQ scoring, market regime detection |
| **FUGU** | Multi-factor scoring | 5–90 day holds | 7-factor scoring (technical, pattern, candlestick, fundamental, sector, macro, similarity) |
| **APEX** | Intraday predictions | Same-day | 30-feature model, pre-market predictions, EOD outcome tracking |

### Market Analysis Tools
- **Smart Screener** — Advanced stock screener with multi-criteria filtering
- **Swing Scanner** — Automated VCP pattern detection across NSE universe
- **IPO Base Scanner** — Tracks newly listed IPOs forming bases
- **Chart Pattern Recognition** — Detects 15+ classic chart patterns
- **Sector Scope** — Real-time sector rotation & heatmap analysis
- **FII/DII Tracker** — Foreign & domestic institutional flow tracking
- **Index Mover** — Identifies stocks driving index movement
- **Option Clock & Option Apex** — Options analytics with PCR, OI analysis, max pain

### User Features
- **AI Chat (Ask AI)** — Conversational stock research powered by Google Gemini
- **Watchlist** — Personalized stock watchlists
- **Trading Journal** — Auto-populated VCP journal with P&L tracking
- **AI Research Reports** — Comprehensive AI-generated stock reports
- **Events Calendar** — Market events, earnings, and economic data
- **Insider Strategy** — Insider trading pattern analysis
- **Notification Settings** — Telegram integration for alerts
- **Google OAuth Login** — Secure authentication

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENT (React SPA)                       │
│  Vite + React 18 + TailwindCSS + Radix UI + Recharts + Wouter   │
├──────────────────────────────────────────────────────────────────┤
│                        EXPRESS SERVER                             │
│  routes.ts (120+ API endpoints) + WebSocket + Session Auth        │
├──────────────┬───────────────┬────────────────┬──────────────────┤
│  HERMES AI   │   FUGU AI     │   APEX AI      │  Gemini Chat     │
│  Engine      │   Engine      │   Engine       │  Engine          │
│  + Scheduler │   + Scheduler │   + Scheduler  │                  │
├──────────────┴───────────────┴────────────────┴──────────────────┤
│                     DATA LAYER                                    │
│  Drizzle ORM + Neon Serverless PostgreSQL + Market Data Cache     │
├──────────────────────────────────────────────────────────────────┤
│                  EXTERNAL SERVICES                                │
│  Yahoo Finance │ Alpha Vantage │ FMP │ Finnhub │ Screener.in      │
│  Google Gemini │ Groq │ OpenRouter │ SEBI RSS │ Telegram Bot API  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| **React 18** | UI framework |
| **TypeScript 5.6** | Type-safe development |
| **Vite 5** | Build tool & dev server |
| **TailwindCSS 3** | Utility-first styling |
| **Radix UI** | Accessible component primitives (20+ components) |
| **Recharts** | Data visualization & charting |
| **Wouter** | Lightweight client-side routing |
| **TanStack Query** | Server state management & caching |
| **Framer Motion** | Animations |
| **next-themes** | Dark/light mode theming |
| **React Hook Form + Zod** | Form management & validation |
| **Lucide React** | Icon library |

### Backend
| Technology | Purpose |
|-----------|---------|
| **Node.js 20** | Runtime |
| **Express 4** | HTTP server |
| **TypeScript** | Type-safe server code |
| **Drizzle ORM** | Database ORM with type safety |
| **Neon Serverless** | PostgreSQL database |
| **Google Gemini AI** | AI chat & analysis |
| **Groq** | Fast AI inference |
| **OpenRouter** | Multi-model AI routing |
| **Passport.js** | Authentication (Google OAuth 2.0) |
| **Cheerio** | Web scraping (Screener.in) |
| **Axios** | HTTP client |
| **ws** | WebSocket server |
| **Memoizee** | Function memoization & caching |
| **express-rate-limit** | API rate limiting |

### Database
| Technology | Purpose |
|-----------|---------|
| **PostgreSQL** (Neon) | Primary database |
| **Drizzle Kit** | Schema migrations |
| **connect-pg-simple** | Session storage |

---

## 📁 Project Structure

```
WEALTHY-WHALES/
├── client/                          # Frontend React application
│   ├── index.html                   # HTML entry point
│   └── src/
│       ├── App.tsx                   # Root component with routing
│       ├── main.tsx                  # React DOM entry
│       ├── index.css                # Global styles & design tokens
│       ├── pages/                   # 30 page components
│       │   ├── Home.tsx             # Dashboard home
│       │   ├── Landing.tsx          # Pre-auth landing page
│       │   ├── CheckStock.tsx       # Individual stock analysis
│       │   ├── SwingScanner.tsx     # VCP swing scanner
│       │   ├── SmartScreener.tsx    # Advanced stock screener
│       │   ├── HermesAI.tsx         # HERMES AI dashboard
│       │   ├── FuguAI.tsx           # FUGU AI dashboard
│       │   ├── ApexAI.tsx           # APEX AI dashboard
│       │   ├── AskAI.tsx            # AI chat interface
│       │   ├── TradingJournal.tsx   # Trade journal
│       │   ├── SectorScope.tsx      # Sector analysis
│       │   ├── ChartPatterns.tsx    # Pattern recognition
│       │   ├── FiiDii.tsx           # Institutional flows
│       │   ├── IndexMover.tsx       # Index contributors
│       │   ├── OptionClock.tsx      # Options analytics
│       │   ├── OptionApex.tsx       # Options AI
│       │   ├── EventsCalendar.tsx   # Market calendar
│       │   ├── InsiderStrategy.tsx  # Insider trading
│       │   ├── ResearchReport.tsx   # AI research reports
│       │   ├── News.tsx             # Financial news feed
│       │   ├── Watchlist.tsx        # User watchlists
│       │   ├── IpoBase.tsx          # IPO base scanner
│       │   ├── AdminPanel.tsx       # Admin management
│       │   ├── NotificationSettings.tsx
│       │   └── ...
│       ├── components/              # Reusable UI components
│       │   ├── ui/                  # Radix-based primitives (ShadcnUI)
│       │   ├── app-sidebar.tsx      # Navigation sidebar
│       │   ├── FundamentalDashboard.tsx  # Detailed fundamental view
│       │   ├── StockAnalysisPanel.tsx    # Technical analysis panel
│       │   ├── StockIQScore.tsx     # StockIQ scoring display
│       │   ├── TradingViewChart.tsx # Chart component
│       │   ├── AnimatedHero.tsx     # Landing page hero
│       │   ├── MarqueeTicker.tsx    # Live market ticker
│       │   └── ...
│       ├── hooks/                   # Custom React hooks
│       │   ├── useAuth.ts           # Authentication hook
│       │   ├── useWatchlist.ts      # Watchlist management
│       │   ├── useViewMode.tsx      # View mode context
│       │   └── use-mobile.tsx       # Responsive detection
│       └── lib/                     # Utilities
│           ├── queryClient.ts       # TanStack Query config
│           ├── authUtils.ts         # Auth helpers
│           └── utils.ts             # General utilities
│
├── server/                          # Backend Express server
│   ├── index.ts                     # Server entry point
│   ├── routes.ts                    # 120+ API route definitions
│   ├── db.ts                        # Database connection
│   ├── storage.ts                   # Data access layer (CRUD)
│   ├── vite.ts                      # Vite dev middleware
│   ├── googleAuth.ts                # Google OAuth setup
│   │
│   ├── # ── AI Engines ──
│   ├── gemini.ts                    # Gemini AI chat & analysis (69KB)
│   ├── hermesEngine.ts             # HERMES scoring engine
│   ├── hermesScheduler.ts          # HERMES cron scheduler
│   ├── fuguEngine.ts               # FUGU multi-factor engine (68KB)
│   ├── fuguScheduler.ts            # FUGU cron scheduler
│   ├── apexEngine.ts               # APEX intraday engine
│   ├── apexFOEngine.ts             # APEX F&O signal engine
│   ├── apexNewsEngine.ts           # APEX news sentiment engine
│   ├── apexLearningEngine.ts       # APEX weight optimization
│   ├── apexOutcomeTracker.ts       # APEX EOD outcome tracking
│   ├── apexScheduler.ts            # APEX cron scheduler
│   │
│   ├── # ── Data & Analysis ──
│   ├── stockApi.ts                  # Multi-source stock data API (37KB)
│   ├── stockiq.ts                   # StockIQ scoring system
│   ├── financialData.ts             # Financial data aggregation
│   ├── patternScanner.ts            # Chart pattern detection
│   ├── smartScreener.ts             # Smart screener logic
│   ├── vcpCore.ts                   # VCP pattern scoring core
│   ├── vcpJournalEngine.ts          # VCP journal automation
│   ├── nseUniverse.ts               # NSE stock universe management
│   ├── istUtils.ts                  # Indian Standard Time utilities
│   ├── jobLedger.ts                 # Background job management
│   ├── chatStore.ts                 # Chat session management
│   ├── researchReportPrompt.ts      # AI report prompt templates
│   │
│   ├── services/                    # External service integrations
│   │   ├── nseService.ts            # NSE data service
│   │   ├── screenerService.ts       # Screener.in scraper
│   │   ├── sebiRssService.ts        # SEBI RSS feed parser
│   │   ├── currencyService.ts       # Currency exchange rates
│   │   ├── telegramService.ts       # Telegram bot notifications
│   │   └── nse_worker.py            # Python NSE data worker
│   │
│   ├── companyNameMap.json          # Symbol-to-name mapping (113KB)
│   └── fo_stock_list.json           # F&O eligible stock list
│
├── shared/                          # Shared types & schema
│   ├── schema.ts                    # Drizzle DB schema (695 lines, 30+ tables)
│   └── types.ts                     # Shared TypeScript types
│
├── migrations/                      # Drizzle database migrations
│   └── 0000_mighty_harpoon.sql      # Initial migration
│
├── pinescript/                       # TradingView indicators
│   └── my_indicator.pine            # Custom PineScript indicator
│
├── # ── Configuration ──
├── package.json                     # Dependencies & scripts
├── tsconfig.json                    # TypeScript configuration
├── vite.config.ts                   # Vite build configuration
├── drizzle.config.ts                # Drizzle ORM configuration
├── tailwind.config.ts               # TailwindCSS configuration
├── postcss.config.js                # PostCSS configuration
├── components.json                  # ShadcnUI component config
├── .env                             # Environment variables (git-ignored)
├── .gitignore                       # Git ignore rules
└── start-dev.ps1                    # Windows dev startup script
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 20.x
- **npm** ≥ 9.x
- **PostgreSQL** database (Neon recommended)
- **Git**

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/nileshrajput203/WEALTHY-WHALES.git
cd WEALTHY-WHALES

# 2. Install dependencies
npm install

# 3. Configure environment variables
# Create a .env file in the root directory (see Environment Variables section)

# 4. Push database schema
npm run db:push

# 5. Start development server
npm run dev
```

The app will be available at **http://localhost:5000**

### Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start development server with hot reload |
| `build` | `npm run build` | Build production bundle (client + server) |
| `start` | `npm start` | Run production server |
| `check` | `npm run check` | TypeScript type checking |
| `db:push` | `npm run db:push` | Push schema changes to database |

---

## 🔐 Environment Variables

Create a `.env` file in the project root:

```env
# ── Database ──
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"

# ── Authentication ──
SESSION_SECRET="your-secure-session-secret"
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"

# ── AI Services ──
GEMINI_API_KEY="your-google-gemini-api-key"
GROQ_API_KEY="your-groq-api-key"
OPENROUTER_API_KEY="your-openrouter-api-key"

# ── Market Data APIs ──
ALPHA_VANTAGE_API_KEY="your-alpha-vantage-key"
IEX_CLOUD_API_KEY="your-iex-cloud-key"
FMP_API_KEY="your-fmp-api-key"
FINNHUB_API_KEY="your-finnhub-api-key"

# ── App Config ──
NODE_ENV="development"
PORT=5000
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (Neon serverless recommended) |
| `SESSION_SECRET` | ✅ | Secret key for session encryption |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key for AI chat & analysis |
| `GOOGLE_CLIENT_ID` | ⚡ | Google OAuth client ID (for authentication) |
| `GOOGLE_CLIENT_SECRET` | ⚡ | Google OAuth client secret |
| `GROQ_API_KEY` | ⚡ | Groq API key for fast AI inference |
| `OPENROUTER_API_KEY` | ⚡ | OpenRouter key for multi-model AI |
| `ALPHA_VANTAGE_API_KEY` | ❌ | Alpha Vantage for technical indicators |
| `IEX_CLOUD_API_KEY` | ❌ | IEX Cloud for real-time data |
| `FMP_API_KEY` | ❌ | Financial Modeling Prep for fundamentals |
| `FINNHUB_API_KEY` | ❌ | Finnhub for market news & data |

> ✅ = Required  |  ⚡ = Recommended  |  ❌ = Optional (fallback to Yahoo Finance)

---

## 🗄 Database Schema

The application uses **30+ PostgreSQL tables** managed via Drizzle ORM. Below are the key table groups:

### Core Tables
| Table | Description |
|-------|-------------|
| `users` | User accounts (Google OAuth, admin flags) |
| `sessions` | Express session storage |
| `stock_recommendations` | Admin-posted stock picks (BUY/SELL/HOLD) |
| `chat_messages` | AI chat conversation history |
| `scanner_data` | Swing scanner & IPO base results |
| `news_items` | Aggregated financial news |
| `screener_cache` | Cached screener.in fundamental data |
| `market_data_cache` | General market data cache |

### HERMES AI Tables
| Table | Description |
|-------|-------------|
| `hermes_snapshots` | Daily stock snapshots with 30+ indicators |
| `hermes_outcomes` | Forward return tracking (5/10/20 day) |
| `hermes_weights` | Versioned scoring weight vectors |
| `hermes_regime_log` | Market regime classification history |

### FUGU AI Tables
| Table | Description |
|-------|-------------|
| `fugu_snapshots` | Multi-factor stock snapshots |
| `fugu_outcomes` | Forward return tracking (5–90 day) |
| `fugu_factor_weights` | Versioned factor weight configurations |
| `fugu_pattern_stats` | Chart pattern success statistics |
| `fugu_candlestick_stats` | Candlestick pattern success rates |
| `fugu_sector_stats` | Sector performance statistics |
| `fugu_regime_stats` | Market regime win rates |
| `fugu_learning_memory` | AI learning insights log |
| `fugu_elite_picks` | Top-ranked stock picks |

### APEX AI Tables
| Table | Description |
|-------|-------------|
| `apex_predictions` | Daily intraday predictions with outcomes |
| `apex_news_signals` | News-mapped sentiment signals |
| `apex_fo_signals` | F&O option chain signals (PCR, OI, max pain) |
| `apex_weights` | Versioned 30-feature weight vectors |

### System Tables
| Table | Description |
|-------|-------------|
| `signal_log` | Historical signal outcome tracking |
| `job_ledger` | Background job scheduler state |
| `job_error_log` | Structured error logging |
| `vcp_alerts` | User VCP score alert subscriptions |
| `vcp_journal_entries` | Auto-populated trading journal |

---

## 🤖 AI Engines

### 🔱 HERMES — Self-Learning Swing Trading Engine

HERMES is a **self-learning stock intelligence system** that continuously improves its scoring model based on historical outcome data.

**How It Works:**
1. **Daily Scan** — Scans the NSE universe, computing 30+ indicators per stock
2. **Score** — Applies learned weights to produce a `hermesScore` (0–100) and verdict (BUY/HOLD/AVOID)
3. **Track** — Records forward returns at 5, 10, and 20 days
4. **Learn** — Periodically retrains weights based on outcome data (gradient descent on win/loss patterns)
5. **Regime Detection** — Classifies market as TRENDING_UP / TRENDING_DOWN / RANGING / VOLATILE

**Key Files:**
- `server/hermesEngine.ts` — Core scoring & scanning logic
- `server/hermesScheduler.ts` — Automated daily scan scheduler
- `server/vcpCore.ts` — VCP pattern feature extraction

---

### 🐡 FUGU — Multi-Factor Intelligence Engine

FUGU is a **7-factor scoring engine** that combines technical, fundamental, pattern, and macro signals with similarity-based learning.

**Seven Scoring Factors:**
1. **Technical Score** — RSI, MACD, ADX, EMA alignment, volume
2. **Pattern Score** — Chart pattern detection (VCP, cup & handle, etc.)
3. **Pattern Confidence** — Historical success rate of detected pattern
4. **Candlestick Score** — Candlestick pattern recognition
5. **Fundamental Score** — PE, ROE, debt-to-equity, OPM, ROCE
6. **Sector Score** — Sector momentum & relative strength
7. **Macro Score** — Market regime & breadth alignment

**Key Files:**
- `server/fuguEngine.ts` — Core 7-factor scoring engine (68KB)
- `server/fuguScheduler.ts` — Automated scheduling
- `server/patternScanner.ts` — Chart pattern detection

---

### ⚡ APEX — Intraday Prediction Engine

APEX is a **30-feature intraday prediction system** that forecasts same-day stock direction before market open.

**Pipeline:**
1. **Pre-Market** (8:30 AM IST) — Collect gap data, overnight news, F&O signals
2. **Prediction** — Generate UP/DOWN predictions with confidence scores
3. **EOD Tracking** — Compare predictions vs actual returns
4. **Learning** — Retrain weights based on prediction accuracy

**Signal Sources:**
- Momentum & technical indicators
- Pre-market gap analysis
- News sentiment (via RSS + Gemini AI)
- F&O data (PCR, OI changes, max pain)
- Sector rotation signals

**Key Files:**
- `server/apexEngine.ts` — Core prediction engine
- `server/apexFOEngine.ts` — F&O signal processing
- `server/apexNewsEngine.ts` — News sentiment analysis
- `server/apexLearningEngine.ts` — Weight optimization
- `server/apexOutcomeTracker.ts` — EOD outcome tracking
- `server/apexScheduler.ts` — Time-based scheduling

---

### 🚀 Self-Improving AI Engine Upgrades

We have upgraded the core AI engines (HERMES, FUGU, and APEX) to be fully **self-improving** and **context-aware**. 

1. **Adaptive Learning Rate (EMA schedules)**: Replaced hardcoded weights blending with dynamic EMA schedules based on data maturity. Scarcely trained models learn aggressively; mature models fine-tune conservatively.
2. **Temporal Decay**: Applied exponential decay (60-day half-life for swing/weekly scans, 15-day half-life for intraday predictions) so that recent market outcomes carry 2-4x more weight than older historical data.
3. **A/B weight validation (Shadow Scoring)**: Weights are not promoted unless they pass an automated backtest on the last 50 completed outcomes. Keeps the model from degrading during volatile transitions.
4. **Feature Pruning**: Features showing directional accuracy $< 45\%$ for three consecutive cycles are soft-pruned (set to $0.001$), preventing noise from diluting performance.
5. **Adaptive Thresholds**: WIN/LOSS thresholds dynamically adapt using P75 and P25 return percentiles of completed outcomes.
6. **Regime-Adaptive Weight Sets**: The system stores and loads independent weight versions per market regime (`TRENDING_UP`, `TRENDING_DOWN`, `RANGING`, `VOLATILE`). Weights are optimized contextually.
7. **Cross-Engine Confluence**: Created a new `confluenceEngine.ts` that aggregates signals across HERMES, FUGU, and APEX. Grants confluence bonuses for agreement and flags engine conflicts.
8. **Confidence Calibration Curves**: Rebuilds score calibration curves to translate raw model scores into statistically accurate confidence metrics.

**Key Files Added:**
- `server/confluenceEngine.ts` — Unified cross-engine confluence scoring
- `server/istUtils.ts` — Shared mathematical self-improvement utilities

---

### 💬 Gemini AI Chat

The platform integrates **Google Gemini** for conversational stock research, providing:
- Real-time stock analysis conversations
- Context-aware responses using live market data
- AI-generated research reports
- Stock comparison and recommendation reasoning

**Key File:** `server/gemini.ts` (69KB — comprehensive prompt engineering)

---

## 📡 API Reference

The server exposes **120+ REST API endpoints**. Below are the key categories:

### Stock Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/recommendations` | Get stock recommendations with live data |
| `GET` | `/api/stock/:symbol` | Get specific stock quote |
| `GET` | `/api/search/stocks?q=` | Search stocks by name/symbol |
| `GET` | `/api/stock/:symbol/fundamentals` | Detailed fundamental data |
| `GET` | `/api/stock/:symbol/technicals` | Technical indicators |

### Market Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/indices` | Market indices (NIFTY, SENSEX, etc.) |
| `GET` | `/api/market/summary` | Full market overview |
| `GET` | `/api/fii-dii` | FII/DII institutional flows |
| `GET` | `/api/sector-performance` | Sector-wise performance |

### AI Engines
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/hermes/snapshots` | HERMES latest scan results |
| `GET` | `/api/hermes/weights` | Active HERMES weight vector |
| `GET` | `/api/fugu/elite-picks` | FUGU top-ranked picks |
| `GET` | `/api/fugu/snapshots` | FUGU latest scan results |
| `GET` | `/api/apex/predictions` | Today's APEX predictions |
| `GET` | `/api/apex/accuracy` | APEX historical accuracy |
| `POST` | `/api/hermes/scan` | Trigger manual HERMES scan |
| `POST` | `/api/fugu/scan` | Trigger manual FUGU scan |

### AI Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Send message to AI assistant |
| `GET` | `/api/chat/history/:sessionId` | Get chat history |

### Scanners
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/swing-scanner` | VCP swing scan results |
| `GET` | `/api/ipo-base` | IPO base scanner results |
| `GET` | `/api/smart-screener` | Smart screener results |
| `GET` | `/api/chart-patterns` | Detected chart patterns |

### User Features
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/watchlist` | User's watchlist |
| `POST` | `/api/watchlist` | Add stock to watchlist |
| `GET` | `/api/trading-journal` | Trading journal entries |
| `GET` | `/api/news` | Financial news feed |

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/google` | Initiate Google OAuth |
| `GET` | `/api/auth/google/callback` | OAuth callback |
| `GET` | `/api/auth/user` | Get current user |
| `GET` | `/api/logout` | Logout |

> For complete API documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

---

## 🖥 Frontend Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing / Home | Landing page (unauthenticated) or Dashboard (authenticated) |
| `/check-stock` | Check Stock | Detailed individual stock analysis |
| `/stock/:symbol` | Stock Detail | Symbol-specific analysis view |
| `/swing-scanner` | Swing Scanner | VCP pattern scanner with scoring |
| `/ipo-base` | IPO Base | IPO base formation scanner |
| `/smart-screener` | Smart Screener | Multi-criteria stock screener |
| `/chart-patterns` | Chart Patterns | Pattern recognition dashboard |
| `/hermes` | HERMES AI | HERMES engine dashboard & picks |
| `/fugu` | FUGU AI | FUGU engine dashboard & picks |
| `/apex` | APEX AI | APEX intraday predictions |
| `/hermes-fugu` | AI Confluence | Combined HERMES + FUGU view |
| `/ai-confluence` | AI Confluence | Cross-engine signal confluence |
| `/ask-ai` | Ask AI | Conversational AI chat |
| `/stock/:symbol/report` | Research Report | AI-generated stock report |
| `/sector-scope` | Sector Scope | Sector analysis & heatmap |
| `/fii-dii` | FII/DII | Institutional flow tracker |
| `/index-mover` | Index Mover | Index contribution analysis |
| `/option-clock` | Option Clock | Options analytics dashboard |
| `/option-apex` | Option Apex | Options AI predictions |
| `/trading-journal` | Trading Journal | Auto-populated trade log |
| `/watchlist` | Watchlist | Personal stock watchlist |
| `/news` | News | Financial news aggregator |
| `/events-calendar` | Events Calendar | Market events & earnings |
| `/insider-strategy` | Insider Strategy | Insider trading analysis |
| `/settings/notifications` | Notifications | Telegram notification settings |
| `/admin` | Admin Panel | Admin management (admin-only) |
| `/community` | Community | User community features |

---

## 🌐 External Data Sources

### Market Data APIs
| Source | API Key Required | Free Tier Limits | Data Provided |
|--------|:---:|-----------|---------------|
| **Yahoo Finance** | ❌ No | Unlimited (respectful use) | Real-time quotes, indices, news |
| **Alpha Vantage** | ✅ Yes | 5 calls/min, 500/day | Technical indicators, fundamentals |
| **IEX Cloud** | ✅ Yes | 500K calls/month | Real-time data, company info |
| **Financial Modeling Prep** | ✅ Yes | 250 calls/day | Financial statements, market data |
| **Finnhub** | ✅ Yes | 60 calls/min | Market news, company data |
| **Screener.in** | ❌ No | Web scraping | Indian stock fundamentals |
| **SEBI RSS** | ❌ No | Public RSS | Regulatory filings & announcements |
| **NSE India** | ❌ No | Web scraping | Index data, F&O data |

### AI Services
| Service | Purpose |
|---------|---------|
| **Google Gemini** | Primary AI for chat, analysis, reports |
| **Groq** | Fast inference for time-critical analysis |
| **OpenRouter** | Multi-model routing for diverse AI tasks |

### Fallback Strategy
```
Primary → Yahoo Finance (no key required)
Secondary → Alpha Vantage (if key provided)
Tertiary → Mock data (always available)
```

---

## 📊 PineScript Indicator

A custom **TradingView PineScript indicator** is included at `pinescript/my_indicator.pine`. This provides a visual overlay for the technical signals used by the platform's scanning engines.

---

## 🚢 Deployment

### Production Build

```bash
# Build client + server
npm run build

# Start production server
npm start
```

### Environment Setup for Production

```env
DATABASE_URL="your-production-database-url"
SESSION_SECRET="cryptographically-secure-random-string"
NODE_ENV="production"
PORT=5000
# ... all other API keys
```

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Use a strong, random `SESSION_SECRET`
- [ ] Configure production `DATABASE_URL`
- [ ] Set all API keys
- [ ] Enable SSL/TLS
- [ ] Configure Google OAuth redirect URIs for production domain
- [ ] Consider Redis for session storage at scale
- [ ] Set up monitoring for API rate limits

---

## 🔧 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| **`DATABASE_URL` not set** | Create `.env` file with your PostgreSQL connection string |
| **Schema push fails** | Run `npm run db:push` — ensure database is accessible |
| **Empty stock data** | Yahoo Finance may be throttled; wait and retry |
| **Google login fails** | Verify `GOOGLE_CLIENT_ID` and callback URL configuration |
| **AI chat not responding** | Check `GEMINI_API_KEY` is valid |
| **Build errors** | Run `npm run check` to identify TypeScript issues |
| **Port already in use** | Change `PORT` in `.env` or kill existing process |

### Debug Logging

API requests are automatically logged with timestamps and duration:
```
GET /api/recommendations 200 in 342ms
POST /api/chat 200 in 1205ms
```

---

## 📄 License

This project is licensed under the **MIT License**.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/nileshrajput203">nileshrajput203</a>
</p>
