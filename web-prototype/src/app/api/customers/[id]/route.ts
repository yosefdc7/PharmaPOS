import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDb();
  const db = getDb();
  const { id } = await params;
  const body = await request.json();

  const createdAt = body.createdAt ?? new Date().toISOString();
  const updatedAt = body.updatedAt ?? new Date().toISOString();
  const args = [id, body.name ?? "", body.phone ?? "", body.email ?? "", createdAt, body.version ?? 1, updatedAt];

  await db.execute({
    sql: `INSERT INTO customers (id, name, phone, email, created_at, version, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET name = excluded.name, phone = excluded.phone, email = excluded.email, created_at = excluded.created_at, version = excluded.version, updated_at = excluded.updated_at`,
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
