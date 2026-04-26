import pathlib

path = pathlib.Path(r"c:\Users\josef\Vibe Apps2\PPOS\web-prototype\src\lib\server\db.test.ts")

content = """import { beforeEach, describe, expect, it } from "vitest";
import type { Client } from "@libsql/client";
import { getDb, resetDbSingleton } from "@/lib/server/db";
import { ensureDb, resetInitialized } from "@/lib/server/init";

describe("SQLite backend repository", () => {
  let db: Client;

  beforeEach(async () => {
    resetDbSingleton();
    resetInitialized();
    db = getDb(":memory:");
    await ensureDb(db);
  });

  it("seeds demo data on first init", async () => {
    const products = await db.execute("SELECT COUNT(*) as count FROM products");
    const users = await db.execute("SELECT * FROM users WHERE username = 'admin'");

    expect(Number(products.rows[0].count)).toBeGreaterThan(3);
    expect(users.rows.length).toBe(1);
    expect(users.rows[0].username).toBe("admin");
  });

  it("does not re-seed on subsequent inits", async () => {
    const productsBefore = await db.execute("SELECT COUNT(*) as count FROM products");
    const countBefore = Number(productsBefore.rows[0].count);

    // Re-run ensureDb with the same db instance (should be no-op due to seeded flag)
    await ensureDb(db);

    const productsAfter = await db.execute("SELECT COUNT(*) as count FROM products");
    const countAfter = Number(productsAfter.rows[0].count);

    expect(countAfter).toBe(countBefore);
  });

  it("queues local changes and marks them synced", async () => {
    await db.execute({
      sql: "INSERT INTO sync_queue (id, entity, operation, payload, created_at, status, retry_count, last_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: ["sq-1", "transaction", "create", '{"id":"txn-1"}', new Date().toISOString(), "pending", 0, ""],
    });

    const pending = await db.execute("SELECT * FROM sync_queue WHERE status = 'pending'");
    expect(pending.rows.length).toBe(1);
    expect(pending.rows[0].status).toBe("pending");

    await db.execute("UPDATE sync_queue SET status = 'synced' WHERE status = 'pending'");
    await db.execute("UPDATE transactions SET sync_status = 'synced' WHERE sync_status = 'pending'");

    const synced = await db.execute("SELECT * FROM sync_queue WHERE id = 'sq-1'");
    expect(synced.rows[0].status).toBe("synced");
  });
});
"""

path.write_text(content, encoding="utf-8")
print(f"Written {path.name}: {path.stat().st_size} bytes")
