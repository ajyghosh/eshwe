"use strict";

const crypto = require("node:crypto");
const { createRefunds } = require("./refunds");
const HOLD_MS = 15 * 60 * 1000;
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const stock = value => Number.isInteger(value) && value >= 0 ? value : 0;
class CommerceError extends Error {
  constructor(status, message, orderId) { super(message); this.status = status; this.orderId = orderId; }
}

function normalizeItems(input) {
  if (!Array.isArray(input) || !input.length || input.length > 50) throw new CommerceError(400, "Add between 1 and 50 products to your bag.");
  const grouped = new Map();
  for (const item of input) {
    const sku = typeof item?.sku === "string" ? item.sku.trim() : "";
    const productId = typeof item?.productId === "string" ? item.productId.trim() : "";
    if (!sku || sku.length > 100 || productId.includes("/") || productId.length > 100 || !Number.isInteger(item.quantity) || item.quantity < 1) throw new CommerceError(400, "Invalid product or quantity.");
    const key = productId || sku;
    const previous = grouped.get(key);
    if (previous && previous.sku !== sku) throw new CommerceError(400, "Product identity changed. Refresh your bag.");
    const quantity = (previous?.quantity || 0) + item.quantity;
    if (quantity > 10) throw new CommerceError(400, "A maximum of 10 units per product is allowed.");
    grouped.set(key, { sku, productId, quantity });
  }
  return [...grouped.values()].sort((a, b) => (a.productId || a.sku).localeCompare(b.productId || b.sku));
}

// All gateway calls happen outside transactions. Transactions contain reads first,
// then writes, and may be retried by Firestore without repeating external charges.
function createCommerce({ db, timestamp, gateway, now = Date.now }) {
  const orderRef = id => db.collection("checkoutOrders").doc(id);
  const sessionRef = uid => db.collection("checkoutSessions").doc(hash(uid));
  const readOrder = async id => { const s = await orderRef(id).get(); return s.exists ? { id: s.id, ...s.data() } : null; };
  const amountRefunds = createRefunds({ db, timestamp, gateway, readOrder, ErrorClass: CommerceError });
  const recordRefund = amountRefunds.record;

  async function productRefs(items, allowUnresolved = false) {
    return Promise.all(items.map(async item => {
      if (item.productId) return db.collection("sarees").doc(item.productId);
      const result = await db.collection("sarees").where("sku", "==", item.sku).limit(2).get();
      if (result.size !== 1 && allowUnresolved) return db.collection("sarees").doc(`unresolved-${hash(item.sku)}`);
      if (result.size !== 1) throw new CommerceError(409, `Refresh your bag: ${item.sku} is missing or has an ambiguous SKU.`);
      return result.docs[0].ref;
    }));
  }

  async function reserve({ userId, checkoutKey, items: input, customer, notes = "", sourcePath = "/checkout" }) {
    if (!userId) throw new CommerceError(401, "Sign in before paying.");
    if (!/^[a-zA-Z0-9_-]{16,80}$/.test(checkoutKey || "")) throw new CommerceError(400, "Refresh checkout to create a secure checkout reference.");
    const items = normalizeItems(input);
    const id = hash(`${userId}:${checkoutKey}`).slice(0,40);
    const fingerprint = hash(JSON.stringify({ items, customer, notes }));
    const refs = await productRefs(items);
    if (new Set(refs.map(ref => ref.id)).size !== refs.length) throw new CommerceError(400, "The same product was submitted under different identifiers.");
    const ref = orderRef(id);
    let created = false;
    await db.runTransaction(async tx => {
      created = false;
      const [existing, session] = await Promise.all([tx.get(ref), tx.get(sessionRef(userId))]);
      if (existing.exists) {
        if (existing.data().fingerprint !== fingerprint) throw new CommerceError(409, "Resume or cancel your existing checkout before changing the bag.", id);
        return;
      }
      if (session.exists && session.data().orderId) {
        const previous = await tx.get(orderRef(session.data().orderId));
        if (previous.exists && previous.data().reservationState === "held") throw new CommerceError(409, "You already have a checkout in progress. Resume it before starting another.", previous.id);
      }
      const products = await Promise.all(refs.map(productRef => tx.get(productRef)));
      const lines = products.map((snapshot, index) => {
        const product = snapshot.data(); const requested = items[index];
        if (!snapshot.exists || product.sku !== requested.sku || product.status !== "active" || stock(product.availableStock) < requested.quantity) throw new CommerceError(409, `${product?.name || requested.sku} is unavailable or temporarily reserved.`);
        if (!Number.isFinite(product.price) || product.price <= 0) throw new CommerceError(400, `Invalid price for ${requested.sku}.`);
        return { productId: snapshot.id, sku: product.sku, slug: product.slug || "", name: product.name || product.sku, color: product.color || "", primaryImageUrl: product.primaryImageUrl || "", quantity: requested.quantity, unitPrice: Math.round(product.price * 100) / 100, unitOriginalPrice: Number.isFinite(product.originalPrice) ? product.originalPrice : null };
      });
      const amountPaise = lines.reduce((sum, line) => sum + Math.round(line.unitPrice * 100) * line.quantity, 0);
      const savings = lines.reduce((sum, line) => sum + Math.max(0, (line.unitOriginalPrice || line.unitPrice) - line.unitPrice) * line.quantity, 0);
      products.forEach((snapshot, index) => tx.update(snapshot.ref, { availableStock: stock(snapshot.data().availableStock) - items[index].quantity, reservedStock: stock(snapshot.data().reservedStock) + items[index].quantity, updatedAt: timestamp() }));
      tx.create(ref, { userId, fingerprint, customer, notes, sourcePath, cartItems: lines, amountPaise, currency: "INR", amountBreakdown: { subtotal: amountPaise / 100, total: amountPaise / 100, savings: Math.round(savings * 100) / 100, shippingFee: 0, packagingFee: 0 }, receipt: `eshwe-${id.slice(0,20)}`, status: "created", paymentStatus: "pending", inventoryCommitted: false, reservationState: "held", reservationExpiresAt: now() + HOLD_MS, gatewaySetup: "creating", createdAt: timestamp(), updatedAt: timestamp() });
      tx.set(sessionRef(userId), { orderId: id });
      created = true;
    });
    let order = await readOrder(id);
    if (created) {
      // Never repeat a gateway create after an ambiguous response. No checkout ID
      // is returned to the customer until its association is durably persisted.
      try {
        const external = await gateway.createOrder({ amount: order.amountPaise, currency: order.currency, receipt: order.receipt, notes: { internalOrderId: id } });
        if (!external?.id || Number(external.amount) !== order.amountPaise || external.currency !== order.currency) throw new Error("Invalid payment order response.");
        await ref.update({ razorpayOrderId: external.id, gatewaySetup: "ready", updatedAt: timestamp() });
      } catch (error) {
        await ref.update({ gatewaySetup: "needs_review", attentionRequired: true, attentionReason: "payment_setup_interrupted", updatedAt: timestamp() });
        throw new CommerceError(503, "Checkout setup was interrupted. Check your existing order; do not start another payment.", id);
      }
      order = await readOrder(id);
    }
    return order;
  }

  async function recordPayment(id, payment) {
    const ref = orderRef(id);
    await db.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) throw new CommerceError(404, "Order not found.");
      const order = snapshot.data();
      if (!payment?.id || payment.order_id !== order.razorpayOrderId || Number(payment.amount) !== order.amountPaise || payment.currency !== order.currency) throw new CommerceError(400, "Payment does not match the order, amount, or currency.");
      const captured = ["captured", "refunded"].includes(payment.status);
      if (!captured) {
        if (order.paymentCaptured || order.inventoryCommitted || order.refundStatus) return;
        if (order.paymentStatus === "authorized" && payment.status !== "authorized") return;
        tx.update(ref, { paymentStatus: ["authorized", "failed"].includes(payment.status) ? payment.status : "pending", razorpayPaymentId: payment.id, paymentMethod: payment.method || null, updatedAt: timestamp() });
        return;
      }
      const updates = { paymentCaptured: true, paymentStatus: "captured", status: "paid", razorpayPaymentId: payment.id, paymentMethod: payment.method || null, verifiedAt: timestamp(), updatedAt: timestamp() };
      if (order.inventoryCommitted || order.reservationState === "exception") {
        tx.update(ref, updates);
        return;
      }
      const refs = await productRefs(order.cartItems || [], true);
      const products = await Promise.all(refs.map(productRef => tx.get(productRef)));
      updates.cartItems = (order.cartItems || []).map((item, index) => ({ ...item, productId: refs[index].id }));
      const profileRef = order.userId ? db.collection("customerProfiles").doc(order.userId) : null;
      const profile = profileRef ? await tx.get(profileRef) : null;
      const held = order.reservationState === "held";
      if (payment.status === "refunded" || payment.amount_refunded >= order.amountPaise) {
        if (held) products.forEach((s, index) => {
          if (!s.exists) return;
          const quantity = Math.min(stock(s.data().reservedStock), order.cartItems[index].quantity);
          tx.update(s.ref, { reservedStock: stock(s.data().reservedStock) - quantity, availableStock: stock(s.data().availableStock) + quantity, updatedAt: timestamp() });
        });
        tx.update(ref, { ...updates, reservationState: "exception", refundStatus: "processed", refundedAmountPaise: order.amountPaise, attentionRequired: false });
        return;
      }
      const canFulfil = order.status !== "cancelled" && products.length > 0 && products.every((s, index) => s.exists && (held ? stock(s.data().reservedStock) : stock(s.data().availableStock)) >= order.cartItems[index].quantity && (held || s.data().status === "active"));
      if (!canFulfil) {
        // Money received remains visible even when inventory cannot be fulfilled.
        // Release any remaining holds in the same atomic transition.
        if (held) products.forEach((s, index) => {
          if (!s.exists) return;
          const quantity = Math.min(stock(s.data().reservedStock), order.cartItems[index].quantity);
          tx.update(s.ref, { reservedStock: stock(s.data().reservedStock) - quantity, availableStock: stock(s.data().availableStock) + quantity, updatedAt: timestamp() });
        });
        tx.update(ref, { ...updates, reservationState: "exception", attentionRequired: true, attentionReason: "paid_inventory_unavailable", refundStatus: "requested", refundReason: "inventory_unavailable" });
        return;
      }
      products.forEach((s, index) => tx.update(s.ref, { [held ? "reservedStock" : "availableStock"]: stock(s.data()[held ? "reservedStock" : "availableStock"]) - order.cartItems[index].quantity, updatedAt: timestamp() }));
      if (profile?.exists) {
        const cart = Array.isArray(profile.data().cartItems) ? profile.data().cartItems : [];
        const cartItems = cart.map(item => {
          const purchased = order.cartItems.find(line => item.productId ? line.productId === item.productId : line.sku === item.sku);
          return { ...item, quantity: Math.max(0, item.quantity - (purchased?.quantity || 0)) };
        }).filter(item => item.quantity > 0);
        tx.update(profileRef, { cartItems, updatedAt: timestamp() });
      }
      tx.update(ref, { ...updates, inventoryCommitted: true, inventoryCommittedAt: timestamp(), reservationState: "committed", dispatchStatus: "new", attentionRequired: false });
    });
    return readOrder(id);
  }

  async function release(id, cancelled = false) {
    return db.runTransaction(async tx => {
      const ref = orderRef(id); const snapshot = await tx.get(ref);
      if (!snapshot.exists) return;
      const order = snapshot.data();
      if (order.reservationState !== "held" || order.paymentCaptured || order.paymentStatus === "authorized") return;
      const products = await Promise.all(order.cartItems.map(item => tx.get(db.collection("sarees").doc(item.productId))));
      products.forEach((s, index) => {
        if (!s.exists) return;
        const quantity = Math.min(stock(s.data().reservedStock), order.cartItems[index].quantity);
        tx.update(s.ref, { reservedStock: stock(s.data().reservedStock) - quantity, availableStock: stock(s.data().availableStock) + quantity, updatedAt: timestamp() });
      });
      tx.update(ref, { reservationState: "released", status: cancelled ? "cancelled" : "expired", updatedAt: timestamp(), attentionRequired: false });
    });
  }

  async function reconcile(id, cancel = false) {
    let order = await readOrder(id);
    if (!order) throw new CommerceError(404, "Order not found.");
    if (order.razorpayOrderId) {
      const payments = await gateway.fetchPayments(order.razorpayOrderId);
      // Process capture first, so old failures cannot hide a later success.
      const selected = [...(payments.items || [])].sort((a,b) => (Number(["captured","refunded"].includes(b.status)) - Number(["captured","refunded"].includes(a.status))) || (Number(b.status === "authorized") - Number(a.status === "authorized")) || (b.created_at - a.created_at))[0];
      if (selected) await recordPayment(id, selected);
      order = await readOrder(id);
      if (selected?.amount_refunded > 0 && !order.activeRefundRequestId) await db.runTransaction(async tx => {
        const ref = orderRef(id); const current = (await tx.get(ref)).data();
        if (current.activeRefundRequestId) return;
        const amount = Math.max(current.refundedAmountPaise || 0, selected.amount_refunded);
        tx.update(ref, { refundedAmountPaise: amount, refundStatus: amount >= current.amountPaise ? "processed" : "partial", attentionRequired: amount < current.amountPaise, updatedAt: timestamp() });
      });
    }
    if (order.reservationState === "held" && (cancel || order.reservationExpiresAt <= now())) {
      if (order.paymentStatus === "authorized") {
        await orderRef(id).update({ reservationExpiresAt: now() + HOLD_MS, attentionRequired: true, attentionReason: "payment_authorized_awaiting_capture" });
      } else await release(id, cancel);
    }
    order = await readOrder(id);
    if (order.activeRefundEntityId && gateway.fetchRefund) {
      await recordRefund(id, await gateway.fetchRefund(order.activeRefundEntityId));
      order = await readOrder(id);
    }
    if (order.refundStatus === "requested" || order.refundStatus === "retry_required") await refund(id);
    return readOrder(id);
  }

  async function refund(id) {
    const order = await readOrder(id);
    if (order?.activeRefundRequestId) return amountRefunds.execute(id, order.activeRefundRequestId);
    if (!order?.paymentCaptured || !order.razorpayPaymentId) throw new CommerceError(409, "Only captured payments can be refunded.");
    if (["processed", "pending", "partial"].includes(order.refundStatus)) return order;
    const key = `refund-${hash(id).slice(0,28)}-${order.refundAttempt || 0}`;
    const shouldRefund = await db.runTransaction(async tx => {
      const ref = orderRef(id); const current = (await tx.get(ref)).data();
      if (current.activeRefundRequestId || ["processed", "pending", "partial"].includes(current.refundStatus)) return false;
      tx.update(ref, { refundStatus: "requested", refundKey: key, attentionRequired: true, updatedAt: timestamp() });
      return true;
    });
    if (!shouldRefund) return readOrder(id);
    try {
      // Gateway uses X-Refund-Idempotency with a stable body across retries.
      const result = await gateway.refund(order.razorpayPaymentId, { amount: order.amountPaise }, key);
      await recordRefund(id, result);
    } catch (error) {
      await db.runTransaction(async tx => {
        const ref = orderRef(id); const current = (await tx.get(ref)).data();
        if (!["processed", "pending", "partial"].includes(current.refundStatus)) tx.update(ref, { refundStatus: "retry_required", attentionRequired: true, attentionReason: "refund_needs_retry", updatedAt: timestamp() });
      });
      throw error;
    }
    return readOrder(id);
  }

  async function fulfilment(id, action, actor) {
    if (action === "retry-refund") {
      await db.runTransaction(async tx => {
        const ref = orderRef(id); const s = await tx.get(ref);
        if (s.data()?.activeRefundRequestId) throw new CommerceError(409, "Use Refund to review the amount and retry this failed refund.");
        if (!s.exists || s.data().refundStatus !== "failed") throw new CommerceError(409, "Only a confirmed failed refund can be retried as a new attempt.");
        tx.update(ref, { refundAttempt: (s.data().refundAttempt || 0) + 1, refundStatus: "requested", attentionRequired: true, updatedAt: timestamp() });
        tx.set(ref.collection("history").doc(), { action, actor, createdAt: timestamp() });
      });
      return refund(id);
    }
    if (action === "refund") {
      await orderRef(id).update({ cancellationRequestedAt: timestamp(), cancellationRequestedBy: actor });
      return refund(id);
    }
    if (action === "cancel") {
      const order = await reconcile(id, true);
      if (order.paymentCaptured) return refund(id);
      if (order.paymentStatus === "authorized") throw new CommerceError(409, "Payment is authorized. Reconcile capture before cancellation/refund.");
      return readOrder(id);
    }
    await db.runTransaction(async tx => {
      const ref = orderRef(id); const s = await tx.get(ref);
      if (!s.exists) throw new CommerceError(404, "Order not found.");
      const order = s.data();
      if (action === "restock") {
        if (!order.inventoryCommitted || order.inventoryRestocked || order.refundStatus !== "processed") throw new CommerceError(409, "Restock once, after refund and physical return inspection.");
        const products = await Promise.all(order.cartItems.map(item => tx.get(db.collection("sarees").doc(item.productId))));
        if (products.some(s => !s.exists)) throw new CommerceError(409, "Restore the archived product before restocking.");
        products.forEach((s,index) => tx.update(s.ref, { availableStock: stock(s.data().availableStock) + order.cartItems[index].quantity, updatedAt: timestamp() }));
        tx.update(ref, { inventoryRestocked: true, restockedAt: timestamp(), restockedBy: actor, updatedAt: timestamp() });
      } else if (["completed", "new"].includes(action)) {
        if (!order.paymentCaptured || !order.inventoryCommitted || order.refundStatus || order.attentionRequired) throw new CommerceError(409, "Resolve payment, inventory, or refund issues before dispatch.");
        tx.update(ref, { dispatchStatus: action, completedAt: action === "completed" ? timestamp() : null, updatedAt: timestamp(), dispatchUpdatedBy: actor });
      } else throw new CommerceError(400, "Unknown order action.");
      tx.set(ref.collection("history").doc(), { action, actor, createdAt: timestamp() });
    });
    return readOrder(id);
  }
  return { reserve, readOrder, recordPayment, recordRefund, reconcile, refund, requestAmountRefund: amountRefunds.begin, release, fulfilment, sessionRef };
}

module.exports = { createCommerce, normalizeItems, stock, CommerceError, HOLD_MS };
