import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { seedDatabase } from "@/lib/server/seed";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  // Require authentication to prevent unauthorized data destruction
  let body: { username?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.username || !body.password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 401 });
  }

  await ensureDb();
  const db = getDb();

  // Verify user credentials
  const result = await db.execute({
    sql: "SELECT id, role, password_hash FROM users WHERE username = ?",
    args: [body.username],
  });

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const row = result.rows[0];
  const storedHash = row[2] as string;
  const role = row[1] as string;

  const valid = await bcrypt.compare(body.password, storedHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Require admin role
  if (role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Truncate all tables
  const tables = ["transactions", "held_orders", "sync_queue", "products", "categories", "customers", "users", "settings", "_meta"];
  const batch = tables.map((table) => ({ sql: `DELETE FROM ${table}`, args: [] }));
  await db.batch(batch as any);

  // Re-seed
  await seedDatabase(db);

  return NextResponse.json({ success: true });
}
