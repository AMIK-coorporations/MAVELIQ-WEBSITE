/* ==========================================================================
   MAVELIQ — js/tracking.js
   Order tracking.

   SECURITY (PRD §16): tracking requires BOTH the order reference and the
   phone number used at checkout. Nothing else about the customer is exposed,
   and unauthenticated visitors can never list orders.
   ========================================================================== */

import { CONFIG } from "./config.js";
import { $, escapeHtml, getParam, toast, formatDateTime, formatPrice } from "./utils.js";
import { validateForm, rules } from "./validation.js";
import settings from "./services/settings-service.js";
import orders from "./services/order-service.js";
import { statusLabel } from "./orders.js";

/* ---------- Timeline ------------------------------------------------------------- */

const FLOW = ["pending", "confirmed", "packed", "shipped", "delivered"];

function timelineMarkup(order) {
  const currentIdx = FLOW.indexOf(order.status);

  if (order.status === "cancelled" || order.status === "returned") {
    return `
      <div class="alert alert--danger">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
        <div><strong>Order ${escapeHtml(statusLabel(order.status))}</strong>
        <p>This order has been marked as ${escapeHtml(statusLabel(order.status).toLowerCase())}. Please contact us if you have questions.</p></div>
      </div>`;
  }

  return `
    <ol class="timeline">
      ${FLOW.map((step, i) => {
        const done = i < currentIdx;
        const current = i === currentIdx;
        const entry = (order.history || []).slice().reverse().find((h) => h.status === step);
        return `
        <li class="timeline__item ${done ? "is-done" : ""} ${current ? "is-current" : ""}">
          <span class="timeline__dot"></span>
          <div class="timeline__title">${escapeHtml(statusLabel(step))}${current ? " — in progress" : ""}</div>
          <div class="timeline__time">${entry ? formatDateTime(entry.at) : done ? "" : current ? formatDateTime(order.createdAt) : "Pending"}</div>
          ${entry && entry.note ? `<div class="price-note">${escapeHtml(entry.note)}</div>` : ""}
        </li>`;
      }).join("")}
    </ol>`;
}

/* ---------- Result rendering ---------------------------------------------------------- */

function renderResult(order) {
  const host = $("#trackResult");
  if (!host) return;
  host.hidden = false;

  const d = order.dispatch;

  host.innerHTML = `
    <div class="card" style="margin-bottom:20px">
      <div class="cart-head" style="border:0;padding:0;margin-bottom:16px">
        <div>
          <span class="section-head__eyebrow">Order reference</span>
          <h2 style="margin:4px 0 0;font-family:var(--font-display)">${escapeHtml(order.reference)}</h2>
        </div>
        <div style="text-align:right">
          <span class="status status--${escapeHtml(order.status)}">${escapeHtml(statusLabel(order.status))}</span>
          <div class="price-note" style="margin-top:6px">Placed ${formatDateTime(order.createdAt)}</div>
        </div>
      </div>
      ${timelineMarkup(order)}
      ${
        d
          ? `<div class="alert alert--success" style="margin-top:20px">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M20 6 9 17l-5-5"/></svg>
              <div><strong>Dispatched via ${escapeHtml(d.courier || "our courier partner")}</strong>
              ${d.trackingNumber ? `<p>Tracking number: <code>${escapeHtml(d.trackingNumber)}</code></p>` : ""}</div>
            </div>`
          : ""
      }
    </div>

    <div class="order-detail-grid">
      <div class="info-block">
        <h3>Delivery address</h3>
        <p><strong>${escapeHtml(order.customer.fullName)}</strong><br/>${escapeHtml(order.customer.address)}<br/>${escapeHtml(order.customer.city)}</p>
        <p class="price-note" style="margin-top:10px">${escapeHtml(order.customer.phone)}</p>
      </div>
      <div class="info-block">
        <h3>Order totals</h3>
        <div class="summary__row"><span>Subtotal</span><strong>${formatPrice(order.subtotal)}</strong></div>
        ${order.discount > 0 ? `<div class="summary__row"><span>Discount</span><strong class="save">− ${formatPrice(order.discount)}</strong></div>` : ""}
        <div class="summary__row"><span>Delivery</span><strong>${order.deliveryCharge === 0 ? "Free" : formatPrice(order.deliveryCharge)}</strong></div>
        <div class="summary__row summary__row--total"><span>Total</span><strong>${formatPrice(order.total)}</strong></div>
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <h3 style="font-size:0.9rem;font-family:var(--font-body);text-transform:uppercase;letter-spacing:0.1em;color:var(--c-ink-mute)">Items</h3>
      ${(order.items || [])
        .map(
          (i) => `
        <div class="mini-item" style="grid-template-columns:56px 1fr auto;padding:8px 0;border-bottom:1px solid var(--c-line)">
          <span class="mini-item__media">${i.image ? `<img src="${escapeHtml(i.image)}" alt="" loading="lazy"/>` : ""}<span class="mini-item__qty">${i.quantity}</span></span>
          <span>
            <span class="mini-item__name">${escapeHtml(i.name)}</span>
            ${Object.keys(i.variant || {}).length ? `<span class="mini-item__variant">${Object.values(i.variant).map(escapeHtml).join(", ")}</span>` : ""}
          </span>
          <span class="mini-item__price">${formatPrice(i.lineTotal)}</span>
        </div>`
        )
        .join("")}
    </div>

    <div class="btn-row" style="margin-top:24px">
      <button class="btn btn--outline" type="button" id="printTrack">Print details</button>
      <a class="btn btn--ghost" href="faq.html">Questions? See FAQs →</a>
    </div>`;

  $("#printTrack")?.addEventListener("click", () => window.print());
  host.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderError(message) {
  const host = $("#trackResult");
  if (!host) return;
  host.hidden = false;
  host.innerHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <h3>Order not found</h3>
      <p>${escapeHtml(message)}</p>
      <p class="price-note">Check that the reference (e.g. MV-7K4M2P9Q) and phone number match the ones used at checkout.</p>
    </div>`;
}

/* ---------- Main ----------------------------------------------------------------------- */

export function initTracking() {
  const form = $("#trackForm");
  if (!form) return;

  const schema = {
    reference: [rules.required, rules.orderRef],
    phone: [rules.required, rules.phonePk],
  };

  let busy = false;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!validateForm(form, schema)) return;

    const ref = form.reference.value.trim().toUpperCase();
    const phone = form.phone.value.trim();

    busy = true;
    const btn = form.querySelector('button[type="submit"]');
    btn?.classList.add("is-loading");

    try {
      const order = await orders.track(ref, phone);
      renderResult(order);
    } catch (err) {
      renderError(err.message || "No order matches that reference and phone number.");
    } finally {
      busy = false;
      btn?.classList.remove("is-loading");
    }
  });

  // Deep link: track-order.html?ref=MV-XXXX
  const prefill = getParam("ref", "");
  if (prefill && form.reference) {
    form.reference.value = prefill.toUpperCase();
    toast("Enter the phone number used at checkout to view this order.", "info");
  }
}

export default { initTracking };