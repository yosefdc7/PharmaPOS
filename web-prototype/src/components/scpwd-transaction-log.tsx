"use client";

import { useState, useMemo } from "react";
import type { ScPwdTransactionLogRow } from "@/lib/types";

function formatPeso(n: number): string {
  return "₱" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

type ScpwdTransactionLogProps = {
  rows: ScPwdTransactionLogRow[];
};

export function ScpwdTransactionLog({ rows }: ScpwdTransactionLogProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return rows;
    return rows.filter(
      (r) =>
        r.customerName.toLowerCase().includes(text) ||
        r.idNumber.toLowerCase().includes(text) ||
        r.orNumber.toLowerCase().includes(text)
    );
  }, [rows, search]);

  function handleExport() {
    const header = "OR Number,Date,Customer,ID Number,Type,Gross,Discount,VAT Removed,Net\n";
    const csv = filtered
      .map(
        (r) =>
          `${r.orNumber},${new Date(r.timestamp).toLocaleString("en-PH")},"${r.customerName}",${r.idNumber},${r.discountType.toUpperCase()},${r.grossAmount.toFixed(2)},${r.scPwdDiscountAmount.toFixed(2)},${r.vatRemoved.toFixed(2)},${r.netAmount.toFixed(2)}`
      )
      .join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sc-pwd-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel scpwd-log-panel">
      <div className="scpwd-log-head">
        <h3>SC/PWD Transaction Log</h3>
        <button className="primary" onClick={handleExport}>
          Export CSV
        </button>
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, ID, or OR number"
        style={{ marginBottom: 8 }}
      />
      <div style={{ overflowX: "auto" }}>
        <table className="audit-table">
          <thead>
            <tr>
              <th>OR Number</th>
              <th>Date</th>
              <th>Customer</th>
              <th>ID Number</th>
              <th>Type</th>
              <th>Gross</th>
              <th>Discount</th>
              <th>VAT Removed</th>
              <th>Net</th>
              <th>Proxy</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <td>{row.orNumber}</td>
                <td>{new Date(row.timestamp).toLocaleString("en-PH")}</td>
                <td>{row.customerName}</td>
                <td>{row.idNumber}</td>
                <td>{row.discountType.toUpperCase()}</td>
                <td>{formatPeso(row.grossAmount)}</td>
                <td>{formatPeso(row.scPwdDiscountAmount)}</td>
                <td>{formatPeso(row.vatRemoved)}</td>
                <td>{formatPeso(row.netAmount)}</td>
                <td>{row.proxyPurchase ? "Yes" : "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
                  No SC/PWD transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
