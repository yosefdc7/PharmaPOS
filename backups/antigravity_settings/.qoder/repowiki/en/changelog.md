# Changelog

## 2026-04-27 - Critical Security & Data Integrity Fixes

### Added
- `atomicSaleWrite()` helper in `db.ts` for atomic multi-store transactions (agent: codex)
- `pharmacists` prop to `RxDispensingPanel` component (agent: codex)
- `canPerformAction` prop to `ProductsView`, `CustomersView`, and `SettingsView` components (agent: codex)
- Authentication requirement to `/api/settings/reset` endpoint (agent: codex)
- Confirmation dialog for "Reset prototype data" button (agent: codex)

### Changed
- `completeSale()` now uses `atomicSaleWrite()` instead of separate `putMany`/`putOne` calls (agent: codex)
- `syncNow()` now wraps logic in `try/finally` with `setSyncing(false)` in `finally` block (agent: codex)
- All mutation buttons in `ProductsView`, `CustomersView`, and `SettingsView` now check permissions and disable when unauthorized (agent: codex)

### Fixed
- **CRITICAL**: `/api/settings/reset` endpoint was completely unauthenticated — now requires admin credentials (agent: codex)
- **CRITICAL**: `completeSale()` was non-atomic (stock could be decremented without transaction being saved) — now uses atomic IDB transaction (agent: codex)
- **CRITICAL**: `RxDispensingPanel` used hardcoded mock pharmacist data — now receives real pharmacist records via props (agent: codex)
- **HIGH**: Multiple mutation actions in `pos-prototype.tsx` lacked permission checks — now gated with `canPerformAction()` (agent: codex)
- **HIGH**: `syncNow()` could leave `syncing=true` forever if `runSync` threw — now properly reset in `finally` block (agent: codex)

### Security
- All data-mutating actions in Products, Customers, and Settings views now verify user permissions before executing (agent: codex)
- User creation, category management, and settings changes restricted to appropriate roles (agent: codex)
