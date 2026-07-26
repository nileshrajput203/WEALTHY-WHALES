# Wealthy Whales Project Overhaul Research & Gaps

## 1. UI/UX Perfection Goals
- **Mobile First:** Responsive charts, bottom navigation, card-based layouts for news/events.
- **Precision Typography:** Use Inter/Geist/JetBrains Mono for financial data.
- **Micro-interactions:** Framer Motion for smooth transitions between scanner modes.
- **Glassmorphism:** Consistent dark theme with primary emerald/violet accents.

## 2. Advanced Features
- **Watchlist Persistence:** Move from `localStorage` to PostgreSQL `watchlist` table.
- **News Integration:** Map RSS news to watchlist symbols with sentiment analysis.
- **Event Calendar:** Real-time earnings/dividends/AGM tracking for watchlist stocks.
- **Probability Scoring:** Add Bayesian or heuristic confidence levels to chart patterns.

## 3. F&O Scalp Engine (98% Accuracy Target)
- **Catalysts:** Earnings beat, order wins, management changes.
- **F&O Data:** PCR, OI buildup, Max Pain distance.
- **Pattern Confluence:** VCP + Flag/Pole + RSI Divergence.
- **Accuracy:** Requires strict confluence of technicals, news, and F&O signals.

## 4. Current Gaps Identified
- **Watchlist:** Purely local storage, no server integration.
- **APEX Engine:** Many features are stubs (rsi_divergence, macd_histogram, etc.).
- **Events:** `generateEventsForSymbol` is a stub returning `[]`.
- **Patterns:** No probability/confidence scoring.
- **F&O:** Scalp engine needs to be built on top of `apexEngine.ts` with higher precision.
