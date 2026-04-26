"use client";
import { useState, useEffect, useCallback } from "react";
import { getAll, getOne, putOne } from "../lib/db";
import { logAuditEvent } from "./audit-trail";
import { buildReceipt, createPrinterBackend, getReceiptLayoutOptions, PrinterService, resolvePrinterForRole } from "@/lib/printer";
import type { Transaction, ZReading, BirSettings } from "@/lib/types";

const fmt = (n: number) => `\u20b1${n.toFixed(2)}`;

function computeZReading(
  transactions: Transaction[],
  bir: BirSettings | undefined
): Omit<ZReading, "id"> {
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
    machineSerial: bir?.machineSerial ?? "",
    beginningOrNumber: first ? Number(first.localNumber) : bir?.orSeriesStart ?? 0,
    lastOrNumber: last ? Number(last.localNumber) : bir?.currentOrNumber ?? 0,
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
    storeName: bir?.registeredName ?? "",
    tin: bir?.tin ?? "",
    ptuNumber: bir?.ptuNumber ?? "",
    transactionCount: transactions.length,
    endingOrNumber: last ? Number(last.localNumber) : bir?.currentOrNumber ?? 0,
    resetFlag: false,
  };
}

export function ZReadingReport() {
  const [generated, setGenerated] = useState<ZReading | null>(null);
  const [generating, setGenerating] = useState(false);
  const [zGeneratedToday, setZGeneratedToday] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [reading, setReading] = useState<Omit<ZReading, "id"> | null>(null);
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [history, setHistory] = useState<ZReading[]>([]);

  const loadAndCompute = useCallback(async () => {
    const [txs, birRaw, zHistory] = await Promise.all([
      getAll("transactions") as Promise<Transaction[]>,
      getOne("birSettings", "bir"),
      getAll("zReadings") as Promise<ZReading[]>,
    ]);
    const bir = birRaw as BirSettings | undefined;
    const sorted = txs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const computed = computeZReading(sorted, bir);
    setReading(computed);
    setHistory(
      (zHistory as ZReading[])
        .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
        .slice(0, 10)
    );
    const today = new Date().toISOString().slice(0, 10);
    setZGeneratedToday(zHistory.some((z) => z.reportDate === today));
  }, []);

  useEffect(() => {
    loadAndCompute();
  }, [loadAndCompute]);

  async function handleGenerate(override?: string) {
    if (!reading) return;
    setGenerating(true);
    try {
      const report: ZReading = {
        ...reading,
        id: crypto.randomUUID(),
        resetFlag: Boolean(override),
        overrideReason: override,
        overrideBy: override ? "Admin" : undefined,
      };
      await putOne("zReadings", report);
      await logAuditEvent(
        "z-reading",
        "Current User",
        override
          ? `Z-Reading override: ${override}`
          : `Z-Reading generated for ${reading.reportDate}`,
        "admin"
      );
      setGenerated(report);
      setShowOverride(false);
      setOverrideReason("");
      setZGeneratedToday(true);
      await loadAndCompute();
    } finally {
      setGenerating(false);
    }
  }

  const r = generated ?? reading;

  return (
    <div>
      <div className="report-actions">
        {zGeneratedToday && !generated ? (
          <>
            <button className="primary report-generate-btn disabled" disabled>
              Z-Reading already generated for today
            </button>
            <button
              style={{
                background: "none",
                border: "none",
                color: "var(--primary)",
                textDecoration: "underline",
                cursor: "pointer",
                fontSize: 13,
              }}
              onClick={() => setShowOverride(true)}
            >
              Override
            </button>
          </>
        ) : (
          <button
            className="primary report-generate-btn"
            onClick={() => handleGenerate()}
            disabled={generating || !reading}
          >
            {generating ? "Generating..." : "Generate Z-Reading"}
          </button>
        )}
      </div>

      {/* Override Modal */}
      {showOverride && (
        <div className="override-modal-backdrop" onClick={() => setShowOverride(false)}>
          <div className="override-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Z-Reading Override Required</h3>
            <p>A Z-Reading has already been generated for today. Supervisor approval required.</p>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--muted)" }}>
              Reason (required)
            </label>
            <textarea
              placeholder="Enter reason for override..."
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--muted)" }}>
              Authorizing User
            </label>
            <input type="text" defaultValue="Admin" readOnly style={{ marginBottom: 16 }} />
            <div className="override-modal-actions">
              <button onClick={() => setShowOverride(false)}>Cancel</button>
              <button
                className="primary"
                onClick={() => handleGenerate(overrideReason)}
                disabled={!overrideReason.trim() || generating}
              >
                Confirm Override
              </button>
            </div>
          </div>
        </div>
      )}

      {r && (
        <>
          <div className="bir-report-card">
            <div className="bir-report-header">
              <h2>Z-READING REPORT</h2>
              <p><strong>{r.storeName || "Store"}</strong></p>
              <p>TIN: {r.tin || "Not configured"}</p>
              <p>PTU No: {r.ptuNumber || "N/A"}</p>
              <p>Machine S/N: {r.machineSerial || "N/A"}</p>
              <p>Date: {r.reportDate}</p>
            </div>

            <div className="bir-report-section">
              <div className="bir-report-row">
                <span className="label">Beginning OR#</span>
                <span className="value">{r.beginningOrNumber}</span>
              </div>
              <div className="bir-report-row">
                <span className="label">Ending OR#</span>
                <span className="value">{r.endingOrNumber}</span>
              </div>
              <div className="bir-report-row">
                <span className="label">Transaction Count</span>
                <span className="value">{r.transactionCount}</span>
              </div>
            </div>

            <div className="bir-report-section">
              <div className="bir-report-row">
                <span className="label">Gross Sales</span>
                <span className="value">{fmt(r.grossSales)}</span>
              </div>
              <div className="bir-report-row">
                <span className="label">VATable Sales (net of VAT)</span>
                <span className="value">{fmt(r.vatableSales)}</span>
              </div>
              <div className="bir-report-row">
                <span className="label">Output VAT (12%)</span>
                <span className="value">{fmt(r.vatAmount)}</span>
              </div>
              <div className="bir-report-row">
                <span className="label">Zero-Rated Sales</span>
                <span className="value">{fmt(r.zeroRatedSales)}</span>
              </div>
              <div className="bir-report-row">
                <span className="label">VAT-Exempt Sales</span>
                <span className="value">{fmt(r.vatExemptSales)}</span>
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
                <span className="label">Other Discounts</span>
                <span className="value">{fmt(r.promotionalDiscount)}</span>
              </div>
            </div>

            <div className="bir-report-section">
              <div className="bir-report-row">
                <span className="label">Total Voids ({r.totalVoids})</span>
                <span className="value">{fmt(r.voidAmount)}</span>
              </div>
              <div className="bir-report-row">
                <span className="label">Total Returns/Refunds ({r.totalReturns})</span>
                <span className="value">{fmt(r.returnAmount)}</span>
              </div>
            </div>

            <div className="bir-report-section">
              <div className="bir-report-row total">
                <span className="label">Net Sales</span>
                <span className="value">{fmt(r.netSales)}</span>
              </div>
            </div>

            {r.resetFlag && r.overrideReason && (
              <div className="report-pdf-indicator">
                Override reason: {r.overrideReason}
              </div>
            )}

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
                  const commands = buildReceipt("z-reading", printer, (nextBir as BirSettings | undefined) ?? undefined, r as ZReading, getReceiptLayoutOptions(printer));
                  const result = await service.print(commands);
                  await service.disconnect();
                  setPrintStatus(result.status === "success" ? "Printed" : `Failed: ${result.status}`);
                }}
              >
                Print Z-Reading
              </button>
              {printStatus && (
                <span style={{ fontSize: 12, marginLeft: 8, color: printStatus.startsWith("Failed") ? "var(--danger)" : "var(--success)" }}>
                  {printStatus}
                </span>
              )}
              <span className="report-permission-note">Auto-cut enabled</span>
            </div>
          </div>

          {/* Z-Reading History Log */}
          <h3 style={{ marginTop: 24, marginBottom: 8 }}>Z-Reading History</h3>
          <table className="z-history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Generated By</th>
                <th>Time</th>
                <th>Net Sales</th>
                <th>OR Range</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 16 }}>
                    No Z-Reading history yet.
                  </td>
                </tr>
              )}
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{h.reportDate}</td>
                  <td>{h.generatedBy}</td>
                  <td>{h.reportTime}</td>
                  <td>{fmt(h.netSales)}</td>
                  <td>{h.beginningOrNumber} - {h.endingOrNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
