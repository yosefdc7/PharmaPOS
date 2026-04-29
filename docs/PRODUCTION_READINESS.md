# Production Readiness

This document tracks the validated readiness gaps for the `web-prototype/` production target and the status of the first hardening pass.

## Current status

- Target runtime: `web-prototype/` offline-first Next.js app with IndexedDB as the default local runtime.
- Demo behavior retained: auto-login is intentionally still enabled for the seeded admin flow unless the operator explicitly logs out in the current browser session.
- Phase 1 status: in progress via local auth/session hardening, crash containment, browser storage persistence, and package version pinning.

## Phase 1 items

### Completed in this phase

- Added real local password-based auth for the IndexedDB runtime using bcrypt-backed stored password hashes.
- Added session persistence with expiry in browser storage.
- Preserved demo auto-login while making boot order explicit: restore session first, then auto-login only when allowed.
- Added explicit logout behavior that suppresses auto-login for the rest of the current browser session.
- Added route-level, global, and workspace-level error fallbacks.
- Added persistent-storage request plumbing so the UI can surface whether browser storage protection was granted.
- Pinned `web-prototype/package.json` dependencies to concrete versions from the lockfile.

### Remaining validated gaps

#### Critical

- ~~No service worker yet, so the full app shell is not currently cached for true offline startup.~~ **Resolved 2026-04-26** — Serwist (`@serwist/turbopack`) service worker added with precached app shell, stale-while-revalidate for API routes, and offline fallback page at `/~offline`.
- ~~Sync queue still resolves locally; there is no real remote queue drain or conflict-resolution path.~~ **Resolved 2026-04-27** — Client sync now submits IndexedDB queue items to Next.js API `POST /api/sync-queue`, triggers server-side conflict processing via `POST /api/sync/process`, and reconciles via pull; manual resolutions are routed through `PUT /api/sync-queue` with re-process + pull.

#### High

- ~~Role-based permission enforcement is still incomplete in the UI.~~ **Resolved 2026-04-26** — Added supervisor and pharmacist roles, 6 new permission keys (void, refund, override, xReading, zReadingGenerate, zReadingView), `usePermissions()` hook, supervisor override modal with audit trail logging, and role gates on X/Z-Reading reports and BIR tabs. De-duplicated view-access functions. API routes now validate role whitelist.
- ~~Backup and restore for the web runtime are still missing.~~ **Partially resolved 2026-04-26** — `AuditEntry.requiredRole` updated to include pharmacist, eJournal/eSales tabs now gated by `reports` permission, `refundTransaction()` permission-checked.
- IndexedDB stores still need secondary indexes for higher-volume production data.
- ~~Web security hardening still needs CSP and broader form sanitization coverage; entity update routes now reject stale writes (409) unless bypassed by sync processor header.~~ **Partially resolved 2026-04-27** — CSP middleware updated to allow `'unsafe-inline'` for `script-src` (required for Next.js 16 hydration); `ensureStores` bug fixed in IndexedDB migration path; `feature-flags.ts` default flags updated to enable `payments` and `refunds` for demo flow.

#### Medium

- ~~No end-to-end browser test coverage for the full sale flow.~~ **Resolved 2026-04-27** — Added Playwright E2E test suite with 9 tests covering product search → add to cart → checkout → payment → receipt generation, plus view navigation and reports verification. Config in `web-prototype/playwright.config.ts`, tests in `web-prototype/e2e/`, runnable via `npm run test:e2e`.
- Setup and demo-seed behavior still need a production-grade first-run path.

## Notes

- Experimental Next.js API and libSQL files remain in the repo, but they are not the default runtime path tracked by this checklist.
