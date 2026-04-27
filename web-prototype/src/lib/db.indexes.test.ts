/** @vitest-environment jsdom */

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getAll,
  getByIndex,
  getConflictItems,
  getProductByBarcode,
  openPosDb,
  putMany,
  putOne,
  resetPosDbForTests,
  seedIfNeeded
} from "./db";
import type { Product, SyncQueueItem, Transaction } from "./types";

beforeEach(async () => {
  await resetPosDbForTests();
  await seedIfNeeded();
});

describe("V9 secondary indexes", () => {
  it("creates syncQueue status index", async () => {
    const db = await openPosDb();
    const store = db.transaction("syncQueue", "readonly").objectStore("syncQueue");
    expect(store.indexNames.contains("status")).toBe(true);
  });

  it("creates transactions createdAt index", async () => {
    const db = await openPosDb();
    const store = db.transaction("transactions", "readonly").objectStore("transactions");
    expect(store.indexNames.contains("createdAt")).toBe(true);
  });

  it("creates products barcode index", async () => {
    const db = await openPosDb();
    const store = db.transaction("products", "readonly").objectStore("products");
    expect(store.indexNames.contains("barcode")).toBe(true);
  });
});

describe("getByIndex", () => {
  it("filters syncQueue by status via index", async () => {
    const items: SyncQueueItem[] = [
      {
        id: "sq-1",
        entity: "product",
        operation: "create",
        payload: {},
        createdAt: new Date().toISOString(),
        status: "pending",
        retryCount: 0,
        lastAttemptAt: new Date().toISOString(),
        lastError: ""
      },
      {
        id: "sq-2",
        entity: "product",
        operation: "update",
        payload: {},
        createdAt: new Date().toISOString(),
        status: "synced",
        retryCount: 0,
        lastAttemptAt: new Date().toISOString(),
        lastError: ""
      },
      {
        id: "sq-3",
        entity: "transaction",
        operation: "create",
        payload: {},
        createdAt: new Date().toISOString(),
        status: "conflict",
        retryCount: 0,
        lastAttemptAt: new Date().toISOString(),
        lastError: ""
      }
    ];
    await putMany("syncQueue", items);

    const pending = await getByIndex("syncQueue", "status", "pending");
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe("sq-1");

    const synced = await getByIndex("syncQueue", "status", "synced");
    expect(synced).toHaveLength(1);
    expect(synced[0].id).toBe("sq-2");
  });

  it("returns empty array when no matches", async () => {
    const result = await getByIndex("syncQueue", "status", "failed");
    expect(result).toHaveLength(0);
  });
});

describe("getConflictItems (indexed)", () => {
  it("returns only conflict-status items", async () => {
    const items: SyncQueueItem[] = [
      {
        id: "sq-conflict-1",
        entity: "product",
        operation: "update",
        payload: {},
        createdAt: new Date().toISOString(),
        status: "conflict",
        retryCount: 0,
        lastAttemptAt: new Date().toISOString(),
        lastError: ""
      },
      {
        id: "sq-pending-1",
        entity: "product",
        operation: "create",
        payload: {},
        createdAt: new Date().toISOString(),
        status: "pending",
        retryCount: 0,
        lastAttemptAt: new Date().toISOString(),
        lastError: ""
      }
    ];
    await putMany("syncQueue", items);

    const conflicts = await getConflictItems();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].id).toBe("sq-conflict-1");
  });
});

describe("getProductByBarcode", () => {
  it("finds product by barcode via index", async () => {
    const product: Product = {
      id: "test-prod-1",
      version: 1,
      name: "Test Product",
      barcode: "999888",
      categoryId: "cat-pain",
      supplier: "TestSupplier",
      price: 10,
      quantity: 5,
      minStock: 1,
      tracksStock: true,
      expirationDate: "2027-01-01",
      imageColor: "#ff0000"
    };
    await putOne("products", product);

    const found = await getProductByBarcode("999888");
    expect(found).toBeDefined();
    expect(found!.id).toBe("test-prod-1");
  });

  it("returns undefined for unknown barcode", async () => {
    const found = await getProductByBarcode("nonexistent");
    expect(found).toBeUndefined();
  });
});
