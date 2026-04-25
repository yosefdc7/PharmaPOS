"use client";

import type { PrescriptionRefusal, RxRedFlag } from "@/lib/types";

type Props = {
  flags: RxRedFlag[];
  refusals: PrescriptionRefusal[];
  onClearFlag: (id: string) => void;
};

export function RxRedFlagPanel({ flags, refusals, onClearFlag }: Props) {
  return (
    <section className="reports-grid">
      <section className="panel data-panel">
        <h2>Prescription Red Flags (RX-28 to RX-30)</h2>
        {flags.length === 0 ? <p className="empty">No active warnings.</p> : null}
        {flags.map((flag) => (
          <article key={flag.id} className={`validation-result ${flag.severity === "critical" ? "fail" : "pass"}`}>
            <div>
              <strong>{flag.title}</strong>
              <p>{flag.reason}</p>
            </div>
            <button type="button" onClick={() => onClearFlag(flag.id)}>
              Dismiss
            </button>
          </article>
        ))}
      </section>

      <section className="panel data-panel">
        <h2>Prescription Refusals (RX-29)</h2>
        <table className="audit-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Pharmacist</th>
              <th>Patient</th>
              <th>Product</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {refusals.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>{row.pharmacistName}</td>
                <td>{row.patientName}</td>
                <td>{row.productName}</td>
                <td>{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {refusals.length === 0 ? <p className="empty">No refusal records yet.</p> : null}
      </section>
    </section>
  );
}
