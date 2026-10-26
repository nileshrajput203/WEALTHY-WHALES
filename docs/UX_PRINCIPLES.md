# WEALTHY WHALES — UX & BEHAVIORAL DESIGN PRINCIPLES (`docs/UX_PRINCIPLES.md`)

Our product mission is to build traders who are **disciplined, informed, and psychologically safe**—not hooked, anxious, or reckless. Every screen, component, and interaction must pass this 9-point checklist:

---

## The 9 Mandatory UX Principles

### 1. Clarity Over Density
- At most 5–7 items in any primary list on **Simple Mode**.
- Utilize progressive disclosure: secondary metrics live in slide-over drawers or expandable cards.
- Always accompany quantitative jargon with plain English explanations (e.g. *"Sellers are in control"* displayed alongside *"Bearish EMA Retest"*).

### 2. Risk Before Reward
- **Stop-Loss and Risk-per-Share must ALWAYS be visible BEFORE target prices or R:R multiples.**
- Reward numbers must never be styled larger, bolder, or more prominent than risk numbers.
- A position size calculator linked to the user's onboarding risk threshold (e.g., 1% of capital) must accompany every signal.

### 3. No FOMO Mechanics
- **Zero blinking or pulsing badge animations** that induce panic buying/selling.
- No "Hot Pick!", "Multibagger!", or "Rocket!" emojis or badges.
- No leaderboards of raw P&L that provoke envy or revenge trading.
- Transitions and micro-animations must remain calm (≤ 200ms) and serve solely to explain state change.

### 4. Mandatory Pre-Trade Checklist
When adding a setup to Paper Trading or the Trading Journal, present the mandatory 4-point gate:
1. Is an explicit stop-loss defined and entered?
2. Is position size within my risk-per-trade threshold?
3. Is this setup aligned with the higher timeframe market regime?
4. Are there major corporate earnings or macro events within the next 24 hours?

### 5. Behavioral Circuit Breakers & Nudges (Opt-in)
- Daily loss limit alerts: Notify user when daily paper drawdown exceeds 3%.
- "3 Consecutive Losses" pause prompt: Gently encourage a 10-minute timeout away from the screens.
- Revenge-trade detector: Flag any new trade entered within 15 minutes of a losing exit with larger size.

### 6. Trading Journal with Emotion Tagging
- Every journal entry tracks emotional state at execution: `Calm`, `FOMO`, `Fear`, `Greed`, `Boredom`, `Revenge`.
- Surface actionable mistake analytics (e.g., *"73% of your losses occurred after 14:15 IST or when entering without a stop-loss"*).

### 7. Honest Uncertainty & Scientific Framing
- Explicitly label win rates with sample sizes ($N$) and date ranges (e.g., *"61% win-rate • N=412 trades • 2022–2026"*).
- Include calibration honesty: *"This setup has historically failed ~4 out of 10 times"*.
- **Strictly prohibit** words like *"guaranteed"*, *"sure-shot"*, or *"100% win-rate"*.

### 8. Accessible & Color-Blind-Safe Visual Semantics
- Primary bullish/bearish indicators must pair color with shape/iconography (e.g., green up-chevron / red down-chevron).
- Provide an accessible color-blind mode (Blue / Orange) alongside the classic Red / Green palette.
- Maintain WCAG AA contrast ratios across all dark and light themes.

### 9. Contextual In-Product Education
- Every quantitative widget must include an "i" tooltip and an "Explain this Setup" button providing instant, non-judgmental explanations.
