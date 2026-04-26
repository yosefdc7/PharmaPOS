import { DEFAULT_FEATURE_FLAGS, mergeFeatureFlags, type FeatureFlags } from "./feature-flags";
import {
  seedCategories,
  seedCustomers,
  seedProducts,
  seedSettings,
  seedSyncQueue,
  seedTransactions,
  seedUsers
} from "./seed";
import type {
  AuditEntry,
  BirSettings,
  Category,
  Customer,
  HeldOrder,
  PrinterActivityLog,
  PrinterProfile,
  Product,
  ReprintQueueItem,
  Settings,
  SyncQueueItem,
  Transaction,
  User,
  XReading,
  ZReading,
  PrescriptionDraft,
  RxSettings
} from "./types";

const DB_NAME = "pharmaspot-web-prototype";
const DB_VERSION = 5;

export type StoreName =
  | "meta"
  | "products"
  | "categories"
  | "customers"
  | "users"
  | "settings"
  | "transactions"
  | "heldOrders"
  | "syncQueue"
  | "birSettings"
  | "printerProfiles"
  | "auditLog"
  | "printerActivity"
  | "prescriptions"
  | "rxSettings"
  | "xReadings"
  | "zReadings"
  | "reprintQueue";

const STORES: StoreName[] = [
  "meta",
  "products",
  "categories",
  "customers",
  "users",
  "settings",
  "transactions",
  "heldOrders",
  "syncQueue",
  "birSettings",
  "printerProfiles",
  "auditLog",
  "printerActivity",
  "prescriptions",
  "rxSettings",
  "xReadings",
  "zReadings",
  "reprintQueue"
];

type StoreEntityMap = {
  meta: { id: string; value: unknown };
  products: Product;
  categories: Category;
  customers: Customer;
  users: User;
  settings: Settings;
  transactions: Transaction;
  heldOrders: HeldOrder;
  syncQueue: SyncQueueItem;
  birSettings: BirSettings;
  printerProfiles: PrinterProfile;
  auditLog: AuditEntry;
  printerActivity: PrinterActivityLog;
  prescriptions: PrescriptionDraft;
  rxSettings: RxSettings;
  xReadings: XReading;
  zReadings: ZReading;
  reprintQueue: ReprintQueueItem;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function ensureStores(db: IDBDatabase): void {
  for (const storeName of STORES) {
    if (!db.objectStoreNames.contains(storeName)) {
      db.createObjectStore(storeName, { keyPath: "id" });
    }
  }
}

function applyMigrations(db: IDBDatabase, tx: IDBTransaction, oldVersion: number): void {
  ensureStores(db);

  // V2 rollout (backward compatible): additive metadata for kill-switch flags.
  if (oldVersion < 2) {
    const metaStore = tx.objectStore("meta");
    metaStore.put({ id: "featureFlags", value: DEFAULT_FEATURE_FLAGS });
    metaStore.put({ id: "schemaVersion", value: 2 });
  }

  // V3: backfill expiryAlertDays default on existing settings.
  if (oldVersion < 3) {
    const settingsStore = tx.objectStore("settings");
    const cursor = settingsStore.openCursor();
    cursor.onsuccess = (event) => {
      const result = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (result) {
        const value = result.value as Settings;
        if (typeof value.expiryAlertDays !== "number") {
          value.expiryAlertDays = 30;
          settingsStore.put(value);
        }
        result.continue();
      }
    };
    tx.objectStore("meta").put({ id: "schemaVersion", value: 3 });
  }

  // V4: new stores for Phase 1 backend wiring
  if (oldVersion < 4) {
    tx.objectStore("meta").put({ id: "schemaVersion", value: 4 });
  }

  // V5: add reprintQueue store for Phase 2 thermal printer
  if (oldVersion < 5) {
    tx.objectStore("meta").put({ id: "schemaVersion", value: 5 });
  }
}

export function openPosDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      applyMigrations(db, request.transaction as IDBTransaction, event.oldVersion || 0);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function completeTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getAll<TStore extends StoreName>(
  storeName: TStore
): Promise<StoreEntityMap[TStore][]> {
  const db = await openPosDb();
  return promisifyRequest(db.transaction(storeName, "readonly").objectStore(storeName).getAll());
}

export async function getOne<TStore extends StoreName>(
  storeName: TStore,
  id: string
): Promise<StoreEntityMap[TStore] | undefined> {
  const db = await openPosDb();
  const result = await promisifyRequest(db.transaction(storeName, "readonly").objectStore(storeName).get(id));
  return result as StoreEntityMap[TStore] | undefined;
}

export async function putOne<TStore extends StoreName>(
  storeName: TStore,
  value: StoreEntityMap[TStore]
): Promise<void> {
  const db = await openPosDb();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).put(value as StoreEntityMap[TStore]);
  await completeTransaction(tx);
}

export async function putMany<TStore extends StoreName>(
  storeName: TStore,
  values: StoreEntityMap[TStore][]
): Promise<void> {
  const db = await openPosDb();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  values.forEach((value) => store.put(value));
  await completeTransaction(tx);
}

export async function deleteOne(storeName: StoreName, id: string): Promise<void> {
  const db = await openPosDb();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).delete(id);
  await completeTransaction(tx);
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const stored = await getOne("meta", "featureFlags");
  return mergeFeatureFlags((stored?.value as Partial<FeatureFlags> | undefined) ?? undefined);
}

export async function setFeatureFlags(flags: Partial<FeatureFlags>): Promise<FeatureFlags> {
  const next = mergeFeatureFlags({ ...(await getFeatureFlags()), ...flags });
  await putOne("meta", { id: "featureFlags", value: next });
  return next;
}

export async function login(
  username: string,
  password: string
): Promise<{ auth: boolean; user?: User }> {
  const users = await getAll("users");
  const user = users.find((candidate) => candidate.username === username);
  if (!user) {
    return { auth: false };
  }

  // The offline-first prototype stores demo users without password hashes.
  // Keep authentication local by accepting the seeded demo credentials.
  const validPassword =
    (username === "admin" && password === "admin") ||
    (username === "cashier" && password === "cashier");

  if (!validPassword) {
    return { auth: false };
  }

  return { auth: true, user };
}

export async function enqueueSync(
  item: Omit<SyncQueueItem, "id" | "createdAt" | "status" | "retryCount" | "lastError">
): Promise<SyncQueueItem> {
  const syncItem: SyncQueueItem = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "pending",
    retryCount: 0,
    lastError: "",
    ...item
  };
  await putOne("syncQueue", syncItem);
  return syncItem;
}

export async function markPendingSyncAsSynced(): Promise<void> {
  const queue = await getAll("syncQueue");
  const updated = queue.map((item) =>
    item.status === "pending" ? { ...item, status: "synced" as const, lastError: "" } : item
  );
  await putMany("syncQueue", updated);

  const transactions = await getAll("transactions");
  await putMany(
    "transactions",
    transactions.map((transaction) =>
      transaction.syncStatus === "pending" ? { ...transaction, syncStatus: "synced" } : transaction
    )
  );
}

export async function seedIfNeeded(): Promise<void> {
  const seeded = await getOne("meta", "seeded");
  if (seeded) {
    // Check if store name has changed and needs updating
    const existing = await getOne("settings", "store");
    if (existing && existing.store !== seedSettings.store) {
      await putOne("settings", seedSettings);
    }
    return;
  }

  await putMany("categories", seedCategories);
  await putMany("products", seedProducts);
  await putMany("customers", seedCustomers);
  await putMany("users", seedUsers);
  await putMany("transactions", seedTransactions);
  await putMany("syncQueue", seedSyncQueue);
  await putOne("settings", seedSettings);
  await putOne("meta", { id: "featureFlags", value: DEFAULT_FEATURE_FLAGS });
  await putOne("meta", { id: "seeded", value: true });
}

export async function resetPrototypeData(): Promise<void> {
  const db = await openPosDb();
  const tx = db.transaction(STORES, "readwrite");
  for (const storeName of STORES) {
    tx.objectStore(storeName).clear();
  }
  await completeTransaction(tx);
  await seedIfNeeded();
}
