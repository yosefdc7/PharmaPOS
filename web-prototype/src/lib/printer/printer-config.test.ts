import { describe, expect, it } from "vitest";
import type { PrinterProfile } from "@/lib/types";
import {
  applyPrinterRoleDefault,
  createDefaultReceiptLayout,
  getReceiptLayoutOptions,
  normalizePrinterProfile,
  resolvePrinterForRole
} from "./printer-config";

function buildPrinter(overrides: Partial<PrinterProfile> = {}): PrinterProfile {
  return normalizePrinterProfile({
    id: overrides.id ?? crypto.randomUUID(),
    label: overrides.label ?? "Printer",
    connectionType: overrides.connectionType ?? "usb",
    address: overrides.address ?? "USB Serial",
    paperWidth: overrides.paperWidth ?? 80,
    characterSet: overrides.characterSet ?? "UTF-8",
    autocut: overrides.autocut ?? true,
    partialCut: overrides.partialCut ?? false,
    role: overrides.role ?? "both",
    isDefault: overrides.isDefault ?? false,
    status: overrides.status ?? "offline",
    defaultForOr: overrides.defaultForOr,
    defaultForReport: overrides.defaultForReport,
    receiptLayout: overrides.receiptLayout ?? createDefaultReceiptLayout()
  });
}

describe("printer-config helpers", () => {
  it("resolves the explicit default OR printer before other eligible printers", () => {
    const printers = [
      buildPrinter({ id: "report-only", role: "report" }),
      buildPrinter({ id: "both", role: "both" }),
      buildPrinter({ id: "or-default", role: "or", defaultForOr: true })
    ];

    expect(resolvePrinterForRole(printers, "or")?.id).toBe("or-default");
  });

  it("resolves the explicit default report printer independently", () => {
    const printers = [
      buildPrinter({ id: "or-only", role: "or", defaultForOr: true }),
      buildPrinter({ id: "report-default", role: "report", defaultForReport: true }),
      buildPrinter({ id: "both", role: "both" })
    ];

    expect(resolvePrinterForRole(printers, "report")?.id).toBe("report-default");
  });

  it("updates only the targeted default role when setting a new default", () => {
    const printers = [
      buildPrinter({ id: "both", role: "both", defaultForReport: true }),
      buildPrinter({ id: "or-only", role: "or", defaultForOr: true }),
      buildPrinter({ id: "other-or", role: "or" })
    ];

    const updated = applyPrinterRoleDefault(printers, "other-or", "or");
    const nextOrDefault = updated.find((printer) => printer.id === "other-or");
    const previousOrDefault = updated.find((printer) => printer.id === "or-only");
    const reportDefault = updated.find((printer) => printer.id === "both");

    expect(nextOrDefault?.defaultForOr).toBe(true);
    expect(previousOrDefault?.defaultForOr).toBe(false);
    expect(reportDefault?.defaultForReport).toBe(true);
  });

  it("builds receipt layout options from the saved printer layout", () => {
    const printer = buildPrinter({
      receiptLayout: {
        logoUrl: "",
        headerLines: ["Line 1", "Line 2"],
        footerLines: ["Footer"],
        maxReceiptLines: 25,
        autoCondense: true
      }
    });

    expect(getReceiptLayoutOptions(printer)).toEqual({
      headerLines: ["Line 1", "Line 2"],
      footerLines: ["Footer"],
      maxLines: 25,
      condense: true
    });
  });
});
