import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { type Client, getDb } from "./db";
import { seedDatabase } from "./seed";

const __dirname = dirname(fileURLToPath(import.meta.url));

let initialized = false;

export async function ensureDb(overrideDb?: Client): Promise<{ seeded: boolean }> {
  if (initialized && !overrideDb) {
    return { seeded: false };
  }

  const db = overrideDb ?? getDb();

  // Read and execute schema
  const schemaPath = join(__dirname, "schema.sql");
  const schemaSql = await readFile(schemaPath, "utf-8");

  // Execute each statement separately (libsql doesn't support multi-statement)
  const statements = schemaSql
    .split(";")
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0);

  for (const stmt of statements) {
    await db.execute(stmt);
  }

  // Seed if empty
  const seeded = await seedDatabase(db);

  if (!overrideDb) {
    initialized = true;
  }
  return { seeded };
}

export function resetInitialized(): void {
  initialized = false;
}
