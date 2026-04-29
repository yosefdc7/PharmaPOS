"use client";

import { useState } from "react";
import type { SupervisorAck, User } from "@/lib/types";

type OverrideModalProps = {
  actionType: SupervisorAck["actionType"];
  actionLabel: string;
  targetId?: string;
  supervisors: User[];
  onConfirm: (supervisorId: string, supervisorName: string, reason: string) => void;
  onCancel: () => void;
};

export function OverrideModal({ actionType, actionLabel, targetId, supervisors, onConfirm, onCancel }: OverrideModalProps) {
  const [selectedSupervisor, setSelectedSupervisor] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  function handleSubmit() {
    if (!selectedSupervisor) {
      setError("Select a supervisor to authorize this action.");
      return;
    }
    if (!reason.trim()) {
      setError("Provide a reason for this override.");
      return;
    }
    const supervisor = supervisors.find((s) => s.id === selectedSupervisor);
    if (!supervisor) {
      setError("Selected supervisor not found.");
      return;
    }
    onConfirm(supervisor.id, supervisor.fullname, reason.trim());
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
    }}>
      <div style={{
        background: "#fff", borderRadius: "12px", padding: "1.5rem",
        maxWidth: "420px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: "0.5rem", color: "#111827" }}>
          Supervisor Authorization Required
        </h2>
        <p style={{ color: "#6b7280", marginBottom: "1rem", fontSize: "0.875rem" }}>
          This {actionLabel} action requires supervisor approval.
        </p>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#374151" }}>Supervisor</span>
          <select
            value={selectedSupervisor}
            onChange={(e) => { setSelectedSupervisor(e.target.value); setError(""); }}
            style={{
              width: "100%", marginTop: "0.25rem", padding: "0.5rem",
              border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.875rem",
            }}
          >
            <option value="">Select supervisor...</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>{s.fullname} ({s.role})</option>
            ))}
          </select>
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#374151" }}>Reason</span>
          <textarea
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(""); }}
            rows={3}
            style={{
              width: "100%", marginTop: "0.25rem", padding: "0.5rem",
              border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.875rem",
              resize: "vertical",
            }}
            placeholder="Why is this override needed?"
          />
        </label>

        {error && (
          <p style={{ color: "#ef4444", fontSize: "0.875rem", marginBottom: "0.75rem" }}>{error}</p>
        )}

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "0.5rem 1rem", border: "1px solid #d1d5db", borderRadius: "6px",
              background: "#fff", color: "#374151", cursor: "pointer", fontSize: "0.875rem",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: "0.5rem 1rem", border: "none", borderRadius: "6px",
              background: "#1F7ED6", color: "#fff", cursor: "pointer", fontSize: "0.875rem",
            }}
          >
            Authorize
          </button>
        </div>
      </div>
    </div>
  );
}
