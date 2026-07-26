---
name: Rate limiting setup
description: express-rate-limit applied to AI-heavy endpoints to prevent quota exhaustion
---

`express-rate-limit` is installed. Two limiters are defined inside `registerRoutes` in `server/routes.ts`:

- `aiRateLimit`: 10 requests per 15 minutes — applied to `GET /api/research-report/:symbol`
- `chatRateLimit`: 20 requests per 1 minute — applied to `POST /api/chat`

**Why:** Gemini API has quota limits; unprotected endpoints could be spammed causing billing overruns.

**How to apply:** Apply `aiRateLimit` to any new endpoint that calls `generateWithRetry`. Apply `chatRateLimit` or `aiRateLimit` to other LLM-calling endpoints.
