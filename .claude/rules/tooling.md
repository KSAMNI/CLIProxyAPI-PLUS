# Tooling (available skills / MCP / subagents — WHEN TO USE)

## MCP servers
- **context7** — look up current docs for libraries/frameworks. Use when you need a library's API syntax, migration note, or best practice.
- **microsoft-learn** — look up Microsoft/.NET/Azure docs. Use when working with a Microsoft platform.

## Skills
- **update-config** — use when changing Claude Code harness settings or permissions.
- **keybindings-help** — use when customizing keyboard shortcuts.
- **simplify** — review changed code for reuse, quality, and efficiency, then fix issues found.
- **fewer-permission-prompts** — add read-only allowlists to reduce prompts.
- **loop** — run a prompt repeatedly on an interval.
- **claude-api** — build or debug Claude API / Anthropic SDK apps.
- **frontend-design** — create production-grade frontend interfaces.
- **ccf:* skills** — use for CCF onboarding, planning, review, fixes, tests, and spec updates.

## Subagents (CCF)
- **ccf-codebase-analyzer** — read-only codebase slice analysis.
- **ccf-best-practice-researcher** — fetch best practices for a tech choice.
- **ccf-spec-checker** — review conformance, SOLID, and drift.
- **ccf-debugger** — investigate one root-cause branch.
- **ccf-implementer** — implement one task from the plan.

## System memory vs Spec (WHEN TO write where)
- Spec files capture project rules that are stable and derivable from the repository.
- Memory captures durable user preferences or feedback that should persist across sessions.
- Do not duplicate CLAUDE.md content into memory.
