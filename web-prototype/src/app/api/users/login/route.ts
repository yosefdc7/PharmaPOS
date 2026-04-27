import { type InValue, getDb } from "@/lib/server/db";
import { ensureDb } from "@/lib/server/init";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  if (record.count >= MAX_ATTEMPTS) {
    return true;
  }

  record.count++;
  return false;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again in 15 minutes." },
      { status: 429 }
    );
  }
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
