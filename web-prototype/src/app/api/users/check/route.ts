import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

const ADMIN_PERMS = JSON.stringify({
  products: true, categories: true, customers: true, transactions: true,
  rx: true, controlTower: true, users: true, settings: true,
  reports: true, sync: true, void: true, refund: true, override: true,
  xReading: true, zReadingGenerate: true, zReadingView: true,
});

export async function GET() {
  await ensureDb();
  const db = getDb();

  const result = await db.execute({
    sql: "SELECT id FROM users WHERE id = ?",
    args: ["usr-admin"],
  });

  if (result.rows.length === 0) {
    const hash = await bcrypt.hash("admin", 10);
    await db.execute({
      sql: `INSERT INTO users (id, username, fullname, password_hash, role, permissions, status)
            VALUES (?, ?, ?, ?, ?, ?, '')`,
      args: ["usr-admin", "admin", "Administrator", hash, "admin", ADMIN_PERMS],
    });
  }

  return NextResponse.json({ ok: true });
}
