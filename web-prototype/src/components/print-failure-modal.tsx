"use client";

import { useState } from "react";

type PrintFailureModalProps = {
  onClose?: () => void;
  onRetry?: () => void;
  onSkip?: () => void;
};

export function PrintFailureModal({ onClose, onRetry, onSkip }: PrintFailureModalProps) {
  const [retrying, setRetrying] = useState(false);
  const [showDigital, setShowDigital] = useState(false);
  const [email, setEmail] = useState("customer@email.com");

  const handleRetry = () => {
    setRetrying(true);
    onRetry?.();
    setTimeout(() => setRetrying(false), 2000);
  };

  const handleSkip = () => {
    setShowDigital(true);
    onSkip?.();
  };

  return (
    <div className="print-failure-backdrop" onClick={onClose}>
      <div className="print-failure-modal" onClick={(e) => e.stopPropagation()}>
        <div className="warning-icon">⚠️</div>
        <h3>Printer Unavailable</h3>
        <p>
          The receipt printer is currently offline. The transaction has been
          saved.
        </p>

        <div className="print-failure-actions">
          <button
            className="retry-btn"
            onClick={handleRetry}
            disabled={retrying}
          >
            {retrying ? "Retrying…" : "Wait and Retry"}
          </button>
          <button className="skip-btn" onClick={handleSkip}>
            Skip Print — Send Digital Receipt
          </button>
        </div>

        {showDigital && (
          <div className="digital-receipt-section">
            <div className="qr-placeholder">QR Code</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
              Scan to view digital receipt
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Or send receipt to:
            </div>
            <div className="digital-send-row">
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="primary" style={{ padding: "6px 16px", minWidth: 60 }}>
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
