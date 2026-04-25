"use client";

import type { CartItem, Product } from "@/lib/types";
import { calculateScPwdTotals, money } from "@/lib/calculations";
import type { Settings, ScPwdSettings } from "@/lib/types";

type ScpwdBreakdownCardProps = {
  cart: CartItem[];
  products: Product[];
  settings: Settings;
  scPwdSettings: ScPwdSettings;
  symbol: string;
};

export function ScpwdBreakdownCard({ cart, products, settings, scPwdSettings, symbol }: ScpwdBreakdownCardProps) {
  const totals = calculateScPwdTotals(cart, products, settings, 0, scPwdSettings);
  const eligibleItems = cart.filter((i) => i.scPwdDiscounted);
  const ineligibleItems = cart.filter((i) => !i.scPwdDiscounted);

  return (
    <div className="panel scpwd-breakdown">
      <h4>SC/PWD Breakdown</h4>
      <div className="breakdown-grid">
        <div className="breakdown-row">
          <span>Original Subtotal</span>
          <strong>{symbol}{money(totals.originalSubtotal).toFixed(2)}</strong>
        </div>
        <div className="breakdown-row">
          <span>VAT Removed</span>
          <strong>{symbol}{money(totals.totalVatRemoved).toFixed(2)}</strong>
        </div>
        <div className="breakdown-row">
          <span>SC/PWD Discount ({scPwdSettings.discountRate}%)</span>
          <strong>{symbol}{money(totals.totalScPwdDiscount).toFixed(2)}</strong>
        </div>
        <div className="breakdown-row total">
          <span>Final Payable</span>
          <strong>{symbol}{money(totals.total).toFixed(2)}</strong>
        </div>
      </div>

      {eligibleItems.length > 0 && (
        <div className="scpwd-item-list">
          <h5>Affected Items ({totals.eligibleCount})</h5>
          {eligibleItems.map((item) => (
            <div key={item.productId} className="scpwd-item-row eligible">
              <span>{item.productName} x{item.quantity}</span>
              <span>
                {symbol}{(item.originalPrice ?? item.price).toFixed(2)} &rarr; {symbol}{item.price.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      {ineligibleItems.length > 0 && (
        <div className="scpwd-item-list">
          <h5>Unaffected Items ({totals.ineligibleCount})</h5>
          {ineligibleItems.map((item) => (
            <div key={item.productId} className="scpwd-item-row ineligible">
              <span>{item.productName} x{item.quantity}</span>
              <span>{symbol}{money(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
