# Task 002 — Normalize API error/response contracts across usage and inspection flows

- **Vertical slice:** backend API + frontend clients
- **Depends on:** 001
- **Spec refs:** `.claude/rules/architecture.md`, `.claude/rules/error-handling.md`, `.claude/rules/testing.md`
- **Implemented by:** ccf-implementer + route/client checks
- **Gate (must be GREEN before the next slice):** `cd upstream-core && go test ./embeddedusage -run TestServerContract`; `cd upstream && bun test src/services/api/apiContract.test.ts`

## Goal (one sentence)
Make the usage and account-inspection API boundaries follow one consistent error and response contract.

## Acceptance criteria (verifiable)
- [ ] Backend contract test covers EP rows for success, business failure, system failure, malformed body, and missing auth.
- [ ] Backend contract test covers BVA rows for status 199/200/299/300/399/400/499/500.
- [ ] Client test includes a decision table for HTTP status × `{ error }` presence × body parse result.

## Test first (write before implementing)
- Create `cliproxyapi-pro-core/embeddedusage/server_contract_test.go` with EP, BVA, and decision-table rows.
- Create `cliproxyapi-pro-management/overlay/src/services/api/apiContract.test.ts` with matching client parsing rows.

## Files to touch
- `cliproxyapi-pro-core/embeddedusage/server_contract_test.go` — backend API matrix
- `cliproxyapi-pro-core/embeddedusage/server.go` — usage route contract
- `cliproxyapi-pro-core/patches/account_inspection_scheduler.go` — inspection route contract
- `cliproxyapi-pro-management/overlay/src/services/api/apiContract.test.ts` — frontend client matrix
- `cliproxyapi-pro-management/overlay/src/services/api/*.ts` — client response handling

## Steps (thin end-to-end slice)
1. Write the two failing contract tests.
2. Normalize the smallest set of handlers and wrappers needed.
3. Run the exact gate commands.
4. Mark the task `in-review` only after the gate evidence is complete.

## Notes / best-practice sources
- Repo evidence only; Context7 quota was exhausted during init, so no external citations were fetched.
