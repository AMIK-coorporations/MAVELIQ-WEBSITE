/* ==========================================================================
   MAVELIQ — js/services/auth-service.js
   Administrator authentication.

   PRODUCTION (backend configured in js/config.js):
     • Uses the backend's email + password authentication. Sessions are
       issued and verified by the server; the token is stored locally and
       attached to admin API calls. Database row-level policies are the
       real gate — hiding admin pages is NOT security.

   DEMO MODE (no backend):
     • A clearly-labelled local demo gate protects the dashboard so the owner
       can review the UI. It is NOT real security and the dashboard shows a
       persistent warning banner. Never present it as production protection.
   ========================================================================== */

import { CONFIG } from "../config.js";
import { store } from "../utils.js";

const LS_SESSION = CONFIG.admin.sessionKey;
const LS_DEMO_USERS = "admin_demo_users";

/* ---------- Backend auth API minimal client (email + password) --------------- */

async function authRequest(path, payload) {
  const base = CONFIG.backend.apiUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: CONFIG.backend.anonKey,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error_description || data?.msg || data?.message || `Authentication failed (${res.status}).`);
  }
  return data;
}

/* ---------- Demo credentials ------------------------------------------------- */
/* Seeded on first run; the owner can change them in admin → Settings. */

function demoUsers() {
  let users = store.get(LS_DEMO_USERS, null);
  if (!users) {
    users = [
      {
        email: "admin@maveliq.local",
        // Demo credential. On first successful sign-in this is replaced with a
        // real SHA-256 hash so the plaintext password is not stored long-term.
        passwordHash: "legacy:maveliq-demo",
        label: "Store Administrator",
      },
    ];
    store.set(LS_DEMO_USERS, users);
  }
  return users;
}

async function sha256(text) {
  if (window.crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback (very old browsers): simple non-cryptographic hash for the demo gate only
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return `fallback-${h}`;
}

/* ---------- Service ----------------------------------------------------------- */

class AuthService {
  constructor() {
    this._session = store.get(LS_SESSION, null);
  }

  get isDemoMode() {
    return CONFIG.demoMode;
  }

  get session() {
    if (!this._session) return null;
    // Sessions expire at expires_at (demo sessions last 8 hours).
    const expiry = this._session.expiresAt ?? this._session.expires_at;
    if (expiry && Date.now() > expiry) {
      this.signOut();
      return null;
    }
    return this._session;
  }

  get isAuthenticated() {
    return Boolean(this.session);
  }

  get user() {
    return this.session?.user || null;
  }

  get token() {
    return this.session?.access_token || null;
  }

  /**
   * Sign in.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>} session
   */
  async signIn(email, password) {
    const mail = String(email || "").trim().toLowerCase();
    const pass = String(password || "");
    if (!mail || !pass) throw new Error("Enter your email and password.");

    if (!CONFIG.demoMode) {
      const data = await authRequest("token?grant_type=password", { email: mail, password: pass });
      const session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000,
        user: { email: mail, id: data.user?.id || "" },
      };
      store.set(LS_SESSION, session);
      this._session = session;
      return session;
    }

    /* Demo gate */
    const users = demoUsers();
    const user = users.find((u) => u.email === mail);
    if (!user) throw new Error("Invalid email or password.");

    let ok;
    if (String(user.passwordHash).startsWith("legacy:")) {
      // First sign-in with the seeded demo password — verify in plain text,
      // then upgrade the stored value to a hash.
      ok = pass === user.passwordHash.slice("legacy:".length);
      if (ok) {
        user.passwordHash = await sha256(pass);
        store.set(LS_DEMO_USERS, users);
      }
    } else {
      ok = (await sha256(pass)) === user.passwordHash;
    }
    if (!ok) throw new Error("Invalid email or password.");

    const session = {
      access_token: `demo-${Date.now()}`,
      expires_at: Date.now() + 8 * 60 * 60 * 1000,
      user: { email: user.email, label: user.label },
    };
    store.set(LS_SESSION, session);
    this._session = session;
    return session;
  }

  async signOut() {
    if (!CONFIG.demoMode && this._session?.refresh_token) {
      try {
        await authRequest("logout", { refresh_token: this._session.refresh_token });
      } catch { /* best effort */ }
    }
    store.remove(LS_SESSION);
    this._session = null;
  }

  /** Change the demo admin password (Settings screen). */
  async changeDemoPassword(current, next) {
    if (CONFIG.demoMode) {
      const users = demoUsers();
      const hash = await sha256(current);
      const u = users.find((x) => x.passwordHash === hash);
      if (!u) throw new Error("Current password is incorrect.");
      if (String(next).length < 8) throw new Error("New password must be at least 8 characters.");
      u.passwordHash = await sha256(next);
      store.set(LS_DEMO_USERS, users);
      return true;
    }
    // Production: password changes go through the backend auth API
    const base = CONFIG.backend.apiUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/auth/v1/user`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        apikey: CONFIG.backend.anonKey,
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ password: next }),
    });
    if (!res.ok) throw new Error("Could not update the password.");
    return true;
  }

  /**
   * Guard an admin page: redirects to the login screen when unauthenticated.
   * Call at the top of every admin script. NOTE — this only protects the UX;
   * real protection comes from database policies on the backend.
   */
  requireAdmin({ loginUrl = "./index.html" } = {}) {
    if (!this.isAuthenticated) {
      const back = encodeURIComponent(window.location.pathname.split("/").pop() || "index.html");
      window.location.href = `${loginUrl}?redirect=${back}`;
      return false;
    }
    return true;
  }
}

export const auth = new AuthService();
export default auth;