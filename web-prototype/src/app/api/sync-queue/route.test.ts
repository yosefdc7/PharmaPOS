import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getDb, resetDbSingleton } from "@/lib/server/db";
import { ensureDb, resetInitialized } from "@/lib/server/init";
import { GET, POST, PUT } from "./route";

describe("/api/sync-queue route", () => {
  beforeEach(async () => {
    resetDbSingleton();
    resetInitialized();
    await ensureDb();
  });

  it("POST enqueues and GET filters by status", async () => {
    const id = crypto.randomUUID();
    const postReq = new NextRequest("http://localhost/api/sync-queue", {
      method: "POST",
      body: JSON.stringify({
        id,
        entity: "transaction",
        operation: "create",
        payload: { id: "txn-1", version: 1 },
        status: "pending",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const postRes = await POST(postReq);
    expect(postRes.status).toBe(200);

    const getReq = new NextRequest("http://localhost/api/sync-queue?status=pending");
    const getRes = await GET(getReq);
    const items = (await getRes.json()) as Array<{ id: string; status: string }>;
    expect(items.some((item) => item.id === id && item.status === "pending")).toBe(true);
  });

  it("PUT resolves manual conflict and bulk marks pending synced", async () => {
    const db = getDb();
    const id = crypto.randomUUID();
    await db.execute({
      sql: "INSERT INTO sync_queue (id, entity, operation, payload, created_at, status, retry_count, last_error) VALUES (?, ?, ?, ?, ?, 'pending', 0, '')",
      args: [id, "product", "update", JSON.stringify({ id: "p-1", version: 2, name: "Test Product", quantity: 10, updatedAt: new Date().toISOString() }), new Date().toISOString()],
    });

    const resolveReq = new NextRequest("http://localhost/api/sync-queue", {
      method: "PUT",
      body: JSON.stringify({ syncItemId: id, resolution: "local-wins" }),
      headers: { "Content-Type": "application/json" },
    });

    const resolveRes = await PUT(resolveReq);
    expect(resolveRes.status).toBe(200);

    const row = await db.execute({ sql: "SELECT status FROM sync_queue WHERE id = ?", args: [id] });
    expect(row.rows[0].status).toBe("synced");

    await db.execute({
      sql: "INSERT INTO sync_queue (id, entity, operation, payload, created_at, status, retry_count, last_error) VALUES (?, ?, ?, ?, ?, 'pending', 0, '')",
      args: ["pending-1", "transaction", "create", JSON.stringify({ id: "txn-2", version: 1 }), new Date().toISOString()],
    });

    const bulkReq = new NextRequest("http://localhost/api/sync-queue", {
      method: "PUT",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const bulkRes = await PUT(bulkReq);
    expect(bulkRes.status).toBe(200);

    const pending = await db.execute("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'");
    expect(Number(pending.rows[0].count)).toBe(0);
  });

  it("PUT merged resolution upserts entity data (A1)", async () => {
    const db = getDb();

    await db.execute({
      sql: "INSERT INTO products (id, name, quantity, version, updated_at) VALUES (?, ?, ?, ?, ?)",
      args: ["p-merge", "Original", 10, 1, new Date().toISOString()],
    });

    const syncId = crypto.randomUUID();
    await db.execute({
      sql: "INSERT INTO sync_queue (id, entity, operation, payload, created_at, status, retry_count, last_error) VALUES (?, ?, ?, ?, ?, 'conflict', 0, '')",
      args: [syncId, "product", "update", JSON.stringify({ id: "p-merge", version: 2, name: "Local Name", quantity: 8 }), new Date().toISOString()],
    });

    const mergedReq = new NextRequest("http://localhost/api/sync-queue", {
      method: "PUT",
      body: JSON.stringify({
        syncItemId: syncId,
        resolution: "merged",
        mergedPayload: { id: "p-merge", version: 3, name: "Merged Name", quantity: 5, updatedAt: new Date().toISOString() },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PUT(mergedReq);
    expect(res.status).toBe(200);

    const product = await db.execute({ sql: "SELECT name, quantity, version FROM products WHERE id = ?", args: ["p-merge"] });
    expect(product.rows[0].name).toBe("Merged Name");
    expect(Number(product.rows[0].quantity)).toBe(5);
    expect(Number(product.rows[0].version)).toBe(3);

    const syncRow = await db.execute({ sql: "SELECT status FROM sync_queue WHERE id = ?", args: [syncId] });
    expect(syncRow.rows[0].status).toBe("synced");
  });

  it("PUT remote-wins resolution upserts entity data (A1)", async () => {
    const db = getDb();

    await db.execute({
      sql: "INSERT INTO products (id, name, quantity, version, updated_at) VALUES (?, ?, ?, ?, ?)",
      args: ["p-remote", "Original", 10, 1, new Date().toISOString()],
    });

    const syncId = crypto.randomUUID();
    await db.execute({
      sql: "INSERT INTO sync_queue (id, entity, operation, payload, created_at, status, retry_count, last_error) VALUES (?, ?, ?, ?, ?, 'conflict', 0, '')",
      args: [syncId, "product", "update", JSON.stringify({ id: "p-remote", version: 2 }), new Date().toISOString()],
    });

    const remoteReq = new NextRequest("http://localhost/api/sync-queue", {
      method: "PUT",
      body: JSON.stringify({
        syncItemId: syncId,
        resolution: "remote-wins",
        remotePayload: { id: "p-remote", version: 5, name: "Remote Name", quantity: 20, updatedAt: new Date().toISOString() },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PUT(remoteReq);
    expect(res.status).toBe(200);

    const product = await db.execute({ sql: "SELECT name, quantity, version FROM products WHERE id = ?", args: ["p-remote"] });
    expect(product.rows[0].name).toBe("Remote Name");
    expect(Number(product.rows[0].version)).toBe(5);
  });

  it("PUT returns 404 for non-existent sync item", async () => {
    const req = new NextRequest("http://localhost/api/sync-queue", {
      method: "PUT",
      body: JSON.stringify({ syncItemId: "non-existent", resolution: "local-wins" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PUT(req);
    expect(res.status).toBe(404);
  });
});
