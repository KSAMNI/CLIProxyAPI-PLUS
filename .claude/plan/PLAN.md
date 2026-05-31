# Implementation Plan — CLIProxyAPI-Pro

> **Execution rule: STRICTLY SEQUENTIAL + VERTICAL SLICES.** Do exactly one task at a time, in order.
> First predecessor is `START`; every later task depends on exactly one numbered task.
> Do not start task N+1 until task N's gate is GREEN and `/ccf:ccf-check` has passed.

## Milestones
- Align documentation/spec verification with CI-backed commands.
- Lock API contracts before changing downstream client behavior.
- Lock quota storage/cache contract before touching monitoring derivation.
- Keep frontend pages as composition only.

## Task backlog (in execution order)
| # | Slice | Layers | Gate (tests green) | Depends on | Status |
|---|-------|--------|--------------------|-----------|--------|
| 001 | Align documented build/test commands with CI reality | docs + spec + verification | `python3 scripts/check-doc-commands.py` passes; it verifies workflow paths `customizations-repo/...`, upstream working dirs, and local equivalents | START | todo |
| 002 | Normalize API error/response contracts across usage and inspection flows | backend API + frontend clients | `cd upstream-core && go test ./embeddedusage -run TestServerContract`; `cd upstream && bun test src/services/api/apiContract.test.ts` | 001 | todo |
| 003 | Stabilize quota storage/cache contract | backend SQLite + frontend quota cache | `cd upstream-core && go test ./embeddedusage -run TestQuotaCacheContract`; `cd upstream && bun test src/extensions/quota/sqliteQuotaCache.contract.test.ts` | 002 | todo |
| 004 | Preserve monitoring hook/page composition | frontend hooks + pages | `cd upstream && bun test src/features/monitoring/hooks/useMonitoringData.contract.test.ts`; `python3 scripts/check-monitoring-page-composition.py`; `cd upstream && bun run build` | 003 | todo |

> Status: `todo` / `in-progress` / `in-review` / `done` / `blocked`.
> Per-task detail lives in `task-NNN-*.md`.
