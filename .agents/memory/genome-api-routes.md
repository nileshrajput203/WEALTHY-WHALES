---
name: Genome API routes
description: New unified genome endpoints added to routes.ts; EngineId validation pattern
---

## Routes added (server/routes.ts)

- GET /api/genome/status — returns {swing, ipo, all} genome status
- GET /api/genome/:engine/history?limit=N — evolution history, limit capped at 100
- POST /api/genome/:engine/evolve — REQUIRES AUTH (req.user check), manual trigger
- GET /api/news/impact/:symbol — analyzeNewsImpact()

## EngineId validation pattern

```typescript
const VALID_ENGINE_IDS: EngineId[] = ["HERMES", "SWING", "APEX", "IPO", "FUGU"];
function parseEngineId(raw: string): EngineId | null {
  const upper = raw.toUpperCase() as EngineId;
  return VALID_ENGINE_IDS.includes(upper) ? upper : null;
}
```

Always use parseEngineId() before passing to selfImprovingCore functions. Return 400 on null.

**Why:** EngineId is a TypeScript-only type; without runtime allowlist check, any string passes through as-is and causes runtime errors.

## Genome scheduler wiring (hermesScheduler.ts)

- Swing genome evolution: 19:00 IST, shouldRunJob("swing_genome_evolution", 720)
- IPO genome evolution: 19:15 IST, shouldRunJob("ipo_genome_evolution", 720)
- FUGU and APEX genome evolution already wired in their respective learning cycles
