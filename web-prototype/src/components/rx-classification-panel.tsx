"use client";

import { useMemo, useState } from "react";
import type { DrugClassification, Product } from "@/lib/types";

type Props = {
  products: Product[];
};

const classOrder: DrugClassification[] = ["DD, Rx", "EDD, Rx", "Rx", "Pharmacist-Only OTC", "Non-Rx OTC"];

export function RxClassificationPanel({ products }: Props) {
  const [csvPreview, setCsvPreview] = useState("SKU,DrugClass,GenericName,DosageStrength,FDA_CPR\nSKU-001,Rx,Paracetamol,500mg,CPR-12345");

  const grouped = useMemo(
    () =>
      classOrder.map((drugClass) => ({
        drugClass,
        count: products.filter((item) => (item.drugClassification ?? "Non-Rx OTC") === drugClass).length
      })),
    [products]
  );

  return (
    <section className="reports-grid">
      <section className="panel data-panel">
        <h2>Product Classification Setup (RX-1 to RX-6)</h2>
        <div className="rx-class-grid">
          {grouped.map((item) => (
            <article key={item.drugClass} className="metric">
              <span>{item.drugClass}</span>
              <strong>{item.count}</strong>
            </article>
          ))}
        </div>
        <p className="retention-notice">
          UI prototype note: class selection is displayed here; backend enforcement and CSV processing are roadmap.
        </p>
      </section>

      <section className="panel data-panel">
        <h2>Bulk CSV Classification (RX-6)</h2>
        <p>Upload CSV mapping SKU to drug class and supporting fields.</p>
        <textarea value={csvPreview} onChange={(event) => setCsvPreview(event.target.value)} />
        <div className="settings-actions">
          <button type="button" className="primary">
            Validate CSV
          </button>
          <button type="button">Apply Mapping</button>
        </div>
      </section>
    </section>
  );
}
