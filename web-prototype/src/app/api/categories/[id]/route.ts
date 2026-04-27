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

  await db.execute({
    sql: `INSERT INTO categories (id, name, version, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET name = excluded.name, version = excluded.version, updated_at = excluded.updated_at`,
    args: [id, body.name, body.version ?? 1, body.updatedAt ?? new Date().toISOString()],
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
    sql: "DELETE FROM categories WHERE id = ?",
    args: [id],
  });

  return NextResponse.json({ success: true });
}
