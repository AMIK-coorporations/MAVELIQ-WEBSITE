/* ==========================================================================
   MAVELIQ — js/wishlist.js
   Wishlist saved in this browser (localStorage, product ids only).
     • heart buttons on product cards and the product page
     • header icon with a live count
     • wishlist.html page
   ========================================================================== */

import { toast } from "./utils.js";

const KEY = "maveliq:wishlist";
const EVENT = "maveliq:wishlist-updated";

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list.map(String) : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set(list.map(String))]));
  } catch { /* storage full or blocked — non-critical */ }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export const Wishlist = {
  ids: () => read(),
  count: () => read().length,
  has: (id) => read().includes(String(id)),
  add(id) {
    const list = read();
    if (!list.includes(String(id))) { list.unshift(String(id)); write(list); }
  },
  remove(id) {
    write(read().filter((x) => x !== String(id)));
  },
  /** Toggle and return the new state (true = saved). */
  toggle(id) {
    if (this.has(id)) { this.remove(id); return false; }
    this.add(id);
    return true;
  },
  clear() { write([]); },
};

const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.6-9.3C.9 7.8 3 4 6.6 4c2.1 0 3.6 1.1 4.4 2.5h2C13.8 5.1 15.3 4 17.4 4 21 4 23.1 7.8 21.6 11.2c-2.1 4.7-9.6 9.3-9.6 9.3z"/></svg>';

export function heartIcon() {
  return HEART;
}

/** Heart toggle button markup for a product. */
export function wishButtonMarkup(product, extraClass = "") {
  const saved = Wishlist.has(product.id);
  const label = saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`;
  return `<button class="wish-btn ${extraClass} ${saved ? "is-active" : ""}" type="button"
            data-wish="${String(product.id).replace(/"/g, "&quot;")}" aria-pressed="${saved}"
            aria-label="${label.replace(/"/g, "&quot;")}" title="${saved ? "Saved to wishlist" : "Save to wishlist"}">${HEART}</button>`;
}

/** Refresh every heart button + header badge on the page. */
export function syncWishlistUI() {
  const ids = new Set(read());
  document.querySelectorAll("[data-wish]").forEach((btn) => {
    const on = ids.has(btn.dataset.wish);
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", String(on));
    btn.title = on ? "Saved to wishlist" : "Save to wishlist";
  });
  const badge = document.getElementById("wishCount");
  if (badge) {
    badge.textContent = String(ids.size);
    badge.dataset.count = String(ids.size);
  }
}

let wired = false;

/** One delegated click handler for all heart buttons, plus cross-tab sync. */
export function initWishlist() {
  syncWishlistUI();
  if (wired) return;
  wired = true;
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-wish]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const saved = Wishlist.toggle(btn.dataset.wish);
    toast(saved ? "Saved to your wishlist." : "Removed from your wishlist.", saved ? "success" : "info", 1800);
  });
  window.addEventListener(EVENT, syncWishlistUI);
  window.addEventListener("storage", (e) => { if (e.key === KEY) syncWishlistUI(); });
}

export default Wishlist;
