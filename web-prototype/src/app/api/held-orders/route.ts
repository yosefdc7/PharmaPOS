import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextRequest, NextResponse } from "next/server";

const HELD_SNAKE_MAP: Record<string, string> = {
  customerId: "customer_id",
  scPwdDiscountActive: "sc_pwd_discount_active",
  scPwdDraft: "sc_pwd_draft",
  createdAt: "created_at",
};

function toSnakeRow(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const mapped = HELD_SNAKE_MAP[key] ?? key;
    if (key === "items" || key === "scPwdDraft") {
      result[mapped] = JSON.stringify(value);
    } else if (key === "scPwdDiscountActive") {
      result[mapped] = value ? 1 : 0;
    } else {
      result[mapped] = value;
    }
  }
  return result;
}

export async function GET() {
  await ensureDb();
  const db = getDb();

  const result = await db.execute("SELECT * FROM held_orders ORDER BY created_at DESC");

  const HELD_CAMEL_MAP: Record<string, string> = Object.fromEntries(
    Object.entries(HELD_SNAKE_MAP).map(([k, v]) => [v, k])
  );

  const heldOrders = result.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const mapped = HELD_CAMEL_MAP[key] ?? key;
      if (key === "items" || key === "sc_pwd_draft") {
        obj[mapped] = typeof value === "string" ? JSON.parse(value) : value;
      } else if (key === "sc_pwd_discount_active") {
        obj[mapped] = value === 1;
      } else {
        obj[mapped] = value;
      }
    }
    return obj;
  });

  return NextResponse.json(heldOrders);
}

export async function POST(request: NextRequest) {
  await ensureDb();
  const db = getDb();
  const body = await request.json();

  const row = toSnakeRow(body);
  const keys = Object.keys(row);
  const values = Object.values(row);
  const placeholders = keys.map(() => "?").join(", ");

  await db.execute({
    sql: `INSERT INTO held_orders (${keys.join(", ")}) VALUES (${placeholders})
          ON CONFLICT (id) DO UPDATE SET ${keys.filter((k) => k !== "id").map((k) => `${k} = excluded.${k}`).join(", ")}`,
    args: values as InValue[],
  });

  return NextResponse.json({ success: true });
}
