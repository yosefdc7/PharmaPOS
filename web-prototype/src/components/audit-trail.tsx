"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { getAll, putOne } from "../lib/db";
import type { AuditEntry, AuditActionType, PrinterActivityLog, User } from "@/lib/types";

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

export async function logAuditEvent(
  action: AuditActionType,
  user: string,
  details: string,
  requiredRole: AuditEntry["requiredRole"] = "cashier",
  reportType?: string
): Promise<void> {
  const entry: AuditEntry = {
    id: crypto.randomUUID(),
    action,
    user,
    timestamp: new Date().toISOString(),
    details,
    reportType,
    requiredRole,
  };
  await putOne("auditLog", entry);
}

export async function logPrinterActivity(
  log: Omit<PrinterActivityLog, "id">
): Promise<void> {
  await putOne("printerActivity", { ...log, id: crypto.randomUUID() });
}

export function AuditTrailPanel({ users }: { users?: User[] }) {
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [printerLog, setPrinterLog] = useState<PrinterActivityLog[]>([]);
  const [loaded, setLoaded] = useState(false);

  const userOptions = useMemo(() => {
    const names = users?.map((u) => u.fullname) ?? [];
    return ["All", ...names];
  }, [users]);

  const refresh = useCallback(async () => {
    const [logs, printerEntries] = await Promise.all([
      getAll("auditLog") as Promise<AuditEntry[]>,
      getAll("printerActivity") as Promise<PrinterActivityLog[]>,
    ]);
    // Sort by timestamp descending and cap to prevent memory bloat on long-running terminals
    const MAX_AUDIT_ENTRIES = 500;
    setAuditLog(logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, MAX_AUDIT_ENTRIES));
    setPrinterLog(printerEntries.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, MAX_AUDIT_ENTRIES));
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Z-Reading alert
  const [showZAlert, setShowZAlert] = useState<boolean>(false);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const hasZToday = auditLog.some(
      (e) => e.action === "z-reading" && e.timestamp.startsWith(today)
    );
    setShowZAlert(!hasZToday && loaded);
  }, [auditLog, loaded]);

  // Sub-tab
  const [activeTab, setActiveTab] = useState<"audit" | "printer">("audit");

  // Audit log filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actionFilter, setActionFilter] = useState<AuditActionType | "all">("all");
  const [userFilter, setUserFilter] = useState("All");

  const filteredAuditLog = useMemo(() => {
    return auditLog.filter((entry) => {
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
  }, [auditLog, actionFilter, userFilter, dateFrom, dateTo]);

  return (
    <section className="panel" style={{ display: "grid", gap: 14 }}>
      {/* Z-Reading Missed Alert */}
      {showZAlert && (
        <div className="zreading-alert-banner">
          <span>Z-Reading has not been generated today. Cutoff: 11:59 PM</span>
          <button
            className="dismiss-btn"
            onClick={() => setShowZAlert(false)}
            aria-label="Dismiss alert"
          >
            x
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
                {userOptions.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary" onClick={refresh}>
              Refresh
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
                {!loaded && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
                      Loading audit entries...
                    </td>
                  </tr>
                )}
                {loaded && filteredAuditLog.map((entry) => (
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
                {loaded && filteredAuditLog.length === 0 && (
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
              {!loaded && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
                    Loading printer activity...
                  </td>
                </tr>
              )}
              {loaded && printerLog.map((entry) => (
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
              {loaded && printerLog.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
                    No printer activity recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
