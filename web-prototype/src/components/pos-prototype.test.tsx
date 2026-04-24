/** @vitest-environment jsdom */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PosPrototype } from "./pos-prototype";
import { seedCategories, seedProducts, seedSettings, seedUsers } from "@/lib/seed";
import type { Product } from "@/lib/types";

const saveEntity = vi.fn(async () => undefined);
const removeEntity = vi.fn(async () => undefined);

const mockedUsePosStore = vi.fn();

vi.mock("@/lib/use-pos-store", () => ({
  usePosStore: () => mockedUsePosStore()
}));

function buildProducts(count = 15): Product[] {
  return Array.from({ length: count }, (_, index) => {
    const base = seedProducts[index % seedProducts.length];
    return {
      ...base,
      id: `${base.id}-${index}`,
      name: `${base.name} ${index + 1}`,
      barcode: `${Number(base.barcode) + index}`,
      quantity: index === 0 ? 2 : base.quantity + index,
      originalPrice: index === 0 ? base.price + 1.5 : undefined,
      featured: index === 0
    } as Product;
  });
}

function renderProductsView() {
  const products = buildProducts();

  mockedUsePosStore.mockReturnValue({
    loadState: "ready",
    error: "",
    products,
    categories: seedCategories,
    customers: [],
    users: seedUsers,
    settings: seedSettings,
    transactions: [],
    heldOrders: [],
    syncQueue: [],
    cart: [],
    discount: 0,
    customerId: "walk-in",
    currentUser: seedUsers[0],
    forcedOffline: false,
    online: true,
    totals: { itemCount: 0, subtotal: 0, discount: 0, taxableAmount: 0, tax: 0, total: 0 },
    lastReceipt: null,
    syncing: false,
    featureFlags: { payments: true, sync: true, refunds: true },
    setDiscount: vi.fn(),
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
    saveEntity,
    removeEntity,
    syncNow: vi.fn(),
    refundTransaction: vi.fn(),
    resetData: vi.fn(),
    login: vi.fn(),
    observabilitySnapshot: {
      syncLagSeconds: 0,
      queueDepth: 0,
      failedMutations15m: 0,
      paymentFailureRate15m: 0,
      offlineDurationSeconds: 0,
      orderThroughputPerHour: 0
    },
    sloTargets: {
      maxSyncLagSeconds: 60,
      maxQueueDepth: 5,
      maxFailedMutationsPer15m: 1,
      maxPaymentFailureRate: 0.05,
      maxOfflineDurationSeconds: 600,
      minOrdersPerHour: 1
    },
    activeAlerts: []
  });

  render(<PosPrototype />);
  fireEvent.click(screen.getByRole("button", { name: "Products" }));

  return { products };
}

beforeEach(() => {
  saveEntity.mockClear();
  removeEntity.mockClear();
  mockedUsePosStore.mockReset();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
});

describe("PosPrototype products admin view", () => {
  it("renders a compact products table with pagination and record count", () => {
    const { products } = renderProductsView();

    expect(screen.getByRole("button", { name: "Add Product" })).toBeTruthy();
    expect(screen.getByPlaceholderText("Search inventory")).toBeTruthy();
    expect(screen.getByText("Title")).toBeTruthy();
    expect(screen.getByText("Price")).toBeTruthy();
    expect(screen.getByText("Quantity")).toBeTruthy();
    expect(screen.getAllByText("Category").length).toBeGreaterThan(0);
    expect(screen.getByText(`${products.length} records`)).toBeTruthy();

    const rows = screen.getAllByTestId("product-row");
    expect(rows).toHaveLength(11);
    expect(screen.getByRole("button", { name: "1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "2" })).toBeTruthy();
  });

  it("filters products by search text and property value", () => {
    renderProductsView();

    fireEvent.change(screen.getByPlaceholderText("Search inventory"), {
      target: { value: "Paracetamol" }
    });

    expect(screen.getAllByTestId("product-row")).toHaveLength(3);

    fireEvent.change(screen.getByLabelText("Property"), {
      target: { value: "category" }
    });
    fireEvent.change(screen.getByLabelText("Value"), {
      target: { value: "cat-pain" }
    });

    expect(screen.getAllByTestId("product-row").every((row) => within(row).getByText(/Pain Relief/))).toBe(true);
  });

  it("shows original price and low-stock emphasis in the table", () => {
    renderProductsView();

    const firstRow = screen.getAllByTestId("product-row")[0];
    expect((within(firstRow).getByText("$6.00") as HTMLElement).className).toContain("price-original");
    expect((within(firstRow).getByText("2") as HTMLElement).className).toContain("quantity-low");
  });

  it("toggles featured state, opens edit mode, and deletes a product", () => {
    const { products } = renderProductsView();
    const firstProduct = products[0];
    const firstRow = screen.getAllByTestId("product-row")[0];

    fireEvent.click(within(firstRow).getByRole("button", { name: /toggle featured/i }));
    expect(saveEntity).toHaveBeenCalledWith(
      "products",
      expect.objectContaining({ id: firstProduct.id, featured: false }),
      "product"
    );

    fireEvent.click(within(firstRow).getByRole("button", { name: /edit product/i }));
    expect(screen.getByRole("heading", { name: "Edit Product" })).toBeTruthy();
    expect(screen.getByDisplayValue(firstProduct.name)).toBeTruthy();

    fireEvent.click(within(firstRow).getByRole("button", { name: /delete product/i }));
    expect(removeEntity).toHaveBeenCalledWith("products", firstProduct.id, "product");
  });
});
