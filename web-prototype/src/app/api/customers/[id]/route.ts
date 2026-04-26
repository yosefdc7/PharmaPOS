import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextRequest, NextResponse } from "next/server";

const CUSTOMER_CAMEL_MAP: Record<string, string> = {
  created_at: "createdAt",
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDb();
  const db = getDb();
  const { id } = await params;
  const body = await request.json();

  const args = [id, body.name ?? "", body.phone ?? "", body.email ?? "", body.createdAt ?? new Date().toISOString()];

  await db.execute({
    sql: `INSERT INTO customers (id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET name = excluded.name, phone = excluded.phone, email = excluded.email, created_at = excluded.created_at`,
    args,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDb();
  const db = getDb();
  const { id } = await params;

  await db.execute({
    sql: "DELETE FROM customers WHERE id = ?",
    args: [id],
  });

  return NextResponse.json({ success: true });
}
