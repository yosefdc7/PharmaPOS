import type {
  ConflictResolutionStrategy as ConflictResolutionStrategyType,
  SyncConflict,
  SyncQueueItem,
  SyncQueueItemEntity,
} from "./types";
import { getAll, putMany, putOne, getOne, type StoreName } from "./db";
import { logStructured } from "./observability";

export type { ConflictResolutionStrategyType as ConflictResolutionStrategy };

const BASE = process.env.NEXT_PUBLIC_API_BASE || "";

type SyncResult = {
  id: string;
  entity: SyncQueueItem["entity"];
  operation: SyncQueueItem["operation"];
  status: "synced" | "failed" | "conflict" | "retry";
  error?: string;
  conflict?: SyncConflict;
};

type SyncReport = {
  processed: number;
  synced: number;
  conflicts: number;
  failures: number;
  retries: number;
  results: SyncResult[];
};

const MAX_RETRIES = 5;

const ENTITY_STORE_MAP: Record<SyncQueueItemEntity, StoreName> = {
  product: "products",
  category: "categories",
  customer: "customers",
  user: "users",
  settings: "settings",
  transaction: "transactions",
  "held-order": "heldOrders",
};

function getEntityId(payload: unknown): string {
  if (typeof payload === "object" && payload !== null && "id" in payload) {
    return String((payload as Record<string, unknown>).id);
  }
  return "";
}

async function fetchRemoteEntity(
  entity: SyncQueueItem["entity"],
  entityId: string
): Promise<{ version: number; data: unknown } | null> {
  try {
    const storeName = ENTITY_STORE_MAP[entity];
    const response = await fetch(`${BASE}/api/${storeName}/${encodeURIComponent(entityId)}`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Remote fetch failed: ${response.status}`);
    }
    const data = await response.json();
    return { version: data?.version ?? 0, data };
  } catch {
    return null;
  }
}

async function pushToRemote(item: SyncQueueItem): Promise<void> {
  const storeName = ENTITY_STORE_MAP[item.entity];
  const entityId = getEntityId(item.payload);

  const body: Record<string, unknown> = {
    ...(typeof item.payload === "object" && item.payload !== null ? item.payload as Record<string, unknown> : {}),
    version: item.entityVersion,
  };

  let response: Response;
  if (item.operation === "create") {
    response = await fetch(`${BASE}/api/${storeName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } else if (item.operation === "delete") {
    response = await fetch(`${BASE}/api/${storeName}/${encodeURIComponent(entityId)}`, {
      method: "DELETE",
    });
  } else {
    response = await fetch(`${BASE}/api/${storeName}/${encodeURIComponent(entityId)}`, {
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

function detectConflict(
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

function resolveConflictLWW(
  conflict: SyncConflict,
  item: SyncQueueItem
): { action: "push-local" | "apply-remote" | "merge"; payload?: unknown } {
  const localTs = typeof item.payload === "object" && item.payload !== null && "updatedAt" in item.payload
    ? new Date((item.payload as Record<string, unknown>).updatedAt as string).getTime()
    : new Date(item.createdAt).getTime();

  const remoteTs = typeof conflict.remotePayload === "object" && conflict.remotePayload !== null && "updatedAt" in conflict.remotePayload
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

async function resolveConflict(
  conflict: SyncConflict,
  item: SyncQueueItem,
  strategy: ConflictResolutionStrategyType
): Promise<{ action: "push-local" | "apply-remote" | "merge" | "manual"; payload?: unknown }> {
  switch (strategy) {
    case "lww":
      return resolveConflictLWW(conflict, item);

    case "local-wins":
      return { action: "push-local" };

    case "remote-wins": {
      if (item.operation === "delete") {
        const storeName = ENTITY_STORE_MAP[item.entity];
        await putOne(storeName, { ...(conflict.remotePayload as object), deleted: true } as never);
      }
      return { action: "apply-remote", payload: conflict.remotePayload };
    }

    case "manual":
      return { action: "manual" };

    default:
      return resolveConflictLWW(conflict, item);
  }
}

async function processSyncItem(
  item: SyncQueueItem,
  strategy: ConflictResolutionStrategyType
): Promise<SyncResult> {
  try {
    const entityId = getEntityId(item.payload);

    if (item.operation === "create") {
      const remote = await fetchRemoteEntity(item.entity, entityId);
      if (remote && remote.data) {
        const conflict = detectConflict(item, remote);
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
      if (remote && remote.version > item.entityVersion) {
        const conflict = detectConflict(item, remote);
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
          }
        }
      }
      await pushToRemote(item);
      return { id: item.id, entity: item.entity, operation: item.operation, status: "synced" };
    }

    const remote = await fetchRemoteEntity(item.entity, entityId);
    if (remote && remote.version > item.entityVersion) {
      const conflict = detectConflict(item, remote);
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
          const updatedItem: SyncQueueItem = { ...item, payload: mergedPayload };
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

function mergeEntityPayload(
  entity: SyncQueueItemEntity,
  local: unknown,
  remote: unknown
): unknown {
  const l = (typeof local === "object" && local !== null) ? local as Record<string, unknown> : {};
  const r = (typeof remote === "object" && remote !== null) ? remote as Record<string, unknown> : {};

  if (entity === "product") {
    return {
      ...r,
      ...l,
      quantity: Math.min((l.quantity as number) ?? (r.quantity as number) ?? 0, (r.quantity as number) ?? (l.quantity as number) ?? 0),
      updatedAt: new Date().toISOString(),
    };
  }

  if (entity === "transaction") {
    return { ...r, ...l, updatedAt: new Date().toISOString() };
  }

  return {
    ...r,
    ...l,
    updatedAt: new Date().toISOString(),
  };
}

export async function runSync(
  strategy: ConflictResolutionStrategyType = "lww",
  maxItems = 50
): Promise<SyncReport> {
  const queue = await getAll("syncQueue");
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
  };

  for (const item of pending) {
    const result = await processSyncItem(item, strategy);
    report.processed++;
    report.results.push(result);

    const updatedItem = { ...item };

    switch (result.status) {
      case "synced":
        updatedItem.status = "synced";
        updatedItem.lastError = "";
        report.synced++;
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
        report.retries++;
        break;
    }

    await putOne("syncQueue", updatedItem);
  }

  if (report.synced > 0) {
    const transactions = await getAll("transactions");
    const updatedTxns = transactions.map((txn) =>
      txn.syncStatus === "pending" ? { ...txn, syncStatus: "synced" as const } : txn
    );
    if (updatedTxns.some((t, i) => t.syncStatus !== transactions[i].syncStatus)) {
      await putMany("transactions", updatedTxns);
    }
  }

  logStructured("info", "sync.run", {
    strategy,
    processed: report.processed,
    synced: report.synced,
    conflicts: report.conflicts,
    failures: report.failures,
    retries: report.retries,
  });

  return report;
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
    await pushToRemote({ ...item, payload: mergedPayload });
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
