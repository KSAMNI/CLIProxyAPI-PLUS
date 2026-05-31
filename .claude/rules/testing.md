# Testing (verification-first)

Philosophy: write the smallest failing test or reproducible check first, then implement the minimum change needed to make it pass.

## Rules
- Each task: write a test or reproducible check for the acceptance criteria before implementing.
- Bug fix: reproduce the bug first, then fix it.
- A task's acceptance criteria must map to concrete checks, not vague descriptions.

## Tooling & location
- Test framework: existing repo test tooling for each module.
- Run command: core uses its documented Go build/test path; management uses `bun install --frozen-lockfile && bun run build`.
- Tests live in: the same module that owns the behavior.

## Coverage
- Coverage target: protect the critical backend storage, route, and UI-data paths that are already in the repo.
- Core business paths must have tests or reproducible verification before a task is marked complete.

## Test design discipline (when adopted)
- Matrix required: yes.
- Apply a contract-level design matrix to a public signature, not to internal helpers.
- Use EP for input classes, BVA for edges, and decision tables when several conditions interact.
- Integration scope: backend route/storage boundaries and frontend API/data boundaries.
- E2E scope: the user-visible monitoring and inspection flows.
- Gate enforcement: prompt-only.
