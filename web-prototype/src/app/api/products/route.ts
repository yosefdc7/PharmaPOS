import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { requireAuth } from "@/lib/server/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  await ensureDb();
  const db = getDb();

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search");
  const category = searchParams.get("category");
  const barcode = searchParams.get("barcode");
  const since = searchParams.get("since");

  let sql = "SELECT * FROM products WHERE 1=1";
  const args: InValue[] = [];

  if (search) {
    sql += " AND (name LIKE ? OR barcode LIKE ?)";
    args.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    sql += " AND category_id = ?";
    args.push(category);
  }
  if (barcode) {
    sql += " AND barcode = ?";
    args.push(barcode);
  }
  if (since) {
    sql += " AND updated_at > ?";
    args.push(since);
  }

  sql += " ORDER BY name";

  const result = await db.execute({ sql, args });

  const products = result.rows.map((row) => {
    const obj = Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, v])
    );
    return camelCaseProductRow(obj);
  });

  return NextResponse.json(products);
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request); // Any authenticated user
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDb();
  const db = getDb();
  const body = await request.json();

  // Support both single product and array of products
  const items = Array.isArray(body) ? body : [body];
  const batch = items.map((item: Record<string, unknown>): { sql: string; args: InValue[] } => {
    const row = toSnakeCase({ ...item, version: item.version ?? 1, updatedAt: item.updatedAt ?? new Date().toISOString() });
    const keys = Object.keys(row);
    const values = Object.values(row);
    const placeholders = keys.map(() => "?").join(", ");
    return {
      sql: `INSERT INTO products (${keys.join(", ")}) VALUES (${placeholders})
            ON CONFLICT (id) DO UPDATE SET ${keys.filter((k) => k !== "id").map((k) => `${k} = excluded.${k}`).join(", ")}`,
      args: values as InValue[],
    };
  });

  await db.batch(batch);

  return NextResponse.json({ success: true });
}

const PRODUCT_SNAKE_MAP: Record<string, string> = {
  categoryId: "category_id",
  originalPrice: "original_price",
  minStock: "min_stock",
  tracksStock: "tracks_stock",
  expirationDate: "expiration_date",
  imageColor: "image_color",
  scPwdEligibility: "sc_pwd_eligibility",
  vatExempt: "vat_exempt",
  isPrescription: "is_prescription",
  drugClassification: "drug_classification",
  genericName: "generic_name",
  brandName: "brand_name",
  activeIngredient: "active_ingredient",
  dosageStrength: "dosage_strength",
  dosageForm: "dosage_form",
  fdaCprNumber: "fda_cpr_number",
  behindCounter: "behind_counter",
  ddLastReconciliationAt: "dd_last_reconciliation_at",
  updatedAt: "updated_at",
};

const PRODUCT_CAMEL_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(PRODUCT_SNAKE_MAP).map(([k, v]) => [v, k])
);

function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const mapped = PRODUCT_SNAKE_MAP[key] ?? key;
    result[mapped] = value;
  }
  return result;
}

function camelCaseProductRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const mapped = PRODUCT_CAMEL_MAP[key] ?? key;
    // Convert SQLite integers back to booleans where appropriate
    if (["tracks_stock", "featured", "vat_exempt", "is_prescription", "behind_counter"].includes(key)) {
      result[mapped] = value === 1 ? true : value === 0 ? false : value;
    } else {
      result[mapped] = value;
    }
  }
  return result;
}
