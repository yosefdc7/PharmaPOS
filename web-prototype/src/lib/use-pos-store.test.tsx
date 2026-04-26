/** @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedSettings, seedUsers } from "./seed";
import { canUserAccessView, getAvailableViews, resolveAccessibleView } from "./use-permissions";
import { usePosStore } from "./use-pos-store";

const getAllMock = vi.fn();
const getOneMock = vi.fn();
const getFeatureFlagsMock = vi.fn();
const loginMock = vi.fn();
const requestPersistentStorageMock = vi.fn();
const readSessionMock = vi.fn();
const shouldAutoLoginMock = vi.fn();

vi.mock("./db", () => ({
  deleteOne: vi.fn(),
  enqueueSync: vi.fn(),
  getAll: (...args: unknown[]) => getAllMock(...args),
  getFeatureFlags: () => getFeatureFlagsMock(),
  getOne: (...args: unknown[]) => getOneMock(...args),
  login: (...args: unknown[]) => loginMock(...args),
  logout: vi.fn(),
  markPendingSyncAsSynced: vi.fn(),
  putMany: vi.fn(),
  putOne: vi.fn(),
  readSession: () => readSessionMock(),
  requestPersistentStorage: () => requestPersistentStorageMock(),
  resetPrototypeData: vi.fn(),
  saveLocalUserAccount: vi.fn(),
  seedIfNeeded: vi.fn(),
  shouldAutoLogin: () => shouldAutoLoginMock(),
  writeSession: vi.fn(),
  getConflictItems: vi.fn().mockResolvedValue([])
}));

function mockStoreCollections() {
  getAllMock.mockImplementation(async (storeName: string) => {
    switch (storeName) {
      case "users":
        return seedUsers;
      default:
        return [];
    }
  });

  getOneMock.mockImplementation(async (storeName: string, id: string) => {
    if (storeName === "settings" && id === "store") {
      return seedSettings;
    }
    if (storeName === "users" && id === seedUsers[1].id) {
      return seedUsers[1];
    }
    return undefined;
  });

  getFeatureFlagsMock.mockResolvedValue({ payments: true, sync: true, refunds: true });
  requestPersistentStorageMock.mockResolvedValue("granted");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreCollections();
  readSessionMock.mockReturnValue(null);
  shouldAutoLoginMock.mockReturnValue(false);
  loginMock.mockResolvedValue({ auth: true, user: seedUsers[0] });
});

describe("usePosStore boot flow", () => {
  it("restores the saved session user before auto-login", async () => {
    readSessionMock.mockReturnValue({
      userId: seedUsers[1].id,
      username: seedUsers[1].username,
      startedAt: "2026-04-26T00:00:00.000Z",
      expiresAt: "2099-04-26T12:00:00.000Z"
    });

    const { result } = renderHook(() => usePosStore());

    await waitFor(() => expect(result.current.loadState).toBe("ready"));
    expect(result.current.currentUser?.id).toBe(seedUsers[1].id);
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("shows an unauthenticated boot state when there is no saved session and demo auto-login is disabled", async () => {
    const { result } = renderHook(() => usePosStore());

    await waitFor(() => expect(result.current.loadState).toBe("ready"));
    expect(loginMock).not.toHaveBeenCalled();
    expect(result.current.currentUser).toBeNull();
  });

  it("falls back to admin auto-login only when demo mode is enabled", async () => {
    shouldAutoLoginMock.mockReturnValue(true);

    const { result } = renderHook(() => usePosStore());

    await waitFor(() => expect(result.current.loadState).toBe("ready"));
    expect(loginMock).toHaveBeenCalledWith("admin", "admin");
    expect(result.current.currentUser?.id).toBe(seedUsers[0].id);
  });

  it("leaves the app unauthenticated when auto-login fails", async () => {
    loginMock.mockResolvedValue({ auth: false });

    const { result } = renderHook(() => usePosStore());

    await waitFor(() => expect(result.current.loadState).toBe("ready"));
    expect(result.current.currentUser).toBeNull();
  });
});

describe("view authorization helpers", () => {
  it("limits cashier access to POS and Customers", () => {
    const cashier = seedUsers.find((u) => u.role === "cashier")!;
    expect(canUserAccessView(cashier, "pos")).toBe(true);
    expect(canUserAccessView(cashier, "customers")).toBe(true);
    expect(canUserAccessView(cashier, "products")).toBe(false);
    expect(getAvailableViews(cashier)).toEqual(["pos", "customers"]);
  });

  it("allows admin access to every app view", () => {
    const admin = seedUsers.find((u) => u.role === "admin")!;
    expect(getAvailableViews(admin)).toEqual([
      "pos",
      "products",
      "customers",
      "rx",
      "control-tower",
      "settings",
      "reports",
      "sync",
    ]);
  });

  it("falls back to the first allowed view when a requested view is unauthorized", () => {
    const cashier = seedUsers.find((u) => u.role === "cashier")!;
    expect(resolveAccessibleView("settings", cashier)).toBe("pos");
    expect(resolveAccessibleView("customers", cashier)).toBe("customers");
  });
});
