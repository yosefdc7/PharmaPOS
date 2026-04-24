# Runbook: Register Outage

## Trigger

- POS UI non-responsive, repeated mutation failures, or throughput collapse.

## Detect

- Alert: `mutation-failures` or `throughput-drop`.
- Logs: `mutation.failed`, `trace.end` with `status:error`.

## Triage steps (<=15 min)

1. Confirm whether outage is single-register or multi-register.
2. Switch register to offline mode to preserve local writes if network is unstable.
3. Restart the POS client session and validate IndexedDB availability.
4. Execute a test sale (cash) and ensure order completion telemetry increments.
5. If unresolved, fail over to backup register and escalate to engineering.

## Recovery validation

- Failed mutations drop below threshold.
- Throughput recovers toward >=12/hr baseline.
- No new critical alerts for 10 minutes.
