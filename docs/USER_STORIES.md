# PharmaSpot User Stories

Derived from `docs/PRD.md`, `shared-memory/state.md`, `README.md`, and the current web prototype implementation in `web-prototype/src/components/pos-prototype.tsx` and `web-prototype/src/lib/use-pos-store.ts`.

## Product-Wide Stories (PharmaSpot Intent)

| ID | As a... | I want... | So that... |
|---|---|---|---|
| P-1 | Pharmacy owner / lead tech | The POS to work as a single store with optional LAN access to one logical database | Staff on different PCs see consistent stock and sales |
| P-2 | Cashier | Barcode- and search-led selling with fast add-to-till and payment | Checkout stays fast at peak times |
| P-3 | Inventory manager / pharmacist-in-charge | Stock levels, low-stock signals, and expiry awareness where implemented | We avoid stockouts and unsafe dispensing |
| P-4 | Manager | Staff accounts, permissions, and filterable transaction history | We can audit actions and investigate discrepancies |
| P-5 | Owner | Data to stay in local/controlled storage (not cloud-only SaaS) | The pharmacy keeps custody of operational data |
| P-6 | IT / operations | Desktop auto-update support | Workstations stay patched without manual reinstall |
| P-7 | Operations (roadmap) | Backup, restore, and export capabilities | We can recover quickly and perform offline analysis |
| P-8 | Platform team | Preview -> staging -> production promotion with rollback drills and telemetry wired | Incidents are observable and rollbacks are proven |

## Web Prototype Stories: Session and App Shell

| ID | As a... | I want... | So that... |
|---|---|---|---|
| W-1 | Evaluator | A clear boot state while IndexedDB loads, and a clear error if local DB initialization fails | I trust startup behavior and can diagnose failures |
| W-2 | Demo user | Quick role-based entry as seeded users (admin/cashier) | I can evaluate flows quickly without full auth setup |
| W-3 | Any user | A collapsible side nav with POS, Products, Customers, Settings, Reports, and Sync Online views plus pending-sync badge | I can move between tasks and see queue pressure |
| W-4 | User | Top-bar online/offline status, including forced-offline toggle, with local-write context | I understand connectivity and data-local behavior |
| W-5 | Trainer | In-session user switching from a dropdown | I can demonstrate role behavior in one session |

## Web Prototype Stories: POS Selling Flow

| ID | As a... | I want... | So that... |
|---|---|---|---|
| S-1 | Cashier | Search products by name, SKU/barcode, supplier, and filter by category | I find products quickly |
| S-2 | Cashier | Product sorting (recent/newest/oldest/top-sold) | I can prioritize likely items |
| S-3 | Cashier | Low-stock visual indicators on product cards | I avoid overselling and can warn customers |
| S-4 | Cashier | Add to cart, adjust quantities, remove lines, and clear cart | I can correct mistakes quickly |
| S-5 | Cashier | Assign a customer to the current sale (including walk-in) | Sales are attributed properly |
| S-6 | Cashier | Apply discount, view VAT/totals, and add remarks | The ticket matches pricing policy and context |
| S-7 | Cashier | Process cash and external terminal flows with references | Payment capture matches real checkout operations |
| S-8 | Cashier | Complete sale and view/print receipt | The customer gets proof of purchase |
| S-9 | Cashier | Hold orders with reference and resume later | I can park interrupted transactions |
| S-10 | System | Decrement stock and enqueue sync mutations on sale completion | Inventory and sync state remain consistent |

## Web Prototype Stories: Products and Inventory Admin

| ID | As a... | I want... | So that... |
|---|---|---|---|
| I-1 | Inventory clerk | Searchable, filterable, sortable, paginated inventory table | I can manage large catalogs efficiently |
| I-2 | Inventory clerk | Expired / near-expiry alert banner based on configured threshold | I can prioritize at-risk stock |
| I-3 | Inventory clerk | Add/edit product drawer with pricing, stock, expiry, feature flag, and visual attributes | I can maintain product master data from one place |
| I-4 | Inventory clerk | Quick actions: toggle featured, adjust stock, mark expired | I can perform operational corrections fast |
| I-5 | Inventory clerk | Delete products when needed | I can clean up invalid or duplicate records |

## Web Prototype Stories: Customers

| ID | As a... | I want... | So that... |
|---|---|---|---|
| C-1 | Front staff | Customer listing with newest/alphabetical sort | I can find records quickly |
| C-2 | Front staff | Add customers with name, phone, and email | We can build a usable customer database |
| C-3 | Front staff | Delete non-protected customer records (walk-in preserved) | Data remains clean without breaking default flows |

## Web Prototype Stories: Settings

| ID | As a... | I want... | So that... |
|---|---|---|---|
| T-1 | Admin | Manage store details, currency, VAT/tax behavior, receipt footer, and expiry alert threshold | Store behavior matches operations and compliance |
| T-2 | Admin | Add/delete categories and quickly mark edits for sync-path testing | Category maintenance and sync verification are easy |
| T-3 | Admin | Add users with role (cashier/admin) and delete removable users | Team setup is manageable in-app |
| T-4 | Admin | Reset prototype data | I can return demos/testing to a known baseline |

## Web Prototype Stories: Reports

| ID | As a... | I want... | So that... |
|---|---|---|---|
| R-1 | Manager | Sales summary metrics (total, transaction count, today, customer count) | I can monitor business pulse quickly |
| R-2 | Manager | Lists for expired, near-expiry, and low-stock products | I can prioritize inventory action |
| R-3 | Manager | Recent transactions showing amount, method, and sync status | I can spot reconciliation and sync issues |

## Web Prototype Stories: Sync and Observability

| ID | As a... | I want... | So that... |
|---|---|---|---|
| O-1 | Operations | A queue view of pending/synced/failed mutations and a manual Sync Online trigger | I can operate and test offline-first sync behavior |
| O-2 | Operations | Observability metrics (lag, queue depth, failed mutations, payment failure rate, offline duration, throughput) with SLO context | I can assess operational health quickly |
| O-3 | Operations | Active alerts linked to runbooks | I can move from detection to remediation fast |

## Desktop/API Parity and Migration Stories

| ID | As a... | I want... | So that... |
|---|---|---|---|
| D-1 | Cashier | Full on-hold/customer-order and transaction query workflows reflected in desktop APIs | Complex pharmacy workflows are supported in production |
| D-2 | Manager | Credentialed user authentication (not only profile switching) | User accountability is production-ready |
| D-3 | Owner | Full branding and robust receipt/print behavior parity | Output quality matches pharmacy brand standards |

## Domain Story Packs

- Rx/DD Classification and Prescription Log stories are maintained in `rxdd_user_stories.md` (`RX-1` to `RX-37`).
- SC/PWD compliance stories are maintained in `scpwd_user_stories.md`.
- Thermal printer stories are maintained in `thermal_printer_user_stories.md`.

## Notes

- Stories above intentionally distinguish product intent, current web-prototype scope, and parity/migration needs.
- Roadmap items from `README.md` (backup/restore/export) should be treated as planned until verified as implemented.
