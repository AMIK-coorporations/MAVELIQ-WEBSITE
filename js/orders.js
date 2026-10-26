/* ==========================================================================
   MAVELIQ — js/orders.js
   Order confirmation page: shows the genuine reference, line items, totals,
   delivery details and next steps. Also powers a printable summary.
   ========================================================================== */

import { CONFIG } from "./config.js";
import { $, formatPrice, escapeHtml, escapeAttr, getParam, formatDateTime } from "./utils.js";
import settings from "./services/settings-service.js";
import orders from "./services/order-service.js";

/* ---------- Status label -------------------------------------------------- */

export function statusLabel(status) {
  const map = {
    pending: "Order received",
    confirmed: "Confirmed",
    packed: "Packed",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    returned: "Returned",
  };
  return map[status] || status;
}

/* ---------- Confirmation page ------------------------------------------------ */

export async function initConfirmation() {
  const host = $("#confirmationBody");
  if (!host) return;

  const ref = getParam("ref", "");
  let order = null;

  try {
    // checkout.js always writes the full placed order here (demo AND
    // production), so this is the single source for the confirmation screen.
    const stored = localStorage.getItem("maveliq:last_order");
    order = stored ? JSON.parse(stored) : null;

    if (ref && (!order || order.reference !== ref)) {
      // Ref param doesn't match the stored order — try a reference lookup
      order = orders.getByReference(ref);
    }
  } catch {
    order = null;
  }

  if (!order) {
    host.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>
        <h3>We could not find that order</h3>
        <p>If you have your reference number, you can look it up any time on the Track Order page.</p>
        <div class="btn-row" style="justify-content:center">
          <a class="btn btn--primary" href="track-order.html">Track my order</a>
          <a class="btn btn--outline" href="shop.html">Continue shopping</a>
        </div>
      </div>`;
    return;
  }

  const d = settings.delivery;
  const notify = (() => {
    try { return JSON.parse(localStorage.getItem("maveliq:pendingAdminNotify") || "null"); }
    catch { return null; }
  })();

  host.innerHTML = `
    <div class="order-detail-grid">
      <div class="info-block">
        <h3>Delivery details</h3>
        <p>
          <strong>${escapeHtml(order.customer.fullName)}</strong><br />
          ${escapeHtml(order.customer.address)}<br />
          ${escapeHtml(order.customer.city)}<br />
          ${escapeHtml(order.customer.phone)}
          ${order.customer.email ? `<br />${escapeHtml(order.customer.email)}` : ""}
        </p>
        ${order.customer.instructions ? `<p style="margin-top:10px"><strong>Instructions:</strong> ${escapeHtml(order.customer.instructions)}</p>` : ""}
      </div>

      <div class="info-block">
        <h3>Order summary</h3>
        <div class="summary__row"><span>Items</span><strong>${formatPrice(order.subtotal)}</strong></div>
        ${order.discount > 0 ? `<div class="summary__row"><span>Discount ${order.discountCode ? `(${escapeHtml(order.discountCode)})` : ""}</span><strong class="save">− ${formatPrice(order.discount)}</strong></div>` : ""}
        <div class="summary__row"><span>Delivery</span><strong>${order.deliveryCharge === 0 ? "Free" : formatPrice(order.deliveryCharge)}</strong></div>
        <div class="summary__row summary__row--total"><span>Total payable</span><strong>${formatPrice(order.total)}</strong></div>
        <p class="price-note" style="margin-top:10px">Payment method: ${escapeHtml(paymentLabel(order.paymentMethod))}</p>
      </div>
    </div>

    <div class="admin-panel" style="margin-top:24px">
      <div class="admin-panel__head"><h2>Items in this order</h2></div>
      <div class="table-wrap" style="border:0">
        <table class="table">
          <thead>
            <tr><th>Product</th><th>Variant</th><th>Qty</th><th style="text-align:right">Total</th></tr>
          </thead>
          <tbody>
            ${order.items
              .map(
                (i) => `
              <tr>
                <td>
                  <div style="display:flex;gap:10px;align-items:center">
                    ${i.image ? `<img src="${escapeAttr(i.image)}" alt="" class="thumb-sm" loading="lazy" />` : ""}
                    <span>${escapeHtml(i.name)}</span>
                  </div>
                </td>
                <td>${Object.keys(i.variant || {}).length ? Object.values(i.variant).map(escapeHtml).join(", ") : "—"}</td>
                <td>${i.quantity}</td>
                <td style="text-align:right">${formatPrice(i.lineTotal)}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="alert alert--info" style="margin-top:24px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="10"/><path d="M12 16v-5M12 8h.01"/></svg>
      <div>
        <strong>What happens next?</strong>
        <p>We will contact you on ${escapeHtml(order.customer.phone)} to confirm the order, then dispatch it via your chosen courier. Estimated delivery: ${escapeHtml(d.estimatedDays)}. Keep your reference number to track the order any time.</p>
      </div>
    </div>

    ${
      CONFIG.demoMode
        ? `<div class="alert alert--warning" style="margin-top:16px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
            <div><strong>Demo order</strong><p>This order was saved only in this browser to demonstrate the flow. Connect a real backend (see README → "Backend (later)") before accepting customer orders.</p></div>
          </div>`
        : ""
    }

    <div class="btn-row" style="margin-top:28px">
      <a class="btn btn--primary" href="track-order.html?ref=${encodeURIComponent(order.reference)}">Track this order</a>
      ${
        notify && notify.url
          ? `<a class="btn btn--outline" href="${escapeAttr(notify.url)}" target="_blank" rel="noopener noreferrer">Contact us about this order</a>`
          : ""
      }
      <button class="btn btn--outline" type="button" id="printOrder">Print / Save PDF</button>
      <a class="btn btn--ghost" href="shop.html">Continue shopping →</a>
    </div>`;

  $("#printOrder")?.addEventListener("click", () => window.print());

  // Fill the hero reference block
  const refEl = $("#orderRef");
  if (refEl) refEl.textContent = order.reference;
  const placedEl = $("#orderPlaced");
  if (placedEl) placedEl.textContent = formatDateTime(order.createdAt);
  const statusEl = $("#orderStatus");
  if (statusEl) {
    statusEl.innerHTML = `<span class="status status--${escapeAttr(order.status)}">${escapeHtml(statusLabel(order.status))}</span>`;
  }

  document.title = `Order ${order.reference} | ${settings.displayName}`;
}

function paymentLabel(key) {
  const method = settings.payments?.[key];
  return method?.label || key.toUpperCase();
}

export default { initConfirmation, statusLabel };