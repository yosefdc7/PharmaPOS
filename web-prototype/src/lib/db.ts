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
  Category,
  Customer,
  HeldOrder,
  Product,
  Settings,
  SyncQueueItem,
  Transaction,
  User
} from "./types";

const DB_NAME = "pharmaspot-web-prototype";
const DB_VERSION = 1;

export type StoreName =
  | "meta"
  | "products"
  | "categories"
  | "customers"
  | "users"
  | "settings"
  | "transactions"
  | "heldOrders"
  | "syncQueue";

const STORES: StoreName[] = [
  "meta",
  "products",
  "categories",
  "customers",
  "users",
  "settings",
  "transactions",
  "heldOrders",
  "syncQueue"
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
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function openPosDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeName of STORES) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: "id" });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function completeTransaction(tx: IDBTransaction): Promise<void> {
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
  return promisifyRequest(db.transaction(storeName, "readonly").objectStore(storeName).get(id));
}

export async function putOne<TStore extends StoreName>(
  storeName: TStore,
  value: StoreEntityMap[TStore]
): Promise<void> {
  const db = await openPosDb();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).put(value);
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
  if (seeded) return;

  await putMany("categories", seedCategories);
  await putMany("products", seedProducts);
  await putMany("customers", seedCustomers);
  await putMany("users", seedUsers);
  await putMany("transactions", seedTransactions);
  await putMany("syncQueue", seedSyncQueue);
  await putOne("settings", seedSettings);
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
