# TODO

## 2026-04-24T05:12:18Z - antigravity savepoint

- Begin first development task on PPOS

## 2026-04-24T12:44:51Z - codex savepoint

- Wire real preview/staging/production credentials and telemetry export backends, then run the first staged promotion with a rollback drill.

## 2026-04-30T00:00:00Z - codex integration consolidation task

- Create one **integration task** (target branch: `codex/integration`, fallback: latest completed Codex branch) that unifies and validates the following workflows end-to-end before merge to `main`:
  1. **Shift-close screen**: ensure shift close captures totals, variance, cashier metadata, and closing approvals.
  2. **Inventory adjustment reason codes**: enforce required reason code selection for positive/negative adjustments and include supervisor override when configured.
  3. **Security/reconciliation**: log privileged actions, reconcile declared vs counted amounts, and block close if unresolved critical variances exist.
  4. **Hold expiry/logging**: expire stale holds by policy window, emit audit log entries for auto/manual expiry, and preserve operator attribution.
  5. **Transaction/hold fields**: normalize persisted fields shared between finalized transactions and on-hold carts (timestamps, terminal/user IDs, shift ID, source, status, totals).
  6. **Metadata interfaces**: align TypeScript interfaces for cross-module metadata (`transaction.meta`, `hold.meta`, reconciliation payloads) and remove schema drift.
- Resolve integration conflicts in the consolidation branch, then open one final PR into `main` with:
  - A conflict-resolution summary.
  - A migration/data-compatibility note.
  - Test evidence covering shift-close, holds, reconciliation, and inventory adjustment flows.
