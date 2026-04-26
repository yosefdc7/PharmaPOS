"use client";

import { useEffect, useMemo, useState } from "react";
import { getAll, getOne } from "@/lib/db";
import type { BirSettings, PrinterProfile, Settings, Transaction } from "@/lib/types";
import {
  buildReceipt,
  createPrinterBackend,
  getReceiptLayout,
  getReceiptLayoutOptions,
  PrinterService,
  resolvePrinterForRole
} from "@/lib/printer";

function formatMoney(value: number): string {
  return `P${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

type ReceiptPreviewProps = {
  variant?: "normal" | "void" | "reprint";
  onClose?: () => void;
  transaction?: Transaction;
};

export function ReceiptPreview({ variant = "normal", onClose, transaction }: ReceiptPreviewProps) {
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [birSettings, setBirSettings] = useState<BirSettings | null>(null);
  const [printer, setPrinter] = useState<PrinterProfile | null>(null);

  const tx = transaction;
  const items = tx?.items ?? [];
  const scPwdMeta = tx?.scPwdMetadata;
  const hasScPwd = Boolean(scPwdMeta);
  const dateStr = tx ? new Date(tx.createdAt).toLocaleString("en-PH") : new Date().toLocaleString("en-PH");
  const orNumber = tx?.localNumber ?? "Not issued";

  useEffect(() => {
    async function loadContext() {
      const [nextSettings, nextBir, profiles] = await Promise.all([
        getOne("settings", "store"),
        getOne("birSettings", "bir"),
        getAll("printerProfiles")
      ]);

      setSettings(nextSettings ?? null);
      setBirSettings(nextBir ?? null);
      setPrinter(resolvePrinterForRole(profiles, "or") ?? null);
    }

    loadContext();
  }, []);

  const layout = useMemo(() => getReceiptLayout(printer ?? undefined), [printer]);

  const headerLines = useMemo(() => {
    const lines = [
      settings?.store || birSettings?.registeredName || "Store name not configured",
      settings?.addressOne,
      settings?.addressTwo,
      settings?.contact ? `Contact: ${settings.contact}` : undefined
    ];

    return lines.filter((line): line is string => Boolean(line && line.trim()));
  }, [birSettings?.registeredName, settings?.addressOne, settings?.addressTwo, settings?.contact, settings?.store]);

  async function handleThermalPrint() {
    if (!tx || !printer) {
      return;
    }

    setPrintStatus("Connecting...");
    const service = new PrinterService(createPrinterBackend);
    const connectResult = await service.connect(printer);
    if (connectResult.status !== "success") {
      setPrintStatus(`Failed: ${connectResult.status}`);
      await service.disconnect();
      return;
    }

    const commands = buildReceipt(variant, printer, birSettings ?? undefined, tx, getReceiptLayoutOptions(printer));
    const result = await service.print(commands);
    await service.disconnect();
    setPrintStatus(result.status === "success" ? "Printed" : `Failed: ${result.status}`);
  }

  return (
    <div className="receipt-preview">
      {variant === "void" && <div className="receipt-void-watermark">VOID</div>}

      {variant === "reprint" && (
        <div className="receipt-reprint-header">
          *** REPRINT - NOT AN ORIGINAL OR ***
          <div style={{ fontWeight: 400, fontSize: 10, marginTop: 2 }}>
            Reprinted: {dateStr}
          </div>
        </div>
      )}

      <div className="receipt-center">
        <div className="receipt-store-name">{headerLines[0] ?? "Store name not configured"}</div>
        {headerLines.slice(1).map((line) => (
          <div key={line}>{line}</div>
        ))}
        <div>TIN: {birSettings?.tin || "Not configured"}</div>
        <div>PTU No: {birSettings?.ptuNumber || "Not configured"}</div>
        <div style={{ fontSize: 10 }}>Accreditation No: {birSettings?.accreditationNumber || "Not configured"}</div>
        <div style={{ fontSize: 10 }}>Machine S/N: {birSettings?.machineSerial || "Not configured"}</div>
        {layout.headerLines.map((line) => (
          <div key={`layout-header-${line}`}>{line}</div>
        ))}
      </div>

      <hr className="receipt-separator" />

      <div className="receipt-center">
        <div className="receipt-or-title">Official Receipt</div>
        <div>OR #: {orNumber}</div>
        <div>Date: {dateStr}</div>
        {!printer && <div>OR printer not configured</div>}
      </div>

      <hr className="receipt-separator" />

      {!tx ? (
        <div className="receipt-center" style={{ padding: "12px 0" }}>
          No completed transaction selected. Complete a sale to preview a live receipt.
        </div>
      ) : (
        <>
          <div className="receipt-line-item" style={{ fontWeight: 700, marginBottom: 4 }}>
            <span className="item-name">Item</span>
            <span className="item-detail" style={{ width: 30 }}>Qty</span>
            <span className="item-detail" style={{ width: 60 }}>Price</span>
            <span className="item-detail" style={{ width: 70 }}>Amount</span>
          </div>

          {items.map((item) => (
            <div className="receipt-line-item" key={item.productId}>
              <span className="item-name">
                {item.productName}
                {item.vatExempt && (
                  <span style={{ fontSize: 9, display: "block", color: "#666" }}>VAT-EXEMPT</span>
                )}
                {item.scPwdDiscounted && item.originalPrice && item.originalPrice > item.price && (
                  <span style={{ fontSize: 9, display: "block", color: "#666" }}>
                    Disc {formatMoney(item.originalPrice - item.price)} each
                  </span>
                )}
              </span>
              <span className="item-detail" style={{ width: 30 }}>{item.quantity}</span>
              <span className="item-detail" style={{ width: 60 }}>{formatMoney(item.price)}</span>
              <span className="item-detail" style={{ width: 70 }}>{formatMoney(item.lineTotal ?? item.price * item.quantity)}</span>
            </div>
          ))}

          <hr className="receipt-separator" />

          <div className="receipt-subtotal-row">
            <span>Subtotal</span>
            <span>{formatMoney(tx.subtotal)}</span>
          </div>
          {hasScPwd && (
            <div className="receipt-subtotal-row">
              <span>VATable Sales</span>
              <span>{formatMoney(0)}</span>
            </div>
          )}
          <div className="receipt-subtotal-row">
            <span>VAT Amount (12%)</span>
            <span>{formatMoney(tx.tax)}</span>
          </div>
          <div className="receipt-subtotal-row">
            <span>VAT-Exempt Sales</span>
            <span>{formatMoney(hasScPwd ? tx.subtotal : 0)}</span>
          </div>
          <div className="receipt-subtotal-row total-due">
            <span>Total Due</span>
            <span>{formatMoney(tx.total)}</span>
          </div>

          <hr className="receipt-separator" />

          {hasScPwd && scPwdMeta && (
            <div className="receipt-sc-section">
              <div style={{ fontWeight: 700, marginBottom: 2 }}>
                {scPwdMeta.discountType.toUpperCase()} Discount Applied
              </div>
              <div>Customer: {scPwdMeta.fullName}</div>
              <div>ID: {scPwdMeta.idNumber}</div>
              {scPwdMeta.tin && <div>TIN: {scPwdMeta.tin}</div>}
              <div>Discount Amount: {formatMoney(scPwdMeta.scPwdDiscountAmount)}</div>
              {scPwdMeta.proxyPurchase && scPwdMeta.proxyDetails && (
                <div>Proxy: {scPwdMeta.proxyDetails.proxyName} ({scPwdMeta.proxyDetails.proxyRelation})</div>
              )}
            </div>
          )}

          <div className="receipt-subtotal-row">
            <span>Payment Method</span>
            <span>{tx.paymentMethod === "external-terminal" ? "CARD" : "CASH"}</span>
          </div>
          <div className="receipt-subtotal-row">
            <span>Amount Tendered</span>
            <span>{formatMoney(tx.paid)}</span>
          </div>
          <div className="receipt-subtotal-row">
            <span>Change</span>
            <span>{formatMoney(tx.paid - tx.total)}</span>
          </div>

          <hr className="receipt-separator" />

          <div className="receipt-footer">
            <div>Cashier: {tx.cashierId || "Not recorded"}</div>
            {hasScPwd && <div>Signature: ____________________</div>}
            {layout.footerLines.map((line) => (
              <div key={`layout-footer-${line}`}>{line}</div>
            ))}
            {settings?.receiptFooter && <div style={{ marginTop: 4 }}>{settings.receiptFooter}</div>}
            <div>This serves as your Official Receipt</div>
          </div>

          {variant === "void" && (
            <div className="receipt-void-details">
              <div>Original OR#: {tx.localNumber}</div>
              <div>Void status preview only</div>
              <div>Void Date: {dateStr}</div>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexDirection: "column" }}>
        <button
          className="primary"
          onClick={handleThermalPrint}
          disabled={!tx || !printer || printStatus === "Connecting..."}
          style={{ width: "100%" }}
        >
          {printStatus === "Connecting..." ? "Printing..." : "Print to Thermal"}
        </button>
        {printStatus && (
          <div style={{ fontSize: 12, textAlign: "center", color: printStatus.startsWith("Failed") ? "var(--danger)" : "var(--success)" }}>
            {printStatus}
          </div>
        )}
        {onClose && (
          <button onClick={onClose} style={{ width: "100%" }}>
            Close Preview
          </button>
        )}
      </div>
    </div>
  );
}
