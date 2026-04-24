import type { Category, Customer, Product, Settings, SyncQueueItem, Transaction, User } from "./types";

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
    imageColor: "#dbeafe"
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
    imageColor: "#fee2e2"
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
    imageColor: "#dcfce7"
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
    imageColor: "#fef3c7"
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
    imageColor: "#ede9fe"
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
    imageColor: "#e0f2fe"
  }
];

export const seedCustomers: Customer[] = [
  { id: "walk-in", name: "Walk in customer", phone: "", email: "" },
  { id: "cus-ana", name: "Ana Reyes", phone: "+63 900 111 2222", email: "ana@example.com" },
  { id: "cus-lee", name: "Marcus Lee", phone: "+63 900 333 4444", email: "marcus@example.com" }
];

export const seedUsers: User[] = [
  {
    id: "usr-admin",
    username: "admin",
    fullname: "Administrator",
    role: "admin",
    permissions: { products: true, categories: true, transactions: true, users: true, settings: true }
  },
  {
    id: "usr-cashier",
    username: "cashier",
    fullname: "Store Cashier",
    role: "cashier",
    permissions: { products: false, categories: false, transactions: true, users: false, settings: false }
  }
];

export const seedSettings: Settings = {
  id: "store",
  store: "PharmaSpot Demo",
  addressOne: "123 Main Street",
  addressTwo: "Makati City",
  contact: "+63 2 555 0199",
  currencySymbol: "$",
  vatPercentage: 12,
  chargeTax: true,
  quickBilling: false,
  receiptFooter: "Thank you for choosing PharmaSpot."
};

export const seedTransactions: Transaction[] = [];
export const seedSyncQueue: SyncQueueItem[] = [];
