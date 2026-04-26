import { describe, expect, it } from "vitest";
import type { PrescriptionDraft, Product, Settings, Transaction, User } from "@/lib/types";
import { computeDashboardStats } from "@/lib/use-dashboard-stats";

const settings: Settings = {
  id: "store",
  store: "Test",
  addressOne: "",
  addressTwo: "",
  contact: "",
  currencySymbol: "$",
  vatPercentage: 12,
  chargeTax: true,
  quickBilling: false,
  receiptFooter: "",
  expiryAlertDays: 30
};

const users: User[] = [
  {
    id: "usr-1",
    username: "admin",
    fullname: "Admin",
    role: "admin",
    permissions: {
      products: true,
      categories: true,
      customers: true,
      transactions: true,
      rx: true,
      controlTower: true,
      users: true,
      settings: true,
      reports: true,
      sync: true,
      void: true,
      refund: true,
      override: true,
      xReading: true,
      zReadingGenerate: true,
      zReadingView: true,
    }
  }
];

function buildTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id || crypto.randomUUID(),
    localNumber: overrides.localNumber || "OR-1",
    customerId: "walk-in",
    cashierId: "usr-1",
    createdAt: overrides.createdAt || "2026-04-25T08:00:00.000Z",
    subtotal: overrides.subtotal ?? 0,
    discount: overrides.discount ?? 0,
    tax: overrides.tax ?? 0,
    total: overrides.total ?? 0,
    paid: overrides.paid ?? overrides.total ?? 0,
    change: overrides.change ?? 0,
    paymentMethod: overrides.paymentMethod || "cash",
    paymentStatus: overrides.paymentStatus || "paid",
    paymentReference: overrides.paymentReference || "",
    syncStatus: overrides.syncStatus || "pending",
    remarks: "",
    items: overrides.items || []
  };
}

describe("computeDashboardStats", () => {
  it("computes today net/gross and same-day-last-week delta", () => {
    const products: Product[] = [
      {
        id: "p1",
        name: "A",
        barcode: "100",
        categoryId: "cat-1",
        supplier: "",
        price: 100,
        cost: 60,
        quantity: 5,
        minStock: 1,
        tracksStock: true,
        expirationDate: "2027-12-01",
        imageColor: "#fff"
      }
    ];

    const transactions: Transaction[] = [
      buildTransaction({
        id: "t-today",
        createdAt: "2026-04-25T09:00:00.000Z",
        subtotal: 100,
        total: 112,
        paymentMethod: "cash",
        items: [{ productId: "p1", productName: "A", price: 100, quantity: 1, lineTotal: 100 }]
      }),
      buildTransaction({
        id: "t-last-week",
        createdAt: "2026-04-18T09:00:00.000Z",
        subtotal: 80,
        total: 89.6,
        paymentMethod: "cash",
        items: [{ productId: "p1", productName: "A", price: 80, quantity: 1, lineTotal: 80 }]
      })
    ];

    const stats = computeDashboardStats(
      {
        transactions,
        products,
        settings,
        users,
        syncQueue: []
      },
      new Date("2026-04-25T12:00:00.000Z")
    );

    expect(stats.finance.netSalesToday).toBe(112);
    expect(stats.finance.grossSalesToday).toBe(100);
    expect(stats.finance.salesTodayVsLastWeek).toBeCloseTo(22.4, 2);
  });

  it("computes VAT vs non-VAT totals from product flags", () => {
    const products: Product[] = [
      {
        id: "vat",
        name: "VAT Product",
        barcode: "101",
        categoryId: "cat-1",
        supplier: "",
        price: 100,
        quantity: 5,
        minStock: 1,
        tracksStock: true,
        expirationDate: "2027-12-01",
        imageColor: "#fff",
        vatExempt: false
      },
      {
        id: "nonvat",
        name: "Non VAT Product",
        barcode: "102",
        categoryId: "cat-1",
        supplier: "",
        price: 50,
        quantity: 5,
        minStock: 1,
        tracksStock: true,
        expirationDate: "2027-12-01",
        imageColor: "#fff",
        vatExempt: true
      }
    ];

    const transactions: Transaction[] = [
      buildTransaction({
        id: "t1",
        createdAt: "2026-04-25T09:00:00.000Z",
        subtotal: 150,
        total: 120,
        items: [
          { productId: "vat", productName: "VAT Product", price: 100, quantity: 1, lineTotal: 100 },
          { productId: "nonvat", productName: "Non VAT Product", price: 50, quantity: 1, lineTotal: 50 }
        ]
      })
    ];

    const stats = computeDashboardStats(
      {
        transactions,
        products,
        settings,
        users,
        syncQueue: []
      },
      new Date("2026-04-25T12:00:00.000Z")
    );

    expect(stats.finance.vatBreakdown.vatable).toBe(80);
    expect(stats.finance.vatBreakdown.nonVatable).toBe(40);
    expect(stats.trends.categoryMix.reduce((sum, slice) => sum + slice.amount, 0)).toBe(120);
  });

  it("returns null profit margin when a sold item has no cost data", () => {
    const products: Product[] = [
      {
        id: "known-cost",
        name: "Known Cost",
        barcode: "103",
        categoryId: "cat-1",
        supplier: "",
        price: 100,
        cost: 60,
        quantity: 5,
        minStock: 1,
        tracksStock: true,
        expirationDate: "2027-12-01",
        imageColor: "#fff"
      },
      {
        id: "missing-cost",
        name: "Missing Cost",
        barcode: "104",
        categoryId: "cat-1",
        supplier: "",
        price: 50,
        quantity: 5,
        minStock: 1,
        tracksStock: true,
        expirationDate: "2027-12-01",
        imageColor: "#fff"
      }
    ];

    const transactions: Transaction[] = [
      buildTransaction({
        id: "t-cost",
        createdAt: "2026-04-25T09:00:00.000Z",
        subtotal: 150,
        total: 150,
        items: [
          { productId: "known-cost", productName: "Known Cost", price: 100, quantity: 1, lineTotal: 100 },
          { productId: "missing-cost", productName: "Missing Cost", price: 50, quantity: 1, lineTotal: 50 }
        ]
      })
    ];

    const stats = computeDashboardStats(
      {
        transactions,
        products,
        settings,
        users,
        syncQueue: []
      },
      new Date("2026-04-25T12:00:00.000Z")
    );

    expect(stats.finance.profitMarginPercent).toBeNull();
  });

  it("computes expiry buckets for 30/60/90 days", () => {
    const products: Product[] = [
      {
        id: "exp-30",
        name: "Within 30",
        barcode: "201",
        categoryId: "cat-1",
        supplier: "",
        price: 10,
        quantity: 2,
        minStock: 1,
        tracksStock: true,
        expirationDate: "2026-05-15",
        imageColor: "#fff"
      },
      {
        id: "exp-60",
        name: "Within 60",
        barcode: "202",
        categoryId: "cat-1",
        supplier: "",
        price: 10,
        quantity: 2,
        minStock: 1,
        tracksStock: true,
        expirationDate: "2026-06-09",
        imageColor: "#fff"
      },
      {
        id: "exp-90",
        name: "Within 90",
        barcode: "203",
        categoryId: "cat-1",
        supplier: "",
        price: 10,
        quantity: 2,
        minStock: 1,
        tracksStock: true,
        expirationDate: "2026-07-09",
        imageColor: "#fff"
      }
    ];

    const stats = computeDashboardStats(
      {
        transactions: [],
        products,
        settings,
        users,
        syncQueue: []
      },
      new Date("2026-04-25T00:00:00.000Z")
    );

    expect(stats.inventory.expiryBuckets.within30).toBe(1);
    expect(stats.inventory.expiryBuckets.within60).toBe(1);
    expect(stats.inventory.expiryBuckets.within90).toBe(1);
  });

  it("computes compliance counts from rx drafts", () => {
    const rxDrafts: PrescriptionDraft[] = [
      {
        id: "rx-1",
        transactionId: "tx-1",
        customerId: "walk-in",
        patientName: "Patient One",
        patientAddress: "Address",
        prescriptionDate: "2026-04-25",
        prescriberName: "Dr. One",
        prescriberPrcLicense: "PRC-1",
        prescriberPtrNumber: "PTR-1",
        clinicNameAddress: "Clinic",
        genericName: "Medicine A",
        dosageStrength: "10mg",
        quantityPrescribed: 10,
        quantityDispensed: 5,
        quantityRemaining: 5,
        directionsForUse: "Once daily",
        dispensingPharmacistName: "Pharm",
        dispensingPharmacistPrc: "PRC-PHARM",
        status: "PARTIAL - OPEN",
        classAtDispense: "DD, Rx",
        createdAt: "2026-04-25T09:00:00.000Z",
        yellowRxReference: ""
      },
      {
        id: "rx-2",
        transactionId: "tx-2",
        customerId: "walk-in",
        patientName: "Patient Two",
        patientAddress: "Address",
        prescriptionDate: "2026-04-25",
        prescriberName: "",
        prescriberPrcLicense: "",
        prescriberPtrNumber: "PTR-2",
        clinicNameAddress: "Clinic",
        genericName: "Medicine B",
        dosageStrength: "10mg",
        quantityPrescribed: 10,
        quantityDispensed: 10,
        quantityRemaining: 0,
        directionsForUse: "Once daily",
        dispensingPharmacistName: "",
        dispensingPharmacistPrc: "PRC-PHARM",
        status: "DRAFT",
        classAtDispense: "Rx",
        createdAt: "2026-04-25T10:00:00.000Z"
      }
    ];

    const stats = computeDashboardStats(
      {
        transactions: [],
        products: [],
        settings,
        users,
        syncQueue: [],
        rxPrescriptionDrafts: rxDrafts
      },
      new Date("2026-04-25T12:00:00.000Z")
    );

    expect(stats.compliance.rxTransactionsToday).toBe(2);
    expect(stats.compliance.ddTransactionsToday).toBe(1);
    expect(stats.compliance.missingRxLogAlerts).toBe(2);
    expect(stats.compliance.incompletePrescriptionAlerts).toBe(2);
  });
});
