import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  await ensureDb();
  const db = getDb();

  const since = request.nextUrl.searchParams.get("since");

  let sql = "SELECT * FROM categories";
  const args: InValue[] = [];
  if (since) {
    sql += " WHERE updated_at > ?";
    args.push(since);
  }
  sql += " ORDER BY name";

  const result = await db.execute({ sql, args });

  const categories = result.rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v]))
  );

  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  await ensureDb();
  const db = getDb();
  const body = await request.json();

  await db.execute({
    sql: `INSERT INTO categories (id, name, version, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET name = excluded.name, version = excluded.version, updated_at = excluded.updated_at`,
    args: [body.id, body.name, body.version ?? 1, body.updatedAt ?? new Date().toISOString()],
  });

  return NextResponse.json({ success: true });
}
