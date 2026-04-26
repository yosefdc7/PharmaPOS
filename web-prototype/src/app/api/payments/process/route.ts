import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  await ensureDb();
  const db = getDb();
  const body = await request.json();

  const { transactionId, amount, method, reference } = body;

  if (!transactionId) {
    return NextResponse.json(
      { error: "transactionId is required" },
      { status: 400 }
    );
  }

  const validMethods = ["cash", "gcash", "maya", "card", "bank_transfer", "check", "credit", "other"];
  const paymentMethod = method || "cash";
  const paymentReference = reference || "";

  // Update transaction with payment details
  await db.execute({
    sql: `UPDATE transactions
          SET payment_status = 'paid',
              payment_method = ?,
              payment_reference = ?,
              paid = total,
              change_amount = ? - total
          WHERE id = ?`,
    args: [paymentMethod, paymentReference, amount || 0, transactionId] as InValue[],
  });

  return NextResponse.json({
    success: true,
    transactionId,
    paymentMethod,
    paymentStatus: "paid",
  });
}
