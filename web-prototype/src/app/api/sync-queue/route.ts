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
    sql: `INSERT INTO sync_queue (id, entity, operation, payload, created_at, status, retry_count, last_error, entity_version)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      body.id,
      body.entity,
      body.operation,
      JSON.stringify(body.payload),
      body.createdAt ?? new Date().toISOString(),
      body.status ?? "pending",
      body.retryCount ?? 0,
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

    if (body.resolution === "local-wins") {
      await db.execute({
        sql: "UPDATE sync_queue SET status = 'synced', last_error = '' WHERE id = ?",
        args: [body.syncItemId],
      });
    } else if (body.resolution === "remote-wins") {
      const remotePayload = body.remotePayload ?? payload;
      const storeTable = getStoreTable(item.entity as string);
      if (storeTable) {
        const entityId = typeof remotePayload === "object" && remotePayload !== null ? String((remotePayload as Record<string, unknown>).id) : null;
        if (entityId) {
          const version = typeof (remotePayload as Record<string, unknown>).version === "number" ? (remotePayload as Record<string, unknown>).version as number : 0;
          await db.execute(
            `INSERT OR REPLACE INTO ${storeTable} (id, data, version) VALUES (?, ?, ?)`,
            [entityId, JSON.stringify(remotePayload), version]
          );
        }
      }
      await db.execute({
        sql: "UPDATE sync_queue SET status = 'synced', last_error = '' WHERE id = ?",
        args: [body.syncItemId],
      });
    } else if (body.resolution === "merged") {
      const mergedPayload = body.mergedPayload ?? payload;
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

function getStoreTable(entity: string): string | null {
  const map: Record<string, string> = {
    product: "products",
    category: "categories",
    customer: "customers",
    user: "users",
    settings: "settings",
    transaction: "transactions",
    "held-order": "held_orders",
  };
  return map[entity] ?? null;
}
