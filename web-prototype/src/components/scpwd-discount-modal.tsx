"use client";

import { useState } from "react";
import type { ScPwdCustomerDetails, ScPwdDiscountType, ProxyPurchaseDetails } from "@/lib/types";

type ScpwdDiscountModalProps = {
  onApply: (details: ScPwdCustomerDetails) => void;
  onCancel: () => void;
  onRemove?: (overrideBy?: string, overrideReason?: string) => void;
  activeDiscount: boolean;
  initialDraft?: ScPwdCustomerDetails | null;
};

export function ScpwdDiscountModal({ onApply, onCancel, onRemove, activeDiscount, initialDraft }: ScpwdDiscountModalProps) {
  const [discountType, setDiscountType] = useState<ScPwdDiscountType>(initialDraft?.discountType ?? "sc");
  const [idNumber, setIdNumber] = useState(initialDraft?.idNumber ?? "");
  const [fullName, setFullName] = useState(initialDraft?.fullName ?? "");
  const [tin, setTin] = useState(initialDraft?.tin ?? "");
  const [dualEligibility, setDualEligibility] = useState(initialDraft?.dualEligibility ?? false);
  const [chosenDiscount, setChosenDiscount] = useState<ScPwdDiscountType | undefined>(initialDraft?.chosenDiscount);
  const [proxyPurchase, setProxyPurchase] = useState(initialDraft?.proxyPurchase ?? false);
  const [proxyDetails, setProxyDetails] = useState<ProxyPurchaseDetails>(
    initialDraft?.proxyDetails ?? { proxyName: "", proxyRelation: "", proxyIdType: "", proxyIdNumber: "" }
  );
  const [showOverride, setShowOverride] = useState(false);
  const [overrideBy, setOverrideBy] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!idNumber.trim() || !fullName.trim()) return;
    onApply({
      discountType,
      idNumber: idNumber.trim(),
      fullName: fullName.trim(),
      tin: tin.trim() || undefined,
      dualEligibility,
      chosenDiscount: dualEligibility ? (chosenDiscount ?? discountType) : undefined,
      proxyPurchase,
      proxyDetails: proxyPurchase ? proxyDetails : undefined
    });
  }

  function handleRemove() {
    if (!showOverride) {
      setShowOverride(true);
      return;
    }
    onRemove?.(overrideBy.trim() || undefined, overrideReason.trim() || undefined);
  }

  return (
    <div className="override-modal-backdrop" onClick={onCancel}>
      <div className="panel scpwd-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{activeDiscount ? "SC/PWD Discount Active" : "Apply SC/PWD Discount"}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="input-label">
              Discount Type
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as ScPwdDiscountType)}
                disabled={activeDiscount && !showOverride}
              >
                <option value="sc">Senior Citizen (SC)</option>
                <option value="pwd">Persons with Disability (PWD)</option>
              </select>
            </label>

            <label className="input-label">
              ID Number
              <input
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="e.g. SC-2024-001234"
                required
                disabled={activeDiscount && !showOverride}
              />
            </label>

            <label className="input-label">
              Full Name
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Customer full name"
                required
                disabled={activeDiscount && !showOverride}
              />
            </label>

            <label className="input-label">
              TIN (Optional)
              <input
                value={tin}
                onChange={(e) => setTin(e.target.value)}
                placeholder="000-000-000-000"
                disabled={activeDiscount && !showOverride}
              />
            </label>

            <label className="check">
              <input
                type="checkbox"
                checked={dualEligibility}
                onChange={(e) => setDualEligibility(e.target.checked)}
                disabled={activeDiscount && !showOverride}
              />
              Dual eligibility (both SC and PWD IDs)
            </label>

            {dualEligibility && (
              <label className="input-label">
                Choose one discount
                <select
                  value={chosenDiscount ?? discountType}
                  onChange={(e) => setChosenDiscount(e.target.value as ScPwdDiscountType)}
                  disabled={activeDiscount && !showOverride}
                >
                  <option value="sc">Senior Citizen</option>
                  <option value="pwd">PWD</option>
                </select>
              </label>
            )}

            <label className="check">
              <input
                type="checkbox"
                checked={proxyPurchase}
                onChange={(e) => setProxyPurchase(e.target.checked)}
                disabled={activeDiscount && !showOverride}
              />
              Proxy purchase (purchasing on behalf of SC/PWD)
            </label>

            {proxyPurchase && (
              <div className="proxy-section" style={{ display: "grid", gap: 8, gridColumn: "span 2" }}>
                <label className="input-label">
                  Proxy Name
                  <input
                    value={proxyDetails.proxyName}
                    onChange={(e) => setProxyDetails((p) => ({ ...p, proxyName: e.target.value }))}
                    placeholder="Name of proxy"
                    disabled={activeDiscount && !showOverride}
                  />
                </label>
                <label className="input-label">
                  Proxy Relation
                  <input
                    value={proxyDetails.proxyRelation}
                    onChange={(e) => setProxyDetails((p) => ({ ...p, proxyRelation: e.target.value }))}
                    placeholder="e.g. son, caregiver"
                    disabled={activeDiscount && !showOverride}
                  />
                </label>
                <label className="input-label">
                  Proxy ID Type
                  <input
                    value={proxyDetails.proxyIdType}
                    onChange={(e) => setProxyDetails((p) => ({ ...p, proxyIdType: e.target.value }))}
                    placeholder="e.g. Driver's License"
                    disabled={activeDiscount && !showOverride}
                  />
                </label>
                <label className="input-label">
                  Proxy ID Number
                  <input
                    value={proxyDetails.proxyIdNumber}
                    onChange={(e) => setProxyDetails((p) => ({ ...p, proxyIdNumber: e.target.value }))}
                    placeholder="ID number"
                    disabled={activeDiscount && !showOverride}
                  />
                </label>
              </div>
            )}
          </div>

          {!activeDiscount ? (
            <div className="product-editor-actions">
              <button type="submit" className="primary">
                Apply Discount
              </button>
              <button type="button" onClick={onCancel}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="product-editor-actions">
              {showOverride ? (
                <div className="form-grid" style={{ width: "100%" }}>
                  <label className="input-label">
                    Supervisor Name
                    <input value={overrideBy} onChange={(e) => setOverrideBy(e.target.value)} placeholder="Name" />
                  </label>
                  <label className="input-label">
                    Reason for removal
                    <input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Reason" />
                  </label>
                  <button type="button" className="danger" onClick={handleRemove}>
                    Confirm Removal
                  </button>
                </div>
              ) : (
                <button type="button" className="danger" onClick={handleRemove}>
                  Remove Discount (Supervisor)
                </button>
              )}
              <button type="button" onClick={onCancel}>
                Close
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
