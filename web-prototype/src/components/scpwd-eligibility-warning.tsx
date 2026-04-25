"use client";

import type { Product } from "@/lib/types";
import { isScPwdEligible } from "@/lib/calculations";

type ScpwdEligibilityWarningProps = {
  cartItems: { productId: string; productName: string; quantity: number }[];
  products: Product[];
};

export function ScpwdEligibilityWarning({ cartItems, products }: ScpwdEligibilityWarningProps) {
  const ineligibleItems = cartItems
    .map((item) => {
      const product = products.find((p) => p.id === item.productId);
      return product && !isScPwdEligible(product) ? item : null;
    })
    .filter(Boolean) as { productId: string; productName: string; quantity: number }[];

  if (ineligibleItems.length === 0) return null;

  return (
    <div className="alert-banner warning" style={{ marginTop: 8 }}>
      <span>
        Some items are not eligible for SC/PWD discount: {ineligibleItems.map((i) => `${i.productName} (x${i.quantity})`).join(", ")}
      </span>
    </div>
  );
}
