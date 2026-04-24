"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { calculateCartTotals, calculateChange, decrementStock, makeLocalNumber, money } from "./calculations";
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from "./feature-flags";
import {
  deleteOne,
  enqueueSync,
  getAll,
  getOne,
  markPendingSyncAsSynced,
  putMany,
  putOne,
  resetPrototypeData,
  seedIfNeeded,
  getFeatureFlags
} from "./db";
import {
  buildSnapshot,
  defaultSloTargets,
  evaluateAlerts,
  logStructured,
  traced,
  type Alert,
  type ObservabilitySnapshot,
  type TelemetryEvent
} from "./observability";
import type {
  CartItem,
  Category,
  Customer,
  HeldOrder,
  PaymentMethod,
  PaymentStatus,
  Product,
  Settings,
  SyncQueueItem,
  Transaction,
  User
} from "./types";

type LoadState = "booting" | "ready" | "error";

export type SaleInput = {
  method: PaymentMethod;
  paid: number;
  paymentStatus: PaymentStatus;
  reference: string;
};

export function usePosStore() {
  const [loadState, setLoadState] = useState<LoadState>("booting");
  const [error, setError] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [customerId, setCustomerId] = useState("walk-in");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [forcedOffline, setForcedOffline] = useState(false);
  const [browserOnline, setBrowserOnline] = useState(true);
  const [lastReceipt, setLastReceipt] = useState<Transaction | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [telemetryEvents, setTelemetryEvents] = useState<TelemetryEvent[]>([]);
  const [offlineStartedAt, setOfflineStartedAt] = useState<string | null>(null);
  const [offlineSecondsTotal, setOfflineSecondsTotal] = useState(0);

  const online = browserOnline && !forcedOffline;
  const pendingSync = useMemo(() => syncQueue.filter((item) => item.status === "pending"), [syncQueue]);

  const recordEvent = useCallback((event: Omit<TelemetryEvent, "ts">) => {
    const eventWithTs: TelemetryEvent = { ...event, ts: new Date().toISOString() };
    setTelemetryEvents((existing) => [...existing.slice(-399), eventWithTs]);
  }, []);

  const refresh = useCallback(async () => {
    const [nextProducts, nextCategories, nextCustomers, nextUsers, nextSettings, nextTransactions, nextHeld, nextSync, nextFlags] =
      await Promise.all([
        getAll("products"),
        getAll("categories"),
        getAll("customers"),
        getAll("users"),
        getOne("settings", "store"),
        getAll("transactions"),
        getAll("heldOrders"),
        getAll("syncQueue"),
        getFeatureFlags()
      ]);

    setProducts(nextProducts);
    setCategories(nextCategories);
    setCustomers(nextCustomers);
    setUsers(nextUsers);
    setSettings(nextSettings || null);
    setTransactions(nextTransactions.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setHeldOrders(nextHeld.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setSyncQueue(nextSync.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setFeatureFlags(nextFlags);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        setBrowserOnline(typeof navigator === "undefined" ? true : navigator.onLine);
        await seedIfNeeded();
        await refresh();
        const admin = await getAll("users");
        if (mounted) {
          setCurrentUser(admin.find((user) => user.username === "admin") || null);
          setLoadState("ready");
        }
      } catch (bootError) {
        if (mounted) {
          setError(bootError instanceof Error ? bootError.message : "Unable to open local database.");
          setLoadState("error");
        }
      }
    }

    boot();
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      mounted = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refresh]);

  useEffect(() => {
    recordEvent({ type: "network_state", details: { online } });
    logStructured("info", "network.state", { online, forcedOffline, browserOnline });
    if (online) {
      if (offlineStartedAt) {
        const durationSeconds = (Date.now() - new Date(offlineStartedAt).getTime()) / 1000;
        setOfflineSecondsTotal((value) => value + Math.max(0, durationSeconds));
        setOfflineStartedAt(null);
      }
      return;
    }

    if (!offlineStartedAt) {
      setOfflineStartedAt(new Date().toISOString());
    }
  }, [browserOnline, forcedOffline, offlineStartedAt, online, recordEvent]);

  const totals = useMemo(
    () => calculateCartTotals(cart, settings || { chargeTax: false, vatPercentage: 0 }, discount),
    [cart, discount, settings]
  );

  const addToCart = useCallback((product: Product) => {
    if (product.tracksStock && product.quantity <= 0) return;

    setCart((items) => {
      const existing = items.find((item) => item.productId === product.id);
      if (existing) {
        return items.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: product.tracksStock ? Math.min(item.quantity + 1, product.quantity) : item.quantity + 1
              }
            : item
        );
      }

      return [
        ...items,
        { productId: product.id, productName: product.name, price: product.price, quantity: 1 }
      ];
    });
  }, []);

  const updateCartQuantity = useCallback((productId: string, quantity: number) => {
    const product = products.find((item) => item.id === productId);
    const max = product?.tracksStock ? product.quantity : 999;
    const safeQuantity = Math.max(1, Math.min(quantity, max || 1));
    setCart((items) => items.map((item) => (item.productId === productId ? { ...item, quantity: safeQuantity } : item)));
  }, [products]);

  const removeFromCart = useCallback((productId: string) => {
    setCart((items) => items.filter((item) => item.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscount(0);
    setCustomerId("walk-in");
  }, []);

  const completeSale = useCallback(
    async (input: SaleInput) => {
      if (!settings || !currentUser || cart.length === 0) return null;
      if (!featureFlags.payments) return null;
      return traced("pos.complete_sale", { paymentMethod: input.method, cartLines: cart.length }, async () => {
        const saleTotals = calculateCartTotals(cart, settings, discount);
        const paid = input.method === "cash" ? input.paid : saleTotals.total;
        const transaction: Transaction = {
          id: crypto.randomUUID(),
          localNumber: makeLocalNumber(),
          items: cart.map((item) => ({ ...item, lineTotal: money(item.price * item.quantity) })),
          customerId,
          cashierId: currentUser.id,
          createdAt: new Date().toISOString(),
          subtotal: saleTotals.subtotal,
          discount: saleTotals.discount,
          tax: saleTotals.tax,
          total: saleTotals.total,
          paid,
          change: calculateChange(saleTotals.total, paid),
          paymentMethod: input.method,
          paymentStatus: input.paymentStatus,
          paymentReference: input.reference.trim(),
          syncStatus: "pending"
        };

        recordEvent({ type: "payment_attempt", details: { status: input.paymentStatus, method: input.method, total: saleTotals.total } });
        const updatedProducts = decrementStock(products, cart);
        await putMany("products", updatedProducts);
        await putOne("transactions", transaction);
        await enqueueSync({ entity: "transaction", operation: "create", payload: transaction });
        await enqueueSync({ entity: "product", operation: "update", payload: updatedProducts });
        recordEvent({ type: "sync_enqueued", details: { entity: "transaction", localNumber: transaction.localNumber } });
        recordEvent({ type: "order_completed", details: { localNumber: transaction.localNumber, total: transaction.total } });
        logStructured("info", "order.completed", {
          localNumber: transaction.localNumber,
          method: input.method,
          status: input.paymentStatus,
          total: transaction.total
        });

        setLastReceipt(transaction);
        clearCart();
        await refresh();
        return transaction;
      }).catch(async (error) => {
        const message = error instanceof Error ? error.message : "Unknown failure";
        recordEvent({ type: "mutation_failed", details: { scope: "completeSale", message } });
        logStructured("error", "mutation.failed", { scope: "completeSale", message });
        throw error;
      });
    },
    [cart, clearCart, currentUser, customerId, discount, featureFlags.payments, products, recordEvent, refresh, settings]
  );

  const holdOrder = useCallback(
    async (reference: string) => {
      if (cart.length === 0) return null;
      const order: HeldOrder = {
        id: crypto.randomUUID(),
        reference: reference.trim() || `Hold ${heldOrders.length + 1}`,
        items: cart,
        customerId,
        discount,
        createdAt: new Date().toISOString()
      };
      await putOne("heldOrders", order);
      await enqueueSync({ entity: "held-order", operation: "create", payload: order });
      clearCart();
      await refresh();
      return order;
    },
    [cart, clearCart, customerId, discount, heldOrders.length, refresh]
  );

  const resumeHeldOrder = useCallback(
    async (order: HeldOrder) => {
      setCart(order.items);
      setCustomerId(order.customerId);
      setDiscount(order.discount);
      await deleteOne("heldOrders", order.id);
      await enqueueSync({ entity: "held-order", operation: "delete", payload: order });
      await refresh();
    },
    [refresh]
  );

  const saveEntity = useCallback(
    async <T extends Product | Category | Customer | User | Settings>(
      storeName: "products" | "categories" | "customers" | "users" | "settings",
      entity: T,
      syncEntity: SyncQueueItem["entity"]
    ) => {
      await putOne(storeName, entity as never);
      await enqueueSync({ entity: syncEntity, operation: "update", payload: entity });
      await refresh();
    },
    [refresh]
  );

  const removeEntity = useCallback(
    async (storeName: "products" | "categories" | "customers" | "users", id: string, syncEntity: SyncQueueItem["entity"]) => {
      await deleteOne(storeName, id);
      await enqueueSync({ entity: syncEntity, operation: "delete", payload: { id } });
      await refresh();
    },
    [refresh]
  );

  const syncNow = useCallback(async () => {
    if (!featureFlags.sync) return;
    setSyncing(true);
    await traced("sync.now", { pending: pendingSync.length }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await markPendingSyncAsSynced();
      recordEvent({ type: "sync_completed", details: { flushed: pendingSync.length } });
      logStructured("info", "sync.completed", { flushed: pendingSync.length });
      await refresh();
    }).catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown failure";
      recordEvent({ type: "sync_failed", details: { message } });
      logStructured("error", "sync.failed", { message });
      throw error;
    });
    setSyncing(false);
  }, [featureFlags.sync, pendingSync.length, recordEvent, refresh]);

  const refundTransaction = useCallback(
    async (transactionId: string, reason: string) => {
      if (!featureFlags.refunds) return null;
      const transaction = transactions.find((item) => item.id === transactionId);
      if (!transaction || transaction.paymentStatus === "refunded") return null;

      const refunded = {
        ...transaction,
        paymentStatus: "refunded" as const,
        refundReason: reason.trim() || "Operator initiated",
        refundedAt: new Date().toISOString(),
        refundReference: `refund-${transaction.localNumber}`
      };

      await putOne("transactions", refunded);
      await enqueueSync({ entity: "transaction", operation: "update", payload: refunded });
      await refresh();
      return refunded;
    },
    [featureFlags.refunds, refresh, transactions]
  );

  const resetData = useCallback(async () => {
    await resetPrototypeData();
    clearCart();
    setLastReceipt(null);
    await refresh();
  }, [clearCart, refresh]);

  const login = useCallback(
    (username: string) => {
      const user = users.find((candidate) => candidate.username === username);
      if (user) setCurrentUser(user);
      return Boolean(user);
    },
    [users]
  );

  const observabilitySnapshot: ObservabilitySnapshot = useMemo(() => {
    const activeOfflineSeconds =
      !online && offlineStartedAt ? (Date.now() - new Date(offlineStartedAt).getTime()) / 1000 : 0;
    return buildSnapshot({
      events: telemetryEvents,
      pendingCreatedAt: pendingSync.map((item) => item.createdAt),
      offlineDurationSeconds: offlineSecondsTotal + activeOfflineSeconds
    });
  }, [offlineSecondsTotal, offlineStartedAt, online, pendingSync, telemetryEvents]);

  const activeAlerts: Alert[] = useMemo(
    () => evaluateAlerts(observabilitySnapshot, defaultSloTargets),
    [observabilitySnapshot]
  );

  return {
    loadState,
    error,
    products,
    categories,
    customers,
    users,
    settings,
    transactions,
    heldOrders,
    syncQueue,
    cart,
    discount,
    customerId,
    currentUser,
    forcedOffline,
    online,
    totals,
    lastReceipt,
    syncing,
    featureFlags,
    setDiscount,
    setCustomerId,
    setForcedOffline,
    setLastReceipt,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    completeSale,
    holdOrder,
    resumeHeldOrder,
    saveEntity,
    removeEntity,
    syncNow,
    refundTransaction,
    resetData,
    login,
    observabilitySnapshot,
    sloTargets: defaultSloTargets,
    activeAlerts
  };
}
