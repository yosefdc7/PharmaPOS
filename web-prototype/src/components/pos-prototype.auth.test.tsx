/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PosPrototype } from "./pos-prototype";
import { ALL_APP_VIEWS, canUserAccessView } from "@/lib/use-pos-store";
import { seedSettings, seedUsers } from "@/lib/seed";

const mockedUsePosStore = vi.fn();

vi.mock("@/lib/use-pos-store", async () => {
  const actual = await vi.importActual<typeof import("@/lib/use-pos-store")>("@/lib/use-pos-store");
  return {
    ...actual,
    usePosStore: () => mockedUsePosStore(),
  };
});

beforeEach(() => {
  mockedUsePosStore.mockReset();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("PosPrototype auth and view gating", () => {
  it("shows an unprefilled login form and invalid-login feedback", async () => {
    const login = vi.fn().mockResolvedValue(false);
    mockedUsePosStore.mockReturnValue({
      loadState: "ready",
      error: "",
      products: [],
      categories: [],
      customers: [],
      users: seedUsers,
      settings: seedSettings,
      transactions: [],
      heldOrders: [],
      syncQueue: [],
      cart: [],
      discount: 0,
      remarks: "",
      customerId: "walk-in",
      currentUser: null,
      storagePersistence: "granted",
      forcedOffline: false,
      online: true,
      totals: { itemCount: 0, subtotal: 0, discount: 0, taxableAmount: 0, tax: 0, total: 0 },
      lastReceipt: null,
      printFailure: null,
      clearPrintFailure: vi.fn(),
      syncing: false,
      featureFlags: { payments: true, sync: true, refunds: true },
      setDiscount: vi.fn(),
      setRemarks: vi.fn(),
      setCustomerId: vi.fn(),
      setForcedOffline: vi.fn(),
      setLastReceipt: vi.fn(),
      addToCart: vi.fn(),
      updateCartQuantity: vi.fn(),
      removeFromCart: vi.fn(),
      clearCart: vi.fn(),
      completeSale: vi.fn(),
      holdOrder: vi.fn(),
      resumeHeldOrder: vi.fn(),
      saveEntity: vi.fn(),
      saveUserAccount: vi.fn(),
      removeEntity: vi.fn(),
      syncNow: vi.fn(),
      refundTransaction: vi.fn(),
      resetData: vi.fn(),
      login,
      logout: vi.fn(),
      switchUser: vi.fn(),
      rxPharmacists: [],
      setRxPharmacists: vi.fn(),
      rxPrescriptionDrafts: [],
      rxRedFlags: [],
      rxRefusals: [],
      rxSettings: { ddEddLowStockThreshold: 10, profileRetentionYears: 10, hardBlockPrototypeReset: true },
      saveRxPrescriptionDraft: vi.fn(),
      logRxRefusal: vi.fn(),
      addRxRedFlag: vi.fn(),
      clearRxRedFlag: vi.fn(),
      getRxInspectionSnapshot: vi.fn(),
      updateRxSettings: vi.fn(),
      canAccessView: vi.fn(),
      availableViews: [],
      observabilitySnapshot: {
        syncLagSeconds: 0,
        queueDepth: 0,
        failedMutations15m: 0,
        paymentFailureRate15m: 0,
        offlineDurationSeconds: 0,
        orderThroughputPerHour: 0,
      },
      sloTargets: {
        maxSyncLagSeconds: 60,
        maxQueueDepth: 5,
        maxFailedMutationsPer15m: 1,
        maxPaymentFailureRate: 0.05,
        maxOfflineDurationSeconds: 600,
        minOrdersPerHour: 1,
      },
      activeAlerts: [],
      scPwdDraft: null,
      activeScPwdDiscount: false,
      scPwdTransactionLog: [],
      scPwdAlerts: [],
      applyScPwdDiscount: vi.fn(),
      removeScPwdDiscount: vi.fn(),
      validateScPwdEligibility: vi.fn(),
      getScPwdSummary: vi.fn(),
      acknowledgeScPwdAlert: vi.fn(),
    });

    render(<PosPrototype />);

    const usernameInput = screen.getByPlaceholderText("Username") as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText("Password") as HTMLInputElement;
    expect(usernameInput.value).toBe("");
    expect(passwordInput.value).toBe("");

    fireEvent.change(usernameInput, { target: { value: "admin" } });
    fireEvent.change(passwordInput, { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Invalid username or password.")).toBeTruthy();
    expect(login).toHaveBeenCalledWith("admin", "wrong");
  });

  it("shows only POS and Customers for cashier accounts", () => {
    mockedUsePosStore.mockReturnValue({
      loadState: "ready",
      error: "",
      products: [],
      categories: [],
      customers: [],
      users: seedUsers,
      settings: seedSettings,
      transactions: [],
      heldOrders: [],
      syncQueue: [],
      cart: [],
      discount: 0,
      remarks: "",
      customerId: "walk-in",
      currentUser: seedUsers[1],
      storagePersistence: "granted",
      forcedOffline: false,
      online: true,
      totals: { itemCount: 0, subtotal: 0, discount: 0, taxableAmount: 0, tax: 0, total: 0 },
      lastReceipt: null,
      printFailure: null,
      clearPrintFailure: vi.fn(),
      syncing: false,
      featureFlags: { payments: true, sync: true, refunds: true },
      setDiscount: vi.fn(),
      setRemarks: vi.fn(),
      setCustomerId: vi.fn(),
      setForcedOffline: vi.fn(),
      setLastReceipt: vi.fn(),
      addToCart: vi.fn(),
      updateCartQuantity: vi.fn(),
      removeFromCart: vi.fn(),
      clearCart: vi.fn(),
      completeSale: vi.fn(),
      holdOrder: vi.fn(),
      resumeHeldOrder: vi.fn(),
      saveEntity: vi.fn(),
      saveUserAccount: vi.fn(),
      removeEntity: vi.fn(),
      syncNow: vi.fn(),
      refundTransaction: vi.fn(),
      resetData: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      switchUser: vi.fn(),
      rxPharmacists: [],
      setRxPharmacists: vi.fn(),
      rxPrescriptionDrafts: [],
      rxRedFlags: [],
      rxRefusals: [],
      rxSettings: { ddEddLowStockThreshold: 10, profileRetentionYears: 10, hardBlockPrototypeReset: true },
      saveRxPrescriptionDraft: vi.fn(),
      logRxRefusal: vi.fn(),
      addRxRedFlag: vi.fn(),
      clearRxRedFlag: vi.fn(),
      getRxInspectionSnapshot: vi.fn(),
      updateRxSettings: vi.fn(),
      canAccessView: (view: Parameters<typeof canUserAccessView>[1]) => canUserAccessView(seedUsers[1], view),
      availableViews: ALL_APP_VIEWS.filter((view) => canUserAccessView(seedUsers[1], view)),
      observabilitySnapshot: {
        syncLagSeconds: 0,
        queueDepth: 0,
        failedMutations15m: 0,
        paymentFailureRate15m: 0,
        offlineDurationSeconds: 0,
        orderThroughputPerHour: 0,
      },
      sloTargets: {
        maxSyncLagSeconds: 60,
        maxQueueDepth: 5,
        maxFailedMutationsPer15m: 1,
        maxPaymentFailureRate: 0.05,
        maxOfflineDurationSeconds: 600,
        minOrdersPerHour: 1,
      },
      activeAlerts: [],
      scPwdDraft: null,
      activeScPwdDiscount: false,
      scPwdTransactionLog: [],
      scPwdAlerts: [],
      applyScPwdDiscount: vi.fn(),
      removeScPwdDiscount: vi.fn(),
      validateScPwdEligibility: vi.fn(),
      getScPwdSummary: vi.fn(),
      acknowledgeScPwdAlert: vi.fn(),
    });

    render(<PosPrototype />);

    expect(screen.getByRole("button", { name: "POS" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Customers" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Products" })).toBeNull();
    expect(screen.queryByRole("button", { name: "RX Workspace" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Control Tower" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reports" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sync Online" })).toBeNull();
  });
});
