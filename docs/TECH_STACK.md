# Tech stack (living doc)

> Source of truth: root `package.json` and `web-prototype/package.json`. Update this file when dependencies or architecture change.

## Application

| Layer | Technology | Notes |
|--------|------------|--------|
| Primary app | Next.js + React | Lives in `web-prototype/`; this is the production target UI. |
| Runtime | Node.js 20+ | Used for Next.js development/build/runtime. |
| Local persistence | Browser IndexedDB | Canonical local data path via `web-prototype/src/lib/db.ts` and `use-pos-store.ts`. |
| Offline support | Serwist (`@serwist/turbopack`) | Service worker precache + offline fallback page. |
| Thermal printing | Web Serial, Web Bluetooth, LAN bridge | Browser-side ESC/POS generation and queueing. |
| Local auth | bcryptjs + IndexedDB sessions | Offline login path with session expiry. |

## Local bridge service

| Item | Detail |
|------|--------|
| Service | `bridge/bridge-server.js` |
| Purpose | Receives HTTP requests from web app and forwards Base64 ESC/POS payloads to TCP thermal printers |
| Default URL | `http://localhost:9101` |

## Next.js web prototype

| Layer | Technology | Notes |
|--------|------------|--------|
| App framework | Next.js 16.2.4 + React 19.2.5 | Lives in `web-prototype/`; this is the production target UI. |
| Persistence | Browser IndexedDB | Canonical local data path via `web-prototype/src/lib/db.ts` and `use-pos-store.ts`. Schema v6 with `supervisorAcks` store. |
| Offline support | Serwist (`@serwist/turbopack`) v9.5.7 | Service worker with precached app shell, stale-while-revalidate for API routes, offline fallback page. |
| Offline sync model | Local sync queue | Simulated queue persisted in IndexedDB; no required backend for the default runtime. |
| Printer support | Web Serial, Web Bluetooth, LAN bridge | ESC/POS generation and queueing are browser-side. |
| Permissions | `use-permissions.ts` hook | 4 roles (admin, supervisor, pharmacist, cashier), 16 permission keys. |
| Server path | Next.js route handlers + `@libsql/client` | Present under `web-prototype/src/app/api/` and `web-prototype/src/lib/server/`. |
| Auth | `bcryptjs` 3.0.3 | Password hashing for local demo/auth flows. |

## Versions

- Root app version: `1.5.3`
- Web prototype package version: `0.1.0`
- Next.js: `16.2.4`
- React / React DOM: `19.2.5`
- TypeScript: `6.0.3`
- Vitest: `4.1.5`

## Savepoints

- 2026-04-24T12:44:51Z - Added the Next.js web prototype, IndexedDB persistence, and rollout gates.
- 2026-04-25 - Added BIR and printer components plus ESC/POS generation.
- 2026-04-26 - Added IndexedDB auth, storage persistence, and error containment.
- 2026-04-26 - Re-centered the prototype on IndexedDB as the default runtime path.
- 2026-04-26 - Added phase 1 backend wiring and durable print queue support.

