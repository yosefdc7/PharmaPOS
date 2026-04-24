"use client";

import { FormEvent, useMemo, useState } from "react";
import { isLowStock, money } from "@/lib/calculations";
import { usePosStore } from "@/lib/use-pos-store";
import type { Category, Customer, PaymentMethod, Product, Settings, User } from "@/lib/types";

type ViewKey = "pos" | "products" | "categories" | "customers" | "users" | "settings" | "reports" | "sync";

const views: { key: ViewKey; label: string }[] = [
  { key: "pos", label: "POS" },
  { key: "products", label: "Products" },
  { key: "categories", label: "Categories" },
  { key: "customers", label: "Customers" },
  { key: "users", label: "Users" },
  { key: "settings", label: "Settings" },
  { key: "reports", label: "Reports" },
  { key: "sync", label: "Sync" }
];

function formatCurrency(symbol: string, value: number) {
  return `${symbol}${money(value).toFixed(2)}`;
}

function readForm(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
}

export function PosPrototype() {
  const store = usePosStore();
  const [view, setView] = useState<ViewKey>("pos");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentReceived, setPaymentReceived] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [holdReference, setHoldReference] = useState("");

  const settings = store.settings;
  const symbol = settings?.currencySymbol || "$";
  const pendingSync = store.syncQueue.filter((item) => item.status === "pending").length;

  const filteredProducts = useMemo(() => {
    const text = query.trim().toLowerCase();
    return store.products.filter((product) => {
      const matchesCategory = categoryFilter === "all" || product.categoryId === categoryFilter;
      const matchesText =
        !text ||
        product.name.toLowerCase().includes(text) ||
        product.barcode.toLowerCase().includes(text) ||
        product.supplier.toLowerCase().includes(text);
      return matchesCategory && matchesText;
    });
  }, [categoryFilter, query, store.products]);

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
          <h1>PharmaSpot Web POS</h1>
          <p>Choose a seeded demo user to enter the prototype.</p>
          <button onClick={() => store.login("admin")}>Enter as admin</button>
          <button onClick={() => store.login("cashier")}>Enter as cashier</button>
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
    await store.holdOrder(holdReference);
    setHoldReference("");
  }

  return (
    <main className="app-shell">
      <aside className="side-nav">
        <div className="brand">
          <span className="brand-mark">+</span>
          <div>
            <strong>{settings.store}</strong>
            <small>Offline-first prototype</small>
          </div>
        </div>
        <nav>
          {views.map((item) => (
            <button
              key={item.key}
              className={view === item.key ? "active" : ""}
              onClick={() => setView(item.key)}
            >
              {item.label}
              {item.key === "sync" && pendingSync > 0 ? <span>{pendingSync}</span> : null}
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>{views.find((item) => item.key === view)?.label}</h1>
            <p>{store.online ? "Online-ready" : "Offline mode"} with local IndexedDB writes</p>
          </div>
          <div className="topbar-actions">
            <label className="select-label">
              User
              <select value={store.currentUser.username} onChange={(event) => store.login(event.target.value)}>
                {store.users.map((user) => (
                  <option key={user.id} value={user.username}>
                    {user.fullname}
                  </option>
                ))}
              </select>
            </label>
            <button className={store.online ? "status online" : "status offline"} onClick={() => store.setForcedOffline(!store.forcedOffline)}>
              {store.online ? "Online" : "Offline"}
            </button>
          </div>
        </header>

        {view === "pos" ? (
          <section className="pos-grid">
            <section className="product-workspace panel">
              <div className="toolbar">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product, SKU, supplier" />
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option value="all">All categories</option>
                  {store.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
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
                    <strong>{product.name}</strong>
                    <small>{product.barcode}</small>
                    <span>{formatCurrency(symbol, product.price)}</span>
                    <em>{product.tracksStock ? `${product.quantity} in stock` : "Service"}</em>
                  </button>
                ))}
              </div>
            </section>

            <aside className="cart-panel panel">
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
              <div className="totals">
                <span>Items</span>
                <strong>{store.totals.itemCount}</strong>
                <span>Subtotal</span>
                <strong>{formatCurrency(symbol, store.totals.subtotal)}</strong>
                <span>Discount</span>
                <input value={store.discount} type="number" min="0" onChange={(event) => store.setDiscount(Number(event.target.value))} />
                <span>VAT</span>
                <strong>{formatCurrency(symbol, store.totals.tax)}</strong>
                <span>Total</span>
                <strong className="grand">{formatCurrency(symbol, store.totals.total)}</strong>
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
                    <button key={order.id} onClick={() => store.resumeHeldOrder(order)}>
                      {order.reference} - {order.items.length} lines
                    </button>
                  ))}
                </div>
              ) : null}
            </aside>
          </section>
        ) : null}

        {view === "products" ? (
          <ProductsView products={store.products} categories={store.categories} symbol={symbol} save={store.saveEntity} remove={store.removeEntity} />
        ) : null}
        {view === "categories" ? <CategoriesView categories={store.categories} save={store.saveEntity} remove={store.removeEntity} /> : null}
        {view === "customers" ? <CustomersView customers={store.customers} save={store.saveEntity} remove={store.removeEntity} /> : null}
        {view === "users" ? <UsersView users={store.users} save={store.saveEntity} remove={store.removeEntity} /> : null}
        {view === "settings" ? <SettingsView settings={settings} save={store.saveEntity} reset={store.resetData} /> : null}
        {view === "reports" ? (
          <ReportsView transactions={store.transactions} products={store.products} customers={store.customers} symbol={symbol} dailySales={dailySales} />
        ) : null}
        {view === "sync" ? (
          <SyncView
            online={store.online}
            queue={store.syncQueue}
            syncing={store.syncing}
            syncNow={store.syncNow}
            snapshot={store.observabilitySnapshot}
            alerts={store.activeAlerts}
            sloTargets={store.sloTargets}
          />
        ) : null}
      </section>

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
  remove
}: {
  products: Product[];
  categories: Category[];
  symbol: string;
  save: ReturnType<typeof usePosStore>["saveEntity"];
  remove: ReturnType<typeof usePosStore>["removeEntity"];
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = readForm(event.currentTarget);
    const product: Product = {
      id: crypto.randomUUID(),
      name: data.name,
      barcode: data.barcode || String(Date.now()).slice(-6),
      categoryId: data.categoryId,
      supplier: data.supplier,
      price: Number(data.price),
      quantity: Number(data.quantity),
      minStock: Number(data.minStock),
      tracksStock: data.tracksStock === "on",
      expirationDate: data.expirationDate || "N/A",
      imageColor: "#e0f2fe"
    };
    await save("products", product, "product");
    event.currentTarget.reset();
  }

  return (
    <section className="admin-layout">
      <form className="panel form-grid" onSubmit={submit}>
        <h2>Add product</h2>
        <input name="name" required placeholder="Name" />
        <input name="barcode" placeholder="Barcode" />
        <select name="categoryId" required>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <input name="supplier" placeholder="Supplier" />
        <input name="price" required type="number" step="0.01" placeholder="Price" />
        <input name="quantity" required type="number" placeholder="Quantity" />
        <input name="minStock" required type="number" placeholder="Min stock" />
        <input name="expirationDate" placeholder="Expiry date" />
        <label className="check">
          <input name="tracksStock" type="checkbox" defaultChecked /> Track stock
        </label>
        <button className="primary">Save product</button>
      </form>
      <DataPanel title="Products">
        {products.map((product) => (
          <article className="data-row" key={product.id}>
            <strong>{product.name}</strong>
            <span>{formatCurrency(symbol, product.price)}</span>
            <span>{product.tracksStock ? `${product.quantity} stock` : "Service"}</span>
            <button onClick={() => save("products", { ...product, quantity: product.quantity + 5 }, "product")}>Restock +5</button>
            <button className="danger" onClick={() => remove("products", product.id, "product")}>Delete</button>
          </article>
        ))}
      </DataPanel>
    </section>
  );
}

function CategoriesView({
  categories,
  save,
  remove
}: {
  categories: Category[];
  save: ReturnType<typeof usePosStore>["saveEntity"];
  remove: ReturnType<typeof usePosStore>["removeEntity"];
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = readForm(event.currentTarget);
    await save("categories", { id: crypto.randomUUID(), name: data.name }, "category");
    event.currentTarget.reset();
  }

  return (
    <section className="admin-layout">
      <form className="panel form-grid" onSubmit={submit}>
        <h2>Add category</h2>
        <input name="name" required placeholder="Category name" />
        <button className="primary">Save category</button>
      </form>
      <DataPanel title="Categories">
        {categories.map((category) => (
          <article className="data-row" key={category.id}>
            <strong>{category.name}</strong>
            <button onClick={() => save("categories", { ...category, name: `${category.name}*` }, "category")}>Mark edited</button>
            <button className="danger" onClick={() => remove("categories", category.id, "category")}>Delete</button>
          </article>
        ))}
      </DataPanel>
    </section>
  );
}

function CustomersView({
  customers,
  save,
  remove
}: {
  customers: Customer[];
  save: ReturnType<typeof usePosStore>["saveEntity"];
  remove: ReturnType<typeof usePosStore>["removeEntity"];
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = readForm(event.currentTarget);
    await save("customers", { id: crypto.randomUUID(), name: data.name, phone: data.phone, email: data.email }, "customer");
    event.currentTarget.reset();
  }

  return (
    <section className="admin-layout">
      <form className="panel form-grid" onSubmit={submit}>
        <h2>Add customer</h2>
        <input name="name" required placeholder="Name" />
        <input name="phone" placeholder="Phone" />
        <input name="email" placeholder="Email" />
        <button className="primary">Save customer</button>
      </form>
      <DataPanel title="Customers">
        {customers.map((customer) => (
          <article className="data-row" key={customer.id}>
            <strong>{customer.name}</strong>
            <span>{customer.phone || "No phone"}</span>
            <span>{customer.email || "No email"}</span>
            {customer.id !== "walk-in" ? (
              <button className="danger" onClick={() => remove("customers", customer.id, "customer")}>Delete</button>
            ) : null}
          </article>
        ))}
      </DataPanel>
    </section>
  );
}

function UsersView({
  users,
  save,
  remove
}: {
  users: User[];
  save: ReturnType<typeof usePosStore>["saveEntity"];
  remove: ReturnType<typeof usePosStore>["removeEntity"];
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = readForm(event.currentTarget);
    const admin = data.role === "admin";
    await save(
      "users",
      {
        id: crypto.randomUUID(),
        username: data.username,
        fullname: data.fullname,
        role: admin ? "admin" : "cashier",
        permissions: {
          products: admin,
          categories: admin,
          transactions: true,
          users: admin,
          settings: admin
        }
      },
      "user"
    );
    event.currentTarget.reset();
  }

  return (
    <section className="admin-layout">
      <form className="panel form-grid" onSubmit={submit}>
        <h2>Add user</h2>
        <input name="username" required placeholder="Username" />
        <input name="fullname" required placeholder="Full name" />
        <select name="role">
          <option value="cashier">Cashier</option>
          <option value="admin">Admin</option>
        </select>
        <button className="primary">Save user</button>
      </form>
      <DataPanel title="Users">
        {users.map((user) => (
          <article className="data-row" key={user.id}>
            <strong>{user.fullname}</strong>
            <span>{user.username}</span>
            <span>{user.role}</span>
            {user.id !== "usr-admin" ? <button className="danger" onClick={() => remove("users", user.id, "user")}>Delete</button> : null}
          </article>
        ))}
      </DataPanel>
    </section>
  );
}

function SettingsView({
  settings,
  save,
  reset
}: {
  settings: Settings;
  save: ReturnType<typeof usePosStore>["saveEntity"];
  reset: ReturnType<typeof usePosStore>["resetData"];
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = readForm(event.currentTarget);
    await save(
      "settings",
      {
        id: "store",
        store: data.store,
        addressOne: data.addressOne,
        addressTwo: data.addressTwo,
        contact: data.contact,
        currencySymbol: data.currencySymbol,
        vatPercentage: Number(data.vatPercentage),
        chargeTax: data.chargeTax === "on",
        quickBilling: data.quickBilling === "on",
        receiptFooter: data.receiptFooter
      },
      "settings"
    );
  }

  return (
    <section className="panel settings-panel">
      <form className="form-grid" onSubmit={submit}>
        <h2>Store settings</h2>
        <input name="store" defaultValue={settings.store} />
        <input name="addressOne" defaultValue={settings.addressOne} />
        <input name="addressTwo" defaultValue={settings.addressTwo} />
        <input name="contact" defaultValue={settings.contact} />
        <input name="currencySymbol" defaultValue={settings.currencySymbol} maxLength={3} />
        <input name="vatPercentage" type="number" defaultValue={settings.vatPercentage} />
        <label className="check"><input name="chargeTax" type="checkbox" defaultChecked={settings.chargeTax} /> Charge VAT</label>
        <label className="check"><input name="quickBilling" type="checkbox" defaultChecked={settings.quickBilling} /> Quick billing</label>
        <textarea name="receiptFooter" defaultValue={settings.receiptFooter} />
        <button className="primary">Save settings</button>
        <button type="button" onClick={reset}>Reset seeded prototype data</button>
      </form>
    </section>
  );
}

function ReportsView({
  transactions,
  products,
  customers,
  symbol,
  dailySales
}: {
  transactions: ReturnType<typeof usePosStore>["transactions"];
  products: Product[];
  customers: Customer[];
  symbol: string;
  dailySales: ReturnType<typeof usePosStore>["transactions"];
}) {
  const totalSales = transactions.reduce((sum, transaction) => sum + transaction.total, 0);
  const lowStock = products.filter(isLowStock);

  return (
    <section className="reports-grid">
      <DataPanel title="Summary">
        <article className="metric"><span>Total sales</span><strong>{formatCurrency(symbol, totalSales)}</strong></article>
        <article className="metric"><span>Transactions</span><strong>{transactions.length}</strong></article>
        <article className="metric"><span>Today</span><strong>{formatCurrency(symbol, dailySales.reduce((sum, sale) => sum + sale.total, 0))}</strong></article>
        <article className="metric"><span>Customers</span><strong>{customers.length}</strong></article>
      </DataPanel>
      <DataPanel title="Low stock">
        {lowStock.map((product) => (
          <article className="data-row" key={product.id}>
            <strong>{product.name}</strong>
            <span>{product.quantity} left</span>
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
  );
}

function SyncView({
  online,
  queue,
  syncing,
  syncNow,
  snapshot,
  alerts,
  sloTargets
}: {
  online: boolean;
  queue: ReturnType<typeof usePosStore>["syncQueue"];
  syncing: boolean;
  syncNow: () => Promise<void>;
  snapshot: ReturnType<typeof usePosStore>["observabilitySnapshot"];
  alerts: ReturnType<typeof usePosStore>["activeAlerts"];
  sloTargets: ReturnType<typeof usePosStore>["sloTargets"];
}) {
  return (
    <section className="panel">
      <div className="sync-head">
        <div>
          <h2>Sync queue</h2>
          <p>{online ? "Network available. Sync is simulated for this prototype." : "Offline. Local changes are queued."}</p>
        </div>
        <button className="primary" onClick={syncNow} disabled={syncing || queue.every((item) => item.status !== "pending")}>
          {syncing ? "Syncing..." : "Sync now"}
        </button>
      </div>
      <div className="sync-list">
        {queue.length === 0 ? <p className="empty">No queued changes yet.</p> : null}
        {queue.map((item) => (
          <article className="data-row" key={item.id}>
            <strong>{item.entity}</strong>
            <span>{item.operation}</span>
            <span className={`sync-${item.status}`}>{item.status}</span>
            <small>{new Date(item.createdAt).toLocaleString()}</small>
          </article>
        ))}
      </div>
      <hr />
      <h3>Observability</h3>
      <div className="reports-grid">
        <article className="metric"><span>Sync lag</span><strong>{snapshot.syncLagSeconds}s</strong></article>
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
