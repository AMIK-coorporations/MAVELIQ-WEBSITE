/* ==========================================================================
   MAVELIQ — js/products.js
   Product card rendering shared across pages, and the full Shop engine:
   search · filters · sorting · pagination · URL state.
   ========================================================================== */

import { CONFIG } from "./config.js";
import { $, $$, formatPrice, escapeHtml, escapeAttr, getParam, withParams, debounce, toast, skeletonCards, discountPercent } from "./utils.js";
import settings from "./services/settings-service.js";
import products from "./services/product-service.js";
import { Cart } from "./cart.js";
import { cardRatingMarkup } from "./reviews.js";
import { wishButtonMarkup, syncWishlistUI } from "./wishlist.js";
import { whatsappEnabled } from "./whatsapp.js";

/* ==========================================================================
   Product card
   ========================================================================== */

/**
 * HTML markup for one product card.
 * @param {Object} p normalised product
 * @param {Object} opts { lazy = true }
 */
export function productCard(p, opts = {}) {
  const { lazy = true } = opts;
  const status = products.stockStatus(p);
  const off = discountPercent(p.price, p.compareAtPrice);
  const img = p.images[0] || "assets/images/ph-other-1.svg";

  const badges = [
    off > 0 ? `<span class="badge badge--sale">−${off}%</span>` : "",
    p.isNew ? `<span class="badge badge--new">New</span>` : "",
    status === "out" ? `<span class="badge badge--out">Out of Stock</span>` : status === "low" ? `<span class="badge badge--low">Limited Stock</span>` : "",
  ].filter(Boolean).join("");

  const hasOptions = (p.variants || []).length > 0;
  const quickAdd = status === "out"
    ? `<button class="btn btn--outline" type="button" disabled>Out of Stock</button>`
    : hasOptions
      ? `<a class="btn btn--primary" href="product.html?id=${encodeURIComponent(p.id)}">Choose Options</a>`
      : `<button class="btn btn--primary" type="button" data-quick-add="${escapeAttr(p.id)}">Add to Cart</button>`;

  return `
  <article class="product-card" data-product-id="${escapeAttr(p.id)}">
    <div class="product-card__media">
      ${badges ? `<div class="product-card__badges">${badges}</div>` : ""}
      ${wishButtonMarkup(p, "product-card__wish")}
      <a href="product.html?id=${encodeURIComponent(p.id)}" tabindex="-1" aria-hidden="true">
        <img src="${escapeAttr(img)}" alt="${escapeAttr(p.altText || p.name)}"
             ${lazy ? 'loading="lazy"' : ""} decoding="async" width="600" height="750" />
      </a>
      <div class="product-card__quick">${quickAdd}</div>
    </div>
    <div class="product-card__body">
      <span class="product-card__cat">${escapeHtml(categoryLabel(p.categoryId))}</span>
      <h3 class="product-card__title"><a href="product.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.name)}</a></h3>
      ${cardRatingMarkup(p)}
      <div class="product-card__price">
        <span class="price">${formatPrice(p.price)}</span>
        ${(p.variants || []).some((g) => g.options.some((o) => Number(o.priceDelta) > 0)) ? `<span class="price-from">from</span>` : ""}
        ${p.compareAtPrice && p.compareAtPrice > p.price ? `<span class="price price--old">${formatPrice(p.compareAtPrice)}</span>` : ""}
      </div>
    </div>
  </article>`;
}

/* Category label cache (filled by renderProductGrid) */
let catCache = [];
export function setCategoryCache(list) { catCache = list || []; }
function categoryLabel(id) {
  return catCache.find((c) => c.id === id)?.name || "Collection";
}

/**
 * Render a grid of product cards with a working quick-add button.
 * @param {HTMLElement} container
 * @param {Array} items
 * @param {Object} opts { skeletonCount, emptyMessage, showSkeletons }
 */
export async function renderProductGrid(container, items, opts = {}) {
  if (!container) return;

  if (!catCache.length) {
    try { setCategoryCache(await products.getCategories()); } catch { /* non-fatal */ }
  }

  if (!items || !items.length) {
    container.innerHTML = opts.emptyMessage || `
      <div class="empty-state" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <h3>No products found</h3>
        <p>No products matched your search. Try another search term or adjust your filters.</p>
        <a class="btn btn--primary" href="shop.html">Browse All Products</a>
      </div>`;
    container.dispatchEvent(new CustomEvent("maveliq:grid-rendered"));
    return;
  }

  // First paint: skeletons, then cards (keeps layout stable on slow loads)
  if (opts.showSkeletons !== false && items.length > 6) {
    container.innerHTML = skeletonCards(Math.min(items.length, 8));
    await new Promise((r) => setTimeout(r, 60));
  }

  container.innerHTML = items.map((p) => productCard(p)).join("");

  // Wire quick-add: products with variants must open the product page first
  container.querySelectorAll("[data-quick-add]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const id = btn.dataset.quickAdd;
      try {
        const product = await products.getProduct(id);
        if (!product) return;
        if ((product.variants || []).length) {
          toast("Choose your shade/size on the product page first.", "info");
          window.location.href = `product.html?id=${encodeURIComponent(id)}`;
          return;
        }
        if (Cart.add(product, {}, 1)) {
          btn.textContent = "Added ✓";
          setTimeout(() => (btn.textContent = "Add to Cart"), 1400);
        }
      } catch (err) {
        console.error(err);
        toast("Could not add to cart. Please try again.", "error");
      }
    });
  });

  syncWishlistUI();
  container.dispatchEvent(new CustomEvent("maveliq:grid-rendered"));
}

/* ==========================================================================
   Homepage sections
   ========================================================================== */

export async function renderHomeSections() {
  const featuredEl = $("#featuredGrid");
  const newArrivalsEl = $("#newGrid");
  const bestEl = $("#bestGrid");
  const offersEl = $("#offersGrid");
  const catsEl = $("#categoryGrid");

  try { setCategoryCache(await products.getCategories()); } catch (e) { console.error(e); }

  const jobs = [];

  const bundlesEl = $("#bundlesGrid");

  /* Sections that could only be filled with invented data stay hidden:
     best sellers need real order data or owner flags, offers need a genuine
     compare-at price. */
  const fillOrHide = (el, list) => {
    const section = el.closest("[data-optional-section]");
    if (!list.length && section) { section.hidden = true; return; }
    if (section) section.hidden = false;
    return renderProductGrid(el, list);
  };

  if (featuredEl) jobs.push(products.getFeatured(8).then((l) => renderProductGrid(featuredEl, l)));
  if (newArrivalsEl) jobs.push(products.getNewArrivals(4).then((l) => fillOrHide(newArrivalsEl, l)));
  if (bundlesEl) jobs.push(products.getProductsByCategory("bundles-kits").then((l) => fillOrHide(bundlesEl, l.slice(0, 8))));
  if (bestEl) {
    jobs.push(products.getProducts().then((all) => fillOrHide(bestEl, all.filter((p) => p.isBestSeller).slice(0, 4))));
  }
  if (offersEl) jobs.push(products.getOffers(4).then((l) => fillOrHide(offersEl, l)));

  if (catsEl) {
    jobs.push(
      products.getCategoryWithCounts().then((list) => {
        catsEl.innerHTML = list
          .slice(0, 8)
          .map(
            (c) => `
          <a class="cat-card" href="shop.html?category=${encodeURIComponent(c.id)}">
            <img src="${escapeAttr(c.image || "assets/images/ph-other-1.svg")}" alt="${escapeHtml(c.name)} category" loading="lazy" decoding="async" />
            <span class="cat-card__label">
              <h3>${escapeHtml(c.name)}</h3>
              <span>${c.productCount} product${c.productCount === 1 ? "" : "s"}</span>
            </span>
          </a>`
          )
          .join("");
      })
    );
  }

  await Promise.allSettled(jobs);

  // Hero copy comes from editable settings
  const h = settings.home;
  const setText = (sel, val) => { const el = $(sel); if (el && val !== undefined && val !== null && val !== "") el.textContent = val; };
  setText("#heroEyebrow", h.heroEyebrow);
  setText("#heroTitle", h.heroTitle);
  setText("#heroAccent", h.heroTitleAccent);
  setText("#heroText", h.heroText);
  const cta = $("#heroCta");
  if (cta && h.heroCta) cta.textContent = h.heroCta;
  const cta2 = $("#heroCta2");
  if (cta2 && h.heroSecondaryCta) cta2.textContent = h.heroSecondaryCta;

  renderTrustStrip();
  renderPartnershipBand();
}

/** Homepage trust strip — every claim comes from settings, nothing invented. */
export function renderTrustStrip() {
  const host = $("#trustStrip");
  if (!host) return;
  const d = settings.delivery;
  const cod = settings.payments?.cod?.enabled;
  const days = String(settings.returns?.windowDays || "").trim();
  const c = settings.contact;
  const rs = (n) => `Rs ${Number(n).toLocaleString(CONFIG.locale)}`;

  const items = [];
  items.push({
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="1" y="6" width="15" height="11" rx="2"/><path d="M16 10h4l3 3v4h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    title: Number(d.freeOver) > 0 ? `Free delivery over ${rs(d.freeOver)}` : "Delivery across Pakistan",
    text: Number(d.freeOver) > 0
      ? `Orders below that ship for ${rs(d.charge)} · ${d.estimatedDays}`
      : `${Number(d.charge) > 0 ? `Flat ${rs(d.charge)}` : "Charges shown at checkout"} · ${d.estimatedDays}`,
  });
  if (cod) {
    items.push({
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/></svg>',
      title: "Cash on Delivery",
      text: "Pay when your order arrives",
    });
  }
  if (whatsappEnabled()) {
    items.push({
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
      title: c.supportHours ? `WhatsApp support · ${c.supportHours}` : "WhatsApp support",
      text: "Order or ask a question on WhatsApp",
      href: "contact.html",
    });
  } else {
    items.push({
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
      title: "Customer support",
      text: "Questions about a product or order? We're here to help",
      href: "contact.html",
    });
  }
  items.push({
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 4v5h5"/></svg>',
    title: "Easy returns",
    text: days ? `Request a return within ${days} days of delivery` : "Clear process — see our returns policy",
    href: "returns-policy.html",
  });

  host.innerHTML = items
    .map((it) => {
      const inner = `${it.icon}<div><strong>${escapeHtml(it.title)}</strong><span>${escapeHtml(it.text)}</span></div>`;
      return it.href
        ? `<a class="value-item value-item--link" href="${escapeAttr(it.href)}">${inner}</a>`
        : `<div class="value-item">${inner}</div>`;
    })
    .join("");
}

/** DIEFEI 3D partnership band (owner-approved copy from CONTENT-SPEC). */
export function renderPartnershipBand() {
  const host = $("#partnershipBand");
  if (!host) return;
  const list = settings.publishedPartnerships;
  if (!list.length) {
    host.hidden = true;
    host.innerHTML = "";
    return;
  }
  host.hidden = false;
  host.innerHTML = list
    .map(
      (p) => `
    <div class="container">
      <div class="partner-band">
        <div class="partner-band__logo">
          ${p.logo ? `<img src="${escapeAttr(p.logo)}" alt="${escapeAttr(p.name)} logo" />` : `<strong>${escapeHtml(p.name.replace(/\s+/g, "").slice(0, 2))}</strong>`}
        </div>
        <div>
          <span class="section-head__eyebrow">Our Partnership</span>
          <h2 class="partner-band__title">Discover ${escapeHtml(p.name)} Products at ${escapeHtml(settings.displayName)}</h2>
          <p class="text-soft">${escapeHtml(p.description)}</p>
          <p class="text-soft">Browse the available ${escapeHtml(p.name)} products to learn about their features, intended uses, and current availability. Each product listing provides relevant information to help you understand what you are purchasing.</p>
        </div>
        <div class="btn-row partner-band__actions">
          <a class="btn btn--primary" href="shop.html?brand=${encodeURIComponent(p.name)}">Explore ${escapeHtml(p.name)} Products</a>
          ${p.page ? `<a class="btn btn--outline" href="${escapeAttr(p.page)}">Learn About Our Partnership</a>` : ""}
          ${p.url ? `<a class="btn btn--ghost" href="${escapeAttr(p.url)}" target="_blank" rel="noopener noreferrer">Visit partner</a>` : ""}
        </div>
      </div>
    </div>`
    )
    .join("");
}

/* ==========================================================================
   Shop page engine
   ========================================================================== */

const state = {
  q: "",
  categories: [],
  brands: [],
  minPrice: null,
  maxPrice: null,
  inStockOnly: false,
  minRating: null,
  sort: "featured",
  page: 1,
  perPage: 12,
};

/** Read initial state from the URL (?q=, ?category=, ?sort= ...). */
function readUrl() {
  state.q = getParam("q", "") || "";
  const cat = getParam("category", "");
  state.categories = cat ? cat.split(",").filter(Boolean) : [];
  const brand = getParam("brand", "");
  state.brands = brand ? brand.split(",").filter(Boolean) : [];
  state.minPrice = getParam("min") !== null ? Number(getParam("min")) : null;
  state.maxPrice = getParam("max") !== null ? Number(getParam("max")) : null;
  state.inStockOnly = getParam("stock") === "in";
  state.sort = getParam("sort", "featured") || "featured";
  state.page = Math.max(1, Number(getParam("page", 1)) || 1);
}

/* Keep the URL shareable / back-button friendly */
function writeUrl(replace = true) {
  const params = {
    q: state.q,
    category: state.categories.join(","),
    brand: state.brands.join(","),
    min: state.minPrice,
    max: state.maxPrice,
    stock: state.inStockOnly ? "in" : "",
    sort: state.sort === "featured" ? "" : state.sort,
    page: state.page > 1 ? state.page : "",
  };
  const url = withParams(window.location.pathname, params);
  if (replace) history.replaceState(null, "", url);
}

export async function initShop() {
  const resultsEl = $("#resultsGrid");
  const countEl = $("#resultsCount");
  const paginationEl = $("#pagination");
  const filtersEl = $("#filtersPanel");
  const activeFiltersEl = $("#activeFilters");
  const sortEl = $("#sortSelect");
  const searchForm = $("#shopSearchForm");
  const searchInput = $("#shopSearchInput");
  const filtersToggle = $("#filtersToggle");

  if (!resultsEl) return;

  readUrl();
  if (searchInput) searchInput.value = state.q;
  const introEl = $("#categoryIntro");
  if (sortEl) sortEl.value = state.sort;

  // Build the filter sidebar from faceted data
  let facetData = { brands: [], minPrice: 0, maxPrice: 0, categories: [] };
  try {
    facetData = await products.facets();
    setCategoryCache(facetData.categories);
    buildFilters(filtersEl, facetData);
    syncFilterUI(filtersEl);
  } catch (e) {
    console.error("Could not build filters", e);
    if (filtersEl) filtersEl.innerHTML = `<p class="text-muted">Filters could not be loaded.</p>`;
  }

  const run = async ({ resetPage = false } = {}) => {
    if (resetPage) state.page = 1;
    writeUrl();
    resultsEl.innerHTML = skeletonCards(8);
    try {
      const result = await products.query(state);
      if (countEl) {
        countEl.innerHTML = `<strong>${result.total}</strong> product${result.total === 1 ? "" : "s"}${state.q ? ` — search results for: “${escapeHtml(state.q)}”` : ""}`;
      }
      await renderProductGrid(resultsEl, result.items, { showSkeletons: false });
      renderPagination(paginationEl, result, (p) => { state.page = p; run(); });
      renderActiveFilters(activeFiltersEl, () => run({ resetPage: true }));
      const landing = renderCategoryIntro(introEl, facetData.categories);
      document.title = state.q
        ? `Search results for: ${state.q} | ${settings.displayName}`
        : landing
          ? `${landing.name} | ${settings.displayName} — Shop Online in Pakistan`
          : `Shop | ${settings.displayName} — Beauty & Personal Care`;
    } catch (e) {
      console.error(e);
      resultsEl.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <h3>Catalogue unavailable</h3>
          <p>We could not load the products right now. Please try again later.</p>
          <button class="btn btn--primary" type="button" onclick="location.reload()">Reload</button>
        </div>`;
    }
  };

  /* Search box */
  searchForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    state.q = searchInput.value.trim();
    run({ resetPage: true });
  });
  searchInput?.addEventListener("input", debounce(() => {
    state.q = searchInput.value.trim();
    run({ resetPage: true });
  }, 400));

  /* Sorting */
  sortEl?.addEventListener("change", () => {
    state.sort = sortEl.value;
    run({ resetPage: true });
  });

  /* Filter interactions (delegated) */
  filtersEl?.addEventListener("change", () => {
    state.categories = $$('input[name="f-category"]:checked', filtersEl).map((i) => i.value);
    state.brands = $$('input[name="f-brand"]:checked', filtersEl).map((i) => i.value);
    state.inStockOnly = Boolean($('input[name="f-stock"]', filtersEl)?.checked);

    const min = $("#f-min", filtersEl), max = $("#f-max", filtersEl);
    state.minPrice = min && min.value !== "" ? Number(min.value) : null;
    state.maxPrice = max && max.value !== "" ? Number(max.value) : null;

    const rating = $('input[name="f-rating"]:checked', filtersEl);
    state.minRating = rating ? Number(rating.value) : null;

    run({ resetPage: true });
  });

  /* Collapsible filter groups + clear + close */
  filtersEl?.addEventListener("click", (e) => {
    const groupBtn = e.target.closest(".filter-group__title");
    if (groupBtn) {
      const open = groupBtn.getAttribute("aria-expanded") === "true";
      groupBtn.setAttribute("aria-expanded", String(!open));
      const body = groupBtn.nextElementSibling;
      if (body) body.hidden = open;
      return;
    }
    if (e.target.closest("#clearFilters")) {
      state.q = ""; state.categories = []; state.brands = [];
      state.minPrice = null; state.maxPrice = null;
      state.inStockOnly = false; state.minRating = null;
      state.sort = "featured";
      if (searchInput) searchInput.value = "";
      if (sortEl) sortEl.value = "featured";
      syncFilterUI(filtersEl);
      run({ resetPage: true });
      return;
    }
    if (e.target.closest("#filtersClose")) {
      filtersEl.classList.remove("is-open");
      document.body.classList.remove("no-scroll");
    }
  });

  /* Mobile filter drawer */
  filtersToggle?.addEventListener("click", () => {
    filtersEl?.classList.add("is-open");
    document.body.classList.add("no-scroll");
  });

  await run();
}

/* ---------- Category landing intro ------------------------------------------------
   When exactly one category is selected (shop.html?category=lipsticks) the shop
   page doubles as that category's landing page: its own heading, intro copy,
   meta description and canonical URL. One HTML file, many landing pages. */

let defaultHero = null;

function renderCategoryIntro(el, categories) {
  const heroTitle = $("#shopTitle");
  const heroText = $("#shopLead");
  if (heroTitle && !defaultHero) defaultHero = { title: heroTitle.textContent, text: heroText?.textContent || "" };

  const single = state.categories.length === 1 && !state.brands.length && !state.q
    ? (categories || []).find((c) => c.id === state.categories[0])
    : null;
  const brandOnly = !single && state.brands.length === 1 && !state.categories.length && !state.q ? state.brands[0] : "";

  const canonical = document.querySelector('link[rel="canonical"]');
  const metaDesc = document.querySelector('meta[name="description"]');

  if (single) {
    if (heroTitle) heroTitle.textContent = single.name;
    if (heroText) heroText.textContent = single.description;
    if (el) {
      el.hidden = !single.intro?.length;
      el.innerHTML = (single.intro || []).map((t) => `<p>${escapeHtml(t)}</p>`).join("");
    }
    if (canonical) canonical.href = `${CONFIG.siteUrl}/shop.html?category=${encodeURIComponent(single.id)}`;
    if (metaDesc) metaDesc.setAttribute("content", `${single.name} at ${settings.displayName}: ${single.description} Prices in PKR with delivery across Pakistan.`);
    return single;
  }

  if (brandOnly) {
    if (heroTitle) heroTitle.textContent = `${brandOnly} Products`;
    if (heroText) heroText.textContent = `Discover the selected ${brandOnly} products available at ${settings.displayName}. Open any listing for its description, options, price and availability.`;
  } else if (defaultHero) {
    if (heroTitle) heroTitle.textContent = defaultHero.title;
    if (heroText) heroText.textContent = defaultHero.text;
  }
  if (el) { el.hidden = true; el.innerHTML = ""; }
  if (canonical) canonical.href = `${CONFIG.siteUrl}/shop.html`;
  return null;
}

/* ---------- Filter UI builders --------------------------------------------------- */

function buildFilters(el, facets) {
  if (!el) return;
  el.innerHTML = `
    <div class="filters__head">
      <h2>Filters</h2>
      <button class="link-btn" type="button" id="clearFilters">Clear all</button>
    </div>

    <div class="filter-group">
      <button class="filter-group__title" type="button" aria-expanded="true">Category
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="filter-group__body">
        ${facets.categories
          .map(
            (c) => `
          <label class="filter-option">
            <input type="checkbox" name="f-category" value="${escapeAttr(c.id)}" />
            <span>${escapeHtml(c.name)}</span>
            <span class="count">${c.count}</span>
          </label>`
          )
          .join("")}
      </div>
    </div>

    ${
      facets.brands.length
        ? `<div class="filter-group">
            <button class="filter-group__title" type="button" aria-expanded="true">Brand
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="filter-group__body">
              ${facets.brands
                .map(
                  (b) => `
                <label class="filter-option">
                  <input type="checkbox" name="f-brand" value="${escapeAttr(b)}" />
                  <span>${escapeHtml(b)}</span>
                </label>`
                )
                .join("")}
            </div>
          </div>`
        : ""
    }

    <div class="filter-group">
      <button class="filter-group__title" type="button" aria-expanded="true">Price (PKR)
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="filter-group__body">
        <div class="price-range">
          <input class="input" id="f-min" type="number" min="0" inputmode="numeric" placeholder="Min" aria-label="Minimum price" />
          <span>—</span>
          <input class="input" id="f-max" type="number" min="0" inputmode="numeric" placeholder="Max" aria-label="Maximum price" />
        </div>
        <p class="price-note" style="margin-top:6px">Range: ${formatPrice(facets.minPrice)} – ${formatPrice(facets.maxPrice)}</p>
      </div>
    </div>

    <div class="filter-group">
      <button class="filter-group__title" type="button" aria-expanded="true">Availability
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="filter-group__body">
        <label class="filter-option">
          <input type="checkbox" name="f-stock" value="in" />
          <span>In stock only</span>
        </label>
      </div>
    </div>

    <div class="filter-group">
      <button class="filter-group__title" type="button" aria-expanded="true">Rating
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="filter-group__body">
        <label class="filter-option"><input type="radio" name="f-rating" value="4" /><span>4★ &amp; up</span></label>
        <label class="filter-option"><input type="radio" name="f-rating" value="3" /><span>3★ &amp; up</span></label>
        <label class="filter-option"><input type="radio" name="f-rating" value="0" checked /><span>Any rating</span></label>
        <p class="price-note" style="margin-top:4px">Rating filters only apply to products with verified reviews.</p>
      </div>
    </div>

    <button class="btn btn--primary btn--block" type="button" id="filtersClose" style="margin-top:16px">Show results</button>
  `;
}

function syncFilterUI(el) {
  if (!el) return;
  $$('input[name="f-category"]', el).forEach((i) => (i.checked = state.categories.includes(i.value)));
  $$('input[name="f-brand"]', el).forEach((i) => (i.checked = state.brands.includes(i.value)));
  const stock = $('input[name="f-stock"]', el);
  if (stock) stock.checked = state.inStockOnly;
  const min = $("#f-min", el), max = $("#f-max", el);
  if (min) min.value = state.minPrice ?? "";
  if (max) max.value = state.maxPrice ?? "";
  const ratingVal = state.minRating !== null ? String(state.minRating) : "0";
  $$('input[name="f-rating"]', el).forEach((i) => (i.checked = i.value === ratingVal));
}

function renderActiveFilters(el, onRemove) {
  if (!el) return;
  const chips = [];
  if (state.q) chips.push({ label: `Search: “${state.q}”`, clear: () => { state.q = ""; const i = $("#shopSearchInput"); if (i) i.value = ""; } });
  state.categories.forEach((id) => {
    const name = catCache.find((c) => c.id === id)?.name || id;
    chips.push({ label: name, clear: () => { state.categories = state.categories.filter((x) => x !== id); } });
  });
  state.brands.forEach((b) => chips.push({ label: b, clear: () => { state.brands = state.brands.filter((x) => x !== b); } }));
  if (state.minPrice !== null) chips.push({ label: `Min ${formatPrice(state.minPrice)}`, clear: () => (state.minPrice = null) });
  if (state.maxPrice !== null) chips.push({ label: `Max ${formatPrice(state.maxPrice)}`, clear: () => (state.maxPrice = null) });
  if (state.inStockOnly) chips.push({ label: "In stock", clear: () => (state.inStockOnly = false) });

  el.innerHTML = chips
    .map(
      (c, idx) => `
    <span class="active-chip">${escapeHtml(c.label)}
      <button type="button" data-chip="${idx}" aria-label="Remove filter ${escapeAttr(c.label)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </span>`
    )
    .join("");

  $$("[data-chip]", el).forEach((btn) => {
    btn.addEventListener("click", () => {
      chips[Number(btn.dataset.chip)]?.clear();
      syncFilterUI($("#filtersPanel"));
      onRemove?.();
    });
  });
}

function renderPagination(el, result, onPage) {
  if (!el) return;
  if (result.pages <= 1) { el.innerHTML = ""; return; }

  const btn = (label, page, opts = {}) =>
    `<button type="button" data-page="${page}" ${opts.disabled ? "disabled" : ""} ${opts.current ? 'aria-current="page"' : ""} ${opts.aria ? `aria-label="${opts.aria}"` : ""}>${label}</button>`;

  const nums = new Set([1, result.pages, result.page - 1, result.page, result.page + 1]);
  const unique = [...nums].filter((p) => p >= 1 && p <= result.pages).sort((a, b) => a - b);

  let html = btn("‹", result.page - 1, { disabled: result.page <= 1, aria: "Previous page" });
  let prev = 0;
  for (const p of unique) {
    if (p - prev > 1) html += `<span class="ellipsis">…</span>`;
    html += btn(String(p), p, { current: p === result.page });
    prev = p;
  }
  html += btn("›", result.page + 1, { disabled: result.page >= result.pages, aria: "Next page" });
  el.innerHTML = html;

  $$("[data-page]", el).forEach((b) =>
    b.addEventListener("click", () => {
      const p = Number(b.dataset.page);
      if (p >= 1 && p <= result.pages && p !== result.page) {
        onPage(p);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    })
  );
}

export default { productCard, renderProductGrid, renderHomeSections, initShop };