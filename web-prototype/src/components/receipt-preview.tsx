"use client";

import type { Transaction } from "@/lib/types";

function formatPeso(n: number): string {
  return "₱" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

type ReceiptPreviewProps = {
  variant?: "normal" | "void" | "reprint";
  onClose?: () => void;
  transaction?: Transaction;
};

export function ReceiptPreview({ variant = "normal", onClose, transaction }: ReceiptPreviewProps) {
  const tx = transaction;
  const items = tx?.items ?? [];
  const scPwdMeta = tx?.scPwdMetadata;
  const hasScPwd = Boolean(scPwdMeta);
  const dateStr = tx ? new Date(tx.createdAt).toLocaleString("en-PH") : new Date().toLocaleString("en-PH");
  const orNumber = tx?.localNumber ?? "000049920";

  return (
    <div className="receipt-preview">
      {/* Void watermark */}
      {variant === "void" && <div className="receipt-void-watermark">VOID</div>}

      {/* Reprint header */}
      {variant === "reprint" && (
        <div className="receipt-reprint-header">
          *** REPRINT — NOT AN ORIGINAL OR ***
          <div style={{ fontWeight: 400, fontSize: 10, marginTop: 2 }}>
            Reprinted: {dateStr}
            <br />
            Authorized by: Juan Cruz (Supervisor)
          </div>
        </div>
      )}

      {/* Store header */}
      <div className="receipt-center">
        <div className="receipt-store-name">PharmaSpot Drug Store</div>
        <div>123 Main Street, Quezon City</div>
        <div>TIN: 123-456-789-000</div>
        <div>PTU No: FPU0000001234</div>
        <div style={{ fontSize: 10 }}>Accreditation No: 0123456789012345678901234</div>
      </div>

      <hr className="receipt-separator" />

      {/* OR info */}
      <div className="receipt-center">
        <div className="receipt-or-title">Official Receipt</div>
        <div>OR #: {orNumber}</div>
        <div>Date: {dateStr}</div>
      </div>

      <hr className="receipt-separator" />

      {/* Line items header */}
      <div className="receipt-line-item" style={{ fontWeight: 700, marginBottom: 4 }}>
        <span className="item-name">Item</span>
        <span className="item-detail" style={{ width: 30 }}>Qty</span>
        <span className="item-detail" style={{ width: 60 }}>Price</span>
        <span className="item-detail" style={{ width: 70 }}>Amount</span>
      </div>

      {/* Line items */}
      {items.length > 0 ? (
        items.map((item) => (
          <div className="receipt-line-item" key={item.productId}>
            <span className="item-name">
              {item.productName}
              {item.vatExempt && (
                <span style={{ fontSize: 9, display: "block", color: "#666" }}>VAT-EXEMPT</span>
              )}
              {item.scPwdDiscounted && item.originalPrice && item.originalPrice > item.price && (
                <span style={{ fontSize: 9, display: "block", color: "#666" }}>
                  Disc {formatPeso(item.originalPrice - item.price)} each
                </span>
              )}
            </span>
            <span className="item-detail" style={{ width: 30 }}>{item.quantity}</span>
            <span className="item-detail" style={{ width: 60 }}>{formatPeso(item.price)}</span>
            <span className="item-detail" style={{ width: 70 }}>{formatPeso(item.price * item.quantity)}</span>
          </div>
        ))
      ) : (
        <>
          <div className="receipt-line-item"><span className="item-name">Biogesic 500mg</span><span className="item-detail" style={{ width: 30 }}>2</span><span className="item-detail" style={{ width: 60 }}>{formatPeso(15.0)}</span><span className="item-detail" style={{ width: 70 }}>{formatPeso(30.0)}</span></div>
          <div className="receipt-line-item"><span className="item-name">Amoxicillin 500mg</span><span className="item-detail" style={{ width: 30 }}>1</span><span className="item-detail" style={{ width: 60 }}>{formatPeso(85.0)}</span><span className="item-detail" style={{ width: 70 }}>{formatPeso(85.0)}</span></div>
        </>
      )}

      <hr className="receipt-separator" />

      {/* Tax breakdown */}
      <div className="receipt-subtotal-row">
        <span>Subtotal</span>
        <span>{formatPeso(tx?.subtotal ?? 1492.5)}</span>
      </div>
      {hasScPwd && (
        <div className="receipt-subtotal-row">
          <span>VATable Sales</span>
          <span>{formatPeso(0)}</span>
        </div>
      )}
      <div className="receipt-subtotal-row">
        <span>VAT Amount (12%)</span>
        <span>{formatPeso(tx?.tax ?? 159.91)}</span>
      </div>
      <div className="receipt-subtotal-row">
        <span>VAT-Exempt Sales</span>
        <span>{formatPeso(hasScPwd ? (tx?.subtotal ?? 0) : 0)}</span>
      </div>
      <div className="receipt-subtotal-row total-due">
        <span>Total Due</span>
        <span>{formatPeso(tx?.total ?? 1492.5)}</span>
      </div>

      <hr className="receipt-separator" />

      {/* SC/PWD section */}
      {hasScPwd && scPwdMeta && (
        <div className="receipt-sc-section">
          <div style={{ fontWeight: 700, marginBottom: 2 }}>
            {scPwdMeta.discountType.toUpperCase()} Discount Applied
          </div>
          <div>Customer: {scPwdMeta.fullName}</div>
          <div>ID: {scPwdMeta.idNumber}</div>
          {scPwdMeta.tin && <div>TIN: {scPwdMeta.tin}</div>}
          <div>Discount Amount: {formatPeso(scPwdMeta.scPwdDiscountAmount)}</div>
          {scPwdMeta.proxyPurchase && scPwdMeta.proxyDetails && (
            <div>Proxy: {scPwdMeta.proxyDetails.proxyName} ({scPwdMeta.proxyDetails.proxyRelation})</div>
          )}
        </div>
      )}

      {!hasScPwd && variant === "normal" && (
        <div className="receipt-sc-section">
          <div style={{ fontWeight: 700, marginBottom: 2 }}>SC/PWD Discount Applied</div>
          <div>SC/PWD ID: SC-2024-001234</div>
          <div>Discount Amount: {formatPeso(250.0)}</div>
          <div>VAT-Exempt Adjustment: {formatPeso(26.79)}</div>
        </div>
      )}

      {/* Payment section */}
      <div className="receipt-subtotal-row">
        <span>Payment Method</span>
        <span>{tx?.paymentMethod === "external-terminal" ? "CARD" : "CASH"}</span>
      </div>
      <div className="receipt-subtotal-row">
        <span>Amount Tendered</span>
        <span>{formatPeso(tx?.paid ?? 1500.0)}</span>
      </div>
      <div className="receipt-subtotal-row">
        <span>Change</span>
        <span>{formatPeso(tx ? tx.paid - tx.total : 7.5)}</span>
      </div>

      <hr className="receipt-separator" />

      {/* Footer */}
      <div className="receipt-footer">
        <div>Cashier: {tx ? "Cashier" : "Maria Santos"}</div>
        {hasScPwd && <div>Signature: ____________________</div>}
        <div style={{ marginTop: 4 }}>Thank you for your purchase!</div>
        <div>This serves as your Official Receipt</div>
      </div>

      {/* Void details */}
      {variant === "void" && (
        <div className="receipt-void-details">
          <div>Original OR#: {tx?.localNumber ?? "000049918"}</div>
          <div>Void Reason: Customer requested cancellation</div>
          <div>Void Date: {dateStr}</div>
          <div>Authorized by: Juan Cruz (Supervisor)</div>
        </div>
      )}

      {/* Close button */}
      {onClose && (
        <button onClick={onClose} style={{ marginTop: 12, width: "100%" }}>
          Close Preview
        </button>
      )}
    </div>
  );
}
