"use client";

import { useState, useEffect } from "react";
import type { ReprintQueueItem, ReprintQueueItemStatus } from "@/lib/types";
import { getAllJobs, markJobStatus, clearPrintedJobs } from "@/lib/printer/print-queue";
import { PrinterService, createPrinterBackend, buildReceipt } from "@/lib/printer";
import { getOne } from "@/lib/db";
import { logPrinterActivity } from "./audit-trail";

type ReprintQueueProps = {
  onClose?: () => void;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-PH", {
    month: "2-digit", day: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

export function ReprintQueue({ onClose }: ReprintQueueProps) {
  const [jobs, setJobs] = useState<ReprintQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const all = await getAllJobs();
    setJobs(all);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const pending = jobs.filter((j) => j.status === "pending" || j.status === "failed");

  async function printJob(job: ReprintQueueItem) {
    const profilesRaw = await getAllJobs();
    const profile = (await getOne("printerProfiles", job.transactionId)) ?? undefined;
    if (!profile) {
      await markJobStatus(job.id, "failed", "Printer profile not found");
      await load();
      return;
    }
    const service = new PrinterService(createPrinterBackend);
    const connectResult = await service.connect(profile);
    if (connectResult.status !== "success") {
      await markJobStatus(job.id, "failed", `Connection: ${connectResult.status}`);
      await logPrinterActivity({
        jobType: "reprint",
        timestamp: new Date().toISOString(),
        printerUsed: profile.label,
        status: "failed",
        failureReason: connectResult.status,
      });
      await service.disconnect();
      await load();
      return;
    }

    const transaction = await getOne("transactions", job.transactionId);
    if (!transaction) {
      await markJobStatus(job.id, "failed", "Transaction not found");
      await service.disconnect();
      await load();
      return;
    }

    const commands = buildReceipt("normal", profile, undefined, transaction);
    const printResult = await service.print(commands);
    await service.disconnect();

    if (printResult.status === "success") {
      await markJobStatus(job.id, "printed");
      await logPrinterActivity({
        jobType: "reprint",
        timestamp: new Date().toISOString(),
        printerUsed: profile.label,
        status: "success",
      });
    } else {
      await markJobStatus(job.id, "failed", printResult.status === "error" || printResult.status === "offline" || printResult.status === "paper-low" ? printResult.status : "unknown");
      await logPrinterActivity({
        jobType: "reprint",
        timestamp: new Date().toISOString(),
        printerUsed: profile.label,
        status: "failed",
        failureReason: printResult.status,
      });
    }
    await load();
  }

  async function printAllPending() {
    for (const job of pending) {
      await printJob(job);
    }
    await clearPrintedJobs();
    await load();
  }

  return (
    <div className="reprint-queue">
      <div className="reprint-queue-header">
        <h2>
          Reprint Queue{" "}
          <span className="reprint-queue-badge">{pending.length}</span>
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="primary" style={{ fontSize: 13, padding: "6px 14px" }} onClick={printAllPending} disabled={pending.length === 0}>
            Print All Pending
          </button>
          {onClose && (
            <button onClick={onClose} style={{ fontSize: 13, padding: "6px 14px" }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p style={{ color: "var(--muted)", textAlign: "center" }}>Loading queue…</p>
      ) : jobs.length === 0 ? (
        <p style={{ color: "var(--muted)", textAlign: "center" }}>No print jobs in queue.</p>
      ) : (
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
            {jobs.map((job) => (
              <tr key={job.id} className={job.status === "printed" ? "printed" : ""}>
                <td>OR#{job.orNumber}</td>
                <td>{formatDate(job.createdAt)}</td>
                <td>
                  <span className={`reprint-status ${job.status}`}>
                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  </span>
                </td>
                <td style={{ color: job.failureReason ? "var(--danger)" : "var(--muted)", fontSize: 12 }}>
                  {job.failureReason || "—"}
                </td>
                <td>
                  {(job.status === "pending" || job.status === "failed") && (
                    <button style={{ fontSize: 12, padding: "4px 10px", minHeight: 28 }} onClick={() => printJob(job)}>
                      Print
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="reprint-queue-notice">
        ⏱ Queued jobs expire after 5 minutes
      </div>
      <div className="reprint-queue-notice">
        🧹 Printed items auto-clear from queue
      </div>
    </div>
  );
}
