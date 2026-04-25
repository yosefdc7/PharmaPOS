"use client";

import { useState, useMemo } from "react";
import type { AuditEntry, AuditActionType, PrinterActivityLog } from "@/lib/types";

const mockAuditLog: AuditEntry[] = [
  { id: "a1", action: "z-reading", user: "Maria Santos", timestamp: "2026-04-25T22:00:00", details: "Z-Reading generated for 2026-04-25", requiredRole: "admin" },
  { id: "a2", action: "x-reading", user: "Maria Santos", timestamp: "2026-04-25T14:30:00", details: "X-Reading snapshot taken", requiredRole: "cashier" },
  { id: "a3", action: "void", user: "Juan Cruz", timestamp: "2026-04-25T13:15:00", details: "Voided OR #49918 - Customer cancellation", requiredRole: "supervisor" },
  { id: "a4", action: "reprint", user: "Maria Santos", timestamp: "2026-04-25T12:45:00", details: "Reprinted OR #49915", requiredRole: "cashier" },
  { id: "a5", action: "login", user: "Maria Santos", timestamp: "2026-04-25T08:00:00", details: "User logged in", requiredRole: "cashier" },
  { id: "a6", action: "ejournal-export", user: "Admin", timestamp: "2026-04-24T23:00:00", details: "eJournal exported for 04/24/2026", requiredRole: "admin" },
  { id: "a7", action: "esales-export", user: "Admin", timestamp: "2026-04-24T23:05:00", details: "eSales report generated for March 2026", requiredRole: "admin" },
  { id: "a8", action: "z-reading", user: "Juan Cruz", timestamp: "2026-04-24T21:45:00", details: "Z-Reading generated for 2026-04-24", requiredRole: "admin" },
  { id: "a9", action: "settings-change", user: "Admin", timestamp: "2026-04-24T09:30:00", details: "Updated BIR accreditation number", requiredRole: "admin" },
  { id: "a10", action: "x-reading", user: "Juan Cruz", timestamp: "2026-04-24T15:00:00", details: "X-Reading snapshot taken", requiredRole: "cashier" },
  { id: "a11", action: "logout", user: "Maria Santos", timestamp: "2026-04-24T22:30:00", details: "User logged out", requiredRole: "cashier" },
  { id: "a12", action: "void", user: "Juan Cruz", timestamp: "2026-04-23T16:20:00", details: "Voided OR #49810 - Wrong item scanned", requiredRole: "supervisor" },
  { id: "a13", action: "scpwd-apply", user: "Maria Santos", timestamp: "2026-04-25T10:15:00", details: "Applied SC discount — ID: SC-2024-001234, Customer: Juan dela Cruz", requiredRole: "cashier" },
  { id: "a14", action: "scpwd-override", user: "Juan Cruz", timestamp: "2026-04-25T10:20:00", details: "Supervisor override removed SC discount — Reason: ID mismatch", requiredRole: "supervisor" },
  { id: "a15", action: "scpwd-remove", user: "Maria Santos", timestamp: "2026-04-25T11:05:00", details: "Removed SC discount from current cart", requiredRole: "cashier" },
];

const mockPrinterLog: PrinterActivityLog[] = [
  { id: "p1", orNumber: 49920, jobType: "receipt", timestamp: "2026-04-25T14:32:00", printerUsed: "Counter 1 Printer", status: "success" },
  { id: "p2", orNumber: 49919, jobType: "receipt", timestamp: "2026-04-25T14:28:00", printerUsed: "Counter 1 Printer", status: "success" },
  { id: "p3", orNumber: 49918, jobType: "void-receipt", timestamp: "2026-04-25T13:16:00", printerUsed: "Counter 1 Printer", status: "success" },
  { id: "p4", jobType: "x-reading", timestamp: "2026-04-25T14:30:00", printerUsed: "Report Printer", status: "failed", failureReason: "Printer offline" },
  { id: "p5", orNumber: 49917, jobType: "receipt", timestamp: "2026-04-25T12:50:00", printerUsed: "Counter 1 Printer", status: "failed", failureReason: "Paper jam" },
  { id: "p6", orNumber: 49915, jobType: "reprint", timestamp: "2026-04-25T12:45:00", printerUsed: "Counter 1 Printer", status: "success" },
  { id: "p7", jobType: "z-reading", timestamp: "2026-04-24T21:46:00", printerUsed: "Report Printer", status: "success" },
  { id: "p8", jobType: "daily-summary", timestamp: "2026-04-24T22:00:00", printerUsed: "Report Printer", status: "success" },
];

const ACTION_OPTIONS: { value: AuditActionType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "x-reading", label: "X-Reading" },
  { value: "z-reading", label: "Z-Reading" },
  { value: "ejournal-export", label: "eJournal Export" },
  { value: "esales-export", label: "eSales Export" },
  { value: "void", label: "Void" },
  { value: "reprint", label: "Reprint" },
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
  { value: "settings-change", label: "Settings Change" },
  { value: "scpwd-apply", label: "SC/PWD Apply" },
  { value: "scpwd-remove", label: "SC/PWD Remove" },
  { value: "scpwd-override", label: "SC/PWD Override" },
];

const USER_OPTIONS = ["All", "Maria Santos", "Juan Cruz", "Admin"];

const ACTION_LABELS: Record<AuditActionType, string> = {
  "x-reading": "X-Reading",
  "z-reading": "Z-Reading",
  "ejournal-export": "eJournal Export",
  "esales-export": "eSales Export",
  "void": "Void",
  "reprint": "Reprint",
  "login": "Login",
  "logout": "Logout",
  "settings-change": "Settings Change",
  "print-job": "Print Job",
  "scpwd-apply": "SC/PWD Apply",
  "scpwd-remove": "SC/PWD Remove",
  "scpwd-override": "SC/PWD Override",
};

const JOB_TYPE_LABELS: Record<PrinterActivityLog["jobType"], string> = {
  "receipt": "Receipt",
  "x-reading": "X-Reading",
  "z-reading": "Z-Reading",
  "daily-summary": "Daily Summary",
  "void-receipt": "Void Receipt",
  "reprint": "Reprint",
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function AuditTrailPanel() {
  // Z-Reading alert
  const [showZAlert, setShowZAlert] = useState<boolean>(true);

  // Sub-tab
  const [activeTab, setActiveTab] = useState<"audit" | "printer">("audit");

  // Audit log filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actionFilter, setActionFilter] = useState<AuditActionType | "all">("all");
  const [userFilter, setUserFilter] = useState("All");

  const filteredAuditLog = useMemo(() => {
    return mockAuditLog.filter((entry) => {
      if (actionFilter !== "all" && entry.action !== actionFilter) return false;
      if (userFilter !== "All" && entry.user !== userFilter) return false;
      if (dateFrom) {
        const entryDate = entry.timestamp.slice(0, 10);
        if (entryDate < dateFrom) return false;
      }
      if (dateTo) {
        const entryDate = entry.timestamp.slice(0, 10);
        if (entryDate > dateTo) return false;
      }
      return true;
    });
  }, [actionFilter, userFilter, dateFrom, dateTo]);

  return (
    <section className="panel" style={{ display: "grid", gap: 14 }}>
      {/* Z-Reading Missed Alert */}
      {showZAlert && (
        <div className="zreading-alert-banner">
          <span>⚠ Z-Reading has not been generated today. Cutoff: 11:59 PM</span>
          <button
            className="dismiss-btn"
            onClick={() => setShowZAlert(false)}
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        </div>
      )}

      {/* Sub-tab navigation */}
      <div className="segmented" style={{ maxWidth: 320 }}>
        <button
          className={activeTab === "audit" ? "active" : ""}
          onClick={() => setActiveTab("audit")}
        >
          Audit Log
        </button>
        <button
          className={activeTab === "printer" ? "active" : ""}
          onClick={() => setActiveTab("printer")}
        >
          Printer Activity
        </button>
      </div>

      {/* Audit Log Tab */}
      {activeTab === "audit" && (
        <>
          {/* Filter bar */}
          <div className="audit-filter-bar">
            <label>
              From
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
            <label>
              Action Type
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as AuditActionType | "all")}
              >
                {ACTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              User
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
              >
                {USER_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="primary"
              onClick={() => {
                /* filters are already reactive via useMemo */
              }}
            >
              Apply Filter
            </button>
          </div>

          {/* Audit table */}
          <div style={{ overflowX: "auto" }}>
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Date/Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>Required Role</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditLog.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatTimestamp(entry.timestamp)}</td>
                    <td>{entry.user}</td>
                    <td>
                      <span className={`audit-action-badge ${entry.action}`}>
                        {ACTION_LABELS[entry.action]}
                      </span>
                    </td>
                    <td>{entry.details}</td>
                    <td>
                      <span className={`role-indicator ${entry.requiredRole}`}>
                        {entry.requiredRole.charAt(0).toUpperCase() + entry.requiredRole.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredAuditLog.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
                      No audit entries match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Printer Activity Tab */}
      {activeTab === "printer" && (
        <div style={{ overflowX: "auto" }}>
          <table className="printer-log-table">
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>Job Type</th>
                <th>OR#</th>
                <th>Printer</th>
                <th>Status</th>
                <th>Failure Reason</th>
              </tr>
            </thead>
            <tbody>
              {mockPrinterLog.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatTimestamp(entry.timestamp)}</td>
                  <td>
                    <span className="job-type-label">
                      {JOB_TYPE_LABELS[entry.jobType]}
                    </span>
                  </td>
                  <td>{entry.orNumber ?? "—"}</td>
                  <td>{entry.printerUsed}</td>
                  <td>
                    <span className={`print-status-badge ${entry.status}`}>
                      {entry.status === "success" ? "Success" : "Failed"}
                    </span>
                  </td>
                  <td style={{ color: entry.failureReason ? "var(--danger)" : "var(--muted)" }}>
                    {entry.failureReason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
