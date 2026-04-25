"use client";

import { FormEvent } from "react";
import type { RxPharmacist } from "@/lib/types";

type Props = {
  pharmacists: RxPharmacist[];
  onConfirm: (name: string, prc: string) => void;
  onClose: () => void;
};

export function PharmacistAckModal({ pharmacists, onConfirm, onClose }: Props) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selected = pharmacists.find((item) => item.id === form.get("pharmacist"));
    if (!selected) return;
    onConfirm(selected.name, selected.prcNumber);
  }

  return (
    <div className="override-modal-backdrop" onClick={onClose}>
      <form className="override-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <h3>Pharmacist Acknowledgment Required</h3>
        <p>Pharmacist-Only OTC requires supervising pharmacist details before checkout (RX-8).</p>
        <label className="input-label">
          Pharmacist
          <select name="pharmacist" required defaultValue={pharmacists[0]?.id ?? ""}>
            {pharmacists.map((pharmacist) => (
              <option key={pharmacist.id} value={pharmacist.id}>
                {pharmacist.name} ({pharmacist.prcNumber})
              </option>
            ))}
          </select>
        </label>
        <div className="override-modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Confirm
          </button>
        </div>
      </form>
    </div>
  );
}
