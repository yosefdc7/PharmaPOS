import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;
const VALID_ROLES = ["admin", "supervisor", "pharmacist", "cashier"] as const;

function rowToUser(row: Record<string, unknown>) {
  let permissions = row.permissions;
  if (typeof permissions === "string") {
    try { permissions = JSON.parse(permissions); } catch { permissions = {}; }
  }
  return {
    id: row.id,
    username: row.username,
    fullname: row.fullname,
    role: row.role,
    permissions,
  };
}

export async function GET() {
  await ensureDb();
  const db = getDb();

  const result = await db.execute("SELECT * FROM users ORDER BY fullname");

  const users = result.rows.map((row) => {
    const obj = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v]));
    return rowToUser(obj);
  });

  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  await ensureDb();
  const db = getDb();
  const body = await request.json();

  if (!VALID_ROLES.includes(body.role)) {
    return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` }, { status: 400 });
  }

  const hash = await bcrypt.hash(body.password ?? "admin", SALT_ROUNDS);
  const permissions = JSON.stringify(body.permissions ?? {});

  await db.execute({
    sql: `INSERT INTO users (id, username, fullname, password_hash, role, permissions, status)
          VALUES (?, ?, ?, ?, ?, ?, '')
          ON CONFLICT (id) DO UPDATE SET username = excluded.username, fullname = excluded.fullname,
          role = excluded.role, permissions = excluded.permissions`,
    args: [body.id, body.username, body.fullname ?? "", hash, body.role, permissions],
  });

  return NextResponse.json({ success: true });
}
