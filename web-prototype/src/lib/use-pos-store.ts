"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { calculateCartTotals, calculateChange, decrementStock, makeLocalNumber, money } from "./calculations";
import {
  deleteOne,
  enqueueSync,
  getAll,
  getOne,
  markPendingSyncAsSynced,
  putMany,
  putOne,
  resetPrototypeData,
  seedIfNeeded
} from "./db";
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

  const online = browserOnline && !forcedOffline;

  const refresh = useCallback(async () => {
    const [nextProducts, nextCategories, nextCustomers, nextUsers, nextSettings, nextTransactions, nextHeld, nextSync] =
      await Promise.all([
        getAll("products"),
        getAll("categories"),
        getAll("customers"),
        getAll("users"),
        getOne("settings", "store"),
        getAll("transactions"),
        getAll("heldOrders"),
        getAll("syncQueue")
      ]);

    setProducts(nextProducts);
    setCategories(nextCategories);
    setCustomers(nextCustomers);
    setUsers(nextUsers);
    setSettings(nextSettings || null);
    setTransactions(nextTransactions.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setHeldOrders(nextHeld.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setSyncQueue(nextSync.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
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

      const updatedProducts = decrementStock(products, cart);
      await putMany("products", updatedProducts);
      await putOne("transactions", transaction);
      await enqueueSync({ entity: "transaction", operation: "create", payload: transaction });
      await enqueueSync({ entity: "product", operation: "update", payload: updatedProducts });

      setLastReceipt(transaction);
      clearCart();
      await refresh();
      return transaction;
    },
    [cart, clearCart, currentUser, customerId, discount, products, refresh, settings]
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
    setSyncing(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    await markPendingSyncAsSynced();
    await refresh();
    setSyncing(false);
  }, [refresh]);

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
    resetData,
    login
  };
}
