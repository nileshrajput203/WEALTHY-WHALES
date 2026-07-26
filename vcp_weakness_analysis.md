# VCP Screener Weakness Analysis

## Current Implementation vs. Minervini Elite Criteria

| Feature | Current Logic (VCP1) | Minervini Elite / Rocket Base | Gap / Weakness |
| :--- | :--- | :--- | :--- |
| **Trend Template** | EMA 50 > 150 > 200 | Same + 200d EMA must be trending up for 1 month | Current logic doesn't verify the *slope* of the 200d EMA over time. |
| **Relative Strength** | 6-month performance % | IBD-style RS Rating > 70-90 | Current RS is a simple price change; needs benchmark comparison (e.g., vs Nifty 50). |
| **52W High Proximity** | Within 15% of high | Within 2-5% for "Rocket Base" / Cheat | 15% is too loose for a "ready-to-pop" breakout. |
| **52W Low Distance** | Range Quality > 1.2 (20%) | At least 30-100% above 52w low | Needs to ensure the stock has already "left the station" (Stage 2). |
| **Contraction Logic** | ATR(5d) < ATR(10d) | 2-4 distinct contractions (T's) | Current logic is binary and doesn't count "T's" (e.g., 10% -> 5% -> 2%). |
| **Tightness (Coil)** | ATR/Price < 6% | ATR/Price < 2-3% (for Rocket Base) | 6% is standard; "Rocket" requires extreme tightness. |
| **Volume Dry-up** | Today Vol < 85% of 20d Avg | Multiple days of declining volume | Needs "Volume Dry Up" (VDU) - extremely low volume on the right side. |
| **Pivot Point** | Last Price | High of the tightest contraction | Needs a specific "Pivot" level to trigger the 10% return target. |

## Proposed "Rocket Base" (VCP Hyper) Requirements
1. **The Move:** Prior 30%+ move in < 3 months (Power Play).
2. **The Base:** Tighter than standard VCP (e.g., 3-5% max depth in the final contraction).
3. **The Volume:** At least 1-2 days of "ghost town" volume (VDU) before the breakout.
4. **The Trigger:** Breakout above the "Cheat" or "Pivot" level with 2x-3x volume.
5. **The Return:** 10%+ expected within 3-5 days.
