## 2026-04-25 - Savepoint

### Added
- SC/PWD UI integration into web-prototype:
  - Extended `types.ts` with SC/PWD types (`ScPwdSettings`, `ScPwdDiscountType`, `ScPwdCustomerDetails`, `ScPwdEligibility`, `ScPwdTransactionLogRow`, `ScPwdSummaryCard`, `ProxyPurchaseDetails`, `ScPwdAlert`) and extended `Product`, `CartItem`, `Transaction`, `Settings`, `HeldOrder`, `AuditActionType`.
  - Added SC/PWD calculation helpers in `calculations.ts`: VAT-registered vs non-VAT logic, per-line discount preview, mixed-cart breakdown, duplicate-discount guards, two-decimal rounding.
  - Extended `seed.ts` with realistic medicine/non-medicine, VAT-exempt, prescription, and OTC examples with SC/PWD flags.
  - Extended `use-pos-store.ts` with SC/PWD state (`scPwdDraft`, `activeScPwdDiscount`, `scPwdTransactionLog`, `scPwdAlerts`) and actions (`applyScPwdDiscount`, `removeScPwdDiscount`, `validateScPwdEligibility`, `getScPwdSummary`, `acknowledgeScPwdAlert`).
  - Created focused SC/PWD components: `scpwd-discount-modal.tsx`, `scpwd-breakdown-card.tsx`, `scpwd-eligibility-warning.tsx`, `scpwd-transaction-log.tsx`, `scpwd-summary-card.tsx`.
  - Integrated SC/PWD into `pos-prototype.tsx`: POS checkout flow (button, modal, breakdown), Products admin (eligibility chips, filters, edit form), Settings tab extension via `bir-settings.tsx`, Reports tab extension via `bir-reports.tsx`.
  - Extended `bir-settings.tsx` with SC/PWD settings panel: enable toggle, fixed 20% rate, VAT registration reuse, default medicine behavior, duplicate-ID threshold, daily alert threshold.
  - Extended `bir-reports.tsx` with SC/PWD tab: transaction log table, CSV export, monthly summary, deductibles report, duplicate-use alert, daily high-volume alert.
  - Extended `receipt-preview.tsx` with SC/PWD fields: customer name, ID type/number, TIN, per-item VAT-exempt/discount lines, VAT-EXEMPT label, SC/PWD discount label, proxy note, signature line.
  - Extended `audit-trail.tsx` with SC/PWD apply/remove/override events in audit stream.
  - Added unit tests in `calculations.test.ts` for VAT-registered formula, non-VAT formula, VAT-exempt item handling, mixed eligible/non-eligible cart math, duplicate-discount blocking, and rounding.
  - Extended `observability.ts` telemetry event types with `scpwd_applied` and `scpwd_removed`.

### Changed
- `calculateCartTotals` behavior in `use-pos-store.ts` now delegates to SC/PWD-aware helpers when `activeScPwdDiscount` is true.
- `completeSale` in `use-pos-store.ts` now preserves SC/PWD metadata into transactions and logs rows into `scPwdTransactionLog`.
- `holdOrder` / `resumeHeldOrder` in `use-pos-store.ts` now preserve and restore `scPwdDiscountActive` and `scPwdDraft`.

### Fixed
- N/A

### Removed
- N/A
