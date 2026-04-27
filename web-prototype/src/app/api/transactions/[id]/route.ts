import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { requireAuth } from "@/lib/server/auth";
import { NextRequest, NextResponse } from "next/server";

const TX_CAMEL_MAP: Record<string, string> = {
  local_number: "localNumber",
  customer_id: "customerId",
  cashier_id: "cashierId",
  created_at: "createdAt",
  change_amount: "change",
  payment_method: "paymentMethod",
  payment_status: "paymentStatus",
  payment_reference: "paymentReference",
  sync_status: "syncStatus",
  refunded_at: "refundedAt",
  refund_reason: "refundReason",
  refund_reference: "refundReference",
  sc_pwd_metadata: "scPwdMetadata",
  updated_at: "updatedAt",
};

function rowToTx(row: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const mapped = TX_CAMEL_MAP[key] ?? key;
    if (key === "items" || key === "sc_pwd_metadata") {
      result[mapped] = typeof value === "string" ? JSON.parse(value) : value;
    } else {
      result[mapped] = value;
    }
  }
  return result;
}

function txToSql(obj: Record<string, unknown>): Record<string, unknown> {
  const TX_SNAKE_MAP: Record<string, string> = Object.fromEntries(
    Object.entries(TX_CAMEL_MAP).map(([k, v]) => [v, k])
  );
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const mapped = TX_SNAKE_MAP[key] ?? key;
    if (key === "items" || key === "scPwdMetadata") {
      result[mapped] = JSON.stringify(value);
    } else {
      result[mapped] = value;
    }
  }
  return result;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureDb();
  const db = getDb();
  const { id } = await params;

  const result = await db.execute({
    sql: "SELECT * FROM transactions WHERE id = ?",
    args: [id],
  });

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = Object.fromEntries(Object.entries(result.rows[0]).map(([k, v]) => [k, v]));
  return NextResponse.json(rowToTx(row));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureDb();
  const db = getDb();
  const { id } = await params;
  const body = await request.json();
  const bypassVersionGate = request.headers.get("x-sync-source") === "sync-processor";

  const existing = await db.execute({
    sql: "SELECT * FROM transactions WHERE id = ?",
    args: [id],
  });

  if (!bypassVersionGate && existing.rows.length > 0) {
    const row = Object.fromEntries(Object.entries(existing.rows[0]).map(([k, v]) => [k, v]));
    const currentVersion = typeof row.version === "number" ? row.version : Number(row.version ?? 0);
    const requestedVersion = typeof body.version === "number" ? body.version : Number(body.version ?? 0);

    if (requestedVersion < currentVersion) {
      return NextResponse.json(
        { error: "Version conflict", current: rowToTx(row) },
        { status: 409 }
      );
    }
  }

  const row = txToSql({ ...body, id, version: body.version ?? 1, updatedAt: body.updatedAt ?? new Date().toISOString() });
  const keys = Object.keys(row);
  const values = Object.values(row);

  await db.execute({
    sql: `INSERT INTO transactions (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})
          ON CONFLICT (id) DO UPDATE SET ${keys.filter((k) => k !== "id").map((k) => `${k} = excluded.${k}`).join(", ")}`,
    args: values as InValue[],
  });

  return NextResponse.json({ success: true });
}

// BIR compliance: transactions must not be hard-deleted. Use refund/void instead.
export async function DELETE() {
  return NextResponse.json(
    { error: "Transactions cannot be deleted. Use refund or void instead." },
    { status: 405 }
  );
}
