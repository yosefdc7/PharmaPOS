CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  barcode TEXT NOT NULL DEFAULT '',
  category_id TEXT NOT NULL DEFAULT '',
  supplier TEXT NOT NULL DEFAULT '',
  price REAL NOT NULL DEFAULT 0,
  original_price REAL,
  cost REAL,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  tracks_stock INTEGER NOT NULL DEFAULT 1,
  expiration_date TEXT NOT NULL DEFAULT '',
  image_color TEXT NOT NULL DEFAULT '#5433FF',
  featured INTEGER NOT NULL DEFAULT 0,
  sc_pwd_eligibility TEXT,
  vat_exempt INTEGER,
  is_prescription INTEGER,
  drug_classification TEXT,
  generic_name TEXT,
  brand_name TEXT,
  active_ingredient TEXT,
  dosage_strength TEXT,
  dosage_form TEXT,
  fda_cpr_number TEXT,
  behind_counter INTEGER,
  dd_last_reconciliation_at TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  fullname TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'cashier',
  permissions TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  store TEXT NOT NULL DEFAULT '',
  address_one TEXT NOT NULL DEFAULT '',
  address_two TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  currency_symbol TEXT NOT NULL DEFAULT '$',
  vat_percentage REAL NOT NULL DEFAULT 0,
  charge_tax INTEGER NOT NULL DEFAULT 0,
  quick_billing INTEGER NOT NULL DEFAULT 0,
  receipt_footer TEXT NOT NULL DEFAULT '',
  expiry_alert_days INTEGER NOT NULL DEFAULT 30,
  sc_pwd_settings TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  local_number TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL DEFAULT '[]',
  customer_id TEXT NOT NULL DEFAULT '',
  cashier_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  paid REAL NOT NULL DEFAULT 0,
  change_amount REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_reference TEXT NOT NULL DEFAULT '',
  sync_status TEXT NOT NULL DEFAULT 'pending',
  refunded_at TEXT,
  refund_reason TEXT,
  refund_reference TEXT,
  remarks TEXT,
  sc_pwd_metadata TEXT
);

CREATE TABLE IF NOT EXISTS held_orders (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL DEFAULT '[]',
  customer_id TEXT NOT NULL DEFAULT '',
  discount REAL NOT NULL DEFAULT 0,
  remarks TEXT,
  created_at TEXT NOT NULL DEFAULT '',
  sc_pwd_discount_active INTEGER,
  sc_pwd_draft TEXT
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL DEFAULT '',
  operation TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  entity_version INTEGER NOT NULL DEFAULT 1,
  resolved_conflict TEXT
);

CREATE TABLE IF NOT EXISTS _meta (
  id TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '{}'
);
