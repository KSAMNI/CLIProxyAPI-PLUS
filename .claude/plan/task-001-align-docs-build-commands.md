# Task 001 — Align documented build/test commands with CI reality

- **Vertical slice:** docs + spec + verification
- **Depends on:** START
- **Spec refs:** `.claude/rules/tech-stack.md`, `.claude/rules/testing.md`, `.claude/rules/git-workflow.md`
- **Implemented by:** ccf-implementer + repo build commands
- **Gate (must be GREEN before the next slice):** `python3 scripts/check-doc-commands.py` passes

## Goal (one sentence)
Make the documented build and test commands match the commands already used in CI and release scripts.

## Acceptance criteria (verifiable)
- [ ] `scripts/check-doc-commands.py` fails before the docs/spec update and passes after it.
- [ ] The check verifies management CI path `bash customizations-repo/cliproxyapi-pro-management/apply.sh upstream`, then `cd upstream && bun install --frozen-lockfile && bun run build`.
- [ ] The check verifies core CI path `python3 customizations-repo/cliproxyapi-pro-core/patches/apply_upstream_patches.py`, then `cd upstream-core && go mod tidy`, then GoReleaser with `workdir: upstream-core`.

## Test first (write before implementing)
- Create `scripts/check-doc-commands.py` to assert README and `.claude/rules/testing.md` mention the exact CI paths plus any explicitly labeled local equivalents.

## Files to touch
- `scripts/check-doc-commands.py` — deterministic docs/spec command check
- `README.md` — align documented commands
- `.claude/rules/testing.md` — keep verification rules aligned

## Steps (thin end-to-end slice)
1. Write `scripts/check-doc-commands.py` and confirm it fails on the current mismatch.
2. Update docs and spec text with CI-backed commands and local equivalents.
3. Run `python3 scripts/check-doc-commands.py`.
4. Mark the task `in-review` only after the gate evidence is complete.

## Notes / best-practice sources
- Repo evidence only; Context7 quota was exhausted during init, so no external citations were fetched.
