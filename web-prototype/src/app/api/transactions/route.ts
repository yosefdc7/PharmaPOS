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

function txToSql(obj: Record<string, unknown>): { keys: string[]; values: unknown[] } {
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
  return { keys: Object.keys(result), values: Object.values(result) };
}

export async function GET(request: NextRequest) {
  await ensureDb();
  const db = getDb();

  const { searchParams } = request.nextUrl;
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const status = searchParams.get("status");
  const since = searchParams.get("since");

  let sql = "SELECT * FROM transactions WHERE 1=1";
  const args: InValue[] = [];

  if (start) {
    sql += " AND created_at >= ?";
    args.push(start);
  }
  if (end) {
    sql += " AND created_at <= ?";
    args.push(end);
  }
  if (status) {
    sql += " AND payment_status = ?";
    args.push(status);
  }
  if (since) {
    sql += " AND updated_at > ?";
    args.push(since);
  }

  sql += " ORDER BY created_at DESC";

  const result = await db.execute({ sql, args });

  const transactions = result.rows.map((row) => {
    const obj = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v]));
    return rowToTx(obj);
  });

  return NextResponse.json(transactions);
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request); // Any authenticated user
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDb();
  const db = getDb();
  const body = await request.json();

  const { keys, values } = txToSql({ ...body, version: body.version ?? 1, updatedAt: body.updatedAt ?? new Date().toISOString() });

  // Stock decrement is handled by the client sending updated product quantities via putMany
  const placeholders = keys.map(() => "?").join(", ");
  await db.execute({
    sql: `INSERT INTO transactions (${keys.join(", ")}) VALUES (${placeholders})
          ON CONFLICT (id) DO UPDATE SET ${keys.filter((k) => k !== "id").map((k) => `${k} = excluded.${k}`).join(", ")}`,
    args: values as InValue[],
  });

  return NextResponse.json({ success: true });
}
