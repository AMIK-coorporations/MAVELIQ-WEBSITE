/* ==========================================================================
   MAVELIQ — js/cart.js
   Shopping cart (localStorage persistence for the prototype).

   IMPORTANT (PRD §10): browser cart data is a convenience only. Prices,
   quantities, variants, inventory and discounts are re-validated server-side
   during checkout — browser data is never treated as authoritative.

   Exposes:
     Cart.get() / add / updateQuantity / setVariant / remove / clear
     Cart.subtotal / deliveryCharge / discount / total
     renderCartPage() for cart.html
   ========================================================================== */

import { $, $$, formatPrice, escapeHtml, escapeAttr, toast } from "./utils.js";
import settings from "./services/settings-service.js";
import products from "./services/product-service.js";

const CART_KEY = "cart";
const DISCOUNT_KEY = "cart_discount";

/* ---------- Storage helpers ------------------------------------------------- */

function read() {
  try {
    const raw = localStorage.getItem(`maveliq:${CART_KEY}`);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list) {
  localStorage.setItem(`maveliq:${CART_KEY}`, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("maveliq:cart-updated"));
}

/** Stable key for a product + variant combination. */
function lineKey(productId, variant = {}) {
  const v = Object.keys(variant || {})
    .sort()
    .map((k) => `${k}:${variant[k]}`)
    .join("|");
  return `${productId}::${v}`;
}

/* ---------- Cart API ----------------------------------------------------------- */

export const Cart = {
  get() {
    return read();
  },

  count() {
    return read().reduce((n, l) => n + (Number(l.quantity) || 0), 0);
  },

  isEmpty() {
    return read().length === 0;
  },

  /**
   * Add a product (or increase its quantity).
   * @param {Object} product  catalogue product object
   * @param {Object} variant  { groupName: optionLabel }
   * @param {number} quantity
   */
  add(product, variant = {}, quantity = 1) {
    if (!product) return;
    if (product.stock <= 0) {
      toast("This product is out of stock.", "error");
      return;
    }
    const list = read();
    const key = lineKey(product.id, variant);
    const existing = list.find((l) => l.key === key);
    const qty = Math.max(1, Number(quantity) || 1);

    const available = products.stockFor(product, variant);
    if (existing) {
      const newQty = Math.min(existing.quantity + qty, available);
      if (newQty === existing.quantity) {
        toast(`Only ${available} left of "${product.name}".`, "info");
        return;
      }
      existing.quantity = newQty;
    } else {
      if (qty > available) {
        toast(available <= 0 ? "This product is out of stock." : `Only ${available} left in stock.`, "info");
      }
      list.push({
        key,
        productId: product.id,
        name: product.name,
        image: product.images[0] || "",
        altText: product.altText || product.name,
        unitPrice: products.unitPrice(product, variant),
        compareAtPrice: product.compareAtPrice || null,
        variant: { ...variant },
        quantity: Math.min(qty, available),
        addedAt: new Date().toISOString(),
      });
    }
    write(list);
    toast(`Added "${product.name}" to your cart.`, "success");
  },

  updateQuantity(key, quantity) {
    const list = read();
    const line = list.find((l) => l.key === key);
    if (!line) return;
    const qty = Number(quantity) || 1;
    line.quantity = Math.max(1, qty);
    write(list);
  },

  /** Change a line's variant selection (rebuilds its key, merges duplicates). */
  setVariant(key, variant) {
    const list = read();
    const idx = list.findIndex((l) => l.key === key);
    if (idx < 0) return;
    const line = list[idx];
    const merged = { ...(line.variant || {}), ...variant };
    const newKey = lineKey(line.productId, merged);

    const dupIndex = list.findIndex((l, i) => i !== idx && l.key === newKey);
    if (dupIndex >= 0) {
      // Same combination already in the cart — merge the quantities
      list[dupIndex].quantity += line.quantity;
      list.splice(idx, 1);
    } else {
      line.variant = merged;
      line.key = newKey;
    }
    write(list);
  },

  remove(key) {
    write(read().filter((l) => l.key !== key));
  },

  clear() {
    write([]);
    localStorage.removeItem(`maveliq:${DISCOUNT_KEY}`);
  },

  /* ---- Totals --------------------------------------------------------------- */

  /** Recompute line totals against the live catalogue (catches price changes). */
  async refreshPrices() {
    const list = read();
    let priceChanged = false;
    let droppedUnavailable = false;
    for (const line of list) {
      const product = await products.getProduct(line.productId);
      if (!product || !product.active) {
        // Item no longer available — drop it and tell the customer honestly.
        line.quantity = 0;
        droppedUnavailable = true;
        continue;
      }
      const price = products.unitPrice(product, line.variant || {});
      if (price !== line.unitPrice) {
        line.unitPrice = price;
        priceChanged = true;
      }
      const cap = products.stockFor(product, line.variant || {});
      if (line.quantity > cap) {
        if (cap <= 0) droppedUnavailable = true;
        line.quantity = Math.max(0, cap);
        priceChanged = true;
      }
    }
    const cleaned = list.filter((l) => l.quantity > 0);
    if (cleaned.length !== list.length || priceChanged) write(cleaned);
    if (droppedUnavailable) {
      toast("This item is currently unavailable. Remove it or choose another available option.", "error");
    } else if (priceChanged) {
      toast("The price of an item has changed. Review your updated total before continuing.", "info");
    }
    return cleaned;
  },

  subtotal(list = read()) {
    return list.reduce((sum, l) => sum + (Number(l.unitPrice) || 0) * (Number(l.quantity) || 0), 0);
  },

  /** Amount saved versus compare-at prices, when genuinely applicable. */
  savings(list = read()) {
    return list.reduce((sum, l) => {
      if (!l.compareAtPrice || l.compareAtPrice <= l.unitPrice) return sum;
      return sum + (l.compareAtPrice - l.unitPrice) * (Number(l.quantity) || 0);
    }, 0);
  },

  get discountCode() {
    return localStorage.getItem(`maveliq:${DISCOUNT_KEY}`) || "";
  },

  set discountCode(code) {
    if (code) localStorage.setItem(`maveliq:${DISCOUNT_KEY}`, code);
    else localStorage.removeItem(`maveliq:${DISCOUNT_KEY}`);
  },

  /** Discount value based on settings-configured codes (demo preview). */
  discount(list = read()) {
    const code = this.discountCode;
    if (!code) return 0;
    const codes = settings.get("discountCodes", {}) || {};
    const rule = codes[code];
    if (!rule) return 0;
    const sub = this.subtotal(list);
    return rule.type === "percent"
      ? Math.round((sub * Number(rule.value)) / 100)
      : Math.min(Number(rule.value) || 0, sub);
  },

  deliveryCharge(list = read()) {
    const d = settings.delivery;
    const sub = this.subtotal(list);
    if (d.freeOver > 0 && sub >= d.freeOver) return 0;
    return Number(d.charge) || 0;
  },

  total(list = read()) {
    return Math.max(0, this.subtotal(list) - this.discount(list)) + (this.isEmpty() ? 0 : this.deliveryCharge(list));
  },

  /** Payload for checkout/order placement. */
  toOrderItems(list = read()) {
    return list.map((l) => ({
      productId: l.productId,
      name: l.name,
      variant: l.variant || {},
      quantity: l.quantity,
    }));
  },
};

export default Cart;

/* ==========================================================================
   Cart page rendering
   ========================================================================== */

const qtyControl = (line) => `
  <div class="qty" data-key="${escapeHtml(line.key)}">
    <button type="button" data-qty-delta="-1" aria-label="Decrease quantity">−</button>
    <input type="number" inputmode="numeric" min="1" value="${line.quantity}"
           aria-label="Quantity for ${escapeHtml(line.name)}" data-qty-input />
    <button type="button" data-qty-delta="1" aria-label="Increase quantity">+</button>
  </div>`;

const variantChips = (line) => {
  const entries = Object.entries(line.variant || {});
  if (!entries.length) return "";
  return `<span class="cart-item__variant">${entries
    .map(([k, v]) => `${escapeHtml(k)}: <strong>${escapeHtml(v)}</strong>`)
    .join(" &nbsp;·&nbsp; ")}</span>`;
};

/** Per-line variant dropdowns, built from the product's variant groups. */
const variantEditor = (line, product) => {
  const groups = product?.variants || [];
  if (!groups.length) return "";
  return `
    <div class="variant-group" style="margin:8px 0 0">
      <div class="variant-options">
        ${groups
          .map((g) => {
            const current = line.variant?.[g.name] ?? "";
            return `
            <label class="chip" style="gap:6px">
              <span class="sr-only">${escapeHtml(g.name)}</span>
              <select data-variant-group="${escapeAttr(g.name)}"
                      style="border:0;background:transparent;font-size:inherit;color:inherit;cursor:pointer">
                ${g.options
                  .map(
                    (o) => `<option value="${escapeAttr(o.label)}" ${o.label === current ? "selected" : ""}
                               ${(o.stock ?? 1) <= 0 ? 'disabled' : ""}>${escapeHtml(g.name)}: ${escapeHtml(o.label)}${(o.stock ?? 1) <= 0 ? " (out)" : ""}</option>`
                  )
                  .join("")}
              </select>
            </label>`;
          })
          .join("")}
      </div>
    </div>`;
};

/**
 * Render the cart page UI into the given containers.
 * Safe to call more than once — listeners are attached a single time and a
 * `maveliq:cart-refresh` event repaints on demand (used by the promo-code box).
 * @param {Object} refs { itemsEl, emptyEl, layoutEl, summaryEl, onCheckout }
 */
export function renderCartPage(refs) {
  const { itemsEl, emptyEl, layoutEl, summaryEl, onCheckout } = refs;
  if (!itemsEl) return { refresh: () => {} };

  let productCache = {};

  const paint = async () => {
    const list = await Cart.refreshPrices();

    if (!list.length) {
      if (layoutEl) layoutEl.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (layoutEl) layoutEl.hidden = false;
    if (emptyEl) emptyEl.hidden = true;

    // Fetch the products for variant dropdowns (cached per product)
    await Promise.all(
      [...new Set(list.map((l) => l.productId))].map(async (pid) => {
        if (!productCache[pid]) {
          try { productCache[pid] = await products.getProduct(pid); }
          catch { productCache[pid] = null; }
        }
      })
    );

    itemsEl.innerHTML = list
      .map(
        (l) => `
      <article class="cart-item" data-key="${escapeHtml(l.key)}">
        <a class="cart-item__media" href="product.html?id=${encodeURIComponent(l.productId)}">
          <img src="${escapeHtml(l.image)}" alt="${escapeHtml(l.altText || l.name)}" loading="lazy" />
        </a>
        <div class="cart-item__body">
          <h3 class="cart-item__title">
            <a href="product.html?id=${encodeURIComponent(l.productId)}">${escapeHtml(l.name)}</a>
          </h3>
          ${variantChips(l)}
          ${variantEditor(l, productCache[l.productId])}
          <span class="cart-item__unit">${formatPrice(l.unitPrice)} each${l.compareAtPrice && l.compareAtPrice > l.unitPrice ? ` · <s>${formatPrice(l.compareAtPrice)}</s>` : ""}</span>
          <div class="cart-item__actions">
            ${qtyControl(l)}
          </div>
        </div>
        <div class="cart-item__aside">
          <span class="cart-item__total">${formatPrice(l.unitPrice * l.quantity)}</span>
          <button class="link-btn" type="button" data-remove>Remove</button>
        </div>
      </article>`
      )
      .join("");

    paintSummary(list);
  };

  const paintSummary = (list) => {
    if (!summaryEl) return;
    const sub = Cart.subtotal(list);
    const disc = Cart.discount(list);
    const delivery = Cart.deliveryCharge(list);
    const total = sub - disc + delivery;
    const d = settings.delivery;
    const remaining = d.freeOver > 0 ? Math.max(0, d.freeOver - sub) : 0;

    summaryEl.innerHTML = `
      <h2>Order Summary</h2>
      <div class="summary__row"><span>Subtotal (${Cart.count()} item${Cart.count() === 1 ? "" : "s"})</span><strong>${formatPrice(sub)}</strong></div>
      ${disc > 0 ? `<div class="summary__row"><span>Discount ${Cart.discountCode ? `(<code>${escapeHtml(Cart.discountCode)}</code>)` : ""}</span><strong class="save">− ${formatPrice(disc)}</strong></div>` : ""}
      <div class="summary__row"><span>Delivery</span><strong>${delivery === 0 ? "Free" : formatPrice(delivery)}</strong></div>

      ${
        remaining > 0
          ? `<div class="ship-progress">
              <p class="ship-progress__text">Add <strong>${formatPrice(remaining)}</strong> more for free delivery.</p>
              <div class="ship-progress__bar"><div class="ship-progress__fill" style="width:${Math.min(100, (sub / d.freeOver) * 100).toFixed(1)}%"></div></div>
            </div>`
          : d.freeOver > 0
            ? `<p class="price-note" style="color:var(--c-success)">✓ You qualify for free delivery.</p>`
            : ""
      }

      <div class="summary__row summary__row--total"><span>Total payable</span><strong>${formatPrice(total)}</strong></div>

      <button class="btn btn--primary btn--block btn--lg" type="button" id="goCheckout">Proceed to Checkout</button>
      <a class="btn btn--ghost btn--block" href="shop.html" style="margin-top:12px">Continue shopping</a>
      <p class="summary__note">Delivery: ${escapeHtml(d.estimatedDays)} · ${escapeHtml(d.areas)}</p>`;

    summaryEl.querySelector("#goCheckout")?.addEventListener("click", () => {
      if (typeof onCheckout === "function") onCheckout();
      else window.location.href = "checkout.html";
    });
  };

  /* ---- Wire listeners once ------------------------------------------------ */
  if (itemsEl.dataset.maveliqWired !== "1") {
    itemsEl.dataset.maveliqWired = "1";

    itemsEl.addEventListener("click", (e) => {
      const row = e.target.closest(".cart-item");
      if (!row) return;
      const key = row.dataset.key;

      const deltaBtn = e.target.closest("[data-qty-delta]");
      if (deltaBtn) {
        const line = Cart.get().find((l) => l.key === key);
        if (!line) return;
        const next = line.quantity + Number(deltaBtn.dataset.qtyDelta);
        if (next < 1) return;
        Cart.updateQuantity(key, next);
        paint();
        return;
      }

      if (e.target.closest("[data-remove]")) {
        Cart.remove(key);
        toast("Item removed from your cart.", "info");
        paint();
      }
    });

    itemsEl.addEventListener("change", (e) => {
      const row = e.target.closest(".cart-item");
      const key = row?.dataset.key;
      if (!key) return;

      // Quantity input
      if (e.target.matches("[data-qty-input]")) {
        Cart.updateQuantity(key, e.target.value);
        paint();
        return;
      }

      // Variant dropdown
      const groupSelect = e.target.closest("[data-variant-group]");
      if (groupSelect) {
        Cart.setVariant(key, { [groupSelect.dataset.variantGroup]: groupSelect.value });
        toast("Cart updated.", "success", 1800);
        paint();
      }
    });

    // External refresh requests (e.g. promo-code box on cart.html)
    window.addEventListener("maveliq:cart-refresh", () => paint());
  }

  paint();
  return { refresh: paint };
}