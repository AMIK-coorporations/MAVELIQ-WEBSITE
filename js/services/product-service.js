/* ==========================================================================
   MAVELIQ — js/services/product-service.js
   Products + categories.
   • Demo mode: loads data/products.json and data/categories.json, with admin
     edits persisted to localStorage on top.
   • Production: reads the products / categories tables through the backend
     REST API so the storefront always reflects the live catalogue.
   ========================================================================== */

import { CONFIG } from "../config.js";
import { store, slugify } from "../utils.js";
import settings from "./settings-service.js";

const LS_PRODUCTS = "products_override";
const LS_CATEGORIES = "categories_override";

/* ---------- tiny backend REST helper (no SDK required) --------------------- */

async function rest(path, options = {}) {
  const { apiUrl, anonKey } = CONFIG.backend;
  // NOTE: `/rest/v1/` is the backend data-API prefix. Adjust this path
  // (and the auth/functions prefixes in the other services) to match the
  // backend you connect — see README → "Backend (later)".
  const url = `${apiUrl.replace(/\/$/, "")}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Backend request failed (${res.status}): ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/* ---------- Demo catalogue ------------------------------------------------ */

let demoProducts = null;
let demoCategories = null;

async function fetchJson(file) {
  const res = await fetch(`data/${file}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load data/${file} (${res.status})`);
  return res.json();
}

async function loadDemo() {
  if (!demoProducts || !demoCategories) {
    const [p, c] = await Promise.all([fetchJson("products.json"), fetchJson("categories.json")]);
    demoProducts = p.products || [];
    demoCategories = c.categories || [];
  }
  const productOverrides = store.get(LS_PRODUCTS, null);
  const categoryOverrides = store.get(LS_CATEGORIES, null);
  return {
    products: productOverrides || demoProducts,
    categories: categoryOverrides || demoCategories,
  };
}

/* ---------- Normalisation -------------------------------------------------- */

/** Make a raw record (JSON or DB row) safe and consistent for the UI. */
function normaliseProduct(raw) {
  if (!raw) return null;
  return {
    id: String(raw.id),
    name: String(raw.name || "Untitled product"),
    slug: raw.slug || slugify(raw.name || raw.id),
    categoryId: String(raw.categoryId ?? raw.category_id ?? ""),
    brand: raw.brand || "",
    sku: raw.sku || "",
    price: Number(raw.price) || 0,
    compareAtPrice: raw.compareAtPrice ?? raw.compare_at_price ?? null,
    stock: Number(raw.stock ?? 0),
    lowStockThreshold: Number(raw.lowStockThreshold ?? raw.low_stock_threshold ?? settings.get("admin.lowStockDefault", CONFIG.admin.lowStockDefault)),
    images: Array.isArray(raw.images) ? raw.images.filter(Boolean) : [],
    altText: raw.altText || raw.alt_text || raw.name || "Product image",
    shortDescription: raw.shortDescription || raw.short_description || "",
    description: raw.description || "",
    variants: Array.isArray(raw.variants) ? raw.variants : [],
    rating: raw.rating ?? null,
    reviewCount: Number(raw.reviewCount ?? raw.review_count ?? 0),
    featured: Boolean(raw.featured),
    isNew: Boolean(raw.isNew ?? raw.is_new),
    isBestSeller: Boolean(raw.isBestSeller ?? raw.is_best_seller),
    active: raw.active !== false,
    createdAt: raw.createdAt ?? raw.created_at ?? null,
  };
}

function normaliseCategory(raw) {
  if (!raw) return null;
  return {
    id: String(raw.id),
    name: String(raw.name || "Category"),
    slug: raw.slug || slugify(raw.name || raw.id),
    description: raw.description || "",
    image: raw.image || "",
    active: raw.active !== false,
    sortOrder: Number(raw.sortOrder ?? raw.sort_order ?? 99),
  };
}

/* ---------- Public service -------------------------------------------------- */

class ProductService {
  /* ---- Raw fetchers ---------------------------------------------------- */

  async getProducts({ includeInactive = false } = {}) {
    let rows;
    if (!CONFIG.demoMode) {
      rows = await rest("products?select=*&order=created_at.desc");
    } else {
      rows = (await loadDemo()).products;
    }
    const list = rows.map(normaliseProduct).filter(Boolean);
    return includeInactive ? list : list.filter((p) => p.active);
  }

  async getCategories({ includeInactive = false } = {}) {
    let rows;
    if (!CONFIG.demoMode) {
      rows = await rest("categories?select=*&order=sort_order.asc");
    } else {
      rows = (await loadDemo()).categories;
    }
    const list = rows.map(normaliseCategory).filter(Boolean).sort((a, b) => a.sortOrder - b.sortOrder);
    return includeInactive ? list : list.filter((c) => c.active);
  }

  /* ---- Lookups ---------------------------------------------------------- */

  async getProduct(id) {
    const pid = String(id || "");
    const all = await this.getProducts({ includeInactive: true });
    return all.find((p) => p.id === pid || p.slug === pid) || null;
  }

  async getCategory(id) {
    const cid = String(id || "");
    const all = await this.getCategories({ includeInactive: true });
    return all.find((c) => c.id === cid || c.slug === cid) || null;
  }

  async getProductsByCategory(categoryId) {
    const all = await this.getProducts();
    return all.filter((p) => p.categoryId === String(categoryId));
  }

  async getRelated(product, limit = 4) {
    if (!product) return [];
    const all = await this.getProducts();
    const sameCat = all.filter((p) => p.id !== product.id && p.categoryId === product.categoryId);
    const others = all.filter((p) => p.id !== product.id && p.categoryId !== product.categoryId);
    return [...sameCat, ...others].slice(0, limit);
  }

  /* ---- Merchandising sections ------------------------------------------- */

  async getFeatured(limit = 8) {
    const all = await this.getProducts();
    const flagged = all.filter((p) => p.featured);
    return (flagged.length ? flagged : all).slice(0, limit);
  }

  async getNewArrivals(limit = 8) {
    const all = await this.getProducts();
    const flagged = all.filter((p) => p.isNew);
    const pool = flagged.length ? flagged : all;
    return [...pool]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, limit);
  }

  /**
   * Best sellers derived from GENUINE order data only.
   * In production this aggregates the orders table; in demo mode it falls back
   * to products flagged by the admin — no invented sales figures.
   */
  async getBestSellers(limit = 8) {
    const all = await this.getProducts();
    if (!CONFIG.demoMode) {
      try {
        const rows = await rest("rpc/best_sellers", { method: "POST", body: JSON.stringify({ limit_n: limit }) });
        if (Array.isArray(rows) && rows.length) {
          const byId = new Map(all.map((p) => [p.id, p]));
          return rows.map((r) => byId.get(String(r.product_id))).filter(Boolean).slice(0, limit);
        }
      } catch (e) {
        console.warn("best_sellers RPC unavailable, using admin flags", e);
      }
    }
    const flagged = all.filter((p) => p.isBestSeller);
    return (flagged.length ? flagged : all).slice(0, limit);
  }

  async getOffers(limit = 8) {
    const all = await this.getProducts();
    return all
      .filter((p) => p.compareAtPrice && p.compareAtPrice > p.price)
      .sort((a, b) => (b.compareAtPrice - b.price) - (a.compareAtPrice - a.price))
      .slice(0, limit);
  }

  async getCategoryWithCounts() {
    const [cats, products] = await Promise.all([this.getCategories(), this.getProducts()]);
    return cats.map((c) => ({
      ...c,
      productCount: products.filter((p) => p.categoryId === c.id).length,
    }));
  }

  /* ---- Search / filter / sort / paginate ---------------------------------- */

  /**
   * @param {Object} opts
   *   q          search text (name, brand, category, keywords)
   *   categories array of category ids
   *   brands     array of brand names
   *   minPrice / maxPrice numbers
   *   inStockOnly boolean
   *   minRating  number (only applied when genuine ratings exist)
   *   sort       featured | newest | price-asc | price-desc | rating | name
   *   page       1-based page number
   *   perPage    items per page
   * @returns {{items, total, page, pages, appliedFilters}}
   */
  async query(opts = {}) {
    const {
      q = "", categories = [], brands = [], minPrice = null, maxPrice = null,
      inStockOnly = false, minRating = null, sort = "featured",
      page = 1, perPage = 12,
    } = opts;

    const [products, cats] = await Promise.all([this.getProducts(), this.getCategories()]);
    const catName = new Map(cats.map((c) => [c.id, c.name]));
    const term = String(q).trim().toLowerCase();

    let list = products.filter((p) => {
      if (term) {
        const hay = [p.name, p.brand, p.shortDescription, p.description, catName.get(p.categoryId) || ""]
          .join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (categories.length && !categories.includes(p.categoryId)) return false;
      if (brands.length && !brands.includes(p.brand)) return false;
      if (minPrice !== null && p.price < minPrice) return false;
      if (maxPrice !== null && p.price > maxPrice) return false;
      if (inStockOnly && p.stock <= 0) return false;
      if (minRating !== null && minRating > 0) {
        // Ratings only count when genuine reviews exist
        if (!p.rating || p.rating < minRating) return false;
      }
      return true;
    });

    const sorters = {
      "featured":   (a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name),
      "newest":     (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      "price-asc":  (a, b) => a.price - b.price,
      "price-desc": (a, b) => b.price - a.price,
      "rating":     (a, b) => (b.rating || 0) - (a.rating || 0),
      "name":       (a, b) => a.name.localeCompare(b.name),
    };
    list.sort(sorters[sort] || sorters.featured);

    const total = list.length;
    const perPageSafe = Math.max(1, Number(perPage) || 12);
    const pages = Math.max(1, Math.ceil(total / perPageSafe));
    const pageSafe = Math.min(Math.max(1, Number(page) || 1), pages);
    const start = (pageSafe - 1) * perPageSafe;

    return {
      items: list.slice(start, start + perPageSafe),
      total,
      page: pageSafe,
      pages,
      appliedFilters: {
        q, categories, brands, minPrice, maxPrice, inStockOnly, minRating, sort,
      },
    };
  }

  /** Facets for the filter sidebar (brands + price bounds + counts). */
  async facets() {
    const [products, cats] = await Promise.all([this.getProducts(), this.getCategories()]);
    const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))].sort();
    const prices = products.map((p) => p.price);
    return {
      brands,
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      categories: cats.map((c) => ({
        ...c,
        count: products.filter((p) => p.categoryId === c.id).length,
      })),
    };
  }

  /* ---- Stock & pricing helpers --------------------------------------------- */

  /** Effective unit price including a chosen variant's price delta. */
  unitPrice(product, variantSelection = {}) {
    let price = Number(product?.price) || 0;
    for (const group of product?.variants || []) {
      const chosen = variantSelection[group.name];
      if (!chosen) continue;
      const opt = group.options.find((o) => o.label === chosen);
      if (opt) price += Number(opt.priceDelta) || 0;
    }
    return price;
  }

  /** Remaining stock for a specific variant combination. */
  stockFor(product, variantSelection = {}) {
    if (!product) return 0;
    const groups = product.variants || [];
    if (!groups.length) return product.stock;
    // Stock is limited by the smallest matching variant option
    let stock = product.stock;
    for (const group of groups) {
      const chosen = variantSelection[group.name];
      if (!chosen) continue;
      const opt = group.options.find((o) => o.label === chosen);
      if (opt && typeof opt.stock === "number") stock = Math.min(stock, opt.stock);
    }
    return stock;
  }

  stockStatus(product) {
    const s = Number(product?.stock) || 0;
    if (s <= 0) return "out";
    const threshold = Number(product?.lowStockThreshold) || settings.get("admin.lowStockDefault", 5);
    return s <= threshold ? "low" : "in";
  }

  /* ---- Admin-side writes (demo mode only; production uses backend) -------- */

  async saveProduct(record) {
    if (CONFIG.demoMode) {
      const all = await this.getProducts({ includeInactive: true });
      const idx = all.findIndex((p) => p.id === record.id);
      const normalised = normaliseProduct({ ...record });
      if (idx >= 0) all[idx] = normalised; else all.unshift(normalised);
      store.set(LS_PRODUCTS, all);
      return normalised;
    }
    // Production: upsert through backend with the anon key; the DB policy
    // restricts writes to the admin role.
    const row = {
      id: record.id,
      name: record.name,
      slug: record.slug || slugify(record.name),
      category_id: record.categoryId,
      brand: record.brand || null,
      sku: record.sku || null,
      price: record.price,
      compare_at_price: record.compareAtPrice || null,
      stock: record.stock,
      low_stock_threshold: record.lowStockThreshold,
      images: record.images || [],
      alt_text: record.altText || null,
      short_description: record.shortDescription || null,
      description: record.description || null,
      variants: record.variants || [],
      featured: !!record.featured,
      is_new: !!record.isNew,
      is_best_seller: !!record.isBestSeller,
      active: record.active !== false,
    };
    await rest("products", { method: "POST", body: JSON.stringify(row), headers: { Prefer: "resolution=merge-duplicates,return=representation" } });
    return normaliseProduct(row);
  }

  async deleteProduct(id) {
    if (CONFIG.demoMode) {
      const all = await this.getProducts({ includeInactive: true });
      store.set(LS_PRODUCTS, all.filter((p) => p.id !== id));
      return true;
    }
    await rest(`products?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    return true;
  }

  async saveCategory(record) {
    if (CONFIG.demoMode) {
      const all = await this.getCategories({ includeInactive: true });
      const idx = all.findIndex((c) => c.id === record.id);
      const normalised = normaliseCategory(record);
      if (idx >= 0) all[idx] = normalised; else all.push(normalised);
      store.set(LS_CATEGORIES, all);
      return normalised;
    }
    const row = {
      id: record.id,
      name: record.name,
      slug: record.slug || slugify(record.name),
      description: record.description || null,
      image: record.image || null,
      sort_order: record.sortOrder ?? 99,
      active: record.active !== false,
    };
    await rest("categories", { method: "POST", body: JSON.stringify(row), headers: { Prefer: "resolution=merge-duplicates,return=representation" } });
    return normaliseCategory(row);
  }

  async deleteCategory(id) {
    if (CONFIG.demoMode) {
      const all = await this.getCategories({ includeInactive: true });
      store.set(LS_CATEGORIES, all.filter((c) => c.id !== id));
      return true;
    }
    await rest(`categories?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    return true;
  }

  /** Reset demo-mode overrides (admin "restore defaults" action). */
  resetDemoOverrides() {
    store.remove(LS_PRODUCTS);
    store.remove(LS_CATEGORIES);
  }
}

export const products = new ProductService();
export default products;