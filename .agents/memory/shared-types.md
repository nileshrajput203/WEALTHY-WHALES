---
name: Shared types location
description: Where StockIQResult/SubScore types live and how client should import them
---

StockIQResult and SubScore are defined in `shared/types.ts` and re-exported from `server/stockiq.ts` via `export type { ... } from "@shared/types"`.

Client files must import from `@shared/types`, never from `../../../server/stockiq`.

**Why:** Direct client→server imports couple frontend to backend file layout and risk Vite bundling server-only code.

**How to apply:** Any new component needing StockIQ types should use `import { type StockIQResult } from "@shared/types"`. The AuthUser type is also in shared/types.ts.
