"use client";
import { useState } from "react";
import type { ZReading } from "@/lib/types";

const fmt = (n: number) => `₱${n.toFixed(2)}`;

const mockZReading: ZReading = {
  id: "zr-001",
  reportDate: "2026-04-25",
  reportTime: "22:00:00",
  machineSerial: "SN-2024-001",
  beginningOrNumber: 49800,
  lastOrNumber: 49920,
  grossSales: 125750.0,
  vatableSales: 112276.79,
  vatExemptSales: 8500.0,
  vatAmount: 13473.21,
  zeroRatedSales: 0,
  scDiscount: 2500.0,
  pwdDiscount: 1200.0,
  promotionalDiscount: 800.0,
  totalDiscounts: 4500.0,
  totalVoids: 3,
  voidAmount: 1250.0,
  totalReturns: 1,
  returnAmount: 450.0,
  netSales: 119550.0,
  generatedBy: "Maria Santos",
  generatedAt: "2026-04-25T22:00:00",
  storeName: "PPOS Demo Store",
  tin: "123-456-789-000",
  ptuNumber: "FP102024-110-0123456-00000",
  transactionCount: 120,
  endingOrNumber: 49920,
  resetFlag: false,
};

const mockHistory = [
  { date: "2026-04-25", generatedBy: "Maria Santos", time: "22:00", pdfName: "2026-04-25_SN-2024-001_ZReading.pdf" },
  { date: "2026-04-24", generatedBy: "Juan Cruz", time: "21:45", pdfName: "2026-04-24_SN-2024-001_ZReading.pdf" },
  { date: "2026-04-23", generatedBy: "Maria Santos", time: "22:15", pdfName: "2026-04-23_SN-2024-001_ZReading.pdf" },
  { date: "2026-04-22", generatedBy: "Juan Cruz", time: "21:30", pdfName: "2026-04-22_SN-2024-001_ZReading.pdf" },
  { date: "2026-04-21", generatedBy: "Maria Santos", time: "22:00", pdfName: "2026-04-21_SN-2024-001_ZReading.pdf" },
];

export function ZReadingReport() {
  const [generated, setGenerated] = useState(false);
  const [zGeneratedToday, setZGeneratedToday] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const r = mockZReading;

  function handleGenerate() {
    setGenerated(true);
    setZGeneratedToday(true);
  }

  function handleOverride() {
    if (!overrideReason.trim()) return;
    setShowOverride(false);
    setOverrideReason("");
    setGenerated(true);
  }

  return (
    <div>
      <div className="report-actions">
        {zGeneratedToday ? (
          <>
            <button className="primary report-generate-btn disabled" disabled>
              🔒 Z-Reading already generated for today
            </button>
            <button
              style={{ background: "none", border: "none", color: "var(--primary)", textDecoration: "underline", cursor: "pointer", fontSize: 13 }}
              onClick={() => setShowOverride(true)}
            >
              Override
            </button>
          </>
        ) : (
          <button className="primary report-generate-btn" onClick={handleGenerate}>
            Generate Z-Reading
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
              <button className="primary" onClick={handleOverride} disabled={!overrideReason.trim()}>
                Confirm Override
              </button>
            </div>
          </div>
        </div>
      )}

      {generated && (
        <>
          <div className="bir-report-card">
            <div className="bir-report-header">
              <h2>Z-READING REPORT</h2>
              <p><strong>{r.storeName}</strong></p>
              <p>TIN: {r.tin}</p>
              <p>PTU No: {r.ptuNumber}</p>
              <p>Machine S/N: {r.machineSerial}</p>
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

            <div className="report-pdf-indicator">
              📄 Saved as {r.reportDate}_{r.machineSerial}_ZReading.pdf
            </div>

            <div className="report-actions" style={{ marginTop: 16 }}>
              <button className="primary">🖨️ Print Z-Reading</button>
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
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {mockHistory.map((h) => (
                <tr key={h.date}>
                  <td>{h.date}</td>
                  <td>{h.generatedBy}</td>
                  <td>{h.time}</td>
                  <td><a href="#">{h.pdfName}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
