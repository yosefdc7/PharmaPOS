import { getDb } from "./db";
import bcrypt from "bcryptjs";

export async function requireAuth(
  request: Request,
  requiredRole?: "admin" | "supervisor" | "pharmacist" | "cashier"
): Promise<{ userId: string; role: string }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) {
    throw new Error("Unauthorized");
  }

  const credentials = atob(authHeader.slice(6));
  const [username, password] = credentials.split(":");

  if (!username || !password) {
    throw new Error("Unauthorized");
  }

  const db = getDb();
  const result = await db.execute({
    sql: "SELECT id, role, password_hash FROM users WHERE username = ?",
    args: [username],
  });

  if (result.rows.length === 0) {
    throw new Error("Unauthorized");
  }

  const row = result.rows[0];
  const storedHash = row[2] as string;
  const role = row[1] as string;

  const valid = await bcrypt.compare(password, storedHash);
  if (!valid) {
    throw new Error("Unauthorized");
  }

  if (requiredRole && role !== requiredRole && role !== "admin") {
    throw new Error("Forbidden");
  }

  return { userId: row[0] as string, role };
}
