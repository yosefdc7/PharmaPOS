"use client";
import { useState, useEffect, useCallback } from "react";
import { getAll, getOne, putOne } from "../lib/db";
import { logAuditEvent } from "./audit-trail";
import { buildReceipt, createPrinterBackend, getReceiptLayoutOptions, PrinterService, resolvePrinterForRole } from "@/lib/printer";
import type { Transaction, XReading, BirSettings } from "@/lib/types";

const fmt = (n: number) => `\u20b1${n.toFixed(2)}`;

function computeXReading(transactions: Transaction[]): Omit<XReading, "id"> {
  const grossSales = transactions.reduce((sum, t) => sum + t.subtotal, 0);
  const scDiscount = transactions.reduce((sum, t) => sum + (t.scPwdMetadata?.scPwdDiscountAmount ?? 0), 0);
  const voids = transactions.filter((t) => t.paymentStatus === "refunded");
  const totalVoids = voids.length;
  const voidAmount = voids.reduce((sum, t) => sum + t.total, 0);
  const totalDiscounts = transactions.reduce((sum, t) => sum + t.discount, 0);
  const vatAmount = transactions.reduce((sum, t) => sum + t.tax, 0);
  const netSales = grossSales - totalDiscounts - voidAmount;
  const first = transactions[transactions.length - 1];
  const last = transactions[0];
  const now = new Date();
  return {
    reportDate: now.toISOString().slice(0, 10),
    reportTime: now.toISOString().slice(11, 19),
    machineSerial: "",
    beginningOrNumber: first ? Number(first.localNumber) : 0,
    lastOrNumber: last ? Number(last.localNumber) : 0,
    grossSales,
    vatableSales: grossSales - vatAmount,
    vatExemptSales: 0,
    vatAmount,
    zeroRatedSales: 0,
    scDiscount,
    pwdDiscount: 0,
    promotionalDiscount: totalDiscounts - scDiscount,
    totalDiscounts,
    totalVoids,
    voidAmount,
    totalReturns: 0,
    returnAmount: 0,
    netSales,
    generatedBy: "Current User",
    generatedAt: now.toISOString(),
  };
}

export function XReadingReport() {
  const [generated, setGenerated] = useState<XReading | null>(null);
  const [generating, setGenerating] = useState(false);
  const [reading, setReading] = useState<Omit<XReading, "id"> | null>(null);
  const [printStatus, setPrintStatus] = useState<string | null>(null);

  const loadAndCompute = useCallback(async () => {
    const [txs, birRaw] = await Promise.all([
      getAll("transactions") as Promise<Transaction[]>,
      getOne("birSettings", "bir"),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const todayTxs = txs
      .filter((t) => t.createdAt.startsWith(today))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const bir = birRaw as BirSettings | undefined;
    const computed = computeXReading(todayTxs);
    if (bir) computed.machineSerial = bir.machineSerial;
    setReading(computed);
  }, []);

  useEffect(() => {
    loadAndCompute();
  }, [loadAndCompute]);

  async function handleGenerate() {
    if (!reading) return;
    setGenerating(true);
    try {
      const report: XReading = { ...reading, id: crypto.randomUUID() };
      await putOne("xReadings", report);
      await logAuditEvent("x-reading", "Current User", `X-Reading generated for ${reading.reportDate}`);
      setGenerated(report);
    } finally {
      setGenerating(false);
    }
  }

  const r = generated ?? reading;

  return (
    <div>
      <div className="report-actions">
        <button
          className="primary report-generate-btn"
          onClick={handleGenerate}
          disabled={generating || !reading}
        >
          {generating ? "Generating..." : generated ? "\u2713 X-Reading Generated" : "Generate X-Reading"}
        </button>
        <span className="report-permission-note">(Cashier and above)</span>
      </div>

      {r && (
        <div className="bir-report-card">
          <div className="bir-report-header">
            <h2>X-READING REPORT</h2>
            <p>Date: {r.reportDate} &nbsp;|&nbsp; Time: {r.reportTime}</p>
            <p>Machine S/N: {r.machineSerial || "Not configured"}</p>
          </div>

          <div className="bir-report-section">
            <div className="bir-report-row">
              <span className="label">Beginning OR#</span>
              <span className="value">{r.beginningOrNumber}</span>
            </div>
            <div className="bir-report-row">
              <span className="label">Last OR# Issued</span>
              <span className="value">{r.lastOrNumber}</span>
            </div>
          </div>

          <div className="bir-report-section">
            <div className="bir-report-row">
              <span className="label">Gross Sales</span>
              <span className="value">{fmt(r.grossSales)}</span>
            </div>
            <div className="bir-report-row">
              <span className="label">VATable Sales</span>
              <span className="value">{fmt(r.vatableSales)}</span>
            </div>
            <div className="bir-report-row">
              <span className="label">VAT Amount</span>
              <span className="value">{fmt(r.vatAmount)}</span>
            </div>
            <div className="bir-report-row">
              <span className="label">VAT-Exempt Sales</span>
              <span className="value">{fmt(r.vatExemptSales)}</span>
            </div>
            <div className="bir-report-row">
              <span className="label">Zero-Rated Sales</span>
              <span className="value">{fmt(r.zeroRatedSales)}</span>
            </div>
          </div>

          <div className="bir-report-section">
            <div className="bir-report-row">
              <span className="label">SC Discount</span>
              <span className="value">{fmt(r.scDiscount)}</span>
            </div>
            <div className="bir-report-row">
              <span className="label">PWD Discount</span>
              <span className="value">{fmt(r.pwdDiscount)}</span>
            </div>
            <div className="bir-report-row">
              <span className="label">Promotional Discount</span>
              <span className="value">{fmt(r.promotionalDiscount)}</span>
            </div>
            <div className="bir-report-row">
              <span className="label">Total Discounts</span>
              <span className="value">{fmt(r.totalDiscounts)}</span>
            </div>
          </div>

          <div className="bir-report-section">
            <div className="bir-report-row">
              <span className="label">Total Voids ({r.totalVoids})</span>
              <span className="value">{fmt(r.voidAmount)}</span>
            </div>
            <div className="bir-report-row">
              <span className="label">Total Returns ({r.totalReturns})</span>
              <span className="value">{fmt(r.returnAmount)}</span>
            </div>
          </div>

          <div className="bir-report-section">
            <div className="bir-report-row total">
              <span className="label">Net Sales</span>
              <span className="value">{fmt(r.netSales)}</span>
            </div>
          </div>

          <div className="bir-report-row">
            <span className="label">Generated By</span>
            <span className="value">{r.generatedBy}</span>
          </div>
          <div className="bir-report-row">
            <span className="label">Timestamp</span>
            <span className="value">{r.generatedAt}</span>
          </div>

          <div className="report-actions" style={{ marginTop: 16 }}>
            <button
              className="primary"
              onClick={async () => {
                if (!r) return;
                setPrintStatus("Connecting…");
                const [profiles, nextBir] = await Promise.all([
                  getAll("printerProfiles"),
                  getOne("birSettings", "bir")
                ]);
                const printer = resolvePrinterForRole(profiles, "report");
                if (!printer) {
                  setPrintStatus("No report printer configured");
                  return;
                }
                const service = new PrinterService(createPrinterBackend);
                const connectResult = await service.connect(printer);
                if (connectResult.status !== "success") {
                  setPrintStatus(`Failed: ${connectResult.status}`);
                  await service.disconnect();
                  return;
                }
                const commands = buildReceipt("x-reading", printer, (nextBir as BirSettings | undefined) ?? undefined, r as XReading, getReceiptLayoutOptions(printer));
                const result = await service.print(commands);
                await service.disconnect();
                setPrintStatus(result.status === "success" ? "Printed" : `Failed: ${result.status}`);
              }}
            >
              Print X-Reading
            </button>
            {printStatus && (
              <span style={{ fontSize: 12, marginLeft: 8, color: printStatus.startsWith("Failed") ? "var(--danger)" : "var(--success)" }}>
                {printStatus}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
