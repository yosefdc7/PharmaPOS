import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  await ensureDb();
  const db = getDb();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let sql = "SELECT * FROM sync_queue";
  const args: InValue[] = [];

  if (status) {
    sql += " WHERE status = ?";
    args.push(status);
  }

  sql += " ORDER BY created_at DESC";

  const result = await db.execute({ sql, args });

  const items = result.rows.map((row) => {
    const obj = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v]));
    return {
      ...obj,
      payload: typeof obj.payload === "string" ? JSON.parse(obj.payload) : obj.payload,
      resolved_conflict: typeof obj.resolved_conflict === "string" ? JSON.parse(obj.resolved_conflict) : obj.resolved_conflict,
    };
  });

  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  await ensureDb();
  const db = getDb();
  const body = await request.json();

  await db.execute({
    sql: `INSERT INTO sync_queue (id, entity, operation, payload, created_at, status, retry_count, last_attempt_at, last_error, entity_version)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      body.id,
      body.entity,
      body.operation,
      JSON.stringify(body.payload),
      body.createdAt ?? new Date().toISOString(),
      body.status ?? "pending",
      body.retryCount ?? 0,
      body.lastAttemptAt ?? new Date().toISOString(),
      body.lastError ?? "",
      body.entityVersion ?? 1,
    ],
  });

  return NextResponse.json({ success: true });
}

export async function PUT(request: NextRequest) {
  await ensureDb();
  const db = getDb();
  const body = await request.json().catch(() => ({}));

  if (body.syncItemId && body.resolution) {
    const syncItem = await db.execute({
      sql: "SELECT * FROM sync_queue WHERE id = ?",
      args: [body.syncItemId],
    });

    if (syncItem.rows.length === 0) {
      return NextResponse.json({ error: "Sync item not found" }, { status: 404 });
    }

    const item = syncItem.rows[0];
    const payload = typeof item.payload === "string" ? JSON.parse(item.payload) : item.payload;
    const entity = item.entity as string;
    const operation = item.operation as string;

    if (body.resolution === "local-wins") {
      await upsertEntity(db, entity, payload, operation);
      await db.execute({
        sql: "UPDATE sync_queue SET status = 'synced', last_error = '' WHERE id = ?",
        args: [body.syncItemId],
      });
    } else if (body.resolution === "remote-wins") {
      const remotePayload = body.remotePayload ?? payload;
      await upsertEntity(db, entity, remotePayload, operation);
      await db.execute({
        sql: "UPDATE sync_queue SET status = 'synced', last_error = '' WHERE id = ?",
        args: [body.syncItemId],
      });
    } else if (body.resolution === "merged") {
      const mergedPayload = body.mergedPayload ?? payload;
      await upsertEntity(db, entity, mergedPayload, operation);
      await db.execute({
        sql: "UPDATE sync_queue SET status = 'synced', last_error = '' WHERE id = ?",
        args: [body.syncItemId],
      });
    }

    return NextResponse.json({ success: true, resolution: body.resolution });
  }

  await db.execute({
    sql: "UPDATE sync_queue SET status = 'synced' WHERE status = 'pending'",
    args: [],
  });

  await db.execute({
    sql: "UPDATE transactions SET sync_status = 'synced' WHERE sync_status = 'pending'",
    args: [],
  });

  return NextResponse.json({ success: true });
}

const ENTITY_TABLE_MAP: Record<string, string> = {
  product: "products",
  category: "categories",
  customer: "customers",
  user: "users",
  settings: "settings",
  transaction: "transactions",
  "held-order": "held_orders",
};

const CAMEL_TO_SNAKE: Record<string, Record<string, string>> = {
  products: { categoryId: "category_id", updatedAt: "updated_at", ddLastReconciliationAt: "dd_last_reconciliation_at", fdaCprNumber: "fda_cpr_number", behindCounter: "behind_counter" },
  categories: { updatedAt: "updated_at" },
  customers: { updatedAt: "updated_at" },
  users: { updatedAt: "updated_at", passwordHash: "password_hash" },
  settings: { scPwdSettings: "sc_pwd_settings", updatedAt: "updated_at", expiryAlertDays: "expiry_alert_days", receiptFooter: "receipt_footer", quickBilling: "quick_billing", enableSync: "enable_sync", backupInterval: "backup_interval", darkMode: "dark_mode", birCompliant: "bir_compliant", eJournalEnabled: "e_journal_enabled", esalesEnabled: "e_sales_enabled" },
  transactions: { scPwdMetadata: "sc_pwd_metadata", updatedAt: "updated_at", syncStatus: "sync_status", customerId: "customer_id", paymentStatus: "payment_status", refundReason: "refund_reason", refundReference: "refund_reference", localNumber: "local_number", heldOrderId: "held_order_id" },
  held_orders: { scPwdDiscountActive: "sc_pwd_discount_active", scPwdDraft: "sc_pwd_draft", updatedAt: "updated_at", customerId: "customer_id" },
};

function toSnakeRow(table: string, obj: Record<string, unknown>): Record<string, unknown> {
  const mapping = CAMEL_TO_SNAKE[table] ?? {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[mapping[key] ?? key] = value;
  }
  return result;
}

async function upsertEntity(
  db: import("@libsql/client").Client,
  entity: string,
  payload: unknown,
  operation: string
): Promise<void> {
  const table = ENTITY_TABLE_MAP[entity];
  if (!table) return;

  const data = toSnakeRow(table, payload as Record<string, unknown>);
  const id = data.id as string;
  if (!id) return;

  if (operation === "delete") {
    await db.execute({ sql: `DELETE FROM ${table} WHERE id = ?`, args: [id] });
    return;
  }

  const columns = Object.keys(data).filter((k) => k !== "id");
  if (columns.length === 0) return;

  const placeholders = columns.map(() => "?").join(", ");
  const updates = columns.map((c) => `${c} = excluded.${c}`).join(", ");
  const values = columns.map((c) => data[c]);

  await db.execute({
    sql: `INSERT INTO ${table} (id, ${columns.join(", ")}) VALUES (?, ${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`,
    args: [id, ...values] as InValue[],
  });
}
