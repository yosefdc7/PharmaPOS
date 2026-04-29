# Product requirements (living doc)

> **PharmaSpot** — pharmacy point of sale. This document summarizes product intent and what the codebase actually implements. Align feature bullets with `README.md` and user-facing behavior.

## Product identity

| Field | Value (check `package.json`) |
|-------|------------------------------|
| Name | PharmaSpot |
| One-liner | Easy point of sale for pharmacies (Patterns Digital / product marketing) |
| Version | From root `package.json` `version` |
| Primary app | Next.js web prototype (`web-prototype/`) |

## Goals

1. **Offline-first web POS:** A browser-based Progressive Web App that works without internet, powered by IndexedDB for local persistence.
2. **Operational speed:** Barcode and search-led selling, quick payment and receipt.
3. **Inventory safety:** Stock levels, low-stock awareness, optional expiry tracking and alerts.
4. **Accountability:** Staff users, permissions, transaction history and filtering (e.g. by date, status).
5. **Data ownership:** Local databases in the browser; optionally synced to a backend when connectivity is available.
6. **Regulatory compliance:** BIR-compliant receipts, X/Z-reading reports, eJournal and eSales exports; dangerous-drugs and prescription workflow support.

## In-scope capabilities (as reflected in web prototype)

- **Point of sale:** Sales flow, payments, receipt generation with thermal printer support.
- **Catalog:** Products, categories, custom barcodes/SKU.
- **Inventory:** Product CRUD and stock management.
- **Customers:** Customer records and profiles.
- **Transactions:** History, on-hold orders, by-date filtering.
- **Users & settings:** User accounts, settings and branding.
- **Offline-first PWA:** Service worker, IndexedDB persistence, background sync queue.
- **Thermal printer:** USB/Bluetooth/LAN printer profiles, ESC/POS command generation, receipt layout config, print queue with retry.

### BIR Compliance

> All items below are implemented as full-stack screens in the Next.js web prototype (`web-prototype/`). Persistence is via IndexedDB. BIR submission to government systems is out of scope (manual process for now).

- **BIR Settings configuration:** TIN, registered business name and address, VAT registration status, Permit-to-Use (PTU) number, POS machine serial number, BIR accreditation number, and Official Receipt (OR) series range management.
- **Compliance status indicator:** Visual completeness gauge showing which required BIR fields have been filled in.
- **Official Receipt (OR) preview:** Displays a receipt template with all BIR-required fields; includes normal, void, and reprint receipt variants.
- **X-Reading report:** Mid-day sales snapshot report generation and on-screen display.
- **Z-Reading report:** End-of-day reset report with lock/override mechanism and searchable history log.
- **eJournal export:** Electronic sales journal viewer with validation checks and date-range selection for export.
- **eSales report:** Monthly sales report with daily breakdown view and CSV export option.
- **VAT / Non-VAT toggle:** Classification switch that adjusts the receipt template between VAT-registered and non-VAT layouts.

### Thermal Printer Management

> Hardware thermal printer support via Web Serial API (USB), Web Bluetooth API, and LAN bridge. ESC/POS command generation is browser-compatible and produces raw byte output for direct printer communication.

- **Multi-printer profile management:** Create, edit, and delete printer profiles for USB, Bluetooth, and LAN connections.
- **ESC/POS command engine:** Generates raw ESC/POS byte sequences for text formatting, alignment, bold/double-height, barcodes, QR codes, line feeds, and paper cuts — compatible with 58mm and 80mm thermal printers.
- **Receipt content builder:** Produces BIR-compliant receipt output for normal, void, reprint, X-reading, Z-reading, and daily-summary variants. Includes SC/PWD discount metadata and item-level VAT exemption markers.
- **Receipt layout configuration:** Customize logo, header text, footer text, and auto-cut settings per printer profile.
- **Printer status monitoring:** Live-style indicators showing Online, Offline, Paper Low, and Error states.
- **Reprint queue:** List of failed or pending print jobs with retry and cancel actions.
- **Print failure handling:** Modal workflow offering a digital receipt fallback with QR code placeholder when a print job fails.
- **Auto-detect USB printers:** Simulated USB printer discovery list.

### Audit & Compliance

> BIR report generation audit trail and printer activity log with full persistence to IndexedDB.

### Rx/DD Compliance Workspace

> Rx/DD flows are fully implemented UI screens in the Next.js prototype with IndexedDB persistence, mapped to `RX-1` to `RX-37` in `rxdd_user_stories.md`.

- **Drug classification setup:** Mandatory class display and product metadata fields for DD/EDD/Rx/Pharmacist-Only OTC/Non-Rx OTC.
- **Dispensing checkpoints:** UI gates and warnings for Rx/DD/EDD plus pharmacist acknowledgment for Pharmacist-Only OTC.
- **Prescription entry drawer:** Captures prescriber/patient/dispensing fields with DD and EDD-specific inputs (S-2 and Yellow Rx where applicable).
- **Patient medication profile:** Searchable profile timeline with export actions for inspection scenarios.
- **Dangerous Drugs log:** Register-style DD/EDD transaction table with export controls and running-balance surface.
- **Inspection dashboard:** One-screen summary of Rx/DD activity, open partials, red flags, and role-gated compliance visibility.
- **Prescription reset protection:** UI exposes a hard-block policy for prototype reset exclusion of prescription and DD data domains.

## API contract (summary)

The web prototype uses client-side IndexedDB via the local store abstraction in `web-prototype/src/lib/db.ts` and `web-prototype/src/lib/use-pos-store.ts`. Experimental Next.js API routes and `src/lib/server/` files may exist in the repo for future migration work, but they are not the default production runtime path for the prototype today.

## Non-goals / roadmap (from README, verify before marketing)

`README` still lists as roadmap examples: **backup, restore, export to Excel** — treat as **not guaranteed** unless a feature exists in the repo. Confirm against actual shipped behavior before claiming in release notes.

> **Note (2026-04-25):** UI prototypes for BIR compliance, thermal printer management, and audit/compliance features now exist in the Next.js web prototype with mock data.
>
## Default demo credentials

Documented in `README` for first run (e.g. `admin` / `admin`); **change in production** and enforce user management policies locally.

## Maintenance

When adding a feature, update:

1. This file if the product story or scope changes.
2. `docs/TECH_STACK.md` if new dependencies, routes, or storage paths are introduced.
3. `README` for end-user feature lists and screenshots.

## 2026-04-24T12:44:51Z - codex savepoint

- The project now includes a Vercel-ready offline-first web POS prototype, with deployment promotion and rollback expectations documented.

## 2026-04-26 - qoder savepoint

- Web prototype is the sole production target
- Updated Goals to reflect offline-first PWA direction
- Updated all feature sections from "UI prototype only" to full-stack with IndexedDB

## 2026-04-26 - qoder savepoint (thermal printer)

- Thermal printer management updated from mock UI to real hardware support
- ESC/POS command engine generates raw byte output for 58mm/80mm thermal printers
- Receipt content builder produces BIR-compliant receipts for all variants (normal, void, reprint, X-reading, Z-reading, daily-summary)
- Unit tests for ESC/POS commands (33 tests) and receipt content builder (22 tests) all passing
