import { describe, expect, it } from "vitest";
import { calculateCartTotals, calculateChange, decrementStock, daysUntilExpiry, isExpired, isNearExpiry, isLowStock, calculateScPwdVatRemoved, calculateScPwdDiscountPerItem, buildScPwdCartItems, calculateScPwdTotals } from "./calculations";
import type { Product, Settings, ScPwdSettings } from "./types";

describe("POS calculations", () => {
  it("calculates totals with capped discount and VAT", () => {
    const totals = calculateCartTotals(
      [
        { productId: "a", productName: "A", price: 10, quantity: 2 },
        { productId: "b", productName: "B", price: 5, quantity: 1 }
      ],
      { chargeTax: true, vatPercentage: 12 },
      3
    );

    expect(totals.itemCount).toBe(3);
    expect(totals.subtotal).toBe(25);
    expect(totals.discount).toBe(3);
    expect(totals.tax).toBe(2.64);
    expect(totals.total).toBe(24.64);
  });

  it("does not allow negative totals from large discounts", () => {
    const totals = calculateCartTotals(
      [{ productId: "a", productName: "A", price: 4, quantity: 1 }],
      { chargeTax: true, vatPercentage: 12 },
      999
    );

    expect(totals.discount).toBe(4);
    expect(totals.total).toBe(0);
  });

  it("calculates change and decrements stock for tracked products only", () => {
    const products: Product[] = [
      {
        id: "a",
        name: "Tracked",
        barcode: "1",
        categoryId: "cat",
        supplier: "",
        price: 1,
        quantity: 3,
        minStock: 1,
        tracksStock: true,
        expirationDate: "2028-01-01",
        imageColor: "#fff"
      },
      {
        id: "b",
        name: "Service",
        barcode: "2",
        categoryId: "cat",
        supplier: "",
        price: 1,
        quantity: 0,
        minStock: 0,
        tracksStock: false,
        expirationDate: "N/A",
        imageColor: "#fff"
      }
    ];

    const updated = decrementStock(products, [
      { productId: "a", productName: "Tracked", price: 1, quantity: 2 },
      { productId: "b", productName: "Service", price: 1, quantity: 5 }
    ]);

    expect(calculateChange(18.5, 20)).toBe(1.5);
    expect(updated[0].quantity).toBe(1);
    expect(updated[1].quantity).toBe(0);
  });

  it("calculates days until expiry and detects expired / near-expiry", () => {
    const today = new Date();
    const fmt = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;

    const expired: Product = {
      id: "e", name: "Expired", barcode: "3", categoryId: "c", supplier: "", price: 1,
      quantity: 1, minStock: 0, tracksStock: true, expirationDate: fmt(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 5)), imageColor: "#fff"
    };
    const near: Product = {
      id: "n", name: "Near", barcode: "4", categoryId: "c", supplier: "", price: 1,
      quantity: 1, minStock: 0, tracksStock: true, expirationDate: fmt(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3)), imageColor: "#fff"
    };
    const ok: Product = {
      id: "o", name: "Ok", barcode: "5", categoryId: "c", supplier: "", price: 1,
      quantity: 1, minStock: 0, tracksStock: true, expirationDate: fmt(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 60)), imageColor: "#fff"
    };
    const service: Product = {
      id: "s", name: "Service", barcode: "6", categoryId: "c", supplier: "", price: 1,
      quantity: 0, minStock: 0, tracksStock: false, expirationDate: "N/A", imageColor: "#fff"
    };

    expect(isExpired(expired)).toBe(true);
    expect(isNearExpiry(expired, 30)).toBe(false);
    expect(isExpired(near)).toBe(false);
    expect(isNearExpiry(near, 30)).toBe(true);
    expect(isNearExpiry(near, 1)).toBe(false);
    expect(isExpired(ok)).toBe(false);
    expect(isNearExpiry(ok, 30)).toBe(false);
    expect(daysUntilExpiry(service)).toBeNull();
    expect(isExpired(service)).toBe(false);
    expect(isLowStock(service)).toBe(false);
  });
});

describe("SC/PWD calculations", () => {
  const baseSettings: Settings = {
    id: "store",
    store: "Test",
    addressOne: "",
    addressTwo: "",
    contact: "",
    currencySymbol: "₱",
    vatPercentage: 12,
    chargeTax: true,
    quickBilling: false,
    receiptFooter: "",
    expiryAlertDays: 30,
    scPwdSettings: {
      enabled: true,
      discountRate: 20,
      vatRegistered: true,
      defaultMedicineEligibility: "medicine",
      duplicateIdThreshold: 2,
      dailyAlertThreshold: 5
    }
  };

  const scPwdSettings = baseSettings.scPwdSettings!;

  const medicineProduct: Product = {
    id: "med",
    name: "Paracetamol",
    barcode: "1",
    categoryId: "cat",
    supplier: "",
    price: 112.0,
    quantity: 10,
    minStock: 2,
    tracksStock: true,
    expirationDate: "2028-01-01",
    imageColor: "#fff",
    scPwdEligibility: "medicine",
    vatExempt: false,
    isPrescription: false
  };

  const nonMedicineProduct: Product = {
    id: "nonmed",
    name: "Vitamin C",
    barcode: "2",
    categoryId: "cat",
    supplier: "",
    price: 112.0,
    quantity: 10,
    minStock: 2,
    tracksStock: true,
    expirationDate: "2028-01-01",
    imageColor: "#fff",
    scPwdEligibility: "non-medicine",
    vatExempt: true,
    isPrescription: false
  };

  const excludedProduct: Product = {
    id: "excl",
    name: "Consultation",
    barcode: "3",
    categoryId: "cat",
    supplier: "",
    price: 500,
    quantity: 0,
    minStock: 0,
    tracksStock: false,
    expirationDate: "N/A",
    imageColor: "#fff",
    scPwdEligibility: "excluded",
    vatExempt: true,
    isPrescription: false
  };

  it("calculates VAT removed for VAT-registered store", () => {
    const vatRemoved = calculateScPwdVatRemoved(112, 112, 1, true, 12, true);
    // VAT-inclusive price 112 -> VAT = 112 * 12 / 112 = 12
    expect(vatRemoved).toBeCloseTo(12, 1);
  });

  it("returns zero VAT removed for non-VAT store", () => {
    const vatRemoved = calculateScPwdVatRemoved(100, 100, 1, true, 12, false);
    expect(vatRemoved).toBe(0);
  });

  it("calculates 20% discount after VAT removal", () => {
    const vatRemoved = calculateScPwdVatRemoved(112, 112, 1, true, 12, true);
    const discount = calculateScPwdDiscountPerItem(112, vatRemoved, 1, 20, true);
    // Price after VAT removal = 112 - 12 = 100; discount = 20%
    expect(discount).toBeCloseTo(20, 1);
  });

  it("calculates 20% discount for non-VAT store", () => {
    const discount = calculateScPwdDiscountPerItem(100, 0, 1, 20, false);
    expect(discount).toBe(20);
  });

  it("builds SC/PWD cart items correctly for mixed cart", () => {
    const cart = [
      { productId: "med", productName: "Paracetamol", price: 112, quantity: 1 },
      { productId: "nonmed", productName: "Vitamin C", price: 112, quantity: 1 },
      { productId: "excl", productName: "Consultation", price: 500, quantity: 1 }
    ];

    const result = buildScPwdCartItems(cart, [medicineProduct, nonMedicineProduct, excludedProduct], baseSettings, scPwdSettings, 0);

    expect(result[0].scPwdDiscounted).toBe(true);
    expect(result[1].scPwdDiscounted).toBe(true);
    expect(result[2].scPwdDiscounted).toBeUndefined();
  });

  it("blocks manual discount when SC/PWD is active", () => {
    const cart = [
      { productId: "med", productName: "Paracetamol", price: 112, quantity: 1 }
    ];
    const totals = calculateScPwdTotals(cart, [medicineProduct], baseSettings, 10, scPwdSettings);
    expect(totals.manualDiscount).toBe(0);
    expect(totals.totalDiscount).toBeGreaterThan(0);
  });

  it("rounds all monetary values to two decimals", () => {
    const cart = [
      { productId: "med", productName: "Paracetamol", price: 100, quantity: 3 }
    ];
    const result = buildScPwdCartItems(cart, [medicineProduct], baseSettings, scPwdSettings, 0);
    result.forEach((item) => {
      const decimals = String(item.price).split(".")[1];
      expect(decimals ? decimals.length : 0).toBeLessThanOrEqual(2);
    });
  });
});
