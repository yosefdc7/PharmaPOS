import pathlib
import sys

NL = chr(10)

files_to_write = {}

# db.test.ts
files_to_write[pathlib.Path(r"c:\Users\josef\Vibe Apps2\PPOS\web-prototype\src\lib\server\db.test.ts")] = (
    'import { beforeEach, describe, expect, it } from "vitest";' + NL
    + 'import type { Client } from "@libsql/client";' + NL
    + 'import { getDb, resetDbSingleton } from "@/lib/server/db";' + NL
    + 'import { ensureDb, resetInitialized } from "@/lib/server/init";' + NL
    + NL
    + 'describe("SQLite backend repository", () => {' + NL
    + '  let db: Client;' + NL
    + NL
    + '  beforeEach(async () => {' + NL
    + '    resetDbSingleton();' + NL
    + '    resetInitialized();' + NL
    + '    db = getDb(":memory:");' + NL
    + '    await ensureDb(db);' + NL
    + '  });' + NL
    + NL
    + '  it("seeds demo data on first init", async () => {' + NL
    + '    const products = await db.execute("SELECT COUNT(*) as count FROM products");' + NL
    + "    const users = await db.execute(\"SELECT * FROM users WHERE username = 'admin'\");" + NL
    + NL
    + '    expect(Number(products.rows[0].count)).toBeGreaterThan(3);' + NL
    + '    expect(users.rows.length).toBe(1);' + NL
    + '    expect(users.rows[0].username).toBe("admin");' + NL
    + '  });' + NL
    + NL
    + '  it("does not re-seed on subsequent inits", async () => {' + NL
    + '    const productsBefore = await db.execute("SELECT COUNT(*) as count FROM products");' + NL
    + '    const countBefore = Number(productsBefore.rows[0].count);' + NL
    + NL
    + '    // Re-run ensureDb with the same db instance (should be no-op due to seeded flag)' + NL
    + '    await ensureDb(db);' + NL
    + NL
    + '    const productsAfter = await db.execute("SELECT COUNT(*) as count FROM products");' + NL
    + '    const countAfter = Number(productsAfter.rows[0].count);' + NL
    + NL
    + '    expect(countAfter).toBe(countBefore);' + NL
    + '  });' + NL
    + NL
    + '  it("queues local changes and marks them synced", async () => {' + NL
    + '    await db.execute({' + NL
    + '      sql: "INSERT INTO sync_queue (id, entity, operation, payload, created_at, status, retry_count, last_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",' + NL
    + '      args: ["sq-1", "transaction", "create", \'{ "id": "txn-1" }\', new Date().toISOString(), "pending", 0, ""],' + NL
    + '    });' + NL
    + NL
    + '    const pending = await db.execute("SELECT * FROM sync_queue WHERE status = \'pending\'");' + NL
    + '    expect(pending.rows.length).toBe(1);' + NL
    + '    expect(pending.rows[0].status).toBe("pending");' + NL
    + NL
    + '    await db.execute("UPDATE sync_queue SET status = \'synced\' WHERE status = \'pending\'");' + NL
    + '    await db.execute("UPDATE transactions SET sync_status = \'synced\' WHERE sync_status = \'pending\'");' + NL
    + NL
    + '    const synced = await db.execute("SELECT * FROM sync_queue WHERE id = \'sq-1\'");' + NL
    + '    expect(synced.rows[0].status).toBe("synced");' + NL
    + '  });' + NL
    + '});' + NL
)

# db.integration.test.ts
files_to_write[pathlib.Path(r"c:\Users\josef\Vibe Apps2\PPOS\web-prototype\src\lib\server\db.integration.test.ts")] = (
    'import { beforeEach, describe, expect, it } from "vitest";' + NL
    + 'import type { Client } from "@libsql/client";' + NL
    + 'import { getDb, resetDbSingleton } from "@/lib/server/db";' + NL
    + 'import { ensureDb, resetInitialized } from "@/lib/server/init";' + NL
    + NL
    + 'describe("db feature-flag migration", () => {' + NL
    + '  let db: Client;' + NL
    + NL
    + '  beforeEach(async () => {' + NL
    + '    resetDbSingleton();' + NL
    + '    resetInitialized();' + NL
    + '    db = getDb(":memory:");' + NL
    + '    await ensureDb(db);' + NL
    + '  });' + NL
    + NL
    + '  it("seeds a backward-compatible flag record", async () => {' + NL
    + '    const result = await db.execute({' + NL
    + '      sql: "SELECT value FROM _meta WHERE id = ?",' + NL
    + '      args: ["featureFlags"],' + NL
    + '    });' + NL
    + '    const flags = JSON.parse(result.rows[0].value as string);' + NL
    + '    expect(flags).toEqual({ sync: false, payments: false, refunds: false });' + NL
    + '  });' + NL
    + NL
    + '  it("supports staged rollout by enabling one surface at a time", async () => {' + NL
    + '    await db.execute({' + NL
    + '      sql: "UPDATE _meta SET value = ? WHERE id = ?",' + NL
    + '      args: [JSON.stringify({ sync: true, payments: false, refunds: false }), "featureFlags"],' + NL
    + '    });' + NL
    + NL
    + '    const result = await db.execute({' + NL
    + '      sql: "SELECT value FROM _meta WHERE id = ?",' + NL
    + '      args: ["featureFlags"],' + NL
    + '    });' + NL
    + '    const flags = JSON.parse(result.rows[0].value as string);' + NL
    + '    expect(flags).toEqual({ sync: true, payments: false, refunds: false });' + NL
    + '  });' + NL
    + '});' + NL
)

# auth.test.ts
files_to_write[pathlib.Path(r"c:\Users\josef\Vibe Apps2\PPOS\web-prototype\src\lib\server\auth.test.ts")] = (
    'import { beforeEach, describe, expect, it } from "vitest";' + NL
    + 'import type { Client } from "@libsql/client";' + NL
    + 'import bcrypt from "bcryptjs";' + NL
    + 'import { getDb, resetDbSingleton } from "@/lib/server/db";' + NL
    + 'import { ensureDb, resetInitialized } from "@/lib/server/init";' + NL
    + NL
    + 'describe("auth - login and password hashing", () => {' + NL
    + '  let db: Client;' + NL
    + NL
    + '  beforeEach(async () => {' + NL
    + '    resetDbSingleton();' + NL
    + '    resetInitialized();' + NL
    + '    db = getDb(":memory:");' + NL
    + '    await ensureDb(db);' + NL
    + '  });' + NL
    + NL
    + '  it("hashes and verifies passwords with bcrypt", async () => {' + NL
    + '    const hash = await bcrypt.hash("test-password", 10);' + NL
    + '    expect(hash).not.toBe("test-password");' + NL
    + '    expect(await bcrypt.compare("test-password", hash)).toBe(true);' + NL
    + '    expect(await bcrypt.compare("wrong-password", hash)).toBe(false);' + NL
    + '  });' + NL
    + NL
    + '  it("seed admin has valid bcrypt hash", async () => {' + NL
    + '    const result = await db.execute({' + NL
    + '      sql: "SELECT password_hash FROM users WHERE username = ?",' + NL
    + '      args: ["admin"],' + NL
    + '    });' + NL
    + '    expect(result.rows.length).toBe(1);' + NL
    + '    const hash = result.rows[0].password_hash as string;' + NL
    + '    expect(await bcrypt.compare("admin", hash)).toBe(true);' + NL
    + '    expect(await bcrypt.compare("wrong", hash)).toBe(false);' + NL
    + '  });' + NL
    + NL
    + '  it("seed cashier has valid bcrypt hash", async () => {' + NL
    + '    const result = await db.execute({' + NL
    + '      sql: "SELECT password_hash FROM users WHERE username = ?",' + NL
    + '      args: ["cashier"],' + NL
    + '    });' + NL
    + '    expect(result.rows.length).toBe(1);' + NL
    + '    const hash = result.rows[0].password_hash as string;' + NL
    + '    expect(await bcrypt.compare("cashier", hash)).toBe(true);' + NL
    + '  });' + NL
    + '});' + NL
)

# migrations.integration.test.ts
files_to_write[pathlib.Path(r"c:\Users\josef\Vibe Apps2\PPOS\web-prototype\src\lib\server\migrations.integration.test.ts")] = (
    'import { beforeEach, describe, expect, it } from "vitest";' + NL
    + 'import type { Client } from "@libsql/client";' + NL
    + 'import { getDb, resetDbSingleton } from "@/lib/server/db";' + NL
    + 'import { ensureDb, resetInitialized } from "@/lib/server/init";' + NL
    + NL
    + 'describe("staging rollback procedure", () => {' + NL
    + '  let db: Client;' + NL
    + NL
    + '  beforeEach(async () => {' + NL
    + '    resetDbSingleton();' + NL
    + '    resetInitialized();' + NL
    + '    db = getDb(":memory:");' + NL
    + '    await ensureDb(db);' + NL
    + '  });' + NL
    + NL
    + '  it("can disable risky surfaces as rollback kill-switches", async () => {' + NL
    + '    // Enable all' + NL
    + '    await db.execute({' + NL
    + '      sql: "UPDATE _meta SET value = ? WHERE id = ?",' + NL
    + '      args: [JSON.stringify({ sync: true, payments: true, refunds: true }), "featureFlags"],' + NL
    + '    });' + NL
    + NL
    + '    // Disable all (rollback)' + NL
    + '    await db.execute({' + NL
    + '      sql: "UPDATE _meta SET value = ? WHERE id = ?",' + NL
    + '      args: [JSON.stringify({ sync: false, payments: false, refunds: false }), "featureFlags"],' + NL
    + '    });' + NL
    + NL
    + '    const result = await db.execute({' + NL
    + '      sql: "SELECT value FROM _meta WHERE id = ?",' + NL
    + '      args: ["featureFlags"],' + NL
    + '    });' + NL
    + '    const flags = JSON.parse(result.rows[0].value as string);' + NL
    + '    expect(flags).toEqual({ sync: false, payments: false, refunds: false });' + NL
    + '  });' + NL
    + '});' + NL
)

# sync.contract.test.ts
files_to_write[pathlib.Path(r"c:\Users\josef\Vibe Apps2\PPOS\web-prototype\src\contracts\sync.contract.test.ts")] = (
    'import { beforeEach, describe, expect, it } from "vitest";' + NL
    + 'import type { Client } from "@libsql/client";' + NL
    + 'import { getDb, resetDbSingleton } from "@/lib/server/db";' + NL
    + 'import { ensureDb, resetInitialized } from "@/lib/server/init";' + NL
    + NL
    + 'describe("sync queue contract", () => {' + NL
    + '  let db: Client;' + NL
    + NL
    + '  beforeEach(async () => {' + NL
    + '    resetDbSingleton();' + NL
    + '    resetInitialized();' + NL
    + '    db = getDb(":memory:");' + NL
    + '    await ensureDb(db);' + NL
    + '  });' + NL
    + NL
    + '  it("writes queue items matching the offline-sync contract", async () => {' + NL
    + '    const id = crypto.randomUUID();' + NL
    + '    const createdAt = new Date().toISOString();' + NL
    + NL
    + '    await db.execute({' + NL
    + '      sql: "INSERT INTO sync_queue (id, entity, operation, payload, created_at, status, retry_count, last_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",' + NL
    + '      args: [id, "transaction", "create", \'{ "id": "txn-123" }\', createdAt, "pending", 0, ""],' + NL
    + '    });' + NL
    + NL
    + '    const result = await db.execute({' + NL
    + '      sql: "SELECT * FROM sync_queue WHERE id = ?",' + NL
    + '      args: [id],' + NL
    + '    });' + NL
    + NL
    + '    expect(result.rows.length).toBe(1);' + NL
    + '    const item = result.rows[0];' + NL
    + '    expect(item.entity).toBe("transaction");' + NL
    + '    expect(item.operation).toBe("create");' + NL
    + '    expect(item.status).toBe("pending");' + NL
    + '    expect(Number(item.retry_count)).toBe(0);' + NL
    + '    expect(item.last_error).toBe("");' + NL
    + '    expect(typeof item.id).toBe("string");' + NL
    + '    expect(typeof item.created_at).toBe("string");' + NL
    + '  });' + NL
    + '});' + NL
)

for path, content in files_to_write.items():
    path.write_text(content, encoding="utf-8")
    written = path.read_text(encoding="utf-8")
    line_count = len(written.split("\n"))
    first_line = written.split("\n")[0]
    print(f"OK: {path.name} ({line_count} lines, first: {first_line[:50]})")
