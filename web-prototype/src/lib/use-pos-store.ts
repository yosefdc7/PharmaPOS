"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildScPwdCartItems,
  calculateCartTotals,
  calculateChange,
  calculateScPwdTotals,
  decrementStock,
  makeLocalNumber,
  money
} from "./calculations";
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from "./feature-flags";
import {
  deleteOne,
  enqueueSync,
  getAll,
  getFeatureFlags,
  getOne,
  login as loginLocal,
  markPendingSyncAsSynced,
  putMany,
  putOne,
  resetPrototypeData,
  seedIfNeeded
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
  BirSettings,
  CartItem,
  Category,
  Customer,
  HeldOrder,
  PaymentMethod,
  PaymentStatus,
  PrescriptionDraft,
  PrescriptionRefusal,
  PrinterProfile,
  Product,
  ReprintQueueItem,
  RxInspectionSnapshot,
  RxPharmacist,
  RxRedFlag,
  RxSettings,
  ScPwdAlert,
  ScPwdCustomerDetails,
  ScPwdSettings,
  ScPwdSummaryCard,
  ScPwdTransactionLogRow,
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
  const [remarks, setRemarks] = useState("");
  const [customerId, setCustomerId] = useState("walk-in");
  const [scPwdDraft, setScPwdDraft] = useState<ScPwdCustomerDetails | null>(null);
  const [activeScPwdDiscount, setActiveScPwdDiscount] = useState(false);
  const [scPwdTransactionLog, setScPwdTransactionLog] = useState<ScPwdTransactionLogRow[]>([]);
  const [scPwdAlerts, setScPwdAlerts] = useState<ScPwdAlert[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [forcedOffline, setForcedOffline] = useState(false);
  const [browserOnline, setBrowserOnline] = useState(true);
  const [lastReceipt, setLastReceipt] = useState<Transaction | null>(null);
  const [printFailure, setPrintFailure] = useState<{ transaction: Transaction; printer: PrinterProfile | null } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [telemetryEvents, setTelemetryEvents] = useState<TelemetryEvent[]>([]);
  const [offlineStartedAt, setOfflineStartedAt] = useState<string | null>(null);
  const [offlineSecondsTotal, setOfflineSecondsTotal] = useState(0);
  const [rxPharmacists, setRxPharmacists] = useState<RxPharmacist[]>([
    { id: "rx-pharm-1", name: "Rina Dela Cruz", prcNumber: "PRC-1263901", role: "pharmacist" },
    { id: "rx-pharm-2", name: "Miguel Santos", prcNumber: "PRC-1130254", role: "pharmacist" },
    { id: "rx-admin-1", name: "Maria Velasco", prcNumber: "PRC-1028704", role: "admin" }
  ]);
  const [rxPrescriptionDrafts, setRxPrescriptionDrafts] = useState<PrescriptionDraft[]>([]);
  const [rxRedFlags, setRxRedFlags] = useState<RxRedFlag[]>([
    {
      id: "rx-flag-1",
      severity: "warning",
      title: "Duplicate DD dispensing window",
      reason: "Same patient received Diazepam 5mg within 30 days.",
      createdAt: new Date().toISOString()
    }
  ]);
  const [rxRefusals, setRxRefusals] = useState<PrescriptionRefusal[]>([]);
  const [rxSettings, setRxSettings] = useState<RxSettings>({
    ddEddLowStockThreshold: 10,
    profileRetentionYears: 10,
    hardBlockPrototypeReset: true
  });

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
    setCustomers(nextCustomers.map((customer) => ({ ...customer, createdAt: customer.createdAt ?? new Date(0).toISOString() })));
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
        if (mounted) {
          const result = await loginLocal("admin", "admin");
          setCurrentUser(result.auth && result.user ? result.user : null);
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

  const totals = useMemo(() => {
    const scPwdSettings = settings?.scPwdSettings;
    if (activeScPwdDiscount && scPwdSettings?.enabled) {
      const scPwdTotals = calculateScPwdTotals(cart, products, settings!, discount, scPwdSettings);
      const processedCart = buildScPwdCartItems(cart, products, settings!, scPwdSettings, discount);
      return calculateCartTotals(
        processedCart,
        settings || { chargeTax: false, vatPercentage: 0 },
        scPwdTotals.manualDiscount
      );
    }
    return calculateCartTotals(cart, settings || { chargeTax: false, vatPercentage: 0 }, discount);
  }, [cart, discount, settings, activeScPwdDiscount, products]);

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
    setRemarks("");
    setCustomerId("walk-in");
    setScPwdDraft(null);
    setActiveScPwdDiscount(false);
  }, []);

  const completeSale = useCallback(
    async (input: SaleInput) => {
      if (!settings || !currentUser || cart.length === 0) return null;
      if (!featureFlags.payments) return null;
      return traced("pos.complete_sale", { paymentMethod: input.method, cartLines: cart.length }, async () => {
        // Load BIR settings for OR series
        const birRaw = await getOne("birSettings", "bir");
        const bir = birRaw as BirSettings | undefined;
        if (bir && bir.currentOrNumber >= bir.orSeriesEnd) {
          throw new Error("OR series exhausted. Please contact BIR for a new PTU.");
        }
        const scPwdSettings = settings.scPwdSettings;
        const isScPwdActive = activeScPwdDiscount && scPwdSettings?.enabled;
        const processedCart = isScPwdActive
          ? buildScPwdCartItems(cart, products, settings, scPwdSettings, discount)
          : cart;
        const saleTotals = calculateCartTotals(
          processedCart,
          settings,
          isScPwdActive ? 0 : discount
        );
        const paid = input.method === "cash" ? input.paid : saleTotals.total;

        // Assign OR number from BIR settings or fallback to local number
        const orNumber = bir ? String(bir.currentOrNumber) : makeLocalNumber();

        const transaction: Transaction = {
          id: crypto.randomUUID(),
          localNumber: orNumber,
          items: processedCart.map((item) => ({ ...item, lineTotal: money(item.price * item.quantity) })),
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
          syncStatus: "pending",
          remarks: remarks.trim(),
          scPwdMetadata: isScPwdActive && scPwdDraft
            ? {
                ...scPwdDraft,
                scPwdDiscountAmount: saleTotals.discount,
                scPwdVatRemoved: 0
              }
            : undefined
        };

        recordEvent({ type: "payment_attempt", details: { status: input.paymentStatus, method: input.method, total: saleTotals.total } });
        if (isScPwdActive && scPwdDraft) {
          const row: ScPwdTransactionLogRow = {
            id: crypto.randomUUID(),
            transactionId: transaction.id,
            orNumber: transaction.localNumber,
            timestamp: transaction.createdAt,
            discountType: scPwdDraft.chosenDiscount ?? scPwdDraft.discountType,
            customerName: scPwdDraft.fullName,
            idNumber: scPwdDraft.idNumber,
            grossAmount: saleTotals.subtotal,
            scPwdDiscountAmount: saleTotals.discount,
            vatRemoved: transaction.scPwdMetadata?.scPwdVatRemoved ?? 0,
            netAmount: saleTotals.total,
            items: processedCart
              .filter((i) => i.scPwdDiscounted)
              .map((i) => ({
                name: i.productName,
                qty: i.quantity,
                originalPrice: i.originalPrice ?? i.price,
                discountAmount: i.scPwdDiscountAmount ?? 0,
                finalPrice: i.price
              })),
            proxyPurchase: scPwdDraft.proxyPurchase,
            supervisorOverride: transaction.scPwdMetadata?.supervisorOverride
          };
          setScPwdTransactionLog((prev) => [...prev, row]);
        }
        const updatedProducts = decrementStock(products, processedCart);
        await putMany("products", updatedProducts);
        await putOne("transactions", transaction);

        // Increment and persist OR number
        if (bir) {
          const updatedBir: BirSettings & { id: string } = { ...bir, id: "bir", currentOrNumber: bir.currentOrNumber + 1 };
          await putOne("birSettings", updatedBir);
        }

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

        // Attempt thermal print
        try {
          const { PrinterService, createPrinterBackend, buildReceipt, enqueuePrintJob } = await import("./printer");
          const profiles = (await getAll("printerProfiles")) as PrinterProfile[];
          const orPrinter = profiles.find((p) => p.isDefault && (p.role === "or" || p.role === "both"))
            ?? profiles.find((p) => p.role === "or" || p.role === "both");
          if (orPrinter) {
            const service = new PrinterService(createPrinterBackend);
            const connectResult = await service.connect(orPrinter);
            if (connectResult.status === "success") {
              const commands = buildReceipt("normal", orPrinter, bir, transaction);
              const printResult = await service.print(commands);
              await service.disconnect();
              if (printResult.status !== "success") {
                await enqueuePrintJob(Number(transaction.localNumber), transaction.id, commands, orPrinter.id);
                setPrintFailure({ transaction, printer: orPrinter });
              } else {
                // log success printer activity handled by pos-prototype if needed
              }
            } else {
              await enqueuePrintJob(Number(transaction.localNumber), transaction.id, new Uint8Array(0), orPrinter.id);
              setPrintFailure({ transaction, printer: orPrinter });
            }
          }
        } catch (printErr) {
          // printing failure should not fail the sale; enqueue silently
          console.error("Print attempt failed:", printErr);
        }

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
    [activeScPwdDiscount, cart, clearCart, currentUser, customerId, discount, featureFlags.payments, products, recordEvent, refresh, remarks, scPwdDraft, settings]
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
        remarks: remarks.trim(),
        createdAt: new Date().toISOString(),
        scPwdDiscountActive: activeScPwdDiscount,
        scPwdDraft: scPwdDraft ?? undefined
      };
      await putOne("heldOrders", order);
      await enqueueSync({ entity: "held-order", operation: "create", payload: order });
      clearCart();
      await refresh();
      return order;
    },
    [activeScPwdDiscount, cart, clearCart, customerId, discount, heldOrders.length, refresh, remarks, scPwdDraft]
  );

  const resumeHeldOrder = useCallback(
    async (order: HeldOrder) => {
      setCart(order.items);
      setCustomerId(order.customerId);
      setDiscount(order.discount);
      setRemarks(order.remarks || "");
      setActiveScPwdDiscount(order.scPwdDiscountActive ?? false);
      setScPwdDraft(order.scPwdDraft ?? null);
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

  const applyScPwdDiscount = useCallback(
    (details: ScPwdCustomerDetails) => {
      setScPwdDraft(details);
      setActiveScPwdDiscount(true);
      setDiscount(0); // prevent double discount
      recordEvent({ type: "scpwd_applied", details: { discountType: details.discountType, idNumber: details.idNumber } });
    },
    [recordEvent]
  );

  const removeScPwdDiscount = useCallback(
    (overrideBy?: string, overrideReason?: string) => {
      setScPwdDraft((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          supervisorOverride: Boolean(overrideBy),
          overrideBy,
          overrideReason
        };
      });
      setActiveScPwdDiscount(false);
      recordEvent({ type: "scpwd_removed", details: { overrideBy, overrideReason } });
    },
    [recordEvent]
  );

  const validateScPwdEligibility = useCallback(
    (idNumber: string, scPwdSettings: ScPwdSettings): { valid: boolean; warning?: string } => {
      const today = new Date().toISOString().slice(0, 10);
      const sameDayUses = scPwdTransactionLog.filter(
        (row) => row.idNumber === idNumber && row.timestamp.startsWith(today)
      ).length;
      if (sameDayUses >= scPwdSettings.dailyAlertThreshold) {
        return { valid: true, warning: `ID ${idNumber} has been used ${sameDayUses} times today. Daily threshold exceeded.` };
      }
      if (sameDayUses >= scPwdSettings.duplicateIdThreshold) {
        return { valid: true, warning: `ID ${idNumber} used ${sameDayUses} times today.` };
      }
      return { valid: true };
    },
    [scPwdTransactionLog]
  );

  const getScPwdSummary = useCallback(
    (month?: string): ScPwdSummaryCard => {
      const targetMonth = month ?? new Date().toISOString().slice(0, 7);
      const monthRows = scPwdTransactionLog.filter((row) => row.timestamp.startsWith(targetMonth));
      const scRows = monthRows.filter((r) => r.discountType === "sc");
      const pwdRows = monthRows.filter((r) => r.discountType === "pwd");
      return {
        totalTransactions: monthRows.length,
        totalScTransactions: scRows.length,
        totalPwdTransactions: pwdRows.length,
        totalScDiscount: scRows.reduce((sum, r) => sum + r.scPwdDiscountAmount, 0),
        totalPwdDiscount: pwdRows.reduce((sum, r) => sum + r.scPwdDiscountAmount, 0),
        totalVatRemoved: monthRows.reduce((sum, r) => sum + r.vatRemoved, 0),
        totalDeductibles: monthRows.reduce((sum, r) => sum + r.scPwdDiscountAmount + r.vatRemoved, 0),
        month: targetMonth
      };
    },
    [scPwdTransactionLog]
  );

  const acknowledgeScPwdAlert = useCallback(
    (id: string) => {
      setScPwdAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
    },
    []
  );

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
    setScPwdTransactionLog([]);
    setScPwdAlerts([]);
    setPrintFailure(null);
    await refresh();
  }, [clearCart, refresh]);

  const login = useCallback(
    async (username: string, password: string) => {
      const result = await loginLocal(username, password);
      if (result.auth && result.user) {
        setCurrentUser(result.user);
        return true;
      }
      return false;
    },
    []
  );

  const clearPrintFailure = useCallback(() => {
    setPrintFailure(null);
  }, []);

  const switchUser = useCallback(
    (username: string) => {
      const user = users.find((candidate) => candidate.username === username);
      if (user) setCurrentUser(user);
      return Boolean(user);
    },
    [users]
  );

  const saveRxPrescriptionDraft = useCallback((draft: PrescriptionDraft) => {
    setRxPrescriptionDrafts((current) => {
      const found = current.find((item) => item.id === draft.id);
      if (!found) return [draft, ...current];
      return current.map((item) => (item.id === draft.id ? draft : item));
    });
    putOne("prescriptions", draft);
  }, []);

  const logRxRefusal = useCallback((refusal: PrescriptionRefusal) => {
    setRxRefusals((current) => [refusal, ...current]);
    putOne("auditLog", {
      id: refusal.id,
      action: "settings-change",
      user: refusal.pharmacistName,
      timestamp: refusal.createdAt,
      details: `Refused ${refusal.productName} for ${refusal.patientName}: ${refusal.reason}`,
      requiredRole: "supervisor",
    });
  }, []);

  const addRxRedFlag = useCallback((flag: RxRedFlag) => {
    setRxRedFlags((current) => [flag, ...current]);
    putOne("auditLog", {
      id: crypto.randomUUID(),
      action: "settings-change",
      user: "system",
      timestamp: flag.createdAt,
      details: `Red flag raised: ${flag.title} - ${flag.reason}`,
      requiredRole: "supervisor",
    });
  }, []);

  const clearRxRedFlag = useCallback((id: string) => {
    setRxRedFlags((current) => current.filter((flag) => flag.id !== id));
  }, []);

  const getRxInspectionSnapshot = useCallback((): RxInspectionSnapshot => {
    const today = new Date().toISOString().slice(0, 10);
    const prescriptionToday = rxPrescriptionDrafts.filter((item) => item.createdAt.startsWith(today));
    const ddEddToday = prescriptionToday.filter(
      (item) => item.classAtDispense === "DD, Rx" || item.classAtDispense === "EDD, Rx"
    );
    const openPartial = rxPrescriptionDrafts.filter((item) => item.status === "PARTIAL - OPEN");
    const redFlagsToday = rxRedFlags.filter((item) => item.createdAt.startsWith(today));
    return {
      totalRxTransactionsToday: prescriptionToday.length,
      totalDdEddTransactionsToday: ddEddToday.length,
      openPartialFills: openPartial.length,
      redFlagsToday: redFlagsToday.length,
      ddBalanceAlerts: redFlagsToday.filter((item) => item.title.toLowerCase().includes("balance")).length
    };
  }, [rxPrescriptionDrafts, rxRedFlags]);

  const updateRxSettings = useCallback((next: RxSettings) => {
    setRxSettings(next);
  }, []);

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
    remarks,
    customerId,
    currentUser,
    forcedOffline,
    online,
    totals,
    lastReceipt,
    printFailure,
    clearPrintFailure,
    syncing,
    featureFlags,
    setDiscount,
    setRemarks,
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
    switchUser,
    rxPharmacists,
    setRxPharmacists,
    rxPrescriptionDrafts,
    rxRedFlags,
    rxRefusals,
    rxSettings,
    saveRxPrescriptionDraft,
    logRxRefusal,
    addRxRedFlag,
    clearRxRedFlag,
    getRxInspectionSnapshot,
    updateRxSettings,
    observabilitySnapshot,
    sloTargets: defaultSloTargets,
    activeAlerts,
    scPwdDraft,
    activeScPwdDiscount,
    scPwdTransactionLog,
    scPwdAlerts,
    applyScPwdDiscount,
    removeScPwdDiscount,
    validateScPwdEligibility,
    getScPwdSummary,
    acknowledgeScPwdAlert
  };
}
