"use client";

import { FormEvent } from "react";
import type { RxSettings } from "@/lib/types";

type Props = {
  settings: RxSettings;
  onUpdate: (settings: RxSettings) => void;
};

export function PrescriptionSettingsPanel({ settings, onUpdate }: Props) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onUpdate({
      ddEddLowStockThreshold: Number(form.get("ddEddLowStockThreshold") || 10),
      profileRetentionYears: Number(form.get("profileRetentionYears") || 10),
      hardBlockPrototypeReset: form.get("hardBlockPrototypeReset") === "on"
    });
  }

  return (
    <section className="panel settings-panel">
      <form className="form-grid" onSubmit={submit}>
        <h2>Prescription Settings</h2>
        <label className="input-label">
          DD/EDD low-stock threshold
          <input name="ddEddLowStockThreshold" type="number" min="1" defaultValue={settings.ddEddLowStockThreshold} />
        </label>
        <label className="input-label">
          Profile retention years
          <input name="profileRetentionYears" type="number" min="2" defaultValue={settings.profileRetentionYears} />
        </label>
        <label className="check">
          <input name="hardBlockPrototypeReset" type="checkbox" defaultChecked={settings.hardBlockPrototypeReset} /> Hard block reset for prescription and DD logs
        </label>
        <div className="settings-actions">
          <button className="primary">Save Prescription Settings</button>
        </div>
      </form>
    </section>
  );
}
