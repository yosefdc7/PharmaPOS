import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  await ensureDb();
  const db = getDb();

  const result = await db.execute("SELECT * FROM categories ORDER BY name");

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
    sql: `INSERT INTO categories (id, name) VALUES (?, ?)
          ON CONFLICT (id) DO UPDATE SET name = excluded.name`,
    args: [body.id, body.name],
  });

  return NextResponse.json({ success: true });
}
