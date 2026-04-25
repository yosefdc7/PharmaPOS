"use client";

import { useMemo, useState } from "react";
import type { Customer, PrescriptionDraft } from "@/lib/types";

type Props = {
  drafts: PrescriptionDraft[];
  customers: Customer[];
};

export function PatientMedicationProfilePanel({ drafts, customers }: Props) {
  const [query, setQuery] = useState("");

  const customerMap = useMemo(() => Object.fromEntries(customers.map((item) => [item.id, item])), [customers]);
  const rows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return drafts.filter((item) => {
      if (!text) return true;
      const customer = customerMap[item.customerId];
      return (
        item.patientName.toLowerCase().includes(text) ||
        item.customerId.toLowerCase().includes(text) ||
        (customer?.phone || "").toLowerCase().includes(text)
      );
    });
  }, [customerMap, drafts, query]);

  return (
    <section className="panel data-panel">
      <h2>Patient Medication Profile (RX-19 to RX-22)</h2>
      <div className="audit-filter-bar">
        <label>
          Search patient / phone / customer ID
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. walk-in or +63..." />
        </label>
        <button type="button" className="primary">
          Export PDF (Date Range)
        </button>
      </div>
      <table className="audit-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Patient</th>
            <th>Drug</th>
            <th>Quantity</th>
            <th>Prescriber</th>
            <th>Dispensing Pharmacist</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.prescriptionDate}</td>
              <td>{row.patientName}</td>
              <td>{row.genericName}</td>
              <td>{row.quantityDispensed}</td>
              <td>{row.prescriberName}</td>
              <td>{row.dispensingPharmacistName}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="empty">No profile entries yet.</p> : null}
      <p className="retention-notice">Retention display policy: 10 years minimum for profile records.</p>
    </section>
  );
}
