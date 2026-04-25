"use client";
import { useState, useMemo } from "react";
import type { EJournalRow } from "@/lib/types";

const fmt = (n: number) => `₱${n.toFixed(2)}`;

const mockRows: EJournalRow[] = [
  { orNumber: 49800, transactionDate: "2026-04-25", transactionTime: "08:12", cashierId: "Maria Santos", grossAmount: 1250.00, vatableAmount: 1116.07, vatAmount: 133.93, vatExemptAmount: 0, zeroRatedAmount: 0, scDiscount: 0, pwdDiscount: 0, otherDiscounts: 0, voidFlag: false, returnFlag: false, paymentMethod: "Cash", netAmount: 1250.00 },
  { orNumber: 49801, transactionDate: "2026-04-25", transactionTime: "08:34", cashierId: "Maria Santos", grossAmount: 3450.00, vatableAmount: 3080.36, vatAmount: 369.64, vatExemptAmount: 0, zeroRatedAmount: 0, scDiscount: 0, pwdDiscount: 0, otherDiscounts: 0, voidFlag: false, returnFlag: false, paymentMethod: "Cash", netAmount: 3450.00 },
  { orNumber: 49802, transactionDate: "2026-04-25", transactionTime: "09:05", cashierId: "Juan Cruz", grossAmount: 890.00, vatableAmount: 794.64, vatAmount: 95.36, vatExemptAmount: 0, zeroRatedAmount: 0, scDiscount: 0, pwdDiscount: 0, otherDiscounts: 0, voidFlag: false, returnFlag: false, paymentMethod: "Card", netAmount: 890.00 },
  { orNumber: 49803, transactionDate: "2026-04-25", transactionTime: "09:22", cashierId: "Maria Santos", grossAmount: 2100.00, vatableAmount: 0, vatAmount: 0, vatExemptAmount: 2100.00, zeroRatedAmount: 0, scDiscount: 500.00, pwdDiscount: 0, otherDiscounts: 0, voidFlag: false, returnFlag: false, paymentMethod: "Cash", netAmount: 1600.00 },
  { orNumber: 49804, transactionDate: "2026-04-25", transactionTime: "10:15", cashierId: "Juan Cruz", grossAmount: 750.00, vatableAmount: 669.64, vatAmount: 80.36, vatExemptAmount: 0, zeroRatedAmount: 0, scDiscount: 0, pwdDiscount: 0, otherDiscounts: 0, voidFlag: true, returnFlag: false, paymentMethod: "Cash", netAmount: 0 },
  { orNumber: 49805, transactionDate: "2026-04-25", transactionTime: "10:48", cashierId: "Maria Santos", grossAmount: 5600.00, vatableAmount: 5000.00, vatAmount: 600.00, vatExemptAmount: 0, zeroRatedAmount: 0, scDiscount: 0, pwdDiscount: 0, otherDiscounts: 200.00, voidFlag: false, returnFlag: false, paymentMethod: "Cash", netAmount: 5400.00 },
  { orNumber: 49806, transactionDate: "2026-04-25", transactionTime: "11:30", cashierId: "Juan Cruz", grossAmount: 1800.00, vatableAmount: 1607.14, vatAmount: 192.86, vatExemptAmount: 0, zeroRatedAmount: 0, scDiscount: 0, pwdDiscount: 300.00, otherDiscounts: 0, voidFlag: false, returnFlag: false, paymentMethod: "Card", netAmount: 1500.00 },
  { orNumber: 49807, transactionDate: "2026-04-25", transactionTime: "12:05", cashierId: "Maria Santos", grossAmount: 450.00, vatableAmount: 401.79, vatAmount: 48.21, vatExemptAmount: 0, zeroRatedAmount: 0, scDiscount: 0, pwdDiscount: 0, otherDiscounts: 0, voidFlag: false, returnFlag: true, paymentMethod: "Cash", netAmount: -450.00 },
  { orNumber: 49808, transactionDate: "2026-04-25", transactionTime: "13:20", cashierId: "Juan Cruz", grossAmount: 4200.00, vatableAmount: 3750.00, vatAmount: 450.00, vatExemptAmount: 0, zeroRatedAmount: 0, scDiscount: 0, pwdDiscount: 0, otherDiscounts: 0, voidFlag: false, returnFlag: false, paymentMethod: "Cash", netAmount: 4200.00 },
  { orNumber: 49809, transactionDate: "2026-04-25", transactionTime: "14:10", cashierId: "Maria Santos", grossAmount: 3260.00, vatableAmount: 2910.71, vatAmount: 349.29, vatExemptAmount: 0, zeroRatedAmount: 0, scDiscount: 0, pwdDiscount: 0, otherDiscounts: 0, voidFlag: false, returnFlag: false, paymentMethod: "Cash", netAmount: 3260.00 },
];

type QuickRange = "today" | "week" | "custom";

export function EJournalExport() {
  const [range, setRange] = useState<QuickRange>("today");
  const [startDate, setStartDate] = useState("2026-04-25");
  const [endDate, setEndDate] = useState("2026-04-25");
  const [validated, setValidated] = useState(false);
  const [validationPass, setValidationPass] = useState(true);

  const rows = useMemo(() => mockRows, []);

  function handleValidate() {
    setValidated(true);
    // mock: show discrepancy
    setValidationPass(false);
  }

  return (
    <div>
      {/* Date Range Picker */}
      <div className="ejournal-controls">
        <button
          className={range === "today" ? "active" : ""}
          onClick={() => setRange("today")}
        >
          Today
        </button>
        <button
          className={range === "week" ? "active" : ""}
          onClick={() => setRange("week")}
        >
          This Week
        </button>
        <button
          className={range === "custom" ? "active" : ""}
          onClick={() => setRange("custom")}
        >
          Custom
        </button>
        {range === "custom" && (
          <>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: 160 }}
            />
            <span style={{ color: "var(--muted)" }}>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: 160 }}
            />
          </>
        )}
      </div>

      {/* Preview Table */}
      <table className="ejournal-table">
        <thead>
          <tr>
            <th>OR#</th>
            <th>Date</th>
            <th>Time</th>
            <th>Cashier</th>
            <th>Gross</th>
            <th>VATable</th>
            <th>VAT</th>
            <th>Exempt</th>
            <th>Zero-Rated</th>
            <th>SC Disc</th>
            <th>PWD Disc</th>
            <th>Other Disc</th>
            <th>Type</th>
            <th>Payment</th>
            <th>Net</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rowClass = r.voidFlag ? "void-row" : r.returnFlag ? "return-row" : "";
            const typeLabel = r.voidFlag ? "void" : r.returnFlag ? "return" : "sale";
            return (
              <tr key={r.orNumber} className={rowClass}>
                <td>{r.orNumber}</td>
                <td>{r.transactionDate}</td>
                <td>{r.transactionTime}</td>
                <td>{r.cashierId}</td>
                <td>{fmt(r.grossAmount)}</td>
                <td>{fmt(r.vatableAmount)}</td>
                <td>{fmt(r.vatAmount)}</td>
                <td>{fmt(r.vatExemptAmount)}</td>
                <td>{fmt(r.zeroRatedAmount)}</td>
                <td>{fmt(r.scDiscount)}</td>
                <td>{fmt(r.pwdDiscount)}</td>
                <td>{fmt(r.otherDiscounts)}</td>
                <td>
                  <span className={`type-badge ${typeLabel}`}>
                    {typeLabel.toUpperCase()}
                  </span>
                </td>
                <td>{r.paymentMethod}</td>
                <td>{fmt(r.netAmount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Validate */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="primary" onClick={handleValidate}>
          Validate eJournal
        </button>
      </div>

      {validated && (
        validationPass ? (
          <div className="validation-result pass">
            ✅ Validation passed — no discrepancies found
          </div>
        ) : (
          <div className="validation-result fail">
            ⚠️ OR gap detected: OR #49815 missing
          </div>
        )
      )}

      {/* Export */}
      <div className="export-section">
        <button className="primary">Export as .txt</button>
        <span className="file-preview">File: 04252026_SN-2024-001_eJournal.txt</span>
      </div>
      <p className="retention-notice">Files retained for 10 years per BIR requirement</p>
    </div>
  );
}
