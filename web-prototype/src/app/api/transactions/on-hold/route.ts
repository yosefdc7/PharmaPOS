import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextResponse } from "next/server";

export async function GET() {
  await ensureDb();
  const db = getDb();

  const result = await db.execute("SELECT * FROM held_orders ORDER BY created_at DESC");

  const heldOrders = result.rows.map((row) => {
    const obj = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v]));
    return camelCaseHeldOrder(obj);
  });

  return NextResponse.json(heldOrders);
}

const HELD_CAMEL_MAP: Record<string, string> = {
  customer_id: "customerId",
  created_at: "createdAt",
  sc_pwd_discount_active: "scPwdDiscountActive",
  sc_pwd_draft: "scPwdDraft",
};

function camelCaseHeldOrder(row: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const mapped = HELD_CAMEL_MAP[key] ?? key;
    if (key === "items" || key === "sc_pwd_draft") {
      result[mapped] = typeof value === "string" ? JSON.parse(value) : value;
    } else if (key === "sc_pwd_discount_active") {
      result[mapped] = value === 1 ? true : value === 0 ? false : value;
    } else {
      result[mapped] = value;
    }
  }
  return result;
}
