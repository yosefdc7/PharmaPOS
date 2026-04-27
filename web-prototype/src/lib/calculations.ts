import type { CartItem, CartTotals, Product, ScPwdSettings, Settings } from "./types";

export function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isScPwdEligible(product: Product): boolean {
  return product.scPwdEligibility !== "excluded";
}

export function calculateItemOriginalPrice(product: Product): number {
  return product.originalPrice ?? product.price;
}

export function calculateScPwdVatRemoved(
  originalPrice: number,
  price: number,
  quantity: number,
  chargeTax: boolean,
  vatPercentage: number,
  isVatRegistered: boolean
): number {
  if (!chargeTax || !isVatRegistered || vatPercentage <= 0) return 0;
  // VAT component removed when selling to SC/PWD
  const unitVat = money((originalPrice * vatPercentage) / (100 + vatPercentage));
  return money(unitVat * quantity);
}

export function calculateScPwdDiscountPerItem(
  originalPrice: number,
  vatRemoved: number,
  quantity: number,
  discountRate: number,
  isVatRegistered: boolean
): number {
  const unitDiscountable = isVatRegistered && quantity > 0 ? money(originalPrice - (vatRemoved / quantity)) : originalPrice;
  return quantity > 0 ? money(unitDiscountable * (discountRate / 100) * quantity) : 0;
}

export function buildScPwdCartItems(
  items: CartItem[],
  products: Product[],
  settings: Settings,
  scPwdSettings: ScPwdSettings | undefined,
  existingDiscount: number
): CartItem[] {
  if (!scPwdSettings?.enabled) return items;

  const productMap = new Map(products.map((p) => [p.id, p]));
  return items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product || !isScPwdEligible(product)) return item;

    const originalPrice = calculateItemOriginalPrice(product);
    const vatRemoved = calculateScPwdVatRemoved(
      originalPrice,
      item.price,
      item.quantity,
      settings.chargeTax,
      settings.vatPercentage,
      scPwdSettings.vatRegistered
    );
    const discountAmount = calculateScPwdDiscountPerItem(
      originalPrice,
      vatRemoved,
      item.quantity,
      scPwdSettings.discountRate,
      scPwdSettings.vatRegistered
    );
    const finalUnitPrice = item.quantity > 0 ? money(originalPrice - (vatRemoved / item.quantity) - (discountAmount / item.quantity)) : originalPrice;

    return {
      ...item,
      originalPrice,
      vatExempt: vatRemoved > 0,
      scPwdDiscounted: true,
      scPwdDiscountAmount: discountAmount,
      scPwdVatRemoved: vatRemoved,
      price: finalUnitPrice,
    };
  });
}

export function calculateScPwdTotals(
  items: CartItem[],
  products: Product[],
  settings: Settings,
  requestedDiscount: number,
  scPwdSettings: ScPwdSettings | undefined
) {
  const processedItems = buildScPwdCartItems(items, products, settings, scPwdSettings, requestedDiscount);
  const eligibleItems = processedItems.filter((i) => i.scPwdDiscounted);
  const ineligibleItems = processedItems.filter((i) => !i.scPwdDiscounted);

  const originalSubtotal = money(
    processedItems.reduce((sum, i) => sum + (i.originalPrice ?? i.price) * i.quantity, 0)
  );
  const totalVatRemoved = money(eligibleItems.reduce((sum, i) => sum + (i.scPwdVatRemoved ?? 0), 0));
  const totalScPwdDiscount = money(eligibleItems.reduce((sum, i) => sum + (i.scPwdDiscountAmount ?? 0), 0));
  const manualDiscount = money(Math.min(Math.max(requestedDiscount || 0, 0), originalSubtotal));

  // Guard against double discount: if SC/PWD is active, manual discount on eligible items is disallowed
  const effectiveManualDiscount = scPwdSettings?.enabled && totalScPwdDiscount > 0 ? 0 : manualDiscount;
  const totalDiscount = money(totalScPwdDiscount + effectiveManualDiscount);

  const taxableAmount = money(originalSubtotal - totalDiscount - totalVatRemoved);
  const tax = settings.chargeTax ? money((taxableAmount * settings.vatPercentage) / 100) : 0;
  const total = money(taxableAmount + tax);

  return {
    originalSubtotal,
    totalVatRemoved,
    totalScPwdDiscount,
    manualDiscount: effectiveManualDiscount,
    totalDiscount,
    taxableAmount,
    tax,
    total,
    itemCount: processedItems.reduce((sum, i) => sum + i.quantity, 0),
    eligibleCount: eligibleItems.reduce((sum, i) => sum + i.quantity, 0),
    ineligibleCount: ineligibleItems.reduce((sum, i) => sum + i.quantity, 0),
  };
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
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Detect unknown cart items: productId not in the products array
  const unknownItems = cart.filter((item) => !productMap.has(item.productId));
  if (unknownItems.length > 0) {
    const names = unknownItems.map((i) => i.productName || i.productId).join(", ");
    throw new Error(`Cannot complete sale: unknown product(s) in cart: ${names}. Stock update requires all products to be registered.`);
  }

  return products.map((product) => {
    if (!product.tracksStock) return product;
    const sold = cart.find((item) => item.productId === product.id)?.quantity || 0;
    const nextQuantity = product.quantity - sold;
    if (nextQuantity < 0) {
      throw new Error(`Insufficient stock for ${product.name}: requested ${sold}, available ${product.quantity}`);
    }
    return { ...product, quantity: nextQuantity };
  });
}

export function isLowStock(product: Product): boolean {
  return product.tracksStock && product.quantity <= product.minStock;
}

function parseExpiryDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === "N/A") return null;
  if (dateStr.includes("/")) {
    const [m, d, y] = dateStr.split("/");
    if (y && m && d) return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const iso = new Date(dateStr);
  if (!Number.isNaN(iso.getTime())) return iso;
  return null;
}

export function daysUntilExpiry(product: Product): number | null {
  const expiry = parseExpiryDate(product.expirationDate);
  if (!expiry) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export function isExpired(product: Product): boolean {
  const days = daysUntilExpiry(product);
  return days !== null && days < 0;
}

export function isNearExpiry(product: Product, thresholdDays: number): boolean {
  const days = daysUntilExpiry(product);
  return days !== null && days >= 0 && days <= thresholdDays;
}

let localNumberCounter = 0;

export function makeLocalNumber(prefix = "POS"): string {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;
  const count = String(++localNumberCounter).padStart(3, "0");
  const random = Math.floor(Math.random() * 1000);
  return `${prefix}-${stamp}-${String(Date.now()).slice(-4)}-${count}-${String(random).padStart(3, "0")}`;
}
