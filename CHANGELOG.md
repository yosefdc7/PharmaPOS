# Changelog

## 2026-04-26 - Service Worker (Offline PWA)

### Added
- Serwist (`@serwist/turbopack`) service worker with precached app shell for true offline startup (agent: qoder)
- Stale-while-revalidate caching strategy for `/api/*` routes — serves cached data offline, refreshes in background when online (agent: qoder)
- Offline fallback page at `/~offline` with retry button (agent: qoder)
- `SerwistProvider` in `layout.tsx` for automatic SW registration via `/serwist/sw.js` route handler (agent: qoder)
- PWA manifest updated with `scope`, proper icon entries (192x192, 512x512 maskable) (agent: qoder)
- `tsconfig.json` updated with `webworker` lib for ServiceWorker types (agent: qoder)

### Changed
- `next.config.ts` wrapped with `withSerwist()` from `@serwist/turbopack` (agent: qoder)
- `layout.tsx` enhanced with full PWA metadata (appleWebApp, openGraph, twitter) (agent: qoder)

## 2026-04-26 - Phase 1 Backend Wiring Savepoint

### Added
- 8 new IndexedDB stores: birSettings, printerProfiles, auditLog, printerActivity, prescriptions, rxSettings, xReadings, zReadings (agent: qoder)
- DB schema v4 migration for Phase 1 new stores (agent: qoder)
- `logAuditEvent()` and `logPrinterActivity()` exported helpers in audit-trail.tsx for cross-component audit logging (agent: qoder)
- 12 unit tests for OR series logic and X-Reading computation in `db.test.ts` (agent: qoder)

### Changed
- BIR settings panel now loads/saves to IndexedDB instead of useState mock data (agent: qoder)
- Printer profiles management (add/delete/test-print) now persists to IndexedDB (agent: qoder)
- Audit trail panel loads real entries from auditLog and printerActivity IndexedDB stores (agent: qoder)
- X-Reading and Z-Reading reports now compute from real transaction data via IndexedDB (agent: qoder)
- Prescription settings panel loads/saves to IndexedDB rxSettings store (agent: qoder)
- Prescription drafts, refusals, and red flags now persist to IndexedDB via use-pos-store (agent: qoder)
- `completeSale` now reads BIR settings for OR series tracking, auto-increments OR number, and blocks when series exhausted (agent: qoder)
- `api-client.ts` putOne broadened to `Record<string, unknown>` to support new store types (agent: qoder)
- Generated X/Z readings persisted to their respective IndexedDB stores with audit trail entries (agent: qoder)

## 2026-04-26 - Savepoint

### Added
- Phase 2 backend: SQLite backend with @libsql/client, Turso cloud database, and Next.js API routes (agent: qoder)
- Payment processing API: `POST /api/payments/process` for marking transactions as paid with payment method/reference (agent: qoder)
- Refund handling API: `POST /api/payments/refund` for processing refunds with reason/reference tracking (agent: qoder)
- Sync queue worker: `GET/POST /api/sync/process` for offline sync queue management with retry logic (agent: qoder)
- Feature flag controls: `GET/PATCH /api/feature-flags` for kill-switch rollout of payments/refunds/sync (agent: qoder)
- Server-side database layer: `src/lib/server/db.ts`, `init.ts`, `seed.ts`, `schema.sql` with singleton pattern and test override support (agent: qoder)
- 24 API routes total covering products, categories, customers, users, transactions, held orders, settings, sync queue (agent: qoder)

### Changed
- Migrated from client-side IndexedDB to server-side SQLite via Turso for all data operations (agent: qoder)
- Updated `web-prototype/src/lib/db.ts` to use API client instead of direct IndexedDB (agent: qoder)
- Added `TURSO_URL` and `TURSO_AUTH_TOKEN` environment variables for cloud database connectivity (agent: qoder)

### Fixed
- Test file corruption from base64 encoding: restored `db.test.ts`, `auth.test.ts`, `sync.contract.test.ts`, `db.integration.test.ts`, `migrations.integration.test.ts` (agent: qoder)
- Restored `getDb(overrideUrl?)` parameter for in-memory test database isolation (agent: qoder)
- Fixed SQL nested quote bug in payment processing route (agent: qoder)

## 2026-04-25 - Savepoint

### Added
- Root `vercel.json` for Vercel deploys from repository root: installs and builds `web-prototype`, outputs static `web-prototype/out` (Next.js `output: "export"`). For dashboard “Root Directory = web-prototype”, use the `web-prototype/vercel.json` preset instead (agent: codex)
- RX/DD UI workspace: classification, dispensing gates, prescription drawer, patient profile, DD log, red flags, inspection dashboard; Settings Prescriptions tab; product drug-class badges and product master fields (agent: qoder)
- BIR compliance UI: settings configuration, compliance status indicator, OR preview (normal/void/reprint), X-Reading, Z-Reading with history, eJournal export, eSales report (agent: qoder)
- Thermal printer management UI: multi-printer profiles, receipt layout config, printer status indicator, reprint queue, print failure modal with digital receipt fallback (agent: qoder)
- Audit trail UI: BIR report event log, printer activity log, Z-Reading missed alert (agent: qoder)
- 13 new React components in web-prototype/src/components/ (agent: qoder)
- TypeScript types for BIR, Printer, and Audit data models (agent: qoder)

## 2026-04-24T05:12:18Z - antigravity savepoint

- Configured Antigravity skill system: added custom skill path, created antigravity.yaml agent config for new-project-copy-rules skill, and established dev session tracking User Rule with savepoint workflow

## 2026-04-24T12:44:51Z - codex savepoint

- Captured current project state after the Next.js POS prototype, staged deployment pipeline, and observability rollout.

## 2026-04-24T16:31:56Z - antigravity savepoint

- Renamed 'Sync' to 'Sync Online' across UI and observability; renamed 'Add Customer' to 'Add' in the customer management view.
