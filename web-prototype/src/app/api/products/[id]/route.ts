import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { requireAuth } from "@/lib/server/auth";
import { NextRequest, NextResponse } from "next/server";

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

function camelCaseRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const mapped = PRODUCT_CAMEL_MAP[key] ?? key;
    if (["tracks_stock", "featured", "vat_exempt", "is_prescription", "behind_counter"].includes(key)) {
      result[mapped] = value === 1 ? true : value === 0 ? false : value;
    } else {
      result[mapped] = value;
    }
  }
  return result;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDb();
  const db = getDb();
  const { id } = await params;

  const result = await db.execute({
    sql: "SELECT * FROM products WHERE id = ?",
    args: [id],
  });

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = Object.fromEntries(
    Object.entries(result.rows[0]).map(([k, v]) => [k, v])
  );
  return NextResponse.json(camelCaseRow(row));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureDb();
  const db = getDb();
  const { id } = await params;
  const body = await request.json();
  const bypassVersionGate = request.headers.get("x-sync-source") === "sync-processor";

  const existing = await db.execute({
    sql: "SELECT * FROM products WHERE id = ?",
    args: [id],
  });

  if (!bypassVersionGate && existing.rows.length > 0) {
    const current = Object.fromEntries(Object.entries(existing.rows[0]).map(([k, v]) => [k, v]));
    const currentVersion = typeof current.version === "number" ? current.version : Number(current.version ?? 0);
    const requestedVersion = typeof body.version === "number" ? body.version : Number(body.version ?? 0);

    if (requestedVersion < currentVersion) {
      return NextResponse.json(
        { error: "Version conflict", current: camelCaseRow(current) },
        { status: 409 }
      );
    }
  }

  const row = toSnakeCase({ ...body, id, version: body.version ?? 1, updatedAt: body.updatedAt ?? new Date().toISOString() });
  const keys = Object.keys(row);
  const values = Object.values(row);

  await db.execute({
    sql: `INSERT INTO products (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})
          ON CONFLICT (id) DO UPDATE SET ${keys.filter((k) => k !== "id").map((k) => `${k} = excluded.${k}`).join(", ")}`,
    args: values as InValue[],
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request, "admin");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureDb();
  const db = getDb();
  const { id } = await params;

  await db.execute({
    sql: "DELETE FROM products WHERE id = ?",
    args: [id],
  });

  return NextResponse.json({ success: true });
}
