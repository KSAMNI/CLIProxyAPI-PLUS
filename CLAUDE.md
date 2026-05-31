# CLIProxyAPI-Pro

> Managed by **CCF (Claude Context First)**. Workflow: Explore → Plan → Implement → Check.
> **STRICTLY SEQUENTIAL**: one task at a time, no parallel feature development.
> Ground every design decision in repo evidence and current official docs when available.
> Keep this spec fresh with `/ccf:ccf-updatespec`.

## What this is
This repository packages two coordinated customization layers for CLIProxyAPI-Pro: `cliproxyapi-pro-core` for backend/runtime patches and `cliproxyapi-pro-management` for frontend overlay customizations. The codebase is maintained as repeatable patch/apply scripts over upstream sources, not as a full fork.

## Repo layout (monorepo)
- Root: shared docs, CI, assets, `.claude/`, and release workflows.
- `cliproxyapi-pro-core/` — backend/runtime customization layer for embedded usage, patch application, and Docker-based release packaging.
- `cliproxyapi-pro-management/` — frontend overlay/customization layer for monitoring, quota persistence, and management UI.

## Rules (imported — keep this file < 200 lines; detail lives in .claude/rules/)
@.claude/rules/tech-stack.md
@.claude/rules/architecture.md
@.claude/rules/coding-conventions.md
@.claude/rules/logging.md
@.claude/rules/testing.md
@.claude/rules/error-handling.md
@.claude/rules/debugging.md
@.claude/rules/tooling.md
@.claude/rules/git-workflow.md

## Current plan
See `.claude/plan/PLAN.md` for the sequential backlog. Execute **one task at a time**, in order; do not start task N+1 until task N is implemented, tested, and checked.
