# Git Workflow

## Most important rule
- Do not commit or push unless the user explicitly asks.

## Commit attribution
- `.claude/settings.json` is the source of truth for attribution.
- This repository does not currently require automatic Claude attribution trailers.
- If future history introduces a real trailer convention, update this file and settings together.

## When asked to commit
- If on the default branch (`main`/`master`): create a new branch first.
- Commit messages follow Conventional Commits.
- One logical change per commit; don't bundle unrelated work.

## Branch & PR
- Branch naming convention: `type/short-description`.
- PR rules: keep the title short, summarize the user-visible change, and list the verification steps in the body.

## Monorepo
- Git lives at the root only; never git init inside `cliproxyapi-pro-core/` or `cliproxyapi-pro-management/`.
