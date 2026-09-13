"use strict";
const crypto = require("node:crypto");
const sumProcessed = refunds => Object.values(refunds || {}).filter(r => r.status === "processed").reduce((sum, r) => sum + r.amount, 0);
const unsettled = status => ["requested", "pending", "retry_required"].includes(status);

// One unresolved request per order; completed request IDs remain durable so a
// lost HTTP response or a later replay cannot become a second refund.
function createRefunds({ db, timestamp, gateway, readOrder, ErrorClass }) {
  const orderRef = id => db.collection("checkoutOrders").doc(id);
  const requestRef = (id, key) => orderRef(id).collection("refundRequests").doc(key);

  async function begin(id, { amountPaise, requestId, expectedRefundedAmountPaise }, actor) {
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0 || !Number.isSafeInteger(expectedRefundedAmountPaise) || expectedRefundedAmountPaise < 0 || !/^[a-zA-Z0-9_-]{16,80}$/.test(requestId || "")) throw new ErrorClass(400, "Enter a valid refund amount and refresh the order before confirming.");
    await db.runTransaction(async tx => {
      const ref = orderRef(id); const rr = requestRef(id, requestId);
      const [snapshot, previous] = await Promise.all([tx.get(ref), tx.get(rr)]);
      if (!snapshot.exists) throw new ErrorClass(404, "Order not found.");
      const order = snapshot.data();
      if (previous.exists) {
        if (previous.data().amountPaise !== amountPaise || previous.data().expectedRefundedAmountPaise !== expectedRefundedAmountPaise) throw new ErrorClass(409, "This refund reference was already used for a different amount.");
        return;
      }
      if (!order.paymentCaptured || !order.razorpayPaymentId || !Number.isSafeInteger(order.amountPaise)) throw new ErrorClass(409, "Only captured payments can be refunded.");
      if (order.refundStatus === "processed") throw new ErrorClass(409, "This payment has already been fully refunded.");
      if (unsettled(order.refundStatus) || Object.values(order.refunds || {}).some(r => r.status === "pending")) throw new ErrorClass(409, "A refund is still being confirmed. Check its status before issuing another.");
      const refunded = order.refundedAmountPaise || 0;
      if (refunded !== expectedRefundedAmountPaise) throw new ErrorClass(409, "The refunded balance changed. Refresh the order and review the amount.");
      if (amountPaise > order.amountPaise - refunded) throw new ErrorClass(400, "Refund amount exceeds the remaining refundable balance.");
      const key = `refund-${crypto.createHash("sha256").update(`${id}:${requestId}`).digest("hex").slice(0,40)}`;
      tx.create(rr, { amountPaise, expectedRefundedAmountPaise, key, status: "requested", actor, createdAt: timestamp() });
      tx.update(ref, { activeRefundRequestId: requestId, activeRefundEntityId: null, refundAmountPaise: amountPaise, refundKey: key, refundStatus: "requested", attentionRequired: true, attentionReason: "refund_requested", updatedAt: timestamp() });
      tx.set(ref.collection("history").doc(), { action: "refund", actor, amountPaise, requestId, createdAt: timestamp() });
    });
    return execute(id, requestId);
  }

  async function execute(id, requestId) {
    const order = await readOrder(id); const rr = requestRef(id, requestId); const request = (await rr.get()).data();
    if (!request || order?.activeRefundRequestId !== requestId || !["requested", "retry_required"].includes(request.status)) return order;
    try {
      const result = await gateway.refund(order.razorpayPaymentId, { amount: request.amountPaise, notes: { internalRefundRequestId: requestId } }, request.key);
      if (result?.amount !== request.amountPaise) throw new ErrorClass(502, "The refund response amount did not match. Check payment before retrying.");
      await record(id, { ...result, notes: { ...result.notes, internalRefundRequestId: requestId } });
    } catch (error) {
      await db.runTransaction(async tx => {
        const ref = orderRef(id); const [s, r] = await Promise.all([tx.get(ref), tx.get(rr)]);
        if (!["requested", "retry_required"].includes(r.data()?.status)) return;
        tx.update(rr, { status: "retry_required", updatedAt: timestamp() });
        if (s.data()?.activeRefundRequestId === requestId) tx.update(ref, { refundStatus: "retry_required", attentionRequired: true, attentionReason: "refund_needs_retry", updatedAt: timestamp() });
      });
      throw error;
    }
    return readOrder(id);
  }

  async function record(id, entity) {
    const ref = orderRef(id);
    await db.runTransaction(async tx => {
      const s = await tx.get(ref); if (!s.exists) throw new ErrorClass(404, "Order not found.");
      const order = s.data();
      if (!entity?.id || entity.payment_id !== order.razorpayPaymentId || !Number.isSafeInteger(entity.amount) || entity.amount <= 0 || entity.amount > order.amountPaise || !["pending", "processed", "failed"].includes(entity.status)) throw new ErrorClass(400, "Refund does not match order.");
      const refunds = { ...(order.refunds || {}) }; const previous = refunds[entity.id];
      if (previous && previous.amount !== entity.amount) throw new ErrorClass(400, "Refund amount changed unexpectedly.");
      if (previous?.status === "processed" && entity.status !== "processed") return;
      // An old pending webhook must not revive a confirmed failed attempt.
      if (previous?.status === "failed" && entity.status === "pending") return;
      const candidate = entity.notes?.internalRefundRequestId || (order.activeRefundEntityId === entity.id ? order.activeRefundRequestId : null);
      const requestId = typeof candidate === "string" && /^[a-zA-Z0-9_-]{16,80}$/.test(candidate) ? candidate : null;
      const rr = requestId ? requestRef(id, requestId) : null; const rs = rr ? await tx.get(rr) : null;
      if (rs?.exists && (rs.data().amountPaise !== entity.amount || (rs.data().refundId && rs.data().refundId !== entity.id))) throw new ErrorClass(400, "Refund response does not match its request.");
      const activeRef = order.activeRefundRequestId ? requestRef(id, order.activeRefundRequestId) : null;
      const active = activeRef ? (requestId === order.activeRefundRequestId ? rs : await tx.get(activeRef)) : null;
      refunds[entity.id] = { amount: entity.amount, status: entity.status };
      // Older orders can have a cumulative refunded amount without a ledger.
      // Add a newly processed, known request exactly once; historical provider
      // events only raise the cumulative floor and cannot double-count it.
      const increment = rs?.exists && rs.data().status !== "processed" && previous?.status !== "processed" && entity.status === "processed" ? entity.amount : 0;
      const amount = Math.max((order.refundedAmountPaise || 0) + increment, sumProcessed(refunds));
      if (amount > order.amountPaise) throw new ErrorClass(409, "Recorded refunds exceed the order total. Review the payment.");
      const matchesActive = rs?.exists && requestId === order.activeRefundRequestId;
      const activeStatus = matchesActive ? entity.status : active?.data()?.status;
      const pending = Object.values(refunds).some(r => r.status === "pending");
      const status = unsettled(activeStatus) ? activeStatus : pending ? "pending" : amount >= order.amountPaise ? "processed" : activeStatus === "failed" ? "failed" : amount > 0 ? "partial" : entity.status === "failed" ? "failed" : "pending";
      if (rs?.exists) tx.update(rr, { status: entity.status, refundId: entity.id, updatedAt: timestamp() });
      tx.update(ref, { refunds, refundId: entity.id, ...(matchesActive ? { activeRefundEntityId: entity.id } : {}), refundedAmountPaise: amount, refundStatus: status, attentionRequired: status !== "processed", attentionReason: status === "failed" ? "refund_failed" : status === "partial" ? "partial_refund_review" : status === "processed" ? null : "refund_pending", updatedAt: timestamp() });
    });
  }
  return { begin, execute, record };
}
module.exports = { createRefunds };
