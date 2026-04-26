import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_FLAGS = { sync: false, payments: false, refunds: false };

export async function GET() {
  await ensureDb();
  const db = getDb();

  const result = await db.execute({
    sql: "SELECT value FROM _meta WHERE id = ?",
    args: ["featureFlags"],
  });

  if (result.rows.length === 0) {
    return NextResponse.json(DEFAULT_FLAGS);
  }

  const raw = result.rows[0].value;
  const stored = typeof raw === "string" ? JSON.parse(raw) : {};
  return NextResponse.json({ ...DEFAULT_FLAGS, ...stored });
}

export async function PATCH(request: NextRequest) {
  await ensureDb();
  const db = getDb();
  const body = await request.json();

  // Get current flags
  const current = await db.execute({
    sql: "SELECT value FROM _meta WHERE id = ?",
    args: ["featureFlags"],
  });

  let existing = DEFAULT_FLAGS;
  if (current.rows.length > 0) {
    const raw = current.rows[0].value;
    existing = typeof raw === "string" ? { ...DEFAULT_FLAGS, ...JSON.parse(raw) } : DEFAULT_FLAGS;
  }

  // Merge with incoming
  const merged = { ...existing, ...body };

  await db.execute({
    sql: `INSERT INTO _meta (id, value) VALUES ('featureFlags', ?)
          ON CONFLICT (id) DO UPDATE SET value = excluded.value`,
    args: [JSON.stringify(merged)],
  });

  return NextResponse.json(merged);
}
