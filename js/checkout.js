/* ==========================================================================
   MAVELIQ — js/checkout.js
   Checkout page logic:
     • renders the order review + live totals
     • collects delivery details with inline validation
     • offers ONLY payment methods genuinely enabled in settings
     • places the order through the order service (server-validated in prod)
     • prevents duplicate submissions
   ========================================================================== */

import { CONFIG } from "./config.js";
import { $, $$, formatPrice, escapeHtml, escapeAttr, toast } from "./utils.js";
import { validateForm, rules } from "./validation.js";
import settings from "./services/settings-service.js";
import { Cart } from "./cart.js";
import orders from "./services/order-service.js";

let submitting = false;

/* ---------- Payment methods ------------------------------------------------------- */

function renderPaymentOptions(host) {
  if (!host) return;
  const enabled = settings.enabledPayments;
  const all = settings.payments;

  // Show enabled methods plus disabled ones greyed out (honest about what's coming)
  const rows = Object.entries(all)
    .map(([key, val]) => {
      const isEnabled = enabled.some((p) => p.key === key);
      return `
      <label class="pay-option ${isEnabled ? "" : "is-disabled"}">
        <input type="radio" name="paymentMethod" value="${escapeAttr(key)}"
               ${isEnabled ? "" : "disabled"} ${key === "cod" && isEnabled ? "checked" : ""} />
        <span class="pay-option__body">
          <strong>${escapeHtml(val.label)}${isEnabled ? "" : " — coming soon"}</strong>
          <span>${escapeHtml(val.note || "")}</span>
        </span>
      </label>`;
    })
    .join("");

  host.innerHTML = rows || `<p class="text-muted">No payment method is configured yet. Please contact us to place an order.</p>`;

  host.addEventListener("change", () => {
    $$(".pay-option", host).forEach((el) => {
      el.classList.toggle("is-selected", Boolean(el.querySelector("input:checked")));
    });
  });
  // set initial selected state
  $$(".pay-option", host).forEach((el) => {
    el.classList.toggle("is-selected", Boolean(el.querySelector("input:checked")));
  });
}

/* ---------- Order review panel ------------------------------------------------------ */

function renderSummary(host, list) {
  if (!host) return;
  const { subtotal: sub, discount: disc, delivery, total } = Cart.totals(list);
  const d = settings.delivery;

  host.innerHTML = `
    <h2>Review Your Order</h2>
    <div class="mini-items">
      ${list
        .map(
          (l) => `
        <div class="mini-item">
          <span class="mini-item__media">
            <img src="${escapeAttr(l.image)}" alt="${escapeAttr(l.altText || l.name)}" loading="lazy" />
            <span class="mini-item__qty">${l.quantity}</span>
          </span>
          <span>
            <span class="mini-item__name">${escapeHtml(l.name)}</span>
            ${Object.keys(l.variant || {}).length
              ? `<span class="mini-item__variant">${Object.entries(l.variant).map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(v)}`).join(", ")}</span>`
              : ""}
          </span>
          <span class="mini-item__price">${formatPrice(l.unitPrice * l.quantity)}</span>
        </div>`
        )
        .join("")}
    </div>
    <div class="summary__row"><span>Subtotal</span><strong>${formatPrice(sub)}</strong></div>
    ${disc > 0 ? `<div class="summary__row"><span>Discount ${Cart.discountCode ? `(<code>${escapeHtml(Cart.discountCode)}</code>)` : ""}</span><strong class="save">− ${formatPrice(disc)}</strong></div>` : ""}
    <div class="checkout-promo">
      <label class="sr-only" for="promoCode">Discount code</label>
      <input class="input" id="promoCode" type="text" placeholder="Discount code"
             value="${escapeHtml(Cart.discountCode)}" style="text-transform:uppercase" autocomplete="off" />
      <button class="btn btn--outline" type="button" id="applyPromo">Apply</button>
    </div>
    <div class="summary__row"><span>Delivery</span><strong>${delivery === 0 ? "Free" : formatPrice(delivery)}</strong></div>
    <div class="summary__row summary__row--total"><span>Total payable</span><strong id="summaryTotal">${formatPrice(total)}</strong></div>
    <p class="price-note" style="margin-top:12px">
      <svg class="icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="6" width="15" height="11" rx="2"/><path d="M16 10h4l3 3v4h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>
      Estimated delivery: ${escapeHtml(d.estimatedDays)} · ${escapeHtml(d.areas)}
    </p>`;
}

/* ---------- Steps indicator ----------------------------------------------------------- */

function setStep(n) {
  $$("#checkoutSteps .step").forEach((el, i) => {
    el.classList.toggle("is-active", i + 1 === n);
    el.classList.toggle("is-done", i + 1 < n);
  });
}

/* ---------- Main ---------------------------------------------------------------------- */

export async function initCheckout() {
  const form = $("#checkoutForm");
  const summaryHost = $("#orderSummary");
  const paymentHost = $("#paymentMethods");
  const emptyState = $("#checkoutEmpty");
  const layout = $("#checkoutLayout");
  const demoNotice = $("#demoNotice");

  if (!form) return;

  // Demo-mode honesty notice
  if (demoNotice) demoNotice.hidden = !CONFIG.demoMode;

  let list = await Cart.refreshPrices();

  if (!list.length) {
    layout?.setAttribute("hidden", "");
    emptyState?.removeAttribute("hidden");
    return;
  }

  renderSummary(summaryHost, list);
  renderPaymentOptions(paymentHost);

  // Show configured contact as a fallback for questions
  const helpHost = $("#checkoutHelp");
  if (helpHost) {
    const methods = settings.contactMethods;
    helpHost.innerHTML = methods.length
      ? `Questions about your order? ${methods.map((m) => `<a href="${escapeAttr(m.href)}">${escapeHtml(m.label)}</a>`).join(" · ")}`
      : "Questions about your order? See our <a href=\"faq.html\">FAQs</a>.";
  }

  /* Validation schema */
  const schema = {
    fullName: [rules.required, rules.name],
    phone: [rules.required, rules.phonePk],
    address: [rules.required, rules.address],
    city: [rules.required, rules.city],
    email: [rules.email],
  };

  /* Step 2 highlight when the customer scrolls to payment */
  paymentHost?.addEventListener("focusin", () => setStep(2));

  /* Submit */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitting) return;                       // duplicate-submit guard

    const ok = validateForm(form, schema);
    if (!ok) {
      toast("Please fix the highlighted fields.", "error");
      return;
    }

    // Re-check prices/stock just before placing the order
    const before = Cart.total(list);
    const fresh = await Cart.refreshPrices();
    if (!fresh.length) {
      toast("One or more products are no longer available.", "error");
      return;
    }
    if (Cart.total(fresh) !== before || fresh.length !== list.length) {
      list = fresh;
      renderSummary(summaryHost, list);
      toast("Your order total has changed. Please review it before confirming.", "info", 6000);
      return;
    }

    const paymentInput = form.querySelector('input[name="paymentMethod"]:checked');
    if (!paymentInput) {
      toast("Choose a payment method to continue.", "error");
      setStep(2);
      return;
    }

    const fd = new FormData(form);
    const customer = {
      fullName: String(fd.get("fullName") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      address: String(fd.get("address") || "").trim(),
      city: String(fd.get("city") || "").trim(),
      instructions: String(fd.get("instructions") || "").trim(),
    };
    const note = String(fd.get("orderNote") || "").trim().slice(0, 500);

    const consent = form.querySelector('#consent');
    if (consent && !consent.checked) {
      toast("Please review and accept the applicable terms.", "error");
      return;
    }

    submitting = true;
    const btn = $("#placeOrderBtn");
    btn?.classList.add("is-loading");
    btn?.setAttribute("disabled", "");

    try {
      const order = await orders.placeOrder({
        customer,
        items: Cart.toOrderItems(list),
        paymentMethod: paymentInput.value,
        discountCode: Cart.discountCode,
        note,
      });

      // Success: hand the order to the confirmation page for THIS tab only.
      // sessionStorage (not localStorage) so the customer's name, phone and
      // address are not left behind in the browser after the visit.
      sessionStorage.setItem("maveliq:last_order_ref", order.reference);
      sessionStorage.setItem("maveliq:last_order", JSON.stringify(order));
      localStorage.removeItem("maveliq:last_order");   // clean up older builds
      Cart.clear();

      window.location.href = `order-confirmation.html?ref=${encodeURIComponent(order.reference)}`;
    } catch (err) {
      console.error("Checkout failed", err);
      toast(err.message || "We could not complete your order. Please check your information and try again.", "error", 6000);
      submitting = false;
      btn?.classList.remove("is-loading");
      btn?.removeAttribute("disabled");
    }
  });

  /* Promo code — delegated from the summary host, because renderSummary()
     re-renders the promo row and would otherwise orphan the listener.
     Only settings-configured codes are honoured. */
  summaryHost?.addEventListener("click", (e) => {
    if (e.target.closest("#applyPromo")) applyPromoCode();
  });
  summaryHost?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.id === "promoCode") {
      e.preventDefault();
      applyPromoCode();
    }
  });

  function applyPromoCode() {
    const input = $("#promoCode", summaryHost);
    const code = (input?.value || "").trim().toUpperCase();
    if (!code) return;
    if (!settings.discountRule(code)) {
      toast("That discount code is not valid.", "error");
      Cart.discountCode = "";
      renderSummary(summaryHost, Cart.get());
      return;
    }
    Cart.discountCode = code;
    toast(`Discount code "${code}" applied.`, "success");
    renderSummary(summaryHost, Cart.get());
  }

  setStep(1);
}

export default { initCheckout };