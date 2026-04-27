import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { requireAuth } from "@/lib/server/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { role } = await requireAuth(request);
    if (role !== "admin" && role !== "supervisor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDb();
  const db = getDb();
  const body = await request.json();

  const { transactionId, reason, reference } = body;

  if (!transactionId) {
    return NextResponse.json(
      { error: "transactionId is required" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const refundReference = reference || `REF-${Date.now()}`;

  // Update transaction with refund details
  const updateResult = await db.execute({
    sql: `UPDATE transactions
          SET refunded_at = ?,
              refund_reason = ?,
              refund_reference = ?,
              payment_status = 'refunded'
          WHERE id = ? AND payment_status = 'paid'`,
    args: [now, reason || "Customer request", refundReference, transactionId] as InValue[],
  });

  if (updateResult.rowsAffected === 0) {
    return NextResponse.json(
      { error: "Transaction not found or already refunded" },
      { status: 409 }
    );
  }

  // TODO: Restore product stock for refunded items (requires product quantity lookup)

  return NextResponse.json({
    success: true,
    transactionId,
    refundReference,
    refundedAt: now,
    status: "refunded",
  });
}