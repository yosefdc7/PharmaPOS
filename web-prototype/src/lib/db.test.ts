import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { enqueueSync, getAll, markPendingSyncAsSynced, resetPrototypeData, seedIfNeeded } from "./db";

describe("IndexedDB prototype repository", () => {
  beforeEach(async () => {
    await resetPrototypeData();
  });

  it("seeds demo data on first load", async () => {
    await seedIfNeeded();
    const products = await getAll("products");
    const users = await getAll("users");

    expect(products.length).toBeGreaterThan(3);
    expect(users.some((user) => user.username === "admin")).toBe(true);
  });

  it("queues local changes and marks them synced", async () => {
    await enqueueSync({ entity: "transaction", operation: "create", payload: { id: "txn-1" } });
    const pending = await getAll("syncQueue");

    expect(pending[0].status).toBe("pending");

    await markPendingSyncAsSynced();
    const synced = await getAll("syncQueue");

    expect(synced[0].status).toBe("synced");
  });
});
