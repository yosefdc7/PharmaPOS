# Runbook: Terminal Mismatch / Payment Error Spike

## Trigger

- Payment failure rate > 5% over 15 minutes.

## Detect

- Alert: `payment-failure-spike`.
- Logs: payment attempts with non-`paid` status.

## Triage steps (<=15 min)

1. Compare POS payment reference with terminal receipts for latest failed attempts.
2. Validate terminal is connected to the correct store/register profile.
3. Temporarily route to cash/manual fallback for affected lane.
4. Retry one low-value terminal transaction and verify success telemetry.
5. If mismatch persists, capture sample references and escalate to payments support.

## Recovery validation

- Payment failure rate returns to <=5%.
- Terminal references align with transaction records.
- No new mismatch complaints from cashier.
