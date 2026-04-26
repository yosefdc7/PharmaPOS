import type { BirSettings, PrinterProfile, Transaction, XReading, ZReading } from "@/lib/types";
import { EscPosBuilder, line, text, align, bold, doubleHeight, normalSize, initPrinter, feedLines, cut } from "./escpos-commands";

export type ReceiptVariant = "normal" | "void" | "reprint" | "x-reading" | "z-reading" | "daily-summary";

const CHARS_58MM = 32;
const CHARS_80MM = 48;

function charsForWidth(pw: 58 | 80): number {
  return pw === 58 ? CHARS_58MM : CHARS_80MM;
}

function centerText(str: string, width: number): string {
  if (str.length >= width) return str;
  const pad = Math.floor((width - str.length) / 2);
  return " ".repeat(pad) + str;
}

function padRight(str: string, width: number): string {
  return str.length >= width ? str.slice(0, width) : str + " ".repeat(width - str.length);
}

function formatPeso(n: number): string {
  return "P" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatDate(d: Date): string {
  return d.toLocaleString("en-PH", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true });
}

/**
 * Build a BIR-compliant receipt / report as a Uint8Array of ESC/POS commands.
 */
export function buildReceipt(
  variant: ReceiptVariant,
  profile: PrinterProfile,
  bir: BirSettings | undefined,
  data: Transaction | XReading | ZReading | null,
  options?: {
    headerLines?: string[];
    footerLines?: string[];
    maxLines?: number;
    condense?: boolean;
    reprintBy?: string;
    voidReason?: string;
  }
): Uint8Array {
  const b = new EscPosBuilder().init();
  const w = charsForWidth(profile.paperWidth);

  // --- Header ---
  b.alignCenter().setBold(true).setDoubleHeight();
  b.addLine(bir?.registeredName ?? "PharmaPOS PH Drug Store");
  b.setNormalSize().setBold(false);

  if (bir?.registeredAddress) {
    b.addLine(bir.registeredAddress);
  }
  if (bir?.tin) {
    b.addLine(`TIN: ${bir.tin}`);
  }
  if (bir?.ptuNumber) {
    b.addLine(`PTU No: ${bir.ptuNumber}`);
  }
  if (bir?.accreditationNumber) {
    b.addLine(`Accreditation No: ${bir.accreditationNumber}`);
  }
  if (bir?.machineSerial) {
    b.addLine(`Machine SN: ${bir.machineSerial}`);
  }

  if (options?.headerLines) {
    for (const hl of options.headerLines) {
      b.addLine(hl);
    }
  }

  b.addLine("-".repeat(w));

  // --- Variant title ---
  if (variant === "void") {
    b.setBold(true).setDoubleHeight();
    b.addLine(centerText("*** VOID ***", w));
    b.setNormalSize().setBold(false);
  } else if (variant === "reprint") {
    b.setBold(true).setDoubleHeight();
    b.addLine(centerText("*** REPRINT ***", w));
    b.setNormalSize().setBold(false);
    b.addLine(centerText("NOT AN ORIGINAL OR", w));
    if (options?.reprintBy) {
      b.addLine(`Authorized by: ${options.reprintBy}`);
    }
  } else if (variant === "x-reading") {
    b.setBold(true).setDoubleHeight();
    b.addLine(centerText("X-READING REPORT", w));
    b.setNormalSize().setBold(false);
  } else if (variant === "z-reading") {
    b.setBold(true).setDoubleHeight();
    b.addLine(centerText("Z-READING REPORT", w));
    b.setNormalSize().setBold(false);
  } else if (variant === "daily-summary") {
    b.setBold(true).setDoubleHeight();
    b.addLine(centerText("DAILY SALES SUMMARY", w));
    b.setNormalSize().setBold(false);
  } else {
    b.setBold(true).setDoubleHeight();
    b.addLine(centerText("OFFICIAL RECEIPT", w));
    b.setNormalSize().setBold(false);
  }

  // --- Body ---
  if (variant === "normal" || variant === "void" || variant === "reprint") {
    const tx = data as Transaction | null;
    if (tx) {
      b.addLine(`OR #: ${tx.localNumber}`);
      b.addLine(`Date: ${formatDate(new Date(tx.createdAt))}`);
      b.addLine(`Cashier: ${tx.cashierId ?? "Cashier"}`);
      b.addLine("-".repeat(w));

      // Items
      b.alignLeft().setBold(true);
      b.addLine(`${padRight("Item", w - 22)}  Qty    Price    Amount`);
      b.setBold(false);

      let lineCount = 0;
      for (const item of tx.items) {
        const name = padRight(item.productName.slice(0, w - 22), w - 22);
        const qty = padRight(String(item.quantity), 5);
        const price = padRight(formatPeso(item.price), 9);
        const amount = formatPeso(item.lineTotal ?? item.price * item.quantity);
        b.addLine(`${name}  ${qty} ${price} ${amount}`);
        lineCount++;

        if (item.vatExempt) {
          b.addLine("  VAT-EXEMPT");
          lineCount++;
        }
        if (item.scPwdDiscounted && item.originalPrice && item.originalPrice > item.price) {
          const disc = formatPeso(item.originalPrice - item.price);
          b.addLine(`  Disc ${disc} each`);
          lineCount++;
        }

        if (options?.maxLines && lineCount >= options.maxLines && options.condense) {
          // If condensing, just keep going but we already warned; nothing else to do here.
        }
      }

      b.addLine("-".repeat(w));
      b.alignRight();
      b.addLine(`Subtotal: ${formatPeso(tx.subtotal)}`);
      b.addLine(`Discount: ${formatPeso(tx.discount)}`);
      b.addLine(`Tax: ${formatPeso(tx.tax)}`);
      b.setBold(true);
      b.addLine(`TOTAL: ${formatPeso(tx.total)}`);
      b.setBold(false);
      b.addLine(`Payment: ${tx.paymentMethod === "external-terminal" ? "CARD" : "CASH"}`);
      b.addLine(`Tendered: ${formatPeso(tx.paid)}`);
      b.addLine(`Change: ${formatPeso(tx.change)}`);
      b.alignLeft();

      if (tx.scPwdMetadata) {
        b.addLine("-".repeat(w));
        b.addLine(`${tx.scPwdMetadata.discountType.toUpperCase()} Discount Applied`);
        b.addLine(`ID: ${tx.scPwdMetadata.idNumber}`);
        b.addLine(`Disc Amt: ${formatPeso(tx.scPwdMetadata.scPwdDiscountAmount ?? 0)}`);
      }

      if (variant === "void" && options?.voidReason) {
        b.addLine("-".repeat(w));
        b.addLine(`Void Reason: ${options.voidReason}`);
        b.addLine(`Void Date: ${formatDate(new Date())}`);
      }
    }
  } else if (variant === "x-reading" || variant === "z-reading") {
    const r = data as XReading | ZReading;
    if (r) {
      b.addLine(`Date: ${r.reportDate}  Time: ${r.reportTime}`);
      b.addLine(`Machine: ${r.machineSerial}`);
      b.addLine(`Beginning OR: ${r.beginningOrNumber}`);
      b.addLine(`Last OR: ${r.lastOrNumber}`);
      if ("endingOrNumber" in r) {
        b.addLine(`Ending OR: ${r.endingOrNumber}`);
      }
      if ("transactionCount" in r) {
        b.addLine(`Transactions: ${r.transactionCount}`);
      }
      b.addLine("-".repeat(w));
      b.alignRight();
      b.addLine(`Gross Sales:    ${formatPeso(r.grossSales)}`);
      b.addLine(`VATable Sales:  ${formatPeso(r.vatableSales)}`);
      b.addLine(`VAT Amount:     ${formatPeso(r.vatAmount)}`);
      b.addLine(`VAT-Exempt:     ${formatPeso(r.vatExemptSales)}`);
      b.addLine(`Zero-Rated:     ${formatPeso(r.zeroRatedSales)}`);
      b.addLine(`SC Discount:    ${formatPeso(r.scDiscount)}`);
      b.addLine(`PWD Discount:   ${formatPeso(r.pwdDiscount)}`);
      b.addLine(`Promo Disc:     ${formatPeso(r.promotionalDiscount)}`);
      b.addLine(`Total Voids:    ${formatPeso(r.totalVoids)}`);
      b.addLine(`Void Amt:       ${formatPeso(r.voidAmount)}`);
      b.addLine(`Total Returns:  ${formatPeso(r.totalReturns)}`);
      b.addLine(`Return Amt:     ${formatPeso(r.returnAmount)}`);
      b.setBold(true);
      b.addLine(`NET SALES:      ${formatPeso(r.netSales)}`);
      b.setBold(false);
      b.alignLeft();
      b.addLine(`Generated by: ${r.generatedBy}`);
      b.addLine(`Generated at: ${formatDate(new Date(r.generatedAt))}`);
    }
  } else if (variant === "daily-summary") {
    const r = data as XReading | ZReading | null;
    if (r) {
      b.addLine(`Date: ${r.reportDate}`);
      b.addLine(`Machine: ${r.machineSerial}`);
      b.addLine("-".repeat(w));
      b.alignRight();
      b.addLine(`Gross:   ${formatPeso(r.grossSales)}`);
      b.addLine(`Net:     ${formatPeso(r.netSales)}`);
      b.addLine(`Voids:   ${formatPeso(r.voidAmount)}`);
      b.alignLeft();
    }
  }

  b.addLine("-".repeat(w));

  // Footer
  if (options?.footerLines) {
    b.alignCenter();
    for (const fl of options.footerLines) {
      b.addLine(fl);
    }
  }

  b.addLine("This serves as your Official Receipt");
  b.feed(3);

  if (profile.autocut) {
    if (profile.partialCut) {
      b.partialCutWithFeed(3);
    } else {
      b.fullCut();
    }
  }

  return b.build();
}
