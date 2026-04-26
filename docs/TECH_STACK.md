# Tech stack (living doc)

> Source of truth: `package.json`, `server.js`, and `api/*.js`. Update this file when dependencies or architecture change.

## Application

| Layer | Technology | Notes |
|--------|------------|--------|
| Desktop shell | Electron `^41.2.2` | Main process entry: `start.js` (after `@electron/remote` init, Squirrel install handling). |
| Packaging | Electron Forge `^6.x` / `^7.x` (makers, publisher) | Scripts: `start`, `package`, `make`, `publish`. |
| Build / assets | Gulp 5, BrowserSync (dev) | Minify/concat CSS & JS; see repo scripts / gulp config. |
| UI shell | `index.html` + static assets under `assets/` | jQuery `^3.6.3` and vendor plugins; not a SPA framework. |

## Local server (embedded in Electron)

| Item | Detail |
|------|--------|
| HTTP | Node `http` + Express `^4.22.1` in `server.js` |
| Default port | `3210`, overridable via `PORT` |
| API prefix | Mounts under `/api/...` (see below) |
| Middleware | `body-parser` (JSON + urlencoded), `express-rate-limit` (100 req / 15 min per key), CORS on `/*` |
| **Not** wired in source | `socket.io` is declared in `package.json` but not imported by app JS/HTML in this tree |

## HTTP API surface (Express routers)

Routers are registered from `server.js`:

- `/api/inventory` → `api/inventory.js` (e.g. products, SKU lookup)
- `/api/customers` → `api/customers.js`
- `/api/categories` → `api/categories.js`
- `/api/settings` → `api/settings.js` (includes logo upload via `multer`)
- `/api/users` → `api/users.js`
- `/api` (transactions) → `api/transactions.js` (e.g. `/all`, `/on-hold`, `/by-date`, `/new`, …)

## Persistence

| Store | Library | Location |
|-------|---------|------------|
| Embedded document DB | `@seald-io/nedb` | Under `%APPDATA%/<APPNAME>/server/databases/` with per-domain `.db` files (`inventory`, `customers`, `categories`, `settings`, `users`, `transactions`) |

`APPNAME` / app data path are set in `server.js` from Electron’s `app.getPath('appData')` and `package.json` `name` (`PharmaSpot`).

## Security & auth-related libs

- Password hashing: `bcrypt` (alias to `bcryptjs` in `package.json`)
- Input: `validator`, `dompurify`, `sanitize` / `sanitize-filename`
- File uploads: `multer` with size and MIME constraints in settings API

## Other notable runtime dependencies

- **Updates:** `electron-updater` (feed / UI in `assets/js/native_menu/menuController.js`)
- **Local settings:** `electron-store`
- **Printing / PDF / barcode:** `print-js`, `jspdf`, `html2canvas`, `jsbarcode`
- **Misc:** `lodash`, `moment`, `archiver` / `unzipper` (backups/exports as implemented)

## Tooling

- Tests: Jest `^29.7.0` (`npm test`)
- Dev: `nodemon`, `cross-env`, `electron-reloader`, `ts-node` (dev)

## Next.js Web Prototype

| Layer | Technology | Notes |
|--------|------------|--------|
| App framework | Next.js + React | Lives in `web-prototype/`; this is the production target UI. |
| Persistence | Browser IndexedDB | Canonical local data path via `web-prototype/src/lib/db.ts` and `use-pos-store.ts`. |
| Offline sync model | Local sync queue | Simulated queue persisted in IndexedDB; no required backend for the default prototype runtime. |
| Printer support | Web Serial, Web Bluetooth, LAN bridge | ESC/POS generation and queueing are browser-side. |
| Experimental server path | Next.js route handlers + `@libsql/client` | Present in `web-prototype/src/app/api/` and `src/lib/server/` as reference or future migration work, not the default runtime path. |

## Version

Current app version: see `version` in root `package.json` (e.g. `1.5.3` at last sync).

## 2026-04-24T12:44:51Z - codex savepoint

- Added Next.js web-prototype, IndexedDB-backed local persistence, staged CI/CD promotion gates, and structured observability with logs, traces, metrics, SLOs, alerts, and runbooks.

## 2026-04-25 - qoder savepoint

### Web Prototype — BIR & Printer Components

13 new React component files added under `web-prototype/src/components/`:

| Component file | Purpose |
|---|---|
| `bir-settings.tsx` | BIR configuration form (TIN, PTU, accreditation, OR series) |
| `printer-settings.tsx` | Multi-printer profile management (USB/BT/LAN) |
| `bir-reports.tsx` | BIR report hub with compliance status indicator |
| `x-reading.tsx` | Mid-day X-Reading snapshot report |
| `z-reading.tsx` | End-of-day Z-Reading report with history log |
| `ejournal-export.tsx` | Electronic sales journal viewer and export |
| `esales-report.tsx` | Monthly eSales report with daily breakdown and CSV export |
| `receipt-preview.tsx` | Official Receipt preview (normal/void/reprint) |
| `printer-status.tsx` | Printer status monitor (Online/Offline/Paper Low/Error) |
| `reprint-queue.tsx` | Failed/pending print job queue |
| `print-failure-modal.tsx` | Print failure modal with digital receipt fallback |
| `audit-trail.tsx` | BIR report and printer activity audit log |

### Web Prototype — New TypeScript Types

New data model interfaces added to `web-prototype/src/lib/types.ts` for BIR settings, printer profiles, audit events, receipt templates, and report metadata.

### Web Prototype — Thermal Printer ESC/POS Module

Browser-compatible ESC/POS command generation for real thermal printers, located in `web-prototype/src/lib/printer/`.

| File | Purpose |
|---|---|
| `escpos-commands.ts` | `EscPosBuilder` class: init, text, alignment, bold/double-height, barcodes (CODE128, EAN13), QR codes, line feeds, full/partial cuts, pulse (cash drawer). Also exports functional helpers. |
| `receipt-content.ts` | `buildReceipt(variant, profile, bir, data, options?)` — generates `Uint8Array` of ESC/POS bytes for receipt variants: normal, void, reprint, x-reading, z-reading, daily-summary. Supports 58mm (32 chars) and 80mm (48 chars) paper widths. |
| `escpos-commands.test.ts` | 33 unit tests covering EscPosBuilder commands and functional helpers. |
| `receipt-content.test.ts` | 22 unit tests covering all receipt variants, BIR header output, item details, payment method labels, and X/Z reading reports. |

**Connection methods:** Web Serial API (USB), Web Bluetooth API, HTTP LAN bridge for network printers.

**Test framework:** Vitest (`npm test` from `web-prototype/`). TypeScript checking via `npm run typecheck`.

## 2026-04-26 - codex savepoint

- Web prototype local auth now defaults to IndexedDB-backed bcrypt password hashes plus browser-stored sessions with expiry for the offline runtime path.
- Boot now requests `navigator.storage.persist()` when supported and surfaces whether persistent storage was granted.
- Error containment now includes Next.js `error.tsx`, `global-error.tsx`, and a local workspace error boundary around the POS shell.

## 2026-04-26 - codex savepoint

- Re-centered the Next.js prototype on IndexedDB as the default runtime path, while leaving the newer Next.js API/libSQL files in place as experimental reference work.

## 2026-04-26 - qoder savepoint

### Phase 1 Backend Wiring

- IndexedDB schema upgraded to v5 with 18 stores (added: birSettings, printerProfiles, auditLog, printerActivity, prescriptions, rxSettings, xReadings, zReadings, reprintQueue)
- BIR settings, Printer profiles, Audit trail, X/Z-Reading, and Prescriptions now persist to IndexedDB
- `completeSale` reads BIR settings for OR series, auto-increments OR number, blocks when series exhausted, and attempts thermal print on completion
- Printer config module: `defaultForOr` / `defaultForReport` role-based defaults, `resolvePrinterForRole()`, `applyPrinterRoleDefault()`
- Durable print queue persisted to IndexedDB `reprintQueue` store with Base64-encoded ESC/POS commands
- LAN Printer Bridge (`bridge/bridge-server.js`): Node.js HTTP server forwarding ESC/POS over raw TCP
- New tests: printer-config, print-queue, receipt-content, receipt-preview, reprint-queue, 12 OR series / X-Reading unit tests


### Web Prototype — Thermal Printer ESC/POS Module

Browser-compatible ESC/POS command generation for real thermal printers, located in `web-prototype/src/lib/printer/`.

| File | Purpose |
|---|---|
| `escpos-commands.ts` | `EscPosBuilder` class: init, text, alignment, bold/double-height, barcodes (CODE128, EAN13), QR codes, line feeds, full/partial cuts, pulse (cash drawer). Also exports functional helpers: `line()`, `text()`, `align()`, `bold()`, `doubleHeight()`, `normalSize()`, `initPrinter()`, `feedLines()`, `cut()`. |
| `receipt-content.ts` | `buildReceipt(variant, profile, bir, data, options?)` — generates `Uint8Array` of ESC/POS bytes for receipt variants: `normal`, `void`, `reprint`, `x-reading`, `z-reading`, `daily-summary`. Supports 58mm (32 chars) and 80mm (48 chars) paper widths. |
| `escpos-commands.test.ts` | 33 unit tests covering EscPosBuilder commands and functional helpers. |
| `receipt-content.test.ts` | 22 unit tests covering all receipt variants, BIR header output, item details, payment method labels, and X/Z reading reports. |

**Connection methods:** Web Serial API (USB), Web Bluetooth API, HTTP LAN bridge for network printers.

**Test framework:** Vitest (`npm test` from `web-prototype/`). TypeScript checking via `npm run typecheck`.
