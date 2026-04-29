"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { isLowStock, isExpired, isNearExpiry, daysUntilExpiry, money } from "@/lib/calculations";
import { resolveAccessibleView, usePosStore } from "@/lib/use-pos-store";
import { buildUserPermissions } from "@/lib/use-permissions";
import type { AppViewKey, BirSettings, Category, Customer, PaymentMethod, Product, Settings, User, UserRole } from "@/lib/types";
import { BirSettingsPanel } from "./bir-settings";
import { PrinterSettingsPanel } from "./printer-settings";
import { BirReportsPanel } from "./bir-reports";
import { AuditTrailPanel } from "./audit-trail";
import { PrinterStatusIndicator } from "./printer-status";
import { ReprintQueue } from "./reprint-queue";
import { PrintFailureModal } from "./print-failure-modal";
import { ReceiptPreview } from "./receipt-preview";
import { buildReceipt, createPrinterBackend, enqueuePrintJob, getReceiptLayoutOptions, markJobStatus, PrinterService, removeJob } from "@/lib/printer";
import { getOne, exportAllData, importAllData } from "@/lib/db";
import { ScpwdDiscountModal } from "./scpwd-discount-modal";
import { ScpwdBreakdownCard } from "./scpwd-breakdown-card";
import { ScpwdEligibilityWarning } from "./scpwd-eligibility-warning";
import { ScpwdTransactionLog } from "./scpwd-transaction-log";
import { ScpwdSummaryCardComponent } from "./scpwd-summary-card";
import { PrescriptionSettingsPanel } from "./prescription-settings-panel";
import { RxWorkspace } from "./rx-workspace";
import { ControlTowerView } from "./control-tower";

type ProductSortKey = "recent" | "newest" | "oldest" | "top-sold";
type InventorySortKey = "title" | "price" | "quantity" | "category" | "expiry";
type InventorySortDirection = "asc" | "desc";
type CustomerSortKey = "newest" | "alphabetical";

const inventorySortCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const views: { key: AppViewKey; label: string }[] = [
  { key: "pos", label: "POS" },
  { key: "products", label: "Products" },
  { key: "customers", label: "Customers" },
  { key: "rx", label: "RX Workspace" },
  { key: "control-tower", label: "Control Tower" },
  { key: "settings", label: "Settings" },
  { key: "reports", label: "Reports" },
  { key: "sync", label: "Sync Online" }
];

function getDrugClassBadge(drugClass: Product["drugClassification"]) {
  if (drugClass === "DD, Rx") return { label: "DD", className: "drug-dd" };
  if (drugClass === "EDD, Rx") return { label: "EDD", className: "drug-edd" };
  if (drugClass === "Rx") return { label: "Rx", className: "drug-rx" };
  if (drugClass === "Pharmacist-Only OTC") return { label: "P-OTC", className: "drug-potc" };
  return { label: "OTC", className: "drug-otc" };
}

function formatCurrency(symbol: string, value: number) {
  return `${symbol}${money(value).toFixed(2)}`;
}

function sanitizeString(value: string): string {
  return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").trim();
}

function readForm(form: HTMLFormElement) {
  const raw = Object.fromEntries(new FormData(form).entries());
  const sanitized: Record<string, string | File> = {};
  for (const [key, value] of Object.entries(raw)) {
    sanitized[key] = typeof value === "string" ? sanitizeString(value) : value;
  }
  return sanitized as Record<string, string>;
}

function buildProductDraft(overrides?: Partial<Product>): Product {
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  const mm = String(oneYearFromNow.getMonth() + 1).padStart(2, "0");
  const dd = String(oneYearFromNow.getDate()).padStart(2, "0");
  const yyyy = oneYearFromNow.getFullYear();
  const defaultExpiry = `${mm}/${dd}/${yyyy}`;

  return {
    id: overrides?.id || crypto.randomUUID(),
    version: overrides?.version ?? 1,
    name: overrides?.name || "",
    barcode: overrides?.barcode || String(Date.now()).slice(-6),
    categoryId: overrides?.categoryId || "",
    supplier: overrides?.supplier || "",
    price: overrides?.price ?? 0,
    originalPrice: overrides?.originalPrice,
    cost: overrides?.cost,
    quantity: overrides?.quantity ?? 0,
    minStock: overrides?.minStock ?? 0,
    tracksStock: overrides?.tracksStock ?? true,
    expirationDate: overrides?.expirationDate || defaultExpiry,
    imageColor: overrides?.imageColor || "#4379FF",
    featured: overrides?.featured ?? false,
    scPwdEligibility: overrides?.scPwdEligibility ?? "medicine",
    vatExempt: overrides?.vatExempt ?? false,
    isPrescription: overrides?.isPrescription ?? false,
    drugClassification: overrides?.drugClassification ?? "Non-Rx OTC",
    genericName: overrides?.genericName ?? "",
    brandName: overrides?.brandName ?? "",
    activeIngredient: overrides?.activeIngredient ?? "",
    dosageStrength: overrides?.dosageStrength ?? "",
    dosageForm: overrides?.dosageForm ?? "",
    fdaCprNumber: overrides?.fdaCprNumber ?? "",
    behindCounter: overrides?.behindCounter ?? false,
    ddLastReconciliationAt: overrides?.ddLastReconciliationAt
  };
}

export function PosPrototype() {
  const store = usePosStore();
  const [view, setView] = useState<AppViewKey>("pos");
  const [navOpen, setNavOpen] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [productSort, setProductSort] = useState<ProductSortKey>("recent");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentReceived, setPaymentReceived] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [holdReference, setHoldReference] = useState("");
  const [showReprintQueue, setShowReprintQueue] = useState(false);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [receiptVariant, setReceiptVariant] = useState<"normal" | "void" | "reprint">("normal");
  const [showScPwdModal, setShowScPwdModal] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const settings = store.settings;
  const symbol = settings?.currencySymbol || "$";
  const pendingSync = store.syncQueue.filter((item) => item.status === "pending").length;
  const activeView = store.currentUser ? resolveAccessibleView(view, store.currentUser) : view;
  const visibleViews = useMemo(
    () => views.filter((item) => store.availableViews.includes(item.key)),
    [store.availableViews]
  );

  useEffect(() => {
    if (!store.currentUser) return;
    const nextView = resolveAccessibleView(view, store.currentUser);
    if (nextView !== view) {
      setView(nextView);
    }
  }, [store.currentUser, view]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 760px)");
    if (mql.matches) {
      setNavOpen(false);
    }
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setNavOpen(false);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const filteredProducts = useMemo(() => {
    const text = query.trim().toLowerCase();
    const soldQuantities = store.transactions.reduce<Record<string, number>>((totals, transaction) => {
      transaction.items.forEach((item) => {
        totals[item.productId] = (totals[item.productId] || 0) + item.quantity;
      });
      return totals;
    }, {});

    const filtered = store.products.filter((product) => {
      const matchesCategory = categoryFilter === "all" || product.categoryId === categoryFilter;
      const matchesText =
        !text ||
        product.name.toLowerCase().includes(text) ||
        product.barcode.toLowerCase().includes(text) ||
        product.supplier.toLowerCase().includes(text);
      return matchesCategory && matchesText;
    });

    const barcodeValue = (product: Product) => Number(product.barcode) || 0;

    return [...filtered].sort((left, right) => {
      if (productSort === "newest") {
        return barcodeValue(right) - barcodeValue(left);
      }

      if (productSort === "oldest") {
        return barcodeValue(left) - barcodeValue(right);
      }

      if (productSort === "top-sold") {
        const salesDelta = (soldQuantities[right.id] || 0) - (soldQuantities[left.id] || 0);
        if (salesDelta !== 0) {
          return salesDelta;
        }
        return store.products.indexOf(left) - store.products.indexOf(right);
      }

      return store.products.indexOf(left) - store.products.indexOf(right);
    });
  }, [categoryFilter, productSort, query, store.products, store.transactions]);

  const dailySales = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return store.transactions.filter((transaction) => transaction.createdAt.startsWith(today));
  }, [store.transactions]);

  if (store.loadState === "booting") {
    return <main className="boot-screen">Loading local POS database...</main>;
  }

  if (store.loadState === "error") {
    return <main className="boot-screen error">Unable to start prototype: {store.error}</main>;
  }

  if (!settings || !store.currentUser) {
    return (
      <main className="boot-screen">
        <section className="login-card">
          <h1>PharmaPOS PH Web POS</h1>
          <p>Enter credentials to log in.</p>
          {store.storagePersistence !== "unknown" ? (
            <p>Storage protection: {store.storagePersistence}</p>
          ) : null}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setLoginError("");
              const fd = new FormData(e.currentTarget);
              const success = await store.login(String(fd.get("username") ?? ""), String(fd.get("password") ?? ""));
              if (!success) {
                setLoginError("Invalid username or password.");
              }
            }}
          >
            <input name="username" placeholder="Username" autoComplete="username" />
            <input name="password" type="password" placeholder="Password" autoComplete="current-password" />
            <button type="submit">Log in</button>
          </form>
          {loginError ? <p className="error-copy">{loginError}</p> : null}
        </section>
      </main>
    );
  }

  async function completeSale() {
    const paid = paymentMethod === "cash" ? Number(paymentReceived || store.totals.total) : store.totals.total;
    await store.completeSale({
      method: paymentMethod,
      paid,
      paymentStatus: "paid",
      reference: paymentReference
    });
    setPaymentReceived("");
    setPaymentReference("");
  }

  async function holdCurrentOrder() {
    if (!store.canPerformAction("transactions")) return;
    await store.holdOrder(holdReference);
    setHoldReference("");
  }

  function setViewAndMaybeCloseNav(nextView: AppViewKey) {
    if (!store.canAccessView(nextView)) {
      const fallback = resolveAccessibleView(nextView, store.currentUser);
      setView(fallback);
    } else {
      setView(nextView);
    }
    if (window.matchMedia("(max-width: 760px)").matches) {
      setNavOpen(false);
    }
  }

  return (
    <main className={`app-shell ${navOpen ? "nav-open" : "nav-closed"}`}>
      {navOpen && <div className="side-nav-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <aside className={`side-nav ${navOpen ? "open" : "closed"}`}>
        <div className="brand">
          <span className="brand-mark">+</span>
          <div>
            <strong>{settings.store}</strong>
            <small>Offline-first prototype</small>
          </div>
        </div>

        {/* User controls section - top */}
        <div className="side-nav-user-controls">
          <label className="side-nav-user-label">
            User
            <select
              value={store.currentUser?.username ?? ""}
              onChange={async (event) => {
                const targetUsername = event.currentTarget.value;
                if (targetUsername === store.currentUser?.username) return;

                // Prompt for password when switching to a different user
                // TODO: replace with a proper modal for production UX
                const password = typeof window !== "undefined" && typeof window.prompt === "function"
                  ? window.prompt(`Enter password for ${targetUsername}:`)
                  : null;

                const success = await store.switchUser(targetUsername, password ?? undefined);
                if (!success && typeof window !== "undefined" && typeof window.alert === "function") {
                  window.alert("Switch failed: incorrect password or insufficient privileges.");
                  // Revert select to current user
                  event.currentTarget.value = store.currentUser?.username ?? "";
                }
              }}
            >
              {store.users.map((user) => (
                <option key={user.id} value={user.username}>
                  {user.fullname}
                </option>
              ))}
            </select>
          </label>
          <button className={`side-nav-online-status ${store.online ? "online" : "offline"}`} onClick={() => store.setForcedOffline(!store.forcedOffline)}>
            {store.online ? "Online" : "Offline"}
          </button>
        </div>

        <nav>
          {visibleViews.map((item) => (
            <button
              key={item.key}
              className={activeView === item.key ? "active" : ""}
              onClick={() => setViewAndMaybeCloseNav(item.key)}
            >
              {item.label}
              {item.key === "sync" && pendingSync > 0 ? <span>{pendingSync}</span> : null}
            </button>
          ))}
        </nav>

        {/* Log out button - bottom */}
        <div className="side-nav-footer">
          <button type="button" className="side-nav-logout" onClick={store.logout}>
            Log out
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-main">
            <button
              type="button"
              className="nav-toggle"
              aria-label={navOpen ? "Collapse sidebar" : "Expand sidebar"}
              onClick={() => setNavOpen((current) => !current)}
            >
              {navOpen ? "<" : ">"}
            </button>
            <div>
              <h1>{views.find((item) => item.key === activeView)?.label}</h1>
              <p>{store.online ? "Online-ready" : "Offline mode"} with local IndexedDB runtime</p>
            </div>
          </div>
          <div className="topbar-actions">
            <PrinterStatusIndicator />
            <span className={`status ${store.storagePersistence === "granted" ? "online" : "offline"}`}>
              Storage {store.storagePersistence === "granted" ? "protected" : store.storagePersistence}
            </span>
          </div>
        </header>

        {activeView === "pos" ? (
          <>
            {cartOpen && <div className="cart-drawer-overlay" onClick={() => setCartOpen(false)} aria-hidden="true" />}
            <section className="pos-grid">
              <section className="product-workspace panel">
                <div className="toolbar">
                  <div className="toolbar-search">
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product, SKU, supplier" />
                    <button type="button" className="toolbar-filter-toggle" onClick={() => setFiltersOpen((f) => !f)} aria-label="Toggle filters">
                      &#9776;
                    </button>
                  </div>
                  <div className={`toolbar-filters ${filtersOpen ? "open" : ""}`}>
                    <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                      <option value="all">All categories</option>
                      {store.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <select value={productSort} onChange={(event) => setProductSort(event.target.value as ProductSortKey)}>
                      <option value="recent">Recent</option>
                      <option value="newest">Newest</option>
                      <option value="oldest">Oldest</option>
                      <option value="top-sold">Top sold</option>
                    </select>
                  </div>
                  <div className="toolbar-actions">
                    <button type="button" onClick={() => setShowReprintQueue(true)}>
                      Reprint Queue
                    </button>
                    <button type="button" onClick={() => { setReceiptVariant("normal"); setShowReceiptPreview(true); }}>
                      Preview OR
                    </button>
                  </div>
                </div>
                <div className="product-grid">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      className={`product-card ${isLowStock(product) ? "low" : ""}`}
                      onClick={() => store.addToCart(product)}
                    >
                      <span className="product-image" style={{ background: product.imageColor }}>
                        {product.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="product-body">
                        <strong className="product-name">{product.name}</strong>
                        <div className="product-meta-row">
                          <div className="product-meta-left">
                            <span className={`badge ${getDrugClassBadge(product.drugClassification).className}`}>
                              {getDrugClassBadge(product.drugClassification).label}
                            </span>
                            <span className="product-sku">SKU {product.barcode}</span>
                            <span className="product-stock">{product.tracksStock ? `${product.quantity} in stock` : "Service"}</span>
                          </div>
                          <span className="product-price">{formatCurrency(symbol, product.price)}</span>
                        </div>
                      </div>
                      <span className="product-chevron">›</span>
                    </button>
                  ))}
                </div>
              </section>

              <aside className={`cart-panel panel${cartOpen ? " open" : ""}`}>
                <div
                  className="cart-drawer-handle"
                  onClick={() => setCartOpen((prev) => !prev)}
                  role="button"
                  tabIndex={0}
                  aria-label={cartOpen ? "Minimize cart" : "Open cart"}
                  aria-expanded={cartOpen}
                >
                  <span className="cart-drawer-grip" />
                  <div className="cart-drawer-peek">
                    <strong>Cart</strong>
                    <span>{store.totals.itemCount} items</span>
                    <strong>{formatCurrency(symbol, store.totals.total)}</strong>
                  </div>
                </div>
                <div className="cart-head">
                  <h2>Current Sale</h2>
                  <button onClick={store.clearCart}>Clear</button>
                </div>
                <label>
                  Customer
                  <select value={store.customerId} onChange={(event) => store.setCustomerId(event.target.value)}>
                    {store.customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="cart-lines">
                  {store.cart.length === 0 ? <p className="empty">No items yet.</p> : null}
                  {store.cart.map((item) => (
                    <div className="cart-line" key={item.productId}>
                      <strong>{item.productName}</strong>
                      <div className="qty-controls">
                        <button onClick={() => store.updateCartQuantity(item.productId, item.quantity - 1)}>-</button>
                        <input
                          value={item.quantity}
                          onChange={(event) => store.updateCartQuantity(item.productId, Number(event.target.value))}
                        />
                        <button onClick={() => store.updateCartQuantity(item.productId, item.quantity + 1)}>+</button>
                      </div>
                      <span>{formatCurrency(symbol, item.price * item.quantity)}</span>
                      <button onClick={() => store.removeFromCart(item.productId)}>x</button>
                    </div>
                  ))}
                </div>

                {settings.scPwdSettings?.enabled && store.cart.length > 0 && (
                  <div className="scpwd-cart-actions">
                    <button
                      type="button"
                      className={store.activeScPwdDiscount ? "active" : ""}
                      onClick={() => setShowScPwdModal(true)}
                    >
                      {store.activeScPwdDiscount ? "SC/PWD Active \u2014 Edit" : "Apply SC/PWD Discount"}
                    </button>
                  </div>
                )}

                {store.activeScPwdDiscount && settings.scPwdSettings && (
                  <>
                    <ScpwdBreakdownCard
                      cart={store.cart}
                      products={store.products}
                      settings={settings}
                      scPwdSettings={settings.scPwdSettings}
                      symbol={symbol}
                    />
                    <ScpwdEligibilityWarning cartItems={store.cart} products={store.products} />
                  </>
                )}

                <div className="totals">
                  <span>Items</span>
                  <strong>{store.totals.itemCount}</strong>
                  <span>Subtotal</span>
                  <strong>{formatCurrency(symbol, store.totals.subtotal)}</strong>
                  <span>% Discount</span>
                  <input
                    value={store.discount}
                    type="number"
                    min="0"
                    disabled={store.activeScPwdDiscount}
                    title={store.activeScPwdDiscount ? "Manual discount disabled while SC/PWD discount is active" : ""}
                    onChange={(event) => store.setDiscount(Number(event.target.value))}
                  />
                  <span>VAT</span>
                  <strong>{formatCurrency(symbol, store.totals.tax)}</strong>
                  <span>Total</span>
                  <strong className="grand">{formatCurrency(symbol, store.totals.total)}</strong>
                  <span>Remarks</span>
                  <input value={store.remarks} onChange={(event) => store.setRemarks(event.target.value)} placeholder="Order notes..." />
                </div>
                <div className="payment-box">
                  <div className="segmented">
                    <button className={paymentMethod === "cash" ? "active" : ""} onClick={() => setPaymentMethod("cash")}>
                      Cash
                    </button>
                    <button
                      className={paymentMethod === "external-terminal" ? "active" : ""}
                      onClick={() => setPaymentMethod("external-terminal")}
                    >
                      External terminal
                    </button>
                  </div>
                  {paymentMethod === "cash" ? (
                    <input
                      type="number"
                      value={paymentReceived}
                      onChange={(event) => setPaymentReceived(event.target.value)}
                      placeholder="Cash received"
                    />
                  ) : (
                    <input
                      value={paymentReference}
                      onChange={(event) => setPaymentReference(event.target.value)}
                      placeholder="Terminal reference"
                    />
                  )}
                  <button className="primary" disabled={store.cart.length === 0} onClick={completeSale}>
                    Complete sale
                  </button>
                </div>
                <div className="hold-box">
                  <input value={holdReference} onChange={(event) => setHoldReference(event.target.value)} placeholder="Hold reference" />
                  <button disabled={store.cart.length === 0} onClick={holdCurrentOrder}>
                    Hold order
                  </button>
                </div>
                {store.heldOrders.length > 0 ? (
                  <div className="held-list">
                    <h3>Held orders</h3>
                    {store.heldOrders.map((order) => (
                      <button
                        key={order.id}
                        disabled={!store.canPerformAction("transactions")}
                        onClick={() => {
                          if (!store.canPerformAction("transactions")) return;
                          store.resumeHeldOrder(order);
                        }}
                      >
                        {order.reference} - {order.items.length} lines
                      </button>
                    ))}
                  </div>
                ) : null}
              </aside>
            </section>
            <button
              className="cart-fab"
              onClick={() => setCartOpen(true)}
              aria-label={`Open cart, ${store.totals.itemCount} items`}
            >
              Cart
              {store.totals.itemCount > 0 && <span className="cart-fab-badge">{store.totals.itemCount}</span>}
            </button>
          </>
        ) : null}

        {activeView === "products" ? (
          <ProductsView products={store.products} categories={store.categories} symbol={symbol} save={store.saveEntity} remove={store.removeEntity} canPerformAction={store.canPerformAction} alertDays={settings?.expiryAlertDays ?? 30} />
        ) : null}
        {activeView === "customers" ? <CustomersView customers={store.customers} save={store.saveEntity} remove={store.removeEntity} canPerformAction={store.canPerformAction} /> : null}
        {activeView === "rx" ? (
          <RxWorkspace
            products={store.products}
            cart={store.cart}
            customers={store.customers}
            pharmacists={store.rxPharmacists ?? []}
            prescriptionDrafts={store.rxPrescriptionDrafts ?? []}
            redFlags={store.rxRedFlags ?? []}
            refusals={store.rxRefusals ?? []}
            inspection={store.getRxInspectionSnapshot ? store.getRxInspectionSnapshot() : { totalRxTransactionsToday: 0, totalDdEddTransactionsToday: 0, openPartialFills: 0, redFlagsToday: 0, ddBalanceAlerts: 0 }}
            settings={store.rxSettings ?? { ddEddLowStockThreshold: 10, profileRetentionYears: 10, hardBlockPrototypeReset: true }}
            onSavePrescription={(draft) => store.saveRxPrescriptionDraft?.(draft)}
            onLogRefusal={(refusal) => store.logRxRefusal?.(refusal)}
            onClearFlag={(id) => store.clearRxRedFlag?.(id)}
          />
        ) : null}
        {activeView === "settings" ? (
          <SettingsView
            settings={settings}
            categories={store.categories}
            users={store.users}
            save={store.saveEntity}
            saveUserAccount={store.saveUserAccount}
            remove={store.removeEntity}
            reset={store.resetData}
            canPerformAction={store.canPerformAction}
            rxSettings={store.rxSettings ?? { ddEddLowStockThreshold: 10, profileRetentionYears: 10, hardBlockPrototypeReset: true }}
            updateRxSettings={(next) => store.updateRxSettings?.(next)}
          />
        ) : null}
        {activeView === "control-tower" ? (
          <ControlTowerView
            transactions={store.transactions}
            products={store.products}
            settings={store.settings}
            users={store.users}
            syncQueue={store.syncQueue}
            categories={store.categories}
            rxPrescriptionDrafts={store.rxPrescriptionDrafts ?? []}
            rxRedFlags={store.rxRedFlags ?? []}
            rxInspectionSnapshot={store.getRxInspectionSnapshot?.()}
          />
        ) : null}
        {activeView === "reports" ? (
          <ReportsView
            transactions={store.transactions}
            products={store.products}
            customers={store.customers}
            categories={store.categories}
            symbol={symbol}
            dailySales={dailySales}
            alertDays={settings?.expiryAlertDays ?? 30}
            scPwdTransactionLog={store.scPwdTransactionLog}
            getScPwdSummary={store.getScPwdSummary}
            scPwdAlerts={store.scPwdAlerts}
            canPerformAction={store.canPerformAction}
            users={store.users}
            currentUser={store.currentUser}
            acknowledgeOverride={store.acknowledgeOverride}
          />
        ) : null}
        {activeView === "sync" ? (
          <SyncView
            online={store.online}
            queue={store.syncQueue}
            syncing={store.syncing}
            syncNow={store.syncNow}
            snapshot={store.observabilitySnapshot}
            alerts={store.activeAlerts}
            sloTargets={store.sloTargets}
            syncStrategy={store.syncStrategy}
            setSyncStrategy={store.setSyncStrategy}
            lastSyncReport={store.lastSyncReport}
            conflictItems={store.conflictItems}
            resolveConflict={store.resolveConflict}
          />
        ) : null}
      </section>

      {showReprintQueue ? (
        <div className="override-modal-backdrop" onClick={() => setShowReprintQueue(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, width: "90vw" }}>
            <ReprintQueue onClose={() => setShowReprintQueue(false)} />
          </div>
        </div>
      ) : null}

      {store.printFailure ? (
        <PrintFailureModal
          onClose={() => store.clearPrintFailure()}
          onRetry={async () => {
            const failure = store.printFailure;
            if (!failure) return;
            const { transaction, printer, queueJobId } = failure;
            if (!printer || !transaction) return;
            const service = new PrinterService(createPrinterBackend);
            const connectResult = await service.connect(printer);
            const bir = (await getOne("birSettings", "bir")) as BirSettings | undefined;
            const commands = buildReceipt("normal", printer, bir, transaction, getReceiptLayoutOptions(printer));
            if (connectResult.status === "success") {
              const printResult = await service.print(commands);
              await service.disconnect();
              if (printResult.status === "success") {
                if (queueJobId) {
                  await removeJob(queueJobId);
                }
                store.clearPrintFailure();
              } else {
                if (queueJobId) {
                  await markJobStatus(queueJobId, "failed", printResult.status);
                } else {
                  await enqueuePrintJob(Number(transaction.localNumber), transaction.id, "normal", commands, printer.id);
                }
              }
            } else {
              if (queueJobId) {
                await markJobStatus(queueJobId, "failed", `Connection: ${connectResult.status}`);
              } else {
                await enqueuePrintJob(Number(transaction.localNumber), transaction.id, "normal", commands, printer.id);
              }
            }
          }}
          onSkip={() => {
            // Digital receipt is already shown via lastReceipt drawer
            store.clearPrintFailure();
          }}
        />
      ) : null}

      {showScPwdModal && settings.scPwdSettings ? (
        <ScpwdDiscountModal
          onApply={(details) => {
            const validation = store.validateScPwdEligibility(details.idNumber, settings.scPwdSettings!);
            store.applyScPwdDiscount(details);
            if (validation.warning) {
              alert(validation.warning);
            }
            setShowScPwdModal(false);
          }}
          onCancel={() => setShowScPwdModal(false)}
          onRemove={(overrideBy, overrideReason) => {
            store.removeScPwdDiscount(overrideBy, overrideReason);
            setShowScPwdModal(false);
          }}
          activeDiscount={store.activeScPwdDiscount}
          initialDraft={store.scPwdDraft}
        />
      ) : null}

      {showReceiptPreview ? (
        <div className="override-modal-backdrop" onClick={() => setShowReceiptPreview(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", padding: 20 }}>
            <div>
              <h3 style={{ textAlign: "center", marginBottom: 8, color: "#fff" }}>Normal Receipt</h3>
              <ReceiptPreview variant="normal" onClose={() => setShowReceiptPreview(false)} transaction={store.lastReceipt ?? undefined} />
            </div>
            <div>
              <h3 style={{ textAlign: "center", marginBottom: 8, color: "#fff" }}>Void Receipt</h3>
              <ReceiptPreview variant="void" onClose={() => setShowReceiptPreview(false)} transaction={store.lastReceipt ?? undefined} />
            </div>
            <div>
              <h3 style={{ textAlign: "center", marginBottom: 8, color: "#fff" }}>Reprint</h3>
              <ReceiptPreview variant="reprint" onClose={() => setShowReceiptPreview(false)} transaction={store.lastReceipt ?? undefined} />
            </div>
          </div>
        </div>
      ) : null}

      {store.lastReceipt ? (
        <section className="receipt-drawer">
          <div className="receipt">
            <button className="close" onClick={() => store.setLastReceipt(null)}>
              Close
            </button>
            <h2>{settings.store}</h2>
            <p>{store.lastReceipt.localNumber}</p>
            {store.lastReceipt.items.map((item) => (
              <div key={item.productId}>
                <span>
                  {item.productName} x {item.quantity}
                </span>
                <strong>{formatCurrency(symbol, item.lineTotal)}</strong>
              </div>
            ))}
            <hr />
            <div>
              <span>Total</span>
              <strong>{formatCurrency(symbol, store.lastReceipt.total)}</strong>
            </div>
            <p>
              {store.lastReceipt.paymentMethod === "external-terminal" ? "External terminal" : "Cash"} payment recorded.
            </p>
            <button onClick={() => window.print()}>Print receipt</button>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function ProductsView({
  products,
  categories,
  symbol,
  save,
  remove,
  canPerformAction,
  alertDays
}: {
  products: Product[];
  categories: Category[];
  symbol: string;
  save: ReturnType<typeof usePosStore>["saveEntity"];
  remove: ReturnType<typeof usePosStore>["removeEntity"];
  canPerformAction: (action: import("@/lib/types").PermissionKey) => boolean;
  alertDays: number;
}) {
  const [query, setQuery] = useState("");
  const [filterKey, setFilterKey] = useState<"all" | "category" | "supplier" | "barcode" | "stock" | "expiry" | "scpwd">("all");
  const [filterValue, setFilterValue] = useState("");
  const [sortKey, setSortKey] = useState<InventorySortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<InventorySortDirection>("asc");
  const [page, setPage] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Product>(() => buildProductDraft({ categoryId: categories[0]?.id || "" }));

  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  const filteredProducts = useMemo(() => {
    const text = query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const categoryName = categoryMap[product.categoryId] || "Uncategorized";
      const matchesSearch =
        !text ||
        product.name.toLowerCase().includes(text) ||
        product.barcode.toLowerCase().includes(text) ||
        product.supplier.toLowerCase().includes(text) ||
        categoryName.toLowerCase().includes(text);

      if (!matchesSearch) {
        return false;
      }

      if (filterKey === "all" || !filterValue) {
        return true;
      }

      if (filterKey === "category") {
        return product.categoryId === filterValue;
      }

      if (filterKey === "supplier") {
        return product.supplier.toLowerCase().includes(filterValue.toLowerCase());
      }

      if (filterKey === "barcode") {
        return product.barcode.includes(filterValue);
      }

      if (filterKey === "stock") {
        if (filterValue === "low") return product.tracksStock && isLowStock(product);
        if (filterValue === "out") return product.tracksStock && product.quantity <= 0;
        if (filterValue === "service") return !product.tracksStock;
      }

      if (filterKey === "expiry") {
        if (filterValue === "expired") return isExpired(product);
        if (filterValue === "near") return isNearExpiry(product, alertDays);
        if (filterValue === "ok") return !isExpired(product) && !isNearExpiry(product, alertDays);
      }

      if (filterKey === "scpwd") {
        if (filterValue === "medicine") return product.scPwdEligibility === "medicine";
        if (filterValue === "non-medicine") return product.scPwdEligibility === "non-medicine";
        if (filterValue === "excluded") return product.scPwdEligibility === "excluded";
        if (filterValue === "prescription") return product.isPrescription;
        if (filterValue === "vat-exempt") return product.vatExempt;
      }

      return true;
    });

    if (!sortKey) {
      return filtered;
    }

    const direction = sortDirection === "asc" ? 1 : -1;

    return [...filtered].sort((left, right) => {
      const leftCategoryName = categoryMap[left.categoryId] || "Uncategorized";
      const rightCategoryName = categoryMap[right.categoryId] || "Uncategorized";

      if (sortKey === "title") {
        return inventorySortCollator.compare(left.name, right.name) * direction;
      }

      if (sortKey === "category") {
        const categoryComparison = inventorySortCollator.compare(leftCategoryName, rightCategoryName) * direction;
        return categoryComparison || inventorySortCollator.compare(left.name, right.name);
      }

      if (sortKey === "price") {
        const priceComparison = (left.price - right.price) * direction;
        return priceComparison || inventorySortCollator.compare(left.name, right.name);
      }

      if (sortKey === "expiry") {
        const leftDays = daysUntilExpiry(left);
        const rightDays = daysUntilExpiry(right);
        if (leftDays === null && rightDays === null) {
          return inventorySortCollator.compare(left.name, right.name);
        }
        if (leftDays === null) return 1;
        if (rightDays === null) return -1;
        return ((leftDays ?? 9999) - (rightDays ?? 9999)) * direction || inventorySortCollator.compare(left.name, right.name);
      }

      const leftQuantity = left.tracksStock ? left.quantity : null;
      const rightQuantity = right.tracksStock ? right.quantity : null;

      if (leftQuantity === null && rightQuantity === null) {
        return inventorySortCollator.compare(left.name, right.name);
      }

      if (leftQuantity === null) {
        return 1;
      }

      if (rightQuantity === null) {
        return -1;
      }

      const quantityComparison = (leftQuantity - rightQuantity) * direction;
      return quantityComparison || inventorySortCollator.compare(left.name, right.name);
    });
  }, [categoryMap, filterKey, filterValue, products, query, sortDirection, sortKey]);

  const pageSize = 11;
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [filterKey, filterValue, query, sortDirection, sortKey]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  function openCreateForm() {
    setDraft(buildProductDraft({ categoryId: categories[0]?.id || "" }));
    setEditorOpen(true);
  }

  function openEditForm(product: Product) {
    setDraft(buildProductDraft(product));
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setDraft(buildProductDraft({ categoryId: categories[0]?.id || "" }));
  }

  function updateDraft<K extends keyof Product>(key: K, value: Product[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canPerformAction("products")) return;
    const controlledClass =
      draft.drugClassification === "DD, Rx" ||
      draft.drugClassification === "EDD, Rx" ||
      draft.drugClassification === "Rx" ||
      draft.drugClassification === "Pharmacist-Only OTC";
    await save(
      "products",
      {
        ...draft,
        barcode: draft.barcode || String(Date.now()).slice(-6),
        expirationDate: draft.expirationDate || "N/A",
        cost: typeof draft.cost === "number" ? draft.cost : draft.originalPrice ?? draft.price,
        isPrescription:
          draft.drugClassification === "DD, Rx" ||
          draft.drugClassification === "EDD, Rx" ||
          draft.drugClassification === "Rx",
        behindCounter: controlledClass
      },
      "product"
    );
    closeEditor();
  }

  async function toggleFeatured(product: Product) {
    if (!canPerformAction("products")) return;
    await save("products", { ...product, featured: !product.featured }, "product");
  }

  async function markExpired(product: Product) {
    if (!canPerformAction("products")) return;
    await save("products", { ...product, quantity: 0 }, "product");
  }

  function toggleSort(nextKey: InventorySortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function renderSortSymbol(columnKey: InventorySortKey) {
    if (sortKey !== columnKey) {
      return "â†•";
    }

    return sortDirection === "asc" ? "â†‘" : "â†“";
  }

  return (
    <section className="products-admin panel">
      <div className="products-admin-head">
        <div>
          <h2>Inventory</h2>
          <p>Spreadsheet-style product management with sticky headers, inline filters, and compact rows.</p>
        </div>
        <button type="button" className="primary" onClick={openCreateForm}>
          Add Product
        </button>
      </div>

      <div className="products-filterbar">
        <input
          aria-label="Search inventory"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search inventory"
        />
        <label className="products-filter-label">
          <span>Property</span>
          <select
            aria-label="Property"
            value={filterKey}
            onChange={(event) => {
              setFilterKey(event.target.value as "all" | "category" | "supplier" | "barcode" | "stock" | "expiry");
              setFilterValue("");
            }}
          >
            <option value="all">All</option>
            <option value="category">Category</option>
            <option value="supplier">Supplier</option>
            <option value="barcode">Barcode</option>
            <option value="stock">Stock status</option>
            <option value="expiry">Expiry status</option>
            <option value="scpwd">SC/PWD eligibility</option>
          </select>
        </label>
        <label className="products-filter-label">
          <span>Value</span>
          {filterKey === "category" ? (
            <select aria-label="Value" value={filterValue} onChange={(event) => setFilterValue(event.target.value)}>
              <option value="">Any category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          ) : null}
          {filterKey === "stock" ? (
            <select aria-label="Value" value={filterValue} onChange={(event) => setFilterValue(event.target.value)}>
              <option value="">Any stock state</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
              <option value="service">Service</option>
            </select>
          ) : null}
          {filterKey === "expiry" ? (
            <select aria-label="Value" value={filterValue} onChange={(event) => setFilterValue(event.target.value)}>
              <option value="">Any expiry state</option>
              <option value="expired">Expired</option>
              <option value="near">Near expiry</option>
              <option value="ok">OK</option>
            </select>
          ) : null}
          {filterKey === "scpwd" ? (
            <select aria-label="Value" value={filterValue} onChange={(event) => setFilterValue(event.target.value)}>
              <option value="">Any eligibility</option>
              <option value="medicine">Medicine</option>
              <option value="non-medicine">Non-medicine</option>
              <option value="excluded">Excluded</option>
              <option value="prescription">Prescription</option>
              <option value="vat-exempt">VAT exempt</option>
            </select>
          ) : null}
          {filterKey !== "category" && filterKey !== "stock" && filterKey !== "expiry" && filterKey !== "scpwd" ? (
            <input
              aria-label="Value"
              value={filterValue}
              onChange={(event) => setFilterValue(event.target.value)}
              placeholder={filterKey === "all" ? "Any value" : `Filter by ${filterKey}`}
            />
          ) : null}
        </label>
      </div>

      {(() => {
        const expired = products.filter((p) => isExpired(p));
        const near = products.filter((p) => !isExpired(p) && isNearExpiry(p, alertDays));
        if (expired.length === 0 && near.length === 0) return null;
        return (
          <div className={`alert-banner ${expired.length > 0 ? "critical" : "warning"}`}>
            <span>
              {expired.length > 0 ? `${expired.length} expired` : null}
              {expired.length > 0 && near.length > 0 ? " and " : null}
              {near.length > 0 ? `${near.length} near-expiry` : null} product{expired.length + near.length > 1 ? "s" : ""} need attention.
            </span>
          </div>
        );
      })()}

      <div className="products-table" role="table" aria-label="Products table">
        <div className="products-table-head" role="row">
          <button type="button" className="table-sort" onClick={() => toggleSort("title")} aria-label="Sort by title">
            <span>Title</span>
            <span className="table-sort-symbol" aria-hidden="true">
              {renderSortSymbol("title")}
            </span>
          </button>
          <button type="button" className="table-sort" onClick={() => toggleSort("price")} aria-label="Sort by price">
            <span>Price</span>
            <span className="table-sort-symbol" aria-hidden="true">
              {renderSortSymbol("price")}
            </span>
          </button>
          <button type="button" className="table-sort" onClick={() => toggleSort("quantity")} aria-label="Sort by quantity">
            <span>Quantity</span>
            <span className="table-sort-symbol" aria-hidden="true">
              {renderSortSymbol("quantity")}
            </span>
          </button>
          <button type="button" className="table-sort" onClick={() => toggleSort("expiry")} aria-label="Sort by expiry">
            <span>Expiry</span>
            <span className="table-sort-symbol" aria-hidden="true">
              {renderSortSymbol("expiry")}
            </span>
          </button>
          <button type="button" className="table-sort" onClick={() => toggleSort("category")} aria-label="Sort by category">
            <span>Category</span>
            <span className="table-sort-symbol" aria-hidden="true">
              {renderSortSymbol("category")}
            </span>
          </button>
          <span>Actions</span>
        </div>
        <div className="products-table-body">
          {pagedProducts.length === 0 ? <p className="empty">No matching products.</p> : null}
          {pagedProducts.map((product) => {
            const categoryName = categoryMap[product.categoryId] || "Uncategorized";
            return (
              <article className="product-row" data-testid="product-row" key={product.id} role="row">
                <div className="product-cell product-title">
                  <strong>{product.name}</strong>
                  <small>{product.barcode}</small>
                  <span className={`badge ${getDrugClassBadge(product.drugClassification).className}`}>
                    {getDrugClassBadge(product.drugClassification).label}
                  </span>
                  {product.isPrescription && <span className="badge prescription">Rx</span>}
                  {product.scPwdEligibility && product.scPwdEligibility !== "excluded" && (
                    <span className={`badge scpwd-${product.scPwdEligibility}`}>
                      {product.scPwdEligibility === "medicine" ? "Med" : "Non-Med"}
                    </span>
                  )}
                </div>
                <div className="product-cell product-price-cell">
                  {typeof product.originalPrice === "number" && product.originalPrice > product.price ? (
                    <span className="price-original">{formatCurrency(symbol, product.originalPrice)}</span>
                  ) : null}
                  <span className="product-price">{formatCurrency(symbol, product.price)}</span>
                </div>
                <div className="product-cell">
                  <span className={`product-inventory-stock ${isLowStock(product) ? "quantity-low" : product.tracksStock ? "quantity-ok" : "quantity-service"}`}>{product.tracksStock ? product.quantity : "Service"}</span>
                </div>
                <div className="product-cell">
                  {(() => {
                    const expired = isExpired(product);
                    const near = !expired && isNearExpiry(product, alertDays);
                    if (!product.tracksStock) return <span className="expiry-badge service">N/A</span>;
                    if (expired) return <span className="expiry-badge expired">Expired</span>;
                    if (near) return <span className="expiry-badge near">{daysUntilExpiry(product)}d</span>;
                    return <span className="expiry-badge ok">{product.expirationDate}</span>;
                  })()}
                </div>
                <div className="product-cell">
                  <span className="product-inventory-category">{categoryName}</span>
                </div>
                <div className="product-actions">
                  {product.tracksStock ? (
                    <button type="button" className="icon-button danger" aria-label={`Mark ${product.name} expired`} onClick={() => markExpired(product)} title="Mark expired">?</button>
                  ) : null}
                  <button
                    type="button"
                    className={`icon-button ${product.featured ? "active" : ""}`}
                    aria-label={`Toggle featured for ${product.name}`}
                    onClick={() => toggleFeatured(product)}
                  >
                    ?
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Edit product ${product.name}`}
                    onClick={() => openEditForm(product)}
                  >
                    ?
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="products-table-footer">
        <span>{filteredProducts.length} records</span>
        <div className="pagination">
          {Array.from({ length: pageCount }, (_, index) => (
            <button
              key={index + 1}
              type="button"
              className={currentPage === index + 1 ? "active" : ""}
              onClick={() => setPage(index + 1)}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>

      {editorOpen ? (
        <section className="product-editor-shell">
          <form className="panel product-editor" onSubmit={submit}>
            <div className="product-editor-head">
              <div>
                <h3>{products.some((product) => product.id === draft.id) ? "Edit Product" : "Add Product"}</h3>
                <p>Use one shared form for new products and quick edits.</p>
              </div>
              <div className="product-editor-head-actions">
                {products.some((product) => product.id === draft.id) ? (
                  <button
                    type="button"
                    className="danger"
                    onClick={async () => {
                      const confirmed = window.confirm(`Delete ${draft.name || "this product"}?`);
                      if (!confirmed) return;
                      await remove("products", draft.id, "product");
                      closeEditor();
                    }}
                  >
                    Delete Product
                  </button>
                ) : null}
                <button type="button" onClick={closeEditor}>
                  Close
                </button>
              </div>
            </div>
            <div className="product-editor-grid">
              <label>
                Name
                <input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} required />
              </label>
              <label>
                Barcode
                <input value={draft.barcode} onChange={(event) => updateDraft("barcode", event.target.value)} />
              </label>
              <label>
                Category
                <select value={draft.categoryId} onChange={(event) => updateDraft("categoryId", event.target.value)} required>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Supplier
                <input value={draft.supplier} onChange={(event) => updateDraft("supplier", event.target.value)} />
              </label>
              <label>
                Price
                <input
                  type="number"
                  step="0.01"
                  value={draft.price}
                  onChange={(event) => updateDraft("price", Number(event.target.value))}
                  required
                />
              </label>
              <label>
                Original Price
                <input
                  type="number"
                  step="0.01"
                  value={draft.originalPrice ?? ""}
                  onChange={(event) =>
                    updateDraft("originalPrice", event.target.value === "" ? undefined : Number(event.target.value))
                  }
                />
              </label>
              <label>
                Unit Cost
                <input
                  type="number"
                  step="0.01"
                  value={draft.cost ?? ""}
                  onChange={(event) =>
                    updateDraft("cost", event.target.value === "" ? undefined : Number(event.target.value))
                  }
                />
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  value={draft.quantity}
                  onChange={(event) => updateDraft("quantity", Number(event.target.value))}
                  required
                />
              </label>
              <label>
                Min Stock
                <input
                  type="number"
                  value={draft.minStock}
                  onChange={(event) => updateDraft("minStock", Number(event.target.value))}
                  required
                />
              </label>
              <label>
                Expiry Date
                <input
                  type="date"
                  value={
                    draft.expirationDate && draft.expirationDate.includes("/")
                      ? (() => {
                          const [m, d, y] = draft.expirationDate.split("/");
                          return y && m && d ? `${y}-${m}-${d}` : "";
                        })()
                      : draft.expirationDate && draft.expirationDate.includes("-")
                      ? draft.expirationDate
                      : ""
                  }
                  onChange={(event) => {
                    const val = event.target.value;
                    if (!val) {
                      updateDraft("expirationDate", "");
                    } else {
                      const [y, m, d] = val.split("-");
                      updateDraft("expirationDate", `${m}/${d}/${y}`);
                    }
                  }}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.tracksStock}
                  onChange={(event) => updateDraft("tracksStock", event.target.checked)}
                />
                Track stock
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={Boolean(draft.featured)}
                  onChange={(event) => updateDraft("featured", event.target.checked)}
                />
                Featured product
              </label>
              <label>
                SC/PWD Eligibility
                <select value={draft.scPwdEligibility} onChange={(event) => updateDraft("scPwdEligibility", event.target.value as Product["scPwdEligibility"])}>
                  <option value="medicine">Medicine</option>
                  <option value="non-medicine">Non-medicine</option>
                  <option value="excluded">Excluded</option>
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={Boolean(draft.vatExempt)}
                  onChange={(event) => updateDraft("vatExempt", event.target.checked)}
                />
                VAT Exempt
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={Boolean(draft.isPrescription)}
                  onChange={(event) => updateDraft("isPrescription", event.target.checked)}
                />
                Prescription Required
              </label>
              <label>
                Drug Classification
                <select
                  value={draft.drugClassification}
                  onChange={(event) => updateDraft("drugClassification", event.target.value as Product["drugClassification"])}
                  required
                >
                  <option value="DD, Rx">DD, Rx</option>
                  <option value="EDD, Rx">EDD, Rx</option>
                  <option value="Rx">Rx</option>
                  <option value="Pharmacist-Only OTC">Pharmacist-Only OTC</option>
                  <option value="Non-Rx OTC">Non-Rx OTC</option>
                </select>
              </label>
              <label>
                Generic Name
                <input value={draft.genericName} onChange={(event) => updateDraft("genericName", event.target.value)} />
              </label>
              <label>
                Brand Name
                <input value={draft.brandName} onChange={(event) => updateDraft("brandName", event.target.value)} />
              </label>
              <label>
                Active Ingredient / Salt
                <input value={draft.activeIngredient} onChange={(event) => updateDraft("activeIngredient", event.target.value)} />
              </label>
              <label>
                Dosage Strength
                <input value={draft.dosageStrength} onChange={(event) => updateDraft("dosageStrength", event.target.value)} />
              </label>
              <label>
                Dosage Form
                <input value={draft.dosageForm} onChange={(event) => updateDraft("dosageForm", event.target.value)} />
              </label>
              <label>
                FDA CPR Number
                <input value={draft.fdaCprNumber} onChange={(event) => updateDraft("fdaCprNumber", event.target.value)} />
              </label>
            </div>
            <div className="product-editor-actions">
              <button type="submit" className="primary">
                Save Product
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </section>
  );
}

function CustomersView({
  customers,
  save,
  remove,
  canPerformAction
}: {
  customers: Customer[];
  save: ReturnType<typeof usePosStore>["saveEntity"];
  remove: ReturnType<typeof usePosStore>["removeEntity"];
  canPerformAction: (action: import("@/lib/types").PermissionKey) => boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [sortKey, setSortKey] = useState<CustomerSortKey>("newest");

  const sortedCustomers = useMemo(() => {
    const list = [...customers];
    if (sortKey === "alphabetical") {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, [customers, sortKey]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canPerformAction("customers")) return;
    const data = readForm(event.currentTarget);
    await save(
      "customers",
      {
        id: crypto.randomUUID(),
        version: 1,
        name: data.name,
        phone: data.phone,
        email: data.email,
        createdAt: new Date().toISOString()
      },
      "customer"
    );
    setModalOpen(false);
    event.currentTarget.reset();
  }

  return (
    <section className="customers-admin panel">
      <div className="customers-admin-head">
        <div>
          <h2>Customers</h2>
          <p>Manage your customer database and view contact information.</p>
        </div>
        <div className="customers-admin-actions">
          <select
            className="sort-select"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as CustomerSortKey)}
            aria-label="Sort customers"
          >
            <option value="newest">Newest to Oldest</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
          <button type="button" className="primary" onClick={() => setModalOpen(true)}>
            Add
          </button>
        </div>
      </div>

      <div className="customers-list">
        {sortedCustomers.length === 0 ? <p className="empty">No customers found.</p> : null}
        {sortedCustomers.map((customer) => (
          <article className="data-row" key={customer.id}>
            <strong>{customer.name}</strong>
            <span>{customer.phone || "No phone"}</span>
            <span>{customer.email || "No email"}</span>
            {customer.id !== "walk-in" ? (
              <button
                className="danger"
                disabled={!canPerformAction("customers")}
                onClick={() => canPerformAction("customers") && remove("customers", customer.id, "customer")}
              >
                Delete
              </button>
            ) : null}
          </article>
        ))}
      </div>

      {modalOpen ? (
        <section className="product-editor-shell">
          <form className="panel product-editor" onSubmit={submit}>
            <div className="product-editor-head">
              <div>
                <h3>Add</h3>
                <p>Register a new customer to track their purchase history.</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)}>
                Close
              </button>
            </div>
            <div className="form-grid">
              <label className="input-label">
                Name
                <input name="name" required placeholder="Full Name" />
              </label>
              <label className="input-label">
                Phone
                <input name="phone" placeholder="+63 900 000 0000" />
              </label>
              <label className="input-label">
                Email
                <input name="email" type="email" placeholder="email@example.com" />
              </label>
            </div>
            <div className="product-editor-actions">
              <button type="submit" className="primary">
                Save Customer
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </section>
  );
}

type SettingsTab = "store" | "categories" | "users" | "bir" | "printer" | "prescriptions";

function SettingsView({
  settings,
  categories,
  users,
  save,
  saveUserAccount,
  remove,
  reset,
  canPerformAction,
  rxSettings,
  updateRxSettings
}: {
  settings: Settings;
  categories: Category[];
  users: User[];
  save: ReturnType<typeof usePosStore>["saveEntity"];
  saveUserAccount: ReturnType<typeof usePosStore>["saveUserAccount"];
  remove: ReturnType<typeof usePosStore>["removeEntity"];
  reset: ReturnType<typeof usePosStore>["resetData"];
  canPerformAction: (action: import("@/lib/types").PermissionKey) => boolean;
  rxSettings: ReturnType<typeof usePosStore>["rxSettings"];
  updateRxSettings: ReturnType<typeof usePosStore>["updateRxSettings"];
}) {
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("store");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userFormError, setUserFormError] = useState("");
  const [userForm, setUserForm] = useState({
    username: "",
    fullname: "",
    role: "cashier" as User["role"],
    password: "",
    confirmPassword: ""
  });

  async function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canPerformAction("settings")) return;
    const data = readForm(event.currentTarget);
    await save(
      "settings",
      {
        id: "store",
        version: 1,
        store: data.store,
        addressOne: data.addressOne,
        addressTwo: data.addressTwo,
        contact: data.contact,
        currencySymbol: data.currencySymbol,
        vatPercentage: Number(data.vatPercentage),
        chargeTax: data.chargeTax === "on",
        quickBilling: data.quickBilling === "on",
        receiptFooter: data.receiptFooter,
        expiryAlertDays: Math.max(1, Math.min(365, Number(data.expiryAlertDays) || 30))
      },
      "settings"
    );
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canPerformAction("categories")) return;
    const data = readForm(event.currentTarget);
    await save("categories", { id: crypto.randomUUID(), version: 1, name: data.name }, "category");
    event.currentTarget.reset();
  }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canPerformAction("users")) return;
    setUserFormError("");
    const password = userForm.password.trim();
    const confirmPassword = userForm.confirmPassword.trim();
    const isEditing = Boolean(editingUserId);

    if (!isEditing && !password) {
      setUserFormError("Password is required when creating a user.");
      return;
    }

    if ((password || confirmPassword) && password !== confirmPassword) {
      setUserFormError("Password confirmation must match.");
      return;
    }

    await saveUserAccount({
      id: editingUserId ?? undefined,
      username: userForm.username,
      fullname: userForm.fullname,
      role: userForm.role,
      permissions: buildUserPermissions(userForm.role),
      password: password || undefined
    });

    setEditingUserId(null);
    setUserForm({
      username: "",
      fullname: "",
      role: "cashier",
      password: "",
      confirmPassword: ""
    });
  }

  function startEditUser(user: User) {
    setEditingUserId(user.id);
    setUserFormError("");
    setUserForm({
      username: user.username,
      fullname: user.fullname,
      role: user.role,
      password: "",
      confirmPassword: ""
    });
  }

  function cancelUserEdit() {
    setEditingUserId(null);
    setUserFormError("");
    setUserForm({
      username: "",
      fullname: "",
      role: "cashier",
      password: "",
      confirmPassword: ""
    });
  }

  return (
    <section className="settings-page">
      <div className="settings-tabs">
        <div className="segmented">
          <button
            type="button"
            className={settingsTab === "store" ? "active" : ""}
            onClick={() => setSettingsTab("store")}
          >
            Store
          </button>
          <button
            type="button"
            className={settingsTab === "categories" ? "active" : ""}
            onClick={() => setSettingsTab("categories")}
          >
            Categories
            <span className="tab-badge">{categories.length}</span>
          </button>
          <button
            type="button"
            className={settingsTab === "users" ? "active" : ""}
            onClick={() => setSettingsTab("users")}
          >
            Users
            <span className="tab-badge">{users.length}</span>
          </button>
          <button
            type="button"
            className={settingsTab === "bir" ? "active" : ""}
            onClick={() => setSettingsTab("bir")}
          >
            BIR
          </button>
          <button
            type="button"
            className={settingsTab === "printer" ? "active" : ""}
            onClick={() => setSettingsTab("printer")}
          >
            Printer
          </button>
          <button
            type="button"
            className={settingsTab === "prescriptions" ? "active" : ""}
            onClick={() => setSettingsTab("prescriptions")}
          >
            Prescriptions
          </button>
        </div>
      </div>

      {settingsTab === "store" ? (
        <section className="panel settings-panel">
          <form className="form-grid" onSubmit={submitSettings}>
            <h2>Store settings</h2>
            <label className="input-label">
              Store name
              <input name="store" defaultValue={settings.store} />
            </label>
            <label className="input-label">
              Address line 1
              <input name="addressOne" defaultValue={settings.addressOne} />
            </label>
            <label className="input-label">
              Address line 2
              <input name="addressTwo" defaultValue={settings.addressTwo} />
            </label>
            <label className="input-label">
              Contact
              <input name="contact" defaultValue={settings.contact} />
            </label>
            <label className="input-label">
              Currency symbol
              <input name="currencySymbol" defaultValue={settings.currencySymbol} maxLength={3} />
            </label>
            <label className="input-label">
              VAT percentage
              <input name="vatPercentage" type="number" defaultValue={settings.vatPercentage} />
            </label>
            <label className="check">
              <input name="chargeTax" type="checkbox" defaultChecked={settings.chargeTax} /> Charge VAT
            </label>
            <label className="check">
              <input name="quickBilling" type="checkbox" defaultChecked={settings.quickBilling} /> Quick billing
            </label>
            <label className="input-label">
              Expiry alert threshold (days)
              <input name="expiryAlertDays" type="number" min="1" max="365" defaultValue={settings.expiryAlertDays ?? 30} />
            </label>
            <label className="input-label">
              Receipt footer
              <textarea name="receiptFooter" defaultValue={settings.receiptFooter} />
            </label>
            <div className="settings-actions">
              <button className="primary" disabled={!canPerformAction("settings")}>Save settings</button>
              <button
                type="button"
                disabled={!canPerformAction("admin")}
                onClick={async () => {
                  if (!canPerformAction("admin")) return;
                  const data = await exportAllData();
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `ppos-backup-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Export Backup
              </button>
              <button
                type="button"
                disabled={!canPerformAction("admin")}
                onClick={() => {
                  if (!canPerformAction("admin")) return;
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".json,application/json";
                  input.onchange = async () => {
                    const file = input.files?.[0];
                    if (!file) return;
                    if (!window.confirm("WARNING: This will replace ALL current data with the backup. This action cannot be undone. Are you sure?")) return;
                    try {
                      const text = await file.text();
                      const data = JSON.parse(text);
                      await importAllData(data);
                      window.alert("Backup restored successfully. Reloading...");
                      window.location.reload();
                    } catch (err) {
                      window.alert(`Restore failed: ${err instanceof Error ? err.message : "Unknown error"}`);
                    }
                  };
                  input.click();
                }}
              >
                Import Backup
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  if (!canPerformAction("admin")) return;
                  if (window.confirm("WARNING: This will permanently delete ALL data and reset to factory defaults. This action cannot be undone. Are you sure?")) {
                    reset();
                  }
                }}
              >
                Reset prototype data
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {settingsTab === "categories" ? (
        <section className="settings-tab-content">
          <div className="settings-subgrid">
            <form className="panel form-grid" onSubmit={submitCategory}>
              <h2>Add category</h2>
              <label className="input-label">
                Category name
                <input name="name" required placeholder="e.g. Vitamins" />
              </label>
              <button className="primary" disabled={!canPerformAction("categories")}>Save category</button>
            </form>
            <DataPanel title={`Categories (${categories.length})`}>
              {categories.length === 0 ? <p className="empty">No categories yet.</p> : null}
              {categories.map((category) => (
                <article className="data-row" key={category.id}>
                  <strong>{category.name}</strong>
                  <button disabled={!canPerformAction("categories")} onClick={() => canPerformAction("categories") && save("categories", { ...category, name: `${category.name}*` }, "category")}>Mark edited</button>
                  <button className="danger" disabled={!canPerformAction("categories")} onClick={() => canPerformAction("categories") && remove("categories", category.id, "category")}>Delete</button>
                </article>
              ))}
            </DataPanel>
          </div>
        </section>
      ) : null}

      {settingsTab === "users" ? (
        <section className="settings-tab-content">
          <div className="settings-subgrid">
            <form className="panel form-grid" onSubmit={submitUser}>
              <h2>{editingUserId ? "Edit user" : "Add user"}</h2>
              <label className="input-label">
                Username
                <input
                  name="username"
                  required
                  placeholder="e.g. jsmith"
                  value={userForm.username}
                  onChange={(event) => setUserForm((current) => ({ ...current, username: event.target.value }))}
                />
              </label>
              <label className="input-label">
                Full name
                <input
                  name="fullname"
                  required
                  placeholder="e.g. Jane Smith"
                  value={userForm.fullname}
                  onChange={(event) => setUserForm((current) => ({ ...current, fullname: event.target.value }))}
                />
              </label>
              <label className="input-label">
                Role
                <select
                  name="role"
                  value={userForm.role}
                  onChange={(event) =>
                    setUserForm((current) => ({ ...current, role: event.target.value as User["role"] }))
                  }
                >
                  <option value="cashier">Cashier</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="pharmacist">Pharmacist</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label className="input-label">
                Password
                <input
                  name="password"
                  type="password"
                  placeholder={editingUserId ? "Leave blank to keep current password" : "Set initial password"}
                  value={userForm.password}
                  onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                />
              </label>
              <label className="input-label">
                Confirm password
                <input
                  name="confirmPassword"
                  type="password"
                  placeholder={editingUserId ? "Repeat new password if changing it" : "Repeat password"}
                  value={userForm.confirmPassword}
                  onChange={(event) => setUserForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                />
              </label>
              {userFormError ? <p className="error-copy">{userFormError}</p> : null}
              <div className="settings-actions">
                <button className="primary" disabled={!canPerformAction("users")}>{editingUserId ? "Update user" : "Save user"}</button>
                {editingUserId ? (
                  <button type="button" onClick={cancelUserEdit}>Cancel</button>
                ) : null}
              </div>
            </form>
            <DataPanel title={`Users (${users.length})`}>
              {users.map((user) => (
                <article className="data-row" key={user.id}>
                  <strong>{user.fullname}</strong>
                  <span>{user.username}</span>
                  <span className="role-badge">{user.role}</span>
                  <button type="button" disabled={!canPerformAction("users")} onClick={() => canPerformAction("users") && startEditUser(user)}>Edit</button>
                  {user.id !== "usr-admin" ? <button className="danger" disabled={!canPerformAction("users")} onClick={() => canPerformAction("users") && remove("users", user.id, "user")}>Delete</button> : null}
                </article>
              ))}
            </DataPanel>
          </div>
        </section>
      ) : null}
      {settingsTab === "bir" ? (
        <BirSettingsPanel />
      ) : null}
      {settingsTab === "printer" ? (
        <PrinterSettingsPanel />
      ) : null}
      {settingsTab === "prescriptions" ? (
        <PrescriptionSettingsPanel settings={rxSettings} onUpdate={updateRxSettings} />
      ) : null}
    </section>
  );
}

function ReportsView({
  transactions,
  products,
  customers,
  categories,
  symbol,
  dailySales,
  alertDays,
  scPwdTransactionLog,
  getScPwdSummary,
  scPwdAlerts,
  canPerformAction,
  users,
  currentUser,
  acknowledgeOverride,
}: {
  transactions: ReturnType<typeof usePosStore>["transactions"];
  products: Product[];
  customers: Customer[];
  categories: Category[];
  symbol: string;
  dailySales: ReturnType<typeof usePosStore>["transactions"];
  alertDays: number;
  scPwdTransactionLog: ReturnType<typeof usePosStore>["scPwdTransactionLog"];
  getScPwdSummary: ReturnType<typeof usePosStore>["getScPwdSummary"];
  scPwdAlerts: ReturnType<typeof usePosStore>["scPwdAlerts"];
  canPerformAction?: (action: import("@/lib/types").PermissionKey) => boolean;
  users?: import("@/lib/types").User[];
  currentUser?: import("@/lib/types").User | null;
  acknowledgeOverride?: ReturnType<typeof usePosStore>["acknowledgeOverride"];
}) {
  const [reportsTab, setReportsTab] = useState<"overview" | "bir" | "audit" | "sc-pwd">("overview");
  const totalSales = transactions.reduce((sum, transaction) => sum + transaction.total, 0);
  const lowStock = products.filter(isLowStock);
  const nearExpiry = [...products.filter((p) => !isExpired(p) && isNearExpiry(p, alertDays))].sort(
    (a, b) => (daysUntilExpiry(a) ?? 0) - (daysUntilExpiry(b) ?? 0)
  );
  const expired = [...products.filter(isExpired)].sort((a, b) => (daysUntilExpiry(a) ?? 0) - (daysUntilExpiry(b) ?? 0));

  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  return (
    <section className="reports-page">
      <div className="settings-tabs">
        <div className="segmented">
          <button type="button" className={reportsTab === "overview" ? "active" : ""} onClick={() => setReportsTab("overview")}>
            Overview
          </button>
          <button type="button" className={reportsTab === "bir" ? "active" : ""} onClick={() => setReportsTab("bir")}>
            BIR Reports
          </button>
          <button type="button" className={reportsTab === "audit" ? "active" : ""} onClick={() => setReportsTab("audit")}>
            Audit Trail
          </button>
          <button type="button" className={reportsTab === "sc-pwd" ? "active" : ""} onClick={() => setReportsTab("sc-pwd")}>
            SC/PWD
          </button>
        </div>
      </div>

      {reportsTab === "overview" ? (
      <section className="reports-grid">
      <DataPanel title="Summary">
        <article className="metric"><span>Total sales</span><strong>{formatCurrency(symbol, totalSales)}</strong></article>
        <article className="metric"><span>Transactions</span><strong>{transactions.length}</strong></article>
        <article className="metric"><span>Today</span><strong>{formatCurrency(symbol, dailySales.reduce((sum, sale) => sum + sale.total, 0))}</strong></article>
        <article className="metric"><span>Customers</span><strong>{customers.length}</strong></article>
      </DataPanel>

      <DataPanel title={`Expired (${expired.length})`}>
        {expired.length === 0 ? <p className="empty">No expired products.</p> : null}
        {expired.map((product) => (
          <article className="data-row alert-row" key={product.id}>
            <strong>{product.name}</strong>
            <span>SKU {product.barcode}</span>
            <span>{categoryMap[product.categoryId] || "Uncategorized"}</span>
            <span className="expiry-badge expired">Expired</span>
            <span>{product.tracksStock ? `${product.quantity} in stock` : "Service"}</span>
            <span>{formatCurrency(symbol, product.price)}</span>
          </article>
        ))}
      </DataPanel>

      <DataPanel title={`Near expiry (${nearExpiry.length})`}>
        {nearExpiry.length === 0 ? <p className="empty">No near-expiry products.</p> : null}
        {nearExpiry.map((product) => (
          <article className="data-row alert-row" key={product.id}>
            <strong>{product.name}</strong>
            <span>SKU {product.barcode}</span>
            <span>{categoryMap[product.categoryId] || "Uncategorized"}</span>
            <span className="expiry-badge near">{daysUntilExpiry(product)}d left</span>
            <span>{product.tracksStock ? `${product.quantity} in stock` : "Service"}</span>
            <span>{formatCurrency(symbol, product.price)}</span>
          </article>
        ))}
      </DataPanel>

      <DataPanel title={`Low stock (${lowStock.length})`}>
        {lowStock.length === 0 ? <p className="empty">No low-stock products.</p> : null}
        {lowStock.map((product) => (
          <article className="data-row alert-row" key={product.id}>
            <strong>{product.name}</strong>
            <span>SKU {product.barcode}</span>
            <span>{categoryMap[product.categoryId] || "Uncategorized"}</span>
            <span className="quantity-low">{product.quantity} left</span>
            <span>{formatCurrency(symbol, product.price)}</span>
          </article>
        ))}
      </DataPanel>

      <DataPanel title="Recent transactions">
        {transactions.slice(0, 10).map((transaction) => (
          <article className="data-row" key={transaction.id}>
            <strong>{transaction.localNumber}</strong>
            <span>{formatCurrency(symbol, transaction.total)}</span>
            <span>{transaction.paymentMethod}</span>
            <span>{transaction.syncStatus}</span>
          </article>
        ))}
      </DataPanel>
    </section>
      ) : null}
      {reportsTab === "bir" ? (
        <BirReportsPanel
          scPwdTransactionLog={scPwdTransactionLog}
          getScPwdSummary={getScPwdSummary}
          scPwdAlerts={scPwdAlerts}
          canPerformAction={canPerformAction}
          users={users}
          currentUser={currentUser}
          acknowledgeOverride={acknowledgeOverride}
        />
      ) : null}
      {reportsTab === "audit" ? (
        <AuditTrailPanel users={users} />
      ) : null}
      {reportsTab === "sc-pwd" ? (
        <section className="reports-grid">
          <ScpwdSummaryCardComponent summary={getScPwdSummary()} />
          <ScpwdTransactionLog rows={scPwdTransactionLog} />
        </section>
      ) : null}
    </section>
  );
}

function SyncView({
  online,
  queue,
  syncing,
  syncNow,
  snapshot,
  alerts,
  sloTargets,
  syncStrategy,
  setSyncStrategy,
  lastSyncReport,
  conflictItems,
  resolveConflict
}: {
  online: boolean;
  queue: ReturnType<typeof usePosStore>["syncQueue"];
  syncing: boolean;
  syncNow: () => Promise<void>;
  snapshot: ReturnType<typeof usePosStore>["observabilitySnapshot"];
  alerts: ReturnType<typeof usePosStore>["activeAlerts"];
  sloTargets: ReturnType<typeof usePosStore>["sloTargets"];
  syncStrategy: ReturnType<typeof usePosStore>["syncStrategy"];
  setSyncStrategy: ReturnType<typeof usePosStore>["setSyncStrategy"];
  lastSyncReport: ReturnType<typeof usePosStore>["lastSyncReport"];
  conflictItems: ReturnType<typeof usePosStore>["conflictItems"];
  resolveConflict: ReturnType<typeof usePosStore>["resolveConflict"];
}) {
  const pendingCount = queue.filter((item) => item.status === "pending").length;
  const conflictCount = queue.filter((item) => item.status === "conflict").length;
  const failedCount = queue.filter((item) => item.status === "failed").length;

  return (
    <section className="panel">
      <div className="sync-head">
        <div>
          <h2>Sync Online queue</h2>
          <p>
            {online ? "Network available." : "Offline. Local changes are queued."}
            {pendingCount > 0 && ` ${pendingCount} item(s) pending.`}
            {conflictCount > 0 && ` ${conflictCount} conflict(s) need resolution.`}
            {failedCount > 0 && ` ${failedCount} item(s) failed.`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, color: "#ccc" }}>
            Strategy
            <select
              value={syncStrategy}
              onChange={(e) => setSyncStrategy(e.target.value as typeof syncStrategy)}
              style={{ marginLeft: 4, padding: "4px 8px", background: "#1a1a2e", color: "#fff", border: "1px solid #444", borderRadius: 4 }}
            >
              <option value="lww">Last-Write-Wins</option>
              <option value="local-wins">Local Wins</option>
              <option value="remote-wins">Remote Wins</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <button className="primary" onClick={syncNow} disabled={syncing || queue.every((item) => item.status !== "pending")}>
            {syncing ? "Syncing..." : "Sync Online now"}
          </button>
        </div>
      </div>

      {lastSyncReport && (
        <div className="sync-report" style={{ marginBottom: 16, padding: 12, background: "#1a1a2e", borderRadius: 8, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <span style={{ color: "#4ade80" }}>Synced: {lastSyncReport.synced}</span>
          <span style={{ color: "#fbbf24" }}>Conflicts: {lastSyncReport.conflicts}</span>
          <span style={{ color: "#f87171" }}>Failed: {lastSyncReport.failures}</span>
          <span style={{ color: "#60a5fa" }}>Retries: {lastSyncReport.retries}</span>
          <span style={{ color: "#ccc" }}>Processed: {lastSyncReport.processed}</span>
        </div>
      )}

      {conflictItems.length > 0 && (
        <div className="conflict-resolution" style={{ marginBottom: 16 }}>
          <h3 style={{ color: "#fbbf24", marginBottom: 8 }}>Conflicts Requiring Resolution</h3>
          {conflictItems.map((item) => (
            <article key={item.id} style={{ padding: 12, background: "#2a1a1a", borderRadius: 8, marginBottom: 8, border: "1px solid #fbbf24" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <strong>{item.entity}</strong>
                <span style={{ fontSize: 12, color: "#888" }}>{item.operation} — v{item.entityVersion}</span>
              </div>
              {item.resolvedConflict && (
                <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>
                  Local v{item.resolvedConflict.localVersion} vs Remote v{item.resolvedConflict.remoteVersion}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => resolveConflict(item.id, "local-wins")}
                  style={{ padding: "4px 12px", background: "#22c55e", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                >
                  Keep Local
                </button>
                <button
                  onClick={() => resolveConflict(item.id, "remote-wins")}
                  style={{ padding: "4px 12px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                >
                  Use Remote
                </button>
                <button
                  onClick={() => resolveConflict(item.id, "merged")}
                  style={{ padding: "4px 12px", background: "#127E9D", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                >
                  Merge
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="sync-list">
        {queue.length === 0 ? <p className="empty">No queued changes yet.</p> : null}
        {queue.map((item) => (
          <article className="data-row" key={item.id}>
            <strong>{item.entity}</strong>
            <span>{item.operation}</span>
            <span className={`sync-${item.status}`}>
              {item.status}
              {item.status === "conflict" && " ⚠"}
            </span>
            <small>v{item.entityVersion}</small>
            <small>{new Date(item.createdAt).toLocaleString()}</small>
            {item.lastError && <small style={{ color: "#f87171" }}>{item.lastError}</small>}
          </article>
        ))}
      </div>
      <hr />
      <h3>Observability</h3>
      <div className="reports-grid">
        <article className="metric"><span>Sync Online lag</span><strong>{snapshot.syncLagSeconds}s</strong></article>
        <article className="metric"><span>Queue depth</span><strong>{snapshot.queueDepth}</strong></article>
        <article className="metric"><span>Failed mutations (15m)</span><strong>{snapshot.failedMutations15m}</strong></article>
        <article className="metric"><span>Payment failure rate (15m)</span><strong>{(snapshot.paymentFailureRate15m * 100).toFixed(1)}%</strong></article>
        <article className="metric"><span>Offline duration</span><strong>{snapshot.offlineDurationSeconds}s</strong></article>
        <article className="metric"><span>Order throughput</span><strong>{snapshot.orderThroughputPerHour}/hr</strong></article>
      </div>
      <p>
        SLOs: lag ≤{sloTargets.maxSyncLagSeconds}s, queue ≤{sloTargets.maxQueueDepth}, failed mutations ≤{sloTargets.maxFailedMutationsPer15m}/15m,
        payment failures ≤{(sloTargets.maxPaymentFailureRate * 100).toFixed(1)}%, offline ≤{sloTargets.maxOfflineDurationSeconds}s, throughput ≥
        {sloTargets.minOrdersPerHour}/hr.
      </p>
      <DataPanel title="Active alerts">
        {alerts.length === 0 ? <p className="empty">No active alerts.</p> : null}
        {alerts.map((alert) => (
          <article className="data-row" key={alert.id}>
            <strong>{alert.id}</strong>
            <span>{alert.severity}</span>
            <span>{alert.summary}</span>
            <a href={alert.runbook} target="_blank" rel="noreferrer">
              Runbook
            </a>
          </article>
        ))}
      </DataPanel>
    </section>
  );
}

function DataPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel data-panel">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
