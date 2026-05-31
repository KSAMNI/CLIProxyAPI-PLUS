# Logging

Goal: keep logs easy to trace across patch scripts, backend services, and UI debugging.

## Required
- Log the boundary that changed state, not every line of pure computation.
- Preserve request or correlation identifiers where the code already exposes them.
- Keep log messages stable and grep-friendly.

## Log levels
- `error`: needs attention.
- `warn`: abnormal but handled.
- `info`: lifecycle milestone or important state change.
- `debug`: development detail.
- Never log secrets, tokens, or user data.

## Tooling
- Logging library: `logrus` in Go paths; structured console diagnostics in the frontend only when already established.
- Where logs go: stdout/stderr, browser console for frontend debug output, and CI logs for scripts.
