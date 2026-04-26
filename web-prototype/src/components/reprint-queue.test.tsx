/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReprintQueue } from "./reprint-queue";

const {
  getAllJobs,
  markJobStatus,
  clearPrintedJobs,
  base64ToCommands,
  getOne,
  logPrinterActivity,
  connect,
  print,
  disconnect
} = vi.hoisted(() => ({
  getAllJobs: vi.fn(),
  markJobStatus: vi.fn(async () => undefined),
  clearPrintedJobs: vi.fn(async () => undefined),
  base64ToCommands: vi.fn(() => new Uint8Array([27, 64])),
  getOne: vi.fn(),
  logPrinterActivity: vi.fn(async () => undefined),
  connect: vi.fn(async (_profile: unknown) => ({ status: "success" as const })),
  print: vi.fn(async (_commands: Uint8Array) => ({ status: "success" as const })),
  disconnect: vi.fn(async () => undefined)
}));

vi.mock("@/lib/printer/print-queue", () => ({
  getAllJobs,
  markJobStatus,
  clearPrintedJobs,
  base64ToCommands
}));

vi.mock("@/lib/printer", () => ({
  buildReceipt: vi.fn(),
  createPrinterBackend: vi.fn(),
  PrinterService: class {
    async connect(profile: unknown) {
      return connect(profile);
    }
    async print(commands: Uint8Array) {
      return print(commands);
    }
    async disconnect() {
      return disconnect();
    }
  }
}));

vi.mock("@/lib/db", () => ({
  getOne
}));

vi.mock("./audit-trail", () => ({
  logPrinterActivity
}));

describe("ReprintQueue", () => {
  beforeEach(() => {
    getAllJobs.mockReset();
    markJobStatus.mockClear();
    clearPrintedJobs.mockClear();
    base64ToCommands.mockClear();
    getOne.mockReset();
    logPrinterActivity.mockClear();
    connect.mockClear();
    print.mockClear();
    disconnect.mockClear();
  });

  it("retries using the stored payload and profileId instead of rebuilding from the transaction", async () => {
    getAllJobs.mockResolvedValue([
      {
        id: "job-1",
        orNumber: 1001,
        transactionId: "txn-1",
        profileId: "printer-1",
        commandsBase64: "encoded-payload",
        variant: "normal",
        jobType: "receipt",
        createdAt: "2026-04-26T10:00:00.000Z",
        status: "pending"
      }
    ]);
    getOne.mockImplementation(async (storeName: string, id: string) => {
      if (storeName === "printerProfiles" && id === "printer-1") {
        return {
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
          status: "online"
        };
      }

      return undefined;
    });

    render(<ReprintQueue />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Print" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Print" }));

    await waitFor(() => {
      expect(connect).toHaveBeenCalled();
    });

    expect(getOne).toHaveBeenCalledWith("printerProfiles", "printer-1");
    expect(getOne).not.toHaveBeenCalledWith("transactions", "txn-1");
    expect(base64ToCommands).toHaveBeenCalledWith("encoded-payload");
    expect(print).toHaveBeenCalledWith(new Uint8Array([27, 64]));
    await waitFor(() => {
      expect(markJobStatus).toHaveBeenCalledWith("job-1", "printed");
    });
  });
});
