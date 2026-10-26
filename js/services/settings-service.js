/* ==========================================================================
   MAVELIQ — js/services/settings-service.js
   Store settings: CONFIG defaults + owner overrides saved by the admin
   Settings screen. Overrides persist in localStorage (demo mode) or in the
   backend `settings` table (production).
   ========================================================================== */

import { CONFIG } from "../config.js";
import { store } from "../utils.js";

const LS_KEY = "settings";

/* A deep-ish merge of the config defaults with stored overrides. */
function merge(base, over) {
  if (over === null || over === undefined) return base;
  if (typeof base !== "object" || base === null || Array.isArray(base)) return over;
  if (typeof over !== "object" || Array.isArray(over)) return over;
  const out = { ...base };
  for (const k of Object.keys(over)) {
    out[k] = k in base ? merge(base[k], over[k]) : over[k];
  }
  return out;
}

class SettingsService {
  constructor() {
    this._cache = null;
    this._listeners = new Set();
  }

  /** Full effective settings object (defaults + overrides). */
  get all() {
    if (!this._cache) {
      const overrides = store.get(LS_KEY, {});
      this._cache = merge(structuredCloneSafe(CONFIG), overrides);
    }
    return this._cache;
  }

  /** Read one nested path, e.g. get("delivery.charge"). */
  get(path, fallback = undefined) {
    const parts = String(path).split(".");
    let node = this.all;
    for (const p of parts) {
      if (node === null || node === undefined || !(p in node)) return fallback;
      node = node[p];
    }
    return node === undefined ? fallback : node;
  }

  /** Persist partial overrides and refresh the cache. */
  save(partial) {
    const overrides = store.get(LS_KEY, {});
    const merged = merge(overrides, partial);
    store.set(LS_KEY, merged);
    this._cache = null;
    this._emit();
    return this.all;
  }

  /** Reset every override back to CONFIG defaults. */
  reset() {
    store.remove(LS_KEY);
    this._cache = null;
    this._emit();
  }

  /** Drop stored overrides and return the pristine defaults. */
  exportOverrides() {
    return store.get(LS_KEY, {});
  }

  /* ---- Convenience accessors used across pages ------------------------- */

  get businessName()      { return this.get("businessName", CONFIG.businessName); }
  get displayName()       { return this.get("displayName", CONFIG.displayName); }
  get currency()          { return this.get("currency", CONFIG.currency); }

  get contact()           { return this.get("contact", CONFIG.contact); }
  get social()            { return this.get("social", CONFIG.social); }
  get delivery()          { return this.get("delivery", CONFIG.delivery); }
  get payments()          { return this.get("payments", CONFIG.payments); }
  get partnerships()      { return this.get("partnerships", CONFIG.partnerships); }
  get newsletter()        { return this.get("newsletter", CONFIG.newsletter); }
  get home()              { return this.get("home", CONFIG.home); }

  /** Contact methods that have a real destination configured. */
  get contactMethods() {
    const c = this.contact;
    const list = [];
    if (c.whatsapp) list.push({ key: "whatsapp", label: "WhatsApp", value: c.whatsapp, href: `https://wa.me/${String(c.whatsapp).replace(/[^\d]/g, "")}`, icon: "whatsapp" });
    if (c.phone)    list.push({ key: "phone",    label: "Phone",     value: c.phone,    href: `tel:${String(c.phone).replace(/[^\d+]/g, "")}`, icon: "phone" });
    if (c.email)    list.push({ key: "email",    label: "Email",     value: c.email,    href: `mailto:${c.email}`, icon: "mail" });
    return list;
  }

  /** Social profiles with real URLs (empty ones are hidden, never dead links). */
  get activeSocials() {
    const s = this.social;
    const map = [
      ["whatsapp",  "WhatsApp",  (u) => `https://wa.me/${String(u).replace(/[^\d]/g, "")}`],
      ["instagram", "Instagram", (u) => u],
      ["facebook",  "Facebook",  (u) => u],
      ["tiktok",    "TikTok",    (u) => u],
      ["youtube",   "YouTube",   (u) => u],
      ["other",     s.otherLabel || "More", (u) => u],
    ];
    return map
      .filter(([key]) => String(s[key] || "").trim())
      .map(([key, label, toUrl]) => ({ key, label, url: toUrl(String(s[key]).trim()) }));
  }

  /** Only enabled AND plausibly configured payment methods. */
  get enabledPayments() {
    const p = this.payments;
    return Object.entries(p)
      .filter(([, v]) => v && v.enabled)
      .map(([key, v]) => ({ key, label: v.label, note: v.note || "" }));
  }

  /** Partnership blocks that are published AND have approved copy. */
  get publishedPartnerships() {
    const p = this.partnerships;
    return Object.values(p || {}).filter(
      (x) => x && x.published && x.name && (x.description || x.url)
    );
  }

  /* ---- Change subscription --------------------------------------------- */

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    for (const fn of this._listeners) {
      try { fn(this.all); } catch (e) { console.error("settings listener failed", e); }
    }
  }
}

function structuredCloneSafe(obj) {
  try { return structuredClone(obj); }
  catch { return JSON.parse(JSON.stringify(obj)); }
}

export const settings = new SettingsService();
export default settings;