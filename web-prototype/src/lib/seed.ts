import type { Category, Customer, Product, ScPwdSettings, Settings, SyncQueueItem, Transaction, User } from "./types";

export const seedCategories: Category[] = [
  { id: "cat-pain", name: "Pain Relief" },
  { id: "cat-cold", name: "Cold & Flu" },
  { id: "cat-vitamins", name: "Vitamins" },
  { id: "cat-first-aid", name: "First Aid" }
];

export const seedProducts: Product[] = [
  {
    id: "prd-para-500",
    name: "Paracetamol 500mg",
    barcode: "100001",
    categoryId: "cat-pain",
    supplier: "HealthSource",
    price: 4.5,
    quantity: 42,
    minStock: 10,
    tracksStock: true,
    expirationDate: "2027-08-31",
    imageColor: "#5433FF",
    scPwdEligibility: "medicine",
    vatExempt: false,
    isPrescription: false
  },
  {
    id: "prd-ibu-200",
    name: "Ibuprofen 200mg",
    barcode: "100002",
    categoryId: "cat-pain",
    supplier: "MediSupply",
    price: 6.25,
    quantity: 28,
    minStock: 8,
    tracksStock: true,
    expirationDate: "2027-05-18",
    imageColor: "#F6A4EC",
    scPwdEligibility: "medicine",
    vatExempt: false,
    isPrescription: false
  },
  {
    id: "prd-cough",
    name: "Cough Syrup 100ml",
    barcode: "100003",
    categoryId: "cat-cold",
    supplier: "Careline",
    price: 8.95,
    quantity: 18,
    minStock: 6,
    tracksStock: true,
    expirationDate: "2026-12-12",
    imageColor: "#97FBD1",
    scPwdEligibility: "medicine",
    vatExempt: false,
    isPrescription: false
  },
  {
    id: "prd-vitc",
    name: "Vitamin C 1000mg",
    barcode: "100004",
    categoryId: "cat-vitamins",
    supplier: "NutraPlus",
    price: 12.4,
    quantity: 33,
    minStock: 10,
    tracksStock: true,
    expirationDate: "2028-01-20",
    imageColor: "#1CC6FF",
    scPwdEligibility: "non-medicine",
    vatExempt: true,
    isPrescription: false
  },
  {
    id: "prd-bandage",
    name: "Elastic Bandage",
    barcode: "100005",
    categoryId: "cat-first-aid",
    supplier: "ClinicPro",
    price: 3.2,
    quantity: 15,
    minStock: 5,
    tracksStock: true,
    expirationDate: "2029-04-30",
    imageColor: "#4379FF",
    scPwdEligibility: "non-medicine",
    vatExempt: true,
    isPrescription: false
  },
  {
    id: "prd-amox-500",
    name: "Amoxicillin 500mg (Rx)",
    barcode: "100007",
    categoryId: "cat-first-aid",
    supplier: "MediSupply",
    price: 9.5,
    quantity: 24,
    minStock: 8,
    tracksStock: true,
    expirationDate: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 10);
      return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
    })(),
    imageColor: "#FF8A30",
    scPwdEligibility: "medicine",
    vatExempt: false,
    isPrescription: true
  },
  {
    id: "prd-ceph-250",
    name: "Cephalexin 250mg (Rx)",
    barcode: "100008",
    categoryId: "cat-first-aid",
    supplier: "ClinicPro",
    price: 7.8,
    quantity: 8,
    minStock: 5,
    tracksStock: true,
    expirationDate: (() => {
      const d = new Date();
      d.setDate(d.getDate() - 2);
      return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
    })(),
    imageColor: "#E04F4F",
    scPwdEligibility: "medicine",
    vatExempt: false,
    isPrescription: true
  },
  {
    id: "prd-consult",
    name: "Pharmacist Consultation",
    barcode: "100006",
    categoryId: "cat-first-aid",
    supplier: "In-store",
    price: 15,
    quantity: 0,
    minStock: 0,
    tracksStock: false,
    expirationDate: "N/A",
    imageColor: "#5433FF",
    scPwdEligibility: "excluded",
    vatExempt: true,
    isPrescription: false
  },
  {
    id: "prd-masks",
    name: "Disposable Face Masks 10s",
    barcode: "100009",
    categoryId: "cat-first-aid",
    supplier: "ClinicPro",
    price: 5.0,
    quantity: 50,
    minStock: 10,
    tracksStock: true,
    expirationDate: "2030-01-01",
    imageColor: "#2ECC71",
    scPwdEligibility: "non-medicine",
    vatExempt: true,
    isPrescription: false
  },
  {
    id: "prd-aspirin",
    name: "Aspirin 81mg",
    barcode: "100010",
    categoryId: "cat-pain",
    supplier: "HealthSource",
    price: 3.75,
    quantity: 60,
    minStock: 12,
    tracksStock: true,
    expirationDate: "2027-11-30",
    imageColor: "#E74C3C",
    scPwdEligibility: "medicine",
    vatExempt: false,
    isPrescription: false
  },
  {
    id: "prd-lancets",
    name: "Blood Lancets 100s",
    barcode: "100011",
    categoryId: "cat-first-aid",
    supplier: "MediSupply",
    price: 18.0,
    quantity: 20,
    minStock: 5,
    tracksStock: true,
    expirationDate: "2030-06-15",
    imageColor: "#3498DB",
    scPwdEligibility: "non-medicine",
    vatExempt: true,
    isPrescription: false
  }
];

export const seedCustomers: Customer[] = [
  { id: "walk-in", name: "Walk in customer", phone: "", email: "", createdAt: new Date().toISOString() },
  { id: "cus-ana", name: "Ana Reyes", phone: "+63 900 111 2222", email: "ana@example.com", createdAt: new Date().toISOString() },
  { id: "cus-lee", name: "Marcus Lee", phone: "+63 900 333 4444", email: "marcus@example.com", createdAt: new Date().toISOString() }
];

export const seedUsers: User[] = [
  {
    id: "usr-admin",
    username: "admin",
    fullname: "Administrator",
    role: "admin",
    permissions: {
      products: true,
      categories: true,
      customers: true,
      transactions: true,
      rx: true,
      controlTower: true,
      users: true,
      settings: true,
      reports: true,
      sync: true
    }
  },
  {
    id: "usr-cashier",
    username: "cashier",
    fullname: "Store Cashier",
    role: "cashier",
    permissions: {
      products: false,
      categories: false,
      customers: true,
      transactions: true,
      rx: false,
      controlTower: false,
      users: false,
      settings: false,
      reports: false,
      sync: false
    }
  }
];

const seedScPwdSettings: ScPwdSettings = {
  enabled: true,
  discountRate: 20,
  vatRegistered: true,
  defaultMedicineEligibility: "medicine",
  duplicateIdThreshold: 2,
  dailyAlertThreshold: 5
};

export const seedSettings: Settings = {
  id: "store",
  store: "PharmaPOS PH Demo",
  addressOne: "123 Main Street",
  addressTwo: "Makati City",
  contact: "+63 2 555 0199",
  currencySymbol: "$",
  vatPercentage: 12,
  chargeTax: true,
  quickBilling: false,
  receiptFooter: "Thank you for choosing PharmaPOS PH.",
  expiryAlertDays: 30,
  scPwdSettings: seedScPwdSettings
};

export const seedTransactions: Transaction[] = [];
export const seedSyncQueue: SyncQueueItem[] = [];
