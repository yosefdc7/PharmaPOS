import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncConflict, SyncQueueItem } from "./types";

const {
  getAllMock,
  getByIndexMock,
  getOneMock,
  putOneMock,
  markTransactionsAsSyncedMock,
  purgeSyncedItemsMock,
  getFeatureFlagsMock,
  getLastPullTimestampMock,
  setLastPullTimestampMock,
} = vi.hoisted(() => ({
  getAllMock: vi.fn(),
  getByIndexMock: vi.fn(),
  getOneMock: vi.fn(),
  putOneMock: vi.fn(),
  markTransactionsAsSyncedMock: vi.fn(),
  purgeSyncedItemsMock: vi.fn(),
  getFeatureFlagsMock: vi.fn(),
  getLastPullTimestampMock: vi.fn(),
  setLastPullTimestampMock: vi.fn(),
}));

vi.mock("./db", () => ({
  getAll: getAllMock,
  getByIndex: getByIndexMock,
  getOne: getOneMock,
  putOne: putOneMock,
  markTransactionsAsSynced: markTransactionsAsSyncedMock,
  purgeSyncedItems: purgeSyncedItemsMock,
  getFeatureFlags: getFeatureFlagsMock,
  getLastPullTimestamp: getLastPullTimestampMock,
  setLastPullTimestamp: setLastPullTimestampMock,
}));

vi.mock("./observability", () => ({
  logStructured: vi.fn(),
}));

import {
  detectConflict,
  getSyncStats,
  mergeEntityPayload,
  processSyncItem,
  pullFromRemote,
  resolveConflict,
  resolveConflictLWW,
  resolveConflictManually,
  resetSyncInProgress,
  runSync,
  validatePayload,
} from "./sync-worker";

function makeItem(overrides: Partial<SyncQueueItem> = {}): SyncQueueItem {
  return {
    id: overrides.id ?? "sync-1",
    entity: overrides.entity ?? "product",
    operation: overrides.operation ?? "update",
    payload: overrides.payload ?? { id: "p-1", version: 2, name: "Item", price: 1, updatedAt: "2026-04-27T01:00:00.000Z" },
    createdAt: overrides.createdAt ?? "2026-04-27T01:00:00.000Z",
    status: overrides.status ?? "pending",
    retryCount: overrides.retryCount ?? 0,
    lastAttemptAt: overrides.lastAttemptAt,
    lastError: overrides.lastError ?? "",
    entityVersion: overrides.entityVersion ?? 2,
    resolvedConflict: overrides.resolvedConflict,
  };
}

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function mockFetch(responses: Response[]): void {
  let i = 0;
  global.fetch = vi.fn(async () => responses[i++] ?? mockResponse(200, [])) as unknown as typeof fetch;
}

describe("sync-worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    purgeSyncedItemsMock.mockResolvedValue(0);
    getLastPullTimestampMock.mockResolvedValue(null);
    setLastPullTimestampMock.mockResolvedValue(undefined);
    getByIndexMock.mockResolvedValue([]);
    mockFetch([mockResponse(200, [])]);
    resetSyncInProgress();
  });

  // --- detectConflict ---
  it("detectConflict handles create, update, delete and no-conflict paths", () => {
    const createItem = makeItem({ operation: "create", entityVersion: 1, payload: { id: "p-1", version: 1 } });
    expect(detectConflict(createItem, { version: 1, data: { id: "p-1" } })?.entityId).toBe("p-1");

    const updateItem = makeItem({ operation: "update", entityVersion: 2 });
    expect(detectConflict(updateItem, { version: 3, data: { id: "p-1" } })?.remoteVersion).toBe(3);

    const deleteItem = makeItem({ operation: "delete", entityVersion: 2 });
    expect(detectConflict(deleteItem, { version: 4, data: { id: "p-1" } })?.remoteVersion).toBe(4);

    expect(detectConflict(updateItem, { version: 2, data: { id: "p-1" } })).toBeNull();
  });

  // --- resolveConflictLWW ---
  it("resolveConflictLWW picks payload using timestamps", () => {
    const item = makeItem({ payload: { id: "p-1", updatedAt: "2026-04-27T02:00:00.000Z" } });
    const conflict: SyncConflict = {
      syncItemId: "sync-1",
      entity: "product",
      entityId: "p-1",
      localVersion: 2,
      remoteVersion: 3,
      localPayload: item.payload,
      remotePayload: { id: "p-1", updatedAt: "2026-04-27T01:00:00.000Z" },
    };
    expect(resolveConflictLWW(conflict, item).action).toBe("push-local");

    const remoteWins = {
      ...conflict,
      remotePayload: { id: "p-1", updatedAt: "2026-04-27T03:00:00.000Z" },
    };
    expect(resolveConflictLWW(remoteWins, item).action).toBe("apply-remote");
  });

  // --- resolveConflict ---
  it("resolveConflict returns expected actions per strategy", async () => {
    const item = makeItem();
    const conflict: SyncConflict = {
      syncItemId: "sync-1",
      entity: "product",
      entityId: "p-1",
      localVersion: 1,
      remoteVersion: 2,
      localPayload: { id: "p-1" },
      remotePayload: { id: "p-1", version: 2 },
    };

    expect((await resolveConflict(conflict, item, "local-wins")).action).toBe("push-local");
    expect((await resolveConflict(conflict, item, "remote-wins")).action).toBe("apply-remote");
    expect((await resolveConflict(conflict, item, "manual")).action).toBe("manual");
  });

  // --- mergeEntityPayload ---
  it("mergeEntityPayload applies product quantity min and increments version", () => {
    const merged = mergeEntityPayload(
      "product",
      { id: "p-1", quantity: 5, version: 2 },
      { id: "p-1", quantity: 3, version: 4 }
    ) as { quantity: number; version: number };
    expect(merged.quantity).toBe(3);
    expect(merged.version).toBe(5);
  });

  it("mergeEntityPayload handles transaction merge", () => {
    const merged = mergeEntityPayload(
      "transaction",
      { id: "t-1", total: 100, version: 2 },
      { id: "t-1", total: 200, version: 4 }
    ) as { total: number; version: number; updatedAt: string };
    expect(merged.total).toBe(100);
    expect(merged.version).toBe(5);
    expect(typeof merged.updatedAt).toBe("string");
  });

  it("mergeEntityPayload handles generic entity merge", () => {
    const merged = mergeEntityPayload(
      "customer",
      { id: "c-1", name: "Alice", version: 1 },
      { id: "c-1", name: "Bob", version: 3 }
    ) as { name: string; version: number };
    expect(merged.name).toBe("Alice");
    expect(merged.version).toBe(4);
  });

  // --- validatePayload ---
  it("validatePayload returns null for valid payloads", () => {
    expect(validatePayload("product", "update", { id: "p-1", name: "A", price: 5 })).toBeNull();
    expect(validatePayload("product", "delete", { id: "p-1" })).toBeNull();
    expect(validatePayload("category", "create", { id: "cat-1", name: "Rx" })).toBeNull();
    expect(validatePayload("transaction", "update", { id: "t-1", localNumber: "001", items: [], total: 10 })).toBeNull();
  });

  it("validatePayload returns errors for invalid payloads", () => {
    expect(validatePayload("product", "update", null)).not.toBeNull();
    expect(validatePayload("product", "delete", { })).not.toBeNull();
    expect(validatePayload("product", "update", { id: "p-1" })).not.toBeNull();
    expect(validatePayload("product", "update", { id: "p-1", name: "A" })).not.toBeNull();
    expect(validatePayload("product", "update", { id: "p-1", price: 5 })).not.toBeNull();
    expect(validatePayload("transaction", "update", { id: "t-1", localNumber: "001", items: [], total: null })).not.toBeNull();
  });

  // --- processSyncItem: create paths ---
  it("processSyncItem handles create successfully", async () => {
    mockFetch([mockResponse(200, { success: true, accepted: 1, rejected: [] })]);
    const result = await processSyncItem(
      makeItem({ operation: "create", payload: { id: "p-1", version: 1, name: "A", price: 1 } }),
      "lww"
    );
    expect(result.status).toBe("synced");
  });

  it("processSyncItem submits update item to server queue", async () => {
    mockFetch([mockResponse(200, { success: true, accepted: 1, rejected: [] })]);
    const result = await processSyncItem(makeItem({ operation: "update", entityVersion: 2 }), "manual");
    expect(result.status).toBe("synced");
  });

  // --- processSyncItem: delete paths (B1) ---
  it("processSyncItem handles delete with no remote (404) and pushes", async () => {
    mockFetch([mockResponse(200, { success: true, accepted: 1, rejected: [] })]);
    const result = await processSyncItem(makeItem({ operation: "delete", payload: { id: "p-1", version: 3 } }), "lww");
    expect(result.status).toBe("synced");
  });

  it("processSyncItem handles delete with manual strategy via server queue", async () => {
    mockFetch([mockResponse(200, { success: true, accepted: 1, rejected: [] })]);
    const result = await processSyncItem(makeItem({ operation: "delete", entityVersion: 3, payload: { id: "p-1", version: 3 } }), "manual");
    expect(result.status).toBe("synced");
  });

  it("processSyncItem handles delete with remote conflict and local-wins strategy", async () => {
    mockFetch([mockResponse(200, { success: true, accepted: 1, rejected: [] })]);
    const result = await processSyncItem(makeItem({ operation: "delete", entityVersion: 3, payload: { id: "p-1", version: 3 } }), "local-wins");
    expect(result.status).toBe("synced");
  });

  // --- processSyncItem: retry/failed paths (B1) ---
  it("processSyncItem returns retry when fetch fails (A6)", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(500, "Server Error")
    );
    const result = await processSyncItem(makeItem({ operation: "update", entityVersion: 2 }), "lww");
    expect(result.status).toBe("retry");
    expect(result.error).toContain("500");
  });

  it("processSyncItem returns failed when at MAX_RETRIES", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(500, "Server Error")
    );
    const result = await processSyncItem(makeItem({ operation: "update", entityVersion: 2, retryCount: 5 }), "lww");
    expect(result.status).toBe("failed");
  });

  it("processSyncItem returns failed for validation errors", async () => {
    const result = await processSyncItem(makeItem({ operation: "update", payload: { id: "p-1" } }), "lww");
    expect(result.status).toBe("failed");
    expect(result.error).toContain("Missing required fields");
  });

  // --- runSync: multi-item (B4) ---
  it("runSync processes multiple items and returns correct counts", async () => {
    const syncItem = makeItem({
      id: "sync-a",
      entity: "transaction",
      operation: "create",
      payload: { id: "txn-1", version: 1, localNumber: "1001", items: [], total: 10, updatedAt: "2026-04-27T02:00:00.000Z" },
      entityVersion: 1,
    });
    const conflictItem = makeItem({
      id: "sync-b",
      entity: "product",
      operation: "update",
      entityVersion: 2,
    });
    const backoffItem = makeItem({
      id: "sync-c",
      retryCount: 3,
      lastAttemptAt: new Date().toISOString(),
    });

    getByIndexMock.mockImplementation(async (store: string, _index: string, _query: unknown) => {
      if (store === "syncQueue") return [syncItem, conflictItem, backoffItem];
      return [];
    });

    (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockResponse(200, { success: true, accepted: 1, rejected: [] }))
      .mockResolvedValueOnce(mockResponse(200, { success: true, accepted: 1, rejected: [] }))
      .mockResolvedValueOnce(mockResponse(200, {
        success: true,
        processed: 2,
        results: [
          { id: "sync-a", entity: "transaction", operation: "create", status: "synced" },
          {
            id: "sync-b",
            entity: "product",
            operation: "update",
            status: "conflict",
            conflict: {
              syncItemId: "sync-b",
              entity: "product",
              entityId: "p-1",
              localVersion: 2,
              remoteVersion: 4,
              localPayload: { id: "p-1", version: 2 },
              remotePayload: { id: "p-1", version: 4 },
            },
          },
        ],
      }))
      .mockResolvedValueOnce(mockResponse(200, []))
      .mockResolvedValueOnce(mockResponse(200, []))
      .mockResolvedValueOnce(mockResponse(200, []))
      .mockResolvedValueOnce(mockResponse(200, []))
      .mockResolvedValueOnce(mockResponse(200, []))
      .mockResolvedValueOnce(mockResponse(200, []))
      .mockResolvedValueOnce(mockResponse(200, []));

    const report = await runSync("manual", 10);
    expect(report.processed).toBe(2);
    expect(report.synced).toBe(1);
    expect(report.conflicts).toBe(1);
    expect(markTransactionsAsSyncedMock).toHaveBeenCalledWith(["txn-1"]);
  });

  it("runSync returns empty report when sync already in progress (A4)", async () => {
    getByIndexMock.mockResolvedValue([]);
    const p1 = runSync("lww");
    const p2 = runSync("lww");
    const [report1, report2] = await Promise.all([p1, p2]);
    expect(report2.processed).toBe(0);
    expect(report2.synced).toBe(0);
  });

  // --- backoff timing (B4) ---
  it("shouldProcessNow skips items within backoff window", async () => {
    const recentBackoffItem = makeItem({
      id: "sync-back",
      retryCount: 2,
      lastAttemptAt: new Date(Date.now() - 2000).toISOString(),
    });

    getByIndexMock.mockImplementation(async (store: string, _index: string, _query: unknown) => {
      if (store === "syncQueue") return [recentBackoffItem];
      return [];
    });

    mockFetch([
      mockResponse(200, { id: "p-1", version: 2 }),
      mockResponse(200, { success: true }),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
    ]);

    const report = await runSync("lww", 10);
    expect(report.processed).toBe(0);
  });

  // --- resolveConflictManually (B5) ---
  it("resolveConflictManually resolves remote-wins and merged", async () => {
    const remoteProcessResponse = mockResponse(200, { success: true, processed: 0, results: [] });
    const pullResponses = [
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
    ];

    getOneMock.mockResolvedValueOnce(
      makeItem({
        id: "sync-1",
        status: "conflict",
        resolvedConflict: {
          syncItemId: "sync-1",
          entity: "product",
          entityId: "p-1",
          localVersion: 2,
          remoteVersion: 3,
          localPayload: { id: "p-1", quantity: 9, version: 2 },
          remotePayload: { id: "p-1", quantity: 4, version: 3 },
        },
      })
    );

    mockFetch([
      mockResponse(200, { success: true }),
      remoteProcessResponse,
      ...pullResponses,
    ]);
    await resolveConflictManually("sync-1", "remote-wins");
    expect(putOneMock).toHaveBeenCalledWith("syncQueue", expect.objectContaining({ status: "synced" }));

    getOneMock.mockResolvedValueOnce(
      makeItem({
        id: "sync-2",
        status: "conflict",
        resolvedConflict: {
          syncItemId: "sync-2",
          entity: "product",
          entityId: "p-1",
          localVersion: 2,
          remoteVersion: 3,
          localPayload: { id: "p-1", quantity: 9, version: 2 },
          remotePayload: { id: "p-1", quantity: 4, version: 3 },
        },
      })
    );

    mockFetch([
      mockResponse(200, { success: true }),
      remoteProcessResponse,
      ...pullResponses,
    ]);
    await resolveConflictManually("sync-2", "merged");
    expect(putOneMock).toHaveBeenCalledWith("syncQueue", expect.objectContaining({ status: "synced" }));
  });

  it("resolveConflictManually throws and leaves conflict on push failure (A2)", async () => {
    getOneMock.mockResolvedValueOnce(
      makeItem({
        id: "sync-3",
        status: "conflict",
        resolvedConflict: {
          syncItemId: "sync-3",
          entity: "product",
          entityId: "p-1",
          localVersion: 2,
          remoteVersion: 3,
          localPayload: { id: "p-1", version: 2 },
          remotePayload: { id: "p-1", version: 3 },
        },
      })
    );

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(500, "Server Error")
    );
    await expect(resolveConflictManually("sync-3", "local-wins")).rejects.toThrow();
    expect(putOneMock).not.toHaveBeenCalledWith("syncQueue", expect.objectContaining({ status: "synced" }));
  });

  // --- getSyncStats ---
  it("getSyncStats counts statuses", async () => {
    getAllMock.mockResolvedValue([
      makeItem({ status: "pending" }),
      makeItem({ status: "synced", id: "2" }),
      makeItem({ status: "failed", id: "3" }),
      makeItem({ status: "conflict", id: "4" }),
    ]);
    await expect(getSyncStats()).resolves.toEqual({ pending: 1, synced: 1, failed: 1, conflict: 1 });
  });

  // --- pullFromRemote ---
  it("pullFromRemote applies newer remote versions", async () => {
    getAllMock.mockResolvedValue([]);
    getOneMock.mockResolvedValue({ id: "p-1", version: 1 });
    mockFetch([
      mockResponse(200, [{ id: "p-1", version: 2 }]),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
    ]);

    const report = await pullFromRemote();
    expect(report.applied).toBeGreaterThanOrEqual(1);
  });

  it("pullFromRemote handles settings single-object response (B3)", async () => {
    getAllMock.mockResolvedValue([]);
    getOneMock.mockResolvedValueOnce(undefined);
    mockFetch([
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, { id: "store", store: "PharmaPOS", version: 2, updatedAt: new Date().toISOString() }),
    ]);

    const report = await pullFromRemote();
    expect(report.applied).toBeGreaterThanOrEqual(1);
  });

  it("pullFromRemote deduplicates conflicts (A5)", async () => {
    const existingConflict: SyncQueueItem = {
      id: "existing-conflict",
      entity: "product",
      operation: "update",
      payload: { id: "p-1", version: 1 },
      createdAt: "2026-04-27T00:00:00.000Z",
      status: "conflict",
      retryCount: 0,
      lastAttemptAt: "2026-04-27T00:00:00.000Z",
      lastError: "Pull conflict",
      entityVersion: 1,
      resolvedConflict: {
        syncItemId: "existing-conflict",
        entity: "product",
        entityId: "p-1",
        localVersion: 1,
        remoteVersion: 2,
        localPayload: { id: "p-1", version: 1 },
        remotePayload: { id: "p-1", version: 2 },
      },
    };

    getAllMock.mockImplementation(async (store: string) => {
      if (store === "syncQueue") return [existingConflict];
      return [];
    });

    getOneMock.mockResolvedValue({ id: "p-1", version: 1 });
    mockFetch([
      mockResponse(200, [{ id: "p-1", version: 2 }]),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
    ]);

    const report = await pullFromRemote();
    expect(report.conflicts).toBe(0);
    expect(putOneMock).not.toHaveBeenCalledWith("syncQueue", expect.objectContaining({ status: "conflict" }));
  });

  it("pullFromRemote skips fetch errors (A6)", async () => {
    getAllMock.mockResolvedValue([]);
    mockFetch([
      mockResponse(500, "Server Error"),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
      mockResponse(200, []),
    ]);

    const report = await pullFromRemote();
    expect(report.failures).toBe(1);
  });
});
