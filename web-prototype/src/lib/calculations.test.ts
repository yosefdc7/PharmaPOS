import { describe, expect, it } from "vitest";
import { calculateCartTotals, calculateChange, decrementStock } from "./calculations";
import type { Product } from "./types";

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
});
