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
  tagline: "Beauty, Care & Everyday Essentials.",   // owner-approved (CONTENT-SPEC)
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
  // The WhatsApp number also powers "Order on WhatsApp" (product page + cart)
  // and the floating chat button — all of them stay hidden while it is empty.
  contact: {
    phone: "",            // TODO owner: verified phone, e.g. "+92 300 1234567"
    whatsapp: "",         // TODO owner: WhatsApp number, digits only with country code, e.g. "923001234567"
    email: "",            // TODO owner: working support email, e.g. "support@maveliq.com"
    address: "",          // TODO owner: business address (optional — leave empty to hide)
    city: "",             // TODO owner: city (optional)
    supportHours: "",     // TODO owner: e.g. "Mon–Sat, 10am–8pm" or "24/7" — shown only when set
  },

  /* ---- Social profiles (owner supplies the real URLs) ----------------- */
  // Any empty URL is hidden automatically — never rendered as a dead link.
  social: {
    whatsapp:   "",   // TODO owner: WhatsApp channel/number (optional)
    instagram:  "",   // TODO owner: Instagram profile URL
    facebook:   "",   // TODO owner: Facebook page URL
    tiktok:     "",   // TODO owner: TikTok profile URL
    youtube:    "",   // TODO owner: YouTube channel URL
    other:      "",   // TODO owner: any other owner-approved platform URL
    otherLabel: "",
  },

  /* ---- Returns -------------------------------------------------------- */
  // The returns window is NOT invented: while windowDays is empty the site
  // says "see our returns policy" instead of quoting a number.
  returns: {
    windowDays: "",       // TODO owner: number of days after delivery, e.g. "7"
  },

  /* ---- Analytics (optional) ------------------------------------------- */
  // Google Analytics 4 measurement ID, e.g. "G-XXXXXXXXXX". Empty = no
  // analytics script is loaded at all. Update the privacy policy before enabling.
  gaMeasurementId: "",    // TODO owner: your own GA4 ID (optional)

  /* ---- Partnerships ---------------------------------------------------- */
  // DIEFEI 3D partnership. The copy below is the owner-approved text from
  // CONTENT-SPEC.md (homepage section + diefei-3d.html). Logo and external
  // link are added only once the owner supplies them.
  partnerships: {
    diefei3d: {
      published: true,
      name: "DIEFEI 3D",
      logo: "",                  // TODO owner: approved DIEFEI 3D logo path/URL
      description: "Maveliq partners with DIEFEI 3D to bring selected DIEFEI 3D products to our customers. Through this partnership, we aim to make these products easier to discover and explore alongside our beauty and personal-care collection.",
      url: "",                   // TODO owner: approved external link (optional)
      scope: "",
      page: "diefei-3d.html",
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
    // Owner-approved copy (CONTENT-SPEC.md → Page 1)
    heroEyebrow: "YOUR BEAUTY, YOUR WAY",
    heroTitle: "Discover Beauty That Fits",
    heroTitleAccent: "Your Everyday Life",
    heroText: "Explore a thoughtfully organized collection of makeup, skincare, cosmetics, and personal-care essentials at Maveliq. From everyday beauty basics to products for your personal-care routine, discover options for different preferences and occasions.",
    heroCta: "Shop All Products",
    heroSecondaryCta: "Explore Categories",
    announcement: "Discover beauty and personal-care essentials at Maveliq.",
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
