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

  const results: { id: string; entity: string; operation: string; status: string; error?: string }[] = [];

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
          await db.execute({
            sql: "UPDATE sync_queue SET status = 'conflict', resolved_conflict = ? WHERE id = ?",
            args: [JSON.stringify({
              syncItemId: id,
              entity,
              entityId: getEntityId(payload),
              localVersion,
              remoteVersion,
              localPayload: payload,
              remotePayload: remoteData,
            }), id] as InValue[],
          });
          results.push({ id, entity, operation, status: "conflict" });
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
