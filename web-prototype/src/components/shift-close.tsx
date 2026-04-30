"use client";

import { useEffect, useMemo, useState } from "react";
import { getAll, putOne } from "@/lib/db";
import { OverrideModal } from "./override-modal";
import type { PermissionKey, Settings, ShiftClosure, Transaction, User } from "@/lib/types";

const peso = (n: number) => `₱${n.toFixed(2)}`;

export function ShiftClosePanel({ settings, users = [], currentUser, canPerformAction, acknowledgeOverride }: {
  settings: Settings;
  users?: User[];
  currentUser?: User | null;
  canPerformAction?: (action: PermissionKey) => boolean;
  acknowledgeOverride?: (
    actionType: "void" | "refund" | "override" | "zReading",
    supervisorId: string,
    supervisorName: string,
    reason: string,
    targetId?: string,
  ) => Promise<import("@/lib/types").SupervisorAck>;
}) {
  const [openingFloat, setOpeningFloat] = useState("0");
  const [paidOuts, setPaidOuts] = useState("0");
  const [actualCash, setActualCash] = useState("");
  const [varianceReason, setVarianceReason] = useState("");
  const [cashSales, setCashSales] = useState(0);
  const [cashRefunds, setCashRefunds] = useState(0);
  const [history, setHistory] = useState<ShiftClosure[]>([]);
  const [requireSupervisor, setRequireSupervisor] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<Omit<ShiftClosure, "id"> | null>(null);

  const threshold = settings.varianceSupervisorThreshold ?? 100;
  const supervisors = users.filter((u) => u.role === "admin" || u.role === "supervisor").filter((u) => u.id !== currentUser?.id);

  useEffect(() => {
    (async () => {
      const txs = await getAll("transactions") as Transaction[];
      const closures = await getAll("shiftClosures") as ShiftClosure[];
      setCashSales(txs.filter((t) => t.paymentMethod === "cash" && t.paymentStatus === "paid").reduce((s, t) => s + t.total, 0));
      setCashRefunds(txs.filter((t) => t.paymentMethod === "cash" && t.paymentStatus === "refunded").reduce((s, t) => s + t.total, 0));
      setHistory(closures.sort((a, b) => b.closed_at.localeCompare(a.closed_at)).slice(0, 10));
    })();
  }, []);

  const expected = useMemo(() => {
    const opening = Number(openingFloat || 0);
    const paid = Number(paidOuts || 0);
    return opening + cashSales - (cashRefunds + paid);
  }, [openingFloat, paidOuts, cashSales, cashRefunds]);

  const variance = Number(actualCash || 0) - expected;
  const hasVariance = Math.abs(variance) > 0.0001;

  async function saveClose(payload: Omit<ShiftClosure, "id">) {
    await putOne("shiftClosures", { id: crypto.randomUUID(), ...payload });
    const closures = await getAll("shiftClosures") as ShiftClosure[];
    setHistory(closures.sort((a, b) => b.closed_at.localeCompare(a.closed_at)).slice(0, 10));
    setActualCash("");
    setVarianceReason("");
    setPendingPayload(null);
    setRequireSupervisor(false);
  }

  async function submit() {
    if (!currentUser) return;
    if (!actualCash) return;
    if (hasVariance && !varianceReason.trim()) return;
    const payload: Omit<ShiftClosure, "id"> = {
      expected_cash: expected,
      actual_cash: Number(actualCash),
      variance,
      variance_reason: varianceReason.trim(),
      closed_by: currentUser.fullname,
      closed_at: new Date().toISOString(),
      opening_float: Number(openingFloat || 0),
      cash_sales: cashSales,
      cash_refunds_paid_outs: cashRefunds + Number(paidOuts || 0),
    };
    if (Math.abs(variance) > threshold) {
      setPendingPayload(payload);
      setRequireSupervisor(true);
      return;
    }
    await saveClose(payload);
  }

  if (!canPerformAction?.("reports")) return null;

  return <section className="panel">
    <h3>Shift Close</h3>
    <p>Expected Cash = opening float + cash sales - cash refunds/paid-outs</p>
    <div className="form-grid" style={{ marginTop: 12 }}>
      <label>Opening float<input type="number" step="0.01" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} /></label>
      <label>Cash sales<input type="number" value={cashSales.toFixed(2)} readOnly /></label>
      <label>Cash refunds<input type="number" value={cashRefunds.toFixed(2)} readOnly /></label>
      <label>Paid-outs<input type="number" step="0.01" value={paidOuts} onChange={(e) => setPaidOuts(e.target.value)} /></label>
      <label>Expected cash<input type="number" value={expected.toFixed(2)} readOnly /></label>
      <label>Actual counted cash<input type="number" step="0.01" value={actualCash} onChange={(e) => setActualCash(e.target.value)} /></label>
    </div>
    <div style={{ marginTop: 12, color: hasVariance ? "#dc2626" : "#166534", fontWeight: 700 }}>
      Variance: {peso(variance)} {hasVariance ? "(Warning: non-zero variance)" : ""}
    </div>
    {hasVariance && <label style={{ display: "block", marginTop: 8 }}>Variance reason
      <textarea value={varianceReason} onChange={(e) => setVarianceReason(e.target.value)} placeholder="Explain the cash variance" />
    </label>}
    <button className="primary" style={{ marginTop: 12 }} onClick={submit}>
      Close Shift
    </button>
    <p style={{ marginTop: 8, fontSize: 12 }}>Supervisor acknowledgment is required when |variance| exceeds {peso(threshold)}.</p>

    {requireSupervisor && pendingPayload && (
      <OverrideModal
        actionType="override"
        actionLabel="Shift-close variance acknowledgment"
        supervisors={supervisors}
        onConfirm={async (supervisorId, supervisorName, reason) => {
          if (acknowledgeOverride) {
            await acknowledgeOverride("override", supervisorId, supervisorName, reason, "shift-close");
          }
          await saveClose({ ...pendingPayload, supervisor_acknowledged: true, supervisor_id: supervisorId, supervisor_name: supervisorName });
        }}
        onCancel={() => {
          setRequireSupervisor(false);
          setPendingPayload(null);
        }}
      />
    )}

    <div style={{ marginTop: 16 }}>
      <h4>Recent shift closes</h4>
      {history.length === 0 ? <p className="empty">No shift-close entries yet.</p> : history.map((item) => (
        <article key={item.id} className="metric" style={{ marginBottom: 8 }}>
          <span>{new Date(item.closed_at).toLocaleString()} - {item.closed_by}</span>
          <strong>{peso(item.variance)}</strong>
        </article>
      ))}
    </div>
  </section>;
}
