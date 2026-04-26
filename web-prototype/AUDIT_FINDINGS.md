# PPOS Web Prototype QA Audit Findings

**Audit Date:** 2026-04-26 | **Scope:** `web-prototype/src/` — read-only audit.

**Summary:** CRITICAL: 4 | HIGH: 13 | MEDIUM: 14 | LOW: 4

---

## 1. Permission Propagation Gaps

| # | Sev | File:Line | Issue | Recommended Fix |
|---|-----|-----------|-------|-----------------|
| 1.1 | **HIGH** | `pos-prototype.tsx:870` | `ProductsView.submit()` saves product with **no permission check**. Cashier can create/edit products. | Add `canPerformAction("products")` guard before `save()`. |
| 1.2 | **HIGH** | `pos-prototype.tsx:895` | `toggleFeatured()` saves product with **no permission check**. | Gate with `canPerformAction("products")`. |
| 1.3 | **HIGH** | `pos-prototype.tsx:899` | `markExpired()` zeros stock with **no permission check**. | Gate with `canPerformAction("products")`. |
| 1.4 | **HIGH** | `pos-prototype.tsx:1507` | `SettingsView.submitSettings()` saves settings with **no permission check**. | Gate with `canPerformAction("settings")`. |
| 1.5 | **HIGH** | `pos-prototype.tsx:1529` | `submitCategory()` saves category with **no permission check**. | Gate with `canPerformAction("categories")`. |
| 1.6 | **HIGH** | `pos-prototype.tsx:1553` | `submitUser()` creates/edits users with **no permission check** — can assign admin role. | Gate with `canPerformAction("users")`. |
| 1.7 | **HIGH** | `pos-prototype.tsx:1691` | "Reset prototype data" button calls `reset()` with **no confirmation and no permission check**. | Add confirmation + `canPerformAction("settings")` gate. |
| 1.8 | **HIGH** | `pos-prototype.tsx:1427` | Customer delete button calls `remove()` with **no permission check**. | Gate with `canPerformAction("customers")`. |
| 1.9 | **MEDIUM** | `pos-prototype.tsx:477` | `holdCurrentOrder()` accessible without `transactions` permission check. | Add permission gate. |
| 1.10 | **MEDIUM** | `pos-prototype.tsx:485` | `resumeHeldOrder()` accessible without permission check. | Add permission gate. |

---

## 2. State Management Logic

| # | Sev | File:Line | Issue | Recommended Fix |
|---|-----|-----------|-------|-----------------|
| 2.1 | **CRITICAL** | `use-pos-store.ts:335-484` | `completeSale()` is **not atomic**: stock decremented via `putMany`, then transaction saved via `putOne`. If second fails, stock is reduced with no rollback. | Wrap stock + transaction in single IDB transaction or implement rollback. |
| 2.2 | **HIGH** | `use-pos-store.ts:567-589` | `syncNow()` sets `setSyncing(false)` **after** `.catch()` that re-throws. If `runSync` throws, `syncing` stays `true` forever. | Move `setSyncing(false)` to `finally`. |
| 2.3 | **MEDIUM** | `use-pos-store.ts:723-733` | `switchUser()` sets `currentUser` from `users` array without re-auth or session validation. | Re-run `loginLocal()` or validate session TTL. |
| 2.4 | **MEDIUM** | `use-pos-store.ts:207-259` | Boot effect adds event listeners but doesn't remove them if `boot()` throws. | Ensure cleanup in error path. |

---

## 3. IndexedDB Schema & Data Integrity

| # | Sev | File:Line | Issue | Recommended Fix |
|---|-----|-----------|-------|-----------------|
| 3.1 | **MEDIUM** | `db.ts:173-179` | `ensureStores()` creates 19 stores but **adds no indexes** on high-volume stores (`transactions`, `products`, `syncQueue`). | Add indexes for `createdAt`, `status`, `categoryId`. |
| 3.2 | **MEDIUM** | `db.ts:394-421` | `enqueueSync()` swallows `getOne()` errors with `.catch(() => undefined)`. All failures get `entityVersion: 1`. | Log error and surface to caller. |
| 3.3 | **MEDIUM** | `db.ts:181-241` | Migrations add stores but never add indexes for upgraded DBs. | Add V8 migration for indexes. |

---

## 4. Type System Consistency

| # | Sev | File:Line | Issue | Recommended Fix |
|---|-----|-----------|-------|-----------------|
| 4.1 | **MEDIUM** | `types.ts:529` | `AuditEntry.requiredRole` uses inline union instead of `UserRole`. | Refactor to `requiredRole: UserRole`. |
| 4.2 | **MEDIUM** | `types.ts:219` | `RxPharmacist.role` uses `"pharmacist" \| "admin"` which conflates with `UserRole`. | Rename or align with `UserRole`. |
| 4.3 | **MEDIUM** | `db.ts:282,530,586,600` | Multiple `as unknown` / `as any` casts bypass type safety. | Remove casts via proper generic typing. |

---

## 5. Component-Level Silent Failures

| # | Sev | File:Line | Issue | Recommended Fix |
|---|-----|-----------|-------|-----------------|
| 5.1 | **CRITICAL** | `rx-dispensing-panel.tsx:14-16` | Uses **hardcoded mock pharmacists** instead of prop. Modal bypasses real pharmacist verification. | Consume `pharmacists` from props; validate PRC against real records. |
| 5.2 | **HIGH** | `x-reading.tsx:42`, `z-reading.tsx:46` | `generatedBy: "Current User"` is **hardcoded string**, not actual username. | Pass `currentUser` and use `currentUser.username`. |
| 5.3 | **HIGH** | `audit-trail.tsx:23` | `USER_OPTIONS` hardcoded to `["Maria Santos", "Juan Cruz", "Admin"]` — doesn't match seeded users. | Dynamically populate from `users` array. |
| 5.4 | **MEDIUM** | `pos-prototype.tsx:720` | `buildProductDraft({ categoryId: categories[0]?.id })` — if categories empty, `categoryId` is empty string. | Add empty-state guard. |

---

## 6. Server-Side / API Route Risks

| # | Sev | File:Line | Issue | Recommended Fix |
|---|-----|-----------|-------|-----------------|
| 6.1 | **CRITICAL** | `api/settings/reset/route.ts:6` | `POST()` has **zero auth**. Any client can truncate all tables and re-seed. | Add auth middleware; restrict to admin. |
| 6.2 | **HIGH** | `api/users/route.ts:37` | `POST()` creates users with no auth — can create admin via curl. | Add auth + `users` permission check. |
| 6.3 | **HIGH** | `api/users/[id]/route.ts:44` | `PUT()` / `DELETE()` have no auth check. | Add auth + role restriction. |
| 6.4 | **HIGH** | `api/products/route.ts:45` | `POST()` accepts batch product inserts with no auth. | Add auth + `products` permission. |
| 6.5 | **HIGH** | `api/transactions/route.ts:87` | `POST()` accepts raw transactions with no validation or auth. | Add auth + schema validation. |
| 6.6 | **HIGH** | `api/payments/refund/route.ts:5` | `POST()` processes refunds with no auth or permission check. | Add auth + `refund` permission. |
| 6.7 | **HIGH** | `api/sync/process/route.ts:124` | `POST()` runs sync engine with no auth. | Add auth + `sync` permission. |
| 6.8 | **HIGH** | `api/feature-flags/route.ts:25` | `PATCH()` updates flags with no auth. | Add auth + `settings` permission. |
| 6.9 | **MEDIUM** | `api/sync/process/route.ts:84,105` | `upsertEntity()` interpolates `${table}` and `${columns}` into SQL. | Use parameterized queries; avoid dynamic table names. |
| 6.10 | **MEDIUM** | `api/users/login/route.ts:6` | No rate limiting on login. | Add exponential backoff / IP rate limit. |
| 6.11 | **MEDIUM** | `api/users/route.ts:46` | `POST()` defaults password to `"admin"` if omitted. | Reject missing password with 400. |

---

## 7. Edge Cases in Business Logic

| # | Sev | File:Line | Issue | Recommended Fix |
|---|-----|-----------|-------|-----------------|
| 7.1 | **HIGH** | `x-reading.tsx:74-85` | `handleGenerate()` has **no deduplication** — unlimited X-Readings per day possible. | Check existing `xReadings` for same `reportDate` before generating. |
| 7.2 | **HIGH** | `z-reading.tsx:108-139` | Override allows second Z-Reading same day; **does not invalidate first**. Duplicate OR series counts. | Invalidate previous same-day Z-Reading or block entirely. |
| 7.3 | **MEDIUM** | `use-pos-store.ts:292-313` | `addToCart()` does **not verify pharmacist role** for prescription items. | Add `rx` permission check for `isPrescription`/`behindCounter` items. |
| 7.4 | **MEDIUM** | `use-pos-store.ts:315-320` | `updateCartQuantity()` allows quantity above current stock. | Clamp to `product.quantity - cartQty`. |
| 7.5 | **MEDIUM** | `use-pos-store.ts:476-481` | `completeSale()` catch re-throws but stock already mutated. | See 2.1 — make atomic or rollback. |
| 7.6 | **MEDIUM** | `use-pos-store.ts:667-688` | `PaymentStatus` has no `"voided"` state — voids modeled as refunds. Clarify intent. | Add `"voided"` to `PaymentStatus` or rename function. |

---

## 8. Test Coverage Gaps

| # | Sev | File:Line | Issue | Recommended Fix |
|---|-----|-----------|-------|-----------------|
| 8.1 | **MEDIUM** | `use-pos-store.test.tsx` | Only 3 boot-flow tests. **Zero coverage** for `completeSale`, `refundTransaction`, `holdOrder`, `syncNow`, `saveEntity`, `removeEntity`, `applyScPwdDiscount`, `switchUser`, and 11+ other store functions. | Add unit tests for all store actions. |
| 8.2 | **MEDIUM** | `src/components/` | 25+ components untested: `audit-trail`, `bir-reports`, `bir-settings`, `control-tower`, `rx-dispensing-panel`, `z-reading`, `override-modal`, etc. | Prioritize tests for permission-gated and mutation components. |
| 8.3 | **MEDIUM** | `src/app/api/` | API routes have **zero unit tests** (only infra tests in `auth.test.ts`, `db.test.ts`). | Add route-level tests for `POST /settings/reset`, `POST /users`, `POST /transactions`, `POST /payments/refund`. |
| 8.4 | **LOW** | `pos-prototype.test.tsx` | Tests mock `saveEntity`/`removeEntity` but only verify calls, not upstream permission checks. | Add role-specific render tests (cashier view) to assert buttons are absent. |

---

## Top 5 Priority Fixes

1. **Protect `/api/settings/reset`** with auth + admin-only restriction (CRITICAL).
2. **Make `completeSale()` atomic** or add rollback to prevent inventory loss (CRITICAL).
3. **Fix `rx-dispensing-panel.tsx`** to use real pharmacist records, not hardcoded mocks (CRITICAL).
4. **Add `canPerformAction()` guards** to every mutation in `ProductsView`, `CustomersView`, `SettingsView` (HIGH).
5. **Fix `syncNow()` stuck-syncing bug** by moving `setSyncing(false)` to `finally` (HIGH).
