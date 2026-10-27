/* ==========================================================================
   MAVELIQ — js/search.js
   Live search suggestions for the header and shop search boxes.
   Shows matching products as the customer types and submits to shop.html.
   ========================================================================== */

import { $, $$, formatPrice, escapeHtml, escapeAttr, debounce } from "./utils.js";
import products from "./services/product-service.js";

const MAX_SUGGESTIONS = 6;

let index = null;       // cached lightweight search index
let indexPromise = null;

async function loadIndex() {
  if (index) return index;
  if (!indexPromise) {
    indexPromise = products
      .getProducts()
      .then((list) => {
        index = list.map((p) => ({
          id: p.id,
          name: p.name,
          categoryId: p.categoryId,
          price: p.price,
          image: p.images[0] || "assets/images/ph-other-1.svg",
          haystack: [p.name, p.brand, p.shortDescription].join(" ").toLowerCase(),
        }));
        return index;
      })
      .catch((e) => {
        console.warn("search index unavailable", e);
        indexPromise = null;
        return [];
      });
  }
  return indexPromise;
}

function match(term) {
  const t = term.trim().toLowerCase();
  if (!t) return [];
  const starts = [];
  const contains = [];
  for (const item of index || []) {
    if (item.name.toLowerCase().startsWith(t)) starts.push(item);
    else if (item.haystack.includes(t)) contains.push(item);
    if (starts.length >= MAX_SUGGESTIONS) break;
  }
  return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
}

/* ---------- Dropdown ------------------------------------------------------------ */

function ensureDropdown(input) {
  const existing = input.parentElement.querySelector(".search-suggest");
  if (existing) return existing;

  const box = document.createElement("div");
  box.className = "search-suggest";
  box.setAttribute("role", "listbox");
  box.style.cssText = `
    position:absolute; top:calc(100% + 6px); left:0; right:0; z-index:120;
    background:#fff; border:1px solid var(--c-line); border-radius:12px;
    box-shadow:var(--shadow-md); overflow:hidden; display:none;`;
  input.parentElement.appendChild(box);
  return box;
}

function renderSuggestions(box, items, term) {
  if (!items.length) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }
  box.innerHTML = items
    .map(
      (p) => `
    <a class="search-suggest__item" href="product.html?id=${encodeURIComponent(p.id)}" role="option"
       style="display:flex;gap:10px;align-items:center;padding:10px 12px;text-decoration:none;color:inherit">
      <img src="${escapeAttr(p.image)}" alt="" width="38" height="46" style="width:38px;height:46px;object-fit:cover;border-radius:6px;background:var(--c-bg-alt)" />
      <span style="flex:1;min-width:0">
        <span style="display:block;font-size:0.82rem;line-height:1.3">${escapeHtml(p.name)}</span>
        <span style="display:block;font-size:0.75rem;color:var(--c-ink-mute)">${formatPrice(p.price)}</span>
      </span>
    </a>`
    )
    .join("") + `
    <button type="button" data-submit-search
            style="display:block;width:100%;text-align:left;padding:10px 12px;font-size:0.78rem;
                   background:var(--c-bg-alt);color:var(--c-sage-deep);border-top:1px solid var(--c-line)">
      See all results for “${escapeHtml(term)}”
    </button>`;
  box.style.display = "block";

  box.querySelector("[data-submit-search]")?.addEventListener("click", () => {
    box.style.display = "none";
    input.form?.requestSubmit ? input.form.requestSubmit() : input.form?.submit();
  });
}

/* ---------- Wire one input --------------------------------------------------------- */

function wire(input) {
  const form = input.form;
  if (!form || input.dataset.suggestWired) return;
  input.dataset.suggestWired = "1";

  const box = ensureDropdown(input);

  const update = debounce(async () => {
    const term = input.value.trim();
    if (term.length < 2) { box.style.display = "none"; return; }
    await loadIndex();
    renderSuggestions(box, match(term), term);
  }, 180);

  input.addEventListener("input", update);
  input.addEventListener("focus", () => { if (input.value.trim().length >= 2) update(); });

  document.addEventListener("click", (e) => {
    if (!input.parentElement.contains(e.target)) box.style.display = "none";
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") box.style.display = "none";
  });

  form.addEventListener("submit", () => { box.style.display = "none"; });
}

/* ---------- Public boot --------------------------------------------------------------- */

export function initSearch() {
  $$('input[type="search"][name="q"]').forEach(wire);
  loadIndex();   // warm the cache in the background
}

export default { initSearch };