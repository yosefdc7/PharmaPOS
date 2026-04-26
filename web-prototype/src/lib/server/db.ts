import { createClient, type Client, type InValue } from "@libsql/client";

let db: Client | null = null;

export function getDb(overrideUrl?: string): Client {
  if (overrideUrl) {
    // For testing - always create a new client with the override URL
    const url = overrideUrl;
    const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
    return createClient({
      url,
      authToken: authToken && authToken.length > 0 ? authToken : undefined,
    });
  }

  if (db) return db;

  const url = process.env.TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

  // Fall back to in-memory ephemeral SQLite when no cloud URL is configured
  // This enables the app to work in serverless environments (Vercel, etc.)
  // without requiring a cloud database URL in environment variables.
  const resolvedUrl = url && url.startsWith("libsql:")
    ? url
    : url && url.length > 0
    ? url
    : ":memory:";

  const resolvedAuthToken =
    authToken && authToken.length > 0 ? authToken : undefined;

  db = createClient({
    url: resolvedUrl,
    authToken: resolvedAuthToken,
  });

  return db;
}

export function resetDbSingleton(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export type { InValue };
export type { Client };
