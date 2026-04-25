"use client";

import type { Category, PrescriptionDraft, Product, RxInspectionSnapshot, RxRedFlag, Settings, SyncQueueItem, Transaction, User } from "@/lib/types";
import { useDashboardStats } from "@/lib/use-dashboard-stats";

type ControlTowerViewProps = {
  transactions: Transaction[];
  products: Product[];
  settings: Settings | null;
  users: User[];
  syncQueue: SyncQueueItem[];
  categories: Category[];
  rxPrescriptionDrafts: PrescriptionDraft[];
  rxRedFlags: RxRedFlag[];
  rxInspectionSnapshot?: RxInspectionSnapshot;
};

function formatMoney(symbol: string, value: number): string {
  return `${symbol}${value.toFixed(2)}`;
}

function buildTrendPath(values: number[], width = 500, height = 150): string {
  if (values.length === 0) return "";
  const max = Math.max(...values, 1);
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - (value / max) * height;
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

export function ControlTowerView({
  transactions,
  products,
  settings,
  users,
  syncQueue,
  categories,
  rxPrescriptionDrafts,
  rxRedFlags,
  rxInspectionSnapshot
}: ControlTowerViewProps) {
  const stats = useDashboardStats({
    transactions,
    products,
    settings,
    users,
    syncQueue,
    categories,
    rxPrescriptionDrafts,
    rxRedFlags,
    rxInspectionSnapshot
  });

  const symbol = settings?.currencySymbol || "$";
  const trendValues = stats.trends.salesTrend.map((point) => point.net);
  const trendPath = buildTrendPath(trendValues);
  const donutStops = stats.trends.categoryMix
    .reduce<{ start: number; color: string; label: string }[]>((acc, slice, index) => {
      const start = index === 0 ? 0 : acc[index - 1].start + stats.trends.categoryMix[index - 1].share;
      acc.push({ start, color: ["#00AD1D", "#635BFF", "#0EA5E9", "#F59E0B", "#EF4444", "#14B8A6"][index % 6], label: slice.categoryName });
      return acc;
    }, [])
    .map((item, index) => {
      const end = item.start + (stats.trends.categoryMix[index]?.share || 0);
      return `${item.color} ${item.start}% ${end}%`;
    })
    .join(", ");

  return (
    <section className="control-tower-page">
      <section className="control-tower-kpis">
        <article className="panel control-kpi">
          <span>Net Sales Today</span>
          <strong>{formatMoney(symbol, stats.finance.netSalesToday)}</strong>
        </article>
        <article className="panel control-kpi">
          <span>Gross Sales Today</span>
          <strong>{formatMoney(symbol, stats.finance.grossSalesToday)}</strong>
        </article>
        <article className="panel control-kpi">
          <span>Today vs Same Day Last Week</span>
          <strong className={stats.finance.salesTodayVsLastWeek >= 0 ? "delta-up" : "delta-down"}>
            {stats.finance.salesTodayVsLastWeek >= 0 ? "+" : ""}
            {formatMoney(symbol, stats.finance.salesTodayVsLastWeek)}
          </strong>
        </article>
        <article className="panel control-kpi">
          <span>Profit Margin</span>
          <strong>{stats.finance.profitMarginPercent === null ? "N/A" : `${stats.finance.profitMarginPercent}%`}</strong>
        </article>
      </section>

      <section className="control-tower-middle">
        <section className="panel control-chart">
          <div className="control-head">
            <h2>Sales Trend (7 Days)</h2>
            <small>Net sales</small>
          </div>
          <svg viewBox="0 0 500 150" preserveAspectRatio="none" aria-label="Sales trend line chart">
            <path d={trendPath} />
          </svg>
          <div className="control-axis">
            {stats.trends.salesTrend.map((point) => (
              <span key={point.dateKey}>{point.label}</span>
            ))}
          </div>
          <div className="control-payment-split">
            <article>
              <span>Cash</span>
              <strong>{formatMoney(symbol, stats.finance.paymentSplit.cash)}</strong>
            </article>
            <article>
              <span>E-wallet</span>
              <strong>{formatMoney(symbol, stats.finance.paymentSplit.eWallet)}</strong>
            </article>
            <article>
              <span>Card/External Terminal</span>
              <strong>{formatMoney(symbol, stats.finance.paymentSplit.cardOrExternalTerminal)}</strong>
            </article>
            <article>
              <span>VATable</span>
              <strong>{formatMoney(symbol, stats.finance.vatBreakdown.vatable)}</strong>
            </article>
            <article>
              <span>Non-VAT</span>
              <strong>{formatMoney(symbol, stats.finance.vatBreakdown.nonVatable)}</strong>
            </article>
          </div>
        </section>

        <section className="panel control-side">
          <div className="control-head">
            <h2>Category Mix (Today)</h2>
            <small>Based on local transactions</small>
          </div>
          <div className="control-donut-wrap">
            <div
              className="control-donut"
              role="img"
              aria-label="Category sales mix donut"
              style={{ background: donutStops ? `conic-gradient(${donutStops})` : "conic-gradient(#d6deeb 0 100%)" }}
            >
              <span>{stats.trends.categoryMix.length === 0 ? "0" : `${stats.trends.categoryMix.length}`}</span>
            </div>
            <div className="control-legend">
              {stats.trends.categoryMix.length === 0 ? <p className="empty">No category mix data yet.</p> : null}
              {stats.trends.categoryMix.map((slice) => (
                <article key={slice.categoryId}>
                  <strong>{slice.categoryName}</strong>
                  <span>{slice.share.toFixed(1)}%</span>
                </article>
              ))}
            </div>
          </div>

          <div className="control-inventory-grid">
            <article className="inventory-box">
              <h3>Expiry Risk</h3>
              <p>30d: {stats.inventory.expiryBuckets.within30}</p>
              <p>60d: {stats.inventory.expiryBuckets.within60}</p>
              <p>90d: {stats.inventory.expiryBuckets.within90}</p>
            </article>
            <article className="inventory-box">
              <h3>Low Stock + High Revenue</h3>
              {stats.inventory.lowStockHighRevenue.length === 0 ? <p className="empty">None</p> : null}
              {stats.inventory.lowStockHighRevenue.slice(0, 3).map((item) => (
                <p key={item.id}>{item.name} ({item.quantity})</p>
              ))}
            </article>
            <article className="inventory-box">
              <h3>Dead Stock (90d)</h3>
              {stats.inventory.deadStock90Days.length === 0 ? <p className="empty">None</p> : null}
              {stats.inventory.deadStock90Days.slice(0, 3).map((item) => (
                <p key={item.id}>{item.name} ({item.quantity})</p>
              ))}
            </article>
          </div>
        </section>
      </section>

      <section className="panel control-compliance-feed">
        <div className="control-head">
          <h2>Compliance Feed</h2>
          <small>Read-only monitoring</small>
        </div>
        <div className="control-feed-grid">
          <article>
            <span>Rx Transactions Today</span>
            <strong>{stats.compliance.rxTransactionsToday}</strong>
          </article>
          <article>
            <span>DD Transactions Today</span>
            <strong>{stats.compliance.ddTransactionsToday}</strong>
          </article>
          <article>
            <span>Missing Rx Log Alerts</span>
            <strong>{stats.compliance.missingRxLogAlerts}</strong>
          </article>
          <article>
            <span>Incomplete Prescriptions</span>
            <strong>{stats.compliance.incompletePrescriptionAlerts}</strong>
          </article>
          <article>
            <span>Previous Business Day Z-Reading</span>
            <strong>{stats.compliance.zReadingPreviousBusinessDayStatus}</strong>
          </article>
          <article>
            <span>Pending Sync Queue</span>
            <strong>{stats.meta.pendingSyncCount}</strong>
          </article>
        </div>
      </section>
    </section>
  );
}
