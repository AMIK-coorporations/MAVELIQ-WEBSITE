/* ==========================================================================
   MAVELIQ — js/admin.js
   Maveliq Store Administration.

   Loaded ONLY by pages under /admin. Provides:
     • auth gate + login screen (backend authentication in production, a
       labelled demo gate otherwise — hiding a page is never security)
     • shared shell: sidebar, topbar, mobile drawer
     • page logic keyed off <body data-admin="...">
         dashboard | products | categories | orders | inventory | settings

   All writes go through the services, which talk to the backend when it is
   configured and fall back to local demo storage otherwise.
   ========================================================================== */

import { CONFIG } from "./config.js";
import { $, $$, formatPrice, escapeHtml, escapeAttr, formatDateTime, timeAgo, toast, uid, slugify, debounce } from "./utils.js";
import settings from "./services/settings-service.js";
import productsService from "./services/product-service.js";
import ordersService from "./services/order-service.js";
import auth from "./services/auth-service.js";

/* ---------- Icons --------------------------------------------------------- */

const I = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  products: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="M12 12 3 7M12 12l9-5M12 12v10"/></svg>',
  categories: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  orders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  inventory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20 7 12 3 4 7v10l8 4 8-4z"/><path d="M4 7l8 4 8-4M12 11v10"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  storefront: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 9 4.5 4h15L21 9M3 9h18M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-5M12 8h.01"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
};

/* ---------- Shell ----------------------------------------------------------- */

const NAV = [
  { key: "dashboard", label: "Dashboard", href: "index.html", icon: "dashboard" },
  { key: "products", label: "Products", href: "products.html", icon: "products" },
  { key: "categories", label: "Categories", href: "categories.html", icon: "categories" },
  { key: "orders", label: "Orders", href: "orders.html", icon: "orders" },
  { key: "inventory", label: "Inventory", href: "inventory.html", icon: "inventory" },
  { key: "settings", label: "Settings", href: "settings.html", icon: "settings" },
];

function shellMarkup(active) {
  const user = auth.user;
  return `
  <aside class="admin-side" id="adminSide">
    <div class="admin-side__brand">
      <span class="brand__mark">${escapeHtml(settings.businessName)}</span>
      <small>Store Administration</small>
    </div>
    <nav class="admin-nav" aria-label="Admin">
      <span class="admin-nav__label">Manage</span>
      ${NAV.map((n) => `
        <a href="${n.href}" class="${n.key === active ? "is-active" : ""}">
          ${I[n.icon]}<span>${n.label}</span>
          ${n.key === "orders" ? '<span class="pill" id="pendingPill" hidden>0</span>' : ""}
        </a>`).join("")}
    </nav>
    <div class="admin-side__foot">
      <a href="../index.html" target="_blank" rel="noopener">${I.storefront}<span style="margin-left:8px">View storefront</span></a>
      <a href="#" id="adminLogout">${I.logout}<span style="margin-left:8px">Sign out</span></a>
    </div>
  </aside>

  <div class="admin-main">
    <header class="admin-topbar">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="icon-btn admin-menu-toggle" id="adminMenuToggle" type="button" aria-label="Open admin menu">${I.menu}</button>
        <h1>${escapeHtml(pageTitle(active))}</h1>
      </div>
      <div class="admin-topbar__right">
        ${auth.isDemoMode ? '<span class="badge badge--demo">Demo mode</span>' : ""}
        <span class="admin-user">
          <span class="admin-user__avatar">${escapeHtml((user?.email || "A").charAt(0).toUpperCase())}</span>
          <span>${escapeHtml(user?.label || user?.email || "Administrator")}</span>
        </span>
      </div>
    </header>
    <div class="admin-body" id="adminBody"></div>
  </div>`;
}

function pageTitle(active) {
  return NAV.find((n) => n.key === active)?.label || "Dashboard";
}

function wireShell(active) {
  const toggle = $("#adminMenuToggle");
  const side = $("#adminSide");
  toggle?.addEventListener("click", () => side?.classList.toggle("is-open"));
  document.addEventListener("click", (e) => {
    if (side?.classList.contains("is-open") && !side.contains(e.target) && e.target !== toggle && !toggle?.contains(e.target)) {
      side.classList.remove("is-open");
    }
  });

  $("#adminLogout")?.addEventListener("click", async (e) => {
    e.preventDefault();
    await auth.signOut();
    toast("Signed out.", "info");
    window.location.href = "index.html";
  });

  // Pending-order badge on the Orders nav item
  ordersService
    .listOrders({ status: "pending" })
    .then((list) => {
      const pill = $("#pendingPill");
      if (pill && list.length) {
        pill.textContent = String(list.length);
        pill.hidden = false;
      }
    })
    .catch(() => {});
}

/* ---------- Login screen ------------------------------------------------------ */

function renderLogin(redirect) {
  document.title = `Sign in | ${CONFIG.admin.title}`;
  document.body.innerHTML = `
  <div class="admin-login">
    <div class="admin-login__aside">
      <span class="brand__mark">${escapeHtml(settings.businessName)}</span>
      <p>Sign in to manage products, categories, orders, inventory and store settings.</p>
    </div>
    <div class="admin-login__panel">
      <div class="admin-login__box">
        <h1>Sign in</h1>
        <p>${auth.isDemoMode ? "Demo mode — use the local demo credentials below." : "Use your administrator account."}</p>

        <div id="loginAlert"></div>

        <form id="loginForm" novalidate>
          <div class="field">
            <label for="loginEmail">Email</label>
            <input class="input" id="loginEmail" name="email" type="email" autocomplete="username" required value="${auth.isDemoMode ? "admin@maveliq.local" : ""}" />
            <span class="field-error" aria-live="polite"></span>
          </div>
          <div class="field">
            <label for="loginPassword">Password</label>
            <input class="input" id="loginPassword" name="password" type="password" autocomplete="current-password" required value="${auth.isDemoMode ? "maveliq-demo" : ""}" />
            <span class="field-error" aria-live="polite"></span>
          </div>
          <button class="btn btn--primary btn--block btn--lg" type="submit" id="loginBtn">Sign in</button>
        </form>

        ${
          auth.isDemoMode
            ? `<div class="alert alert--info" style="margin-top:20px">
                ${I.info}
                <div>
                  <strong>This is a demo sign-in gate, not real security</strong>
                  <p>It exists only to preview the dashboard. Only authenticated, authorized administrators may access this dashboard and perform administrative actions. All sensitive changes must be validated by trusted backend logic. See README → "Security model".</p>
                </div>
              </div>`
            : ""
        }

        <p class="price-note" style="margin-top:20px"><a href="../index.html">← Back to storefront</a></p>
      </div>
    </div>
  </div>`;

  const form = $("#loginForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#loginBtn");
    const email = form.email.value.trim();
    const pass = form.password.value;

    // clear old errors
    $$(".field-error", form).forEach((s) => (s.textContent = ""));
    $$(".is-invalid", form).forEach((i) => i.classList.remove("is-invalid"));

    if (!email || !pass) {
      if (!email) { form.email.classList.add("is-invalid"); form.email.closest(".field").querySelector(".field-error").textContent = "This field is required."; }
      if (!pass) { form.password.classList.add("is-invalid"); form.password.closest(".field").querySelector(".field-error").textContent = "This field is required."; }
      return;
    }

    btn.classList.add("is-loading");
    btn.setAttribute("disabled", "");
    try {
      await auth.signIn(email, pass);
      toast("Welcome back.", "success");
      window.location.href = redirect || "index.html";
    } catch (err) {
      const alertBox = $("#loginAlert");
      if (alertBox) {
        alertBox.innerHTML = `
          <div class="alert alert--danger">
            ${I.info}
            <div><strong>Sign-in failed</strong><p>${escapeHtml(err.message || "Check your email and password.")}</p></div>
          </div>`;
      } else {
        toast(err.message || "Sign-in failed.", "error");
      }
    } finally {
      btn.classList.remove("is-loading");
      btn.removeAttribute("disabled");
    }
  });
}

/* ---------- Shared UI helpers ---------------------------------------------------- */

function emptyState(title, body, actionHtml = "") {
  return `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
      ${actionHtml}
    </div>`;
}

function confirmDialog(message) {
  return window.confirm(message);
}

/* ==========================================================================
   DASHBOARD
   ========================================================================== */

async function renderDashboard(body) {
  body.innerHTML = `<div class="stat-cards">${Array.from({ length: 6 }, () => '<div class="skeleton" style="height:96px"></div>').join("")}</div>
    <div class="admin-grid-2"><div class="skeleton" style="height:260px"></div><div class="skeleton" style="height:260px"></div></div>`;

  const [stats, catalogue] = await Promise.all([
    ordersService.stats(),
    productsService.getProducts({ includeInactive: true }),
  ]);

  const lowStock = catalogue.filter((p) => p.active && p.stock <= (p.lowStockThreshold || 5));
  const revenue = stats.sales;
  const recent = stats.orders.slice(0, 6);

  body.innerHTML = `
    ${auth.isDemoMode ? `
      <div class="alert alert--info">
        ${I.info}
        <div><strong>Demo dashboard</strong><p>Figures below are computed from orders placed in this browser. Connect the backend to see live data.</p></div>
      </div>` : ""}

    <div style="margin-bottom:20px">
      <h2 style="margin:0 0 4px">Maveliq Store Dashboard</h2>
      <p class="price-note" style="margin:0">Manage products, categories, inventory, orders, and store settings from one place.</p>
    </div>

    <div class="stat-cards">
      <div class="stat-card">
        <span class="stat-card__label">${I.orders} Total Orders</span>
        <span class="stat-card__value">${stats.totalOrders}</span>
        <span class="stat-card__delta">All recorded orders</span>
      </div>
      <div class="stat-card">
        <span class="stat-card__label">${I.orders} Pending Orders</span>
        <span class="stat-card__value">${stats.pending}</span>
        <span class="stat-card__delta">Awaiting confirmation</span>
      </div>
      <div class="stat-card">
        <span class="stat-card__label">${I.info} Completed Orders</span>
        <span class="stat-card__value">${stats.delivered}</span>
        <span class="stat-card__delta">Marked delivered</span>
      </div>
      <div class="stat-card">
        <span class="stat-card__label">${I.products} Current Products</span>
        <span class="stat-card__value">${catalogue.length}</span>
        <span class="stat-card__delta">${catalogue.filter((p) => p.active).length} published</span>
      </div>
      <div class="stat-card">
        <span class="stat-card__label">${I.inventory} Low-Stock Products</span>
        <span class="stat-card__value">${lowStock.length}</span>
        <span class="stat-card__delta ${lowStock.length ? "down" : ""}">${lowStock.length ? "Needs attention" : "All healthy"}</span>
      </div>
      <div class="stat-card">
        <span class="stat-card__label">${I.dashboard} Sales Summary</span>
        <span class="stat-card__value">${formatPrice(revenue)}</span>
        <span class="stat-card__delta">Excludes cancelled orders</span>
      </div>
    </div>

    <div class="admin-grid-2">
      <section class="admin-panel">
        <div class="admin-panel__head">
          <h2>Recent orders</h2>
          <a class="btn btn--outline btn--sm" href="orders.html">View all</a>
        </div>
        <div class="admin-panel__body admin-panel__body--flush">
          ${
            recent.length
              ? `<div class="table-wrap" style="border:0">
                  <table class="table">
                    <thead><tr><th>Reference</th><th>Customer</th><th>Total</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      ${recent
                        .map(
                          (o) => `
                        <tr>
                          <td><strong>${escapeHtml(o.reference)}</strong><div class="price-note">${timeAgo(o.createdAt)}</div></td>
                          <td>${escapeHtml(o.customer.fullName)}<div class="price-note">${escapeHtml(o.customer.phone)}</div></td>
                          <td>${formatPrice(o.total)}</td>
                          <td><span class="status status--${escapeAttr(o.status)}">${escapeHtml(o.status)}</span></td>
                          <td style="text-align:right"><a class="btn btn--outline btn--sm" href="orders.html?ref=${encodeURIComponent(o.reference)}">Open</a></td>
                        </tr>`
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>`
              : `<div class="admin-panel__body">${emptyState("No orders yet", "Orders placed through the storefront will appear here.", '<a class="btn btn--primary" href="../shop.html">Visit storefront</a>')}</div>`
          }
        </div>
      </section>

      <section class="admin-panel">
        <div class="admin-panel__head">
          <h2>Low stock alerts</h2>
          <a class="btn btn--outline btn--sm" href="inventory.html">Manage</a>
        </div>
        <div class="admin-panel__body admin-panel__body--flush">
          ${
            lowStock.length
              ? `<div class="table-wrap" style="border:0">
                  <table class="table">
                    <thead><tr><th>Product</th><th>Stock</th></tr></thead>
                    <tbody>
                      ${lowStock
                        .map(
                          (p) => `
                        <tr>
                          <td style="display:flex;gap:10px;align-items:center">
                            <img src="${escapeAttr(p.images[0] || "assets/images/ph-other-1.svg")}" alt="" class="thumb-sm" loading="lazy" />
                            <span>${escapeHtml(p.name)}<div class="price-note">${escapeHtml(p.sku || p.id)}</div></span>
                          </td>
                          <td>${p.stock <= 0 ? '<span class="badge badge--out">Out</span>' : `<span class="badge badge--low">${p.stock} left</span>`}</td>
                        </tr>`
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>`
              : `<div class="admin-panel__body">${emptyState("Stock levels look healthy", "No product is at or below its low-stock threshold.")}</div>`
          }
        </div>
      </section>
    </div>

    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>Best sellers <span class="price-note" style="font-weight:400">(from real orders)</span></h2>
      </div>
      <div class="admin-panel__body admin-panel__body--flush">
        ${
          stats.bestSellers.length
            ? `<div class="table-wrap" style="border:0">
                <table class="table">
                  <thead><tr><th>Product</th><th>Units sold</th><th>Revenue</th></tr></thead>
                  <tbody>
                    ${stats.bestSellers
                      .slice(0, 8)
                      .map(
                        (b) => `
                      <tr>
                        <td>${escapeHtml(b.name)}</td>
                        <td>${b.quantity}</td>
                        <td>${formatPrice(b.revenue)}</td>
                      </tr>`
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>`
            : `<div class="admin-panel__body">${emptyState("No sales data yet", "Best sellers are calculated from genuine order history — nothing is invented.")}</div>`
        }
      </div>
    </section>`;
}

/* ==========================================================================
   PRODUCTS
   ========================================================================== */

async function renderProducts(body) {
  body.innerHTML = `
    <div class="admin-note" style="margin-bottom:16px">${I.info}<span>${
      auth.isDemoMode
        ? "Demo mode: edits are saved in this browser only. With the backend connected, changes write to the live database."
        : "Changes are written to the live database and appear on the storefront immediately."
    }</span></div>
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>Manage Products</h2>
        <div class="admin-toolbar">
          <div class="search-field">
            ${I.search}
            <input class="input" id="prodSearch" type="search" placeholder="Search products…" />
          </div>
          <button class="btn btn--primary btn--sm" id="addProductBtn" type="button">${I.plus} Add Product</button>
        </div>
      </div>
      <div class="admin-panel__body admin-panel__body--flush" id="productsTableWrap">
        <div class="admin-panel__body"><div class="skeleton" style="height:240px"></div></div>
      </div>
    </section>
    <div id="productFormHost"></div>`;

  let list = await productsService.getProducts({ includeInactive: true });
  const cats = await productsService.getCategories({ includeInactive: true });
  const catName = (id) => cats.find((c) => c.id === id)?.name || "—";

  const draw = (rows) => {
    const wrap = $("#productsTableWrap");
    if (!rows.length) {
      wrap.innerHTML = `<div class="admin-panel__body">${emptyState("No products found", "Add your first product or adjust your search.")}</div>`;
      return;
    }
    wrap.innerHTML = `
      <div class="table-wrap" style="border:0">
        <table class="table">
          <thead>
            <tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th style="text-align:right">Actions</th></tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (p) => `
              <tr data-id="${escapeAttr(p.id)}">
                <td>
                  <div style="display:flex;gap:10px;align-items:center">
                    <img src="${escapeAttr(p.images[0] || "assets/images/ph-other-1.svg")}" alt="" class="thumb-sm" loading="lazy" />
                    <span><strong>${escapeHtml(p.name)}</strong><div class="price-note">${escapeHtml(p.sku || p.id)}</div></span>
                  </div>
                </td>
                <td>${escapeHtml(catName(p.categoryId))}</td>
                <td>${formatPrice(p.price)}${p.compareAtPrice ? `<div class="price-note"><s>${formatPrice(p.compareAtPrice)}</s></div>` : ""}</td>
                <td>${p.stock <= 0 ? '<span class="badge badge--out">0</span>' : p.stock <= (p.lowStockThreshold || 5) ? `<span class="badge badge--low">${p.stock}</span>` : p.stock}</td>
                <td><span class="badge ${p.active ? "badge--instock" : "badge--out"}">${p.active ? "Published" : "Draft"}</span></td>
                <td>
                  <div class="row-actions">
                    <button class="icon-btn" type="button" data-toggle-active title="${p.active ? "Unpublish Product" : "Publish Product"}">${p.active ? I.close : I.plus}</button>
                    <button class="icon-btn" type="button" data-edit title="Edit Product">${I.edit}</button>
                    <button class="icon-btn danger" type="button" data-delete title="Delete Product">${I.trash}</button>
                  </div>
                </td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  };

  draw(list.filter((p) => p.active));

  $("#prodSearch")?.addEventListener(
    "input",
    debounce((e) => {
      const term = e.target.value.trim().toLowerCase();
      draw(
        list.filter((p) => !term || p.name.toLowerCase().includes(term) || (p.sku || "").toLowerCase().includes(term) || p.id.toLowerCase().includes(term))
      );
    }, 220)
  );

  $("#addProductBtn")?.addEventListener("click", () => openProductForm(null, cats, async (record) => {
    await productsService.saveProduct(record);
    list = await productsService.getProducts({ includeInactive: true });
    draw(list.filter((p) => p.active));
    toast("Product saved.", "success");
  }));

  $("#productsTableWrap")?.addEventListener("click", async (e) => {
    const row = e.target.closest("tr[data-id]");
    if (!row) return;
    const id = row.dataset.id;
    const product = list.find((p) => p.id === id);
    if (!product) return;

    if (e.target.closest("[data-edit]")) {
      openProductForm(product, cats, async (record) => {
        await productsService.saveProduct(record);
        list = await productsService.getProducts({ includeInactive: true });
        draw(list.filter((p) => p.active));
        toast("Product updated.", "success");
      });
      return;
    }

    if (e.target.closest("[data-toggle-active]")) {
      await productsService.saveProduct({ ...product, active: !product.active });
      list = await productsService.getProducts({ includeInactive: true });
      draw(list.filter((p) => p.active));
      toast(product.active ? "Product unpublished." : "Product published.", "success");
      return;
    }

    if (e.target.closest("[data-delete]")) {
      if (!confirmDialog(`Delete "${product.name}"? This cannot be undone.`)) return;
      await productsService.deleteProduct(product.id);
      list = await productsService.getProducts({ includeInactive: true });
      draw(list.filter((p) => p.active));
      toast("Product deleted.", "info");
    }
  });
}

/** Slide-in product form. */
function openProductForm(product, cats, onSave) {
  const host = $("#productFormHost");
  const isEdit = Boolean(product);
  const p = product || {
    id: uid("mv"), name: "", categoryId: cats[0]?.id || "other", brand: settings.displayName,
    sku: "", price: 0, compareAtPrice: null, stock: 0, lowStockThreshold: 5,
    images: [], altText: "", shortDescription: "", description: "",
    ingredients: "", usage: "", warnings: "", expiryInfo: "",
    variants: [], featured: false, isNew: false, isBestSeller: false, active: true,
    createdAt: new Date().toISOString().slice(0, 10),
  };

  host.innerHTML = `
    <div class="modal is-open" id="productModal" role="dialog" aria-modal="true" aria-label="${isEdit ? "Edit Product" : "Add Product"}">
      <div class="modal__backdrop" data-close></div>
      <div class="modal__dialog" style="width:min(100%,760px)">
        <button class="icon-btn modal__close" type="button" data-close aria-label="Close">${I.close}</button>
        <h2 style="font-size:1.2rem">${isEdit ? "Edit Product" : "Add Product"}</h2>
        <form id="productForm" novalidate>
          <div class="form-row">
            <div class="field"><label for="pfName">Product Name <span class="req">*</span></label>
              <input class="input" id="pfName" name="name" required value="${escapeAttr(p.name)}" />
              <span class="field-error"></span></div>
            <div class="field"><label for="pfSku">SKU</label>
              <input class="input" id="pfSku" name="sku" value="${escapeAttr(p.sku)}" placeholder="MV-XXX-0000" /></div>
          </div>

          <div class="form-row form-row--3">
            <div class="field"><label for="pfCategory">Category</label>
              <select class="select" id="pfCategory" name="categoryId">
                ${cats.map((c) => `<option value="${escapeAttr(c.id)}" ${c.id === p.categoryId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
              </select></div>
            <div class="field"><label for="pfPrice">Price (PKR) <span class="req">*</span></label>
              <input class="input" id="pfPrice" name="price" type="number" min="0" required value="${p.price}" />
              <span class="field-error"></span></div>
            <div class="field"><label for="pfCompare">Discount (compare-at price)</label>
              <input class="input" id="pfCompare" name="compareAtPrice" type="number" min="0" value="${p.compareAtPrice ?? ""}" placeholder="Optional" /></div>
          </div>

          <div class="form-row form-row--3">
            <div class="field"><label for="pfStock">Stock Quantity</label>
              <input class="input" id="pfStock" name="stock" type="number" min="0" value="${p.stock}" /></div>
            <div class="field"><label for="pfLow">Low-stock alert at</label>
              <input class="input" id="pfLow" name="lowStockThreshold" type="number" min="0" value="${p.lowStockThreshold}" /></div>
            <div class="field"><label for="pfBrand">Brand</label>
              <input class="input" id="pfBrand" name="brand" value="${escapeAttr(p.brand)}" /></div>
          </div>

          <div class="field"><label for="pfImages">Product Images <span style="text-transform:none;font-weight:400">(one per line, relative to site root)</span></label>
            <textarea class="textarea" id="pfImages" name="images" style="min-height:70px" placeholder="assets/images/ph-lip-1.svg">${escapeHtml((p.images || []).join("\n"))}</textarea></div>

          <div class="field"><label for="pfAlt">Image alt text</label>
            <input class="input" id="pfAlt" name="altText" value="${escapeAttr(p.altText)}" placeholder="Describe the image for screen readers" /></div>

          <div class="field"><label for="pfShort">Short description</label>
            <input class="input" id="pfShort" name="shortDescription" value="${escapeAttr(p.shortDescription)}" /></div>

          <div class="field"><label for="pfDesc">Description</label>
            <textarea class="textarea" id="pfDesc" name="description">${escapeHtml(p.description)}</textarea></div>

          <details style="margin-bottom:16px">
            <summary style="cursor:pointer;font-weight:500;margin-bottom:12px">Additional details (optional)</summary>
            <div class="field"><label for="pfIng">Ingredients</label>
              <textarea class="textarea" id="pfIng" name="ingredients" style="min-height:60px">${escapeHtml(p.ingredients || "")}</textarea>
              <span class="field-hint">Only add verified information supplied by the brand. Leave blank if unknown.</span></div>
            <div class="field"><label for="pfUsage">How to use</label>
              <textarea class="textarea" id="pfUsage" name="usage" style="min-height:60px">${escapeHtml(p.usage || "")}</textarea></div>
            <div class="field"><label for="pfWarn">Warnings &amp; storage</label>
              <textarea class="textarea" id="pfWarn" name="warnings" style="min-height:60px">${escapeHtml(p.warnings || "")}</textarea></div>
            <div class="field"><label for="pfExp">Expiry information</label>
              <input class="input" id="pfExp" name="expiryInfo" value="${escapeAttr(p.expiryInfo || "")}" /></div>
          </details>

          <details style="margin-bottom:16px">
            <summary style="cursor:pointer;font-weight:500;margin-bottom:12px">Variants (optional)</summary>
            <div class="field">
              <label for="pfVariants">Variant JSON</label>
              <textarea class="textarea" id="pfVariants" name="variants" style="min-height:120px;font-family:monospace;font-size:12px">${escapeHtml(JSON.stringify(p.variants || [], null, 2))}</textarea>
              <span class="field-hint">Example: [{"name":"Shade","required":true,"options":[{"label":"Ruby","priceDelta":0,"stock":10,"swatch":"#9E2B33"}]}]</span>
            </div>
          </details>

          <fieldset style="margin-bottom:16px">
            <legend>Merchandising</legend>
            <label class="checkbox"><input type="checkbox" name="featured" ${p.featured ? "checked" : ""} /> Featured on homepage</label>
            <label class="checkbox"><input type="checkbox" name="isNew" ${p.isNew ? "checked" : ""} /> Mark as new arrival</label>
            <label class="checkbox"><input type="checkbox" name="isBestSeller" ${p.isBestSeller ? "checked" : ""} /> Mark as best seller (until real order data takes over)</label>
            <label class="checkbox"><input type="checkbox" name="active" ${p.active ? "checked" : ""} /> Status — Published (visible on storefront)</label>
          </fieldset>

          <div class="btn-row" style="justify-content:flex-end">
            <button class="btn btn--outline" type="button" data-close>Cancel</button>
            <button class="btn btn--primary" type="submit">${isEdit ? "Save Changes" : "Add Product"}</button>
          </div>
        </form>
      </div>
    </div>`;

  const modal = $("#productModal");
  const close = () => (host.innerHTML = "");
  $$("[data-close]", modal).forEach((el) => el.addEventListener("click", close));
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
  });

  $("#productForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    $$(".field-error", form).forEach((s) => (s.textContent = ""));
    $$(".is-invalid", form).forEach((i) => i.classList.remove("is-invalid"));

    let ok = true;
    if (!form.name.value.trim()) { form.name.classList.add("is-invalid"); form.name.closest(".field").querySelector(".field-error").textContent = "Product name is required."; ok = false; }
    if (!(Number(form.price.value) >= 0)) { form.price.classList.add("is-invalid"); form.price.closest(".field").querySelector(".field-error").textContent = "Enter a valid price."; ok = false; }
    if (!ok) return;

    let variants = [];
    try {
      const parsed = JSON.parse(form.variants.value || "[]");
      variants = Array.isArray(parsed) ? parsed : [];
    } catch {
      toast("Variants must be valid JSON — fix or clear the field.", "error");
      return;
    }

    const images = form.images.value.split("\n").map((s) => s.trim()).filter(Boolean);

    await onSave({
      ...p,
      name: form.name.value.trim(),
      sku: form.sku.value.trim(),
      categoryId: form.categoryId.value,
      brand: form.brand.value.trim(),
      price: Number(form.price.value),
      compareAtPrice: form.compareAtPrice.value === "" ? null : Number(form.compareAtPrice.value),
      stock: Number(form.stock.value) || 0,
      lowStockThreshold: Number(form.lowStockThreshold.value) || 5,
      images,
      altText: form.altText.value.trim(),
      shortDescription: form.shortDescription.value.trim(),
      description: form.description.value.trim(),
      ingredients: form.ingredients.value.trim(),
      usage: form.usage.value.trim(),
      warnings: form.warnings.value.trim(),
      expiryInfo: form.expiryInfo.value.trim(),
      variants,
      featured: form.featured.checked,
      isNew: form.isNew.checked,
      isBestSeller: form.isBestSeller.checked,
      active: form.active.checked,
    });
    close();
  });
}

/* ==========================================================================
   CATEGORIES
   ========================================================================== */

async function renderCategories(body) {
  body.innerHTML = `
    <div class="admin-note" style="margin-bottom:16px">${I.info}<span>Categories drive the storefront navigation and shop filters. Reordering here changes the order customers see.</span></div>
    <div class="admin-grid-2">
      <section class="admin-panel">
        <div class="admin-panel__head">
          <h2>All categories</h2>
          <button class="btn btn--primary btn--sm" id="addCatBtn" type="button">${I.plus} Add category</button>
        </div>
        <div class="admin-panel__body admin-panel__body--flush" id="catTableWrap">
          <div class="admin-panel__body"><div class="skeleton" style="height:200px"></div></div>
        </div>
      </section>

      <section class="admin-panel">
        <div class="admin-panel__head"><h2 id="catFormTitle">Add category</h2></div>
        <div class="admin-panel__body">
          <form id="catForm" novalidate>
            <input type="hidden" name="id" value="" />
            <div class="field"><label for="cfName">Name <span class="req">*</span></label>
              <input class="input" id="cfName" name="name" required placeholder="e.g. Lipsticks & Lip Makeup" />
              <span class="field-error"></span></div>
            <div class="field"><label for="cfSlug">Slug</label>
              <input class="input" id="cfSlug" name="slug" placeholder="auto-generated from name" /></div>
            <div class="field"><label for="cfDesc">Description</label>
              <textarea class="textarea" id="cfDesc" name="description" style="min-height:80px"></textarea></div>
            <div class="field"><label for="cfImage">Image path</label>
              <input class="input" id="cfImage" name="image" placeholder="assets/images/ph-lip-1.svg" /></div>
            <div class="form-row">
              <div class="field"><label for="cfSort">Sort order</label>
                <input class="input" id="cfSort" name="sortOrder" type="number" min="0" value="99" /></div>
              <div class="field" style="display:flex;align-items:flex-end">
                <label class="checkbox"><input type="checkbox" name="active" checked /> Active</label>
              </div>
            </div>
            <div class="btn-row" style="justify-content:flex-end">
              <button class="btn btn--outline" type="button" id="catReset">Clear</button>
              <button class="btn btn--primary" type="submit" id="catSubmit">Add category</button>
            </div>
          </form>
        </div>
      </section>
    </div>`;

  let cats = await productsService.getCategories({ includeInactive: true });

  const draw = () => {
    const wrap = $("#catTableWrap");
    if (!cats.length) {
      wrap.innerHTML = `<div class="admin-panel__body">${emptyState("No categories yet", "Add your first category using the form.")}</div>`;
      return;
    }
    wrap.innerHTML = `
      <div class="table-wrap" style="border:0">
        <table class="table">
          <thead><tr><th>Category</th><th>Products</th><th>Order</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
          <tbody>
            ${cats
              .map(
                (c, i) => `
              <tr data-id="${escapeAttr(c.id)}">
                <td>
                  <div style="display:flex;gap:10px;align-items:center">
                    <img src="${escapeAttr(c.image || "assets/images/ph-other-1.svg")}" alt="" class="thumb-sm" loading="lazy" />
                    <span><strong>${escapeHtml(c.name)}</strong><div class="price-note">${escapeHtml(c.slug)}</div></span>
                  </div>
                </td>
                <td>${c.productCount ?? "—"}</td>
                <td>
                  <div class="row-actions" style="justify-content:flex-start">
                    <button class="icon-btn" type="button" data-move="up" ${i === 0 ? "disabled style=opacity:.3" : ""} title="Move up">${I.up}</button>
                    <button class="icon-btn" type="button" data-move="down" ${i === cats.length - 1 ? "disabled style=opacity:.3" : ""} title="Move down">${I.down}</button>
                  </div>
                </td>
                <td><span class="badge ${c.active ? "badge--instock" : "badge--out"}">${c.active ? "Active" : "Hidden"}</span></td>
                <td>
                  <div class="row-actions">
                    <button class="icon-btn" type="button" data-toggle title="Toggle active">${c.active ? I.close : I.plus}</button>
                    <button class="icon-btn" type="button" data-edit title="Edit">${I.edit}</button>
                    <button class="icon-btn danger" type="button" data-delete title="Delete">${I.trash}</button>
                  </div>
                </td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  };

  const withCounts = async () => {
    cats = await productsService.getCategories({ includeInactive: true });
    const products = await productsService.getProducts();
    cats = cats.map((c) => ({ ...c, productCount: products.filter((p) => p.categoryId === c.id).length }));
    draw();
  };

  await withCounts();

  const form = $("#catForm");
  const resetForm = () => {
    form.reset();
    form.id.value = "";
    $("#catFormTitle").textContent = "Add category";
    $("#catSubmit").textContent = "Add category";
  };

  $("#catReset")?.addEventListener("click", resetForm);

  $("#addCatBtn")?.addEventListener("click", () => { resetForm(); form.name.focus(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    $$(".field-error", form).forEach((s) => (s.textContent = ""));
    form.name.classList.remove("is-invalid");

    if (!form.name.value.trim()) {
      form.name.classList.add("is-invalid");
      form.name.closest(".field").querySelector(".field-error").textContent = "Category name is required.";
      return;
    }

    const existing = form.id.value ? cats.find((c) => c.id === form.id.value) : null;
    const name = form.name.value.trim();
    const record = {
      id: existing?.id || slugify(name),
      name,
      slug: form.slug.value.trim() || slugify(name),
      description: form.description.value.trim(),
      image: form.image.value.trim() || existing?.image || "",
      sortOrder: Number(form.sortOrder.value) || 99,
      active: form.active.checked,
    };

    await productsService.saveCategory(record);
    await withCounts();
    resetForm();
    toast(existing ? "Category updated." : "Category added.", "success");
  });

  $("#catTableWrap")?.addEventListener("click", async (e) => {
    const row = e.target.closest("tr[data-id]");
    if (!row) return;
    const id = row.dataset.id;
    const cat = cats.find((c) => c.id === id);
    if (!cat) return;

    if (e.target.closest("[data-edit]")) {
      form.id.value = cat.id;
      form.name.value = cat.name;
      form.slug.value = cat.slug;
      form.description.value = cat.description;
      form.image.value = cat.image;
      form.sortOrder.value = cat.sortOrder;
      form.active.checked = cat.active;
      $("#catFormTitle").textContent = `Edit: ${cat.name}`;
      $("#catSubmit").textContent = "Save changes";
      form.name.focus();
      return;
    }

    if (e.target.closest("[data-toggle]")) {
      await productsService.saveCategory({ ...cat, active: !cat.active });
      await withCounts();
      toast(cat.active ? "Category hidden." : "Category activated.", "success");
      return;
    }

    const move = e.target.closest("[data-move]")?.dataset.move;
    if (move) {
      const idx = cats.findIndex((c) => c.id === id);
      const swapWith = move === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= cats.length) return;
      const a = cats[idx], b = cats[swapWith];
      await productsService.saveCategory({ ...a, sortOrder: b.sortOrder });
      await productsService.saveCategory({ ...b, sortOrder: a.sortOrder });
      await withCounts();
      return;
    }

    if (e.target.closest("[data-delete]")) {
      if (!confirmDialog(`Delete the category "${cat.name}"? Products in it will remain but lose their category link.`)) return;
      await productsService.deleteCategory(cat.id);
      await withCounts();
      toast("Category deleted.", "info");
    }
  });
}

/* ==========================================================================
   ORDERS
   ========================================================================== */

async function renderOrders(body, params) {
  body.innerHTML = `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>Manage Orders</h2>
        <div class="admin-toolbar">
          <div class="search-field">
            ${I.search}
            <input class="input" id="orderSearch" type="search" placeholder="Search reference, name or phone…" />
          </div>
          <select class="select" id="orderStatusFilter" style="width:auto">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="packed">Packed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
            <option value="returned">Returned</option>
          </select>
        </div>
      </div>
      <div class="admin-panel__body admin-panel__body--flush" id="ordersTableWrap">
        <div class="admin-panel__body"><div class="skeleton" style="height:240px"></div></div>
      </div>
    </section>
    <div id="orderDetailHost"></div>`;

  let list = await ordersService.listOrders();

  const draw = (rows) => {
    const wrap = $("#ordersTableWrap");
    if (!rows.length) {
      wrap.innerHTML = `<div class="admin-panel__body">${emptyState("No orders found", "Orders from the storefront will appear here. Try adjusting your filters.")}</div>`;
      return;
    }
    wrap.innerHTML = `
      <div class="table-wrap" style="border:0">
        <table class="table">
          <thead><tr><th>Reference</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Placed</th><th style="text-align:right"></th></tr></thead>
          <tbody>
            ${rows
              .map(
                (o) => `
              <tr data-ref="${escapeAttr(o.reference)}">
                <td><strong>${escapeHtml(o.reference)}</strong></td>
                <td>${escapeHtml(o.customer.fullName)}<div class="price-note">${escapeHtml(o.customer.phone)} · ${escapeHtml(o.customer.city)}</div></td>
                <td>${(o.items || []).reduce((n, i) => n + (i.quantity || 0), 0)}</td>
                <td>${formatPrice(o.total)}</td>
                <td>${escapeHtml((o.paymentMethod || "cod").toUpperCase())}</td>
                <td><span class="status status--${escapeAttr(o.status)}">${escapeHtml(o.status)}</span></td>
                <td class="price-note">${formatDateTime(o.createdAt)}</td>
                <td style="text-align:right"><button class="btn btn--outline btn--sm" type="button" data-open>View Order</button></td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  };

  draw(list);

  const applyFilters = () => {
    const term = $("#orderSearch")?.value.trim().toLowerCase() || "";
    const status = $("#orderStatusFilter")?.value || "";
    draw(
      list.filter(
        (o) =>
          (!status || o.status === status) &&
          (!term ||
            o.reference.toLowerCase().includes(term) ||
            o.customer.fullName.toLowerCase().includes(term) ||
            o.customer.phone.includes(term))
      )
    );
  };

  $("#orderSearch")?.addEventListener("input", debounce(applyFilters, 220));
  $("#orderStatusFilter")?.addEventListener("change", applyFilters);

  const openDetail = async (reference) => {
    const order = list.find((o) => o.reference === reference);
    if (!order) return;
    const host = $("#orderDetailHost");
    const flow = settings.get("orders.statusFlow", CONFIG.orders.statusFlow);
    const allStatuses = [...flow, "cancelled", "returned"];

    host.innerHTML = `
      <div class="modal is-open" role="dialog" aria-modal="true" aria-label="Order ${escapeAttr(order.reference)}">
        <div class="modal__backdrop" data-close></div>
        <div class="modal__dialog" style="width:min(100%,720px)">
          <button class="icon-btn modal__close" type="button" data-close aria-label="Close">${I.close}</button>

          <div class="cart-head" style="border:0;padding:0;margin-bottom:16px">
            <div>
              <h2 style="font-size:1.2rem;margin:0">${escapeHtml(order.reference)}</h2>
              <span class="price-note">Order Date: ${formatDateTime(order.createdAt)}</span>
            </div>
            <span class="status status--${escapeAttr(order.status)}">${escapeHtml(order.status)}</span>
          </div>

          <div class="order-detail-grid" style="margin-bottom:20px">
            <div class="info-block">
              <h3>Customer Details</h3>
              <p><strong>${escapeHtml(order.customer.fullName)}</strong><br/>
              ${escapeHtml(order.customer.address)}<br/>
              ${escapeHtml(order.customer.city)}<br/>
              ${escapeHtml(order.customer.phone)}${order.customer.email ? `<br/>${escapeHtml(order.customer.email)}` : ""}</p>
              ${order.customer.instructions ? `<p class="price-note" style="margin-top:8px">Note: ${escapeHtml(order.customer.instructions)}</p>` : ""}
            </div>
            <div class="info-block">
              <h3>Totals</h3>
              <div class="summary__row"><span>Subtotal</span><strong>${formatPrice(order.subtotal)}</strong></div>
              ${order.discount > 0 ? `<div class="summary__row"><span>Discount</span><strong class="save">− ${formatPrice(order.discount)}</strong></div>` : ""}
              <div class="summary__row"><span>Delivery</span><strong>${order.deliveryCharge === 0 ? "Free" : formatPrice(order.deliveryCharge)}</strong></div>
              <div class="summary__row summary__row--total"><span>Total</span><strong>${formatPrice(order.total)}</strong></div>
              <p class="price-note" style="margin-top:8px">Payment Method: ${escapeHtml((o.paymentMethod || "cod").toUpperCase())}</p>
            </div>
          </div>

          <div class="order-items-table">
            <table class="table">
              <thead><tr><th>Item</th><th>Variant</th><th>Qty</th><th style="text-align:right">Total</th></tr></thead>
              <tbody>
                ${(order.items || [])
                  .map(
                    (i) => `
                  <tr>
                    <td>${escapeHtml(i.name)}</td>
                    <td>${Object.keys(i.variant || {}).length ? Object.values(i.variant).map(escapeHtml).join(", ") : "—"}</td>
                    <td>${i.quantity}</td>
                    <td style="text-align:right">${formatPrice(i.lineTotal)}</td>
                  </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>

          <div style="margin-top:20px">
            <h3 style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--c-ink-mute);margin-bottom:10px">Update status</h3>
            <div class="variant-options">
              ${allStatuses
                .map((s) => `<button class="chip ${s === order.status ? "is-active" : ""}" type="button" data-set-status="${escapeAttr(s)}">${escapeHtml(s)}</button>`)
                .join("")}
            </div>
          </div>

          <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--c-line)">
            <h3 style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--c-ink-mute);margin-bottom:10px">Dispatch details</h3>
            <form id="dispatchForm" class="form-row" style="align-items:flex-end">
              <div class="field" style="margin:0">
                <label for="dCour">Courier</label>
                <input class="input" id="dCour" name="courier" value="${escapeAttr(order.dispatch?.courier || "")}" placeholder="e.g. courier name" />
              </div>
              <div class="field" style="margin:0">
                <label for="dTrack">Tracking number</label>
                <input class="input" id="dTrack" name="trackingNumber" value="${escapeAttr(order.dispatch?.trackingNumber || "")}" placeholder="Consignment number" />
              </div>
              <button class="btn btn--outline" type="submit" style="margin:0">Save dispatch</button>
            </form>
          </div>

          ${
            order.history?.length
              ? `<details style="margin-top:16px">
                  <summary style="cursor:pointer;font-weight:500">Status history</summary>
                  <ol class="timeline" style="margin-top:12px">
                    ${order.history
                      .slice()
                      .reverse()
                      .map(
                        (h) => `
                      <li class="timeline__item is-done">
                        <span class="timeline__dot"></span>
                        <div class="timeline__title">${escapeHtml(h.status)}</div>
                        <div class="timeline__time">${formatDateTime(h.at)}${h.note ? ` — ${escapeHtml(h.note)}` : ""}</div>
                      </li>`
                      )
                      .join("")}
                  </ol>
                </details>`
              : ""
          }
        </div>
      </div>`;

    const close = () => (host.innerHTML = "");
    $$("[data-close]", host).forEach((el) => el.addEventListener("click", close));

    $$("[data-set-status]", host).forEach((btn) =>
      btn.addEventListener("click", async () => {
        const status = btn.dataset.setStatus;
        if (status === order.status) return;
        if (!confirmDialog(`Mark ${order.reference} as "${status}"?`)) return;
        try {
          await ordersService.updateStatus(order.id, status, `Status set to ${status}`);
          list = await ordersService.listOrders();
          draw(list);
          close();
          toast(`Order marked as ${status}.`, "success");
        } catch (err) {
          toast(err.message || "Could not update status.", "error");
        }
      })
    );

    $("#dispatchForm", host)?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const courier = e.target.courier.value.trim();
      const trackingNumber = e.target.trackingNumber.value.trim();
      if (!courier && !trackingNumber) {
        toast("Enter a courier or tracking number first.", "error");
        return;
      }
      await ordersService.addDispatch(order.id, { courier, trackingNumber, note: "Dispatch details recorded" });
      list = await ordersService.listOrders();
      draw(list);
      close();
      toast("Dispatch details saved.", "success");
    });
  };

  $("#ordersTableWrap")?.addEventListener("click", (e) => {
    const row = e.target.closest("tr[data-ref]");
    if (!row) return;
    if (e.target.closest("[data-open]")) openDetail(row.dataset.ref);
  });

  // Deep link: orders.html?ref=MV-XXXX
  const prefill = params?.get("ref");
  if (prefill) openDetail(prefill.toUpperCase());
}

/* ==========================================================================
   INVENTORY
   ========================================================================== */

async function renderInventory(body) {
  body.innerHTML = `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>Inventory</h2>
        <div class="admin-toolbar">
          <label class="checkbox" style="margin:0"><input type="checkbox" id="lowOnly" /> Low stock only</label>
          <div class="search-field">
            ${I.search}
            <input class="input" id="invSearch" type="search" placeholder="Search products…" />
          </div>
        </div>
      </div>
      <div class="admin-panel__body admin-panel__body--flush" id="invTableWrap">
        <div class="admin-panel__body"><div class="skeleton" style="height:240px"></div></div>
      </div>
    </section>`;

  let list = await productsService.getProducts({ includeInactive: true });

  const draw = () => {
    const term = $("#invSearch")?.value.trim().toLowerCase() || "";
    const lowOnly = $("#lowOnly")?.checked || false;

    const rows = list
      .filter((p) => !term || p.name.toLowerCase().includes(term) || (p.sku || "").toLowerCase().includes(term))
      .filter((p) => !lowOnly || p.stock <= (p.lowStockThreshold || 5))
      .sort((a, b) => a.stock - b.stock);

    const wrap = $("#invTableWrap");
    if (!rows.length) {
      wrap.innerHTML = `<div class="admin-panel__body">${emptyState("Nothing to show", lowOnly ? "No products are at or below their low-stock threshold." : "No products match your search.")}</div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="table-wrap" style="border:0">
        <table class="table">
          <thead><tr><th>Product</th><th>SKU</th><th>Current stock</th><th>Alert threshold</th><th>Status</th><th style="text-align:right">Adjust</th></tr></thead>
          <tbody>
            ${rows
              .map((p) => {
                const status = p.stock <= 0 ? "out" : p.stock <= (p.lowStockThreshold || 5) ? "low" : "ok";
                return `
              <tr data-id="${escapeAttr(p.id)}">
                <td>
                  <div style="display:flex;gap:10px;align-items:center">
                    <img src="${escapeAttr(p.images[0] || "assets/images/ph-other-1.svg")}" alt="" class="thumb-sm" loading="lazy" />
                    <span>${escapeHtml(p.name)}</span>
                  </div>
                </td>
                <td class="price-note">${escapeHtml(p.sku || "—")}</td>
                <td><strong>${p.stock}</strong></td>
                <td>${p.lowStockThreshold || 5}</td>
                <td>${status === "out" ? '<span class="badge badge--out">Out of stock</span>' : status === "low" ? '<span class="badge badge--low">Low stock</span>' : '<span class="badge badge--instock">In stock</span>'}</td>
                <td style="text-align:right">
                  <div class="stock-control" style="justify-content:flex-end">
                    <div class="qty">
                      <button type="button" data-stock="-1" aria-label="Decrease">−</button>
                      <input type="number" min="0" value="${p.stock}" data-stock-input aria-label="Stock for ${escapeAttr(p.name)}" />
                      <button type="button" data-stock="1" aria-label="Increase">+</button>
                    </div>
                    <button class="btn btn--outline btn--sm" type="button" data-stock-save>Save</button>
                  </div>
                </td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>`;
  };

  draw(list);

  $("#invSearch")?.addEventListener("input", debounce(draw, 200));
  $("#lowOnly")?.addEventListener("change", draw);

  $("#invTableWrap")?.addEventListener("click", async (e) => {
    const row = e.target.closest("tr[data-id]");
    if (!row) return;
    const product = list.find((p) => p.id === row.dataset.id);
    if (!product) return;

    const step = e.target.closest("[data-stock]");
    if (step) {
      const input = row.querySelector("[data-stock-input]");
      const next = Math.max(0, (parseInt(input.value, 10) || 0) + Number(step.dataset.stock));
      input.value = next;
      return;
    }

    if (e.target.closest("[data-stock-save]")) {
      const input = row.querySelector("[data-stock-input]");
      const value = Math.max(0, parseInt(input.value, 10) || 0);
      await productsService.saveProduct({ ...product, stock: value });
      list = await productsService.getProducts({ includeInactive: true });
      draw();
      toast(`Stock updated to ${value} for "${product.name}".`, "success");
    }
  });
}

/* ==========================================================================
   SETTINGS
   ========================================================================== */

async function renderSettings(body) {
  const s = settings;
  const c = s.contact;
  const soc = s.social;
  const d = s.delivery;
  const pay = s.payments;
  const home = s.home;
  const diedei = s.partnerships.diedei3d;
  const discountCodes = s.get("discountCodes", {}) || {};
  const codeRows = Object.entries(discountCodes);

  body.innerHTML = `
    ${auth.isDemoMode ? `
      <div class="alert alert--info" style="margin-bottom:16px">${I.info}
        <div><strong>Demo mode</strong><p>Settings are stored in this browser. With the backend connected they persist to the database for the whole store.</p></div>
      </div>` : ""}

    <form id="settingsForm" novalidate>

      <section class="admin-panel settings-section">
        <div class="admin-panel__head"><h2>Brand</h2></div>
        <div class="admin-panel__body">
          <div class="form-row form-row--3">
            <div class="field"><label for="stBrand">Business name</label>
              <input class="input" id="stBrand" name="businessName" value="${escapeAttr(s.businessName)}" /></div>
            <div class="field"><label for="stDisplay">Display name</label>
              <input class="input" id="stDisplay" name="displayName" value="${escapeAttr(s.displayName)}" /></div>
            <div class="field"><label for="stCurrency">Currency</label>
              <input class="input" id="stCurrency" name="currency" value="${escapeAttr(s.currency)}" disabled /></div>
          </div>
        </div>
      </section>

      <section class="admin-panel settings-section">
        <div class="admin-panel__head"><h2>Contact details</h2></div>
        <div class="admin-panel__body">
          <div class="form-row form-row--3">
            <div class="field"><label for="stPhone">Phone</label>
              <input class="input" id="stPhone" name="phone" value="${escapeAttr(c.phone)}" placeholder="+92 3xx xxxxxxx" /></div>
            <div class="field"><label for="stWhats">WhatsApp (digits, with country code)</label>
              <input class="input" id="stWhats" name="whatsapp" value="${escapeAttr(c.whatsapp)}" placeholder="923001234567" /></div>
            <div class="field"><label for="stEmail">Support email</label>
              <input class="input" id="stEmail" name="email" type="email" value="${escapeAttr(c.email)}" placeholder="support@example.com" /></div>
          </div>
          <div class="form-row">
            <div class="field"><label for="stAddress">Address</label>
              <input class="input" id="stAddress" name="address" value="${escapeAttr(c.address)}" /></div>
            <div class="field"><label for="stCity">City</label>
              <input class="input" id="stCity" name="city" value="${escapeAttr(c.city)}" /></div>
          </div>
          <div class="field"><label for="stHours">Support hours</label>
            <input class="input" id="stHours" name="supportHours" value="${escapeAttr(c.supportHours)}" placeholder="e.g. Mon–Sat, 10am–7pm" /></div>
          <p class="price-note">Leave a field blank to hide it on the storefront — blank channels are never shown as dead links.</p>
        </div>
      </section>

      <section class="admin-panel settings-section">
        <div class="admin-panel__head"><h2>Social profiles</h2></div>
        <div class="admin-panel__body">
          <div class="form-row form-row--3">
            <div class="field"><label for="stIg">Instagram URL</label>
              <input class="input" id="stIg" name="instagram" value="${escapeAttr(soc.instagram)}" placeholder="https://instagram.com/…" /></div>
            <div class="field"><label for="stFb">Facebook URL</label>
              <input class="input" id="stFb" name="facebook" value="${escapeAttr(soc.facebook)}" placeholder="https://facebook.com/…" /></div>
            <div class="field"><label for="stTt">TikTok URL</label>
              <input class="input" id="stTt" name="tiktok" value="${escapeAttr(soc.tiktok)}" placeholder="https://tiktok.com/@…" /></div>
          </div>
          <div class="form-row form-row--3">
            <div class="field"><label for="stYt">YouTube URL</label>
              <input class="input" id="stYt" name="youtube" value="${escapeAttr(soc.youtube)}" placeholder="https://youtube.com/…" /></div>
            <div class="field"><label for="stOther">Other platform URL</label>
              <input class="input" id="stOther" name="other" value="${escapeAttr(soc.other)}" /></div>
            <div class="field"><label for="stOtherLabel">Other platform label</label>
              <input class="input" id="stOtherLabel" name="otherLabel" value="${escapeAttr(soc.otherLabel)}" placeholder="e.g. Snapchat" /></div>
          </div>
        </div>
      </section>

      <section class="admin-panel settings-section">
        <div class="admin-panel__head"><h2>Delivery &amp; payment</h2></div>
        <div class="admin-panel__body">
          <div class="form-row form-row--3">
            <div class="field"><label for="stCharge">Delivery charge (PKR)</label>
              <input class="input" id="stCharge" name="charge" type="number" min="0" value="${d.charge}" /></div>
            <div class="field"><label for="stFree">Free delivery over (PKR)</label>
              <input class="input" id="stFree" name="freeOver" type="number" min="0" value="${d.freeOver}" />
              <span class="field-hint">Set 0 to disable the free-delivery threshold.</span></div>
            <div class="field"><label for="stDays">Estimated delivery</label>
              <input class="input" id="stDays" name="estimatedDays" value="${escapeAttr(d.estimatedDays)}" /></div>
          </div>
          <div class="field"><label for="stAreas">Delivery areas</label>
            <input class="input" id="stAreas" name="areas" value="${escapeAttr(d.areas)}" /></div>

          <fieldset style="margin-top:8px">
            <legend>Payment methods</legend>
            <label class="checkbox"><input type="checkbox" name="pay_cod" ${pay.cod.enabled ? "checked" : ""} /> Cash on Delivery <span class="price-note">— enable only with a real courier arrangement</span></label>
            <label class="checkbox"><input type="checkbox" name="pay_card" ${pay.card.enabled ? "checked" : ""} /> Debit / Credit card <span class="price-note">— enable only once a gateway is connected and verified</span></label>
            <label class="checkbox"><input type="checkbox" name="pay_jazzcash" ${pay.jazzcash.enabled ? "checked" : ""} /> JazzCash</label>
            <label class="checkbox"><input type="checkbox" name="pay_easypaisa" ${pay.easypaisa.enabled ? "checked" : ""} /> Easypaisa</label>
          </fieldset>
        </div>
      </section>

      <section class="admin-panel settings-section">
        <div class="admin-panel__head"><h2>Homepage content</h2></div>
        <div class="admin-panel__body">
          <div class="form-row">
            <div class="field"><label for="stEyebrow">Hero eyebrow</label>
              <input class="input" id="stEyebrow" name="heroEyebrow" value="${escapeAttr(home.heroEyebrow)}" /></div>
            <div class="field"><label for="stAnnounce">Announcement bar</label>
              <input class="input" id="stAnnounce" name="announcement" value="${escapeAttr(home.announcement)}" /></div>
          </div>
          <div class="form-row">
            <div class="field"><label for="stHeroTitle">Hero title</label>
              <input class="input" id="stHeroTitle" name="heroTitle" value="${escapeAttr(home.heroTitle)}" /></div>
            <div class="field"><label for="stHeroAccent">Hero accent word</label>
              <input class="input" id="stHeroAccent" name="heroTitleAccent" value="${escapeAttr(home.heroTitleAccent)}" /></div>
          </div>
          <div class="field"><label for="stHeroText">Hero description</label>
            <textarea class="textarea" id="stHeroText" name="heroText" style="min-height:80px">${escapeHtml(home.heroText)}</textarea></div>
          <div class="form-row">
            <div class="field"><label for="stHeroCta">Primary button</label>
              <input class="input" id="stHeroCta" name="heroCta" value="${escapeAttr(home.heroCta)}" /></div>
            <div class="field"><label for="stHeroCta2">Secondary button</label>
              <input class="input" id="stHeroCta2" name="heroSecondaryCta" value="${escapeAttr(home.heroSecondaryCta)}" /></div>
          </div>
        </div>
      </section>

      <section class="admin-panel settings-section">
        <div class="admin-panel__head"><h2>Discount codes</h2></div>
        <div class="admin-panel__body">
          <div id="codeRows">
            ${codeRows
              .map(
                ([code, rule], idx) => `
              <div class="form-row" data-code-row style="align-items:flex-end;margin-bottom:12px">
                <div class="field" style="margin:0"><label>Code</label>
                  <input class="input" name="code_${idx}" value="${escapeAttr(code)}" style="text-transform:uppercase" /></div>
                <div class="field" style="margin:0"><label>Type</label>
                  <select class="select" name="codetype_${idx}">
                    <option value="percent" ${rule.type === "percent" ? "selected" : ""}>% off</option>
                    <option value="fixed" ${rule.type === "fixed" ? "selected" : ""}>Rs off</option>
                  </select></div>
                <div class="field" style="margin:0"><label>Value</label>
                  <input class="input" name="codeval_${idx}" type="number" min="0" value="${Number(rule.value) || 0}" /></div>
                <button class="btn btn--danger btn--sm" type="button" data-remove-code style="margin-bottom:2px">Remove</button>
              </div>`
              )
              .join("")}
          </div>
          <button class="btn btn--outline btn--sm" type="button" id="addCodeBtn">${I.plus} Add discount code</button>
        </div>
      </section>

      <section class="admin-panel settings-section">
        <div class="admin-panel__head"><h2>Partnerships</h2></div>
        <div class="admin-panel__body">
          <div class="alert alert--warning">${I.info}
            <div><strong>Publish only with verified, approved content</strong>
            <p>Keep this unpublished until the partnership is confirmed in writing and you have the approved logo and description. Never claim exclusivity, distributorship or authorisation without evidence.</p></div>
          </div>

          <div class="field"><label for="stPartnerName">Partner name</label>
            <input class="input" id="stPartnerName" name="partnerName" value="${escapeAttr(diedei.name)}" /></div>
          <div class="field"><label for="stPartnerDesc">Description (approved copy only)</label>
            <textarea class="textarea" id="stPartnerDesc" name="partnerDescription" style="min-height:80px">${escapeHtml(diedei.description)}</textarea></div>
          <div class="form-row">
            <div class="field"><label for="stPartnerLogo">Logo path or URL</label>
              <input class="input" id="stPartnerLogo" name="partnerLogo" value="${escapeAttr(diedei.logo)}" /></div>
            <div class="field"><label for="stPartnerUrl">Partner link</label>
              <input class="input" id="stPartnerUrl" name="partnerUrl" value="${escapeAttr(diedei.url)}" placeholder="https://…" /></div>
          </div>
          <div class="field"><label for="stPartnerScope">Scope of collaboration</label>
            <input class="input" id="stPartnerScope" name="partnerScope" value="${escapeAttr(diedei.scope)}" /></div>
          <label class="checkbox"><input type="checkbox" name="partnerPublished" ${diedei.published ? "checked" : ""} />
            Show the “Our Partnerships” section on the homepage</label>
        </div>
      </section>

      <div class="btn-row" style="position:sticky;bottom:16px;background:var(--c-surface);padding:16px;border:1px solid var(--c-line);border-radius:12px;box-shadow:var(--shadow-md);z-index:10">
        <button class="btn btn--primary btn--lg" type="submit">Save settings</button>
        <button class="btn btn--outline" type="button" id="exportSettings">Export settings</button>
        <button class="btn btn--danger" type="button" id="resetSettings">Reset to defaults</button>
      </div>
    </form>

    <section class="admin-panel danger-zone" style="margin-top:24px">
      <div class="admin-panel__head"><h2>Danger zone</h2></div>
      <div class="admin-panel__body">
        <p class="text-soft" style="font-size:0.875rem">These actions clear locally-stored demo data in this browser. They do not affect the live database.</p>
        <div class="btn-row" style="margin-top:12px">
          <button class="btn btn--danger" type="button" id="clearDemoProducts">Reset demo products &amp; categories</button>
          <button class="btn btn--danger" type="button" id="clearDemoReviews">Clear demo reviews</button>
        </div>
      </div>
    </section>`;

  /* ---- Wire discount-code rows ---- */
  let codeIdx = codeRows.length;
  $("#addCodeBtn")?.addEventListener("click", () => {
    const host = $("#codeRows");
    const div = document.createElement("div");
    div.className = "form-row";
    div.setAttribute("data-code-row", "");
    div.style.cssText = "align-items:flex-end;margin-bottom:12px";
    div.innerHTML = `
      <div class="field" style="margin:0"><label>Code</label>
        <input class="input" name="code_${codeIdx}" style="text-transform:uppercase" /></div>
      <div class="field" style="margin:0"><label>Type</label>
        <select class="select" name="codetype_${codeIdx}">
          <option value="percent">% off</option>
          <option value="fixed">Rs off</option>
        </select></div>
      <div class="field" style="margin:0"><label>Value</label>
        <input class="input" name="codeval_${codeIdx}" type="number" min="0" value="0" /></div>
      <button class="btn btn--danger btn--sm" type="button" data-remove-code style="margin-bottom:2px">Remove</button>`;
    host.appendChild(div);
    codeIdx++;
  });

  $("#codeRows")?.addEventListener("click", (e) => {
    if (e.target.closest("[data-remove-code]")) e.target.closest("[data-code-row]")?.remove();
  });

  /* ---- Save ---- */
  $("#settingsForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;

    // Discount codes → object
    const codes = {};
    $$("[data-code-row]", form).forEach((row, idx) => {
      // read by scanning inputs within the row
      const inputs = row.querySelectorAll("input, select");
      const code = (inputs[0]?.value || "").trim().toUpperCase();
      const type = inputs[1]?.value || "percent";
      const value = Number(inputs[2]?.value) || 0;
      if (code && value > 0) codes[code] = { type, value };
    });

    const partial = {
      businessName: form.businessName.value.trim() || "MAVELIQ",
      displayName: form.displayName.value.trim() || "Maveliq",
      contact: {
        phone: form.phone.value.trim(),
        whatsapp: form.whatsapp.value.trim(),
        email: form.email.value.trim(),
        address: form.address.value.trim(),
        city: form.city.value.trim(),
        supportHours: form.supportHours.value.trim(),
      },
      social: {
        whatsapp: form.whatsapp.value.trim(),
        instagram: form.instagram.value.trim(),
        facebook: form.facebook.value.trim(),
        tiktok: form.tiktok.value.trim(),
        youtube: form.youtube.value.trim(),
        other: form.other.value.trim(),
        otherLabel: form.otherLabel.value.trim(),
      },
      delivery: {
        charge: Number(form.charge.value) || 0,
        freeOver: Number(form.freeOver.value) || 0,
        codAvailable: form.pay_cod.checked,
        estimatedDays: form.estimatedDays.value.trim(),
        areas: form.areas.value.trim(),
      },
      payments: {
        cod: { ...settings.payments.cod, enabled: form.pay_cod.checked },
        card: { ...settings.payments.card, enabled: form.pay_card.checked },
        jazzcash: { ...settings.payments.jazzcash, enabled: form.pay_jazzcash.checked },
        easypaisa: { ...settings.payments.easypaisa, enabled: form.pay_easypaisa.checked },
      },
      home: {
        heroEyebrow: form.heroEyebrow.value.trim(),
        heroTitle: form.heroTitle.value.trim(),
        heroTitleAccent: form.heroTitleAccent.value.trim(),
        heroText: form.heroText.value.trim(),
        heroCta: form.heroCta.value.trim(),
        heroSecondaryCta: form.heroSecondaryCta.value.trim(),
        announcement: form.announcement.value.trim(),
      },
      partnerships: {
        diedei3d: {
          published: form.partnerPublished.checked,
          name: form.partnerName.value.trim(),
          logo: form.partnerLogo.value.trim(),
          description: form.partnerDescription.value.trim(),
          url: form.partnerUrl.value.trim(),
          scope: form.partnerScope.value.trim(),
        },
      },
      discountCodes: codes,
    };

    settings.save(partial);
    toast("Settings saved.", "success");
    setTimeout(() => window.location.reload(), 600);
  });

  $("#exportSettings")?.addEventListener("click", () => {
    const data = JSON.stringify(settings.exportOverrides(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "maveliq-settings.json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Settings exported as JSON.", "success");
  });

  $("#resetSettings")?.addEventListener("click", () => {
    if (!confirmDialog("Reset ALL settings back to the defaults in js/config.js?")) return;
    settings.reset();
    toast("Settings reset to defaults.", "info");
    setTimeout(() => window.location.reload(), 600);
  });

  $("#clearDemoProducts")?.addEventListener("click", () => {
    if (!confirmDialog("Reset demo products and categories back to the sample catalogue?")) return;
    productsService.resetDemoOverrides();
    toast("Demo catalogue restored.", "info");
  });

  $("#clearDemoReviews")?.addEventListener("click", async () => {
    if (!confirmDialog("Clear all demo reviews?")) return;
    const { reviews } = await import("./reviews.js");
    reviews.clearDemoData();
    toast("Demo reviews cleared.", "info");
  });
}

/* ==========================================================================
   BOOT
   ========================================================================== */

async function boot() {
  const page = document.body.dataset.admin || "dashboard";

  // Auth gate — other admin pages redirect to the login/dashboard screen.
  if (!auth.isAuthenticated) {
    if (page === "dashboard") {
      const redirect = new URLSearchParams(window.location.search).get("redirect") || "index.html";
      renderLogin(redirect);
      return;
    }
    auth.requireAdmin({ loginUrl: "./index.html" });
    return;
  }

  // Shell
  document.title = `${pageTitle(page)} | ${CONFIG.admin.title}`;
  const root = document.getElementById("admin-root");
  root.innerHTML = shellMarkup(page);
  wireShell(page);

  const body = document.getElementById("adminBody");
  const params = new URLSearchParams(window.location.search);

  try {
    switch (page) {
      case "products":   await renderProducts(body); break;
      case "categories": await renderCategories(body); break;
      case "orders":     await renderOrders(body, params); break;
      case "inventory":  await renderInventory(body); break;
      case "settings":   await renderSettings(body); break;
      default:           await renderDashboard(body); break;
    }
  } catch (err) {
    console.error(`[admin:${page}] failed`, err);
    body.innerHTML = emptyState(
      "Something went wrong",
      err.message || "This admin screen could not load. Check the browser console and try again.",
      '<button class="btn btn--primary" type="button" onclick="location.reload()">Reload</button>'
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

export default boot;