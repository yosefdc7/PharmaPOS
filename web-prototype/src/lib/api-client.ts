import type { Category, Customer, HeldOrder, Product, Settings, SyncQueueItem, Transaction, User } from "./types";
import type { FeatureFlags } from "./feature-flags";
import { openPosDb, promisifyRequest, completeTransaction } from "./db";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "";

// Experimental bridge for future server-backed flows.
// The default web-prototype runtime remains IndexedDB-first and should not
// depend on this module for its core POS path.

// Stores that are managed by IndexedDB directly (no REST API)
const IDB_STORE_NAMES = [
  "meta", "products", "categories", "customers", "users", "settings",
  "transactions", "heldOrders", "syncQueue",
  "birSettings", "printerProfiles", "auditLog", "printerActivity",
  "prescriptions", "rxSettings", "xReadings", "zReadings",
  "reprintQueue"
] as const;

type IdbStoreName = typeof IDB_STORE_NAMES[number];

type StoreName = "products" | "categories" | "customers" | "users" | "settings" | "transactions" | "heldOrders" | "syncQueue";

const ENDPOINT_MAP: Record<StoreName, string> = {
  products: "/api/products",
  categories: "/api/categories",
  customers: "/api/customers",
  users: "/api/users",
  settings: "/api/settings",
  transactions: "/api/transactions",
  heldOrders: "/api/held-orders",
  syncQueue: "/api/sync-queue",
};

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll<T = unknown>(storeName: string): Promise<T[]> {
  if (IDB_STORE_NAMES.includes(storeName as IdbStoreName)) {
    const db = await openPosDb();
    return promisify(db.transaction(storeName as IdbStoreName, "readonly").objectStore(storeName as IdbStoreName).getAll()) as Promise<T[]>;
  }
  return apiFetch<T[]>(ENDPOINT_MAP[storeName as StoreName]);
}

export async function getOne<T = unknown>(storeName: string, id: string): Promise<T | undefined> {
  if (IDB_STORE_NAMES.includes(storeName as IdbStoreName)) {
    const db = await openPosDb();
    return promisify(db.transaction(storeName as IdbStoreName, "readonly").objectStore(storeName as IdbStoreName).get(id)) as Promise<T | undefined>;
  }
  const sn = storeName as StoreName;
  if (sn === "settings") {
    return apiFetch<T>(ENDPOINT_MAP[sn]);
  }
  return apiFetch<T>(`${ENDPOINT_MAP[sn]}/${encodeURIComponent(id)}`);
}

export async function putOne(storeName: string, value: Record<string, unknown>): Promise<void> {
  if (IDB_STORE_NAMES.includes(storeName as IdbStoreName)) {
    const db = await openPosDb();
    const tx = db.transaction(storeName as IdbStoreName, "readwrite");
    tx.objectStore(storeName as IdbStoreName).put(value as object);
    await completeTransaction(tx);
    return;
  }
  const sn = storeName as StoreName;
  const endpoint = ENDPOINT_MAP[sn];
  if (sn === "settings") {
    await apiFetch(endpoint, { method: "POST", body: JSON.stringify(value) });
  } else {
    await apiFetch(`${endpoint}/${encodeURIComponent(value.id as string)}`, {
      method: "PUT",
      body: JSON.stringify(value),
    });
  }
}

export async function putMany(storeName: string, values: { id: string }[]): Promise<void> {
  // For products (used after sale), we need to upsert each one
  if (storeName === "products") {
    await apiFetch("/api/products", {
      method: "POST",
      body: JSON.stringify(values),
    });
  } else {
    for (const value of values) {
      await putOne(storeName, value);
    }
  }
}

export async function deleteOne(storeName: string, id: string): Promise<void> {
  if (IDB_STORE_NAMES.includes(storeName as IdbStoreName)) {
    const db = await openPosDb();
    const tx = db.transaction(storeName as IdbStoreName, "readwrite");
    tx.objectStore(storeName as IdbStoreName).delete(id);
    await completeTransaction(tx);
    return;
  }
  const endpoint = ENDPOINT_MAP[storeName as StoreName];
  await apiFetch(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function enqueueSync(item: Omit<SyncQueueItem, "id" | "createdAt" | "status" | "retryCount" | "lastError">): Promise<void> {
  await apiFetch("/api/sync-queue", {
    method: "POST",
    body: JSON.stringify({
      id: crypto.randomUUID(),
      ...item,
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      lastError: "",
    }),
  });
}

export async function markPendingSyncAsSynced(): Promise<void> {
  await apiFetch("/api/sync-queue", { method: "PUT" });
}

export async function seedIfNeeded(): Promise<void> {
  await apiFetch("/api/init");
}

export async function resetPrototypeData(): Promise<void> {
  await apiFetch("/api/settings/reset", { method: "POST" });
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
  return apiFetch<FeatureFlags>("/api/feature-flags");
}

export async function setFeatureFlags(flags: Partial<FeatureFlags>): Promise<FeatureFlags> {
  return apiFetch<FeatureFlags>("/api/feature-flags", {
    method: "PATCH",
    body: JSON.stringify(flags),
  });
}

export async function login(username: string, password: string): Promise<{ auth: boolean; user?: User }> {
  return apiFetch<{ auth: boolean; user?: User }>("/api/users/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function checkDefaultAdmin(): Promise<void> {
  await apiFetch("/api/users/check");
}
