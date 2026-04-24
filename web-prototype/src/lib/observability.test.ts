import { describe, expect, test } from "vitest";
import { buildSnapshot, evaluateAlerts } from "./observability";

describe("observability", () => {
  test("builds snapshot with expected business metrics", () => {
    const now = new Date("2026-04-24T07:00:00.000Z");
    const snapshot = buildSnapshot({
      now,
      pendingCreatedAt: ["2026-04-24T06:54:00.000Z", "2026-04-24T06:58:00.000Z"],
      offlineDurationSeconds: 310,
      events: [
        { ts: "2026-04-24T06:50:00.000Z", type: "order_completed", details: {} },
        { ts: "2026-04-24T06:55:00.000Z", type: "order_completed", details: {} },
        { ts: "2026-04-24T06:59:00.000Z", type: "payment_attempt", details: { status: "paid" } },
        { ts: "2026-04-24T06:59:10.000Z", type: "payment_attempt", details: { status: "failed" } },
        { ts: "2026-04-24T06:56:00.000Z", type: "mutation_failed", details: {} }
      ]
    });

    expect(snapshot.syncLagSeconds).toBe(360);
    expect(snapshot.queueDepth).toBe(2);
    expect(snapshot.failedMutations15m).toBe(1);
    expect(snapshot.paymentFailureRate15m).toBe(0.5);
    expect(snapshot.orderThroughputPerHour).toBe(2);
    expect(snapshot.offlineDurationSeconds).toBe(310);
  });

  test("raises alerts when SLOs are breached", () => {
    const alerts = evaluateAlerts({
      capturedAt: new Date("2026-04-24T07:00:00.000Z").toISOString(),
      syncLagSeconds: 1000,
      queueDepth: 60,
      failedMutations15m: 10,
      paymentFailureRate15m: 0.4,
      offlineDurationSeconds: 1200,
      orderThroughputPerHour: 4
    });

    expect(alerts.map((alert) => alert.id).sort()).toEqual([
      "mutation-failures",
      "offline-duration",
      "payment-failure-spike",
      "sync-backlog",
      "throughput-drop"
    ]);
  });
});
