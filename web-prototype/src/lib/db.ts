import bcrypt from "bcryptjs";
import { DEFAULT_FEATURE_FLAGS, mergeFeatureFlags, type FeatureFlags } from "./feature-flags";
import { encryptPayload, payloadContainsPhi, type EncryptedData } from "./encryption";
import {
  seedBirSettings,
  seedCategories,
  seedCustomers,
  seedProducts,
  seedSettings,
  seedSyncQueue,
  seedTransactions,
  seedUsers
} from "./seed";
import type {
  AuthSession,
  AuditEntry,
  PermissionKey,
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
  UserRole,
  StoragePersistenceStatus,
  XReading,
  ZReading,
  PrescriptionDraft,
  RxSettings,
  SupervisorAck
} from "./types";

const DB_NAME = "pharmaspot-web-prototype";
const DB_VERSION = 7;
const SESSION_KEY = "pharmapos.auth.session";
const AUTO_LOGIN_SUPPRESS_KEY = "pharmapos.auth.suppressAutoLogin";
const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const BCRYPT_SALT_ROUNDS = 10;
const DEMO_AUTO_LOGIN_ENABLED = process.env.NEXT_PUBLIC_DEMO_AUTO_LOGIN === "true";

type StoredUser = User & { passwordHash: string };
export type LocalUserUpsert = {
  id?: string;
  username: string;
  fullname: string;
  role: User["role"];
  permissions: Record<PermissionKey, boolean>;
  password?: string;
};

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
  | "reprintQueue"
  | "supervisorAcks";

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
  "reprintQueue",
  "supervisorAcks"
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
  supervisorAcks: SupervisorAck;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function sanitizeUser(storedUser: StoredUser): User {
  const { passwordHash: _passwordHash, ...user } = storedUser;
  return user;
}

function isStoredUser(value: unknown): value is StoredUser {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as StoredUser).id === "string" &&
    typeof (value as StoredUser).username === "string" &&
    typeof (value as StoredUser).passwordHash === "string"
  );
}

function sessionStorageAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.sessionStorage !== "undefined" &&
    typeof window.sessionStorage.getItem === "function" &&
    typeof window.sessionStorage.setItem === "function" &&
    typeof window.sessionStorage.removeItem === "function"
  );
}

function localStorageAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined" &&
    typeof window.localStorage.getItem === "function" &&
    typeof window.localStorage.setItem === "function" &&
    typeof window.localStorage.removeItem === "function"
  );
}

function suppressAutoLogin(): void {
  if (!sessionStorageAvailable()) return;
  window.sessionStorage.setItem(AUTO_LOGIN_SUPPRESS_KEY, "1");
}

function clearAutoLoginSuppression(): void {
  if (!sessionStorageAvailable()) return;
  window.sessionStorage.removeItem(AUTO_LOGIN_SUPPRESS_KEY);
}

export function shouldAutoLogin(): boolean {
  if (!DEMO_AUTO_LOGIN_ENABLED) return false;
  if (!sessionStorageAvailable()) return true;
  return window.sessionStorage.getItem(AUTO_LOGIN_SUPPRESS_KEY) !== "1";
}

function ensureStores(db: IDBDatabase, tx: IDBTransaction): void {
  for (const storeName of STORES) {
    let store: IDBObjectStore;
    if (!db.objectStoreNames.contains(storeName)) {
      store = db.createObjectStore(storeName, { keyPath: "id" });
    } else {
      store = tx.objectStore(storeName);
    }
    // Ensure secondary indexes for sync and query performance
    if (storeName === "syncQueue" && !store.indexNames.contains("status")) {
      store.createIndex("status", "status", { unique: false });
    }
    if (storeName === "transactions" && !store.indexNames.contains("createdAt")) {
      store.createIndex("createdAt", "createdAt", { unique: false });
    }
    if (storeName === "products" && !store.indexNames.contains("barcode")) {
      store.createIndex("barcode", "barcode", { unique: false });
    }
  }
}

function applyMigrations(db: IDBDatabase, tx: IDBTransaction, oldVersion: number): void {
  ensureStores(db, tx);

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

  // V6: add supervisorAcks store for role-based permissions
  if (oldVersion < 6) {
    tx.objectStore("meta").put({ id: "schemaVersion", value: 6 });
  }

  // V7: add secondary indexes for syncQueue, transactions, and products
  if (oldVersion < 7) {
    tx.objectStore("meta").put({ id: "schemaVersion", value: 7 });
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

export async function getByIndex<TStore extends StoreName>(
  storeName: TStore,
  indexName: string,
  query: IDBValidKey
): Promise<StoreEntityMap[TStore][]> {
  const db = await openPosDb();
  const store = db.transaction(storeName, "readonly").objectStore(storeName);
  const index = store.index(indexName);
  const result = await promisifyRequest(index.getAll(query));
  if (storeName === "users") {
    return (result as unknown[]).filter(isStoredUser).map(sanitizeUser) as StoreEntityMap[TStore][];
  }
  return result;
}

export async function getAll<TStore extends StoreName>(
  storeName: TStore
): Promise<StoreEntityMap[TStore][]> {
  const db = await openPosDb();
  const result = await promisifyRequest(db.transaction(storeName, "readonly").objectStore(storeName).getAll());
  if (storeName === "users") {
    return (result as unknown[]).filter(isStoredUser).map(sanitizeUser) as StoreEntityMap[TStore][];
  }
  return result;
}

export async function getOne<TStore extends StoreName>(
  storeName: TStore,
  id: string
): Promise<StoreEntityMap[TStore] | undefined> {
  const db = await openPosDb();
  const result = await promisifyRequest(db.transaction(storeName, "readonly").objectStore(storeName).get(id));
  if (storeName === "users" && isStoredUser(result)) {
    return sanitizeUser(result) as StoreEntityMap[TStore];
  }
  return result as StoreEntityMap[TStore] | undefined;
}

async function getStoredUsers(): Promise<StoredUser[]> {
  const db = await openPosDb();
  const result = await promisifyRequest(db.transaction("users", "readonly").objectStore("users").getAll());
  return (result as unknown[]).filter(isStoredUser);
}

async function getStoredUser(id: string): Promise<StoredUser | undefined> {
  const db = await openPosDb();
  const result = await promisifyRequest(db.transaction("users", "readonly").objectStore("users").get(id));
  return isStoredUser(result) ? result : undefined;
}

function defaultPasswordForUser(user: User): string {
  if (user.username === "admin") return "admin";
  if (user.username === "cashier") return "cashier";
  if (user.username === "supervisor") return "supervisor";
  if (user.username === "pharmacist") return "pharmacist";
  return user.username;
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

// Dedicated function for storing users with password hashes (type-safe, avoids cast bypass)
export async function putManyUsers(values: StoredUser[]): Promise<void> {
  const db = await openPosDb();
  const tx = db.transaction("users", "readwrite");
  const store = tx.objectStore("users");
  values.forEach((value) => store.put(value));
  await completeTransaction(tx);
}

export async function saveLocalUserAccount(input: LocalUserUpsert): Promise<User> {
  const normalizedUsername = input.username.trim();
  const normalizedFullname = input.fullname.trim();
  if (!normalizedUsername || !normalizedFullname) {
    throw new Error("Username and full name are required.");
  }

  const existing = input.id ? await getStoredUser(input.id) : undefined;
  if (!existing && !input.password) {
    throw new Error("Password is required when creating a user.");
  }

  const passwordHash = input.password
    ? await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS)
    : existing?.passwordHash;

  if (!passwordHash) {
    throw new Error("Unable to resolve a password hash for this user.");
  }

  const storedUser: StoredUser = {
    id: input.id ?? crypto.randomUUID(),
    username: normalizedUsername,
    fullname: normalizedFullname,
    role: input.role,
    permissions: input.permissions,
    passwordHash
  };

  const db = await openPosDb();
  const tx = db.transaction("users", "readwrite");
  tx.objectStore("users").put(storedUser);
  await completeTransaction(tx);
  return sanitizeUser(storedUser);
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

export async function enqueueSync(
  item: Omit<SyncQueueItem, "id" | "createdAt" | "status" | "retryCount" | "lastError">
): Promise<SyncQueueItem> {
  // Auto-encrypt PHI payloads before storing in sync queue
  let encrypted: EncryptedData | undefined;
  if (payloadContainsPhi(item.payload)) {
    encrypted = await encryptPayload(item.payload);
  }

  const syncItem: SyncQueueItem = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "pending",
    retryCount: 0,
    lastError: "",
    ...item,
    encrypted
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

export async function getLastPullTimestamp(entity?: string): Promise<string | null> {
  const key = entity ? `${entity}:lastPullTimestamp` : "global:lastPullTimestamp";
  const meta = await getOne("meta", key);
  if (!meta || typeof meta.value !== "string" || !meta.value) return null;
  return meta.value;
}

export async function setLastPullTimestamp(timestamp: string, entity?: string): Promise<void> {
  const key = entity ? `${entity}:lastPullTimestamp` : "global:lastPullTimestamp";
  await putOne("meta", { id: key, value: timestamp });
}

export async function markTransactionsAsSynced(transactionIds: string[]): Promise<void> {
  if (transactionIds.length === 0) return;
  const unique = new Set(transactionIds);
  const transactions = await getAll("transactions");
  const updated = transactions.map((transaction) => {
    if (transaction.syncStatus === "pending" && unique.has(transaction.id)) {
      return { ...transaction, syncStatus: "synced" as const };
    }
    return transaction;
  });
  if (updated.some((txn, index) => txn.syncStatus !== transactions[index].syncStatus)) {
    await putMany("transactions", updated);
  }
}

export async function purgeSyncedItems(olderThanMs = 7 * 86400000): Promise<number> {
  const cutoff = Date.now() - olderThanMs;
  const synced = await getByIndex("syncQueue", "status", "synced");
  const staleIds = synced
    .filter((item) => new Date(item.createdAt).getTime() <= cutoff)
    .map((item) => item.id);

  if (staleIds.length === 0) return 0;

  const db = await openPosDb();
  const tx = db.transaction("syncQueue", "readwrite");
  const store = tx.objectStore("syncQueue");
  for (const id of staleIds) {
    store.delete(id);
  }
  await completeTransaction(tx);
  return staleIds.length;
}

export function readSession(): AuthSession | null {
  if (!localStorageAvailable()) return null;

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as AuthSession;
    if (
      typeof session.userId !== "string" ||
      typeof session.username !== "string" ||
      typeof session.startedAt !== "string" ||
      typeof session.expiresAt !== "string"
    ) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }

    return session;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function writeSession(user: User, ttlMs = DEFAULT_SESSION_TTL_MS): AuthSession {
  const startedAt = new Date().toISOString();
  const session: AuthSession = {
    userId: user.id,
    username: user.username,
    startedAt,
    expiresAt: new Date(Date.now() + ttlMs).toISOString()
  };

  if (localStorageAvailable()) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  clearAutoLoginSuppression();
  return session;
}

export function logout(): void {
  if (localStorageAvailable()) {
    window.localStorage.removeItem(SESSION_KEY);
  }
  suppressAutoLogin();
}

export async function login(username: string, password: string): Promise<{ auth: boolean; user?: User }> {
  const normalizedUsername = username.trim();
  if (!normalizedUsername || !password) {
    return { auth: false };
  }

  const users = await getStoredUsers();
  const storedUser = users.find((candidate) => candidate.username === normalizedUsername);
  if (!storedUser) {
    return { auth: false };
  }

  const passwordMatches = await bcrypt.compare(password, storedUser.passwordHash);
  if (!passwordMatches) {
    return { auth: false };
  }

  const user = sanitizeUser(storedUser);
  writeSession(user);
  return { auth: true, user };
}

export async function requestPersistentStorage(): Promise<StoragePersistenceStatus> {
  if (
    typeof navigator === "undefined" ||
    !("storage" in navigator) ||
    typeof navigator.storage?.persist !== "function"
  ) {
    return "unsupported";
  }

  const alreadyPersisted = typeof navigator.storage.persisted === "function"
    ? await navigator.storage.persisted()
    : false;
  if (alreadyPersisted) {
    return "granted";
  }

  try {
    const granted = await navigator.storage.persist();
    return granted ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

export async function seedIfNeeded(): Promise<void> {
  const seeded = await getOne("meta", "seeded");
  if (seeded) {
    // Check if store name has changed and needs updating
    const existing = await getOne("settings", "store");
    if (existing && existing.store !== seedSettings.store) {
      await putOne("settings", seedSettings);
    }
    const db = await openPosDb();
    const rawUsers = await promisifyRequest(db.transaction("users", "readonly").objectStore("users").getAll());
    const nextUsers = await Promise.all(
      (rawUsers as Array<User | StoredUser>).map(async (user) => {
        if (isStoredUser(user)) {
          return user;
        }
        return {
          ...user,
          passwordHash: await bcrypt.hash(defaultPasswordForUser(user), BCRYPT_SALT_ROUNDS)
        };
      })
    );
    const hasMissingHashes = nextUsers.some((user, index) => !isStoredUser((rawUsers as Array<User | StoredUser>)[index]));
    if (hasMissingHashes) {
      await putManyUsers(nextUsers);
    }
    return;
  }

  await putMany("categories", seedCategories);
  await putMany("products", seedProducts);
  await putMany("customers", seedCustomers);
  const seededUsers = await Promise.all(
    seedUsers.map(async (user) => ({
      ...user,
      passwordHash: await bcrypt.hash(defaultPasswordForUser(user), BCRYPT_SALT_ROUNDS)
    }))
  );
  await putManyUsers(seededUsers);
  await putMany("transactions", seedTransactions);
  await putMany("syncQueue", seedSyncQueue);
  await putOne("settings", seedSettings);
  await putOne("birSettings", seedBirSettings);
  await putOne("meta", { id: "featureFlags", value: DEFAULT_FEATURE_FLAGS });
  await putOne("meta", { id: "seeded", value: true });
}

export async function acknowledgeOverride(
  actionType: SupervisorAck["actionType"],
  supervisorId: string,
  supervisorName: string,
  reason: string,
  targetId?: string,
): Promise<SupervisorAck> {
  const ack: SupervisorAck = {
    id: `ack-${crypto.randomUUID()}`,
    actionType,
    supervisorId,
    supervisorName,
    reason,
    targetId,
    createdAt: new Date().toISOString(),
  };
  await putOne("supervisorAcks", ack);
  return ack;
}

// Stores that are protected when hardBlockPrototypeReset is enabled (Rx/DD policy)
const PROTECTED_STORES = [
  "rxSettings",
  "prescriptions",
  "xReadings",
  "zReadings",
  "auditLog",
  "printerActivity",
] as const;

export async function atomicSaleWrite(
  products: Product[],
  transaction: Transaction,
  birSettings: (BirSettings & { id: string }) | null
): Promise<void> {
  const storeNames: StoreName[] = ["products", "transactions"];
  if (birSettings) storeNames.push("birSettings");

  const db = await openPosDb();
  const tx = db.transaction(storeNames, "readwrite");

  for (const product of products) {
    tx.objectStore("products").put(product);
  }

  tx.objectStore("transactions").put(transaction);

  if (birSettings) {
    tx.objectStore("birSettings").put(birSettings);
  }

  await completeTransaction(tx);
}

export async function getConflictItems(): Promise<SyncQueueItem[]> {
  return getByIndex("syncQueue", "status", "conflict");
}

export async function getProductByBarcode(barcode: string): Promise<Product | undefined> {
  const results = await getByIndex("products", "barcode", barcode);
  return results[0] as Product | undefined;
}

export async function exportAllData(): Promise<Record<string, unknown[]>> {
  const data: Record<string, unknown[]> = {};
  for (const storeName of STORES) {
    if (storeName === "users") {
      // Export sanitized users (no password hashes)
      data[storeName] = await getAll(storeName);
    } else {
      data[storeName] = await getAll(storeName);
    }
  }
  return data;
}

export async function importAllData(data: Record<string, unknown[]>): Promise<void> {
  const db = await openPosDb();
  const tx = db.transaction(STORES, "readwrite");
  for (const storeName of STORES) {
    const store = tx.objectStore(storeName);
    store.clear();
    const items = data[storeName] || [];
    for (const item of items) {
      store.put(item);
    }
  }
  await completeTransaction(tx);
}

export async function resetPrototypeData(): Promise<void> {
  // Read hardBlockPrototypeReset flag before clearing anything
  const rxSettings = await getOne("rxSettings", "rx-settings");
  const hardBlock =
    rxSettings && typeof (rxSettings as { hardBlockPrototypeReset?: unknown }).hardBlockPrototypeReset === "boolean"
      ? (rxSettings as { hardBlockPrototypeReset: boolean }).hardBlockPrototypeReset
      : false;

  const db = await openPosDb();
  const tx = db.transaction(STORES, "readwrite");

  if (hardBlock) {
    // Only clear stores that are NOT protected
    const clearableStores = STORES.filter((s) => !PROTECTED_STORES.includes(s as typeof PROTECTED_STORES[number]));
    for (const storeName of clearableStores) {
      tx.objectStore(storeName).clear();
    }
    // Re-seed birSettings even in protected mode (BIR OR series resets are operational, not Rx/DD)
    const birSeedTx = db.transaction("birSettings", "readwrite");
    birSeedTx.objectStore("birSettings").put(seedBirSettings);
    await completeTransaction(birSeedTx);
  } else {
    // Unconditional full reset (prototype mode)
    for (const storeName of STORES) {
      tx.objectStore(storeName).clear();
    }
  }

  await completeTransaction(tx);
  await seedIfNeeded();
}

export async function resetPosDbForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
  if (typeof indexedDB !== "undefined") {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => resolve();
    });
  }
  if (localStorageAvailable()) {
    window.localStorage.removeItem(SESSION_KEY);
  }
  if (sessionStorageAvailable()) {
    window.sessionStorage.removeItem(AUTO_LOGIN_SUPPRESS_KEY);
  }
}
