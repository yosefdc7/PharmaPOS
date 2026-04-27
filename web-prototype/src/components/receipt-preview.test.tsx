/** @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReceiptPreview } from "./receipt-preview";
import type { Transaction } from "@/lib/types";

const { getAll, getOne } = vi.hoisted(() => ({
  getAll: vi.fn(),
  getOne: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  getAll,
  getOne
}));

vi.mock("@/lib/printer", () => ({
  buildReceipt: vi.fn(),
  createPrinterBackend: vi.fn(),
  getReceiptLayout: vi.fn((printer) => printer?.receiptLayout ?? { logoUrl: "", headerLines: [], footerLines: [], maxReceiptLines: 40, autoCondense: false }),
  getReceiptLayoutOptions: vi.fn(() => ({})),
  PrinterService: class {
    async connect() {
      return { status: "success" as const };
    }
    async print() {
      return { status: "success" as const };
    }
    async disconnect() {
      return undefined;
    }
  },
  resolvePrinterForRole: vi.fn((profiles) => profiles[0] ?? undefined)
}));

const transaction: Transaction = {
  id: "txn-1",
  version: 1,
  localNumber: "1001",
  customerId: "walk-in",
  cashierId: "usr-admin",
  createdAt: "2026-04-26T10:30:00.000Z",
  subtotal: 120,
  discount: 0,
  tax: 14.4,
  total: 134.4,
  paid: 200,
  change: 65.6,
  paymentMethod: "cash",
  paymentStatus: "paid",
  paymentReference: "",
  syncStatus: "pending",
  remarks: "",
  items: [
    {
      productId: "prd-1",
      productName: "Paracetamol 500mg",
      price: 60,
      quantity: 2,
      lineTotal: 120
    }
  ]
};

describe("ReceiptPreview", () => {
  beforeEach(() => {
    getAll.mockReset();
    getOne.mockReset();
  });

  it("renders saved settings, BIR details, and printer footer lines instead of hardcoded demo copy", async () => {
    getAll.mockResolvedValue([
      {
        id: "printer-1",
        label: "Counter 1",
        connectionType: "usb",
        address: "USB Serial",
        paperWidth: 80,
        characterSet: "UTF-8",
        autocut: true,
        partialCut: false,
        role: "or",
        isDefault: true,
        defaultForOr: true,
        defaultForReport: false,
        status: "online",
        receiptLayout: {
          logoUrl: "",
          headerLines: ["Open daily"],
          footerLines: ["Footer line"],
          maxReceiptLines: 40,
          autoCondense: false
        }
      }
    ]);
    getOne.mockImplementation(async (storeName: string) => {
      if (storeName === "settings") {
        return {
          id: "store",
          store: "Demo Pharmacy",
          addressOne: "456 Sample Ave",
          addressTwo: "Pasig City",
          contact: "+63 2 8000 1000",
          currencySymbol: "P",
          vatPercentage: 12,
          chargeTax: true,
          quickBilling: false,
          receiptFooter: "Thank you for shopping locally.",
          expiryAlertDays: 30
        };
      }

      return {
        id: "bir",
        tin: "999-888-777-666",
        registeredName: "Demo Pharmacy Registered",
        registeredAddress: "456 Sample Ave, Pasig City",
        vatRegistered: true,
        ptuNumber: "PTU0001234",
        machineSerial: "SN-123",
        accreditationNumber: "ACC-456",
        orSeriesStart: 1,
        orSeriesEnd: 5000,
        currentOrNumber: 1001,
        zReadingCutoffTime: "23:59"
      };
    });

    render(<ReceiptPreview transaction={transaction} />);

    await waitFor(() => {
      expect(screen.getByText("Demo Pharmacy")).toBeTruthy();
    });

    expect(screen.getByText("456 Sample Ave")).toBeTruthy();
    expect(screen.getByText("Pasig City")).toBeTruthy();
    expect(screen.getByText("Contact: +63 2 8000 1000")).toBeTruthy();
    expect(screen.getByText("TIN: 999-888-777-666")).toBeTruthy();
    expect(screen.getByText("PTU No: PTU0001234")).toBeTruthy();
    expect(screen.getByText("Accreditation No: ACC-456")).toBeTruthy();
    expect(screen.getByText("Open daily")).toBeTruthy();
    expect(screen.getByText("Footer line")).toBeTruthy();
    expect(screen.getByText("Thank you for shopping locally.")).toBeTruthy();
    expect(screen.queryByText("123 Main Street, Quezon City")).toBeNull();
  });
});
