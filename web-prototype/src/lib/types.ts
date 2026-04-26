export type PermissionKey =
  | "products"
  | "categories"
  | "transactions"
  | "users"
  | "settings";

export type PaymentMethod = "cash" | "external-terminal";
export type PaymentStatus = "paid" | "pending" | "refunded";
export type SyncStatus = "pending" | "synced" | "failed";

export type ScPwdEligibility = "medicine" | "non-medicine" | "excluded";
export type DrugClassification = "DD, Rx" | "EDD, Rx" | "Rx" | "Pharmacist-Only OTC" | "Non-Rx OTC";

export type Product = {
  id: string;
  name: string;
  barcode: string;
  categoryId: string;
  supplier: string;
  price: number;
  originalPrice?: number;
  cost?: number;
  quantity: number;
  minStock: number;
  tracksStock: boolean;
  expirationDate: string;
  imageColor: string;
  featured?: boolean;
  scPwdEligibility?: ScPwdEligibility;
  vatExempt?: boolean;
  isPrescription?: boolean;
  drugClassification?: DrugClassification;
  genericName?: string;
  brandName?: string;
  activeIngredient?: string;
  dosageStrength?: string;
  dosageForm?: string;
  fdaCprNumber?: string;
  behindCounter?: boolean;
  ddLastReconciliationAt?: string;
};

export type PrescriptionStatus = "DRAFT" | "SERVED" | "PARTIAL - OPEN" | "FULLY SERVED" | "REFUSED";

export type PrescriptionDraft = {
  id: string;
  transactionId: string;
  customerId: string;
  patientName: string;
  patientAddress: string;
  prescriptionDate: string;
  prescriberName: string;
  prescriberPrcLicense: string;
  prescriberPtrNumber: string;
  prescriberS2Number?: string;
  clinicNameAddress: string;
  yellowRxReference?: string;
  genericName: string;
  dosageStrength: string;
  quantityPrescribed: number;
  quantityDispensed: number;
  quantityRemaining: number;
  directionsForUse: string;
  dispensingPharmacistName: string;
  dispensingPharmacistPrc: string;
  status: PrescriptionStatus;
  classAtDispense: DrugClassification;
  createdAt: string;
};

export type DispenseCheckpoint = {
  id: string;
  productId: string;
  productName: string;
  classAtDispense: DrugClassification;
  requiresPrescription: boolean;
  requiresS2: boolean;
  requiresYellowForm: boolean;
  requiresPharmacistAck: boolean;
  warning: string;
  blocked: boolean;
};

export type PatientMedicationProfileEntry = {
  id: string;
  customerId: string;
  patientName: string;
  phone?: string;
  date: string;
  orNumber: string;
  drugName: string;
  dosage: string;
  quantityDispensed: number;
  prescriber: string;
  dispensingPharmacist: string;
};

export type DDLogEntryType = "dispense-out" | "stock-receipt-in";

export type DDLogEntry = {
  id: string;
  entryNumber: number;
  type: DDLogEntryType;
  createdAt: string;
  patientName?: string;
  patientAddress?: string;
  supplierName?: string;
  deliveryDate?: string;
  purchaseOrderRef?: string;
  lotNumber?: string;
  productName: string;
  dosageStrength: string;
  quantityIn: number;
  quantityOut: number;
  runningBalance: number;
  yellowRxReference?: string;
  s2Reference?: string;
  prescriberName?: string;
  prescriberS2?: string;
  dispensingPharmacist?: string;
  orNumber?: string;
};

export type DDReconciliationEntry = {
  id: string;
  productId: string;
  productName: string;
  countedQuantity: number;
  systemQuantity: number;
  variance: number;
  reconciledAt: string;
  reconciledBy: string;
};

export type RxRedFlag = {
  id: string;
  severity: "warning" | "critical";
  title: string;
  reason: string;
  createdAt: string;
};

export type PrescriptionRefusal = {
  id: string;
  createdAt: string;
  pharmacistName: string;
  reason: string;
  patientName: string;
  productName: string;
};

export type RxPharmacist = {
  id: string;
  name: string;
  prcNumber: string;
  role: "pharmacist" | "admin";
};

export type RxSettings = {
  ddEddLowStockThreshold: number;
  profileRetentionYears: number;
  hardBlockPrototypeReset: boolean;
};

export type RxInspectionSnapshot = {
  totalRxTransactionsToday: number;
  totalDdEddTransactionsToday: number;
  openPartialFills: number;
  redFlagsToday: number;
  ddBalanceAlerts: number;
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
  createdAt: string;
};

export type User = {
  id: string;
  username: string;
  fullname: string;
  role: "admin" | "cashier";
  permissions: Record<PermissionKey, boolean>;
};

export type ScPwdSettings = {
  enabled: boolean;
  discountRate: number; // fixed 20%, read-only in UI
  vatRegistered: boolean;
  defaultMedicineEligibility: ScPwdEligibility;
  duplicateIdThreshold: number;
  dailyAlertThreshold: number;
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
  expiryAlertDays: number;
  scPwdSettings?: ScPwdSettings;
};

export type CartItem = {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  originalPrice?: number;
  vatExempt?: boolean;
  scPwdDiscounted?: boolean;
  scPwdDiscountAmount?: number;
  scPwdVatRemoved?: number;
};

export type TransactionItem = CartItem & {
  lineTotal: number;
};

export type ScPwdDiscountType = "sc" | "pwd";

export type ProxyPurchaseDetails = {
  proxyName: string;
  proxyRelation: string;
  proxyIdType: string;
  proxyIdNumber: string;
};

export type ScPwdCustomerDetails = {
  discountType: ScPwdDiscountType;
  idNumber: string;
  fullName: string;
  tin?: string;
  dualEligibility?: boolean;
  chosenDiscount?: ScPwdDiscountType;
  proxyPurchase?: boolean;
  proxyDetails?: ProxyPurchaseDetails;
};

export type ScPwdTransactionMetadata = ScPwdCustomerDetails & {
  scPwdDiscountAmount: number;
  scPwdVatRemoved: number;
  supervisorOverride?: boolean;
  overrideReason?: string;
  overrideBy?: string;
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
  remarks?: string;
  scPwdMetadata?: ScPwdTransactionMetadata;
};

export type HeldOrder = {
  id: string;
  reference: string;
  items: CartItem[];
  customerId: string;
  discount: number;
  remarks?: string;
  createdAt: string;
  scPwdDiscountActive?: boolean;
  scPwdDraft?: ScPwdCustomerDetails;
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

// === BIR Compliance Types ===

export type BirSettings = {
  tin: string;
  registeredName: string;
  registeredAddress: string;
  vatRegistered: boolean;
  ptuNumber: string;
  machineSerial: string;
  accreditationNumber: string;
  orSeriesStart: number;
  orSeriesEnd: number;
  currentOrNumber: number;
  zReadingCutoffTime: string; // e.g. "23:59"
};

export type PrinterConnectionType = "usb" | "bluetooth" | "lan";
export type PrinterRole = "or" | "report" | "both";
export type PrinterStatusType = "online" | "offline" | "error" | "paper-low";

export type PrinterProfile = {
  id: string;
  label: string;
  connectionType: PrinterConnectionType;
  address: string;
  paperWidth: 58 | 80;
  characterSet: string;
  autocut: boolean;
  partialCut: boolean;
  role: PrinterRole;
  isDefault: boolean;
  defaultForOr?: boolean;
  defaultForReport?: boolean;
  status: PrinterStatusType;
  baudRate?: number;
  bridgeUrl?: string;
  deviceId?: string;
  portInfo?: { vendorId?: number; productId?: number; serialNumber?: string };
  receiptLayout?: ReceiptLayoutConfig;
};

export type PrintJobResult =
  | { status: "success" }
  | { status: "failed"; retryable: boolean; reason: string }
  | { status: "offline"; retryable: boolean }
  | { status: "paper-low"; retryable: boolean }
  | { status: "error"; retryable: boolean; reason: string };

export type ReceiptLayoutConfig = {
  logoUrl: string;
  headerLines: string[];
  footerLines: string[];
  maxReceiptLines: number;
  autoCondense: boolean;
};

export type PrintVariant = "normal" | "void" | "reprint" | "x-reading" | "z-reading" | "daily-summary";

export type XReading = {
  id: string;
  reportDate: string;
  reportTime: string;
  machineSerial: string;
  beginningOrNumber: number;
  lastOrNumber: number;
  grossSales: number;
  vatableSales: number;
  vatExemptSales: number;
  vatAmount: number;
  zeroRatedSales: number;
  scDiscount: number;
  pwdDiscount: number;
  promotionalDiscount: number;
  totalDiscounts: number;
  totalVoids: number;
  voidAmount: number;
  totalReturns: number;
  returnAmount: number;
  netSales: number;
  generatedBy: string;
  generatedAt: string;
};

export type ZReading = XReading & {
  storeName: string;
  tin: string;
  ptuNumber: string;
  transactionCount: number;
  endingOrNumber: number;
  resetFlag: boolean;
  overrideReason?: string;
  overrideBy?: string;
  pdfPath?: string;
};

export type EJournalRow = {
  orNumber: number;
  transactionDate: string;
  transactionTime: string;
  cashierId: string;
  grossAmount: number;
  vatableAmount: number;
  vatAmount: number;
  vatExemptAmount: number;
  zeroRatedAmount: number;
  scDiscount: number;
  pwdDiscount: number;
  otherDiscounts: number;
  voidFlag: boolean;
  returnFlag: boolean;
  paymentMethod: string;
  netAmount: number;
};

export type ESalesRow = {
  date: string;
  beginningOr: number;
  endingOr: number;
  grossSales: number;
  vatableSales: number;
  vatAmount: number;
  vatExemptSales: number;
  zeroRatedSales: number;
  totalDiscounts: number;
  totalVoids: number;
  netSales: number;
};

export type AuditActionType =
  | "x-reading"
  | "z-reading"
  | "ejournal-export"
  | "esales-export"
  | "void"
  | "reprint"
  | "login"
  | "logout"
  | "settings-change"
  | "print-job"
  | "scpwd-apply"
  | "scpwd-remove"
  | "scpwd-override";

export type AuditEntry = {
  id: string;
  action: AuditActionType;
  user: string;
  timestamp: string;
  details: string;
  reportType?: string;
  requiredRole: "admin" | "supervisor" | "cashier";
};

export type ReprintQueueItemStatus = "pending" | "printed" | "failed";

export type ReprintQueueItem = {
  id: string;
  orNumber: number;
  transactionId: string;
  profileId: string;
  commandsBase64: string;
  variant: PrintVariant;
  jobType: PrinterActivityLog["jobType"];
  createdAt: string;
  status: ReprintQueueItemStatus;
  failureReason?: string;
};

export type VoidRecord = {
  id: string;
  originalOrNumber: number;
  voidTimestamp: string;
  authorizingUser: string;
  reason: string;
  transactionId: string;
};

export type PrintJobStatus = "success" | "failed";

export type PrinterActivityLog = {
  id: string;
  orNumber?: number;
  jobType: "receipt" | "x-reading" | "z-reading" | "daily-summary" | "void-receipt" | "reprint";
  timestamp: string;
  printerUsed: string;
  status: PrintJobStatus;
  failureReason?: string;
};

export type ScPwdTransactionLogRow = {
  id: string;
  transactionId: string;
  orNumber: string;
  timestamp: string;
  discountType: ScPwdDiscountType;
  customerName: string;
  idNumber: string;
  grossAmount: number;
  scPwdDiscountAmount: number;
  vatRemoved: number;
  netAmount: number;
  items: { name: string; qty: number; originalPrice: number; discountAmount: number; finalPrice: number }[];
  proxyPurchase?: boolean;
  supervisorOverride?: boolean;
};

export type ScPwdSummaryCard = {
  totalTransactions: number;
  totalScTransactions: number;
  totalPwdTransactions: number;
  totalScDiscount: number;
  totalPwdDiscount: number;
  totalVatRemoved: number;
  totalDeductibles: number;
  month: string;
};

export type ScPwdAlert = {
  id: string;
  type: "duplicate-id" | "daily-threshold" | "ineligible-item";
  severity: "warning" | "critical";
  message: string;
  idNumber?: string;
  transactionId?: string;
  timestamp: string;
  acknowledged: boolean;
};
