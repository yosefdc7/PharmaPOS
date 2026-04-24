# Observability and On-Call Triage

This prototype now emits structured logs (`console.info/warn/error` JSON), trace spans (`trace.start` / `trace.end`), and business telemetry events for key POS operations.

## Core metrics and SLOs

- **Sync lag**: oldest pending queue item age in seconds. **SLO:** <= 300s.
- **Queue depth**: pending sync queue length. **SLO:** <= 25.
- **Failed mutations (15m)**: local write failures over rolling 15 minutes. **SLO:** <= 5.
- **Payment failure rate (15m)**: failed/non-paid payment attempts over 15 minutes. **SLO:** <= 5%.
- **Offline duration**: continuous + cumulative offline seconds for current register session. **SLO:** <= 900s.
- **Order throughput**: completed orders in trailing hour. **SLO:** >= 12/hr.

## Alerting policy

The Sync tab evaluates alerts live from SLO breaches:

1. `sync-backlog` (warning/critical): queue depth or lag threshold exceeded.
2. `payment-failure-spike` (warning/critical): payment failure rate exceeds SLO.
3. `mutation-failures` (critical): failed local mutations exceed threshold.
4. `offline-duration` (warning): register offline too long.
5. `throughput-drop` (warning): order throughput drops below target.

Each alert links directly to the relevant runbook.

## 15-minute triage target

On-call should use this sequence to triage in under 15 minutes:

1. Open **Sync -> Observability** and list active alerts.
2. Prioritize critical alerts (`mutation-failures`, high `sync-backlog`, payment spikes).
3. Open linked runbook and execute immediate containment steps.
4. Validate metrics trend back within SLO before clearing incident.
5. Capture timeline and remediation in incident notes.
