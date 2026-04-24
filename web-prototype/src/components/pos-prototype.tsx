"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { isLowStock, money } from "@/lib/calculations";
import { usePosStore } from "@/lib/use-pos-store";
import type { Category, Customer, PaymentMethod, Product, Settings, User } from "@/lib/types";

type ViewKey = "pos" | "products" | "customers" | "settings" | "reports" | "sync";
type ProductSortKey = "recent" | "newest" | "oldest" | "top-sold";

const views: { key: ViewKey; label: string }[] = [
  { key: "pos", label: "POS" },
  { key: "products", label: "Products" },
  { key: "customers", label: "Customers" },
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

function buildProductDraft(overrides?: Partial<Product>): Product {
  return {
    id: overrides?.id || crypto.randomUUID(),
    name: overrides?.name || "",
    barcode: overrides?.barcode || String(Date.now()).slice(-6),
    categoryId: overrides?.categoryId || "",
    supplier: overrides?.supplier || "",
    price: overrides?.price ?? 0,
    originalPrice: overrides?.originalPrice,
    quantity: overrides?.quantity ?? 0,
    minStock: overrides?.minStock ?? 0,
    tracksStock: overrides?.tracksStock ?? true,
    expirationDate: overrides?.expirationDate || "N/A",
    imageColor: overrides?.imageColor || "#4379FF",
    featured: overrides?.featured ?? false
  };
}

export function PosPrototype() {
  const store = usePosStore();
  const [view, setView] = useState<ViewKey>("pos");
  const [navOpen, setNavOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [productSort, setProductSort] = useState<ProductSortKey>("recent");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentReceived, setPaymentReceived] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [holdReference, setHoldReference] = useState("");

  const settings = store.settings;
  const symbol = settings?.currencySymbol || "$";
  const pendingSync = store.syncQueue.filter((item) => item.status === "pending").length;

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

  function setViewAndMaybeCloseNav(nextView: ViewKey) {
    setView(nextView);
    if (window.matchMedia("(max-width: 760px)").matches) {
      setNavOpen(false);
    }
  }

  return (
    <main className={`app-shell ${navOpen ? "nav-open" : "nav-closed"}`}>
      <aside className={`side-nav ${navOpen ? "open" : "closed"}`}>
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
              onClick={() => setViewAndMaybeCloseNav(item.key)}
            >
              {item.label}
              {item.key === "sync" && pendingSync > 0 ? <span>{pendingSync}</span> : null}
            </button>
          ))}
        </nav>
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
              {navOpen ? "‹" : "›"}
            </button>
            <div>
              <h1>{views.find((item) => item.key === view)?.label}</h1>
              <p>{store.online ? "Online-ready" : "Offline mode"} with local IndexedDB writes</p>
            </div>
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
                <select value={productSort} onChange={(event) => setProductSort(event.target.value as ProductSortKey)}>
                  <option value="recent">Recent</option>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="top-sold">Top sold</option>
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
                    <div className="product-body">
                      <strong className="product-name">{product.name}</strong>
                      <div className="product-meta">
                        <div className="product-copy">
                          <span className="product-sku">SKU {product.barcode}</span>
                          <span className="product-stock">{product.tracksStock ? `${product.quantity} in stock` : "Service"}</span>
                        </div>
                        <div className="product-pricing">
                          <span className="product-price">{formatCurrency(symbol, product.price)}</span>
                        </div>
                      </div>
                    </div>
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
        {view === "customers" ? <CustomersView customers={store.customers} save={store.saveEntity} remove={store.removeEntity} /> : null}
        {view === "settings" ? (
          <SettingsView
            settings={settings}
            categories={store.categories}
            users={store.users}
            save={store.saveEntity}
            remove={store.removeEntity}
            reset={store.resetData}
          />
        ) : null}
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
  const [query, setQuery] = useState("");
  const [filterKey, setFilterKey] = useState<"all" | "category" | "supplier" | "barcode" | "stock">("all");
  const [filterValue, setFilterValue] = useState("");
  const [page, setPage] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Product>(() => buildProductDraft({ categoryId: categories[0]?.id || "" }));

  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  const filteredProducts = useMemo(() => {
    const text = query.trim().toLowerCase();
    return products.filter((product) => {
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

      return true;
    });
  }, [categoryMap, filterKey, filterValue, products, query]);

  const pageSize = 11;
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [filterKey, filterValue, query]);

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
    await save(
      "products",
      {
        ...draft,
        barcode: draft.barcode || String(Date.now()).slice(-6),
        expirationDate: draft.expirationDate || "N/A"
      },
      "product"
    );
    closeEditor();
  }

  async function toggleFeatured(product: Product) {
    await save("products", { ...product, featured: !product.featured }, "product");
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
              setFilterKey(event.target.value as "all" | "category" | "supplier" | "barcode" | "stock");
              setFilterValue("");
            }}
          >
            <option value="all">All</option>
            <option value="category">Category</option>
            <option value="supplier">Supplier</option>
            <option value="barcode">Barcode</option>
            <option value="stock">Stock status</option>
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
          {filterKey !== "category" && filterKey !== "stock" ? (
            <input
              aria-label="Value"
              value={filterValue}
              onChange={(event) => setFilterValue(event.target.value)}
              placeholder={filterKey === "all" ? "Any value" : `Filter by ${filterKey}`}
            />
          ) : null}
        </label>
      </div>

      <div className="products-table" role="table" aria-label="Products table">
        <div className="products-table-head" role="row">
          <span>Title</span>
          <span>Price</span>
          <span>Quantity</span>
          <span>Category</span>
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
                </div>
                <div className="product-cell product-price-cell">
                  {typeof product.originalPrice === "number" && product.originalPrice > product.price ? (
                    <span className="price-original">{formatCurrency(symbol, product.originalPrice)}</span>
                  ) : null}
                  <strong>{formatCurrency(symbol, product.price)}</strong>
                </div>
                <div className="product-cell">
                  {product.tracksStock ? (
                    <span className={isLowStock(product) ? "quantity-low" : "quantity-ok"}>{product.quantity}</span>
                  ) : (
                    <span className="quantity-service">Service</span>
                  )}
                </div>
                <div className="product-cell">
                  <span>{categoryName}</span>
                </div>
                <div className="product-actions">
                  <button
                    type="button"
                    className={`icon-button ${product.featured ? "active" : ""}`}
                    aria-label={`Toggle featured for ${product.name}`}
                    onClick={() => toggleFeatured(product)}
                  >
                    ★
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Edit product ${product.name}`}
                    onClick={() => openEditForm(product)}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`Delete product ${product.name}`}
                    onClick={() => remove("products", product.id, "product")}
                  >
                    🗑
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
              <button type="button" onClick={closeEditor}>
                Close
              </button>
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
                <input value={draft.expirationDate} onChange={(event) => updateDraft("expirationDate", event.target.value)} />
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

function SettingsView({
  settings,
  categories,
  users,
  save,
  remove,
  reset
}: {
  settings: Settings;
  categories: Category[];
  users: User[];
  save: ReturnType<typeof usePosStore>["saveEntity"];
  remove: ReturnType<typeof usePosStore>["removeEntity"];
  reset: ReturnType<typeof usePosStore>["resetData"];
}) {
  async function submitSettings(event: FormEvent<HTMLFormElement>) {
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

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = readForm(event.currentTarget);
    await save("categories", { id: crypto.randomUUID(), name: data.name }, "category");
    event.currentTarget.reset();
  }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
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
    <section className="settings-page">
      <section className="panel settings-panel">
        <form className="form-grid" onSubmit={submitSettings}>
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

      <section className="settings-subgrid">
        <form className="panel form-grid" onSubmit={submitCategory}>
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

      <section className="settings-subgrid">
        <form className="panel form-grid" onSubmit={submitUser}>
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
