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
  const bypassVersionGate = request.headers.get("x-sync-source") === "sync-processor";

  const existing = await db.execute({
    sql: "SELECT * FROM categories WHERE id = ?",
    args: [id],
  });

  if (!bypassVersionGate && existing.rows.length > 0) {
    const row = Object.fromEntries(Object.entries(existing.rows[0]).map(([k, v]) => [k, v]));
    const currentVersion = typeof row.version === "number" ? row.version : Number(row.version ?? 0);
    const requestedVersion = typeof body.version === "number" ? body.version : Number(body.version ?? 0);

    if (requestedVersion < currentVersion) {
      return NextResponse.json(
        {
          error: "Version conflict",
          current: {
            id: row.id,
            name: row.name,
            version: row.version,
            updatedAt: row.updated_at,
          },
        },
        { status: 409 }
      );
    }
  }

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
