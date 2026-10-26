/* ==========================================================================
   MAVELIQ — js/services/order-service.js
   Order creation, lookup and management.

   PRODUCTION PATH (backend configured):
     • placeOrder() posts to the server endpoint `place-order`, which
       re-validates prices, stock and totals SERVER-SIDE, writes the order
       atomically, decrements inventory and returns a reference number.
       Browser-supplied prices are never trusted.
     • track() calls the `track-order` endpoint, which requires the reference
       AND the phone number, so one customer cannot read another's order.

   DEMO PATH (no backend):
     • Orders are stored in localStorage and the UI shows a clear demo notice.
       This is a design/UX preview, NOT a real ordering system.
   ========================================================================== */

import { CONFIG } from "../config.js";
import { store, uid, generateReference } from "../utils.js";
import settings from "./settings-service.js";
import products from "./product-service.js";

const LS_ORDERS = "orders";

/* ---------- Backend helper -------------------------------------------------- */

async function callFunction(name, payload) {
  const base = CONFIG.backend.apiUrl.replace(/\/$/, "");
  const url = `${base}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: CONFIG.backend.anonKey,
      Authorization: `Bearer ${CONFIG.backend.anonKey}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || data?.message || `Order request failed (${res.status}).`;
    const err = new Error(msg);
    err.status = res.status;
    err.code = data?.code || null;
    throw err;
  }
  return data;
}

/* ---------- Demo storage ---------------------------------------------------- */

function readDemoOrders() {
  return store.get(LS_ORDERS, []);
}

function writeDemoOrders(list) {
  store.set(LS_ORDERS, list);
}

/* ---------- Service ---------------------------------------------------------- */

class OrderService {
  /**
   * Validate + create an order.
   *
   * @param {Object} input
   *   customer: { fullName, phone, email, address, city, instructions }
   *   items:    [{ productId, variant: {groupName: optionLabel}, quantity }]
   *   paymentMethod: "cod" | "card" | ...
   *   discountCode?: string
   * @returns {Promise<Object>} the created order (with reference)
   */
  async placeOrder(input) {
    const { customer, items, paymentMethod = "cod", discountCode = "" } = input || {};

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Your cart is empty.");
    }

    // Payment method must be genuinely enabled in settings
    const pay = settings.enabledPayments.find((p) => p.key === paymentMethod);
    if (!pay) throw new Error("That payment method is not available right now.");

    if (!CONFIG.demoMode) {
      /* ---- Production: trusted server-side checkout ---- */
      return callFunction(CONFIG.backend.placeOrderFunction, {
        customer,
        items,
        paymentMethod,
        discountCode: discountCode || null,
      });
    }

    /* ---- Demo: simulate server validation in the browser ---- */
    return this._demoPlaceOrder({ customer, items, paymentMethod, discountCode });
  }

  async _demoPlaceOrder({ customer, items, paymentMethod, discountCode }) {
    // 1. Re-load every product from the catalogue (never trust page state)
    const lines = [];
    let subtotal = 0;

    for (const line of items) {
      const product = await products.getProduct(line.productId);
      if (!product || !product.active) {
        throw new Error(`"${line.name || line.productId}" is no longer available.`);
      }
      const qty = Math.max(1, parseInt(line.quantity, 10) || 1);
      const stock = products.stockFor(product, line.variant || {});
      if (stock < qty) {
        throw stock <= 0
          ? new Error(`"${product.name}" is out of stock.`)
          : new Error(`Only ${stock} left of "${product.name}".`);
      }
      const unit = products.unitPrice(product, line.variant || {});
      subtotal += unit * qty;
      lines.push({
        productId: product.id,
        name: product.name,
        image: product.images[0] || "",
        variant: line.variant || {},
        quantity: qty,
        unitPrice: unit,
        lineTotal: unit * qty,
      });
    }

    // 2. Delivery charges (server would do this too)
    const d = settings.delivery;
    const deliveryCharge = d.freeOver > 0 && subtotal >= d.freeOver ? 0 : Number(d.charge) || 0;

    // 3. Discount codes — only ones the owner has configured
    let discount = 0;
    const appliedCode = String(discountCode || "").trim().toUpperCase();
    if (appliedCode) {
      const codes = settings.get("discountCodes", {}) || {};
      const rule = codes[appliedCode];
      if (!rule) throw new Error("That discount code is not valid.");
      if (rule.type === "percent") discount = Math.round((subtotal * Number(rule.value)) / 100);
      else discount = Math.min(Number(rule.value) || 0, subtotal);
    }

    const total = Math.max(0, subtotal - discount) + deliveryCharge;

    // 4. Reference + persistence
    const order = {
      id: uid("ord"),
      reference: generateReference(),
      status: "pending",
      createdAt: new Date().toISOString(),
      customer: {
        fullName: String(customer.fullName || "").trim(),
        phone: String(customer.phone || "").trim(),
        email: String(customer.email || "").trim(),
        address: String(customer.address || "").trim(),
        city: String(customer.city || "").trim(),
        instructions: String(customer.instructions || "").trim(),
      },
      items: lines,
      subtotal,
      discount,
      discountCode: appliedCode || null,
      deliveryCharge,
      total,
      paymentMethod,
      history: [{ status: "pending", at: new Date().toISOString(), note: "Order placed" }],
    };

    // 5. Persist and adjust demo stock
    const all = readDemoOrders();
    all.unshift(order);
    writeDemoOrders(all);

    try {
      for (const line of lines) {
        const p = await products.getProduct(line.productId);
        if (p) {
          await products.saveProduct({ ...p, stock: Math.max(0, p.stock - line.quantity) });
        }
      }
    } catch (e) {
      console.warn("Could not adjust demo stock", e);
    }

    // 6. Owner notification hook (real email/SMS goes through backend config)
    this._notifyAdmin(order);

    return order;
  }

  /**
   * Secure order tracking. Requires BOTH the reference and the phone number;
   * the backend compares a hash so raw phone numbers are not stored/leaked.
   */
  async track(reference, phone) {
    const ref = String(reference || "").trim().toUpperCase();
    const ph = String(phone || "").replace(/[^\d+]/g, "");
    if (!ref || !ph) throw new Error("Enter both your order reference and phone number.");

    if (!CONFIG.demoMode) {
      return callFunction(CONFIG.backend.trackOrderFunction, { reference: ref, phone: ph });
    }

    // Demo: match locally against demo orders
    const order = readDemoOrders().find(
      (o) => o.reference.toUpperCase() === ref && o.customer.phone.replace(/\D/g, "") === ph.replace(/\D/g, "")
    );
    if (!order) {
      throw new Error("No order matches that reference and phone number.");
    }
    return order;
  }

  /** Latest order the current browser placed (demo convenience). */
  get lastOrder() {
    return readDemoOrders()[0] || null;
  }

  getOrderById(id) {
    return readDemoOrders().find((o) => o.id === id) || null;
  }

  getByReference(reference) {
    const ref = String(reference || "").trim().toUpperCase();
    return readDemoOrders().find((o) => o.reference.toUpperCase() === ref) || null;
  }

  /* ---- Admin operations ----------------------------------------------------- */

  /** List orders (demo reads localStorage; production reads the DB). */
  async listOrders({ status = "", search = "", limit = 200 } = {}) {
    if (!CONFIG.demoMode) {
      let path = `orders?select=*&order=created_at.desc&limit=${limit}`;
      if (status) path += `&status=eq.${encodeURIComponent(status)}`;
      const rows = await rest(path);
      return rows;
    }
    let list = readDemoOrders();
    if (status) list = list.filter((o) => o.status === status);
    if (search) {
      const term = search.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.reference.toLowerCase().includes(term) ||
          o.customer.fullName.toLowerCase().includes(term) ||
          o.customer.phone.includes(term)
      );
    }
    return list.slice(0, limit);
  }

  /** Update status and record it in the order history. */
  async updateStatus(orderId, status, note = "") {
    const flow = settings.get("orders.statusFlow", CONFIG.orders.statusFlow);
    // Terminal statuses are always settable alongside the normal flow.
    const allowed = new Set([...flow, "cancelled", "returned"]);
    if (!allowed.has(status)) throw new Error(`Unknown status "${status}".`);

    if (!CONFIG.demoMode) {
      await rest(`orders?id=eq.${encodeURIComponent(orderId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
        headers: { Prefer: "return=minimal" },
      });
      return true;
    }

    const list = readDemoOrders();
    const idx = list.findIndex((o) => o.id === orderId);
    if (idx < 0) throw new Error("Order not found.");
    list[idx].status = status;
    list[idx].history = Array.isArray(list[idx].history) ? list[idx].history : [];
    list[idx].history.push({ status, at: new Date().toISOString(), note });
    writeDemoOrders(list);
    return true;
  }

  /** Record courier + tracking details against an order. */
  async addDispatch(orderId, { courier, trackingNumber, note = "" }) {
    if (!CONFIG.demoMode) {
      await rest(`orders?id=eq.${encodeURIComponent(orderId)}`, {
        method: "PATCH",
        body: JSON.stringify({ courier, tracking_number: trackingNumber }),
        headers: { Prefer: "return=minimal" },
      });
      return true;
    }
    const list = readDemoOrders();
    const idx = list.findIndex((o) => o.id === orderId);
    if (idx < 0) throw new Error("Order not found.");
    list[idx].dispatch = { courier, trackingNumber, note, at: new Date().toISOString() };
    list[idx].history = Array.isArray(list[idx].history) ? list[idx].history : [];
    list[idx].history.push({ status: list[idx].status, at: new Date().toISOString(), note: `Dispatched via ${courier} (${trackingNumber})` });
    writeDemoOrders(list);
    return true;
  }

  /** Dashboard statistics computed from genuine stored orders. */
  async stats() {
    const orders = await this.listOrders();
    const valid = orders.filter((o) => o.status !== "cancelled");
    const sales = valid.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const pending = orders.filter((o) => o.status === "pending").length;
    const delivered = orders.filter((o) => o.status === "delivered").length;

    // Best sellers from real order lines
    const tally = {};
    for (const o of valid) {
      for (const line of o.items || []) {
        const key = line.productId;
        if (!tally[key]) tally[key] = { productId: key, name: line.name, quantity: 0, revenue: 0 };
        tally[key].quantity += Number(line.quantity) || 0;
        tally[key].revenue += Number(line.lineTotal) || 0;
      }
    }
    const bestSellers = Object.values(tally).sort((a, b) => b.quantity - a.quantity);

    return { totalOrders: orders.length, sales, pending, delivered, bestSellers, orders };
  }

  /* ---- Admin notification hook ------------------------------------------------ */

  /**
   * Notify the store owner about a new order.
   * In production this runs on the server (email/SMS provider).
   * Here we log it and store the owner's WhatsApp link when configured —
   * no invented notification claims.
   */
  _notifyAdmin(order) {
    console.info("[Maveliq] New demo order:", order.reference, order.total);
    const wa = settings.contact.whatsapp;
    if (!wa) return; // no configured channel — do nothing rather than pretend
    try {
      const text = encodeURIComponent(
        `New Maveliq order ${order.reference}\nTotal: Rs ${order.total}\nCustomer: ${order.customer.fullName} (${order.customer.phone})`
      );
      // Store the intent; the confirmation page offers an explicit "notify owner" action
      // rather than force-opening a tab.
      store.set("pendingAdminNotify", { reference: order.reference, url: `https://wa.me/${String(wa).replace(/\D/g, "")}?text=${text}` });
    } catch { /* non-critical */ }
  }
}

/* Local REST helper duplicated here to avoid circular imports.
   `/rest/v1/` is the backend's data-API prefix — adjust it (and the
   auth/functions prefixes) when wiring the real backend — see README
   → "Backend (later)". */
async function rest(path, options = {}) {
  const { apiUrl, anonKey } = CONFIG.backend;
  const url = `${apiUrl.replace(/\/$/, "")}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Backend request failed (${res.status}): ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

export const orders = new OrderService();
export default orders;