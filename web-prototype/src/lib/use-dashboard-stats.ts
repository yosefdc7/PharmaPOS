import { useMemo } from "react";
import type { Category, Product, Settings, SyncQueueItem, Transaction, User, PrescriptionDraft, RxInspectionSnapshot, RxRedFlag } from "@/lib/types";

type PaymentSplit = {
  cash: number;
  eWallet: number;
  cardOrExternalTerminal: number;
};

type VatBreakdown = {
  vatable: number;
  nonVatable: number;
};

type InventoryExpiryBuckets = {
  within30: number;
  within60: number;
  within90: number;
};

type InventoryRiskItem = {
  id: string;
  name: string;
  quantity: number;
  metric: number;
};

type SalesTrendPoint = {
  dateKey: string;
  label: string;
  gross: number;
  net: number;
};

type CategoryMixPoint = {
  categoryId: string;
  categoryName: string;
  amount: number;
  share: number;
};

export type DashboardStats = {
  finance: {
    netSalesToday: number;
    grossSalesToday: number;
    salesTodayVsLastWeek: number;
    paymentSplit: PaymentSplit;
    vatBreakdown: VatBreakdown;
    profitMarginPercent: number | null;
  };
  compliance: {
    rxTransactionsToday: number;
    ddTransactionsToday: number;
    missingRxLogAlerts: number;
    incompletePrescriptionAlerts: number;
    zReadingPreviousBusinessDayStatus: string;
  };
  inventory: {
    expiryBuckets: InventoryExpiryBuckets;
    lowStockHighRevenue: InventoryRiskItem[];
    deadStock90Days: InventoryRiskItem[];
  };
  trends: {
    salesTrend: SalesTrendPoint[];
    categoryMix: CategoryMixPoint[];
  };
  meta: {
    usersCount: number;
    pendingSyncCount: number;
  };
};

export type DashboardStatsInput = {
  transactions: Transaction[];
  products: Product[];
  settings: Settings | null;
  users: User[];
  syncQueue: SyncQueueItem[];
  categories?: Category[];
  rxPrescriptionDrafts?: PrescriptionDraft[];
  rxRedFlags?: RxRedFlag[];
  rxInspectionSnapshot?: RxInspectionSnapshot;
};

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseExpiryDate(value: string): Date | null {
  if (!value || value === "N/A") return null;
  if (value.includes("-")) {
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (value.includes("/")) {
    const [mm, dd, yyyy] = value.split("/");
    const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function isPaidSale(transaction: Transaction): boolean {
  return transaction.paymentStatus !== "refunded";
}

function classifyPayment(transaction: Transaction): keyof PaymentSplit {
  if (transaction.paymentMethod === "cash") return "cash";

  const reference = (transaction.paymentReference || "").toLowerCase();
  if (
    reference.includes("wallet") ||
    reference.includes("e-wallet") ||
    reference.includes("gcash") ||
    reference.includes("maya")
  ) {
    return "eWallet";
  }

  return "cardOrExternalTerminal";
}

function previousBusinessDay(now: Date): Date {
  const candidate = new Date(now);
  candidate.setDate(candidate.getDate() - 1);
  while (candidate.getDay() === 0 || candidate.getDay() === 6) {
    candidate.setDate(candidate.getDate() - 1);
  }
  return candidate;
}

export function computeDashboardStats(input: DashboardStatsInput, now = new Date()): DashboardStats {
  const transactions = input.transactions || [];
  const products = input.products || [];
  const productById = new Map(products.map((product) => [product.id, product]));

  const todayKey = dateKey(now);
  const lastWeek = new Date(now);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastWeekKey = dateKey(lastWeek);

  const paidTransactions = transactions.filter(isPaidSale);
  const todayTransactions = paidTransactions.filter((transaction) => transaction.createdAt.startsWith(todayKey));
  const sameDayLastWeekTransactions = paidTransactions.filter((transaction) =>
    transaction.createdAt.startsWith(lastWeekKey)
  );

  const netSalesToday = money(todayTransactions.reduce((sum, transaction) => sum + transaction.total, 0));
  const grossSalesToday = money(todayTransactions.reduce((sum, transaction) => sum + transaction.subtotal, 0));
  const sameDayLastWeekSales = money(
    sameDayLastWeekTransactions.reduce((sum, transaction) => sum + transaction.total, 0)
  );
  const salesTodayVsLastWeek = money(netSalesToday - sameDayLastWeekSales);

  const paymentSplit: PaymentSplit = todayTransactions.reduce(
    (split, transaction) => {
      const key = classifyPayment(transaction);
      split[key] = money(split[key] + transaction.total);
      return split;
    },
    { cash: 0, eWallet: 0, cardOrExternalTerminal: 0 }
  );

  const vatBreakdown: VatBreakdown = todayTransactions.reduce(
    (acc, transaction) => {
      const itemsTotal = transaction.items.reduce((sum, item) => sum + item.lineTotal, 0);
      const allocationBase = itemsTotal > 0 ? itemsTotal : transaction.total;

      transaction.items.forEach((item) => {
        const product = productById.get(item.productId);
        const share = allocationBase > 0 ? item.lineTotal / allocationBase : 0;
        const allocatedAmount = money(transaction.total * share);
        if (product?.vatExempt) {
          acc.nonVatable = money(acc.nonVatable + allocatedAmount);
        } else {
          acc.vatable = money(acc.vatable + allocatedAmount);
        }
      });

      return acc;
    },
    { vatable: 0, nonVatable: 0 }
  );

  let hasUnknownCost = false;
  const todayCost = money(
    todayTransactions.reduce((sum, transaction) => {
      return (
        sum +
        transaction.items.reduce((lineSum, item) => {
          const product = productById.get(item.productId);
          if (typeof product?.cost !== "number") {
            hasUnknownCost = true;
            return lineSum;
          }

          return lineSum + product.cost * item.quantity;
        }, 0)
      );
    }, 0)
  );

  const profitMarginPercent =
    netSalesToday > 0 && !hasUnknownCost ? money(((netSalesToday - todayCost) / netSalesToday) * 100) : null;

  const inspection = input.rxInspectionSnapshot;
  const rxTransactionsToday =
    inspection?.totalRxTransactionsToday ??
    (input.rxPrescriptionDrafts || []).filter((draft) => draft.createdAt.startsWith(todayKey)).length;
  const ddTransactionsToday =
    inspection?.totalDdEddTransactionsToday ??
    (input.rxPrescriptionDrafts || []).filter(
      (draft) =>
        draft.createdAt.startsWith(todayKey) &&
        (draft.classAtDispense === "DD, Rx" || draft.classAtDispense === "EDD, Rx")
    ).length;

  const missingRxLogAlerts = (input.rxPrescriptionDrafts || []).filter((draft) => {
    if (!(draft.classAtDispense === "DD, Rx" || draft.classAtDispense === "EDD, Rx" || draft.classAtDispense === "Rx")) {
      return false;
    }

    if (!draft.prescriberName || !draft.prescriberPrcLicense || !draft.dispensingPharmacistName) {
      return true;
    }

    if (draft.classAtDispense === "DD, Rx" && !draft.yellowRxReference) {
      return true;
    }

    if (
      (draft.classAtDispense === "DD, Rx" || draft.classAtDispense === "EDD, Rx") &&
      !draft.prescriberS2Number
    ) {
      return true;
    }

    return false;
  }).length;

  const incompletePrescriptionAlerts = (input.rxPrescriptionDrafts || []).filter(
    (draft) => draft.status === "DRAFT" || draft.status === "PARTIAL - OPEN"
  ).length;

  const previousDay = previousBusinessDay(now);
  const previousBusinessDayKey = dateKey(previousDay);
  const hasTransactionsPreviousBusinessDay = paidTransactions.some((transaction) =>
    transaction.createdAt.startsWith(previousBusinessDayKey)
  );
  const zReadingPreviousBusinessDayStatus = hasTransactionsPreviousBusinessDay
    ? `N/A (no local Z-reading record for ${previousBusinessDayKey})`
    : `N/A (no transactions on ${previousBusinessDayKey})`;

  const nowMidnight = new Date(now);
  nowMidnight.setHours(0, 0, 0, 0);

  const expiryBuckets = products.reduce(
    (acc, product) => {
      if (!product.tracksStock || product.quantity <= 0) return acc;
      const expiry = parseExpiryDate(product.expirationDate);
      if (!expiry) return acc;

      const daysToExpiry = Math.floor((expiry.getTime() - nowMidnight.getTime()) / 86400000);
      if (daysToExpiry < 0) return acc;
      if (daysToExpiry <= 30) {
        acc.within30 += 1;
      } else if (daysToExpiry <= 60) {
        acc.within60 += 1;
      } else if (daysToExpiry <= 90) {
        acc.within90 += 1;
      }
      return acc;
    },
    { within30: 0, within60: 0, within90: 0 }
  );

  const last30 = new Date(now);
  last30.setDate(last30.getDate() - 30);
  const last90 = new Date(now);
  last90.setDate(last90.getDate() - 90);

  const revenueByProduct = new Map<string, number>();
  const quantityByProduct = new Map<string, number>();

  paidTransactions.forEach((transaction) => {
    const txDate = new Date(transaction.createdAt);
    if (Number.isNaN(txDate.getTime()) || txDate < last90) return;

    transaction.items.forEach((item) => {
      if (txDate >= last30) {
        revenueByProduct.set(item.productId, money((revenueByProduct.get(item.productId) || 0) + item.lineTotal));
        quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) || 0) + item.quantity);
      }
    });
  });

  const lowStockHighRevenue = products
    .filter((product) => product.tracksStock && product.quantity <= product.minStock)
    .filter((product) => (revenueByProduct.get(product.id) || 0) > 0 || (quantityByProduct.get(product.id) || 0) >= 5)
    .map((product) => ({
      id: product.id,
      name: product.name,
      quantity: product.quantity,
      metric: money(revenueByProduct.get(product.id) || 0)
    }))
    .sort((left, right) => right.metric - left.metric)
    .slice(0, 8);

  const movedIn90Days = new Set<string>();
  paidTransactions.forEach((transaction) => {
    const txDate = new Date(transaction.createdAt);
    if (Number.isNaN(txDate.getTime()) || txDate < last90) return;
    transaction.items.forEach((item) => movedIn90Days.add(item.productId));
  });

  const deadStock90Days = products
    .filter((product) => product.tracksStock && product.quantity > 0)
    .filter((product) => !movedIn90Days.has(product.id))
    .map((product) => ({
      id: product.id,
      name: product.name,
      quantity: product.quantity,
      metric: product.quantity
    }))
    .slice(0, 8);

  const salesTrend: SalesTrendPoint[] = Array.from({ length: 7 }, (_, index) => {
    const pointDate = new Date(now);
    pointDate.setDate(pointDate.getDate() - (6 - index));
    const key = dateKey(pointDate);
    const dayTransactions = paidTransactions.filter((transaction) => transaction.createdAt.startsWith(key));
    return {
      dateKey: key,
      label: key.slice(5),
      gross: money(dayTransactions.reduce((sum, transaction) => sum + transaction.subtotal, 0)),
      net: money(dayTransactions.reduce((sum, transaction) => sum + transaction.total, 0))
    };
  });

  const categoryNameById = new Map((input.categories || []).map((category) => [category.id, category.name]));
  const categoryTotals = new Map<string, number>();
  const todayRevenueTotal = todayTransactions.reduce((sum, transaction) => sum + transaction.total, 0);

  todayTransactions.forEach((transaction) => {
    const itemsTotal = transaction.items.reduce((sum, item) => sum + item.lineTotal, 0);
    const allocationBase = itemsTotal > 0 ? itemsTotal : transaction.total;

    transaction.items.forEach((item) => {
      const product = productById.get(item.productId);
      const categoryId = product?.categoryId || "uncategorized";
      const share = allocationBase > 0 ? item.lineTotal / allocationBase : 0;
      const allocatedAmount = money(transaction.total * share);
      categoryTotals.set(categoryId, money((categoryTotals.get(categoryId) || 0) + allocatedAmount));
    });
  });

  const categoryMix: CategoryMixPoint[] = Array.from(categoryTotals.entries())
    .map(([categoryId, amount]) => ({
      categoryId,
      categoryName: categoryNameById.get(categoryId) || "Uncategorized",
      amount,
      share: todayRevenueTotal > 0 ? money((amount / todayRevenueTotal) * 100) : 0
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 6);

  return {
    finance: {
      netSalesToday,
      grossSalesToday,
      salesTodayVsLastWeek,
      paymentSplit,
      vatBreakdown,
      profitMarginPercent
    },
    compliance: {
      rxTransactionsToday,
      ddTransactionsToday,
      missingRxLogAlerts,
      incompletePrescriptionAlerts,
      zReadingPreviousBusinessDayStatus
    },
    inventory: {
      expiryBuckets,
      lowStockHighRevenue,
      deadStock90Days
    },
    trends: {
      salesTrend,
      categoryMix
    },
    meta: {
      usersCount: input.users.length,
      pendingSyncCount: input.syncQueue.filter((item) => item.status === "pending").length
    }
  };
}

export function useDashboardStats(input: DashboardStatsInput): DashboardStats {
  return useMemo(
    () =>
      computeDashboardStats({
        transactions: input.transactions,
        products: input.products,
        settings: input.settings,
        users: input.users,
        syncQueue: input.syncQueue,
        categories: input.categories,
        rxPrescriptionDrafts: input.rxPrescriptionDrafts,
        rxRedFlags: input.rxRedFlags,
        rxInspectionSnapshot: input.rxInspectionSnapshot
      }),
    [
      input.transactions,
      input.products,
      input.settings,
      input.users,
      input.syncQueue,
      input.categories,
      input.rxPrescriptionDrafts,
      input.rxRedFlags,
      input.rxInspectionSnapshot
    ]
  );
}
