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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDb();
  const db = getDb();
  const { id } = await params;

  const result = await db.execute({
    sql: "SELECT * FROM users WHERE id = ?",
    args: [id],
  });

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = Object.fromEntries(Object.entries(result.rows[0]).map(([k, v]) => [k, v]));
  return NextResponse.json(rowToUser(row));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDb();
  const db = getDb();
  const { id } = await params;
  const body = await request.json();

  if (!VALID_ROLES.includes(body.role)) {
    return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` }, { status: 400 });
  }

  if (body.password) {
    const hash = await bcrypt.hash(body.password, SALT_ROUNDS);
    const permissions = JSON.stringify(body.permissions ?? {});
    await db.execute({
      sql: `UPDATE users SET username = ?, fullname = ?, password_hash = ?, role = ?, permissions = ? WHERE id = ?`,
      args: [body.username, body.fullname ?? "", hash, body.role, permissions, id],
    });
  } else {
    const permissions = JSON.stringify(body.permissions ?? {});
    await db.execute({
      sql: `UPDATE users SET username = ?, fullname = ?, role = ?, permissions = ? WHERE id = ?`,
      args: [body.username, body.fullname ?? "", body.role, permissions, id],
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDb();
  const db = getDb();
  const { id } = await params;

  await db.execute({
    sql: "DELETE FROM users WHERE id = ?",
    args: [id],
  });

  return NextResponse.json({ success: true });
}
