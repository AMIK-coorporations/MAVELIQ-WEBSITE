/* ==========================================================================
   MAVELIQ — js/utils.js
   Shared helpers: formatting, escaping, DOM, storage, debounce, toasts.
   ========================================================================== */

import { CONFIG } from "./config.js";

/* ---------- Currency & numbers ----------------------------------------- */

/** Format a number as PKR, e.g. formatPrice(2450) → "Rs 2,450" */
export function formatPrice(value) {
  const n = Number(value) || 0;
  try {
    return new Intl.NumberFormat(CONFIG.locale, {
      style: "currency",
      currency: CONFIG.currency === "PKR" ? "PKR" : CONFIG.currency,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(n);
  } catch {
    return `Rs ${Math.round(n).toLocaleString("en-PK")}`;
  }
}

/** Alias used across pages */
export const fmtPrice = formatPrice;

export function formatNumber(value) {
  return (Number(value) || 0).toLocaleString(CONFIG.locale);
}

/** Percentage discount between original and current price (0–99). */
export function discountPercent(price, compareAt) {
  const p = Number(price);
  const c = Number(compareAt);
  if (!c || c <= p) return 0;
  return Math.round(((c - p) / c) * 100);
}

/* ---------- Strings & escaping ----------------------------------------- */

/**
 * Escape a value for safe interpolation into HTML.
 * Every dynamic string rendered into the DOM must pass through this.
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape for use inside a double-quoted attribute (e.g. href). */
export function escapeAttr(value) {
  return escapeHtml(value);
}

export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(text, max = 120) {
  const s = String(text || "");
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

export function titleCase(str) {
  return String(str || "").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ---------- Dates -------------------------------------------------------- */

export function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(CONFIG.locale, {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return String(iso);
  }
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(CONFIG.locale, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

export function timeAgo(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  const units = [
    [31536000, "year"], [2592000, "month"], [604800, "week"],
    [86400, "day"], [3600, "hour"], [60, "minute"],
  ];
  for (const [s, label] of units) {
    const v = Math.floor(secs / s);
    if (v >= 1) return `${v} ${label}${v > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

/* ---------- DOM ---------------------------------------------------------- */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function createElement(tag, attrs = {}, html = "") {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  if (html) el.innerHTML = html;
  return el;
}

/** Read a query-string parameter by name. */
export function getParam(name, fallback = null) {
  const v = new URLSearchParams(window.location.search).get(name);
  return v === null ? fallback : v;
}

/** Build a URL with query params merged in. */
export function withParams(base, params) {
  const url = new URL(base, window.location.origin);
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  return url.pathname + url.search;
}

/* ---------- Storage ------------------------------------------------------- */

const STORAGE_PREFIX = "maveliq:";

export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try { localStorage.removeItem(STORAGE_PREFIX + key); } catch { /* ignore */ }
  },
};

/* ---------- Timing -------------------------------------------------------- */

export function debounce(fn, wait = 250) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ---------- Toasts --------------------------------------------------------- */

let toastRegion = null;

function ensureToastRegion() {
  if (toastRegion && document.body.contains(toastRegion)) return toastRegion;
  toastRegion = document.createElement("div");
  toastRegion.className = "toast-region";
  toastRegion.setAttribute("role", "status");
  toastRegion.setAttribute("aria-live", "polite");
  document.body.appendChild(toastRegion);
  return toastRegion;
}

const TOAST_ICONS = {
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
  info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-5M12 8h.01"/></svg>',
};

/**
 * Show a toast notification.
 * @param {string} message
 * @param {"success"|"error"|"info"} type
 * @param {number} duration ms (0 = stays until closed)
 */
export function toast(message, type = "info", duration = 3800) {
  const region = ensureToastRegion();
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.innerHTML = `
    <span class="toast__icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
    <span class="toast__body">${escapeHtml(message)}</span>
    <button class="toast__close" type="button" aria-label="Dismiss notification">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>`;
  region.appendChild(el);

  const dismiss = () => {
    if (!el.isConnected) return;
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 260);
  };
  el.querySelector(".toast__close").addEventListener("click", dismiss);
  if (duration > 0) setTimeout(dismiss, duration);
  return el;
}

/* ---------- Loading (skeleton helpers) ------------------------------------ */

export function skeletonCards(count = 8) {
  return Array.from({ length: count }, () => `
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton skeleton--media"></div>
      <div class="skeleton skeleton--line"></div>
      <div class="skeleton skeleton--line short"></div>
    </div>`).join("");
}

/* ---------- Misc ---------------------------------------------------------- */

export function isTouchDevice() {
  return window.matchMedia("(pointer: coarse)").matches;
}

export function generateReference() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < CONFIG.orders.referenceLength; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${CONFIG.orders.referencePrefix}-${out}`;
}

export function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Print the current page (used on order confirmation). */
export function printPage() {
  window.print();
}