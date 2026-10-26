/* ==========================================================================
   MAVELIQ — js/app.js
   Application boot. Every page loads this as an ES module and calls
   bootPage() — it initialises navigation, search, reveal animations and then
   the page-specific behaviour based on the <body data-page="..."> attribute.
   ========================================================================== */

import { CONFIG } from "./config.js";
import { $, $$, escapeHtml, toast } from "./utils.js";
import settings from "./services/settings-service.js";
import initNavigation from "./navigation.js";
import { initSearch } from "./search.js";
import { renderHomeSections, initShop } from "./products.js";
import { initCheckout } from "./checkout.js";
import { initConfirmation } from "./orders.js";
import { initTracking } from "./tracking.js";

/* ---------- Reveal on scroll ---------------------------------------------------- */

function initReveal() {
  const els = $$(".reveal");
  if (!els.length) return;

  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  els.forEach((el) => io.observe(el));
}

/* ---------- Product detail page -------------------------------------------------- */

async function initProductPage() {
  const host = $("#pdpRoot");
  if (!host) return;

  const { initProductDetail } = await import("./product-detail.js");
  await initProductDetail();
}

/* ---------- Cart page ------------------------------------------------------------- */

async function initCartPage() {
  if (!document.body.dataset.page || document.body.dataset.page !== "cart") return;
  const { renderCartPage } = await import("./cart.js");
  renderCartPage({
    itemsEl: $("#cartItems"),
    emptyEl: $("#cartEmpty"),
    layoutEl: $("#cartLayout"),
    summaryEl: $("#cartSummary"),
    onCheckout: () => (window.location.href = "checkout.html"),
  });
}

/* ---------- Categories page --------------------------------------------------------- */

async function initCategoriesPage() {
  const host = $("#categoriesGrid");
  if (!host) return;
  const products = (await import("./services/product-service.js")).default;
  const { escapeAttr } = await import("./utils.js");

  try {
    const cats = await products.getCategoryWithCounts();
    host.innerHTML = cats
      .map(
        (c) => `
      <a class="cat-card reveal" href="shop.html?category=${encodeURIComponent(c.id)}">
        <img src="${escapeAttr(c.image || "assets/images/ph-other-1.svg")}" alt="${escapeHtml(c.name)} category" loading="lazy" decoding="async" />
        <span class="cat-card__label">
          <h3>${escapeHtml(c.name)}</h3>
          <span>${c.productCount} product${c.productCount === 1 ? "" : "s"}</span>
        </span>
      </a>`
      )
      .join("");
    initReveal();
  } catch (e) {
    console.error(e);
    host.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>Categories unavailable</h3><p>Please refresh the page.</p></div>`;
  }
}

/* ---------- Contact page ------------------------------------------------------------- */

function initContactPage() {
  const host = $("#contactMethods");
  if (!host) return;

  const c = settings.contact;
  const socials = settings.activeSocials;
  const cards = settings.contactMethods.map((m) => contactCard(m.key, m.label, m.href, m.value)).join("");

  const socialCards = socials
    .map((s) => contactCard(s.key, s.label, s.url, "Open profile", true))
    .join("");

  host.innerHTML = cards + socialCards || `
    <div class="empty-state" style="grid-column:1/-1">
      <h3>Contact details coming soon</h3>
      <p>The owner will add phone, WhatsApp, email and social links from the admin Settings page.</p>
    </div>`;

  function contactCard(iconKey, label, href, value, isSocial = false) {
    const icons = {
      whatsapp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
      phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 1.9.6 2.8a2 2 0 0 1-.4 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.8.6a2 2 0 0 1 1.8 2z"/></svg>',
      email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>',
      instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4.2"/></svg>',
      facebook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H7v3h3v7h3v-7h3l1-3h-4v-2c0-.55.45-1 1-1z"/></svg>',
      tiktok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M16.5 3c.4 2.3 1.9 3.9 4.2 4.1v3c-1.6 0-3-.5-4.2-1.4v6.1c0 3.6-2.6 6.2-6 6.2S4.5 18.4 4.5 14.8c0-3.4 2.5-6.1 6-6.2v3.1a6 6 0 0 0-1.3-.1c-1.5 0-2.7 1.2-2.7 2.7S7.7 17 9.2 17s2.7-1.2 2.7-2.7V3h4.6z"/></svg>',
      youtube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z"/></svg>',
      whatsappBig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    };
    return `
      <a class="contact-card" href="${escapeHtml(href)}" ${isSocial ? 'target="_blank" rel="noopener noreferrer"' : ""}>
        ${icons[iconKey] || icons.email}
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(value)}</span>
      </a>`;
  }
}

/* ---------- FAQ page ------------------------------------------------------------------ */

function initFaqPage() {
  $$(".accordion__trigger").forEach((btn) => {
    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      const panel = btn.nextElementSibling;
      if (panel) panel.hidden = expanded;
    });
  });
}

/* ---------- Homepage reviews ---------------------------------------------------
   Genuine reviews ONLY (never fabricated). When none exist the section shows an
   honest empty state instead of invented quotes. */

function renderHomeReviews() {
  const host = $("#homeReviews");
  if (!host) return;

  import("./reviews.js")
    .then(({ default: revs, starsMarkup: stars }) => {
      const list = revs.featured(3);
      if (!list.length) {
        host.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <h3>No reviews yet</h3>
            <p>Reviews from verified Maveliq customers will appear here once they're in. We never publish invented feedback.</p>
          </div>`;
        return;
      }
      host.innerHTML = list
        .map(
          (r) => `
        <article class="review-card">
          ${stars(r.rating)}
          <blockquote>“${escapeHtml(r.body)}”</blockquote>
          <footer>
            <strong>${escapeHtml(r.authorName || "Customer")}</strong>
            ${r.verified ? "Verified purchase" : ""}
          </footer>
        </article>`
        )
        .join("");
    })
    .catch((e) => console.error("home reviews failed", e));
}

/* ---------- Newsletter ------------------------------------------------------------------ */

function initNewsletter() {
  $$("[data-newsletter]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = form.querySelector('input[type="email"]')?.value?.trim();
      if (!email) return;

      if (!settings.newsletter.endpoint) {
        toast("Newsletter signup will go live once the mailing list provider is connected.", "info", 5000);
        form.reset();
        return;
      }
      // Real endpoint configured
      fetch(settings.newsletter.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
        .then((r) => {
          if (!r.ok) throw new Error("signup failed");
          toast("Thank you for subscribing!", "success");
          form.reset();
        })
        .catch(() => toast("We could not subscribe you right now. Please try again later.", "error"));
    });
  });
}

/* ---------- Page-level init dispatch ------------------------------------------------------ */

const PAGE_INIT = {
  home: async () => {
    await renderHomeSections();
    renderHomeReviews();
  },
  shop: () => initShop(),
  product: () => initProductPage(),
  cart: () => initCartPage(),
  checkout: () => initCheckout(),
  confirmation: () => initConfirmation(),
  tracking: () => initTracking(),
  categories: () => initCategoriesPage(),
  contact: () => initContactPage(),
  faq: () => initFaqPage(),
};

/* ---------- Boot -------------------------------------------------------------------------- */

export async function bootPage() {
  // 1. Global chrome
  initNavigation();
  initSearch();
  initNewsletter();

  // 2. Fill any data-settings placeholders (policies/contact blocks)
  fillSettingsPlaceholders();

  // 3. Page-specific logic
  const page = document.body.dataset.page || "";
  const init = PAGE_INIT[page];
  if (init) {
    try {
      await init();
    } catch (e) {
      console.error(`[${page}] init failed`, e);
    }
  }

  // 4. Animations last so nothing stays invisible on failure
  initReveal();
}

/** Replace <span data-setting="delivery.charge"> style placeholders. */
function fillSettingsPlaceholders() {
  $$("[data-setting]").forEach((el) => {
    const path = el.dataset.setting;
    const val = settings.get(path, "");
    if (val === "" || val === null || val === undefined) return;
    if (el.dataset.format === "price") {
      el.textContent = `Rs ${Number(val).toLocaleString(CONFIG.locale)}`;
    } else {
      el.textContent = String(val);
    }
  });
}

/* Auto-boot when the module loads on a storefront page */
if (document.body && !document.body.dataset.admin) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootPage);
  } else {
    bootPage();
  }
}

export default bootPage;