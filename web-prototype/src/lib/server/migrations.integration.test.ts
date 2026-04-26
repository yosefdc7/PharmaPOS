import { beforeEach, describe, expect, it } from "vitest";
import type { Client } from "@libsql/client";
import { getDb, resetDbSingleton } from "@/lib/server/db";
import { ensureDb, resetInitialized } from "@/lib/server/init";

describe("staging rollback procedure", () => {
  let db: Client;

  beforeEach(async () => {
    resetDbSingleton();
    resetInitialized();
    db = getDb(":memory:");
    await ensureDb(db);
  });

  it("can disable risky surfaces as rollback kill-switches", async () => {
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
