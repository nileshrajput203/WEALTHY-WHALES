---
name: Gemini token reduction patterns
description: How token usage is minimised in gemini.ts; patterns that must be maintained on future edits
---

## Rules applied

- `CACHE_TTL = 60 * 60 * 1000` (1 hour default). SHORT = 15 min (volatile data). LONG = 4 h (sector rotation, concall summaries).
- `getCached<T>(key, ttl?)` — ttl defaults to CACHE_TTL; pass CACHE_TTL_SHORT or CACHE_TTL_LONG as second arg.
- `setCached(key, data, _ttl?)` — third arg is ignored at runtime (expiry is controlled by getCached's ttl), but it documents intent.
- `toPromptJSON(obj, maxKeys?)` — use this instead of `JSON.stringify(x, null, 2)` for ALL prompt injections. Strips null/undefined/empty, optional key cap.
- `maxOutputTokens` in `generateWithRetry`'s REST config: 4096 (was 8192).
- All `thinkingBudget` configs removed — they add cost on Gemini Flash without measurable benefit.
- News arrays sliced to ≤5 items before prompt injection.

**Why:** Free-tier Gemini has 20 RPM and daily limits. Prompt compression + longer caching reduce calls by ~60%.

**How to apply:** Any new Gemini function must: use getCached with appropriate TTL, use toPromptJSON for object injection, slice news to ≤5, and avoid thinkingBudget config.
