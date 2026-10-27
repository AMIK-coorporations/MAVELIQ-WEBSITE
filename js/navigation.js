/* ==========================================================================
   MAVELIQ — js/navigation.js
   Renders the shared header, mobile drawer and footer into #site-header /
   #site-footer placeholders, wires up:
     • primary nav with aria-current highlighting
     • header search (submits to shop.html)
     • cart badge kept in sync with the cart
     • mobile menu open/close with focus trapping
     • scroll shadow on the header
     • social + contact links that are HIDDEN unless configured
   ========================================================================== */

import { CONFIG } from "./config.js";
import { $, $$, escapeHtml } from "./utils.js";
import settings from "./services/settings-service.js";
import { initWishlist, heartIcon } from "./wishlist.js";
import { initFloatingWhatsApp, whatsappEnabled } from "./whatsapp.js";

/* ---------- SVG icon set -------------------------------------------------- */

const icons = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  cart:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  user:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  menu:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  close:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.4 9.4 0 0 1-4.79-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.38 9.38 0 0 1-1.44-5.01c0-5.18 4.22-9.4 9.41-9.4a9.35 9.35 0 0 1 6.65 2.76 9.32 9.32 0 0 1 2.75 6.65c0 5.18-4.22 9.41-9.4 9.41zM20.52 3.49A11.8 11.8 0 0 0 12.04 0C5.5 0 .17 5.33.17 11.89c0 2.1.55 4.15 1.6 5.96L.07 24l6.3-1.65a11.9 11.9 0 0 0 5.67 1.44c6.55 0 11.88-5.33 11.88-11.89 0-3.18-1.24-6.16-3.49-8.41z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H7v3h3v7h3v-7h3l1-3h-4v-2c0-.55.45-1 1-1z"/></svg>',
  tiktok:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3c.4 2.3 1.9 3.9 4.2 4.1v3c-1.6 0-3-.5-4.2-1.4v6.1c0 3.6-2.6 6.2-6 6.2S4.5 18.4 4.5 14.8c0-3.4 2.5-6.1 6-6.2v3.1a6 6 0 0 0-1.3-.1c-1.5 0-2.7 1.2-2.7 2.7S7.7 17 9.2 17s2.7-1.2 2.7-2.7V3h4.6z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12s0-3.3-.4-4.9a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.6 2.6 0 0 0-1.8 1.8C2 8.7 2 12 2 12s0 3.3.4 4.9a2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8c.4-1.6.4-4.9.4-4.9zM10 15.2V8.8l5.5 3.2-5.5 3.2z"/></svg>',
  phone:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 1.9.6 2.8a2 2 0 0 1-.4 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.8.6a2 2 0 0 1 1.8 2z"/></svg>',
  mail:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>',
  location:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  external:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/></svg>',
};

export function icon(name) {
  return icons[name] || "";
}

/* ---------- Navigation model ------------------------------------------------- */

const NAV = [
  { label: "Home", href: "index.html" },
  { label: "Shop", href: "shop.html" },
  { label: "Categories", href: "categories.html" },
  { label: "About", href: "about.html" },
  { label: "Contact", href: "contact.html" },
];

/* Footer links follow the owner-approved list in CONTENT-SPEC.md. */
const FOOTER_COLS = [
  {
    title: "Shop",
    links: [
      { label: "Home", href: "index.html" },
      { label: "Shop All", href: "shop.html" },
      { label: "Categories", href: "categories.html" },
      { label: "Wishlist", href: "wishlist.html" },
      { label: "Track Your Order", href: "track-order.html" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Maveliq", href: "about.html" },
      { label: "DIEFEI 3D Partnership", href: "diefei-3d.html" },
      { label: "Contact Us", href: "contact.html" },
      { label: "Frequently Asked Questions", href: "faq.html" },
    ],
  },
  {
    title: "Policies",
    links: [
      { label: "Shipping Policy", href: "shipping-policy.html" },
      { label: "Returns and Refunds", href: "returns-policy.html" },
      { label: "Privacy Policy", href: "privacy-policy.html" },
      { label: "Terms and Conditions", href: "terms.html" },
    ],
  },
];

/* Popular collections shown in the footer (category landing pages). */
const FOOTER_COLLECTIONS = [
  { label: "Lipsticks", href: "shop.html?category=lipsticks" },
  { label: "Face Washes", href: "shop.html?category=face-washes" },
  { label: "Perfumes & Body Mists", href: "shop.html?category=perfumes-body-mists" },
  { label: "Makeup Essentials", href: "shop.html?category=makeup" },
  { label: "Hair Colour", href: "shop.html?category=hair-colour" },
  { label: "Bundles & Kits", href: "shop.html?category=bundles-kits" },
];

/* ---------- Header ----------------------------------------------------------- */

function headerMarkup() {
  const s = settings;
  const socials = s.activeSocials;

  return `
  ${s.get("home.announcement", CONFIG.home.announcement)
    ? `<div class="announcement">${escapeHtml(s.get("home.announcement", CONFIG.home.announcement))}</div>`
    : ""}
  <header class="site-header" id="siteHeader">
    <div class="container site-header__inner">
      <button class="icon-btn nav-toggle" id="navToggle" type="button"
              aria-label="Open menu" aria-expanded="false" aria-controls="mobileNav">
        ${icons.menu}
      </button>

      <a class="brand" href="index.html" aria-label="${escapeHtml(s.displayName)} — home">
        <span class="brand__mark">${escapeHtml(s.businessName)}</span>
      </a>

      <nav class="nav-primary" aria-label="Primary">
        <ul class="nav-primary__list">
          ${NAV.map((item) => `
            <li><a class="nav-primary__link" href="${item.href}" data-nav="${item.href}">${item.label}</a></li>`).join("")}
        </ul>
      </nav>

      <div class="header-actions">
        <form class="header-search" role="search" action="shop.html" method="get">
          <label class="sr-only" for="headerSearch">Search products</label>
          ${icons.search}
          <input id="headerSearch" name="q" type="search" placeholder="Search products, categories, or brands..." autocomplete="off" />
        </form>

        ${socials.slice(0, 3).map((sx) => `
          <a class="icon-btn" href="${escapeHtml(sx.url)}" target="_blank" rel="noopener noreferrer"
             aria-label="${escapeHtml(sx.label)}">${icons[sx.key] || icons.external}</a>`).join("")}

        <a class="icon-btn wish-link" href="wishlist.html" id="wishIcon" aria-label="Wishlist">
          ${heartIcon()}
          <span class="cart-count" id="wishCount" data-count="0">0</span>
        </a>

        <a class="icon-btn" href="cart.html" id="cartIcon" aria-label="Shopping cart">
          ${icons.cart}
          <span class="cart-count" id="cartCount" data-count="0">0</span>
        </a>
      </div>
    </div>
  </header>

  <div class="nav-overlay" id="navOverlay" hidden></div>

  <aside class="mobile-nav" id="mobileNav" aria-label="Mobile navigation" aria-hidden="true">
    <div class="mobile-nav__head">
      <span class="brand__mark" style="font-size:1.1rem">${escapeHtml(s.businessName)}</span>
      <button class="icon-btn" id="navClose" type="button" aria-label="Close menu">${icons.close}</button>
    </div>
    <form class="mobile-search" role="search" action="shop.html" method="get"
          style="padding:16px 20px 4px">
      <label class="sr-only" for="mobileSearch">Search products</label>
      <div class="search-field">${icons.search}
        <input class="input" id="mobileSearch" name="q" type="search" placeholder="Search products…" />
      </div>
    </form>
    <ul class="mobile-nav__list">
      ${NAV.map((i) => `<li><a href="${i.href}" data-nav="${i.href}">${i.label}</a></li>`).join("")}
      <li><a href="diefei-3d.html" data-nav="diefei-3d.html">DIEFEI 3D Partnership</a></li>
      <li><a href="wishlist.html" data-nav="wishlist.html">Wishlist</a></li>
      <li><a href="faq.html" data-nav="faq.html">FAQs</a></li>
      <li><a href="track-order.html" data-nav="track-order.html">Track Your Order</a></li>
      <li><a href="cart.html" data-nav="cart.html">Cart</a></li>
    </ul>
    <div class="mobile-nav__foot">
      ${socials.length ? `
        <div class="social-list">
          ${socials.map((sx) => `
            <a href="${escapeHtml(sx.url)}" target="_blank" rel="noopener noreferrer"
               aria-label="${escapeHtml(sx.label)}">${icons[sx.key] || icons.external}</a>`).join("")}
        </div>` : ""}
      ${s.contact.email ? `<p style="margin-top:12px;font-size:0.75rem;color:var(--c-ink-mute)">${escapeHtml(s.contact.email)}</p>` : ""}
    </div>
  </aside>`;
}

/* ---------- Footer ------------------------------------------------------------ */

function footerMarkup() {
  const s = settings;
  const socials = s.activeSocials;
  const year = new Date().getFullYear();

  const contactLine = [
    s.contact.phone ? `<a href="tel:${escapeHtml(String(s.contact.phone).replace(/[^\d+]/g, ""))}">${escapeHtml(s.contact.phone)}</a>` : "",
    s.contact.email ? `<a href="mailto:${escapeHtml(s.contact.email)}">${escapeHtml(s.contact.email)}</a>` : "",
  ].filter(Boolean).join(" · ");

  return `
  <footer class="site-footer">
    <div class="container site-footer__top">
      <div class="footer-brand">
        <a class="brand" href="index.html"><span class="brand__mark">${escapeHtml(s.businessName)}</span></a>
        <p class="footer-tagline">${escapeHtml(s.get("tagline", CONFIG.tagline))}</p>
        <p>Maveliq is an online destination for beauty, skincare, makeup, and personal-care products. We aim to make discovering and ordering everyday beauty essentials simple and convenient.</p>
        ${socials.length ? `
          <div class="social-list">
            ${socials.map((sx) => `
              <a href="${escapeHtml(sx.url)}" target="_blank" rel="noopener noreferrer"
                 aria-label="${escapeHtml(sx.label)}">${icons[sx.key] || icons.external}</a>`).join("")}
          </div>` : ""}
      </div>

      ${FOOTER_COLS.map((col) => `
        <div>
          <h3>${col.title}</h3>
          <ul>${col.links.map((l) => `<li><a href="${l.href}">${l.label}</a></li>`).join("")}</ul>
        </div>`).join("")}
    </div>

    <div class="container site-footer__collections">
      <span>Popular collections:</span>
      ${FOOTER_COLLECTIONS.map((l) => `<a href="${l.href}">${l.label}</a>`).join("")}
    </div>

    <div class="container site-footer__bottom">
      <span>© ${year} ${escapeHtml(s.displayName)}. All rights reserved.</span>
      <span>${contactLine || "Contact details available on our Contact page."}</span>
      <div class="footer-payments">
        ${s.enabledPayments.map((p) => `<span class="payment-chip">${escapeHtml(p.label)}</span>`).join("")}
      </div>
    </div>
  </footer>`;
}

/* ---------- Cart badge ---------------------------------------------------------- */

function updateCartBadge(bump = false) {
  const badge = document.getElementById("cartCount");
  if (!badge) return;
  let count = 0;
  try {
    const cart = JSON.parse(localStorage.getItem("maveliq:cart") || "[]");
    count = Array.isArray(cart)
      ? cart.reduce((n, l) => n + (Number(l.quantity) || 0), 0)
      : 0;
  } catch { count = 0; }

  badge.textContent = String(count);
  badge.dataset.count = String(count);
  if (bump) {
    badge.classList.remove("bump");
    void badge.offsetWidth;   // reflow to restart animation
    badge.classList.add("bump");
  }
}

export { updateCartBadge };

/* ---------- Active nav highlighting ------------------------------------------------ */

function markActiveNav() {
  const page = window.location.pathname.split("/").pop() || "index.html";
  $$("[data-nav]").forEach((a) => {
    const href = a.getAttribute("data-nav");
    if (href === page) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  // Shop section also covers product pages
  if (page === "product.html") {
    $$('[data-nav="shop.html"]').forEach((a) => a.setAttribute("aria-current", "page"));
  }
}

/* ---------- Mobile drawer ---------------------------------------------------------- */

function initDrawer() {
  const toggle = document.getElementById("navToggle");
  const drawer = document.getElementById("mobileNav");
  const overlay = document.getElementById("navOverlay");
  const closeBtn = document.getElementById("navClose");
  if (!toggle || !drawer || !overlay) return;

  const open = () => {
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("is-open"));
    toggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("no-scroll");
    closeBtn?.focus();
  };

  const close = () => {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    overlay.classList.remove("is-open");
    setTimeout(() => { if (!drawer.classList.contains("is-open")) overlay.hidden = true; }, 300);
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("no-scroll");
    toggle.focus();
  };

  toggle.addEventListener("click", () => (drawer.classList.contains("is-open") ? close() : open()));
  closeBtn?.addEventListener("click", close);
  overlay.addEventListener("click", close);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("is-open")) close();
    // simple focus trap
    if (e.key === "Tab" && drawer.classList.contains("is-open")) {
      const focusables = drawer.querySelectorAll('a[href], button, input, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

/* ---------- Scroll shadow ----------------------------------------------------------- */

function initScrollShadow() {
  const header = document.getElementById("siteHeader");
  if (!header) return;
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* ---------- Demo-mode banner ------------------------------------------------------------ */

function maybeDemoBanner() {
  if (!CONFIG.demoMode) return;
  if (document.querySelector(".demo-banner")) return;
  const bar = document.createElement("div");
  bar.className = "demo-banner";
  bar.textContent = whatsappEnabled()
    ? "Online checkout is in demo mode — orders placed here are saved only in this browser. Use “Order on WhatsApp” to send your order to the store."
    : "Demo mode — orders placed through checkout are saved only in this browser. Connect a real backend before accepting customer orders.";
  document.body.prepend(bar);
}

/* ---------- Boot ---------------------------------------------------------------- */

export function initNavigation() {
  const headerSlot = document.getElementById("site-header");
  const footerSlot = document.getElementById("site-footer");

  if (headerSlot) headerSlot.innerHTML = headerMarkup();
  if (footerSlot) footerSlot.innerHTML = footerMarkup();

  markActiveNav();
  initDrawer();
  initScrollShadow();
  updateCartBadge(false);

  // Keep badge in sync across tabs / cart changes
  window.addEventListener("storage", (e) => {
    if (e.key === "maveliq:cart") updateCartBadge(false);
  });
  window.addEventListener("maveliq:cart-updated", () => updateCartBadge(true));

  maybeDemoBanner();
  initWishlist();
  initFloatingWhatsApp();
  initAnalytics();
}

/* ---------- Optional analytics hook ------------------------------------------------
   Loads Google Analytics 4 ONLY when the owner sets gaMeasurementId in
   js/config.js (or admin → Settings). Empty by default = no tracking script. */

function initAnalytics() {
  const id = settings.gaMeasurementId;
  if (!id || !/^G-[A-Z0-9]{4,}$/i.test(id) || window.__maveliqGa) return;
  window.__maveliqGa = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", id, { anonymize_ip: true });
}

export default initNavigation;