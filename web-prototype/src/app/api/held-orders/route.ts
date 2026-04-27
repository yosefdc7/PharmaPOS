import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextRequest, NextResponse } from "next/server";

const HELD_SNAKE_MAP: Record<string, string> = {
  customerId: "customer_id",
  scPwdDiscountActive: "sc_pwd_discount_active",
  scPwdDraft: "sc_pwd_draft",
  createdAt: "created_at",
  updatedAt: "updated_at",
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

const HELD_CAMEL_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(HELD_SNAKE_MAP).map(([k, v]) => [v, k])
);

function toCamelRow(row: Record<string, unknown>): Record<string, unknown> {
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
}

export async function GET(request: NextRequest) {
  await ensureDb();
  const db = getDb();

  const since = request.nextUrl.searchParams.get("since");
  const sql = since
    ? "SELECT * FROM held_orders WHERE updated_at > ? ORDER BY created_at DESC"
    : "SELECT * FROM held_orders ORDER BY created_at DESC";

  const result = since ? await db.execute({ sql, args: [since] as InValue[] }) : await db.execute(sql);

  const heldOrders = result.rows.map((row) => {
    return toCamelRow(Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v])));
  });

  return NextResponse.json(heldOrders);
}

export async function POST(request: NextRequest) {
  await ensureDb();
  const db = getDb();
  const body = await request.json();
  const bypassVersionGate = request.headers.get("x-sync-source") === "sync-processor";

  const existing = await db.execute({
    sql: "SELECT * FROM held_orders WHERE id = ?",
    args: [body.id],
  });

  if (!bypassVersionGate && existing.rows.length > 0) {
    const row = Object.fromEntries(Object.entries(existing.rows[0]).map(([k, v]) => [k, v]));
    const currentVersion = typeof row.version === "number" ? row.version : Number(row.version ?? 0);
    const requestedVersion = typeof body.version === "number" ? body.version : Number(body.version ?? 0);

    if (requestedVersion < currentVersion) {
      return NextResponse.json(
        { error: "Version conflict", current: toCamelRow(row) },
        { status: 409 }
      );
    }
  }

  const row = toSnakeRow({ ...body, version: body.version ?? 1, updatedAt: body.updatedAt ?? new Date().toISOString() });
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
