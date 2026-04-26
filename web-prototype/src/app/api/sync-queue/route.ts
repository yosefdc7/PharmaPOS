import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  await ensureDb();
  const db = getDb();

  const result = await db.execute("SELECT * FROM sync_queue ORDER BY created_at");

  const items = result.rows.map((row) => {
    const obj = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v]));
    return {
      ...obj,
      payload: typeof obj.payload === "string" ? JSON.parse(obj.payload) : obj.payload,
    };
  });

  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  await ensureDb();
  const db = getDb();
  const body = await request.json();

  await db.execute({
    sql: `INSERT INTO sync_queue (id, entity, operation, payload, created_at, status, retry_count, last_error)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      body.id,
      body.entity,
      body.operation,
      JSON.stringify(body.payload),
      body.createdAt ?? new Date().toISOString(),
      body.status ?? "pending",
      body.retryCount ?? 0,
      body.lastError ?? "",
    ],
  });

  return NextResponse.json({ success: true });
}

export async function PUT() {
  await ensureDb();
  const db = getDb();

  // Mark all pending sync queue items as synced
  await db.execute({
    sql: "UPDATE sync_queue SET status = 'synced' WHERE status = 'pending'",
    args: [],
  });

  // Also mark all pending transactions as synced
  await db.execute({
    sql: "UPDATE transactions SET sync_status = 'synced' WHERE sync_status = 'pending'",
    args: [],
  });

  return NextResponse.json({ success: true });
}
