import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextRequest, NextResponse } from "next/server";

const CUSTOMER_CAMEL_MAP: Record<string, string> = {
  created_at: "createdAt",
  updated_at: "updatedAt",
};

export async function GET(request: NextRequest) {
  await ensureDb();
  const db = getDb();

  const since = request.nextUrl.searchParams.get("since");
  const sql = since
    ? "SELECT * FROM customers WHERE updated_at > ? ORDER BY name"
    : "SELECT * FROM customers ORDER BY name";

  const result = since ? await db.execute({ sql, args: [since] }) : await db.execute(sql);

  const customers = result.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      obj[CUSTOMER_CAMEL_MAP[key] ?? key] = value;
    }
    return obj;
  });

  return NextResponse.json(customers);
}

export async function POST(request: NextRequest) {
  await ensureDb();
  const db = getDb();
  const body = await request.json();

  const createdAt = body.createdAt ?? new Date().toISOString();
  const updatedAt = body.updatedAt ?? new Date().toISOString();
  const args = [body.id, body.name ?? "", body.phone ?? "", body.email ?? "", createdAt, body.version ?? 1, updatedAt];

  await db.execute({
    sql: `INSERT INTO customers (id, name, phone, email, created_at, version, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET name = excluded.name, phone = excluded.phone, email = excluded.email, created_at = excluded.created_at, version = excluded.version, updated_at = excluded.updated_at`,
    args,
  });

  return NextResponse.json({ success: true });
}
