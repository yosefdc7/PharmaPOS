/** @vitest-environment jsdom */

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { getAll, login, logout, openPosDb, readSession, resetPosDbForTests, saveLocalUserAccount, seedIfNeeded, writeSession } from "./db";
import { seedUsers } from "./seed";

function createStorageMock() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

beforeEach(async () => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: createStorageMock()
  });
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: createStorageMock()
  });
  await resetPosDbForTests();
});

describe("local auth helpers", () => {
  it("authenticates the seeded admin user with a hashed local password", async () => {
    await seedIfNeeded();

    const result = await login("admin", "admin");

    expect(result.auth).toBe(true);
    expect(result.user?.username).toBe("admin");
    expect(readSession()?.username).toBe("admin");
  });

  it("rejects an invalid password", async () => {
    await seedIfNeeded();

    const result = await login("admin", "wrong-password");

    expect(result.auth).toBe(false);
    expect(readSession()).toBeNull();
  });

  it("drops expired sessions during session restore", () => {
    writeSession(seedUsers[0], -1000);

    expect(readSession()).toBeNull();
  });

  it("clears the stored session on logout", () => {
    writeSession(seedUsers[0]);

    logout();

    expect(readSession()).toBeNull();
  });

  it("does not expose passwordHash through public user reads", async () => {
    await seedIfNeeded();

    const users = await getAll("users");

    expect(users[0]).not.toHaveProperty("passwordHash");
  });

  it("requires a password when creating a new local user", async () => {
    await seedIfNeeded();

    await expect(
      saveLocalUserAccount({
        username: "newcashier",
        fullname: "New Cashier",
        role: "cashier",
        permissions: {
          products: false,
          categories: false,
          customers: true,
          transactions: true,
          rx: false,
          controlTower: false,
          users: false,
          settings: false,
          reports: false,
          sync: false,
        },
      })
    ).rejects.toThrow("Password is required when creating a user.");
  });

  it("preserves the existing hash when editing a user without changing the password", async () => {
    await seedIfNeeded();
    const db = await openPosDb();
    const before = await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction("users", "readonly").objectStore("users").get("usr-cashier");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const savedUser = await saveLocalUserAccount({
      id: "usr-cashier",
      username: "cashier",
      fullname: "Updated Cashier",
      role: "cashier",
      permissions: {
        products: false,
        categories: false,
        customers: true,
        transactions: true,
        rx: false,
        controlTower: false,
        users: false,
        settings: false,
        reports: false,
        sync: false,
      },
    });

    const after = await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction("users", "readonly").objectStore("users").get("usr-cashier");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    expect(savedUser.fullname).toBe("Updated Cashier");
    expect(savedUser).not.toHaveProperty("passwordHash");
    expect((after as { passwordHash: string }).passwordHash).toBe((before as { passwordHash: string }).passwordHash);
  });
});
