"use client";

import { FormEvent } from "react";
import type { DispenseCheckpoint, PrescriptionDraft, RxPharmacist } from "@/lib/types";

type Props = {
  checkpoint: DispenseCheckpoint;
  pharmacists: RxPharmacist[];
  onSave: (draft: PrescriptionDraft) => void;
  onClose: () => void;
};

export function PrescriptionEntryDrawer({ checkpoint, pharmacists, onSave, onClose }: Props) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const selected = pharmacists.find((item) => item.id === data.get("pharmacistId"));
    const quantityPrescribed = Number(data.get("quantityPrescribed") || 0);
    const quantityDispensed = Number(data.get("quantityDispensed") || 0);
    const quantityRemaining = Math.max(0, quantityPrescribed - quantityDispensed);

    onSave({
      id: crypto.randomUUID(),
      transactionId: `rx-${Date.now()}`,
      customerId: "walk-in",
      patientName: String(data.get("patientName") || ""),
      patientAddress: String(data.get("patientAddress") || ""),
      prescriptionDate: String(data.get("prescriptionDate") || ""),
      prescriberName: String(data.get("prescriberName") || ""),
      prescriberPrcLicense: String(data.get("prescriberPrcLicense") || ""),
      prescriberPtrNumber: String(data.get("prescriberPtrNumber") || ""),
      prescriberS2Number: String(data.get("prescriberS2Number") || ""),
      clinicNameAddress: String(data.get("clinicNameAddress") || ""),
      yellowRxReference: String(data.get("yellowRxReference") || ""),
      genericName: String(data.get("genericName") || ""),
      dosageStrength: String(data.get("dosageStrength") || ""),
      quantityPrescribed,
      quantityDispensed,
      quantityRemaining,
      directionsForUse: String(data.get("directionsForUse") || ""),
      dispensingPharmacistName: selected?.name || "Unassigned",
      dispensingPharmacistPrc: selected?.prcNumber || "N/A",
      status: quantityRemaining > 0 ? "PARTIAL - OPEN" : "SERVED",
      classAtDispense: checkpoint.classAtDispense,
      createdAt: new Date().toISOString()
    });
  }

  return (
    <section className="product-editor-shell">
      <form className="panel product-editor" onSubmit={submit}>
        <div className="product-editor-head">
          <div>
            <h3>Prescription Entry</h3>
            <p>{checkpoint.productName} ({checkpoint.classAtDispense})</p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="product-editor-grid">
          <label>
            Prescription Date
            <input name="prescriptionDate" type="date" required />
          </label>
          <label>
            Patient Name
            <input name="patientName" required />
          </label>
          <label>
            Patient Address
            <input name="patientAddress" required />
          </label>
          <label>
            Prescriber Name
            <input name="prescriberName" required />
          </label>
          <label>
            Prescriber PRC
            <input name="prescriberPrcLicense" required />
          </label>
          <label>
            Prescriber PTR
            <input name="prescriberPtrNumber" required />
          </label>
          <label>
            Clinic/Hospital Name and Address
            <input name="clinicNameAddress" required />
          </label>
          <label>
            Drug Generic Name
            <input name="genericName" required />
          </label>
          <label>
            Dosage Strength
            <input name="dosageStrength" required />
          </label>
          <label>
            Quantity Prescribed
            <input name="quantityPrescribed" type="number" min="1" required />
          </label>
          <label>
            Quantity Dispensed
            <input name="quantityDispensed" type="number" min="1" required />
          </label>
          <label>
            Directions for Use
            <input name="directionsForUse" required />
          </label>
          {checkpoint.requiresS2 ? (
            <label>
              Prescriber S-2 Number
              <input name="prescriberS2Number" required />
            </label>
          ) : null}
          {checkpoint.requiresYellowForm ? (
            <label>
              Yellow Rx Reference
              <input name="yellowRxReference" required />
            </label>
          ) : null}
          <label>
            Dispensing Pharmacist
            <select name="pharmacistId" required defaultValue={pharmacists[0]?.id ?? ""}>
              {pharmacists.map((pharmacist) => (
                <option key={pharmacist.id} value={pharmacist.id}>
                  {pharmacist.name} ({pharmacist.prcNumber})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="product-editor-actions">
          <button type="submit" className="primary">
            Save Prescription Entry
          </button>
        </div>
      </form>
    </section>
  );
}
