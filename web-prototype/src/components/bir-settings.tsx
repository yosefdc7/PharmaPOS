"use client";

import { useState, FormEvent, useMemo } from "react";
import type { BirSettings, ScPwdEligibility, ScPwdSettings } from "@/lib/types";

function validateTin(value: string): boolean {
  return /^\d{3}-\d{3}-\d{3}-\d{3}$/.test(value);
}

function validatePtu(value: string): boolean {
  return /^[A-Za-z]{3}\d+$/.test(value);
}

function validateNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function BirSettingsPanel() {
  const [birSettings, setBirSettings] = useState<BirSettings>({
    tin: "123-456-789-000",
    registeredName: "PharmaSpot Drug Store",
    registeredAddress: "123 Main Street, Quezon City",
    vatRegistered: true,
    ptuNumber: "FPU0000001234",
    machineSerial: "SN-2024-001",
    accreditationNumber: "0123456789012345678901234",
    orSeriesStart: 1,
    orSeriesEnd: 50000,
    currentOrNumber: 49920,
    zReadingCutoffTime: "23:59",
  });

  const [scPwdSettings, setScPwdSettings] = useState<ScPwdSettings>({
    enabled: true,
    discountRate: 20,
    vatRegistered: true,
    defaultMedicineEligibility: "medicine",
    duplicateIdThreshold: 2,
    dailyAlertThreshold: 5,
  });

  const validations = useMemo(() => ({
    tin: validateTin(birSettings.tin),
    registeredName: validateNonEmpty(birSettings.registeredName),
    registeredAddress: validateNonEmpty(birSettings.registeredAddress),
    ptuNumber: validatePtu(birSettings.ptuNumber),
    machineSerial: validateNonEmpty(birSettings.machineSerial),
    accreditationNumber: validateNonEmpty(birSettings.accreditationNumber),
  }), [birSettings]);

  const invalidCount = Object.values(validations).filter((v) => !v).length;
  const isComplete = invalidCount === 0;

  const orRemaining = birSettings.orSeriesEnd - birSettings.currentOrNumber;
  const nearingSeriesEnd = orRemaining <= 100 && orRemaining >= 0;

  function update<K extends keyof BirSettings>(key: K, value: BirSettings[K]) {
    setBirSettings((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
  }

  return (
    <section className="panel settings-panel">
      <h2>BIR Settings</h2>

      {/* Compliance Status Banner (B-3) */}
      {isComplete ? (
        <div className="bir-compliance-banner complete">
          ✓ BIR Configuration Complete
        </div>
      ) : (
        <div className="bir-compliance-banner incomplete">
          ⚠ BIR Configuration Incomplete — {invalidCount} field{invalidCount > 1 ? "s" : ""} require{invalidCount === 1 ? "s" : ""} attention
        </div>
      )}

      <form className="form-grid bir-settings-form" onSubmit={handleSubmit}>
        {/* TIN */}
        <div className="field-row">
          <label className="input-label">
            TIN
            <input
              type="text"
              value={birSettings.tin}
              onChange={(e) => update("tin", e.target.value)}
              placeholder="000-000-000-000"
            />
          </label>
          <span className={`validation-indicator ${validations.tin ? "validation-ok" : "validation-fail"}`}>
            {validations.tin ? "✓" : "✗"}
          </span>
        </div>

        {/* Registered Business Name */}
        <div className="field-row">
          <label className="input-label">
            Registered Business Name
            <input
              type="text"
              value={birSettings.registeredName}
              onChange={(e) => update("registeredName", e.target.value)}
            />
          </label>
          <span className={`validation-indicator ${validations.registeredName ? "validation-ok" : "validation-fail"}`}>
            {validations.registeredName ? "✓" : "✗"}
          </span>
        </div>

        {/* Registered Address */}
        <div className="field-row">
          <label className="input-label">
            Registered Address
            <textarea
              rows={2}
              value={birSettings.registeredAddress}
              onChange={(e) => update("registeredAddress", e.target.value)}
            />
          </label>
          <span className={`validation-indicator ${validations.registeredAddress ? "validation-ok" : "validation-fail"}`}>
            {validations.registeredAddress ? "✓" : "✗"}
          </span>
        </div>

        {/* VAT Registration Status (B-25) */}
        <div className="field-row">
          <div className="input-label">
            VAT Registration Status
            <div className="vat-toggle-row">
              <div
                className={`toggle-switch ${birSettings.vatRegistered ? "active" : ""}`}
                onClick={() => update("vatRegistered", !birSettings.vatRegistered)}
                role="switch"
                aria-checked={birSettings.vatRegistered}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    update("vatRegistered", !birSettings.vatRegistered);
                  }
                }}
              />
              <span>{birSettings.vatRegistered ? "VAT Registered" : "Non-VAT"}</span>
              <span
                className="vat-lock-hint"
                title="Changing VAT status affects receipt template and tax computation"
              >
                🔒
              </span>
            </div>
          </div>
        </div>

        {/* PTU Number */}
        <div className="field-row">
          <label className="input-label">
            PTU Number
            <input
              type="text"
              value={birSettings.ptuNumber}
              onChange={(e) => update("ptuNumber", e.target.value)}
              placeholder="AAANNNNNNN"
            />
          </label>
          <span className={`validation-indicator ${validations.ptuNumber ? "validation-ok" : "validation-fail"}`}>
            {validations.ptuNumber ? "✓" : "✗"}
          </span>
        </div>

        {/* POS Machine Serial Number */}
        <div className="field-row">
          <label className="input-label">
            POS Machine Serial Number
            <input
              type="text"
              value={birSettings.machineSerial}
              onChange={(e) => update("machineSerial", e.target.value)}
            />
          </label>
          <span className={`validation-indicator ${validations.machineSerial ? "validation-ok" : "validation-fail"}`}>
            {validations.machineSerial ? "✓" : "✗"}
          </span>
        </div>

        {/* BIR Accreditation Number */}
        <div className="field-row">
          <label className="input-label">
            BIR Accreditation Number
            <input
              type="text"
              value={birSettings.accreditationNumber}
              onChange={(e) => update("accreditationNumber", e.target.value)}
            />
          </label>
          <span className={`validation-indicator ${validations.accreditationNumber ? "validation-ok" : "validation-fail"}`}>
            {validations.accreditationNumber ? "✓" : "✗"}
          </span>
        </div>

        {/* OR Series Configuration (B-5, B-6) */}
        <div className="or-series-section">
          <h3>Official Receipt Series</h3>
          <div className="or-series-fields">
            <label className="input-label">
              Beginning OR Number
              <input
                type="number"
                value={birSettings.orSeriesStart}
                onChange={(e) => update("orSeriesStart", Number(e.target.value))}
              />
            </label>
            <label className="input-label">
              Ending OR Number
              <input
                type="number"
                value={birSettings.orSeriesEnd}
                onChange={(e) => update("orSeriesEnd", Number(e.target.value))}
              />
            </label>
            <label className="input-label">
              Current OR Number
              <input type="number" value={birSettings.currentOrNumber} readOnly />
            </label>
          </div>
          {nearingSeriesEnd && (
            <span className="or-warning-badge">
              Nearing series end — {orRemaining} remaining
            </span>
          )}
        </div>

        <button className="primary" type="submit">Save BIR Settings</button>

        <hr style={{ margin: "24px 0" }} />

        <h3>SC/PWD Settings</h3>

        <div className="field-row">
          <div className="input-label">
            Enable SC/PWD Discount
            <div className="vat-toggle-row">
              <div
                className={`toggle-switch ${scPwdSettings.enabled ? "active" : ""}`}
                onClick={() => setScPwdSettings((prev) => ({ ...prev, enabled: !prev.enabled }))}
                role="switch"
                aria-checked={scPwdSettings.enabled}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setScPwdSettings((prev) => ({ ...prev, enabled: !prev.enabled }));
                  }
                }}
              />
              <span>{scPwdSettings.enabled ? "Enabled" : "Disabled"}</span>
            </div>
          </div>
        </div>

        <div className="field-row">
          <label className="input-label">
            Discount Rate (%)
            <input type="number" value={scPwdSettings.discountRate} readOnly />
          </label>
        </div>

        <div className="field-row">
          <div className="input-label">
            VAT Registration (for SC/PWD)
            <div className="vat-toggle-row">
              <div
                className={`toggle-switch ${scPwdSettings.vatRegistered ? "active" : ""}`}
                onClick={() => setScPwdSettings((prev) => ({ ...prev, vatRegistered: !prev.vatRegistered }))}
                role="switch"
                aria-checked={scPwdSettings.vatRegistered}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setScPwdSettings((prev) => ({ ...prev, vatRegistered: !prev.vatRegistered }));
                  }
                }}
              />
              <span>{scPwdSettings.vatRegistered ? "VAT Registered" : "Non-VAT"}</span>
            </div>
          </div>
        </div>

        <div className="field-row">
          <label className="input-label">
            Default Medicine Eligibility
            <select
              value={scPwdSettings.defaultMedicineEligibility}
              onChange={(e) =>
                setScPwdSettings((prev) => ({ ...prev, defaultMedicineEligibility: e.target.value as ScPwdEligibility }))
              }
            >
              <option value="medicine">Medicine</option>
              <option value="non-medicine">Non-medicine</option>
              <option value="excluded">Excluded</option>
            </select>
          </label>
        </div>

        <div className="field-row">
          <label className="input-label">
            Duplicate ID Threshold (uses/day)
            <input
              type="number"
              min={1}
              value={scPwdSettings.duplicateIdThreshold}
              onChange={(e) =>
                setScPwdSettings((prev) => ({ ...prev, duplicateIdThreshold: Number(e.target.value) }))
              }
            />
          </label>
        </div>

        <div className="field-row">
          <label className="input-label">
            Daily Alert Threshold (transactions/day)
            <input
              type="number"
              min={1}
              value={scPwdSettings.dailyAlertThreshold}
              onChange={(e) =>
                setScPwdSettings((prev) => ({ ...prev, dailyAlertThreshold: Number(e.target.value) }))
              }
            />
          </label>
        </div>
      </form>
    </section>
  );
}
