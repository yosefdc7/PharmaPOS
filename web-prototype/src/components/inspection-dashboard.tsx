"use client";

import type { RxInspectionSnapshot, RxRedFlag } from "@/lib/types";

type Props = {
  inspection: RxInspectionSnapshot;
  redFlags: RxRedFlag[];
  blockedCount: number;
};

export function InspectionDashboardPanel({ inspection, redFlags, blockedCount }: Props) {
  return (
    <section className="reports-grid">
      <section className="panel data-panel">
        <h2>Inspection Dashboard (RX-34 to RX-37)</h2>
        <article className="metric"><span>Total Rx transactions today</span><strong>{inspection.totalRxTransactionsToday}</strong></article>
        <article className="metric"><span>Total DD/EDD transactions today</span><strong>{inspection.totalDdEddTransactionsToday}</strong></article>
        <article className="metric"><span>Open partial fills</span><strong>{inspection.openPartialFills}</strong></article>
        <article className="metric"><span>Prescription red flags today</span><strong>{inspection.redFlagsToday}</strong></article>
        <article className="metric"><span>Blocked checkout lines</span><strong>{blockedCount}</strong></article>
      </section>
      <section className="panel data-panel">
        <h2>Role Gating and Audit Readiness</h2>
        <p>Prescription entry and DD log access are pharmacist/admin only in this UI workflow.</p>
        <table className="audit-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Flag</th>
              <th>Severity</th>
            </tr>
          </thead>
          <tbody>
            {redFlags.map((flag) => (
              <tr key={flag.id}>
                <td>{new Date(flag.createdAt).toLocaleString()}</td>
                <td>{flag.title}</td>
                <td>{flag.severity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {redFlags.length === 0 ? <p className="empty">No inspection warnings.</p> : null}
      </section>
    </section>
  );
}
