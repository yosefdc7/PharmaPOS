import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  await ensureDb();
  const db = getDb();
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ auth: false, error: "Username and password required" }, { status: 400 });
  }

  const result = await db.execute({
    sql: "SELECT * FROM users WHERE username = ?",
    args: [username],
  });

  if (result.rows.length === 0) {
    return NextResponse.json({ auth: false });
  }

  const row = Object.fromEntries(Object.entries(result.rows[0]).map(([k, v]) => [k, v]));

  const valid = await bcrypt.compare(password, row.password_hash as string);
  if (!valid) {
    return NextResponse.json({ auth: false });
  }

  // Parse permissions
  let permissions: Record<string, boolean> | string = row.permissions as Record<string, boolean> | string;
  if (typeof permissions === "string") {
    try { permissions = JSON.parse(permissions as string) as Record<string, boolean>; } catch { permissions = {} as Record<string, boolean>; }
  }

  const user = {
    id: row.id,
    username: row.username,
    fullname: row.fullname,
    role: row.role,
    permissions,
  };

  return NextResponse.json({ auth: true, user });
}
