import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getDb, resetDbSingleton } from "@/lib/server/db";
import { ensureDb, resetInitialized } from "@/lib/server/init";
import { GET, POST } from "./route";

describe("/api/sync/process route", () => {
  beforeEach(async () => {
    resetDbSingleton();
    resetInitialized();
    await ensureDb();
  });

  it("POST leaves conflict unresolved when strategy is manual", async () => {
    const db = getDb();

    await db.execute({
      sql: "INSERT INTO products (id, name, version, updated_at) VALUES (?, ?, ?, ?)",
      args: ["p-1", "Remote Product", 3, new Date().toISOString()],
    });

    const syncId = crypto.randomUUID();
    await db.execute({
      sql: "INSERT INTO sync_queue (id, entity, operation, payload, created_at, status, retry_count, entity_version, last_error) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, '')",
      args: [syncId, "product", "update", JSON.stringify({ id: "p-1", name: "Local Product", version: 2 }), new Date().toISOString(), 2],
    });

    const req = new NextRequest("http://localhost/api/sync/process", {
      method: "POST",
      body: JSON.stringify({ strategy: "manual", maxItems: 10 }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.results[0].status).toBe("conflict");

    const row = await db.execute({ sql: "SELECT status FROM sync_queue WHERE id = ?", args: [syncId] });
    expect(row.rows[0].status).toBe("conflict");
  });

  it("POST applies local-wins strategy and GET returns stats", async () => {
    const db = getDb();

    const syncId = crypto.randomUUID();
    await db.execute({
      sql: "INSERT INTO sync_queue (id, entity, operation, payload, created_at, status, retry_count, entity_version, last_error) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, '')",
      args: [syncId, "category", "create", JSON.stringify({ id: "cat-test", name: "Test", version: 1, updated_at: new Date().toISOString() }), new Date().toISOString(), 1],
    });

    const req = new NextRequest("http://localhost/api/sync/process", {
      method: "POST",
      body: JSON.stringify({ strategy: "local-wins", maxItems: 10 }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.results[0].status).toBe("synced");

    const statsRes = await GET();
    const statsJson = await statsRes.json();
    expect(statsJson.stats).toBeTypeOf("object");
  });

  it("POST applies remote-wins strategy (B6)", async () => {
    const db = getDb();

    await db.execute({
      sql: "INSERT INTO products (id, name, version, updated_at) VALUES (?, ?, ?, ?)",
      args: ["p-remote", "Remote Product", 3, new Date().toISOString()],
    });

    const syncId = crypto.randomUUID();
    await db.execute({
      sql: "INSERT INTO sync_queue (id, entity, operation, payload, created_at, status, retry_count, entity_version, last_error) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, '')",
      args: [syncId, "product", "update", JSON.stringify({ id: "p-remote", name: "Local Product", version: 2 }), new Date().toISOString(), 2],
    });

    const req = new NextRequest("http://localhost/api/sync/process", {
      method: "POST",
      body: JSON.stringify({ strategy: "remote-wins", maxItems: 10 }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.results[0].status).toBe("synced");

    const row = await db.execute({ sql: "SELECT status FROM sync_queue WHERE id = ?", args: [syncId] });
    expect(row.rows[0].status).toBe("synced");
  });

  it("POST increments retry count on error (B6)", async () => {
    const db = getDb();

    const syncId = crypto.randomUUID();
    await db.execute({
      sql: "INSERT INTO sync_queue (id, entity, operation, payload, created_at, status, retry_count, entity_version, last_error) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, '')",
      args: [syncId, "product", "update", "not-valid-json", new Date().toISOString(), 1],
    });

    const req = new NextRequest("http://localhost/api/sync/process", {
      method: "POST",
      body: JSON.stringify({ strategy: "lww", maxItems: 10 }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(req);
    const row = await db.execute({ sql: "SELECT retry_count, status FROM sync_queue WHERE id = ?", args: [syncId] });
    expect(Number(row.rows[0].retry_count)).toBe(1);
    expect(row.rows[0].status).toBe("pending");
  });
});
