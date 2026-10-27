/* ==========================================================================
   MAVELIQ — js/whatsapp.js
   "Order on WhatsApp" helpers + the floating chat button.

   Everything here depends on settings.contact.whatsapp. When that number is
   empty (the default until the owner adds it) every WhatsApp button is simply
   not rendered — never a dead link.
   ========================================================================== */

import settings from "./services/settings-service.js";
import { CONFIG } from "./config.js";

const WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.4 9.4 0 0 1-4.79-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.38 9.38 0 0 1-1.44-5.01c0-5.18 4.22-9.4 9.41-9.4a9.35 9.35 0 0 1 6.65 2.76 9.32 9.32 0 0 1 2.75 6.65c0 5.18-4.22 9.41-9.4 9.41zM20.52 3.49A11.8 11.8 0 0 0 12.04 0C5.5 0 .17 5.33.17 11.89c0 2.1.55 4.15 1.6 5.96L.07 24l6.3-1.65a11.9 11.9 0 0 0 5.67 1.44c6.55 0 11.88-5.33 11.88-11.89 0-3.18-1.24-6.16-3.49-8.41z"/></svg>';

export function whatsappIcon() {
  return WA_ICON;
}

/** True when the owner has configured a WhatsApp number. */
export function whatsappEnabled() {
  return settings.whatsappNumber.length >= 10;
}

/** wa.me link with an optional prefilled message, or "" when not configured. */
export function waLink(text = "") {
  const n = settings.whatsappNumber;
  if (n.length < 10) return "";
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

function rs(n) {
  return `Rs ${Math.round(Number(n) || 0).toLocaleString(CONFIG.locale)}`;
}

function variantText(variant) {
  const entries = Object.entries(variant || {});
  return entries.length ? ` (${entries.map(([k, v]) => `${k}: ${v}`).join(", ")})` : "";
}

/**
 * Plain-text order message for WhatsApp.
 * @param {Array} lines  [{ name, variant, quantity, unitPrice }]
 * @param {Object} totals { subtotal, discount, discountCode, delivery, total }
 * @param {Object} extra  { reference, customer, note }
 */
export function buildOrderMessage(lines, totals = {}, extra = {}) {
  const out = [];
  out.push(extra.reference
    ? `Hello ${settings.displayName}! I placed order ${extra.reference} on your website:`
    : `Hello ${settings.displayName}! I would like to order:`);
  out.push("");
  (lines || []).forEach((l, i) => {
    const qty = Number(l.quantity) || 1;
    const unit = Number(l.unitPrice) || 0;
    out.push(`${i + 1}. ${l.name}${variantText(l.variant)} × ${qty} = ${rs(unit * qty)}`);
  });
  out.push("");
  if (totals.subtotal !== undefined) out.push(`Subtotal: ${rs(totals.subtotal)}`);
  if (totals.discount > 0) out.push(`Discount${totals.discountCode ? ` (${totals.discountCode})` : ""}: −${rs(totals.discount)}`);
  if (totals.delivery !== undefined) out.push(`Delivery: ${totals.delivery === 0 ? "Free" : rs(totals.delivery)}`);
  if (totals.total !== undefined) out.push(`Total: ${rs(totals.total)}`);
  const c = extra.customer;
  if (c && (c.fullName || c.phone)) {
    out.push("");
    out.push(`Name: ${c.fullName || ""}`);
    if (c.phone) out.push(`Phone: ${c.phone}`);
    if (c.address || c.city) out.push(`Address: ${[c.address, c.city].filter(Boolean).join(", ")}`);
  }
  if (extra.note) {
    out.push("");
    out.push(`Note: ${extra.note}`);
  }
  if (!extra.reference) {
    out.push("");
    out.push("Please confirm availability and the delivery charge for my city.");
  }
  return out.join("\n");
}

/** Markup for an "Order on WhatsApp" button (empty string when disabled). */
export function orderButtonMarkup(id, label = "Order on WhatsApp", extraClass = "") {
  if (!whatsappEnabled()) return "";
  return `<button class="btn btn--whatsapp ${extraClass}" type="button" id="${id}">${WA_ICON}<span>${label}</span></button>`;
}

/** Open WhatsApp with a message in a new tab. */
export function openWhatsApp(text) {
  const url = waLink(text);
  if (!url) return false;
  window.open(url, "_blank", "noopener");
  return true;
}

/** Floating "Chat on WhatsApp" button — rendered only when configured. */
export function initFloatingWhatsApp() {
  if (document.body?.dataset.admin) return;
  document.querySelector(".wa-float")?.remove();
  const url = waLink(`Hello ${settings.displayName}! I have a question.`);
  if (!url) return;
  const a = document.createElement("a");
  a.className = "wa-float";
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.setAttribute("aria-label", "Chat with us on WhatsApp");
  a.innerHTML = `${WA_ICON}<span class="wa-float__label">Chat with us</span>`;
  document.body.appendChild(a);
}

export default { whatsappEnabled, waLink, buildOrderMessage, orderButtonMarkup, openWhatsApp, initFloatingWhatsApp };
