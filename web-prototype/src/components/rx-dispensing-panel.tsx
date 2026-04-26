"use client";

import { useState } from "react";
import type { DispenseCheckpoint, PrescriptionRefusal } from "@/lib/types";
import { PharmacistAckModal } from "./pharmacist-ack-modal";
import type { RxPharmacist } from "@/lib/types";

type Props = {
  checkpoints: DispenseCheckpoint[];
  pharmacists: RxPharmacist[];
  onOpenPrescription: (checkpoint: DispenseCheckpoint) => void;
  onLogRefusal: (refusal: PrescriptionRefusal) => void;
};

export function RxDispensingPanel({ checkpoints, pharmacists, onOpenPrescription, onLogRefusal }: Props) {
  const [showAck, setShowAck] = useState(false);
  const [acknowledgedBy, setAcknowledgedBy] = useState("");
  const requiresAck = checkpoints.some((item) => item.requiresPharmacistAck);

  return (
    <section className="panel data-panel">
      <h2>POS Dispensing Enforcement (RX-7 to RX-18)</h2>
      {checkpoints.length === 0 ? <p className="empty">No controlled products in cart.</p> : null}
      <div className="rx-dispensing-list">
        {checkpoints.map((checkpoint) => (
          <article key={checkpoint.id} className={`data-row ${checkpoint.blocked ? "rx-row-blocked" : ""}`}>
            <strong>{checkpoint.productName}</strong>
            <span>{checkpoint.classAtDispense}</span>
            <span>{checkpoint.warning}</span>
            <div className="settings-actions">
              {checkpoint.requiresPharmacistAck ? (
                <button type="button" onClick={() => setShowAck(true)}>
                  Pharmacist Acknowledge
                </button>
              ) : null}
              {checkpoint.blocked ? (
                <button type="button" className="primary" onClick={() => onOpenPrescription(checkpoint)}>
                  Open Prescription Drawer
                </button>
              ) : null}
              <button
                type="button"
                className="danger"
                onClick={() =>
                  onLogRefusal({
                    id: crypto.randomUUID(),
                    createdAt: new Date().toISOString(),
                    pharmacistName: acknowledgedBy || "Unassigned Pharmacist",
                    reason: "Customer unable to provide valid prescription.",
                    patientName: "Walk-in",
                    productName: checkpoint.productName
                  })
                }
              >
                Log Refusal
              </button>
            </div>
          </article>
        ))}
      </div>
      {acknowledgedBy ? <p className="retention-notice">Last pharmacist acknowledgment: {acknowledgedBy}</p> : null}
      {showAck && requiresAck ? (
        <PharmacistAckModal
          pharmacists={pharmacists}
          onClose={() => setShowAck(false)}
          onConfirm={(name, prc) => {
            setAcknowledgedBy(`${name} (${prc})`);
            setShowAck(false);
          }}
        />
      ) : null}
    </section>
  );
}
