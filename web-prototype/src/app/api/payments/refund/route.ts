import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  await ensureDb();
  const db = getDb();
  const body = await request.json();

  const { transactionId, reason, reference, amount } = body;

  if (!transactionId) {
    return NextResponse.json(
      { error: "transactionId is required" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const refundReference = reference || `REF-${Date.now()}`;

  // Update transaction with refund details
  await db.execute({
    sql: `UPDATE transactions
          SET refunded_at = ?,
              refund_reason = ?,
              refund_reference = ?,
              payment_status = 'refunded'
          WHERE id = ? AND payment_status = 'paid'`,
    args: [now, reason || "Customer request", refundReference, transactionId] as InValue[],
  });

  // Get updated transaction to return
  const result = await db.execute({
    sql: "SELECT * FROM transactions WHERE id = ?",
    args: [transactionId] as InValue[],
  });

  if (result.rows.length === 0) {
    return NextResponse.json(
      { error: "Transaction not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    transactionId,
    refundReference,
    refundedAt: now,
    status: "refunded",
  });
}