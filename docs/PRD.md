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

### BIR Compliance (UI prototype only — no backend persistence)

> All items below exist as interactive UI screens in the Next.js web prototype (`web-prototype/`) with mock/seed data. No backend APIs, database writes, or real BIR submission logic is wired up yet.

- **BIR Settings configuration:** TIN, registered business name and address, VAT registration status, Permit-to-Use (PTU) number, POS machine serial number, BIR accreditation number, and Official Receipt (OR) series range management.
- **Compliance status indicator:** Visual completeness gauge showing which required BIR fields have been filled in.
- **Official Receipt (OR) preview:** Displays a receipt template with all BIR-required fields; includes normal, void, and reprint receipt variants.
- **X-Reading report:** Mid-day sales snapshot report generation and on-screen display.
- **Z-Reading report:** End-of-day reset report with lock/override mechanism and searchable history log.
- **eJournal export:** Electronic sales journal viewer with validation checks and date-range selection for export.
- **eSales report:** Monthly sales report with daily breakdown view and CSV export option.
- **VAT / Non-VAT toggle:** Classification switch that adjusts the receipt template between VAT-registered and non-VAT layouts.

### Thermal Printer Management (UI prototype only — no actual printing)

> These screens let users configure and monitor thermal printers. All data is mock; no USB/Bluetooth/LAN communication occurs.

- **Multi-printer profile management:** Create, edit, and delete printer profiles for USB, Bluetooth, and LAN connections.
- **Receipt layout configuration:** Customize logo, header text, footer text, and auto-cut settings per printer profile.
- **Printer status monitoring:** Live-style indicators showing Online, Offline, Paper Low, and Error states (mock data).
- **Reprint queue:** List of failed or pending print jobs with retry and cancel actions.
- **Print failure handling:** Modal workflow offering a digital receipt fallback with QR code placeholder when a print job fails.
- **Auto-detect USB printers:** Simulated USB printer discovery list.

### Audit & Compliance (UI prototype only — no backend persistence)

- **BIR report generation audit trail:** Event log of all BIR report generation actions with role-based permission indicators.
- **Printer activity log:** Chronological record of all print jobs (successful, failed, retried).
- **Z-Reading missed alert system:** Dashboard alert when an expected Z-Reading has not been generated for the current business day.

### Rx/DD Compliance Workspace (UI prototype only — no backend persistence)

> Rx/DD flows are implemented as integrated UI-only screens in the Next.js prototype and mapped to `RX-1` to `RX-37` in `rxdd_user_stories.md`.

- **Drug classification setup:** Mandatory class display and product metadata fields for DD/EDD/Rx/Pharmacist-Only OTC/Non-Rx OTC.
- **Dispensing checkpoints:** UI gates and warnings for Rx/DD/EDD plus pharmacist acknowledgment for Pharmacist-Only OTC.
- **Prescription entry drawer:** Captures prescriber/patient/dispensing fields with DD and EDD-specific inputs (S-2 and Yellow Rx where applicable).
- **Patient medication profile:** Searchable profile timeline with export actions for inspection scenarios.
- **Dangerous Drugs log:** Register-style DD/EDD transaction table with export controls and running-balance surface.
- **Inspection dashboard:** One-screen summary of Rx/DD activity, open partials, red flags, and role-gated compliance visibility.
- **Prescription reset protection:** UI exposes a hard-block policy for prototype reset exclusion of prescription and DD data domains.

## API contract (summary)

The embedded server exposes REST-style JSON under `/api/…` (see `docs/TECH_STACK.md` for the route map). The UI is expected to call these endpoints on `localhost` (or host + port) as configured at runtime.

## Non-goals / roadmap (from README, verify before marketing)

`README` still lists as roadmap examples: **backup, restore, export to Excel** — treat as **not guaranteed** unless a feature exists in the repo. Confirm against actual menus and `api/` before claiming in release notes.

> **Note (2026-04-25):** UI prototypes for BIR compliance, thermal printer management, and audit/compliance features now exist in the Next.js web prototype. These are front-end only with mock data — backend persistence, real printing, and BIR submission are still roadmap items.

## Default demo credentials

Documented in `README` for first run (e.g. `admin` / `admin`); **change in production** and enforce user management policies locally.

## Maintenance

When adding a feature, update:

1. This file if the product story or scope changes.
2. `docs/TECH_STACK.md` if new dependencies, routes, or storage paths are introduced.
3. `README` for end-user feature lists and screenshots.

## 2026-04-24T12:44:51Z - codex savepoint

- The project now includes a Vercel-ready offline-first web POS prototype alongside the legacy Electron app, with deployment promotion and rollback expectations documented.

## 2026-04-25 - qoder savepoint

- Added BIR compliance UI prototype: settings, OR preview, X/Z-Reading reports, eJournal/eSales exports
- Added thermal printer management UI prototype: multi-printer profiles, receipt layout, status monitoring, reprint queue
- Added audit trail and printer activity log UI
- All features are UI-only in the Next.js web prototype with mock data
