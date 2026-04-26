import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
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

export async function GET(request: NextRequest) {
  await ensureDb();
  const db = getDb();

  const { searchParams } = request.nextUrl;
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const userId = searchParams.get("userId");
  const status = searchParams.get("status");

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
  if (userId) {
    sql += " AND cashier_id = ?";
    args.push(userId);
  }
  if (status) {
    sql += " AND payment_status = ?";
    args.push(status);
  }

  sql += " ORDER BY created_at DESC";

  const result = await db.execute({ sql, args });

  const transactions = result.rows.map((row) => {
    const obj = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v]));
    return rowToTx(obj);
  });

  return NextResponse.json(transactions);
}
