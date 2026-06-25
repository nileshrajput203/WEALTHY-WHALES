---
name: SSE heartbeat pattern
description: Keep-alive pattern for the research-report SSE streaming endpoint
---

The `GET /api/research-report/:symbol` endpoint uses SSE. A heartbeat interval sends an SSE comment (`:\n\n`) every 15 seconds to keep the connection alive through proxies.

Pattern:
```ts
const heartbeat = setInterval(() => {
  try { res.write(':\n\n'); } catch { clearInterval(heartbeat); }
}, 15_000);
// ... do work ...
clearInterval(heartbeat); // before res.end()
```

**Why:** Proxies and load balancers drop idle connections after 30-60s; without a heartbeat the report generation (which takes ~20-40s) would silently fail mid-stream.
