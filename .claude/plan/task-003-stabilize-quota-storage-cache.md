# Task 003 — Stabilize quota storage/cache contract

- **Vertical slice:** backend SQLite + frontend quota cache
- **Depends on:** 002
- **Spec refs:** `.claude/rules/architecture.md`, `.claude/rules/testing.md`, `.claude/rules/error-handling.md`
- **Implemented by:** ccf-implementer + storage/cache verification
- **Gate (must be GREEN before the next slice):** `cd upstream-core && go test ./embeddedusage -run TestQuotaCacheContract`; `cd upstream && bun test src/extensions/quota/sqliteQuotaCache.contract.test.ts`

## Goal (one sentence)
Keep the backend quota storage contract and frontend cache assumptions aligned.

## Acceptance criteria (verifiable)
- [ ] Backend matrix covers EP rows for valid key, missing provider, missing fileName, malformed key, overwrite, read refresh, and storage error.
- [ ] Backend matrix covers BVA rows for version 0/1/2 and stale/current `accessedAt` transitions.
- [ ] Frontend matrix includes decision rows for cache hit/miss × API success/failure × malformed payload.

## Test first (write before implementing)
- Create `cliproxyapi-pro-core/embeddedusage/quota_cache_contract_test.go` for the SQLite contract matrix.
- Create `cliproxyapi-pro-management/overlay/src/extensions/quota/sqliteQuotaCache.contract.test.ts` for the frontend cache matrix.

## Files to touch
- `cliproxyapi-pro-core/embeddedusage/quota_cache_contract_test.go` — backend quota matrix
- `cliproxyapi-pro-core/embeddedusage/store.go` — quota storage contract
- `cliproxyapi-pro-management/overlay/src/extensions/quota/sqliteQuotaCache.contract.test.ts` — frontend cache matrix
- `cliproxyapi-pro-management/overlay/src/extensions/quota/sqliteQuotaCache.ts` — frontend cache contract
- `cliproxyapi-pro-management/overlay/src/extensions/quota/persistenceMiddleware.ts` — store/cache boundary

## Steps (thin end-to-end slice)
1. Write the two failing storage/cache contract tests.
2. Adjust the minimal persistence path.
3. Run the exact gate commands.
4. Mark the task `in-review` only after the gate evidence is complete.

## Notes / best-practice sources
- Repo evidence only; Context7 quota was exhausted during init, so no external citations were fetched.
