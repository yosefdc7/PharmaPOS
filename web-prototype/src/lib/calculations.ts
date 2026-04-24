import type { CartItem, CartTotals, Product, Settings } from "./types";

export function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateCartTotals(
  items: CartItem[],
  settings: Pick<Settings, "chargeTax" | "vatPercentage">,
  requestedDiscount: number
): CartTotals {
  const subtotal = money(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
  const discount = money(Math.min(Math.max(requestedDiscount || 0, 0), subtotal));
  const taxableAmount = money(subtotal - discount);
  const tax = settings.chargeTax ? money((taxableAmount * settings.vatPercentage) / 100) : 0;
  const total = money(taxableAmount + tax);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return { itemCount, subtotal, discount, taxableAmount, tax, total };
}

export function calculateChange(total: number, paid: number): number {
  return money(Math.max((paid || 0) - total, 0));
}

export function decrementStock(products: Product[], cart: CartItem[]): Product[] {
  const cartByProduct = new Map(cart.map((item) => [item.productId, item.quantity]));

  return products.map((product) => {
    if (!product.tracksStock) return product;
    const sold = cartByProduct.get(product.id) || 0;
    return { ...product, quantity: Math.max(product.quantity - sold, 0) };
  });
}

export function isLowStock(product: Product): boolean {
  return product.tracksStock && product.quantity <= product.minStock;
}

export function makeLocalNumber(prefix = "POS"): string {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;
  return `${prefix}-${stamp}-${String(Date.now()).slice(-5)}`;
}
