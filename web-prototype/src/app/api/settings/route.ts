import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextRequest, NextResponse } from "next/server";

const SETTINGS_CAMEL_MAP: Record<string, string> = {
  address_one: "addressOne",
  address_two: "addressTwo",
  currency_symbol: "currencySymbol",
  vat_percentage: "vatPercentage",
  charge_tax: "chargeTax",
  quick_billing: "quickBilling",
  receipt_footer: "receiptFooter",
  expiry_alert_days: "expiryAlertDays",
  sc_pwd_settings: "scPwdSettings",
  updated_at: "updatedAt",
};

function rowToSettings(row: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const mapped = SETTINGS_CAMEL_MAP[key] ?? key;
    if (key === "sc_pwd_settings") {
      result[mapped] = typeof value === "string" && value ? JSON.parse(value) : value;
    } else if (key === "charge_tax" || key === "quick_billing") {
      result[mapped] = value === 1;
    } else {
      result[mapped] = value;
    }
  }
  return result;
}

const SETTINGS_SNAKE_MAP = Object.fromEntries(
  Object.entries(SETTINGS_CAMEL_MAP).map(([k, v]) => [v, k])
);

function settingsToRow(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const mapped = SETTINGS_SNAKE_MAP[key] ?? key;
    if (key === "scPwdSettings") {
      result[mapped] = value ? JSON.stringify(value) : null;
    } else if (key === "chargeTax" || key === "quickBilling") {
      result[mapped] = value ? 1 : 0;
    } else {
      result[mapped] = value;
    }
  }
  return result;
}

export async function GET(request: NextRequest) {
  await ensureDb();
  const db = getDb();

  const since = request.nextUrl.searchParams.get("since");
  const sql = since
    ? "SELECT * FROM settings WHERE id = ? AND updated_at > ?"
    : "SELECT * FROM settings WHERE id = ?";
  const args = since ? ["store", since] : ["store"];

  const result = await db.execute({
    sql,
    args,
  });

  if (result.rows.length === 0) {
    return NextResponse.json(since ? [] : null);
  }

  const row = Object.fromEntries(Object.entries(result.rows[0]).map(([k, v]) => [k, v]));
  const mapped = rowToSettings(row);
  return NextResponse.json(since ? [mapped] : mapped);
}

export async function POST(request: NextRequest) {
  await ensureDb();
  const db = getDb();
  const body = await request.json();

  const row = settingsToRow({ id: "store", ...body, version: body.version ?? 1, updatedAt: body.updatedAt ?? new Date().toISOString() });
  const keys = Object.keys(row);
  const values = Object.values(row);
  const placeholders = keys.map(() => "?").join(", ");

  await db.execute({
    sql: `INSERT INTO settings (${keys.join(", ")}) VALUES (${placeholders})
          ON CONFLICT (id) DO UPDATE SET ${keys.filter((k) => k !== "id").map((k) => `${k} = excluded.${k}`).join(", ")}`,
    args: values as InValue[],
  });

  return NextResponse.json({ success: true });
}
