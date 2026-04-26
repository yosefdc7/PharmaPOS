import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function GET() {
  await ensureDb();
  const db = getDb();

  // Check if default admin exists
  const result = await db.execute({
    sql: "SELECT id FROM users WHERE id = ?",
    args: ["usr-admin"],
  });

  if (result.rows.length === 0) {
    // Create default admin
    const hash = await bcrypt.hash("admin", 10);
    await db.execute({
      sql: `INSERT INTO users (id, username, fullname, password_hash, role, permissions, status)
            VALUES (?, ?, ?, ?, ?, ?, '')`,
      args: [
        "usr-admin",
        "admin",
        "Administrator",
        hash,
        "admin",
        JSON.stringify({ products: true, categories: true, transactions: true, users: true, settings: true }),
      ],
    });
  }

  return NextResponse.json({ ok: true });
}
