import pathlib

# db.test.ts
content = '''import { beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbSingleton } from "@/lib/server/db";
import { ensureDb, resetInitialized } from "@/lib/server/init";

describe("SQLite backend repository", () => {
  beforeEach(async () => {
    resetDbSingleton();
    resetInitialized();
  });

  it("seeds demo data on first init", async () => {
    const db = getDb(":memory:");
    await ensureDb(db);
    const products = await db.execute("SELECT COUNT(*) as count FROM products");
    const users = await db.execute("SELECT * FROM users WHERE username = ?", ["admin"]);

    expect(Number(products.rows[0].count)).toBeGreaterThan(3);
    expect(users.rows.length).toBe(1);
    expect(users.rows[0].username).toBe("admin");
  });

  it("does not re-seed on subsequent inits", async () => {
    const db = getDb(":memory:");
    await ensureDb(db);
    const productsBefore = await db.execute("SELECT COUNT(*) as count FROM products");
    const countBefore = Number(productsBefore.rows[0].count);

    await ensureDb(db);

    const productsAfter = await db.execute("SELECT COUNT(*) as count FROM products");
    const countAfter = Number(productsAfter.rows[0].count);

    expect(countAfter).toBe(countBefore);
  });

  it("queues local changes and marks them synced", async () => {
    const db = getDb(":memory:");
    await ensureDb(db);

    await db.execute({
      sql: "INSERT INTO sync_queue (id, entity, operation, payload, created_at, status, retry_count, last_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: ["sq-1", "transaction", "create", JSON.stringify({ id: "txn-1" }), new Date().toISOString(), "pending", 0, ""],
    });

    const pending = await db.execute("SELECT * FROM sync_queue WHERE status = 'pending'");
    expect(pending.rows.length).toBe(1);
    expect(pending.rows[0].status).toBe("pending");

    await db.execute("UPDATE sync_queue SET status = 'synced' WHERE status = 'pending'");
    await db.execute("UPDATE transactions SET sync_status = 'synced' WHERE sync_status = 'pending'");

    const synced = await db.execute("SELECT * FROM sync_queue WHERE id = ?", ["sq-1"]);
    expect(synced.rows[0].status).toBe("synced");
  });
});
'''

p = pathlib.Path('src/lib/server/db.test.ts')
p.write_text(content)
print('Updated db.test.ts')

# db.integration.test.ts
content2 = '''import { beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbSingleton } from "@/lib/server/db";
import { ensureDb, resetInitialized } from "@/lib/server/init";

describe("db feature-flag migration", () => {
  beforeEach(async () => {
    resetDbSingleton();
    resetInitialized();
  });

  it("seeds a backward-compatible flag record", async () => {
    const db = getDb(":memory:");
    await ensureDb(db);
    const result = await db.execute({
      sql: "SELECT value FROM _meta WHERE id = ?",
      args: ["featureFlags"],
    });
    const flags = JSON.parse(result.rows[0].value as string);
    expect(flags).toEqual({ sync: false, payments: false, refunds: false });
  });

  it("supports staged rollout by enabling one surface at a time", async () => {
    const db = getDb(":memory:");
    await ensureDb(db);
    await db.execute({
      sql: "UPDATE _meta SET value = ? WHERE id = ?",
      args: [JSON.stringify({ sync: true, payments: false, refunds: false }), "featureFlags"],
    });

    const result = await db.execute({
      sql: "SELECT value FROM _meta WHERE id = ?",
      args: ["featureFlags"],
    });
    const flags = JSON.parse(result.rows[0].value as string);
    expect(flags).toEqual({ sync: true, payments: false, refunds: false });
  });
});
'''

p2 = pathlib.Path('src/lib/server/db.integration.test.ts')
p2.write_text(content2)
print('Updated db.integration.test.ts')

# migrations.integration.test.ts
content3 = '''import { beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbSingleton } from "@/lib/server/db";
import { ensureDb, resetInitialized } from "@/lib/server/init";

describe("staging rollback procedure", () => {
  beforeEach(async () => {
    resetDbSingleton();
    resetInitialized();
  });

  it("can disable risky surfaces as rollback kill-switches", async () => {
    const db = getDb(":memory:");
    await ensureDb(db);

    // Enable all
    await db.execute({
      sql: "UPDATE _meta SET value = ? WHERE id = ?",
      args: [JSON.stringify({ sync: true, payments: true, refunds: true }), "featureFlags"],
    });

    // Disable all (rollback)
    await db.execute({
      sql: "UPDATE _meta SET value = ? WHERE id = ?",
      args: [JSON.stringify({ sync: false, payments: false, refunds: false }), "featureFlags"],
    });

    const result = await db.execute({
      sql: "SELECT value FROM _meta WHERE id = ?",
      args: ["featureFlags"],
    });
    const flags = JSON.parse(result.rows[0].value as string);
    expect(flags).toEqual({ sync: false, payments: false, refunds: false });
  });
});
'''

p3 = pathlib.Path('src/lib/server/migrations.integration.test.ts')
p3.write_text(content3)
print('Updated migrations.integration.test.ts')

# sync.contract.test.ts
content4 = '''import { beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbSingleton } from "@/lib/server/db";
import { ensureDb, resetInitialized } from "@/lib/server/init";

describe("sync queue contract", () => {
  beforeEach(async () => {
    resetDbSingleton();
    resetInitialized();
  });

  it("writes queue items matching the offline-sync contract", async () => {
    const db = getDb(":memory:");
    await ensureDb(db);
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await db.execute({
      sql: "INSERT INTO sync_queue (id, entity, operation, payload, created_at, status, retry_count, last_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [id, "transaction", "create", JSON.stringify({ id: "txn-123" }), createdAt, "pending", 0, ""],
    });

    const result = await db.execute({
      sql: "SELECT * FROM sync_queue WHERE id = ?",
      args: [id],
    });

    expect(result.rows.length).toBe(1);
    const item = result.rows[0];
    expect(item.entity).toBe("transaction");
    expect(item.operation).toBe("create");
    expect(item.status).toBe("pending");
    expect(Number(item.retry_count)).toBe(0);
    expect(item.last_error).toBe("");
    expect(typeof item.id).toBe("string");
    expect(typeof item.created_at).toBe("string");
  });
});
'''

p4 = pathlib.Path('src/contracts/sync.contract.test.ts')
p4.write_text(content4)
print('Updated sync.contract.test.ts')

# auth.test.ts
content5 = '''import { beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { getDb, resetDbSingleton } from "@/lib/server/db";
import { ensureDb, resetInitialized } from "@/lib/server/init";

describe("auth - login and password hashing", () => {
  beforeEach(async () => {
    resetDbSingleton();
    resetInitialized();
  });

  it("hashes and verifies passwords with bcrypt", async () => {
    const hash = await bcrypt.hash("test-password", 10);
    expect(hash).not.toBe("test-password");
    expect(await bcrypt.compare("test-password", hash)).toBe(true);
    expect(await bcrypt.compare("wrong-password", hash)).toBe(false);
  });

  it("seed admin has valid bcrypt hash", async () => {
    const db = getDb(":memory:");
    await ensureDb(db);
    const result = await db.execute({
      sql: "SELECT password_hash FROM users WHERE username = ?",
      args: ["admin"],
    });
    expect(result.rows.length).toBe(1);
    const hash = result.rows[0].password_hash as string;
    expect(await bcrypt.compare("admin", hash)).toBe(true);
    expect(await bcrypt.compare("wrong", hash)).toBe(false);
  });

  it("seed cashier has valid bcrypt hash", async () => {
    const db = getDb(":memory:");
    await ensureDb(db);
    const result = await db.execute({
      sql: "SELECT password_hash FROM users WHERE username = ?",
      args: ["cashier"],
    });
    expect(result.rows.length).toBe(1);
    const hash = result.rows[0].password_hash as string;
    expect(await bcrypt.compare("cashier", hash)).toBe(true);
  });
});
'''

p5 = pathlib.Path('src/lib/server/auth.test.ts')
p5.write_text(content5)
print('Updated auth.test.ts')

print('All test files updated')
