"use client";

import { useMemo } from "react";
import type { PrescriptionDraft } from "@/lib/types";

type Props = {
  drafts: PrescriptionDraft[];
};

export function DdTransactionLogPanel({ drafts }: Props) {
  const rows = useMemo(
    () =>
      drafts
        .filter((item) => item.classAtDispense === "DD, Rx" || item.classAtDispense === "EDD, Rx")
        .map((item, index) => ({
          id: item.id,
          entryNumber: index + 1,
          createdAt: item.createdAt,
          patientName: item.patientName,
          productName: item.genericName,
          dosageStrength: item.dosageStrength,
          quantityDispensed: item.quantityDispensed,
          yellowRxReference: item.yellowRxReference || "N/A",
          s2Reference: item.prescriberS2Number || "N/A",
          prescriberName: item.prescriberName,
          dispensingPharmacist: item.dispensingPharmacistName
        })),
    [drafts]
  );

  return (
    <section className="panel data-panel">
      <h2>Dangerous Drugs Book (RX-23 to RX-27)</h2>
      <div className="settings-actions">
        <button type="button" className="primary">
          Export DD Register (PDF)
        </button>
        <button type="button">Export DD Register (CSV)</button>
      </div>
      <table className="audit-table">
        <thead>
          <tr>
            <th>Entry #</th>
            <th>Date/Time</th>
            <th>Patient</th>
            <th>Drug</th>
            <th>Qty Out</th>
            <th>Yellow Rx</th>
            <th>S-2</th>
            <th>Prescriber</th>
            <th>Dispensing Pharmacist</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.entryNumber}</td>
              <td>{new Date(row.createdAt).toLocaleString()}</td>
              <td>{row.patientName}</td>
              <td>{row.productName} {row.dosageStrength}</td>
              <td>{row.quantityDispensed}</td>
              <td>{row.yellowRxReference}</td>
              <td>{row.s2Reference}</td>
              <td>{row.prescriberName}</td>
              <td>{row.dispensingPharmacist}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="empty">No DD/EDD dispensing entries yet.</p> : null}
    </section>
  );
}
