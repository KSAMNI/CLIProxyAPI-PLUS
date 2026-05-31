# Tech Stack

Philosophy: prefer the most stable, most widely-supported, least-buggy stack currently used by the repository.

## Chosen stack
- Language: Go + TypeScript
- Backend framework: Gin
- Frontend framework: React + TypeScript
- Backend packaging: Docker + GoReleaser
- Frontend build tool: Bun
- Database: SQLite
- Frontend persistence: IndexedDB + SQLite-backed cache bridge
- CI/CD: GitHub Actions

## Core libraries (one fixed choice per concern)
- Backend routing: Gin route groups and middleware
- Backend logging: logrus + shell timestamped logs
- Backend persistence: `database/sql` + SQLite WAL with UPSERT
- Frontend state: React hooks + local store patterns
- Frontend API access: shared `apiClient` wrapper plus direct fetch for streaming
- Frontend styling: SCSS Modules
- Frontend realtime: SSE for usage stream, WebSocket for inspection logs

## Rules
- Do not add a new library outside the list above without comparing current best practices and updating this file.
- Pin versions in the lockfile; major upgrades require a recorded reason.
