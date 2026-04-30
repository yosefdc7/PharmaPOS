# Product requirements (living doc)

> **PharmaPOS PH** - pharmacy point of sale. This document summarizes product intent and what the codebase actually implements. Align feature bullets with `README.md` and user-facing behavior.

## Product identity

| Field | Value |
|-------|-------|
| Name | PharmaPOS PH |
| One-liner | Easy point of sale for pharmacies (Patterns Digital / product marketing) |
| Version | 1.5.3 |
| Primary app | Next.js web prototype (`web-prototype/`) |

## Goals

1. Offline-first web POS with IndexedDB-backed local persistence.
2. Operational speed through barcode/search-led selling.
3. Inventory safety with stock, low-stock, and expiry awareness.
4. Accountability via users, permissions, and transaction history.
5. Data ownership with local databases and optional sync later.
6. Regulatory compliance for BIR receipts, X/Z-reading, eJournal, eSales, and Rx/DD workflows.

## In-scope capabilities

- Point of sale: sales flow, payments, receipt generation, thermal printer support.
- Catalog: products, categories, custom barcodes/SKU.
- Inventory: product CRUD and stock management.
- Customers: customer records and profiles.
- Transactions: history, on-hold orders, by-date filtering.
- Users & settings: user accounts, settings, and branding.
- Offline-first PWA: service worker, IndexedDB persistence, background sync queue.
- Thermal printer: USB/Bluetooth/LAN printer profiles, ESC/POS generation, print queue with retry.
- Multi-PC support: shared workflow assumptions for multiple workstations on the same network.
- Stock visibility: low-stock alerts, expiry tracking, and profit calculations.

### BIR Compliance

- BIR settings configuration: TIN, business name/address, VAT status, PTU number, POS serial, accreditation number, OR series range.
- Compliance status indicator: completeness gauge for required BIR fields.
- OR preview: normal, void, and reprint receipt variants.
- X-Reading report: mid-day snapshot report.
- Z-Reading report: end-of-day reset report with lock/override and history.
- eJournal export: date-range viewer with validation.
- eSales report: monthly report with daily breakdown and CSV export.
- VAT / Non-VAT toggle: receipt layout switch.

### Thermal Printer Management

- Multi-printer profile management: USB, Bluetooth, and LAN profiles.
- ESC/POS engine: raw byte output for text formatting, alignment, bold/double-height, barcodes, QR codes, feeds, and cuts.
- Receipt builder: BIR-compliant receipt output for normal, void, reprint, X-reading, Z-reading, and daily-summary variants.
- Receipt layout config: logo, header/footer text, auto-cut settings.
- Printer status monitoring: Online, Offline, Paper Low, Error.
- Reprint queue: failed/pending jobs with retry and cancel.
- Print failure handling: digital receipt fallback with QR placeholder.
- Auto-detect USB printers: simulated discovery list.

### Rx/DD Compliance Workspace

- Drug classification setup: DD/EDD/Rx/Pharmacist-Only OTC/Non-Rx OTC metadata.
- Dispensing checkpoints: UI gates and pharmacist acknowledgment.
- Prescription entry drawer: prescriber/patient/dispensing fields.
- Patient medication profile: searchable timeline with export actions.
- Dangerous Drugs log: register-style transaction table with running balance.
- Inspection dashboard: compliance summary and red flags.
- Prescription reset protection: excludes prescription and DD domains from prototype reset.

## API contract (summary)

The web prototype uses client-side IndexedDB via `web-prototype/src/lib/db.ts` and `web-prototype/src/lib/use-pos-store.ts`. Experimental Next.js API routes and `src/lib/server/` files may exist, but they are not the default production runtime path.

## Non-goals / roadmap

`README` still lists roadmap examples like backup, restore, and Excel export - treat these as not guaranteed unless they exist in the repo.

> **Note (2026-04-29):** This doc reflects the current offline-first web prototype, BIR/thermal printer flows, and Rx/DD compliance workspace as the primary product scope.

## Default demo credentials

Documented in `README` for first run (for example `admin` / `admin`); change in production.

## Maintenance

1. Update this file when product scope changes.
2. Update `docs/TECH_STACK.md` when dependencies, routes, or storage paths change.
3. Update `README` for user-facing feature lists and screenshots.

## Savepoints

- 2026-04-24T12:44:51Z - Vercel-ready offline-first web POS prototype and rollout expectations documented.
- 2026-04-26 - Web prototype became the sole production target and was centered on IndexedDB.
- 2026-04-26 - Thermal printer management moved from mock UI to real ESC/POS support.

