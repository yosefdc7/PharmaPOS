"use client";

import type { ScPwdSummaryCard } from "@/lib/types";

function formatPeso(n: number): string {
  return "₱" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

type ScpwdSummaryCardProps = {
  summary: ScPwdSummaryCard;
};

export function ScpwdSummaryCardComponent({ summary }: ScpwdSummaryCardProps) {
  return (
    <section className="panel scpwd-summary">
      <h3>SC/PWD Summary — {summary.month}</h3>
      <div className="reports-grid">
        <article className="metric">
          <span>Total SC/PWD Transactions</span>
          <strong>{summary.totalTransactions}</strong>
        </article>
        <article className="metric">
          <span>SC Transactions</span>
          <strong>{summary.totalScTransactions}</strong>
        </article>
        <article className="metric">
          <span>PWD Transactions</span>
          <strong>{summary.totalPwdTransactions}</strong>
        </article>
        <article className="metric">
          <span>Total SC Discount</span>
          <strong>{formatPeso(summary.totalScDiscount)}</strong>
        </article>
        <article className="metric">
          <span>Total PWD Discount</span>
          <strong>{formatPeso(summary.totalPwdDiscount)}</strong>
        </article>
        <article className="metric">
          <span>Total VAT Removed</span>
          <strong>{formatPeso(summary.totalVatRemoved)}</strong>
        </article>
        <article className="metric">
          <span>Total Deductibles</span>
          <strong>{formatPeso(summary.totalDeductibles)}</strong>
        </article>
      </div>
    </section>
  );
}
