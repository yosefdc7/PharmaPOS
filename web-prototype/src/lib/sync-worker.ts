import type {
  ConflictResolutionStrategy as ConflictResolutionStrategyType,
  SyncConflict,
  SyncQueueItem,
  SyncQueueItemEntity,
} from "./types";
import {
  getAll,
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

async function fetchRemoteEntity(
  entity: SyncQueueItem["entity"],
  entityId: string
): Promise<{ type: "not_found" } | { type: "error"; message: string } | { type: "found"; version: number; data: unknown }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const endpoint = ENTITY_API_MAP[entity];
    const response = await fetch(`${BASE}/api/${endpoint}/${encodeURIComponent(entityId)}`, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      if (response.status === 404) return { type: "not_found" };
      return { type: "error", message: `Remote fetch failed: ${response.status}` };
    }
    const data = await response.json();
    return { type: "found", version: payloadVersion(data), data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { type: "error", message };
  }
}

async function pushToRemote(item: SyncQueueItem): Promise<void> {
  const endpoint = ENTITY_API_MAP[item.entity];
  const entityId = getEntityId(item.payload);

  const body: Record<string, unknown> = {
    ...(typeof item.payload === "object" && item.payload !== null ? (item.payload as Record<string, unknown>) : {}),
    version: item.entityVersion,
  };

  let response: Response;
  if (item.operation === "create") {
    response = await fetch(`${BASE}/api/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } else if (item.operation === "delete") {
    response = await fetch(`${BASE}/api/${endpoint}/${encodeURIComponent(entityId)}`, {
      method: "DELETE",
    });
  } else {
    response = await fetch(`${BASE}/api/${endpoint}/${encodeURIComponent(entityId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Remote push failed: ${response.status} ${response.statusText} ${errorText}`);
  }
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
        localVersion: item.entityVersion,
        remoteVersion: remote.version,
        localPayload: item.payload,
        remotePayload: remote.data,
      };
    }
    return null;
  }

  if (item.operation === "delete") {
    if (remote.data !== null && remote.version > item.entityVersion) {
      return {
        syncItemId: item.id,
        entity: item.entity,
        entityId: getEntityId(item.payload),
        localVersion: item.entityVersion,
        remoteVersion: remote.version,
        localPayload: item.payload,
        remotePayload: remote.data,
      };
    }
    return null;
  }

  if (remote.version > item.entityVersion) {
    return {
      syncItemId: item.id,
      entity: item.entity,
      entityId: getEntityId(item.payload),
      localVersion: item.entityVersion,
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
  strategy: ConflictResolutionStrategyType
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
    const entityId = getEntityId(item.payload);

    if (item.operation === "create") {
      const remote = await fetchRemoteEntity(item.entity, entityId);
      if (remote.type === "error") {
        return {
          id: item.id,
          entity: item.entity,
          operation: item.operation,
          status: item.retryCount >= MAX_RETRIES ? "failed" : "retry",
          error: remote.message,
        };
      }
      if (remote.type === "found" && remote.data) {
        const conflict = detectConflict(item, { version: remote.version, data: remote.data });
        if (conflict) {
          const resolution = await resolveConflict(conflict, item, strategy);
          if (resolution.action === "manual") {
            return {
              id: item.id,
              entity: item.entity,
              operation: item.operation,
              status: "conflict",
              conflict: { ...conflict },
            };
          }
          if (resolution.action === "apply-remote" && resolution.payload) {
            await applyRemotePayload(item.entity as SyncQueueItemEntity, resolution.payload);
            return { id: item.id, entity: item.entity, operation: item.operation, status: "synced" };
          }
        }
      }
      await pushToRemote(item);
      return { id: item.id, entity: item.entity, operation: item.operation, status: "synced" };
    }

    if (item.operation === "delete") {
      const remote = await fetchRemoteEntity(item.entity, entityId);
      if (remote.type === "error") {
        return {
          id: item.id,
          entity: item.entity,
          operation: item.operation,
          status: item.retryCount >= MAX_RETRIES ? "failed" : "retry",
          error: remote.message,
        };
      }
      if (remote.type === "found" && remote.version > item.entityVersion) {
        const conflict = detectConflict(item, { version: remote.version, data: remote.data });
        if (conflict) {
          const resolution = await resolveConflict(conflict, item, strategy);
          if (resolution.action === "manual") {
            return {
              id: item.id,
              entity: item.entity,
              operation: item.operation,
              status: "conflict",
              conflict: { ...conflict },
            };
          }
          if (resolution.action === "apply-remote" && resolution.payload) {
            await applyRemotePayload(item.entity as SyncQueueItemEntity, resolution.payload);
            return { id: item.id, entity: item.entity, operation: item.operation, status: "synced" };
          }
        }
      }
      await pushToRemote(item);
      return { id: item.id, entity: item.entity, operation: item.operation, status: "synced" };
    }

    const remote = await fetchRemoteEntity(item.entity, entityId);
    if (remote.type === "error") {
      return {
        id: item.id,
        entity: item.entity,
        operation: item.operation,
        status: item.retryCount >= MAX_RETRIES ? "failed" : "retry",
        error: remote.message,
      };
    }
    if (remote.type === "found" && remote.version > item.entityVersion) {
      const conflict = detectConflict(item, { version: remote.version, data: remote.data });
      if (conflict) {
        const resolution = await resolveConflict(conflict, item, strategy);
        if (resolution.action === "manual") {
          return {
            id: item.id,
            entity: item.entity,
            operation: item.operation,
            status: "conflict",
            conflict: { ...conflict },
          };
        }
        if (resolution.action === "apply-remote" && resolution.payload) {
          await applyRemotePayload(item.entity as SyncQueueItemEntity, resolution.payload);
          return { id: item.id, entity: item.entity, operation: item.operation, status: "synced" };
        }
        if (resolution.action === "merge") {
          const mergedPayload = mergeEntityPayload(item.entity as SyncQueueItemEntity, item.payload, conflict.remotePayload);
          const updatedItem: SyncQueueItem = { ...item, payload: mergedPayload, entityVersion: payloadVersion(mergedPayload) };
          await pushToRemote(updatedItem);
          await applyRemotePayload(item.entity as SyncQueueItemEntity, mergedPayload);
          return { id: item.id, entity: item.entity, operation: item.operation, status: "synced" };
        }
      }
    }

    await pushToRemote(item);
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

        if (remoteVersion > localVersion) {
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
    const queue = await getAll("syncQueue");
    const nowMs = Date.now();
    const pending = queue
      .filter((item) => item.status === "pending")
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

    for (const item of pending) {
      if (!shouldProcessNow(item, nowMs)) {
        continue;
      }

      const result = await processSyncItem(item, strategy);
      report.processed++;
      report.results.push(result);

      const updatedItem: SyncQueueItem = {
        ...item,
        lastAttemptAt: new Date().toISOString(),
      };

      switch (result.status) {
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

  if (resolution === "local-wins") {
    await pushToRemote(item);
    updatedItem.status = "synced";
    updatedItem.lastError = "";
  } else if (resolution === "remote-wins") {
    await applyRemotePayload(item.entity as SyncQueueItemEntity, conflict.remotePayload);
    updatedItem.status = "synced";
    updatedItem.lastError = "";
  } else {
    const mergedPayload = mergeEntityPayload(item.entity as SyncQueueItemEntity, conflict.localPayload, conflict.remotePayload);
    await pushToRemote({ ...item, payload: mergedPayload, entityVersion: payloadVersion(mergedPayload) });
    await applyRemotePayload(item.entity as SyncQueueItemEntity, mergedPayload);
    updatedItem.status = "synced";
    updatedItem.lastError = "";
  }

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
