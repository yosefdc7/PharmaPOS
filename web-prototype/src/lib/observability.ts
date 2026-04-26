export type LogLevel = "info" | "warn" | "error";

export type TelemetryEvent = {
  ts: string;
  type:
    | "sync_enqueued"
    | "sync_completed"
    | "sync_failed"
    | "mutation_failed"
    | "payment_attempt"
    | "network_state"
    | "order_completed"
    | "login"
    | "logout"
    | "storage_persistence"
    | "scpwd_applied"
    | "scpwd_removed";
  details: Record<string, unknown>;
};

export type SloTargets = {
  maxSyncLagSeconds: number;
  maxQueueDepth: number;
  maxFailedMutationsPer15m: number;
  maxPaymentFailureRate: number;
  maxOfflineDurationSeconds: number;
  minOrdersPerHour: number;
};

export type ObservabilitySnapshot = {
  capturedAt: string;
  syncLagSeconds: number;
  queueDepth: number;
  failedMutations15m: number;
  paymentFailureRate15m: number;
  offlineDurationSeconds: number;
  orderThroughputPerHour: number;
};

export type Alert = {
  id: string;
  severity: "warning" | "critical";
  summary: string;
  runbook: string;
};

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

function cutoffMs(windowMs: number, now: Date) {
  return now.getTime() - windowMs;
}

export function logStructured(level: LogLevel, event: string, payload: Record<string, unknown>) {
  const record = {
    ts: new Date().toISOString(),
    level,
    event,
    payload
  };

  if (level === "error") {
    console.error(JSON.stringify(record));
    return;
  }

  if (level === "warn") {
    console.warn(JSON.stringify(record));
    return;
  }

  console.info(JSON.stringify(record));
}

export async function traced<T>(name: string, tags: Record<string, unknown>, run: () => Promise<T>) {
  const started = performance.now();
  const traceId = crypto.randomUUID();
  logStructured("info", "trace.start", { traceId, name, ...tags });

  try {
    const result = await run();
    logStructured("info", "trace.end", {
      traceId,
      name,
      durationMs: Number((performance.now() - started).toFixed(2)),
      status: "ok"
    });
    return result;
  } catch (error) {
    logStructured("error", "trace.end", {
      traceId,
      name,
      durationMs: Number((performance.now() - started).toFixed(2)),
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
    throw error;
  }
}

export const defaultSloTargets: SloTargets = {
  maxSyncLagSeconds: 300,
  maxQueueDepth: 25,
  maxFailedMutationsPer15m: 5,
  maxPaymentFailureRate: 0.05,
  maxOfflineDurationSeconds: 900,
  minOrdersPerHour: 12
};

export function buildSnapshot(params: {
  events: TelemetryEvent[];
  pendingCreatedAt: string[];
  now?: Date;
  offlineDurationSeconds: number;
}): ObservabilitySnapshot {
  const now = params.now || new Date();
  const pendingMs = params.pendingCreatedAt
    .map((createdAt) => new Date(createdAt).getTime())
    .filter((value) => Number.isFinite(value));

  const oldestPending = pendingMs.length > 0 ? Math.min(...pendingMs) : now.getTime();
  const syncLagSeconds = pendingMs.length > 0 ? Math.max(0, Math.round((now.getTime() - oldestPending) / 1000)) : 0;

  const failedMutations15m = params.events.filter((event) => {
    if (event.type !== "mutation_failed") return false;
    return new Date(event.ts).getTime() >= cutoffMs(FIFTEEN_MINUTES, now);
  }).length;

  const paymentAttempts = params.events.filter((event) => {
    if (event.type !== "payment_attempt") return false;
    return new Date(event.ts).getTime() >= cutoffMs(FIFTEEN_MINUTES, now);
  });
  const paymentFailures = paymentAttempts.filter((event) => event.details.status !== "paid").length;

  const orderThroughputPerHour = params.events.filter((event) => {
    if (event.type !== "order_completed") return false;
    return new Date(event.ts).getTime() >= cutoffMs(ONE_HOUR, now);
  }).length;

  return {
    capturedAt: now.toISOString(),
    syncLagSeconds,
    queueDepth: params.pendingCreatedAt.length,
    failedMutations15m,
    paymentFailureRate15m: paymentAttempts.length > 0 ? Number((paymentFailures / paymentAttempts.length).toFixed(3)) : 0,
    offlineDurationSeconds: Math.max(0, Math.round(params.offlineDurationSeconds)),
    orderThroughputPerHour
  };
}

export function evaluateAlerts(snapshot: ObservabilitySnapshot, slo: SloTargets = defaultSloTargets): Alert[] {
  const alerts: Alert[] = [];

  if (snapshot.queueDepth > slo.maxQueueDepth || snapshot.syncLagSeconds > slo.maxSyncLagSeconds) {
    alerts.push({
      id: "sync-backlog",
      severity: snapshot.queueDepth > slo.maxQueueDepth * 2 ? "critical" : "warning",
      summary: `Sync Online backlog above SLO (depth ${snapshot.queueDepth}, lag ${snapshot.syncLagSeconds}s).`,
      runbook: "docs/runbooks/sync-backlog.md"
    });
  }

  if (snapshot.paymentFailureRate15m > slo.maxPaymentFailureRate) {
    alerts.push({
      id: "payment-failure-spike",
      severity: snapshot.paymentFailureRate15m > slo.maxPaymentFailureRate * 2 ? "critical" : "warning",
      summary: `Payment failure rate is ${(snapshot.paymentFailureRate15m * 100).toFixed(1)}% over 15m.`,
      runbook: "docs/runbooks/terminal-mismatch.md"
    });
  }

  if (snapshot.failedMutations15m > slo.maxFailedMutationsPer15m) {
    alerts.push({
      id: "mutation-failures",
      severity: "critical",
      summary: `Failed local mutations exceeded threshold (${snapshot.failedMutations15m}/15m).`,
      runbook: "docs/runbooks/register-outage.md"
    });
  }

  if (snapshot.offlineDurationSeconds > slo.maxOfflineDurationSeconds) {
    alerts.push({
      id: "offline-duration",
      severity: "warning",
      summary: `Register offline for ${snapshot.offlineDurationSeconds}s.`,
      runbook: "docs/runbooks/register-outage.md"
    });
  }

  if (snapshot.orderThroughputPerHour < slo.minOrdersPerHour) {
    alerts.push({
      id: "throughput-drop",
      severity: "warning",
      summary: `Order throughput dropped to ${snapshot.orderThroughputPerHour}/hr.`,
      runbook: "docs/runbooks/register-outage.md"
    });
  }

  return alerts;
}
