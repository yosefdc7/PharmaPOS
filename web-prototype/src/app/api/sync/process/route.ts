import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextRequest, NextResponse } from "next/server";

// POST - Process pending sync queue items
export async function POST(request: NextRequest) {
  await ensureDb();
  const db = getDb();
  const body = await request.json().catch(() => ({}));

  const { maxItems = 10 } = body;

  // Get pending sync items
  const pending = await db.execute({
    sql: "SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?",
    args: [maxItems] as InValue[],
  });

  const results: { id: string; entity: string; operation: string; status: string; error?: string }[] = [];

  for (const item of pending.rows) {
    const id = item.id as string;
    const entity = item.entity as string;
    const operation = item.operation as string;
    const payload = item.payload as string;

    try {
      // Parse payload and process based on entity and operation
      const data = JSON.parse(payload);

      switch (entity) {
        case "transaction":
          if (operation === "create" || operation === "update") {
            // In a real implementation, this would sync to a remote server
            // For now, we just mark it as synced since we're using Turso as the source of truth
            await db.execute({
              sql: "UPDATE sync_queue SET status = 'synced' WHERE id = ?",
              args: [id] as InValue[],
            });
          }
          break;
        case "product":
          if (operation === "update") {
            await db.execute({
              sql: "UPDATE sync_queue SET status = 'synced' WHERE id = ?",
              args: [id] as InValue[],
            });
          }
          break;
        default:
          // Mark other entities as synced
          await db.execute({
            sql: "UPDATE sync_queue SET status = 'synced' WHERE id = ?",
            args: [id] as InValue[],
          });
      }

      results.push({ id, entity, operation, status: "synced" });
    } catch (error) {
      // Increment retry count
      const retryCount = (item.retry_count as number) + 1;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      if (retryCount >= 5) {
        // Max retries reached, mark as failed
        await db.execute({
          sql: "UPDATE sync_queue SET status = 'failed', retry_count = ?, last_error = ? WHERE id = ?",
          args: [retryCount, errorMessage, id] as InValue[],
        });
        results.push({ id, entity, operation, status: "failed", error: errorMessage });
      } else {
        // Keep as pending for retry
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

// GET - Get sync queue status
export async function GET() {
  await ensureDb();
  const db = getDb();

  const stats = await db.execute({
    sql: `SELECT status, COUNT(*) as count FROM sync_queue GROUP BY status`,
  });

  const pending = await db.execute({
    sql: "SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at DESC LIMIT 20",
  });

  return NextResponse.json({
    stats: stats.rows.reduce((acc, row) => {
      acc[row.status as string] = row.count as number;
      return acc;
    }, {} as Record<string, number>),
    pending: pending.rows,
  });
}
