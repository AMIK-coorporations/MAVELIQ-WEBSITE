/* ==========================================================================
   MAVELIQ — js/product-detail.js
   Product detail page (product.html?id=...):
     • gallery + thumbnails
     • variant selection with per-variant stock and price deltas
     • quantity stepper bounded by live stock
     • Add to Cart / Buy Now
     • details accordion (delivery, returns, ingredients — only when supplied)
     • related products
     • genuine reviews (never fabricated) + review submission
     • Product structured data (JSON-LD) for SEO
     ========================================================================== */

import { CONFIG } from "./config.js";
import { $, $$, getParam, formatPrice, escapeHtml, escapeAttr, toast, discountPercent } from "./utils.js";
import settings from "./services/settings-service.js";
import products from "./services/product-service.js";
import { Cart } from "./cart.js";
import { renderProductGrid } from "./products.js";
import reviews, { renderReviewList, starsMarkup } from "./reviews.js";
import { wishButtonMarkup, syncWishlistUI } from "./wishlist.js";
import { orderButtonMarkup, buildOrderMessage, openWhatsApp } from "./whatsapp.js";

let currentProduct = null;
let selection = {};     // { groupName: optionLabel }
let qty = 1;

/* ---------- Gallery -------------------------------------------------------------- */

function initGallery(product) {
  const main = $("#galleryMain");
  const thumbs = $("#galleryThumbs");
  if (!main) return;

  const images = product.images.length ? product.images : ["assets/images/ph-other-1.svg"];
  main.src = images[0];
  main.alt = product.altText || product.name;

  if (images.length < 2) {
    if (thumbs) thumbs.hidden = true;
    return;
  }

  thumbs.innerHTML = images
    .map(
      (src, i) => `
    <button class="gallery__thumb" type="button" data-src="${escapeAttr(src)}"
            aria-label="View image ${i + 1} of ${images.length}" ${i === 0 ? 'aria-current="true"' : ""}>
      <img src="${escapeAttr(src)}" alt="" loading="lazy" />
    </button>`
    )
    .join("");

  thumbs.addEventListener("click", (e) => {
    const btn = e.target.closest(".gallery__thumb");
    if (!btn) return;
    main.src = btn.dataset.src;
    $$(".gallery__thumb", thumbs).forEach((t) => t.removeAttribute("aria-current"));
    btn.setAttribute("aria-current", "true");
  });
}

/* ---------- Variants ---------------------------------------------------------------- */

function renderVariants(product) {
  const host = $("#variantHost");
  if (!host) return;

  if (!product.variants.length) {
    host.innerHTML = "";
    selection = {};
    return;
  }

  // Default-select the first option of required groups (in stock where possible)
  product.variants.forEach((group) => {
    if (!selection[group.name]) {
      const inStock = group.options.find((o) => (o.stock ?? 1) > 0);
      selection[group.name] = (inStock || group.options[0]).label;
    }
  });

  host.innerHTML = product.variants
    .map((group) => {
      const chosen = selection[group.name];
      return `
      <div class="variant-group" data-group="${escapeAttr(group.name)}">
        <span class="variant-group__label">${escapeHtml(group.name)}: <strong>${escapeHtml(chosen || "—")}</strong></span>
        <div class="variant-options" role="radiogroup" aria-label="${escapeAttr(group.name)}">
          ${group.options
            .map((o) => {
              const out = (o.stock ?? 1) <= 0;
              const active = o.label === chosen;
              const swatch = o.swatch
                ? `<span style="width:16px;height:16px;border-radius:50%;background:${escapeAttr(o.swatch)};display:inline-block;border:1px solid rgba(0,0,0,.15)"></span>`
                : "";
              return `
              <button class="chip ${active ? "is-active" : ""}" type="button"
                      role="radio" aria-checked="${active}" data-option="${escapeAttr(o.label)}"
                      ${out ? "disabled title='Out of stock'" : ""}
                      style="${out ? "opacity:.45;cursor:not-allowed" : ""}">
                ${swatch}${escapeHtml(o.label)}${out ? " (out)" : ""}
              </button>`;
            })
            .join("")}
        </div>
      </div>`;
    })
    .join("");

  // Attach the selection handler once (innerHTML swaps reuse the same node)
  if (host.dataset.variantsWired !== "1") {
    host.dataset.variantsWired = "1";
    host.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-option]");
      if (!btn || btn.disabled) return;
      const group = btn.closest(".variant-group")?.dataset.group;
      if (!group) return;
      selection[group] = btn.dataset.option;
      renderVariants(product);
      updateBuyRow(product);
    });
  }
}

/* ---------- Price / stock / quantity ------------------------------------------------- */

function currentStock(product) {
  return products.stockFor(product, selection);
}

function updateBuyRow(product) {
  const price = products.unitPrice(product, selection);
  const priceEl = $("#pdpPrice");
  if (priceEl) priceEl.textContent = formatPrice(price);

  const oldEl = $("#pdpOldPrice");
  if (oldEl) {
    const hasSale = product.compareAtPrice && product.compareAtPrice > price;
    oldEl.hidden = !hasSale;
    if (hasSale) oldEl.textContent = formatPrice(product.compareAtPrice);
  }

  const saveEl = $("#pdpSave");
  if (saveEl) {
    const off = discountPercent(price, product.compareAtPrice);
    saveEl.hidden = off <= 0;
    if (off > 0) saveEl.textContent = `Save ${off}%`;
  }

  const stock = currentStock(product);
  const line = $("#stockLine");
  if (line) {
    if (stock <= 0) {
      line.className = "stock-line stock-line--out";
      line.innerHTML = '<span class="stock-dot"></span> Out of stock';
    } else if (stock <= (product.lowStockThreshold || 5)) {
      line.className = "stock-line stock-line--low";
      line.innerHTML = `<span class="stock-dot"></span> Only ${stock} left in stock`;
    } else {
      line.className = "stock-line stock-line--in";
      line.innerHTML = '<span class="stock-dot"></span> In stock';
    }
  }

  // Quantity bounds
  const input = $("#qtyInput");
  if (input) {
    qty = Math.min(Math.max(1, qty), Math.max(1, stock));
    input.value = qty;
    input.max = Math.max(1, stock);
  }

  // Buttons
  const addBtn = $("#addToCart");
  const buyBtn = $("#buyNow");
  if (stock <= 0) {
    addBtn?.setAttribute("disabled", "");
    buyBtn?.setAttribute("disabled", "");
    if (addBtn) addBtn.textContent = "Out of Stock";
    $("#waOrderProduct")?.setAttribute("disabled", "");
  } else {
    addBtn?.removeAttribute("disabled");
    buyBtn?.removeAttribute("disabled");
    $("#waOrderProduct")?.removeAttribute("disabled");
    if (addBtn) addBtn.textContent = "Add to Cart";
  }
}

function initQty(product) {
  const wrap = $("#qtyStepper");
  if (!wrap) return;
  const input = $("#qtyInput", wrap);

  wrap.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-delta]");
    if (!btn) return;
    const stock = currentStock(product);
    const next = qty + Number(btn.dataset.delta);
    if (next < 1 || next > stock) {
      if (next > stock) toast(`Only ${stock} available.`, "info");
      return;
    }
    qty = next;
    input.value = qty;
  });

  input?.addEventListener("change", () => {
    const stock = currentStock(product);
    let v = parseInt(input.value, 10);
    if (Number.isNaN(v) || v < 1) v = 1;
    if (v > stock) { v = stock; toast(`Only ${stock} available.`, "info"); }
    qty = v;
    input.value = qty;
  });
}

/* ---------- Details accordion ---------------------------------------------------------- */

function renderDetails(product) {
  const host = $("#detailAccordion");
  if (!host) return;

  const d = settings.delivery;
  const items = [];

  items.push({
    title: "About This Product",
    body: `<p>${escapeHtml(product.description || product.shortDescription || "Description coming soon.")}</p>`,
    open: true,
  });

  // Key details from verified catalogue data only
  const sizes = (product.variants || []).map((g) => `${escapeHtml(g.name)}: ${g.options.map((o) => escapeHtml(o.label)).join(", ")}`);
  items.push({
    title: "Key Details",
    body: `<ul class="list-check">
        ${product.brand ? `<li>Brand: <strong>${escapeHtml(product.brand)}</strong></li>` : ""}
        ${sizes.map((t) => `<li>${t}</li>`).join("")}
        ${product.sku ? `<li>SKU: ${escapeHtml(product.sku)}</li>` : ""}
      </ul>
      <p class="price-note">Product information is provided to help customers make informed choices. Please follow the manufacturer's instructions and precautions printed on the pack.</p>`,
  });

  // Only render when the owner has supplied real content — no invented claims
  if (product.ingredients) {
    items.push({ title: "Ingredients", body: `<p>${escapeHtml(product.ingredients)}</p>` });
  }
  if (product.usage) {
    items.push({ title: "How to use", body: `<p>${escapeHtml(product.usage)}</p>` });
  }
  if (product.warnings) {
    items.push({ title: "Warnings & storage", body: `<p>${escapeHtml(product.warnings)}</p>` });
  }
  if (product.expiryInfo) {
    items.push({ title: "Expiry", body: `<p>${escapeHtml(product.expiryInfo)}</p>` });
  }

  items.push({
    title: "Delivery Information",
    body: `
      <ul class="list-check">
        <li>${escapeHtml(d.areas)}</li>
        <li>Estimated delivery: <strong>${escapeHtml(d.estimatedDays)}</strong></li>
        <li>Delivery charge: <strong>${d.freeOver > 0 ? `Free over Rs ${Number(d.freeOver).toLocaleString(CONFIG.locale)}` : `Rs ${Number(d.charge).toLocaleString(CONFIG.locale)}`}</strong></li>
        <li>${settings.payments.cod?.enabled ? "Cash on Delivery available" : "Online payment only (COD not currently offered)"}</li>
      </ul>`,
  });

  items.push({
    title: "Returns Information",
    body: `<p>Please review our <a href="returns-policy.html">Returns and Refund Policy</a> before ordering. Eligibility depends on the published policy and applicable requirements.</p>`,
  });

  host.innerHTML = items
    .map(
      (it, i) => `
    <div class="accordion__item">
      <button class="accordion__trigger" type="button" aria-expanded="${it.open ? "true" : "false"}" id="acc-t-${i}">
        ${escapeHtml(it.title)}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </button>
      <div class="accordion__panel" id="acc-p-${i}" ${it.open ? "" : "hidden"}>${it.body}</div>
    </div>`
    )
    .join("");

  if (host.dataset.accordionWired !== "1") {
    host.dataset.accordionWired = "1";
    host.addEventListener("click", (e) => {
      const btn = e.target.closest(".accordion__trigger");
      if (!btn) return;
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      const idx = btn.id.replace("acc-t-", "");
      const panel = document.getElementById(`acc-p-${idx}`) || btn.nextElementSibling;
      if (panel) panel.hidden = open;
    });
  }
}

/* ---------- Reviews --------------------------------------------------------------------- */

function renderReviewsSection(product) {
  const summaryHost = $("#reviewSummary");
  const listHost = $("#reviewList");
  const summary = reviews.summary(product.id);

  if (summaryHost) {
    if (!summary) {
      summaryHost.innerHTML = `
        <div class="review-summary__score">
          <span class="num">—</span>
          <div class="price-note">No reviews yet</div>
        </div>
        <p class="text-soft" style="margin:0;font-size:0.875rem">No customer reviews yet. Be the first to share your experience after purchasing this product.</p>`;
    } else {
      summaryHost.innerHTML = `
        <div class="review-summary__score">
          <span class="num">${summary.average}</span>
          <div class="rating" style="justify-content:center">${starsMarkup(summary.average)}</div>
          <div class="price-note">${summary.count} review${summary.count === 1 ? "" : "s"}</div>
        </div>
        <p class="text-soft" style="margin:0;font-size:0.875rem">Reviews are written by visitors to this site. Only reviews linked to a shipped or delivered order show a “Verified purchase” label.</p>`;
    }
  }

  renderReviewList(listHost, product.id);

  // Review form — wire once (this function re-runs after every submission;
  // without the guard each call would stack another submit handler).
  const form = $("#reviewForm");
  if (form && form.dataset.reviewWired !== "1") {
    form.dataset.reviewWired = "1";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const rating = Number(form.querySelector('input[name="rating"]:checked')?.value || 0);
      const body = form.querySelector("#reviewBody")?.value?.trim();
      const author = form.querySelector("#reviewName")?.value?.trim();
      const ref = form.querySelector("#reviewRef")?.value?.trim();

      if (!rating) { toast("Please choose a star rating.", "error"); return; }
      if (!body) { toast("Please write a few words about the product.", "error"); return; }

      try {
        const saved = reviews.submit({ productId: product.id, rating, body, authorName: author || "Customer", orderReference: ref });
        toast(saved.verified ? "Thank you — your review is marked as a verified purchase." : "Thank you — your review has been added.", "success");
        form.reset();
        renderReviewsSection(product);
      } catch (err) {
        toast(err.message || "Could not submit the review.", "error");
      }
    });
  }
}

/* ---------- Structured data (JSON-LD) ------------------------------------------------------ */

function injectJsonLd(product, category) {
  const existing = document.getElementById("product-jsonld");
  if (existing) existing.remove();

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = "product-jsonld";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    image: product.images.map((i) => `${CONFIG.siteUrl}/${i}`),
    description: product.shortDescription || product.description,
    sku: product.sku || undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    category: category?.name || undefined,
    offers: {
      "@type": "Offer",
      url: `${CONFIG.siteUrl}/product.html?id=${encodeURIComponent(product.id)}`,
      priceCurrency: "PKR",
      price: product.price,
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  });
  document.head.appendChild(script);
}

/* ---------- Main ------------------------------------------------------------------------ */

export async function initProductDetail() {
  const root = $("#pdpRoot");
  if (!root) return;

  const id = getParam("id", "");
  if (!id) {
    root.innerHTML = `
      <div class="empty-state">
        <h3>Product not found</h3>
        <p>The product link is missing or the item is no longer available.</p>
        <a class="btn btn--primary" href="shop.html">Browse the catalogue</a>
      </div>`;
    return;
  }

  let product;
  try {
    product = await products.getProduct(id);
  } catch (e) {
    console.error(e);
  }

  if (!product || !product.active) {
    root.innerHTML = `
      <div class="empty-state">
        <h3>Product not found</h3>
        <p>This product may have been removed or is temporarily unavailable.</p>
        <a class="btn btn--primary" href="shop.html">Browse the catalogue</a>
      </div>`;
    return;
  }

  currentProduct = product;
  selection = {};
  qty = 1;

  const category = await products.getCategory(product.categoryId).catch(() => null);
  const status = products.stockStatus(product);
  const off = discountPercent(product.price, product.compareAtPrice);

  /* --- Render skeleton then hydrate --- */
  root.innerHTML = `
    <nav class="breadcrumbs" aria-label="Breadcrumb" style="grid-column:1/-1;padding-top:0">
      <ol>
        <li><a href="index.html">Home</a></li>
        <li><a href="shop.html">Shop</a></li>
        ${category ? `<li><a href="shop.html?category=${encodeURIComponent(category.id)}">${escapeHtml(category.name)}</a></li>` : ""}
        <li aria-current="page">${escapeHtml(product.name)}</li>
      </ol>
    </nav>

    <div class="pdp" style="grid-column:1/-1">
      <div class="gallery">
        <div class="gallery__main">
          <img id="galleryMain" src="${escapeAttr(product.images[0] || "assets/images/ph-other-1.svg")}"
               alt="${escapeAttr(product.altText || product.name)}" width="600" height="600" />
        </div>
        <div class="gallery__thumbs" id="galleryThumbs"></div>
      </div>

      <div class="pdp__info">
        <div class="pdp__top">
          <span class="pdp__cat">${escapeHtml(category?.name || "Collection")}</span>
          ${wishButtonMarkup(product, "wish-btn--inline")}
        </div>
        <h1>${escapeHtml(product.name)}</h1>

        <div class="pdp__meta">
          ${product.brand ? `<span>Brand: <strong>${escapeHtml(product.brand)}</strong></span>` : ""}
          ${product.sku ? `<span>SKU: ${escapeHtml(product.sku)}</span>` : ""}
          <span id="stockLine" class="stock-line"></span>
        </div>

        <div class="pdp__price">
          <span class="price price--lg" id="pdpPrice">${formatPrice(product.price)}</span>
          <span class="price price--old" id="pdpOldPrice" ${product.compareAtPrice ? "" : "hidden"}>${product.compareAtPrice ? formatPrice(product.compareAtPrice) : ""}</span>
          <span class="pdp__save" id="pdpSave" ${off > 0 ? "" : "hidden"}>${off > 0 ? `Save ${off}%` : ""}</span>
        </div>

        <p class="pdp__desc">${escapeHtml(product.shortDescription || "")}</p>

        <div id="variantHost"></div>

        <div class="pdp__buy">
          <div class="qty" id="qtyStepper">
            <button type="button" data-delta="-1" aria-label="Decrease quantity">−</button>
            <input id="qtyInput" type="number" min="1" value="1" aria-label="Quantity" />
            <button type="button" data-delta="1" aria-label="Increase quantity">+</button>
          </div>
          <button class="btn btn--primary btn--lg" id="addToCart" type="button">Add to Cart</button>
          <button class="btn btn--accent btn--lg" id="buyNow" type="button">Buy Now</button>
        </div>
        ${orderButtonMarkup("waOrderProduct", "Order on WhatsApp", "btn--lg pdp__wa")}

        <div class="perks">
          <span class="perk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="1" y="6" width="15" height="11" rx="2"/><path d="M16 10h4l3 3v4h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>
            <span>Delivery: <strong>${escapeHtml(settings.delivery.estimatedDays)}</strong><br/>${escapeHtml(settings.delivery.areas)}</span></span>
          <span class="perk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 4v5h5"/></svg>
            <span>Returns handled per our<br/><a href="returns-policy.html">returns policy</a></span></span>
          <span class="perk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20 6 9 17l-5-5"/></svg>
            <span>${settings.payments.cod?.enabled ? "Cash on Delivery available" : "Secure payment options"}</span></span>
          <span class="perk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6z"/></svg>
            <span>${/diefei/i.test(product.brand) ? `Offered through our<br/><a href="diefei-3d.html">DIEFEI 3D partnership</a>` : "Carefully packed<br/>for delivery"}</span></span>
        </div>

        <div class="detail-accordion" id="detailAccordion"></div>
      </div>
    </div>

    <section class="section" style="grid-column:1/-1">
      <div class="section-head">
        <div>
          <span class="section-head__eyebrow">Feedback</span>
          <h2>Customer Reviews</h2>
          <p>Read feedback submitted by customers when genuine reviews are available.</p>
        </div>
      </div>
      <div class="review-summary" id="reviewSummary"></div>
      <div class="review-list" id="reviewList"></div>

      <details style="margin-top:24px;background:var(--c-surface);border:1px solid var(--c-line);border-radius:12px;padding:20px">
        <summary style="cursor:pointer;font-weight:500">Write a review</summary>
        <form id="reviewForm" style="margin-top:16px">
          <fieldset>
            <legend>Your rating</legend>
            <div class="variant-options" role="radiogroup">
              ${[5, 4, 3, 2, 1]
                .map(
                  (n) => `<label class="chip" style="cursor:pointer">
                    <input type="radio" name="rating" value="${n}" style="accent-color:var(--c-sage)" /> ${n}★
                  </label>`
                )
                .join("")}
            </div>
          </fieldset>
          <div class="field">
            <label for="reviewName">Your name</label>
            <input class="input" id="reviewName" type="text" maxlength="60" placeholder="e.g. Ayesha K." />
          </div>
          <div class="field">
            <label for="reviewRef">Order reference <span style="text-transform:none;font-weight:400">(optional — a shipped or delivered order earns the “Verified purchase” label)</span></label>
            <input class="input" id="reviewRef" type="text" placeholder="MV-XXXXXXXX" maxlength="20" />
          </div>
          <div class="field">
            <label for="reviewBody">Your review <span class="req">*</span></label>
            <textarea class="textarea" id="reviewBody" required maxlength="2000" placeholder="Share your experience with this product…"></textarea>
          </div>
          <button class="btn btn--primary" type="submit">Submit review</button>
        </form>
      </details>
    </section>

    <section class="section" style="grid-column:1/-1;padding-top:0">
      <div class="section-head">
        <div>
          <span class="section-head__eyebrow">Related</span>
          <h2>You May Also Like</h2>
          <p>Explore other available products from related categories.</p>
        </div>
        <a class="btn btn--ghost" href="shop.html">View all products →</a>
      </div>
      <div class="product-grid" id="relatedGrid"></div>
    </section>`;

  /* --- Hydrate all regions --- */
  initGallery(product);
  renderVariants(product);
  renderDetails(product);
  updateBuyRow(product);
  initQty(product);
  renderReviewsSection(product);
  injectJsonLd(product, category);

  /* --- Actions --- */
  $("#addToCart")?.addEventListener("click", () => {
    if (currentStock(product) <= 0) return;
    Cart.add(product, { ...selection }, qty);
  });

  // Buy Now only continues to checkout when the item really went into the
  // cart (or that exact item is already there at the stock limit).
  $("#buyNow")?.addEventListener("click", () => {
    if (currentStock(product) <= 0) return;
    const added = Cart.add(product, { ...selection }, qty);
    const sel = Object.entries(selection);
    const alreadyIn = Cart.get().some((l) => l.productId === product.id &&
      Object.keys(l.variant || {}).length === sel.length &&
      sel.every(([k, v]) => l.variant?.[k] === v));
    if (added || alreadyIn) window.location.href = "checkout.html";
  });

  $("#waOrderProduct")?.addEventListener("click", () => {
    if (currentStock(product) <= 0) return;
    const unitPrice = products.unitPrice(product, selection);
    openWhatsApp(buildOrderMessage(
      [{ name: product.name, variant: { ...selection }, quantity: qty, unitPrice }],
      { subtotal: unitPrice * qty }
    ));
  });
  syncWishlistUI();

  /* --- Related products --- */
  try {
    const related = await products.getRelated(product, 4);
    await renderProductGrid($("#relatedGrid"), related, { showSkeletons: false });
  } catch (e) {
    console.error("related products failed", e);
  }

  /* --- Page title / canonical --- */
  document.title = `${product.name} | ${settings.displayName}`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", `${product.shortDescription || product.name} Price in PKR, options and availability at ${settings.displayName}.`);
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = `${CONFIG.siteUrl}/product.html?id=${encodeURIComponent(product.id)}`;
}

export default { initProductDetail };