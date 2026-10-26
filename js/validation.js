/* ==========================================================================
   MAVELIQ — js/validation.js
   Reusable client-side validation rules.
   NOTE: client validation improves UX only. Production checkout MUST ALSO
   validate prices, stock and totals on the server — see README → "Backend
   (later)". Frontend data is never authoritative.
   ========================================================================== */

import { escapeHtml } from "./utils.js";

/** Strip spaces/dashes from phone numbers for comparison. */
export function normalisePhone(value) {
  return String(value || "").replace(/[\s\-().]/g, "");
}

/* ---------- Individual rules --------------------------------------------- */

export const rules = {
  required: (v) => (String(v ?? "").trim() ? "" : "This field is required."),

  minLength: (min) => (v) =>
    String(v ?? "").trim().length >= min ? "" : `Must be at least ${min} characters.`,

  maxLength: (max) => (v) =>
    String(v ?? "").trim().length <= max ? "" : `Must be ${max} characters or fewer.`,

  /** Pakistani mobile/landline formats, with or without +92 / 0 prefix. */
  phonePk: (v) => {
    const p = normalisePhone(v);
    if (!p) return "Enter a phone number.";
    const ok = /^(\+?92|0)?3\d{9}$/.test(p) || /^(\+?92|0)?[2-5]\d{8}$/.test(p);
    return ok ? "" : "Enter a valid Pakistani phone number, e.g. 0300 1234567.";
  },

  email: (v) => {
    const s = String(v ?? "").trim();
    if (!s) return "";                       // email may be optional
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? "" : "Enter a valid email address.";
  },

  /** Minimum length guard against nonsense addresses; owner can tighten later. */
  address: (v) => {
    const s = String(v ?? "").trim();
    if (!s) return "Enter your delivery address.";
    return s.length >= 12 ? "" : "Please provide a complete address (house, street, area).";
  },

  city: (v) => {
    const s = String(v ?? "").trim();
    if (!s) return "Enter your city.";
    return s.length >= 2 ? "" : "Enter a valid city name.";
  },

  name: (v) => {
    const s = String(v ?? "").trim();
    if (!s) return "Enter your full name.";
    return s.length >= 3 && s.length <= 80 ? "" : "Enter your full name (3–80 characters).";
  },

  positiveInt: (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? "" : "Enter a whole number above zero.";
  },

  price: (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? "" : "Enter a valid price.";
  },

  orderRef: (v) => {
    const s = String(v ?? "").trim().toUpperCase();
    return /^MV-[A-Z0-9]{4,12}$/.test(s) ? "" : "Enter a valid reference, e.g. MV-7K4M2P9Q.";
  },
};

/* ---------- Form validator ------------------------------------------------ */

/**
 * Validate a form against a field map.
 *
 * @param {HTMLFormElement} form
 * @param {Object<string, Array<Function>>} schema  field name → array of rules
 * @param {Object} [opts]  { submitter } — the clicked button, for async checks
 * @returns {boolean} true when every field passes
 *
 * Each rule receives the raw value and returns "" (valid) or an error message.
 * On failure the first error per field is shown inline and focus moves to the
 * first invalid control.
 */
export function validateForm(form, schema, opts = {}) {
  if (!(form instanceof HTMLFormElement)) return false;
  let firstInvalid = null;
  let allValid = true;

  // clear previous errors
  form.querySelectorAll(".field-error").forEach((e) => (e.textContent = ""));
  form.querySelectorAll(".is-invalid").forEach((e) => {
    e.classList.remove("is-invalid");
    e.removeAttribute("aria-invalid");
  });

  for (const [name, fieldRules] of Object.entries(schema)) {
    const field = form.elements.namedItem(name);
    if (!field) continue;

    // radio groups: use the checked value
    let value;
    if (field instanceof RadioNodeList) value = field.value;
    else value = field.value;

    let error = "";
    for (const rule of fieldRules) {
      error = rule(value, form, opts.submitter);
      if (error) break;
    }

    if (error) {
      allValid = false;
      const target = field instanceof RadioNodeList ? field[0] : field;
      if (target) {
        target.classList.add("is-invalid");
        target.setAttribute("aria-invalid", "true");
        if (!firstInvalid) firstInvalid = target;
      }
      // attach message to the closest .field wrapper if present
      const wrap = target && target.closest(".field");
      const slot = wrap ? wrap.querySelector(".field-error") : null;
      if (slot) slot.innerHTML = `<span class="visually-hidden">Error:</span> ${escapeHtml(error)}`;
    }
  }

  if (firstInvalid) {
    firstInvalid.focus({ preventScroll: false });
    firstInvalid.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  return allValid;
}

/* ---------- Inline field helpers ------------------------------------------ */

/**
 * Attach live validation to a single input.
 * @param {HTMLElement} input
 * @param {Array<Function>} fieldRules
 * @param {Object} opts { validateOn: "blur" | "input" }
 */
export function attachFieldValidation(input, fieldRules, opts = {}) {
  const { validateOn = "blur" } = opts;
  const wrap = input.closest(".field");
  const slot = wrap ? wrap.querySelector(".field-error") : null;

  const run = () => {
    let error = "";
    for (const rule of fieldRules) {
      error = rule(input.value, input.form);
      if (error) break;
    }
    if (error) {
      input.classList.add("is-invalid");
      input.setAttribute("aria-invalid", "true");
      if (slot) slot.textContent = error;
      return false;
    }
    input.classList.remove("is-invalid");
    input.removeAttribute("aria-invalid");
    if (slot) slot.textContent = "";
    return true;
  };

  input.addEventListener(validateOn, run);
  input.addEventListener("input", () => {
    if (input.classList.contains("is-invalid")) run();
  });
  return run;
}

/* ---------- Password strength (admin auth UI aid only) ---------------------- */

export function passwordScore(pw) {
  const s = String(pw || "");
  let score = 0;
  if (s.length >= 8) score++;
  if (s.length >= 12) score++;
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) score++;
  if (/\d/.test(s)) score++;
  if (/[^A-Za-z0-9]/.test(s)) score++;
  return Math.min(score, 4); // 0–4
}

export function passwordLabel(score) {
  return ["Very weak", "Weak", "Fair", "Good", "Strong"][score] || "Weak";
}