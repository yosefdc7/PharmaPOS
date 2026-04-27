import type {
  ConflictResolutionStrategy as ConflictResolutionStrategyType,
  SyncConflict,
  SyncQueueItem,
  SyncQueueItemEntity,
} from "./types";
import {
  getAll,
  getByIndex,
  getFeatureFlags,
  getLastPullTimestamp,
  getOne,
  markTransactionsAsSynced,
  purgeSyncedItems,
  putOne,
  setLastPullTimestamp,
  type StoreName,
} from "./db";
import { logStructured } from "./observability";

export type { ConflictResolutionStrategyType as ConflictResolutionStrategy };

const BASE = process.env.NEXT_PUBLIC_API_BASE || "";
const MAX_RETRIES = 5;
const BACKOFF_BASE_MS = 5000;
const BACKOFF_MAX_MS = 5 * 60 * 1000;

const ENTITY_STORE_MAP: Record<SyncQueueItemEntity, StoreName> = {
  product: "products",
  category: "categories",
  customer: "customers",
  user: "users",
  settings: "settings",
  transaction: "transactions",
  "held-order": "heldOrders",
};

const ENTITY_API_MAP: Record<SyncQueueItemEntity, string> = {
  product: "products",
  category: "categories",
  customer: "customers",
  user: "users",
  settings: "settings",
  transaction: "transactions",
  "held-order": "held-orders",
};

type SyncResult = {
  id: string;
  entity: SyncQueueItem["entity"];
  operation: SyncQueueItem["operation"];
  status: "synced" | "failed" | "conflict" | "retry";
  error?: string;
  conflict?: SyncConflict;
};

type PullReport = {
  fetched: number;
  applied: number;
  conflicts: number;
  failures: number;
};

type SyncReport = {
  processed: number;
  synced: number;
  conflicts: number;
  failures: number;
  retries: number;
  results: SyncResult[];
  pull: PullReport;
};

type RemoteProcessResponse = {
  success: boolean;
  processed: number;
  results: Array<{
    id: string;
    entity: SyncQueueItem["entity"];
    operation: SyncQueueItem["operation"];
    status: "synced" | "failed" | "conflict" | "retry";
    error?: string;
    conflict?: SyncConflict;
  }>;
};

let autoSyncCleanup: (() => void) | null = null;

let syncInProgress = false;

function getEntityId(payload: unknown): string {
  if (typeof payload === "object" && payload !== null && "id" in payload) {
    return String((payload as Record<string, unknown>).id ?? "");
  }
  return "";
}

function payloadVersion(payload: unknown): number {
  if (typeof payload === "object" && payload !== null && typeof (payload as { version?: unknown }).version === "number") {
    return (payload as { version: number }).version;
  }
  return 1;
}

function getBackoffDelayMs(retryCount: number): number {
  return Math.min(2 ** Math.max(0, retryCount) * BACKOFF_BASE_MS, BACKOFF_MAX_MS);
}

function shouldProcessNow(item: SyncQueueItem, nowMs: number): boolean {
  if (item.retryCount <= 0) return true;
  if (!item.lastAttemptAt) return true;
  const lastAttemptMs = new Date(item.lastAttemptAt).getTime();
  if (Number.isNaN(lastAttemptMs)) return true;
  const elapsed = nowMs - lastAttemptMs;
  return elapsed >= getBackoffDelayMs(item.retryCount);
}

export function validatePayload(entity: SyncQueueItemEntity, operation: SyncQueueItem["operation"], payload: unknown): string | null {
  if (operation === "delete") {
    return getEntityId(payload) ? null : "Delete operation payload must include a valid id.";
  }

  if (typeof payload !== "object" || payload === null) {
    return "Payload must be an object.";
  }

  const data = payload as Record<string, unknown>;
  if (!data.id || typeof data.id !== "string") {
    return "Payload must include string id.";
  }

  const requiredByEntity: Record<SyncQueueItemEntity, string[]> = {
    product: ["name", "price"],
    category: ["name"],
    customer: ["name"],
    user: ["username", "role"],
    settings: ["id", "store"],
    transaction: ["localNumber", "items", "total"],
    "held-order": ["reference", "items", "customerId"],
  };

  const required = requiredByEntity[entity] ?? [];
  const missing = required.filter((field) => data[field] === undefined || data[field] === null);
  if (missing.length > 0) {
    return `Missing required fields: ${missing.join(", ")}.`;
  }

  return null;
}

async function submitSyncBatch(items: SyncQueueItem[]): Promise<void> {
  if (items.length === 0) return;

  const response = await fetch(`${BASE}/api/sync-queue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Remote queue submit failed: ${response.status} ${response.statusText} ${errorText}`);
  }

  const body = (await response.json().catch(() => ({}))) as { rejected?: Array<{ reason?: string }> };
  if (Array.isArray(body.rejected) && body.rejected.length > 0) {
    throw new Error(body.rejected[0]?.reason || "Remote queue rejected one or more sync items.");
  }
}

async function triggerRemoteProcess(
  strategy: ConflictResolutionStrategyType,
  maxItems: number
): Promise<RemoteProcessResponse> {
  const response = await fetch(`${BASE}/api/sync/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ strategy, maxItems }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Remote process failed: ${response.status} ${response.statusText} ${errorText}`);
  }

  return (await response.json()) as RemoteProcessResponse;
}

export function detectConflict(
  item: SyncQueueItem,
  remote: { version: number; data: unknown }
): SyncConflict | null {
  if (item.operation === "create") {
    if (remote.data !== null) {
      return {
        syncItemId: item.id,
        entity: item.entity,
        entityId: getEntityId(item.payload),
        localVersion: item.entityVersion ?? 1,
        remoteVersion: remote.version,
        localPayload: item.payload,
        remotePayload: remote.data,
      };
    }
    return null;
  }

  if (item.operation === "delete") {
    if (remote.data !== null && remote.version > (item.entityVersion ?? 1)) {
      return {
        syncItemId: item.id,
        entity: item.entity,
        entityId: getEntityId(item.payload),
        localVersion: item.entityVersion ?? 1,
        remoteVersion: remote.version,
        localPayload: item.payload,
        remotePayload: remote.data,
      };
    }
    return null;
  }

  if (remote.version > (item.entityVersion ?? 1)) {
    return {
      syncItemId: item.id,
      entity: item.entity,
      entityId: getEntityId(item.payload),
      localVersion: item.entityVersion ?? 1,
      remoteVersion: remote.version,
      localPayload: item.payload,
      remotePayload: remote.data,
    };
  }

  return null;
}

export function resolveConflictLWW(
  conflict: SyncConflict,
  item: SyncQueueItem
): { action: "push-local" | "apply-remote" | "merge"; payload?: unknown } {
  const localTs =
    typeof item.payload === "object" && item.payload !== null && "updatedAt" in item.payload
      ? new Date((item.payload as Record<string, unknown>).updatedAt as string).getTime()
      : new Date(item.createdAt).getTime();

  const remoteTs =
    typeof conflict.remotePayload === "object" && conflict.remotePayload !== null && "updatedAt" in conflict.remotePayload
      ? new Date((conflict.remotePayload as Record<string, unknown>).updatedAt as string).getTime()
      : 0;

  if (localTs >= remoteTs) {
    return { action: "push-local" };
  }
  return { action: "apply-remote" };
}

async function applyRemotePayload(entity: SyncQueueItemEntity, payload: unknown): Promise<void> {
  const storeName = ENTITY_STORE_MAP[entity];

  if (entity === "settings") {
    await putOne(storeName, payload as never);
    return;
  }

  const existing = await getOne(storeName, getEntityId(payload));
  if (!existing) {
    await putOne(storeName, payload as never);
    return;
  }

  const merged = { ...(existing as Record<string, unknown>), ...(payload as Record<string, unknown>) } as Record<string, unknown>;
  await putOne(storeName, merged as never);
}

export async function resolveConflict(
  conflict: SyncConflict,
  item: SyncQueueItem,
  strategy: ConflictResolutionStrategyType
): Promise<{ action: "push-local" | "apply-remote" | "merge" | "manual"; payload?: unknown }> {
  switch (strategy) {
    case "lww":
      return resolveConflictLWW(conflict, item);

    case "local-wins":
      return { action: "push-local" };

    case "remote-wins":
      return { action: "apply-remote", payload: conflict.remotePayload };

    case "manual":
      return { action: "manual" };

    default:
      return resolveConflictLWW(conflict, item);
  }
}

export function mergeEntityPayload(
  entity: SyncQueueItemEntity,
  local: unknown,
  remote: unknown
): unknown {
  const l = typeof local === "object" && local !== null ? (local as Record<string, unknown>) : {};
  const r = typeof remote === "object" && remote !== null ? (remote as Record<string, unknown>) : {};

  if (entity === "product") {
    const lQty = typeof l.quantity === "number" ? l.quantity : 0;
    const rQty = typeof r.quantity === "number" ? r.quantity : 0;
    return {
      ...r,
      ...l,
      quantity: Math.min(lQty, rQty),
      updatedAt: new Date().toISOString(),
      version: Math.max(payloadVersion(l), payloadVersion(r)) + 1,
    };
  }

  if (entity === "transaction") {
    return {
      ...r,
      ...l,
      updatedAt: new Date().toISOString(),
      version: Math.max(payloadVersion(l), payloadVersion(r)) + 1,
    };
  }

  return {
    ...r,
    ...l,
    updatedAt: new Date().toISOString(),
    version: Math.max(payloadVersion(l), payloadVersion(r)) + 1,
  };
}

export async function processSyncItem(
  item: SyncQueueItem,
  _strategy: ConflictResolutionStrategyType
): Promise<SyncResult> {
  const validationError = validatePayload(item.entity, item.operation, item.payload);
  if (validationError) {
    return {
      id: item.id,
      entity: item.entity,
      operation: item.operation,
      status: "failed",
      error: validationError,
    };
  }

  try {
    await submitSyncBatch([item]);
    return { id: item.id, entity: item.entity, operation: item.operation, status: "synced" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (item.retryCount >= MAX_RETRIES) {
      return { id: item.id, entity: item.entity, operation: item.operation, status: "failed", error: message };
    }
    return { id: item.id, entity: item.entity, operation: item.operation, status: "retry", error: message };
  }
}

export async function pullFromRemote(): Promise<PullReport> {
  const queue = await getAll("syncQueue");
  const report: PullReport = {
    fetched: 0,
    applied: 0,
    conflicts: 0,
    failures: 0,
  };

  const nowIso = new Date().toISOString();

  for (const entity of Object.keys(ENTITY_STORE_MAP) as SyncQueueItemEntity[]) {
    const endpoint = ENTITY_API_MAP[entity];
    const storeName = ENTITY_STORE_MAP[entity];
    const lastPull = (await getLastPullTimestamp(entity)) ?? (await getLastPullTimestamp()) ?? "";
    const qs = lastPull ? `?since=${encodeURIComponent(lastPull)}` : "";

    try {
      const response = await fetch(`${BASE}/api/${endpoint}${qs}`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error(`Pull failed for ${entity}: ${response.status}`);
      }

      const raw = await response.json();
      const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
      report.fetched += rows.length;

      for (const remoteEntity of rows) {
        const entityId = getEntityId(remoteEntity);
        if (!entityId) continue;

        const local = await getOne(storeName, entityId);
        const remoteVersion = payloadVersion(remoteEntity);
        const localVersion = local && typeof (local as { version?: unknown }).version === "number" ? (local as { version: number }).version : 0;

        const pendingLocalItem = queue.find(
          (item) => item.status === "pending" && item.entity === entity && getEntityId(item.payload) === entityId
        );

        // Check local entity's syncStatus — if pending, local un-synced changes must not be overwritten
        const localSyncStatus = local && typeof (local as { syncStatus?: unknown }).syncStatus === "string"
          ? (local as { syncStatus: string }).syncStatus
          : "synced";

        if (!local) {
          await putOne(storeName, remoteEntity as never);
          report.applied++;
          continue;
        }

        if (pendingLocalItem && remoteVersion !== localVersion) {
          const existingConflict = queue.find(
            (q) => q.status === "conflict" && q.entity === entity && getEntityId(q.payload) === entityId
          );
          if (existingConflict) {
            continue;
          }
          const conflict: SyncConflict = {
            syncItemId: pendingLocalItem.id,
            entity,
            entityId,
            localVersion,
            remoteVersion,
            localPayload: pendingLocalItem.payload,
            remotePayload: remoteEntity,
          };
          await putOne("syncQueue", {
            id: crypto.randomUUID(),
            entity,
            operation: "update",
            payload: pendingLocalItem.payload,
            createdAt: nowIso,
            status: "conflict",
            retryCount: 0,
            lastAttemptAt: nowIso,
            lastError: "Pull conflict",
            entityVersion: localVersion,
            resolvedConflict: conflict,
          });
          report.conflicts++;
          continue;
        }

        // Protect local entities with pending syncStatus from being overwritten by older remote snapshots
        if (remoteVersion > localVersion) {
          if (localSyncStatus === "pending") {
            // Local changes are pending upload — skip overwrite; will sync up when push occurs
            continue;
          }
          await putOne(storeName, remoteEntity as never);
          report.applied++;
        }
      }

      await setLastPullTimestamp(nowIso, entity);
    } catch {
      report.failures++;
    }
  }

  return report;
}

export async function runSync(
  strategy: ConflictResolutionStrategyType = "lww",
  maxItems = 50
): Promise<SyncReport> {
  if (syncInProgress) {
    return {
      processed: 0,
      synced: 0,
      conflicts: 0,
      failures: 0,
      retries: 0,
      results: [],
      pull: { fetched: 0, applied: 0, conflicts: 0, failures: 0 },
    };
  }
  syncInProgress = true;
  try {
    const pending = await getByIndex("syncQueue", "status", "pending");
    const nowMs = Date.now();
    const sorted = pending
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, maxItems);

    const report: SyncReport = {
      processed: 0,
      synced: 0,
      conflicts: 0,
      failures: 0,
      retries: 0,
      results: [],
      pull: { fetched: 0, applied: 0, conflicts: 0, failures: 0 },
    };

    const syncedTransactionIds: string[] = [];
    const submittedItems: SyncQueueItem[] = [];

    for (const item of sorted) {
      if (!shouldProcessNow(item, nowMs)) {
        continue;
      }

      const result = await processSyncItem(item, strategy);
      report.processed++;
      const updatedItem: SyncQueueItem = {
        ...item,
        lastAttemptAt: new Date().toISOString(),
      };

      switch (result.status) {
        case "synced":
          updatedItem.status = "pending";
          updatedItem.lastError = "";
          submittedItems.push(updatedItem);
          break;

        case "conflict":
          updatedItem.status = "conflict";
          updatedItem.resolvedConflict = result.conflict;
          report.conflicts++;
          break;

        case "failed":
          updatedItem.status = "failed";
          updatedItem.retryCount = item.retryCount + 1;
          updatedItem.lastError = result.error || "Unknown error";
          report.failures++;
          break;

        case "retry":
          updatedItem.retryCount = item.retryCount + 1;
          updatedItem.lastError = result.error || "Unknown error";
          if (updatedItem.retryCount >= MAX_RETRIES) {
            updatedItem.status = "failed";
            report.failures++;
          } else {
            report.retries++;
          }
          break;
      }

      await putOne("syncQueue", updatedItem);
      if (result.status !== "synced") {
        report.results.push(result);
      }
    }

    if (submittedItems.length > 0) {
      const remoteReport = await triggerRemoteProcess(strategy, submittedItems.length);
      const remoteResults = Array.isArray(remoteReport.results) ? remoteReport.results : [];
      const remoteById = new Map(remoteResults.map((result) => [result.id, result]));

      for (const item of submittedItems) {
        const remoteResult = remoteById.get(item.id);
        const updatedItem: SyncQueueItem = {
          ...item,
          lastAttemptAt: new Date().toISOString(),
        };

        const normalizedResult: SyncResult = remoteResult
          ? {
              id: remoteResult.id,
              entity: remoteResult.entity,
              operation: remoteResult.operation,
              status: remoteResult.status,
              error: remoteResult.error,
              conflict: remoteResult.conflict,
            }
          : {
              id: item.id,
              entity: item.entity,
              operation: item.operation,
              status: "retry",
              error: "Remote processor returned no result for queued item.",
            };

        switch (normalizedResult.status) {
          case "synced":
            updatedItem.status = "synced";
            updatedItem.lastError = "";
            report.synced++;
            if (item.entity === "transaction") {
              const id = getEntityId(item.payload);
              if (id) syncedTransactionIds.push(id);
            }
            break;

          case "conflict":
            updatedItem.status = "conflict";
            updatedItem.resolvedConflict = normalizedResult.conflict;
            updatedItem.lastError = normalizedResult.error || "Conflict detected by remote sync processor.";
            report.conflicts++;
            break;

          case "failed":
            updatedItem.status = "failed";
            updatedItem.retryCount = item.retryCount + 1;
            updatedItem.lastError = normalizedResult.error || "Unknown error";
            report.failures++;
            break;

          case "retry":
            updatedItem.retryCount = item.retryCount + 1;
            updatedItem.lastError = normalizedResult.error || "Unknown error";
            if (updatedItem.retryCount >= MAX_RETRIES) {
              updatedItem.status = "failed";
              report.failures++;
            } else {
              updatedItem.status = "pending";
              report.retries++;
            }
            break;
        }

        await putOne("syncQueue", updatedItem);
        report.results.push(normalizedResult);
      }
    }

    if (syncedTransactionIds.length > 0) {
      await markTransactionsAsSynced(syncedTransactionIds);
    }

    report.pull = await pullFromRemote();

    await purgeSyncedItems();

    logStructured("info", "sync.run", {
      strategy,
      processed: report.processed,
      synced: report.synced,
      conflicts: report.conflicts,
      failures: report.failures,
      retries: report.retries,
      pullFetched: report.pull.fetched,
      pullApplied: report.pull.applied,
      pullConflicts: report.pull.conflicts,
      pullFailures: report.pull.failures,
    });

    return report;
  } finally {
    syncInProgress = false;
  }
}

export async function resolveConflictManually(
  syncItemId: string,
  resolution: "local-wins" | "remote-wins" | "merged"
): Promise<void> {
  const item = await getOne("syncQueue", syncItemId);
  if (!item || item.status !== "conflict" || !item.resolvedConflict) {
    throw new Error("No unresolved conflict found for this sync item.");
  }

  const conflict = item.resolvedConflict;
  const updatedItem = { ...item };

  const body: Record<string, unknown> = {
    syncItemId,
    resolution,
  };
  if (resolution === "remote-wins") {
    body.remotePayload = conflict.remotePayload;
  }
  if (resolution === "merged") {
    body.mergedPayload = mergeEntityPayload(item.entity as SyncQueueItemEntity, conflict.localPayload, conflict.remotePayload);
  }

  const resolutionResponse = await fetch(`${BASE}/api/sync-queue`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resolutionResponse.ok) {
    const errorText = await resolutionResponse.text().catch(() => "");
    throw new Error(`Remote conflict resolution failed: ${resolutionResponse.status} ${resolutionResponse.statusText} ${errorText}`);
  }

  await triggerRemoteProcess("manual", 50);
  await pullFromRemote();

  updatedItem.status = "synced";
  updatedItem.lastError = "";

  conflict.resolvedAt = new Date().toISOString();
  conflict.resolution = resolution;
  updatedItem.resolvedConflict = conflict;

  await putOne("syncQueue", updatedItem);

  logStructured("info", "sync.conflict.resolved", {
    syncItemId,
    resolution,
    entity: item.entity,
  });
}

export async function getSyncStats(): Promise<{
  pending: number;
  synced: number;
  failed: number;
  conflict: number;
}> {
  const queue = await getAll("syncQueue");
  return {
    pending: queue.filter((i) => i.status === "pending").length,
    synced: queue.filter((i) => i.status === "synced").length,
    failed: queue.filter((i) => i.status === "failed").length,
    conflict: queue.filter((i) => i.status === "conflict").length,
  };
}

export function startAutoSync(intervalMs = 5 * 60 * 1000): void {
  if (typeof window === "undefined" || autoSyncCleanup) return;

  const trySync = async () => {
    const flags = await getFeatureFlags();
    if (!flags.sync) return;
    await runSync().catch(() => undefined);
  };

  const onlineHandler = () => {
    trySync();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          if ((registration as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync) {
            return (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register("pos-sync");
          }
          return Promise.resolve();
        })
        .catch(() => undefined);
    }
  };

  window.addEventListener("online", onlineHandler);
  const timer = window.setInterval(() => {
    if (navigator.onLine) {
      trySync();
    }
  }, intervalMs);

  autoSyncCleanup = () => {
    window.removeEventListener("online", onlineHandler);
    window.clearInterval(timer);
    autoSyncCleanup = null;
  };
}

export function stopAutoSync(): void {
  if (autoSyncCleanup) {
    autoSyncCleanup();
  }
}

export function resetSyncInProgress(): void {
  syncInProgress = false;
}
