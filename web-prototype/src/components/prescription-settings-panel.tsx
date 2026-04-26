"use client";

import { FormEvent, useEffect, useState } from "react";
import { getOne, putOne } from "../lib/db";
import type { RxSettings } from "@/lib/types";

type Props = {
  settings: RxSettings;
  onUpdate: (settings: RxSettings) => void;
};

export function PrescriptionSettingsPanel({ settings: initialSettings, onUpdate }: Props) {
  const [settings, setSettings] = useState<RxSettings>(initialSettings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOne("rxSettings", "rx").then((saved) => {
      if (saved) {
        setSettings(saved as RxSettings);
        onUpdate(saved as RxSettings);
      }
    });
  }, [onUpdate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      const updated: RxSettings = {
        ddEddLowStockThreshold: Number(form.get("ddEddLowStockThreshold") || 10),
        profileRetentionYears: Number(form.get("profileRetentionYears") || 10),
        hardBlockPrototypeReset: form.get("hardBlockPrototypeReset") === "on",
      };
      await putOne("rxSettings", { ...updated, id: "rx" } as RxSettings & { id: string });
      setSettings(updated);
      onUpdate(updated);
    } finally {
      setSaving(false);
    }
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
          <button className="primary" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Prescription Settings"}
          </button>
        </div>
      </form>
    </section>
  );
}
