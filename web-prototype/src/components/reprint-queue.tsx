"use client";

import { useState } from "react";
import type { ReprintQueueItemStatus } from "@/lib/types";

type ReprintQueueProps = {
  onClose?: () => void;
};

type QueueRow = {
  orNumber: string;
  date: string;
  status: ReprintQueueItemStatus;
  failureReason: string;
};

const initialRows: QueueRow[] = [
  { orNumber: "OR#49920", date: "04/25/2026 14:30", status: "pending", failureReason: "" },
  { orNumber: "OR#49919", date: "04/25/2026 14:12", status: "printed", failureReason: "" },
  { orNumber: "OR#49918", date: "04/25/2026 13:55", status: "failed", failureReason: "Printer offline" },
  { orNumber: "OR#49917", date: "04/25/2026 13:40", status: "pending", failureReason: "" },
  { orNumber: "OR#49916", date: "04/25/2026 13:22", status: "printed", failureReason: "" },
];

export function ReprintQueue({ onClose }: ReprintQueueProps) {
  const [rows] = useState<QueueRow[]>(initialRows);

  const pendingCount = rows.filter(
    (r) => r.status === "pending" || r.status === "failed"
  ).length;

  return (
    <div className="reprint-queue">
      <div className="reprint-queue-header">
        <h2>
          Reprint Queue{" "}
          <span className="reprint-queue-badge">{pendingCount}</span>
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="primary" style={{ fontSize: 13, padding: "6px 14px" }}>
            Print All Pending
          </button>
          {onClose && (
            <button onClick={onClose} style={{ fontSize: 13, padding: "6px 14px" }}>
              ✕
            </button>
          )}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>OR #</th>
            <th>Date</th>
            <th>Status</th>
            <th>Failure Reason</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.orNumber} className={row.status === "printed" ? "printed" : ""}>
              <td>{row.orNumber}</td>
              <td>{row.date}</td>
              <td>
                <span className={`reprint-status ${row.status}`}>
                  {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                </span>
              </td>
              <td style={{ color: row.failureReason ? "var(--danger)" : "var(--muted)", fontSize: 12 }}>
                {row.failureReason || "—"}
              </td>
              <td>
                {(row.status === "pending" || row.status === "failed") && (
                  <button style={{ fontSize: 12, padding: "4px 10px", minHeight: 28 }}>
                    Print
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="reprint-queue-notice">
        ⏱ Queued jobs expire after 5 minutes
      </div>
      <div className="reprint-queue-notice">
        🧹 Printed items auto-clear from queue
      </div>
    </div>
  );
}
