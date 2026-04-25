"use client";

import { useMemo } from "react";
import type { Product, RxSettings } from "@/lib/types";

type Props = {
  products: Product[];
  settings: RxSettings;
};

export function DdStockReconciliationPanel({ products, settings }: Props) {
  const rows = useMemo(
    () => products.filter((item) => item.drugClassification === "DD, Rx" || item.drugClassification === "EDD, Rx"),
    [products]
  );

  return (
    <section className="panel data-panel">
      <h2>DD Inventory Control (RX-31 to RX-33)</h2>
      <p className="retention-notice">
        DD/EDD low-stock threshold: {settings.ddEddLowStockThreshold} units
      </p>
      <table className="audit-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Class</th>
            <th>Current Qty</th>
            <th>Last Reconciliation</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.drugClassification}</td>
              <td>{row.quantity}</td>
              <td>{row.ddLastReconciliationAt ? new Date(row.ddLastReconciliationAt).toLocaleString() : "Not reconciled"}</td>
              <td>
                <button type="button">Reconcile Count</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="empty">No DD/EDD products in catalog yet.</p> : null}
    </section>
  );
}
