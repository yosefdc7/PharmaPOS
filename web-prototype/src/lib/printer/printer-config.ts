import type { PrinterProfile, PrinterRole, ReceiptLayoutConfig } from "@/lib/types";

export type PrintTargetRole = "or" | "report";

const DEFAULT_RECEIPT_LAYOUT: ReceiptLayoutConfig = {
  logoUrl: "",
  headerLines: [],
  footerLines: [],
  maxReceiptLines: 40,
  autoCondense: false
};

export function createDefaultReceiptLayout(): ReceiptLayoutConfig {
  return { ...DEFAULT_RECEIPT_LAYOUT };
}

export function getReceiptLayout(profile?: PrinterProfile): ReceiptLayoutConfig {
  return {
    ...DEFAULT_RECEIPT_LAYOUT,
    ...(profile?.receiptLayout ?? {})
  };
}

export function getReceiptLayoutOptions(profile?: PrinterProfile) {
  const layout = getReceiptLayout(profile);
  return {
    headerLines: layout.headerLines.length > 0 ? layout.headerLines : undefined,
    footerLines: layout.footerLines.length > 0 ? layout.footerLines : undefined,
    maxLines: layout.maxReceiptLines,
    condense: layout.autoCondense
  };
}

export function canServeRole(profile: PrinterProfile, role: PrintTargetRole): boolean {
  return profile.role === "both" || profile.role === role;
}

export function resolvePrinterForRole(
  profiles: PrinterProfile[],
  role: PrintTargetRole
): PrinterProfile | undefined {
  const eligible = profiles.filter((profile) => canServeRole(profile, role));
  if (eligible.length === 0) {
    return undefined;
  }

  const preferred = eligible.find((profile) =>
    role === "or" ? profile.defaultForOr : profile.defaultForReport
  );

  return preferred ?? eligible[0];
}

export function applyPrinterRoleDefault(
  profiles: PrinterProfile[],
  printerId: string,
  role: PrintTargetRole
): PrinterProfile[] {
  return profiles.map((profile) => {
    if (!canServeRole(profile, role)) {
      return profile;
    }

    const nextDefaultForOr = role === "or" ? profile.id === printerId : profile.defaultForOr ?? false;
    const nextDefaultForReport = role === "report" ? profile.id === printerId : profile.defaultForReport ?? false;

    return {
      ...profile,
      defaultForOr: nextDefaultForOr,
      defaultForReport: nextDefaultForReport,
      isDefault: nextDefaultForOr || nextDefaultForReport
    };
  });
}

export function getPrinterDefaultLabel(profile: PrinterProfile): string | null {
  const isOrDefault = Boolean(profile.defaultForOr);
  const isReportDefault = Boolean(profile.defaultForReport);

  if (isOrDefault && isReportDefault) {
    return "Default OR + Report";
  }

  if (isOrDefault) {
    return "Default OR";
  }

  if (isReportDefault) {
    return "Default Report";
  }

  return null;
}

export function normalizePrinterProfile(profile: PrinterProfile): PrinterProfile {
  const defaultForOr = profile.defaultForOr ?? false;
  const defaultForReport = profile.defaultForReport ?? false;

  return {
    ...profile,
    defaultForOr,
    defaultForReport,
    isDefault: defaultForOr || defaultForReport,
    receiptLayout: getReceiptLayout(profile)
  };
}
