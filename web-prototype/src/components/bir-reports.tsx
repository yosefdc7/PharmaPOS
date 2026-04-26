"use client";
import { useState, useMemo } from "react";
import type { PermissionKey, ScPwdAlert, ScPwdTransactionLogRow, ScPwdSummaryCard, User } from "@/lib/types";
import { XReadingReport } from "./x-reading";
import { ZReadingReport } from "./z-reading";
import { EJournalExport } from "./ejournal-export";
import { ESalesReport } from "./esales-report";
import { ScpwdTransactionLog } from "./scpwd-transaction-log";
import { ScpwdSummaryCardComponent } from "./scpwd-summary-card";

type BirReportTab = "x-reading" | "z-reading" | "ejournal" | "esales" | "sc-pwd";

const allTabs: { key: BirReportTab; label: string; requiredPermission?: PermissionKey }[] = [
  { key: "x-reading", label: "X-Reading", requiredPermission: "xReading" },
  { key: "z-reading", label: "Z-Reading", requiredPermission: "zReadingView" },
  { key: "ejournal", label: "eJournal", requiredPermission: "reports" },
  { key: "esales", label: "eSales", requiredPermission: "reports" },
  { key: "sc-pwd", label: "SC/PWD" },
];

function formatPeso(n: number): string {
  return "₱" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function ScPwdAlertsPanel({ alerts }: { alerts: ScPwdAlert[] }) {
  const unacknowledged = alerts.filter((a) => !a.acknowledged);
  return (
    <div className="panel">
      <h4>Alerts</h4>
      {unacknowledged.length === 0 ? (
        <p className="empty">No active SC/PWD alerts.</p>
      ) : (
        unacknowledged.map((alert) => (
          <div key={alert.id} className={`alert-banner ${alert.severity}`}>
            <span>{alert.message}</span>
          </div>
        ))
      )}
    </div>
  );
}

function ScPwdDeductiblesCard({ summary }: { summary: ScPwdSummaryCard }) {
  return (
    <div className="panel">
      <h4>Deductibles</h4>
      <div className="reports-grid">
        <article className="metric"><span>SC Discount</span><strong>{formatPeso(summary.totalScDiscount)}</strong></article>
        <article className="metric"><span>PWD Discount</span><strong>{formatPeso(summary.totalPwdDiscount)}</strong></article>
        <article className="metric"><span>VAT Removed</span><strong>{formatPeso(summary.totalVatRemoved)}</strong></article>
        <article className="metric"><span>Total Deductibles</span><strong>{formatPeso(summary.totalDeductibles)}</strong></article>
      </div>
    </div>
  );
}

type BirReportsPanelProps = {
  scPwdTransactionLog?: ScPwdTransactionLogRow[];
  getScPwdSummary?: () => ScPwdSummaryCard;
  scPwdAlerts?: ScPwdAlert[];
  canPerformAction?: (action: PermissionKey) => boolean;
  users?: User[];
  currentUser?: User | null;
  acknowledgeOverride?: (
    actionType: "void" | "refund" | "override" | "zReading",
    supervisorId: string,
    supervisorName: string,
    reason: string,
    targetId?: string,
  ) => Promise<import("@/lib/types").SupervisorAck>;
};

export function BirReportsPanel({
  scPwdTransactionLog = [],
  getScPwdSummary,
  scPwdAlerts = [],
  canPerformAction,
  users,
  currentUser,
  acknowledgeOverride,
}: BirReportsPanelProps) {
  const [tab, setTab] = useState<BirReportTab>("x-reading");
  const tabs = allTabs.filter((t) => {
    if (!t.requiredPermission) return true;
    return canPerformAction?.(t.requiredPermission) ?? false;
  });
  const summary = useMemo(() => getScPwdSummary?.() ?? {
    totalTransactions: 0,
    totalScTransactions: 0,
    totalPwdTransactions: 0,
    totalScDiscount: 0,
    totalPwdDiscount: 0,
    totalVatRemoved: 0,
    totalDeductibles: 0,
    month: new Date().toISOString().slice(0, 7)
  }, [getScPwdSummary]);

  return (
    <section className="bir-reports-container">
      <div className="segmented" style={{ marginBottom: 20 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "x-reading" && <XReadingReport canPerformAction={canPerformAction} />}
      {tab === "z-reading" && (
        <ZReadingReport
          canPerformAction={canPerformAction}
          users={users}
          currentUser={currentUser}
          acknowledgeOverride={acknowledgeOverride}
        />
      )}
      {tab === "ejournal" && <EJournalExport />}
      {tab === "esales" && <ESalesReport />}
      {tab === "sc-pwd" && (
        <section className="reports-grid">
          <ScpwdSummaryCardComponent summary={summary} />
          <ScPwdDeductiblesCard summary={summary} />
          <ScPwdAlertsPanel alerts={scPwdAlerts} />
          <ScpwdTransactionLog rows={scPwdTransactionLog} />
        </section>
      )}
    </section>
  );
}
