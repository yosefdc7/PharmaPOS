import bcrypt from "bcryptjs";
import type { Client } from "@libsql/client";

const SALT_ROUNDS = 10;

const ADMIN_PERMS = JSON.stringify({
  products: true, categories: true, customers: true, transactions: true,
  rx: true, controlTower: true, users: true, settings: true,
  reports: true, sync: true, void: true, refund: true, override: true,
  xReading: true, zReadingGenerate: true, zReadingView: true,
});

const SUPERVISOR_PERMS = JSON.stringify({
  products: false, categories: false, customers: true, transactions: true,
  rx: false, controlTower: false, users: false, settings: false,
  reports: true, sync: false, void: true, refund: true, override: true,
  xReading: true, zReadingGenerate: false, zReadingView: true,
});

const PHARMACIST_PERMS = JSON.stringify({
  products: false, categories: false, customers: true, transactions: true,
  rx: true, controlTower: false, users: false, settings: false,
  reports: false, sync: false, void: false, refund: false, override: false,
  xReading: false, zReadingGenerate: false, zReadingView: false,
});

const CASHIER_PERMS = JSON.stringify({
  products: false, categories: false, customers: true, transactions: true,
  rx: false, controlTower: false, users: false, settings: false,
  reports: false, sync: false, void: false, refund: false, override: false,
  xReading: false, zReadingGenerate: false, zReadingView: false,
});

export async function seedDatabase(db: Client): Promise<boolean> {
  const metaResult = await db.execute({
    sql: "SELECT value FROM _meta WHERE id = ?",
    args: ["seeded"],
  });

  if (metaResult.rows.length > 0) {
    return false;
  }

  await db.batch([
    { sql: "INSERT INTO categories (id, name) VALUES (?, ?)", args: ["cat-pain", "Pain Relief"] },
    { sql: "INSERT INTO categories (id, name) VALUES (?, ?)", args: ["cat-cold", "Cold & Flu"] },
    { sql: "INSERT INTO categories (id, name) VALUES (?, ?)", args: ["cat-vitamins", "Vitamins"] },
    { sql: "INSERT INTO categories (id, name) VALUES (?, ?)", args: ["cat-first-aid", "First Aid"] },
  ]);

  const now = new Date();
  const amoxExpiry = (() => { const d = new Date(now); d.setDate(d.getDate() + 10); return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`; })();
  const cephExpiry = (() => { const d = new Date(now); d.setDate(d.getDate() - 2); return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`; })();

  const products = [
    ["prd-para-500", "Paracetamol 500mg", "100001", "cat-pain", "HealthSource", 4.5, null, null, 42, 10, 1, "2027-08-31", "#5433FF", 0, "medicine", 0, 0, null, null, null, null, null, null, null, null, null],
    ["prd-ibu-200", "Ibuprofen 200mg", "100002", "cat-pain", "MediSupply", 6.25, null, null, 28, 8, 1, "2027-05-18", "#F6A4EC", 0, "medicine", 0, 0, null, null, null, null, null, null, null, null, null],
    ["prd-cough", "Cough Syrup 100ml", "100003", "cat-cold", "Careline", 8.95, null, null, 18, 6, 1, "2026-12-12", "#97FBD1", 0, "medicine", 0, 0, null, null, null, null, null, null, null, null, null],
    ["prd-vitc", "Vitamin C 1000mg", "100004", "cat-vitamins", "NutraPlus", 12.4, null, null, 33, 10, 1, "2028-01-20", "#1CC6FF", 0, "non-medicine", 1, 0, null, null, null, null, null, null, null, null, null],
    ["prd-bandage", "Elastic Bandage", "100005", "cat-first-aid", "ClinicPro", 3.2, null, null, 15, 5, 1, "2029-04-30", "#4379FF", 0, "non-medicine", 1, 0, null, null, null, null, null, null, null, null, null],
    ["prd-amox-500", "Amoxicillin 500mg (Rx)", "100007", "cat-first-aid", "MediSupply", 9.5, null, null, 24, 8, 1, amoxExpiry, "#FF8A30", 0, "medicine", 0, 1, null, null, null, null, null, null, null, null, null],
    ["prd-ceph-250", "Cephalexin 250mg (Rx)", "100008", "cat-first-aid", "ClinicPro", 7.8, null, null, 8, 5, 1, cephExpiry, "#E04F4F", 0, "medicine", 0, 1, null, null, null, null, null, null, null, null, null],
    ["prd-consult", "Pharmacist Consultation", "100006", "cat-first-aid", "In-store", 15, null, null, 0, 0, 0, "N/A", "#5433FF", 0, "excluded", 1, 0, null, null, null, null, null, null, null, null, null],
    ["prd-masks", "Disposable Face Masks 10s", "100009", "cat-first-aid", "ClinicPro", 5.0, null, null, 50, 10, 1, "2030-01-01", "#2ECC71", 0, "non-medicine", 1, 0, null, null, null, null, null, null, null, null, null],
    ["prd-aspirin", "Aspirin 81mg", "100010", "cat-pain", "HealthSource", 3.75, null, null, 60, 12, 1, "2027-11-30", "#E74C3C", 0, "medicine", 0, 0, null, null, null, null, null, null, null, null, null],
    ["prd-lancets", "Blood Lancets 100s", "100011", "cat-first-aid", "MediSupply", 18.0, null, null, 20, 5, 1, "2030-06-15", "#3498DB", 0, "non-medicine", 1, 0, null, null, null, null, null, null, null, null, null],
  ] as const;

  await db.batch(products.map((p) => ({
    sql: `INSERT INTO products (id, name, barcode, category_id, supplier, price, original_price, cost,
           quantity, min_stock, tracks_stock, expiration_date, image_color, featured,
           sc_pwd_eligibility, vat_exempt, is_prescription, drug_classification, generic_name,
           brand_name, active_ingredient, dosage_strength, dosage_form, fda_cpr_number,
           behind_counter, dd_last_reconciliation_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [...p],
  })) as any);

  const isoNow = now.toISOString();
  await db.batch([
    { sql: "INSERT INTO customers (id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?)", args: ["walk-in", "Walk in customer", "", "", isoNow] },
    { sql: "INSERT INTO customers (id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?)", args: ["cus-ana", "Ana Reyes", "+63 900 111 2222", "ana@example.com", isoNow] },
    { sql: "INSERT INTO customers (id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?)", args: ["cus-lee", "Marcus Lee", "+63 900 333 4444", "marcus@example.com", isoNow] },
  ]);

  const adminHash = await bcrypt.hash("admin", SALT_ROUNDS);
  const supervisorHash = await bcrypt.hash("supervisor", SALT_ROUNDS);
  const pharmacistHash = await bcrypt.hash("pharmacist", SALT_ROUNDS);
  const cashierHash = await bcrypt.hash("cashier", SALT_ROUNDS);

  await db.batch([
    { sql: "INSERT INTO users (id, username, fullname, password_hash, role, permissions, status) VALUES (?, ?, ?, ?, ?, ?, ?)", args: ["usr-admin", "admin", "Administrator", adminHash, "admin", ADMIN_PERMS, ""] },
    { sql: "INSERT INTO users (id, username, fullname, password_hash, role, permissions, status) VALUES (?, ?, ?, ?, ?, ?, ?)", args: ["usr-supervisor", "supervisor", "Shift Supervisor", supervisorHash, "supervisor", SUPERVISOR_PERMS, ""] },
    { sql: "INSERT INTO users (id, username, fullname, password_hash, role, permissions, status) VALUES (?, ?, ?, ?, ?, ?, ?)", args: ["usr-pharmacist", "pharmacist", "Staff Pharmacist", pharmacistHash, "pharmacist", PHARMACIST_PERMS, ""] },
    { sql: "INSERT INTO users (id, username, fullname, password_hash, role, permissions, status) VALUES (?, ?, ?, ?, ?, ?, ?)", args: ["usr-cashier", "cashier", "Store Cashier", cashierHash, "cashier", CASHIER_PERMS, ""] },
  ]);

  await db.execute({
    sql: `INSERT INTO settings (id, store, address_one, address_two, contact, currency_symbol,
           vat_percentage, charge_tax, quick_billing, receipt_footer, expiry_alert_days, sc_pwd_settings)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: ["store", "PharmaPOS PH Demo", "123 Main Street", "Makati City", "+63 2 555 0199", "$", 12, 1, 0, "Thank you for choosing PharmaPOS PH.", 30, JSON.stringify({ enabled: true, discountRate: 20, vatRegistered: true, defaultMedicineEligibility: "medicine", duplicateIdThreshold: 2, dailyAlertThreshold: 5 })],
  });

  await db.execute({ sql: "INSERT INTO _meta (id, value) VALUES (?, ?)", args: ["seeded", JSON.stringify(true)] });
  await db.execute({ sql: "INSERT INTO _meta (id, value) VALUES (?, ?)", args: ["featureFlags", JSON.stringify({ sync: false, payments: false, refunds: false })] });

  return true;
}
