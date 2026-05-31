# Architecture

## Layering & boundaries
- Upstream source code lives outside this repository; this repo only applies repeatable patch and overlay layers.
- `cliproxyapi-pro-core` owns backend/runtime patches, embedded usage storage, and release packaging.
- `cliproxyapi-pro-management` owns frontend overlay code, API wrappers, quota persistence, and monitoring pages.

## Dependency direction
- Dependencies flow one way only: `management -> core enhanced APIs -> embedded usage storage`; never the other way around.
- Business logic does not depend directly on patch scripts, release scripts, or shell orchestration.

## Design patterns
- Backend: patch-and-apply customization with embedded persistence and explicit route registration.
- Frontend: overlay composition with hooks for derived state and page-level SCSS Modules.

## Where things go
- Backend storage and server code: `cliproxyapi-pro-core/embeddedusage/`
- Backend patch logic: `cliproxyapi-pro-core/patches/`
- Frontend overlay source: `cliproxyapi-pro-management/overlay/src/`
- Frontend API clients: `cliproxyapi-pro-management/overlay/src/services/api/`
- Frontend monitoring features: `cliproxyapi-pro-management/overlay/src/features/monitoring/`
- Frontend quota persistence: `cliproxyapi-pro-management/overlay/src/extensions/quota/`

## Verifiable rules
- Each module has one clear responsibility.
- No circular imports between layers.
- New behavior must be wired through the existing patch/overlay entry points instead of editing upstream sources directly.
