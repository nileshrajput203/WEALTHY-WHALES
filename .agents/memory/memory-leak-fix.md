---
name: Memory leak fix in server/index.ts
description: The res.json body interceptor was removed to prevent GC pressure from large API responses
---

The original `server/index.ts` intercepted every `res.json()` call by replacing the method, storing the full response body in `capturedJsonResponse` until the request finished. This caused memory pressure for large payloads (candlestick history, scanner results, etc.).

**Fix:** Removed the body capture entirely. The logger now only records `METHOD PATH STATUS DURATIONms`.

**Why:** Storing full response bodies for every concurrent request causes GC pauses and OOM risk at scale.

**How to apply:** Never add `res.json` monkey-patching back. If response body logging is needed, use streaming logger middleware (e.g. Morgan or Pino) that does NOT buffer bodies.
