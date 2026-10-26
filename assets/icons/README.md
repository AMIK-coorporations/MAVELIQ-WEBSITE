# assets/icons

Icons used across Maveliq live **inline in the markup** rather than as separate
files. This is deliberate:

- Inline SVG can inherit `currentColor`, so icons adapt to hover/active states
  with no extra CSS or sprite bookkeeping.
- It avoids an extra HTTP request per icon.
- There is no icon-font dependency to load or FOUT to manage.

You will find the icon definitions as `<svg>…</svg>` blocks inside:

| Location | Icons |
| --- | --- |
| `js/navigation.js` | header, drawer, cart, search, chevrons |
| `js/admin.js` | admin sidebar + toolbar (`const I = { … }`) |
| `js/utils.js` | toast success/error/info |
| `css/*.css` | small decorative chevrons/plus rendered via `data:` URI backgrounds |

## When to add a file here

Add a standalone `.svg` file to this folder only when something genuinely needs
a separate asset file:

- an `apple-touch-icon` or PWA icon referenced from HTML `<link>` tags,
- an icon requested as an image by a third party,
- a downloadable brand-icon pack.

Keep icons on a **24×24 viewBox, 1.7–2px stroke, `fill="none"`** to match the
existing set, and save them as plain SVG (no embedded rasters).

The site's favicon is **not** here — it lives at `assets/images/favicon.svg`.
