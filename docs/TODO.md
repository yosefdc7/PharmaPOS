# TODO

## 2026-04-24T05:12:18Z - antigravity savepoint

- Begin first development task on PPOS

## 2026-04-24T12:44:51Z - codex savepoint

- Wire real preview/staging/production credentials and telemetry export backends, then run the first staged promotion with a rollback drill.

## Integration consolidation (next execution)

- [ ] Create `codex/integration` from the latest completed Codex branch.
- [ ] Merge and reconcile the following completed work items into `codex/integration`:
  1. Shift-close screen functionality.
  2. Inventory adjustment reason codes.
  3. Security and reconciliation features.
  4. Configurable hold expiry and detailed logging.
  5. Transaction and hold field additions/normalization.
  6. Shared metadata interfaces.
- [ ] Resolve all merge conflicts and document the resolution decisions.
- [ ] Run/collect integration test evidence for shift-close, inventory adjustments, holds, and reconciliation.
- [ ] Open one final PR from `codex/integration` to `main` with:
  - Conflict-resolution summary.
  - Migration/data compatibility notes.
  - End-to-end validation evidence.
