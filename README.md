# MAVELIQ — Beauty & Personal Care E-Commerce

A complete, original, responsive e-commerce website for **MAVELIQ** built with
**plain HTML5, CSS3 and vanilla JavaScript (ES6+)**. No PHP. No frontend framework,
no build step.

Currency: **PKR (Rs)**. Primary market: **Pakistan**.

---

## 1. What this project contains

| Area | Status |
|---|---|
| Design system (CSS variables, components) | ✅ Built |
| Homepage, Shop, Categories, Product detail | ✅ Built |
| Search, filters, sorting, pagination (URL-driven) | ✅ Built |
| Cart (localStorage) + variant/quantity handling | ✅ Built |
| Checkout with validation + order reference | ✅ Built |
| Secure order tracking (reference + phone) | ✅ Built |
| Policies, FAQ, Contact, About, 404 | ✅ Built |
| SEO (meta, OG, canonical, JSON-LD, sitemap, robots) | ✅ Built |
| Admin dashboard (products, categories, orders, inventory, settings) | ✅ Built |
| Real catalogue: 89 DIEFEI 3D products, 8 categories, local WebP photos | ✅ Built |
| Order on WhatsApp (product page, cart, confirmation) + floating chat button | ✅ Built — appears once a WhatsApp number is set |
| Wishlist (heart on cards + product page, header count, `wishlist.html`) | ✅ Built |
| Homepage trust strip, Bundles & Kits, About / Support teasers, SEO guide | ✅ Built |
| Category landing pages (`shop.html?category=…`) with intro copy | ✅ Built |
| DIEFEI 3D partnership page (`diefei-3d.html`) | ✅ Published (owner-approved copy) |
| Order note at checkout · optional GA4 hook | ✅ Built |
| Runs with **no database at all** | ✅ Demo mode |
| Database backend (insforge.dev) | ⏳ Planned — connect later |

> **Honesty notes (per PRD):**
> - The site currently runs in **demo mode**: catalogue comes from
>   `data/*.json`, cart/orders/settings live in the browser's `localStorage`.
>   The UI labels this clearly. **Checkout orders never reach the owner** until
>   a backend is configured — the working ordering channel today is
>   **Order on WhatsApp**, which appears as soon as `contact.whatsapp` is set.
> - The admin sign-in in demo mode is a **UX preview gate, not security**.
>   Real protection comes from database policies on the backend.
> - **No reviews, ratings, contact details, social URLs, ingredients or
>   certifications are invented anywhere.** Product names, sizes, shades and
>   PKR prices come from the DIEFEI 3D supplier catalogue; every description is
>   Maveliq's own wording without medical claims. Stock figures are
>   placeholders (50 per available variant, 0 when sold out) until you set real
>   inventory. Social/contact/WhatsApp buttons with no value configured are
>   hidden — never rendered as dead links.
> - The **DIEFEI 3D partnership** homepage section and `diefei-3d.html` use the
>   owner-approved copy from `CONTENT-SPEC.md`. Logo and external link stay
>   empty until supplied.

---

## 2. Folder structure

```
maveliq/
├── index.html                 Homepage
├── shop.html                  Product catalogue (search/filter/sort/paginate)
├── categories.html            Category listing
├── product.html               Product detail (?id=...)
├── cart.html                  Shopping cart
├── checkout.html              Checkout
├── order-confirmation.html    Order confirmation + reference number
├── track-order.html           Order tracking (reference + phone required)
├── about.html                 About Maveliq
├── contact.html               Contact methods + message form
├── faq.html                   FAQ (accordion + JSON-LD FAQ schema)
├── privacy-policy.html        Privacy policy
├── terms.html                 Terms & conditions
├── shipping-policy.html       Shipping policy
├── returns-policy.html        Returns & refunds policy
├── wishlist.html              Saved products (this browser)
├── diefei-3d.html             DIEFEI 3D partnership page
├── 404.html                   Page not found
├── admin/
│   ├── index.html             Dashboard (stats, recent orders, low stock)
│   ├── products.html          Product management
│   ├── categories.html        Category management
│   ├── orders.html            Order management + status/dispatch updates
│   ├── inventory.html         Stock control
│   └── settings.html          Store settings (brand, contact, payments…)
├── assets/
│   ├── images/                Original SVG artwork, favicon, og-image.jpg (1200×630)
│   │   └── products/          203 product photos, WebP q80, max 1000px (≈6.2 MB)
│   ├── icons/                 README — icons are inline SVG (see file)
│   └── fonts/                 README — font licences + self-hosting guide
├── css/
│   ├── style.css              Design tokens + base + layout
│   ├── components.css         Buttons, cards, forms, tables, toasts, modals
│   ├── product.css            Shop + product detail
│   ├── cart.css               Cart + confirmation + tracking
│   ├── checkout.css           Checkout-only styles
│   ├── admin.css              Admin dashboard shell
│   └── responsive.css         Breakpoints for all of the above
├── js/
│   ├── config.js              Store configuration — EDIT THIS FIRST
│   ├── utils.js               Formatting, escaping, storage, toasts
│   ├── validation.js          Validation rules + form helpers
│   ├── navigation.js          Header, footer, drawer, cart badge
│   ├── search.js              Search suggestion dropdown
│   ├── products.js            Catalogue rendering, filters, sorting, sections
│   ├── product-detail.js      PDP: variants, gallery, accordions, add-to-cart
│   ├── cart.js                Cart logic + cart page rendering
│   ├── checkout.js            Checkout logic
│   ├── orders.js              Order confirmation rendering
│   ├── tracking.js            Order tracking rendering
│   ├── reviews.js             Reviews (genuine-only, honest empty states)
│   ├── whatsapp.js            Order-on-WhatsApp messages + floating chat button
│   ├── wishlist.js            Wishlist storage, heart buttons, header count
│   ├── admin.js               Entire admin dashboard (all 6 screens)
│   ├── app.js                 Boot + page dispatch (data-page)
│   └── services/
│       ├── settings-service.js   Settings: CONFIG defaults + admin overrides
│       ├── product-service.js    Products/categories (JSON now, DB later)
│       ├── order-service.js      Orders (localStorage now, DB later)
│       └── auth-service.js       Admin sign-in (demo gate now, real auth later)
├── data/
│   ├── products.json          89 DIEFEI 3D products (variants, prices, images)
│   └── categories.json        8 categories, each with landing-page intro copy
├── robots.txt
├── sitemap.xml
└── README.md
```

> `supabase/schema.sql` is a **leftover placeholder note** — the project will
> use **insforge.dev** instead. You can delete the `supabase/` folder freely.

---

## 3. Quick start (works with no database)

No install, no build step. Serve the folder so `fetch("data/*.json")` works:

```bash
# Python
python -m http.server 8080

# Node
npx serve .
```

Then open `http://localhost:8080`.

### What works right now, out of the box

- Full catalogue browsing, search, filters, sorting, pagination
- Product detail with variants, stock and honest "No reviews yet" states
- Cart + variant editing persisted in `localStorage`
- Checkout → order reference → confirmation page → order tracking
- Admin dashboard at `/admin/` — demo sign-in:

  | | |
  |---|---|
  | Email | `admin@maveliq.local` |
  | Password | `maveliq-demo` |

  (Orders you place on the storefront appear in the dashboard immediately.)

Everything runs from `data/*.json` + `localStorage`. Nothing is uploaded
anywhere.

---

## 4. Configuration — where to change things

**Two places, in this order:**

1. **`js/config.js`** — defaults for everything: brand name, currency, delivery
   charges, payment toggles, contact details, social URLs, homepage copy,
   returns window, optional analytics ID. Every owner-supplied field is marked
   `TODO owner`.
2. **admin → Settings** — the same values as *overrides* saved on top of the
   defaults (stored in `localStorage` in demo mode). Includes discount codes and
   the DIEFEI 3D partnership block.

Rules the code enforces for you:

- A contact/social field left as `""` → its button is **hidden**, never a dead link.
- `contact.whatsapp` empty → no "Order on WhatsApp" buttons and no floating
  chat button. Set it (digits with country code, e.g. `923001234567`) and they
  all appear.
- `returns.windowDays` empty → the site says "see our returns policy" instead
  of quoting a number.
- `gaMeasurementId` empty → no analytics script is loaded.
- A payment method with `enabled: false` → shown disabled with an honest note.
- Discount codes: percentages are capped at 1–100 %, totals never go below
  zero, and deleting a code in admin really removes it.
- `partnerships.diefei3d.published: false` → the homepage section is hidden.
  (Old browsers that saved the misspelt `diedei3d` key are migrated automatically.)

### Catalogue data

`data/products.json` follows the schema in `js/services/product-service.js`.
Variants keep per-option `priceDelta` and `stock` (e.g. body mists 60 ml / 125 ml
at Rs 250 / Rs 550). Optional `ingredients`, `usage`, `warnings` and
`expiryInfo` fields are shown on the product page only when filled in.

In demo mode localStorage never holds a copy of the catalogue — only admin
edits (`catalogue_edits`) and units sold per product/variant
(`stock_deltas`), so updating `data/products.json` always shows up.

---

## 5. Backend (later) — insforge.dev

No database is connected yet and none is required to run or review the site.
When you're ready to go live:

1. Create the project on [insforge.dev](https://insforge.dev) and take the
   public client credentials (never a service/admin secret in frontend code).
2. Add the credentials in `js/config.js` under `backend`, and set
   `demoMode: false`.
3. Wire the four service files — they are the **only** place that talks to the
   network, so nothing else changes:
   - `js/services/product-service.js` — read products/categories
   - `js/services/order-service.js` — create + look up orders
   - `js/services/settings-service.js` — load/save settings
   - `js/services/auth-service.js` — admin authentication
4. Server-side requirements before accepting real orders (non-negotiable):
   - **Re-validate price, stock and totals on the server.** Browser-supplied
     money values are never authoritative.
   - Order lookup must require **reference + phone** (or equivalent), so one
     customer can never read another's order.
   - Enforce write permissions with database row-level policies — hiding admin
     pages in the browser is **not** security.

---

## 6. Deployment (GitHub + Vercel)

1. Push the repository to GitHub.
2. On [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Framework preset: **Other**. No build command. Output: repository root.
4. After the site has a real domain, update `siteUrl` in `js/config.js` and the
   URLs in `sitemap.xml` / `robots.txt` / canonical tags to match.

> Until a backend exists, everyone who visits the deployed site shares their
> own separate browser-local demo cart and orders. That's expected — the banner
> on the site says so.

---

## 7. Owner checklist before launch

- [ ] Real logo + favicon (replace the placeholder SVGs in `assets/images/`)
- [ ] Real stock levels (current figures are placeholders), and confirm prices
- [ ] **WhatsApp number** in `js/config.js → contact.whatsapp` — this switches on
      WhatsApp ordering, which is the only way orders reach you until a backend exists
- [ ] Contact details: phone, email, address, support hours
- [ ] Returns window (`returns.windowDays`) and the bracketed policy placeholders
- [ ] Confirm the domain and update `siteUrl`, canonical tags, `sitemap.xml`, `robots.txt`
- [ ] Social URLs — any left blank stay **hidden** (never dead links)
- [ ] Delivery charge, free-delivery threshold, estimated days
- [ ] Payment methods actually arranged (enable COD only with a real courier
      arrangement; enable card/JazzCash/Easypaisa only once verified)
- [ ] Review the policy pages — they ship as neutral drafts with bracketed
      `[owner to confirm]` placeholders; make them match your real practices
- [ ] **DIEFEI 3D** — published with the CONTENT-SPEC copy. Add the approved
      logo/link in admin → Settings. Never claim exclusivity, distributorship
      or authorisation without written evidence.
- [ ] Connect the backend (insforge.dev) and re-test the full order flow

---

## 8. Security model

- **Now (demo mode):** everything is client-side and local to each browser.
  The admin gate is clearly labelled as a demo sign-in. All dynamic HTML passes
  through `escapeHtml()` to prevent XSS. This mode is for development/review only.
- **Later (backend):** admin login via real authentication; `admin/*` pages call
  `requireAdmin()` for UX while database policies do the actual enforcement;
  order creation only through a server function that re-validates money and
  stock; order reads require reference + phone; products/categories/settings
  publicly readable but admin-writable only.

---

## 9. Testing checklist

Walk through this before every release:

1. Home, Shop, Categories, Product detail, Cart, Checkout, Confirmation, Tracking
2. Search box (desktop + mobile drawer) returns correct suggestions
3. Filters + sorting + pagination survive a page reload (URL state)
4. Variant selection changes price/stock correctly; out-of-stock blocks purchase
5. Cart: quantity change, variant edit, remove, promo code apply/remove
6. Checkout: every required field validates; a bad phone number is rejected
7. Order confirmation shows a reference; tracking accepts ref + phone and
   rejects wrong pairs
8. Admin: sign in, edit a product, toggle stock, change an order status
9. Policies/FAQ/contact links all resolve (no 404s)
10. Social/contact buttons only appear when configured
11. Mobile layout at 360px, tablet at 768px, desktop at 1280px+
12. No console errors on any page
13. Keyboard navigation: skip link, focus rings, modal open/close
14. Lighthouse: no critical accessibility or SEO failures
15. Empty states: empty cart, no search results, no reviews, no orders
16. DIEFEI 3D section hidden while `published: false`; `diefei-3d.html` lists products
17. With `contact.whatsapp` set: WhatsApp buttons on product page, cart and
    confirmation open wa.me with items, variants, quantities and total
18. Wishlist: heart toggles on cards/product page, header count, `wishlist.html`
19. `shop.html?category=lipsticks` shows the category heading + intro copy
20. Admin thumbnails load; `admin/?redirect=javascript:…` falls back to the dashboard

---

## 10. Browser support

Modern evergreen browsers (Chrome, Firefox, Edge, Safari — last 2 versions).
Uses ES modules, `IntersectionObserver`, `Intl.NumberFormat`, CSS grid/flexbox
and custom properties.

---

© Maveliq. Original design and code. Product photography: DIEFEI 3D supplier
catalogue (partnership). Product descriptions and site copy: Maveliq's own wording.
