import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { seedDatabase } from "@/lib/server/seed";
import { NextResponse } from "next/server";

export async function POST() {
  await ensureDb();
  const db = getDb();

  // Truncate all tables
  const tables = ["transactions", "held_orders", "sync_queue", "products", "categories", "customers", "users", "settings", "_meta"];
  const batch = tables.map((table) => ({ sql: `DELETE FROM ${table}`, args: [] }));
  await db.batch(batch as any);

  // Re-seed
  await seedDatabase(db);

  return NextResponse.json({ success: true });
}
