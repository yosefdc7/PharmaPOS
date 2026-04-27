/** @vitest-environment jsdom */

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueSync, getAll, getOne, putOne, resetPosDbForTests, seedIfNeeded } from "./db";
import { resolveConflictManually, runSync } from "./sync-worker";

describe("sync integration", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetPosDbForTests();
    await seedIfNeeded();
  });

  it("runs push+pull sync and updates queue and local entities", async () => {
    const product = await getOne("products", "prd-para-500");
    expect(product).toBeTruthy();

    const localUpdate = { ...product!, quantity: product!.quantity - 1, version: product!.version + 1, updatedAt: new Date().toISOString() };
    await putOne("products", localUpdate);
    const queued = await enqueueSync({ entity: "product", operation: "update", payload: localUpdate });

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/sync-queue") && init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ success: true, accepted: 1, rejected: [] }),
          text: async () => "",
        } as Response;
      }

      if (url.includes("/api/sync/process") && init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            success: true,
            processed: 1,
            results: [{ id: queued.id, entity: "product", operation: "update", status: "synced" }],
          }),
          text: async () => "",
        } as Response;
      }

      if (url.includes("/api/products?") || url.endsWith("/api/products")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => [{ ...localUpdate, version: localUpdate.version + 1 }],
          text: async () => "",
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => [],
        text: async () => "",
      } as Response;
    }) as unknown as typeof fetch;

    const report = await runSync("lww", 10);
    expect(report.synced).toBeGreaterThanOrEqual(1);

    const queue = await getAll("syncQueue");
    expect(queue.some((item) => item.status === "synced")).toBe(true);

    const updated = await getOne("products", "prd-para-500");
    expect(updated?.version).toBeGreaterThanOrEqual(localUpdate.version);
  });

  it("surfaces conflict and resolves it manually", async () => {
    const customer = await getOne("customers", "cus-ana");
    expect(customer).toBeTruthy();

    const pending = { ...customer!, phone: "+63 999 000 1111", version: customer!.version + 1, updatedAt: new Date().toISOString() };
    await putOne("customers", pending);
    const queued = await enqueueSync({ entity: "customer", operation: "update", payload: pending });

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/sync-queue") && init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ success: true, accepted: 1, rejected: [] }),
          text: async () => "",
        } as Response;
      }

      if (url.includes("/api/sync/process") && init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            success: true,
            processed: 1,
            results: [
              {
                id: queued.id,
                entity: "customer",
                operation: "update",
                status: "conflict",
                conflict: {
                  syncItemId: queued.id,
                  entity: "customer",
                  entityId: "cus-ana",
                  localVersion: pending.version,
                  remoteVersion: pending.version + 1,
                  localPayload: pending,
                  remotePayload: { id: "cus-ana", version: pending.version + 1, updatedAt: new Date().toISOString(), phone: "+63 900 111 2222" },
                },
              },
            ],
          }),
          text: async () => "",
        } as Response;
      }

      if (url.includes("/api/sync-queue") && init?.method === "PUT") {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ success: true }),
          text: async () => "",
        } as Response;
      }

      if (url.includes("/api/customers?") || url.endsWith("/api/customers")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => [{ id: "cus-ana", version: pending.version + 1, updatedAt: new Date().toISOString(), phone: "+63 900 111 2222" }],
          text: async () => "",
        } as Response;
      }

      if (url.includes("/api/products") || url.includes("/api/categories") || url.includes("/api/users") || url.includes("/api/settings") || url.includes("/api/transactions") || url.includes("/api/held-orders")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => [],
          text: async () => "",
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => [],
        text: async () => "",
      } as Response;
    }) as unknown as typeof fetch;

    const report = await runSync("manual", 10);
    expect(report.conflicts).toBeGreaterThanOrEqual(1);

    await resolveConflictManually(queued.id, "local-wins");
    const queue = await getAll("syncQueue");
    const resolved = queue.find((item) => item.id === queued.id);
    expect(resolved?.status).toBe("synced");
  });
});
