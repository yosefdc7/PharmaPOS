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

- No service worker yet, so the full app shell is not currently cached for true offline startup.
- Sync queue still resolves locally; there is no real remote queue drain or conflict-resolution path.

#### High

- Role-based permission enforcement is still incomplete in the UI.
- Backup and restore for the web runtime are still missing.
- IndexedDB stores still need secondary indexes for higher-volume production data.
- Web security hardening still needs CSP and broader form sanitization coverage.

#### Medium

- No end-to-end browser test coverage for the full sale flow.
- Setup and demo-seed behavior still need a production-grade first-run path.

## Notes

- The deprecated Electron app remains reference-only and is not the release target for readiness work.
- Experimental Next.js API and libSQL files remain in the repo, but they are not the default runtime path tracked by this checklist.
