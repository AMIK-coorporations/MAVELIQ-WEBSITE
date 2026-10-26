/* ==========================================================================
   MAVELIQ — js/config.js
   Central store configuration. THIS IS THE FILE TO EDIT FIRST.
   Everything the owner may want to change without touching code lives here,
   and the admin Settings screen stores overrides on top of these defaults.
   ========================================================================== */

export const CONFIG = {
  /* ---- Brand --------------------------------------------------------- */
  businessName: "MAVELIQ",          // Official brand name (all caps usage)
  displayName: "Maveliq",           // Title-case display name
  tagline: "Beauty & Personal Care",
  currency: "PKR",
  locale: "en-PK",
  market: "Pakistan",

  /* ---- Site ---------------------------------------------------------- */
  // Production domain, no trailing slash. Used for canonical URLs, OG tags,
  // sitemap and structured data. Update after deploying.
  siteUrl: "https://www.maveliq.com",

  /* ---- Backend -------------------------------------------- */
  // Leave apiUrl empty to run in DEMO MODE (localStorage-based catalogue and
  // orders) — which is the current, fully working state of this site.
  //
  // A backend (planned: insforge.dev) plugs in here later. The two functions
  // below are server endpoints that must re-validate prices, stock and totals
  // — browser-supplied money is never trusted.
  //
  // Use PUBLIC keys only. Never put a service/admin secret in js/.
  backend: {
    apiUrl: "",                        // e.g. "https://xxxx.insforge.dev"
    anonKey: "",                       // PUBLIC anon/publishable key only
    placeOrderFunction: "place-order", // endpoint that validates + creates orders
    trackOrderFunction: "track-order", // endpoint for secure order lookup
  },

  /* ---- Demo mode ----------------------------------------------------- */
  demoMode: true,   // auto-disabled below once backend.apiUrl + anonKey are filled

  /* ---- Delivery & charges (PKR) -------------------------------------- */
  delivery: {
    charge: 250,             // Standard delivery charge in PKR
    freeOver: 5000,          // Orders at/above this subtotal ship free (0 = never)
    codAvailable: true,      // Cash on Delivery — enable ONLY with a real courier arrangement
    estimatedDays: "3–5 business days",
    areas: "Nationwide delivery across Pakistan",
  },

  /* ---- Payment methods ------------------------------------------------ */
  // Only methods with enabled:true AND a verified configuration are shown.
  // Anything else stays disabled at checkout.
  payments: {
    cod:  { enabled: true,  label: "Cash on Delivery", note: "Pay in cash when your order arrives." },
    card: { enabled: false, label: "Debit / Credit Card", note: "Card payments will be enabled once a payment gateway is connected and verified." },
    jazzcash: { enabled: false, label: "JazzCash", note: "Not yet configured." },
    easypaisa: { enabled: false, label: "Easypaisa", note: "Not yet configured." },
  },

  /* ---- Contact (owner supplies the real values) ----------------------- */
  // Leave any field empty ("") and its button/link is automatically hidden.
  contact: {
    phone: "",            // e.g. "+92 300 1234567"
    whatsapp: "",         // e.g. "923001234567" (digits only, with country code)
    email: "",            // e.g. "support@maveliq.com"
    address: "",
    city: "",
    supportHours: "",
  },

  /* ---- Social profiles (owner supplies the real URLs) ----------------- */
  // Any empty URL is hidden automatically — never rendered as a dead link.
  social: {
    whatsapp:   "",
    instagram:  "",
    facebook:   "",
    tiktok:     "",
    youtube:    "",
    other:      "",   // any other owner-approved platform
    otherLabel: "",
  },

  /* ---- Partnerships ---------------------------------------------------- */
  // DIEDEI 3D section ships UNPUBLISHED. Publish only after the relationship is
  // confirmed in writing and approved copy/logo are supplied via admin Settings.
  partnerships: {
    diedei3d: {
      published: false,          // keep false until verified
      name: "DIEDEI 3D",
      logo: "",
      description: "",
      url: "",
      scope: "",
    },
  },

  /* ---- Newsletter ------------------------------------------------------ */
  // When endpoint is "" the form shows a demo notice instead of pretending to
  // subscribe anyone. Connect a real provider (e.g. Mailchimp) before launch.
  newsletter: {
    enabled: true,
    endpoint: "",        // POST endpoint that collects emails
  },

  /* ---- Orders ---------------------------------------------------------- */
  orders: {
    referencePrefix: "MV",
    referenceLength: 8,
    statusFlow: ["pending", "confirmed", "packed", "shipped", "delivered"],
    cancellableStatuses: ["pending", "confirmed"],
  },

  /* ---- Homepage content (editable in admin → Settings) ----------------- */
  home: {
    heroEyebrow: "Pakistan's beauty destination",
    heroTitle: "Beauty that feels",
    heroTitleAccent: "like you",
    heroText: "Discover skincare, fragrance and colour cosmetics chosen for everyday routines — with clear prices in PKR and delivery across Pakistan.",
    heroCta: "Shop Now",
    heroSecondaryCta: "Browse Categories",
    announcement: "Delivery across Pakistan · Cash on Delivery available",
  },

  /* ---- Admin ----------------------------------------------------------- */
  admin: {
    title: "Maveliq Store Administration",
    sessionKey: "maveliq_admin_session",
    lowStockDefault: 5,
  },
};

/* Auto-switch out of demo mode when backend keys are present. */
if (CONFIG.backend.apiUrl && CONFIG.backend.anonKey) {
  CONFIG.demoMode = false;
}
