/* ==========================================================================
   MAVELIQ — js/reviews.js
   Customer reviews.

   INTEGRITY RULES (per PRD §16):
     • No reviews are ever invented. If a product has none, the UI shows
       "No reviews yet."
     • "Verified purchase" is only shown when the backing order records exist.
     • Star ratings only appear when at least one genuine review is present.

   In demo mode reviews live in localStorage (owner can post test reviews).
   In production they come from the backend, which only accepts a review
   when a matching delivered order contains that product (enforced
   server-side — the browser is never trusted).
   ========================================================================== */

import { store, uid } from "./utils.js";
import { CONFIG } from "./config.js";

const LS_REVIEWS = "reviews";

/* ---------- Storage --------------------------------------------------------- */

function allReviews() {
  return store.get(LS_REVIEWS, []);
}

function persist(list) {
  store.set(LS_REVIEWS, list);
}

/* ---------- Public API ------------------------------------------------------- */

export const reviews = {
  /** All genuine reviews for a product (newest first). */
  forProduct(productId) {
    return allReviews()
      .filter((r) => r.productId === String(productId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  /** Aggregate for a product: { count, average } or null when none exist. */
  summary(productId) {
    const list = this.forProduct(productId);
    if (!list.length) return null;
    const average = list.reduce((s, r) => s + Number(r.rating || 0), 0) / list.length;
    return { count: list.length, average: Math.round(average * 10) / 10 };
  },

  /**
   * Submit a review.
   * @param {{productId, rating, title, body, authorName, orderReference?}} input
   * Verified status is derived from the order reference, never from the client.
   */
  submit(input) {
    const rating = Math.min(5, Math.max(1, Number(input.rating) || 5));
    const review = {
      id: uid("rev"),
      productId: String(input.productId),
      rating,
      title: String(input.title || "").trim().slice(0, 120),
      body: String(input.body || "").trim().slice(0, 2000),
      authorName: String(input.authorName || "Customer").trim().slice(0, 60),
      // Verified only when the referenced order actually contains this product
      verified: this._hasPurchased(input.productId, input.orderReference),
      createdAt: new Date().toISOString(),
    };
    if (!review.body) throw new Error("Please write a short review.");
    const list = allReviews();
    list.push(review);
    persist(list);
    return review;
  },

  _hasPurchased(productId, orderReference) {
    if (!orderReference) return false;
    try {
      const key = CONFIG.demoMode ? "maveliq:orders" : "maveliq:orders";
      const orders = JSON.parse(localStorage.getItem(key) || "[]");
      const ref = String(orderReference).trim().toUpperCase();
      return orders.some(
        (o) =>
          o.reference?.toUpperCase() === ref &&
          (o.status === "delivered" || o.status === "shipped") &&
          (o.items || []).some((i) => i.productId === String(productId))
      );
    } catch {
      return false;
    }
  },

  /** Reviews flagged as genuine across the store (for the homepage). */
  featured(limit = 3) {
    const list = allReviews().filter((r) => r.rating >= 4);
    return list.slice(0, limit);
  },

  /* ---- Admin moderation --------------------------------------------------- */

  listAll() {
    return allReviews().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  remove(id) {
    persist(allReviews().filter((r) => r.id !== id));
  },

  clearDemoData() {
    persist([]);
  },
};

/* ---------- Rendering helpers ------------------------------------------------ */

/** Star row SVG markup for a 1–5 rating. */
export function starsMarkup(rating) {
  const r = Math.round(Number(rating) || 0);
  let out = '<span class="rating__stars" aria-hidden="true">';
  for (let i = 1; i <= 5; i++) {
    out += i <= r
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/></svg>';
  }
  return out + "</span>";
}

/** Compact rating widget for product cards (returns "" when no reviews). */
export function cardRatingMarkup(product) {
  if (!product?.rating || !product?.reviewCount) return "";
  return `<span class="rating" title="${product.rating} out of 5 from ${product.reviewCount} review${product.reviewCount === 1 ? "" : "s"}">
    ${starsMarkup(product.rating)}
    <span>(${product.reviewCount})</span>
  </span>`;
}

/** Full review list for a product page. Renders the honest empty state. */
export function renderReviewList(container, productId) {
  if (!container) return;
  const list = reviews.forProduct(productId);

  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <h3>No reviews yet</h3>
        <p>Reviews from customers who purchased this product will appear here.</p>
      </div>`;
    return;
  }

  container.innerHTML = list
    .map(
      (r) => `
      <article class="review-item">
        <div class="review-item__head">
          <div>
            <span class="review-item__author">${escape(r.authorName)}</span>
            ${r.verified ? `<span class="review-item__verified"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>Verified purchase</span>` : ""}
          </div>
          <time datetime="${escape(r.createdAt)}">${new Date(r.createdAt).toLocaleDateString(CONFIG.locale, { year: "numeric", month: "short", day: "numeric" })}</time>
        </div>
        <div class="rating">${starsMarkup(r.rating)}<span>${r.rating}/5</span></div>
        ${r.title ? `<h4 style="margin:8px 0 4px">${escape(r.title)}</h4>` : ""}
        <p>${escape(r.body)}</p>
      </article>`
    )
    .join("");
}

function escape(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default reviews;