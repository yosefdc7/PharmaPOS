import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { enqueueSync, getAll, resetPrototypeData } from "@/lib/db";

describe("sync queue contract", () => {
  beforeEach(async () => {
    await resetPrototypeData();
  });

  it("writes queue items matching the offline-sync contract", async () => {
    await enqueueSync({ entity: "transaction", operation: "create", payload: { id: "txn-123" } });

    const [item] = await getAll("syncQueue");
    expect(item).toMatchObject({
      entity: "transaction",
      operation: "create",
      status: "pending",
      retryCount: 0,
      lastError: ""
    });
    expect(typeof item.id).toBe("string");
    expect(typeof item.createdAt).toBe("string");
  });
});
