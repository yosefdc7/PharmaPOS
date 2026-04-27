import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextRequest, NextResponse } from "next/server";

type ConflictResolutionStrategy = "lww" | "local-wins" | "remote-wins" | "manual";

const ENTITY_TABLE_MAP: Record<string, string> = {
  product: "products",
  category: "categories",
  customer: "customers",
  user: "users",
  settings: "settings",
  transaction: "transactions",
  "held-order": "held_orders",
};

// Allowlist of valid tables for SQL injection prevention
const ALLOWED_TABLES = [
  "products", "categories", "customers", "users",
  "transactions", "held_orders", "settings"
] as const;

type AllowedTable = typeof ALLOWED_TABLES[number];

function isAllowedTable(table: string): table is AllowedTable {
  return ALLOWED_TABLES.includes(table as AllowedTable);
}

// Column allowlists per table (matching actual database schema)
const TABLE_COLUMNS: Record<AllowedTable, string[]> = {
  products: ["id", "version", "name", "barcode", "category_id", "supplier", "price", "original_price", "cost", "quantity", "min_stock", "tracks_stock", "expiration_date", "image_color", "featured", "sc_pwd_eligibility", "vat_exempt", "is_prescription", "drug_classification", "generic_name", "brand_name", "active_ingredient", "dosage_strength", "dosage_form", "fda_cpr_number", "behind_counter", "dd_last_reconciliation_at", "updated_at"],
  categories: ["id", "name", "version", "updated_at"],
  customers: ["id", "name", "phone", "email", "created_at", "version", "updated_at"],
  users: ["id", "version", "username", "fullname", "role", "password_hash", "permissions", "updated_at"],
  transactions: ["id", "version", "local_number", "items", "customer_id", "cashier_id", "created_at", "subtotal", "discount", "tax", "total", "paid", "change", "payment_method", "payment_status", "payment_reference", "sync_status", "refunded_at", "refund_reason", "refund_reference", "remarks", "sc_pwd_metadata", "updated_at"],
  held_orders: ["id", "version", "reference", "items", "customer_id", "discount", "remarks", "created_at", "sc_pwd_discount_active", "sc_pwd_draft", "updated_at"],
  settings: ["id", "version", "store", "address_one", "address_two", "contact", "currency_symbol", "vat_percentage", "charge_tax", "quick_billing", "receipt_footer", "expiry_alert_days", "sc_pwd_settings", "updated_at"],
};

function validateColumns(table: AllowedTable, columns: string[]): boolean {
  const allowed = TABLE_COLUMNS[table];
  return columns.every(col => allowed.includes(col));
}

function getEntityId(payload: unknown): string {
  if (typeof payload === "object" && payload !== null && "id" in payload) {
    return (payload as Record<string, unknown>).id as string;
  }
  return "";
}

function detectConflict(
  localVersion: number,
  remoteVersion: number,
  operation: string
): boolean {
  if (operation === "create") return false;
  return remoteVersion > localVersion;
}

function resolveLWW(
  localPayload: unknown,
  remotePayload: unknown,
  createdAt: string
): "local" | "remote" {
  const getTs = (p: unknown): number => {
    if (typeof p === "object" && p !== null && "updatedAt" in p) {
      return new Date((p as Record<string, unknown>).updatedAt as string).getTime();
    }
    return new Date(createdAt).getTime();
  };
  return getTs(localPayload) >= getTs(remotePayload) ? "local" : "remote";
}

function mergePayload(entity: string, local: unknown, remote: unknown): unknown {
  const l = (typeof local === "object" && local !== null) ? local as Record<string, unknown> : {};
  const r = (typeof remote === "object" && remote !== null) ? remote as Record<string, unknown> : {};

  if (entity === "product") {
    const lQty = typeof l.quantity === "number" ? l.quantity : 0;
    const rQty = typeof r.quantity === "number" ? r.quantity : 0;
    return {
      ...r,
      ...l,
      quantity: Math.min(lQty, rQty),
      version: Math.max(typeof l.version === "number" ? l.version : 0, typeof r.version === "number" ? r.version : 0) + 1,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    ...r,
    ...l,
    version: Math.max(typeof l.version === "number" ? l.version : 0, typeof r.version === "number" ? r.version : 0) + 1,
    updatedAt: new Date().toISOString(),
  };
}

async function upsertEntity(
  db: import("@libsql/client").Client,
  entity: string,
  payload: unknown,
  operation: string
): Promise<void> {
  const table = ENTITY_TABLE_MAP[entity];
  if (!table) return;

  // Validate table is in allowlist
  if (!isAllowedTable(table)) {
    throw new Error(`Invalid table: ${table}`);
  }

  const data = payload as Record<string, unknown>;
  const id = data.id as string;

  if (operation === "delete") {
    await db.execute({
      sql: `DELETE FROM ${table} WHERE id = ?`,
      args: [id],
    });
    return;
  }

  const columns = Object.keys(data).filter((k) => k !== "id");

  // Validate columns are in allowlist for this table
  if (!validateColumns(table, columns)) {
    throw new Error(`Invalid columns for table ${table}: ${columns.join(", ")}`);
  }

  const placeholders = columns.map(() => "?").join(", ");
  const updates = columns.map((c) => `${c} = excluded.${c}`).join(", ");
  const values = columns.map((c) => data[c]);

  const jsonColumns = getJsonColumns(table);
  const processedValues = values.map((v, i) => {
    if (jsonColumns.includes(columns[i]) && typeof v === "object") {
      return JSON.stringify(v);
    }
    return v;
  }) as InValue[];

  await db.execute({
    sql: `INSERT INTO ${table} (id, ${columns.join(", ")}) VALUES (?, ${placeholders})
          ON CONFLICT(id) DO UPDATE SET ${updates}`,
    args: [id as InValue, ...processedValues],
  });
}

function getJsonColumns(table: string): string[] {
  const map: Record<string, string[]> = {
    users: ["permissions"],
    settings: ["sc_pwd_settings"],
    transactions: ["items", "sc_pwd_metadata"],
    held_orders: ["items", "sc_pwd_draft"],
    products: [],
    categories: [],
    customers: [],
  };
  return map[table] ?? [];
}

export async function POST(request: NextRequest) {
  await ensureDb();
  const db = getDb();
  const body = await request.json().catch(() => ({}));

  const { maxItems = 10, strategy = "lww" } = body;

  const pending = await db.execute({
    sql: "SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?",
    args: [maxItems] as InValue[],
  });

  const results: {
    id: string;
    entity: string;
    operation: string;
    status: string;
    error?: string;
    conflict?: Record<string, unknown>;
  }[] = [];

  for (const item of pending.rows) {
    const id = item.id as string;
    const entity = item.entity as string;
    const operation = item.operation as string;
    const localVersion = (item.entity_version as number) ?? 1;

    let payload: unknown;
    try {
      payload = JSON.parse(item.payload as string);
    } catch {
      const retryCount = (item.retry_count as number) + 1;
      if (retryCount >= 5) {
        await db.execute({
          sql: "UPDATE sync_queue SET status = 'failed', retry_count = ?, last_error = ? WHERE id = ?",
          args: [retryCount, "Invalid JSON payload", id] as InValue[],
        });
        results.push({ id, entity, operation, status: "failed", error: "Invalid JSON payload" });
      } else {
        await db.execute({
          sql: "UPDATE sync_queue SET retry_count = ?, last_error = ? WHERE id = ?",
          args: [retryCount, "Invalid JSON payload", id] as InValue[],
        });
        results.push({ id, entity, operation, status: "retry", error: "Invalid JSON payload" });
      }
      continue;
    }

    try {
      const table = ENTITY_TABLE_MAP[entity];
      let remoteVersion = 0;
      let remoteData: unknown = null;

      if (table) {
        // Validate table is in allowlist
        if (!isAllowedTable(table)) {
          throw new Error(`Invalid table: ${table}`);
        }

        const entityId = getEntityId(payload);
        const existing = await db.execute({
          sql: `SELECT * FROM ${table} WHERE id = ?`,
          args: [entityId] as InValue[],
        });

        if (existing.rows.length > 0) {
          const row = existing.rows[0] as Record<string, unknown>;
          remoteVersion = (row.version as number) ?? 0;
          remoteData = row;
        }
      }

      const hasConflict = operation === "create"
        ? remoteData !== null
        : detectConflict(localVersion, remoteVersion, operation);

      if (hasConflict) {
        if (strategy === "manual") {
          const conflict = {
            syncItemId: id,
            entity,
            entityId: getEntityId(payload),
            localVersion,
            remoteVersion,
            localPayload: payload,
            remotePayload: remoteData,
          };
          await db.execute({
            sql: "UPDATE sync_queue SET status = 'conflict', resolved_conflict = ? WHERE id = ?",
            args: [JSON.stringify(conflict), id] as InValue[],
          });
          results.push({ id, entity, operation, status: "conflict", conflict });
          continue;
        }

        let winner: "local" | "remote" | "merged";

        if (strategy === "lww") {
          winner = resolveLWW(payload, remoteData, item.created_at as string);
        } else if (strategy === "local-wins") {
          winner = "local";
        } else if (strategy === "remote-wins") {
          winner = "remote";
        } else {
          winner = "merged";
        }

        if (winner === "remote") {
          await db.execute({
            sql: "UPDATE sync_queue SET status = 'synced', last_error = 'Remote version applied' WHERE id = ?",
            args: [id] as InValue[],
          });
          results.push({ id, entity, operation, status: "synced" });
          continue;
        }

        if (winner === "merged") {
          const merged = mergePayload(entity, payload, remoteData);
          await upsertEntity(db, entity, merged, operation);
          await db.execute({
            sql: "UPDATE sync_queue SET status = 'synced' WHERE id = ?",
            args: [id] as InValue[],
          });
          results.push({ id, entity, operation, status: "synced" });
          continue;
        }
      }

      await upsertEntity(db, entity, payload, operation);

      await db.execute({
        sql: "UPDATE sync_queue SET status = 'synced' WHERE id = ?",
        args: [id] as InValue[],
      });

      results.push({ id, entity, operation, status: "synced" });
    } catch (error) {
      const retryCount = (item.retry_count as number) + 1;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      if (retryCount >= 5) {
        await db.execute({
          sql: "UPDATE sync_queue SET status = 'failed', retry_count = ?, last_error = ? WHERE id = ?",
          args: [retryCount, errorMessage, id] as InValue[],
        });
        results.push({ id, entity, operation, status: "failed", error: errorMessage });
      } else {
        await db.execute({
          sql: "UPDATE sync_queue SET retry_count = ?, last_error = ? WHERE id = ?",
          args: [retryCount, errorMessage, id] as InValue[],
        });
        results.push({ id, entity, operation, status: "retry", error: errorMessage });
      }
    }
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    results,
  });
}

export async function GET() {
  await ensureDb();
  const db = getDb();

  const stats = await db.execute({
    sql: `SELECT status, COUNT(*) as count FROM sync_queue GROUP BY status`,
  });

  const pending = await db.execute({
    sql: "SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at DESC LIMIT 20",
  });

  const conflicts = await db.execute({
    sql: "SELECT * FROM sync_queue WHERE status = 'conflict' ORDER BY created_at DESC",
  });

  return NextResponse.json({
    stats: stats.rows.reduce((acc, row) => {
      acc[row.status as string] = row.count as number;
      return acc;
    }, {} as Record<string, number>),
    pending: pending.rows,
    conflicts: conflicts.rows,
  });
}
