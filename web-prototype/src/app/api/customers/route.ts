import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextRequest, NextResponse } from "next/server";

const CUSTOMER_CAMEL_MAP: Record<string, string> = {
  created_at: "createdAt",
};

export async function GET() {
  await ensureDb();
  const db = getDb();

  const result = await db.execute("SELECT * FROM customers ORDER BY name");

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

  const args = [body.id, body.name ?? "", body.phone ?? "", body.email ?? "", body.createdAt ?? new Date().toISOString()];

  await db.execute({
    sql: `INSERT INTO customers (id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET name = excluded.name, phone = excluded.phone, email = excluded.email, created_at = excluded.created_at`,
    args,
  });

  return NextResponse.json({ success: true });
}
