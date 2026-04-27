import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { requireAuth } from "@/lib/server/auth";
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
    version: row.version,
    username: row.username,
    fullname: row.fullname,
    role: row.role,
    permissions,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  await ensureDb();
  const db = getDb();

  const since = request.nextUrl.searchParams.get("since");
  const sql = since
    ? "SELECT * FROM users WHERE updated_at > ? ORDER BY fullname"
    : "SELECT * FROM users ORDER BY fullname";

  const result = since ? await db.execute({ sql, args: [since] }) : await db.execute(sql);

  const users = result.rows.map((row) => {
    const obj = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v]));
    return rowToUser(obj);
  });

  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request, "admin"); // Only admins can create users
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDb();
  const db = getDb();
  const body = await request.json();

  if (!VALID_ROLES.includes(body.role)) {
    return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` }, { status: 400 });
  }

  if (!body.password || typeof body.password !== "string" || body.password.trim().length === 0) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }
  const hash = await bcrypt.hash(body.password.trim(), SALT_ROUNDS);
  const permissions = JSON.stringify(body.permissions ?? {});

  await db.execute({
    sql: `INSERT INTO users (id, username, fullname, password_hash, role, permissions, status, version, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, '', ?, ?)
          ON CONFLICT (id) DO UPDATE SET username = excluded.username, fullname = excluded.fullname,
          role = excluded.role, permissions = excluded.permissions, version = excluded.version, updated_at = excluded.updated_at`,
    args: [body.id, body.username, body.fullname ?? "", hash, body.role, permissions, body.version ?? 1, body.updatedAt ?? new Date().toISOString()],
  });

  return NextResponse.json({ success: true });
}
