# assets/fonts

Maveliq currently loads its two typefaces from **Google Fonts** via a standard
`<link>` in every page `<head>` — there are no font binaries in this folder yet.

| Role | Family | Weights used |
| --- | --- | --- |
| Display / headings | **Fraunces** | 400, 500, 600 (incl. italic 400) |
| Body / UI | **Jost** | 300, 400, 500, 600 |

```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet" />
```

Both families are licensed under the **SIL Open Font License 1.1**, so they may
be used, embedded and self-hosted freely — including commercially.

## Self-hosting (recommended before launch)

Self-hosting removes a third-party request, avoids the render-blocking
`fonts.googleapis.com` round trip, and keeps visitor IP addresses away from
Google. To switch:

1. Download the woff2 files for both families (e.g. from
   [google-webfonts-helper](https://gwfh.mranftl.com/) or Fontsource).
2. Drop them in this folder, e.g. `assets/fonts/fraunces-latin.woff2`.
3. Add `@font-face` rules to `css/style.css` above the `:root` tokens:

   ```css
   @font-face {
     font-family: "Fraunces";
     font-style: normal;
     font-weight: 400 600;
     font-display: swap;
     src: url("../assets/fonts/fraunces-latin.woff2") format("woff2");
   }
   ```

4. Remove the Google Fonts `<link>` and both `preconnect` tags from every page.

The `font-display: swap` value keeps text visible while fonts load, which is
already the behaviour the Google Fonts URL requests via `display=swap`.

## Variable-font note

Fraunces is a variable font with an optical-size axis (`opsz`). If you
self-host, prefer the variable woff2 to keep one file instead of three, and
set `font-variation-settings` where you want the display optical size.
