"use strict";

const emailAddress = value => typeof value === "string" && value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim()) ? value.trim() : "";
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = value => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number.isFinite(value) ? value : 0);
const dateLabel = value => {
  const date = value?.toDate?.() || (value instanceof Date ? value : null);
  return date ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(date) + " IST" : "Not available";
};

// Called inside the same transaction that confirms payment or records dispatch.
function queueOrderNotification(tx, orderRef, order, kind, timestamp) {
  const channel = emailAddress(order.customer?.email) ? "email" : kind === "dispatch" ? "sms" : "none";
  const status = channel === "none" ? "skipped" : "pending";
  const notification = { channel, status };
  if (channel !== "none") tx.create(orderRef.collection("notifications").doc(kind), {
    kind, channel, status, order: { ...order, id: orderRef.id }, createdAt: timestamp()
  });
  return { ...(order.notifications || {}), [kind]: notification };
}

function buildOrderEmail(order, kind) {
  const dispatched = kind === "dispatch";
  const title = dispatched ? "Your sarees are on their way" : "Thank you for your order";
  const customer = order.customer || {};
  const items = order.cartItems || [];
  const amounts = order.amountBreakdown || {};
  const subtotal = amounts.subtotal ?? items.reduce((sum, item) => sum + (item.unitPrice || 0) * item.quantity, 0);
  const total = order.amountPaise != null ? order.amountPaise / 100 : amounts.total;
  const details = [
    ["Order ID", order.id], ["Receipt", order.receipt || "—"], ["Placed", dateLabel(order.createdAt)],
    ["Payment", order.paymentMethod || "Paid online"], ["Payment status", "Paid"],
    ["Payment ID", order.razorpayPaymentId || "—"], ["Razorpay order", order.razorpayOrderId || "—"],
    ["Order status", dispatched ? "Dispatched" : "Confirmed — awaiting dispatch"],
    ...(dispatched ? [["AWB / tracking number", order.awbNumber]] : [])
  ];
  const address = [customer.fullName, customer.address, [customer.city, customer.state, customer.pincode].filter(Boolean).join(", "), customer.phone, customer.email].filter(Boolean);
  const totals = [["Subtotal", subtotal], ["Shipping", amounts.shippingFee || 0], ["Packaging", amounts.packagingFee || 0], ...(amounts.savings ? [["Savings (already included)", amounts.savings]] : []), ["Total paid", total]];
  const text = ["eshwe • Saree Studio", title, `Hello ${customer.fullName || "there"},`, dispatched ? "Your order has been dispatched. To track your delivery, visit https://eshwe.com, select Track, and enter the AWB number below." : "Your payment is confirmed. We are preparing your order.", ...details.map(([key,value]) => `${key}: ${value}`), "", "DELIVERY ADDRESS", ...address, "", "YOUR SAREES", ...items.map(item => `${item.name} | SKU ${item.sku}${item.color ? ` | ${item.color}` : ""} | Qty ${item.quantity} | Unit ${money(item.unitPrice)} | Line total ${money((item.unitPrice || 0) * item.quantity)}`), "", ...totals.map(([key,value])=>`${key}: ${money(value)}`), "", `Order note: ${order.notes || "No customer note added for this order."}`, "Need help? Reply to this email.", "Visit our website: https://eshwe.com"].join("\n");
  const row = (key,value) => `<tr><td style="padding:7px 0;color:#626e58;vertical-align:top">${escapeHtml(key)}</td><td style="padding:7px 0 7px 16px;text-align:right;overflow-wrap:anywhere">${escapeHtml(value)}</td></tr>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f5efe4;color:#35402e;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:auto;background:#fffaf2;border:1px solid #dfd6c8;border-radius:16px"><tr><td style="padding:28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="text-align:center;padding-bottom:16px"><a href="https://eshwe.com" style="display:inline-block;text-decoration:none"><img src="https://eshwe.com/eshwelogo-transparent.png" alt="eshwe Saree Studio" width="140" height="147" style="display:block;width:140px;height:auto;max-width:100%;border:0"></a></td></tr></table><h1 style="font-size:25px;line-height:1.3">${title}</h1><p>Hello ${escapeHtml(customer.fullName || "there")},</p><p style="line-height:1.7">${dispatched ? 'Your order has been dispatched. To track your delivery, visit <a href="https://eshwe.com" style="color:#526347;text-decoration:underline;font-weight:bold">eshwe.com</a>, select <strong>Track</strong>, and enter the AWB number below.' : "Your payment is confirmed. We are preparing your order."}</p>${dispatched ? `<div style="padding:18px;background:#e8eedf;border-radius:10px"><strong>AWB / tracking number</strong><p style="font-size:22px;overflow-wrap:anywhere;margin-bottom:0">${escapeHtml(order.awbNumber)}</p></div>` : ""}<h2 style="font-size:18px">Order details</h2><table width="100%" style="font-size:14px;border-collapse:collapse">${details.map(([k,v])=>row(k,v)).join("")}</table><h2 style="font-size:18px">Delivery address</h2><p style="line-height:1.7;overflow-wrap:anywhere">${address.map(escapeHtml).join("<br>")}</p><h2 style="font-size:18px">Your sarees</h2>${items.map(item=>`<div style="border-top:1px solid #dfd6c8;padding:16px 0;overflow-wrap:anywhere"><strong>${escapeHtml(item.name)}</strong><p style="color:#626e58;font-size:13px">SKU ${escapeHtml(item.sku)}${item.color ? ` · ${escapeHtml(item.color)}` : ""}</p><p>Qty ${escapeHtml(item.quantity)} · ${escapeHtml(money(item.unitPrice))} each</p><strong>${escapeHtml(money((item.unitPrice || 0) * item.quantity))}</strong></div>`).join("")}<table width="100%" style="font-size:14px;border-top:1px solid #dfd6c8">${totals.map(([k,v])=>row(k,money(v))).join("")}</table><h2 style="font-size:18px">Order note</h2><p style="white-space:pre-wrap;line-height:1.6;overflow-wrap:anywhere">${escapeHtml(order.notes || "No customer note added for this order.")}</p><p style="border-top:1px solid #dfd6c8;padding-top:20px;color:#626e58;line-height:1.6">Thank you for choosing eshwe.<br>Need help? Reply to this email.<br><a href="https://eshwe.com" style="color:#526347;text-decoration:underline;font-weight:bold">eshwe.com</a></p></td></tr></table></td></tr></table></body></html>`;
  return { subject: dispatched ? "Your eshwe order has been dispatched" : "Your eshwe order is confirmed", text, html };
}

function createOrderNotificationWorker({ db, timestamp, sendEmail, sendSms, smsConfigured }) {
  async function update(orderRef, jobRef, status, extra = {}) {
    await db.runTransaction(async tx => {
      const job = await tx.get(jobRef); const order = await tx.get(orderRef);
      if (!job.exists) return;
      tx.update(jobRef, { status, ...extra, updatedAt: timestamp() });
      if (order.exists) tx.update(orderRef, { notifications: { ...(order.data().notifications || {}), [job.id]: { channel: job.data().channel, status } } });
    });
  }
  return async function deliver(orderId, kind) {
    if (!["confirmation", "dispatch"].includes(kind)) return;
    const orderRef = db.collection("checkoutOrders").doc(orderId);
    const jobRef = orderRef.collection("notifications").doc(kind);
    const job = await db.runTransaction(async tx => {
      const snapshot = await tx.get(jobRef); const order = await tx.get(orderRef);
      if (!snapshot.exists || !order.exists || !["pending", "awaiting_configuration"].includes(snapshot.data().status)) return null;
      const data = snapshot.data();
      const status = data.channel === "sms" && !smsConfigured() ? "awaiting_configuration" : "sending";
      tx.update(jobRef, { status, updatedAt: timestamp() });
      tx.update(orderRef, { notifications: { ...(order.data().notifications || {}), [kind]: { channel: data.channel, status } } });
      return status === "sending" ? data : null;
    });
    if (!job) return;
    try {
      if (job.channel === "email") await sendEmail(emailAddress(job.order.customer?.email), buildOrderEmail(job.order, kind), `${orderId}-${kind}`);
      else await sendSms(job.order);
    } catch {
      // SMTP/network failures may happen after provider acceptance. Surface this
      // for manual review; automatically resending could notify customers twice.
      await update(orderRef, jobRef, "failed");
      return;
    }
    await update(orderRef, jobRef, "sent", { sentAt: timestamp() });
  };
}
module.exports = { emailAddress, queueOrderNotification, buildOrderEmail, createOrderNotificationWorker };
