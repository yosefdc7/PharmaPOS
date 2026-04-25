"use client";
import { useState, useMemo } from "react";
import type { ESalesRow } from "@/lib/types";

const fmt = (n: number) => `₱${n.toFixed(2)}`;

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const mockDailyRows: ESalesRow[] = [
  { date: "2026-04-01", beginningOr: 49500, endingOr: 49540, grossSales: 24500.00, vatableSales: 21875.00, vatAmount: 2625.00, vatExemptSales: 0, zeroRatedSales: 0, totalDiscounts: 500.00, totalVoids: 0, netSales: 24000.00 },
  { date: "2026-04-02", beginningOr: 49541, endingOr: 49590, grossSales: 31200.00, vatableSales: 27857.14, vatAmount: 3342.86, vatExemptSales: 0, zeroRatedSales: 0, totalDiscounts: 800.00, totalVoids: 250.00, netSales: 30150.00 },
  { date: "2026-04-03", beginningOr: 49591, endingOr: 49635, grossSales: 18750.00, vatableSales: 16741.07, vatAmount: 2008.93, vatExemptSales: 0, zeroRatedSales: 0, totalDiscounts: 300.00, totalVoids: 0, netSales: 18450.00 },
  { date: "2026-04-04", beginningOr: 49636, endingOr: 49700, grossSales: 42300.00, vatableSales: 37767.86, vatAmount: 4532.14, vatExemptSales: 0, zeroRatedSales: 0, totalDiscounts: 1200.00, totalVoids: 500.00, netSales: 40600.00 },
  { date: "2026-04-05", beginningOr: 49701, endingOr: 49750, grossSales: 27800.00, vatableSales: 24821.43, vatAmount: 2978.57, vatExemptSales: 0, zeroRatedSales: 0, totalDiscounts: 600.00, totalVoids: 0, netSales: 27200.00 },
  { date: "2026-04-06", beginningOr: 49751, endingOr: 49800, grossSales: 35400.00, vatableSales: 31607.14, vatAmount: 3792.86, vatExemptSales: 1500.00, zeroRatedSales: 0, totalDiscounts: 900.00, totalVoids: 300.00, netSales: 34200.00 },
  { date: "2026-04-07", beginningOr: 49801, endingOr: 49850, grossSales: 22100.00, vatableSales: 19732.14, vatAmount: 2367.86, vatExemptSales: 0, zeroRatedSales: 0, totalDiscounts: 400.00, totalVoids: 0, netSales: 21700.00 },
];

// Previous month totals for comparison
const prevMonthGross = 185000.0;

export function ESalesReport() {
  const [month, setMonth] = useState(3); // April = index 3
  const [year, setYear] = useState(2026);

  const totals = useMemo(() => {
    return mockDailyRows.reduce(
      (acc, r) => ({
        grossSales: acc.grossSales + r.grossSales,
        vatAmount: acc.vatAmount + r.vatAmount,
        vatExemptSales: acc.vatExemptSales + r.vatExemptSales,
        totalVoids: acc.totalVoids + r.totalVoids,
        vatableSales: acc.vatableSales + r.vatableSales,
        zeroRatedSales: acc.zeroRatedSales + r.zeroRatedSales,
        totalDiscounts: acc.totalDiscounts + r.totalDiscounts,
        netSales: acc.netSales + r.netSales,
      }),
      { grossSales: 0, vatAmount: 0, vatExemptSales: 0, totalVoids: 0, vatableSales: 0, zeroRatedSales: 0, totalDiscounts: 0, netSales: 0 }
    );
  }, []);

  const grossChange = ((totals.grossSales - prevMonthGross) / prevMonthGross) * 100;

  return (
    <div>
      {/* Month Picker */}
      <div className="month-picker">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {months.map((m, i) => (
            <option key={m} value={i}>{m}</option>
          ))}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          <option value={2025}>2025</option>
          <option value={2026}>2026</option>
        </select>
      </div>

      {/* Monthly Summary */}
      <div className="esales-summary">
        <article className="metric">
          <span>Total Gross Sales</span>
          <strong>{fmt(totals.grossSales)}</strong>
          <div className={`esales-change ${grossChange >= 0 ? "positive" : "negative"}`}>
            {grossChange >= 0 ? "▲" : "▼"} {Math.abs(grossChange).toFixed(1)}% vs prev month
          </div>
        </article>
        <article className="metric">
          <span>Total VAT Collected</span>
          <strong>{fmt(totals.vatAmount)}</strong>
        </article>
        <article className="metric">
          <span>Total Exemptions</span>
          <strong>{fmt(totals.vatExemptSales)}</strong>
        </article>
        <article className="metric">
          <span>Total Voids</span>
          <strong>{fmt(totals.totalVoids)}</strong>
        </article>
      </div>

      {/* Daily Breakdown Table */}
      <table className="esales-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Begin OR</th>
            <th>End OR</th>
            <th>Gross</th>
            <th>VATable</th>
            <th>VAT Amt</th>
            <th>Exempt</th>
            <th>Zero-Rated</th>
            <th>Discounts</th>
            <th>Voids</th>
            <th>Net</th>
          </tr>
        </thead>
        <tbody>
          {mockDailyRows.map((r) => (
            <tr key={r.date}>
              <td>{r.date}</td>
              <td>{r.beginningOr}</td>
              <td>{r.endingOr}</td>
              <td>{fmt(r.grossSales)}</td>
              <td>{fmt(r.vatableSales)}</td>
              <td>{fmt(r.vatAmount)}</td>
              <td>{fmt(r.vatExemptSales)}</td>
              <td>{fmt(r.zeroRatedSales)}</td>
              <td>{fmt(r.totalDiscounts)}</td>
              <td>{fmt(r.totalVoids)}</td>
              <td>{fmt(r.netSales)}</td>
            </tr>
          ))}
          <tr className="grand-total">
            <td>Grand Total</td>
            <td></td>
            <td></td>
            <td>{fmt(totals.grossSales)}</td>
            <td>{fmt(totals.vatableSales)}</td>
            <td>{fmt(totals.vatAmount)}</td>
            <td>{fmt(totals.vatExemptSales)}</td>
            <td>{fmt(totals.zeroRatedSales)}</td>
            <td>{fmt(totals.totalDiscounts)}</td>
            <td>{fmt(totals.totalVoids)}</td>
            <td>{fmt(totals.netSales)}</td>
          </tr>
        </tbody>
      </table>

      {/* Export */}
      <div className="export-section">
        <button className="primary">Export as CSV</button>
        <span className="file-preview">2026-04_123-456-789-000_eSales.csv</span>
      </div>
    </div>
  );
}
