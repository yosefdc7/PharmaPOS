# Runbook: Rollback

## Trigger

- New release causes severe operational degradation (critical alerts sustained).

## Preconditions

- Incident commander assigned.
- Last known good release identified.

## Triage + rollback steps (<=15 min)

1. Declare incident and pause additional deployments.
2. Snapshot current telemetry (alerts, queue depth, failure rate).
3. Roll back to last known good build.
4. Re-run smoke flow: login -> add item -> complete sale -> sync now.
5. Monitor observability metrics for 10 minutes after rollback.

## Recovery validation

- Critical alerts clear.
- Sync and payment metrics return within SLO boundaries.
- Incident summary documented with root-cause follow-up action.
