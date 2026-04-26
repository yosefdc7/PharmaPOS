import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  await ensureDb();
  const db = getDb();
  const { barcode } = await request.json();

  if (!barcode) {
    return NextResponse.json({ error: "barcode is required" }, { status: 400 });
  }

  const result = await db.execute({
    sql: "SELECT * FROM products WHERE barcode = ?",
    args: [barcode],
  });

  if (result.rows.length === 0) {
    return NextResponse.json({ product: null });
  }

  const row = Object.fromEntries(
    Object.entries(result.rows[0]).map(([k, v]) => [k, v])
  );

  // Convert snake_case to camelCase
  const PRODUCT_CAMEL_MAP: Record<string, string> = {
    category_id: "categoryId",
    original_price: "originalPrice",
    min_stock: "minStock",
    tracks_stock: "tracksStock",
    expiration_date: "expirationDate",
    image_color: "imageColor",
    sc_pwd_eligibility: "scPwdEligibility",
    vat_exempt: "vatExempt",
    is_prescription: "isPrescription",
    drug_classification: "drugClassification",
    generic_name: "genericName",
    brand_name: "brandName",
    active_ingredient: "activeIngredient",
    dosage_strength: "dosageStrength",
    dosage_form: "dosageForm",
    fda_cpr_number: "fdaCprNumber",
    behind_counter: "behindCounter",
    dd_last_reconciliation_at: "ddLastReconciliationAt",
  };

  const product: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const mapped = PRODUCT_CAMEL_MAP[key] ?? key;
    if (["tracks_stock", "featured", "vat_exempt", "is_prescription", "behind_counter"].includes(key)) {
      product[mapped] = value === 1 ? true : value === 0 ? false : value;
    } else {
      product[mapped] = value;
    }
  }

  return NextResponse.json({ product });
}
