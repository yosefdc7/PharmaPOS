export type PermissionKey =
  | "products"
  | "categories"
  | "transactions"
  | "users"
  | "settings";

export type PaymentMethod = "cash" | "external-terminal";
export type PaymentStatus = "paid" | "pending" | "refunded";
export type SyncStatus = "pending" | "synced" | "failed";

export type Product = {
  id: string;
  name: string;
  barcode: string;
  categoryId: string;
  supplier: string;
  price: number;
  quantity: number;
  minStock: number;
  tracksStock: boolean;
  expirationDate: string;
  imageColor: string;
};

export type Category = {
  id: string;
  name: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

export type User = {
  id: string;
  username: string;
  fullname: string;
  role: "admin" | "cashier";
  permissions: Record<PermissionKey, boolean>;
};

export type Settings = {
  id: "store";
  store: string;
  addressOne: string;
  addressTwo: string;
  contact: string;
  currencySymbol: string;
  vatPercentage: number;
  chargeTax: boolean;
  quickBilling: boolean;
  receiptFooter: string;
};

export type CartItem = {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
};

export type TransactionItem = CartItem & {
  lineTotal: number;
};

export type Transaction = {
  id: string;
  localNumber: string;
  items: TransactionItem[];
  customerId: string;
  cashierId: string;
  createdAt: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  change: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference: string;
  syncStatus: SyncStatus;
  refundedAt?: string;
  refundReason?: string;
  refundReference?: string;
};

export type HeldOrder = {
  id: string;
  reference: string;
  items: CartItem[];
  customerId: string;
  discount: number;
  createdAt: string;
};

export type SyncQueueItem = {
  id: string;
  entity: "product" | "category" | "customer" | "user" | "settings" | "transaction" | "held-order";
  operation: "create" | "update" | "delete";
  payload: unknown;
  createdAt: string;
  status: SyncStatus;
  retryCount: number;
  lastError: string;
};

export type CartTotals = {
  itemCount: number;
  subtotal: number;
  discount: number;
  taxableAmount: number;
  tax: number;
  total: number;
};
