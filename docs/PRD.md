# Product requirements (living doc)

> **PharmaSpot** — pharmacy point of sale. This document summarizes product intent and what the codebase actually implements. Align feature bullets with `README.md` and user-facing behavior.

## Product identity

| Field | Value (check `package.json`) |
|-------|------------------------------|
| Name | PharmaSpot |
| One-liner | Easy point of sale for pharmacies (Patterns Digital / product marketing) |
| Version | From root `package.json` `version` |

## Goals

1. **Single-store + LAN:** One machine runs the app and embedded API; other PCs on the network can use the same logical store (see `README` multi-PC / central database messaging).
2. **Operational speed:** Barcode and search-led selling, quick payment and receipt.
3. **Inventory safety:** Stock levels, low-stock awareness, optional expiry tracking and alerts.
4. **Accountability:** Staff users, permissions, transaction history and filtering (e.g. by date, till, status where implemented in UI + API).
5. **Data ownership:** Local databases under the user’s app data path (NeDB files); not a cloud-only SaaS model.

## In-scope capabilities (as reflected in app + API)

- **Point of sale:** Sales flow, payments, receipt generation (print/PDF stack in dependencies).
- **Catalog:** Products, categories, custom barcodes/SKU, profit fields where used in data model.
- **Inventory:** Product CRUD and stock-related behavior exposed via `/api/inventory` and related UI.
- **Customers:** Customer records via customers API and UI.
- **Transactions:** History, on-hold / customer orders, by-date query — see `api/transactions.js` routes (`/all`, `/on-hold`, `/customer-orders`, `/by-date`, `/new`, etc.).
- **Users & settings:** User accounts, hashed passwords, application settings and branding (logo upload in settings API).
- **Desktop updates:** Auto-update path via `electron-updater` (not merely roadmap — implemented in main-window menu flow).

## API contract (summary)

The embedded server exposes REST-style JSON under `/api/…` (see `docs/TECH_STACK.md` for the route map). The UI is expected to call these endpoints on `localhost` (or host + port) as configured at runtime.

## Non-goals / roadmap (from README, verify before marketing)

`README` still lists as roadmap examples: **backup, restore, export to Excel** — treat as **not guaranteed** unless a feature exists in the repo. Confirm against actual menus and `api/` before claiming in release notes.

## Default demo credentials

Documented in `README` for first run (e.g. `admin` / `admin`); **change in production** and enforce user management policies locally.

## Maintenance

When adding a feature, update:

1. This file if the product story or scope changes.
2. `docs/TECH_STACK.md` if new dependencies, routes, or storage paths are introduced.
3. `README` for end-user feature lists and screenshots.

## 2026-04-24T12:44:51Z - codex savepoint

- The project now includes a Vercel-ready offline-first web POS prototype alongside the legacy Electron app, with deployment promotion and rollback expectations documented.
