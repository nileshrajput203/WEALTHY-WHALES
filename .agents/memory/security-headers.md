---
name: Express security headers
description: Security middleware added to server/index.ts; CSP must include TradingView domains
---

## Headers set in server/index.ts middleware

- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera/microphone/geolocation/payment denied
- X-Powered-By: removed
- CSP (production only) — MUST include:
  - script-src: 'unsafe-inline', accounts.google.com, s3.tradingview.com, s.tradingview.com
  - frame-src: s.tradingview.com, www.tradingview.com
  - connect-src: yahoo finance, generativelanguage.googleapis.com, groq, openrouter
- /robots.txt: disallows /api/ and /admin

**Why:** Prevent framing attacks, block scrapers from API routes, hide server fingerprint.

**How to apply:** If new external CDN resources are added (fonts, scripts, iframes), add their origins to the relevant CSP directive.
