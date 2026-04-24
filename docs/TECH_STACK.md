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

## Version

Current app version: see `version` in root `package.json` (e.g. `1.5.3` at last sync).

## 2026-04-24T12:44:51Z - codex savepoint

- Added Next.js web-prototype, IndexedDB-backed local persistence, staged CI/CD promotion gates, and structured observability with logs, traces, metrics, SLOs, alerts, and runbooks.
