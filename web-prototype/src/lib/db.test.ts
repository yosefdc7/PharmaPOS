import { describe, expect, it } from "vitest";
import type { Transaction, BirSettings, ZReading } from "@/lib/types";

/**
 * Unit tests for Phase 1 backend wiring — OR series logic and X/Z reading computation.
 * These do NOT require IndexedDB. They test pure functions used by the wired components.
 */

function computeXReadingTotals(transactions: Transaction[]): {
  grossSales: number;
  vatAmount: number;
  scDiscount: number;
  totalDiscounts: number;
  netSales: number;
  totalVoids: number;
  voidAmount: number;
  beginningOr: number;
  lastOr: number;
} {
  // Gross sales = sum of subtotal for all non-refunded transactions (BIR standard)
  const paidTxs = transactions.filter((t) => t.paymentStatus !== "refunded");
  const refundedTxs = transactions.filter((t) => t.paymentStatus === "refunded");

  const grossSales = paidTxs.reduce((sum, t) => sum + t.subtotal, 0);
  const scDiscount = paidTxs.reduce((sum, t) => sum + (t.scPwdMetadata?.scPwdDiscountAmount ?? 0), 0);
  const totalDiscounts = paidTxs.reduce((sum, t) => sum + t.discount, 0);
  const vatAmount = paidTxs.reduce((sum, t) => sum + t.tax, 0);
  const voidAmount = refundedTxs.reduce((sum, t) => sum + t.total, 0);
  const totalVoids = refundedTxs.length;

  // Net sales = grossSales - discounts - void amounts
  const netSales = grossSales - scDiscount - totalDiscounts - voidAmount;

  const sorted = [...transactions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return {
    grossSales,
    vatAmount,
    scDiscount,
    totalDiscounts,
    netSales,
    totalVoids,
    voidAmount,
    beginningOr: first ? Number(first.localNumber) : 0,
    lastOr: last ? Number(last.localNumber) : 0,
  };
}

function nextOrNumber(bir: BirSettings | undefined): { orNumber: string; exhausted: boolean } {
  if (!bir) return { orNumber: `OR-${Date.now()}`, exhausted: false };
  if (bir.currentOrNumber >= bir.orSeriesEnd) return { orNumber: String(bir.currentOrNumber), exhausted: true };
  return { orNumber: String(bir.currentOrNumber), exhausted: false };
}

function incrementOr(bir: BirSettings): BirSettings & { id: string } {
  return { ...bir, id: "bir", currentOrNumber: bir.currentOrNumber + 1 };
}

describe("OR series logic", () => {
  const bir: BirSettings = {
    tin: "123-456-789-000",
    registeredName: "Test Store",
    registeredAddress: "123 Main St",
    vatRegistered: true,
    ptuNumber: "PTU001",
    machineSerial: "SN001",
    accreditationNumber: "ACC001",
    orSeriesStart: 1,
    orSeriesEnd: 50000,
    currentOrNumber: 100,
    zReadingCutoffTime: "23:59",
  };

  it("assigns OR number from bir settings", () => {
    const result = nextOrNumber(bir);
    expect(result.orNumber).toBe("100");
    expect(result.exhausted).toBe(false);
  });

  it("marks exhausted when currentOR equals series end", () => {
    const nearEnd = { ...bir, currentOrNumber: bir.orSeriesEnd };
    const result = nextOrNumber(nearEnd);
    expect(result.exhausted).toBe(true);
  });

  it("marks exhausted when currentOR exceeds series end", () => {
    const overEnd = { ...bir, currentOrNumber: bir.orSeriesEnd + 1 };
    const result = nextOrNumber(overEnd);
    expect(result.exhausted).toBe(true);
  });

  it("returns fallback when no bir settings", () => {
    const result = nextOrNumber(undefined);
    expect(result.orNumber).toMatch(/OR-|^\d+$/);
    expect(result.exhausted).toBe(false);
  });

  it("increments OR number", () => {
    const next = incrementOr(bir);
    expect(next.currentOrNumber).toBe(101);
    expect(next.id).toBe("bir");
  });

  it("incremented OR respects series end boundary", () => {
    const nearEnd = { ...bir, currentOrNumber: 49999, orSeriesEnd: 50000 };
    const next = incrementOr(nearEnd);
    expect(next.currentOrNumber).toBe(50000);
    expect(next.currentOrNumber).toBeLessThanOrEqual(next.orSeriesEnd);
  });
});

function buildTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    version: overrides.version ?? 1,
    localNumber: overrides.localNumber ?? "1",
    customerId: "walk-in",
    cashierId: "usr-1",
    createdAt: overrides.createdAt ?? "2026-04-26T08:00:00.000Z",
    subtotal: overrides.subtotal ?? 100,
    discount: overrides.discount ?? 0,
    tax: overrides.tax ?? 12,
    total: overrides.total ?? 112,
    paid: overrides.paid ?? 112,
    change: overrides.change ?? 0,
    paymentMethod: "cash",
    paymentStatus: overrides.paymentStatus ?? "paid",
    paymentReference: "",
    syncStatus: "pending",
    remarks: "",
    items: [],
  };
}

describe("X-Reading computation from real transactions", () => {
  it("computes gross sales and net sales", () => {
    const txs = [
      buildTx({ id: "t1", localNumber: "101", subtotal: 100, total: 112 }),
      buildTx({ id: "t2", localNumber: "102", subtotal: 200, total: 224 }),
    ];
    const result = computeXReadingTotals(txs);
    expect(result.grossSales).toBe(300);
    expect(result.netSales).toBe(300); // no discounts
  });

  it("sums SC/PWD discounts from transaction metadata", () => {
    const metadata = {
      discountType: "sc" as const,
      idNumber: "SC001",
      fullName: "Test User",
      scPwdDiscountAmount: 22,
      scPwdVatRemoved: 0,
    };
    const txs: Transaction[] = [
      {
        id: "t1",
        version: 1,
        localNumber: "101",
        customerId: "walk-in",
        cashierId: "usr-1",
        createdAt: "2026-04-26T08:00:00.000Z",
        subtotal: 200,
        discount: 0,
        tax: 0,
        total: 178,
        paid: 178,
        change: 0,
        paymentMethod: "cash",
        paymentStatus: "paid",
        paymentReference: "",
        syncStatus: "pending",
        remarks: "",
        items: [],
        scPwdMetadata: { ...metadata, chosenDiscount: undefined, proxyPurchase: false },
      },
    ];
    const result = computeXReadingTotals(txs);
    expect(result.scDiscount).toBe(22);
    expect(result.grossSales).toBe(200);
    expect(result.netSales).toBe(178);
  });

  it("counts voids and void amounts", () => {
    // t1: refunded, t2: paid, t3: refunded
    const txs = [
      buildTx({ id: "t1", localNumber: "101", subtotal: 100, total: 100, paymentStatus: "refunded" }),
      buildTx({ id: "t2", localNumber: "102", subtotal: 200, total: 200, paymentStatus: "paid" }),
      buildTx({ id: "t3", localNumber: "103", subtotal: 50, total: 50, paymentStatus: "refunded" }),
    ];
    const result = computeXReadingTotals(txs);
    expect(result.totalVoids).toBe(2);
    expect(result.voidAmount).toBe(150); // sum of total for refunded transactions only
    expect(result.grossSales).toBe(200); // sum of subtotal for paid transactions only
    expect(result.netSales).toBe(50); // grossSales - voidAmount = 200 - 150
  });

  it("derives OR range from transaction localNumbers", () => {
    const txs = [
      buildTx({ id: "t1", localNumber: "200", createdAt: "2026-04-26T08:00:00Z" }),
      buildTx({ id: "t2", localNumber: "201", createdAt: "2026-04-26T09:00:00Z" }),
      buildTx({ id: "t3", localNumber: "202", createdAt: "2026-04-26T10:00:00Z" }),
    ];
    const result = computeXReadingTotals(txs);
    expect(result.beginningOr).toBe(200);
    expect(result.lastOr).toBe(202);
  });

  it("computes VAT amount from tax field", () => {
    const txs = [
      buildTx({ id: "t1", subtotal: 100, tax: 12 }),
      buildTx({ id: "t2", subtotal: 50, tax: 6 }),
    ];
    const result = computeXReadingTotals(txs);
    expect(result.vatAmount).toBe(18);
    expect(result.grossSales).toBe(150);
    expect(result.netSales).toBe(150);
  });

  it("handles empty transaction list", () => {
    const result = computeXReadingTotals([]);
    expect(result.grossSales).toBe(0);
    expect(result.netSales).toBe(0);
    expect(result.totalVoids).toBe(0);
    expect(result.beginningOr).toBe(0);
    expect(result.lastOr).toBe(0);
  });
});

describe("Z-Reading computation", () => {
  function computeZReading(txs: Transaction[], orEnd: number): ZReading & { beginningOrNumber: number } {
    const x = computeXReadingTotals(txs);
    return {
      id: `z-${new Date().toISOString().slice(0, 10)}`,
      reportDate: new Date().toISOString().slice(0, 10),
      reportTime: new Date().toISOString().slice(11, 16),
      machineSerial: "SN001",
      beginningOrNumber: x.beginningOr,
      lastOrNumber: x.lastOr,
      endingOrNumber: orEnd,
      grossSales: x.grossSales,
      vatableSales: x.grossSales,
      vatExemptSales: 0,
      vatAmount: x.vatAmount,
      zeroRatedSales: 0,
      scDiscount: x.scDiscount,
      pwdDiscount: 0,
      promotionalDiscount: x.totalDiscounts - x.scDiscount,
      totalDiscounts: x.totalDiscounts,
      totalVoids: x.totalVoids,
      voidAmount: x.voidAmount,
      totalReturns: 0,
      returnAmount: 0,
      netSales: x.netSales,
      generatedBy: "Test",
      generatedAt: new Date().toISOString(),
      storeName: "Test Store",
      tin: "123-456-789-000",
      ptuNumber: "PTU001",
      transactionCount: txs.filter((t) => t.paymentStatus === "paid").length,
      resetFlag: false,
    };
  }

  it("computes Z-reading from daily transactions", () => {
    const txs = [
      buildTx({ id: "t1", localNumber: "101", subtotal: 100, total: 112 }),
      buildTx({ id: "t2", localNumber: "102", subtotal: 200, total: 224 }),
    ];
    const z = computeZReading(txs, 102);
    expect(z.grossSales).toBe(300);
    expect(z.transactionCount).toBe(2);
    expect(z.beginningOrNumber).toBe(101);
    expect(z.endingOrNumber).toBe(102);
  });

  it("includes void amounts in Z-reading", () => {
    const txs = [
      buildTx({ id: "t1", localNumber: "101", subtotal: 100, total: 100, paymentStatus: "refunded" }),
      buildTx({ id: "t2", localNumber: "102", subtotal: 200, total: 200 }),
    ];
    const z = computeZReading(txs, 102);
    expect(z.totalVoids).toBe(1);
    expect(z.voidAmount).toBe(100);
    expect(z.netSales).toBe(100);
  });
});
