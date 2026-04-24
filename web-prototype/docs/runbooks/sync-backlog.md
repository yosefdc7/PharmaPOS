# Runbook: Sync Backlog

## Trigger

- Sync queue depth > 25 or lag > 300s.

## Detect

- Alert: `sync-backlog`.
- Metrics: elevated queue depth and sync lag.

## Triage steps (<=15 min)

1. Verify register connectivity status (online/offline toggle + browser network).
2. If online, run **Sync now** and confirm queue flush progress.
3. Identify oldest pending mutation type (transaction/product/etc.).
4. Check for repeated `sync.failed` traces in console logs.
5. If backlog keeps growing, freeze non-essential catalog edits and escalate.

## Recovery validation

- Queue depth decreases continuously.
- Sync lag trends below 300s.
- No repeated sync failure logs in last 10 minutes.
