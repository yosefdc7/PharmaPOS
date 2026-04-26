import { beforeEach, describe, expect, it } from "vitest";
import type { Client } from "@libsql/client";
import bcrypt from "bcryptjs";
import { getDb, resetDbSingleton } from "@/lib/server/db";
import { ensureDb, resetInitialized } from "@/lib/server/init";

describe("auth - login and password hashing", () => {
  let db: Client;

  beforeEach(async () => {
    resetDbSingleton();
    resetInitialized();
    db = getDb(":memory:");
    await ensureDb(db);
  });

  it("hashes and verifies passwords with bcrypt", async () => {
    const hash = await bcrypt.hash("test-password", 10);
    expect(hash).not.toBe("test-password");
    expect(await bcrypt.compare("test-password", hash)).toBe(true);
    expect(await bcrypt.compare("wrong-password", hash)).toBe(false);
  });

  it("seed admin has valid bcrypt hash", async () => {
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
    const result = await db.execute({
      sql: "SELECT password_hash FROM users WHERE username = ?",
      args: ["cashier"],
    });
    expect(result.rows.length).toBe(1);
    const hash = result.rows[0].password_hash as string;
    expect(await bcrypt.compare("cashier", hash)).toBe(true);
  });});
