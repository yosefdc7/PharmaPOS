import { beforeEach, describe, expect, it } from "vitest";
import type { Client } from "@libsql/client";
import { getDb, resetDbSingleton } from "@/lib/server/db";
import { ensureDb, resetInitialized } from "@/lib/server/init";

describe("db feature-flag migration", () => {
  let db: Client;

  beforeEach(async () => {
    resetDbSingleton();
    resetInitialized();
    db = getDb(":memory:");
    await ensureDb(db);
  });

  it("seeds a backward-compatible flag record", async () => {
    const result = await db.execute({
      sql: "SELECT value FROM _meta WHERE id = ?",
      args: ["featureFlags"],
    });
    const flags = JSON.parse(result.rows[0].value as string);
    expect(flags).toEqual({ sync: false, payments: false, refunds: false });
  });

  it("supports staged rollout by enabling one surface at a time", async () => {
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
