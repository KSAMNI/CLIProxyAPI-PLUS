# Task 004 — Preserve monitoring hook/page composition

- **Vertical slice:** frontend hooks + pages
- **Depends on:** 003
- **Spec refs:** `.claude/rules/architecture.md`, `.claude/rules/testing.md`, `.claude/rules/coding-conventions.md`
- **Implemented by:** ccf-implementer + frontend verification
- **Gate (must be GREEN before the next slice):** `cd upstream && bun test src/features/monitoring/hooks/useMonitoringData.contract.test.ts`; `python3 scripts/check-monitoring-page-composition.py`; `cd upstream && bun run build`

## Goal (one sentence)
Keep monitoring pages as composition-only surfaces while hooks own derived usage and monitoring state.

## Acceptance criteria (verifiable)
- [ ] Hook matrix covers EP rows for empty data, single source, multiple sources, partial source failure, full error, and loading state.
- [ ] Hook matrix covers BVA rows for 0/1/2 source count and first/last timestamp ordering.
- [ ] Hook matrix includes a decision table for loading × error × data presence × refresh state precedence.
- [ ] `scripts/check-monitoring-page-composition.py` rejects aggregation helpers, `reduce`, `groupBy`, or summary construction inside `overlay/src/pages/*.tsx`.

## Test first (write before implementing)
- Create `cliproxyapi-pro-management/overlay/src/features/monitoring/hooks/useMonitoringData.contract.test.ts` for the public hook output matrix.
- Create `scripts/check-monitoring-page-composition.py` to enforce page composition boundaries deterministically.

## Files to touch
- `cliproxyapi-pro-management/overlay/src/features/monitoring/hooks/useMonitoringData.contract.test.ts` — hook contract matrix
- `cliproxyapi-pro-management/overlay/src/features/monitoring/hooks/*.ts` — monitoring derivation logic
- `scripts/check-monitoring-page-composition.py` — deterministic page-boundary check
- `cliproxyapi-pro-management/overlay/src/pages/*.tsx` — page composition only

## Steps (thin end-to-end slice)
1. Write the failing hook contract test and static page-boundary check.
2. Adjust only the hook/page boundary needed.
3. Run the exact gate commands.
4. Mark the task `in-review` only after the gate evidence is complete.

## Notes / best-practice sources
- Repo evidence only; Context7 quota was exhausted during init, so no external citations were fetched.
