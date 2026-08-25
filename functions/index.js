"use strict";

const crypto = require("node:crypto");

const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { defineSecret } = require("firebase-functions/params");
const Razorpay = require("razorpay");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const REGION = "asia-south1";
const CURRENCY = "INR";
const MAX_ITEM_QUANTITY = 10;
const DEFAULT_AVAILABLE_STOCK = MAX_ITEM_QUANTITY;
const ORDER_COLLECTION = "checkoutOrders";
const PRODUCT_COLLECTION = "sarees";
const APP_CHECK_ENFORCEMENT = (process.env.APP_CHECK_ENFORCEMENT || "off").trim().toLowerCase();
const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://eshwesareestudio.web.app",
  "https://eshwe.com",
  "https://www.eshwe.com"
]);

const razorpayKeyIdSecret = defineSecret("RAZORPAY_KEY_ID");
const razorpayKeySecretSecret = defineSecret("RAZORPAY_KEY_SECRET");
const razorpayWebhookSecret = defineSecret("RAZORPAY_WEBHOOK_SECRET");

exports.createRazorpayOrder = onRequest(
  {
    region: REGION,
    secrets: [razorpayKeyIdSecret, razorpayKeySecretSecret]
  },
  async (request, response) => {
    if (handleCors(request, response, ["POST"])) {
      return;
    }

    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed." });
      return;
    }

    try {
      const verifiedAppCheck = await verifyAppCheck(request);
      const verifiedUser = await verifyOptionalAuthUser(request);
      const payload = parseBody(request.body);
      const requestedItems = normalizeRequestedItems(payload.items);
      const customer = normalizeCustomer(payload.customer);
      const sourcePath = normalizeSourcePath(payload.sourcePath);
      const orderNotes = normalizeOptionalText(payload.notes, 500);
      const pricedOrder = await priceCart(requestedItems);
      const orderRef = db.collection(ORDER_COLLECTION).doc();
      const receipt = buildReceipt(orderRef.id);
      const razorpay = createRazorpayClient();

      const razorpayOrder = await razorpay.orders.create({
        amount: pricedOrder.totalPaise,
        currency: CURRENCY,
        receipt,
        notes: {
          internalOrderId: orderRef.id,
          customerName: truncateValue(customer.fullName, 60),
          customerPhone: truncateValue(customer.phone, 20)
        }
      });

      await orderRef.set({
        amountPaise: pricedOrder.totalPaise,
        amountBreakdown: pricedOrder.summary,
        inventoryCommitted: false,
        cartItems: pricedOrder.items,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        currency: CURRENCY,
        customer,
        notes: orderNotes,
        paymentStatus: "pending",
        razorpayOrderId: razorpayOrder.id,
        receipt,
        sourcePath,
        status: "created",
        userId: verifiedUser?.uid || null,
        appCheckAppId: verifiedAppCheck?.appId || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      response.status(200).json({
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        internalOrderId: orderRef.id,
        keyId: razorpayKeyIdSecret.value(),
        lineItems: pricedOrder.items,
        razorpayOrderId: razorpayOrder.id
      });
    } catch (error) {
      logger.error("createRazorpayOrder failed", error);
      response.status(getErrorStatus(error, 400)).json({ error: getErrorMessage(error, "Unable to create payment order.") });
    }
  }
);

exports.verifyRazorpayPayment = onRequest(
  {
    region: REGION,
    secrets: [razorpayKeySecretSecret, razorpayKeyIdSecret]
  },
  async (request, response) => {
    if (handleCors(request, response, ["POST"])) {
      return;
    }

    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed." });
      return;
    }

    try {
      await verifyAppCheck(request);
      const payload = parseBody(request.body);
      const internalOrderId = requireString(payload.internalOrderId, "Order reference is missing.");
      const razorpayOrderId = requireString(payload.razorpay_order_id, "Razorpay order id is missing.");
      const razorpayPaymentId = requireString(payload.razorpay_payment_id, "Razorpay payment id is missing.");
      const razorpaySignature = requireString(payload.razorpay_signature, "Razorpay signature is missing.");
      const orderRef = db.collection(ORDER_COLLECTION).doc(internalOrderId);
      const orderSnapshot = await orderRef.get();

      if (!orderSnapshot.exists) {
        throw new Error("Order could not be found.");
      }

      const orderData = orderSnapshot.data() || {};

      if (orderData.razorpayOrderId !== razorpayOrderId) {
        throw new Error("Order id mismatch.");
      }

      const generatedSignature = crypto
        .createHmac("sha256", razorpayKeySecretSecret.value())
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      if (!safeEqual(generatedSignature, razorpaySignature)) {
        await orderRef.update({
          paymentFailureReason: "signature_mismatch",
          paymentStatus: "failed",
          status: "verification_failed",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          verificationAttemptedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        throw new Error("Payment signature verification failed.");
      }

      const razorpay = createRazorpayClient();
      const payment = await razorpay.payments.fetch(razorpayPaymentId);

      if (!payment || payment.order_id !== razorpayOrderId) {
        throw new Error("Payment could not be matched to the order.");
      }

      if (Number(payment.amount) !== Number(orderData.amountPaise)) {
        throw new Error("Payment amount mismatch.");
      }

      const normalizedPaymentStatus = normalizePaymentStatus(payment.status);
      const paymentEntity = sanitizePaymentEntity(payment);

      if (normalizedPaymentStatus === "captured") {
        await commitPaidOrderInventory(orderRef, {
          paymentCaptured: Boolean(payment.captured),
          paymentEntity,
          paymentMethod: payment.method || null,
          paymentStatus: normalizedPaymentStatus,
          razorpayPaymentId,
          razorpaySignature,
          status: "paid",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          verifiedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        await orderRef.update({
          paymentCaptured: Boolean(payment.captured),
          paymentEntity,
          paymentMethod: payment.method || null,
          paymentStatus: normalizedPaymentStatus,
          razorpayPaymentId,
          razorpaySignature,
          status: normalizedPaymentStatus === "captured" ? "paid" : "authorized",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          verifiedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      response.status(200).json({
        paymentStatus: normalizedPaymentStatus,
        success: true
      });
    } catch (error) {
      logger.error("verifyRazorpayPayment failed", error);
      response.status(getErrorStatus(error, 400)).json({ error: getErrorMessage(error, "Unable to verify payment.") });
    }
  }
);

exports.razorpayWebhook = onRequest(
  {
    region: REGION,
    secrets: [razorpayWebhookSecret]
  },
  async (request, response) => {
    if (handleCors(request, response, ["POST"])) {
      return;
    }

    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed." });
      return;
    }

    try {
      const signature = request.get("x-razorpay-signature");

      if (!signature) {
        throw new Error("Webhook signature is missing.");
      }

      const rawBody = Buffer.isBuffer(request.rawBody)
        ? request.rawBody
        : Buffer.from(JSON.stringify(parseBody(request.body)));
      const expectedSignature = crypto
        .createHmac("sha256", razorpayWebhookSecret.value())
        .update(rawBody)
        .digest("hex");

      if (!safeEqual(expectedSignature, signature)) {
        throw new Error("Webhook signature verification failed.");
      }

      const payload = parseBody(request.body);
      await handleWebhookEvent(payload);

      response.status(200).json({ received: true });
    } catch (error) {
      logger.error("razorpayWebhook failed", error);
      response.status(400).json({ error: getErrorMessage(error, "Unable to process webhook.") });
    }
  }
);

function createRazorpayClient() {
  return new Razorpay({
    key_id: razorpayKeyIdSecret.value(),
    key_secret: razorpayKeySecretSecret.value()
  });
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function parseBody(body) {
  if (!body) {
    return {};
  }

  if (typeof body === "string") {
    return JSON.parse(body);
  }

  if (Buffer.isBuffer(body)) {
    return JSON.parse(body.toString("utf8"));
  }

  return body;
}

async function verifyAppCheck(request) {
  const appCheckToken = request.get("X-Firebase-AppCheck");

  if (!appCheckToken) {
    if (isAppCheckEnforced()) {
      throw new HttpError(401, "Security check is required before checkout.");
    }

    return null;
  }

  try {
    return await admin.appCheck().verifyToken(appCheckToken);
  } catch (error) {
    logger.warn("Invalid App Check token", {
      message: getErrorMessage(error, "Invalid App Check token.")
    });
    throw new HttpError(401, "Security check failed. Refresh the page and try again.");
  }
}

async function verifyOptionalAuthUser(request) {
  const authHeader = request.get("Authorization");

  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new HttpError(401, "Authentication header is invalid.");
  }

  try {
    return await admin.auth().verifyIdToken(match[1]);
  } catch (error) {
    logger.warn("Invalid auth token", {
      message: getErrorMessage(error, "Invalid auth token.")
    });
    throw new HttpError(401, "Session verification failed. Sign in again and retry.");
  }
}

function setJsonHeaders(response) {
  response.set("Cache-Control", "no-store");
  response.set("Content-Type", "application/json; charset=utf-8");
}

function handleCors(request, response, allowedMethods) {
  setJsonHeaders(response);

  const origin = typeof request.get === "function" ? request.get("origin") : null;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    response.set("Access-Control-Allow-Origin", origin);
    response.set("Vary", "Origin");
  }

  response.set("Access-Control-Allow-Headers", "Content-Type");
  response.set("Access-Control-Allow-Methods", allowedMethods.join(", "));

  if (request.method === "OPTIONS") {
    response.status(204).send("");
    return true;
  }

  return false;
}

function buildReceipt(orderId) {
  return `eshwe-${orderId.slice(0, 20)}`;
}

function normalizeRequestedItems(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Your cart is empty.");
  }

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("Cart item payload is invalid.");
    }

    const sku = requireString(item.sku, "Product sku is missing.");
    const quantity = Number(item.quantity);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
      throw new Error(`Quantity for ${sku} is invalid.`);
    }

    return { quantity, sku };
  });
}

function normalizeCustomer(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Delivery address is missing.");
  }

  return {
    address: requireString(value.address, "Address is required."),
    city: requireString(value.city, "City is required."),
    email: requireEmail(value.email),
    fullName: requireString(value.fullName, "Full name is required."),
    phone: requirePhone(value.phone),
    pincode: requireString(value.pincode, "Pincode is required."),
    state: requireString(value.state, "State is required.")
  };
}

function normalizeSourcePath(value) {
  const sourcePath = normalizeOptionalText(value, 200);
  return sourcePath || "/checkout";
}

function normalizeOptionalText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function requireString(value, errorMessage) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(errorMessage);
  }

  return value.trim();
}

function requireEmail(value) {
  const email = requireString(value, "Email is required.").toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
    throw new Error("Enter a valid email address.");
  }

  return email;
}

function requirePhone(value) {
  const phone = requireString(value, "Phone number is required.");
  const digits = phone.replace(/\D/g, "");

  if (digits.length < 10 || digits.length > 15) {
    throw new Error("Enter a valid phone number.");
  }

  return digits;
}

async function priceCart(requestedItems) {
  const items = [];
  let subtotal = 0;
  let savings = 0;

  for (const requestedItem of requestedItems) {
    const productSnapshot = await db
      .collection(PRODUCT_COLLECTION)
      .where("sku", "==", requestedItem.sku)
      .limit(1)
      .get();

    if (productSnapshot.empty) {
      throw new Error(`Product ${requestedItem.sku} could not be found.`);
    }

    const productDoc = productSnapshot.docs[0];
    const product = productDoc.data();

    if (product.status !== "active") {
      throw new Error(`${product.name || requestedItem.sku} is not available right now.`);
    }

    const availableStock = normalizeAvailableStock(product.availableStock);

    if (availableStock <= 0) {
      throw new Error(`${product.name || requestedItem.sku} is not available right now.`);
    }

    if (requestedItem.quantity > availableStock) {
      throw new Error(`${product.name || requestedItem.sku} is no longer available in the requested quantity.`);
    }

    const unitPrice = sanitizeCurrencyAmount(product.price, `Price for ${requestedItem.sku} is invalid.`);
    const unitOriginalPrice =
      typeof product.originalPrice === "number" ? sanitizeCurrencyAmount(product.originalPrice) : null;
    const lineSubtotal = unitPrice * requestedItem.quantity;

    subtotal += lineSubtotal;
    savings += Math.max((unitOriginalPrice || unitPrice) - unitPrice, 0) * requestedItem.quantity;
    items.push({
      color: product.color || "",
      name: product.name || requestedItem.sku,
      primaryImageUrl: product.primaryImageUrl || "",
      availableStock,
      productId: productDoc.id,
      quantity: requestedItem.quantity,
      sku: requestedItem.sku,
      slug: product.slug || "",
      status: product.status,
      unitOriginalPrice,
      unitPrice
    });
  }

  const shippingFee = 0;
  const packagingFee = 0;
  const total = subtotal + shippingFee + packagingFee;

  if (total <= 0) {
    throw new Error("Cart total is invalid.");
  }

  return {
    items,
    summary: {
      packagingFee,
      savings,
      shippingFee,
      subtotal,
      total
    },
    totalPaise: Math.round(total * 100)
  };
}

function normalizeAvailableStock(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_AVAILABLE_STOCK;
  }

  return Math.max(0, Math.floor(value));
}

function sanitizeCurrencyAmount(value, errorMessage = "Amount is invalid.") {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(errorMessage);
  }

  return Number(value.toFixed(2));
}

function normalizePaymentStatus(value) {
  if (value === "captured") {
    return "captured";
  }

  if (value === "authorized") {
    return "authorized";
  }

  if (value === "failed") {
    return "failed";
  }

  return "pending";
}

function sanitizePaymentEntity(payment) {
  return {
    amount: Number(payment.amount || 0),
    captured: Boolean(payment.captured),
    created_at: Number(payment.created_at || 0),
    email: payment.email || null,
    id: payment.id || null,
    method: payment.method || null,
    order_id: payment.order_id || null,
    status: payment.status || null
  };
}

async function handleWebhookEvent(payload) {
  const eventName = typeof payload.event === "string" ? payload.event : "unknown";
  const paymentEntity = payload?.payload?.payment?.entity || null;
  const orderEntity = payload?.payload?.order?.entity || null;
  const internalOrderId =
    orderEntity?.notes?.internalOrderId || paymentEntity?.notes?.internalOrderId || null;
  const razorpayOrderId = orderEntity?.id || paymentEntity?.order_id || null;

  const orderRef = await findOrderReference(internalOrderId, razorpayOrderId);

  if (!orderRef) {
    logger.warn("Webhook order not found", { eventName, internalOrderId, razorpayOrderId });
    return;
  }

  const updates = {
    lastWebhookEvent: eventName,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    webhookPayment: paymentEntity ? sanitizePaymentEntity(paymentEntity) : null,
    webhookReceivedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (eventName === "payment.captured" || eventName === "order.paid") {
    await commitPaidOrderInventory(orderRef, {
      ...updates,
      paymentCaptured: true,
      paymentMethod: paymentEntity?.method || null,
      paymentStatus: "captured",
      status: "paid"
    });
    return;
  } else if (eventName === "payment.authorized") {
    updates.paymentStatus = "authorized";
    updates.status = "authorized";
  } else if (eventName === "payment.failed") {
    updates.paymentStatus = "failed";
    updates.status = "payment_failed";
  }

  if (paymentEntity?.id) {
    updates.razorpayPaymentId = paymentEntity.id;
  }

  await orderRef.update(updates);
}

async function commitPaidOrderInventory(orderRef, orderUpdates) {
  await db.runTransaction(async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);

    if (!orderSnapshot.exists) {
      throw new Error("Order could not be found.");
    }

    const orderData = orderSnapshot.data() || {};
    const cartItems = Array.isArray(orderData.cartItems) ? orderData.cartItems : [];
    const inventoryAlreadyCommitted = orderData.inventoryCommitted === true;

    if (!inventoryAlreadyCommitted) {
      for (const item of cartItems) {
        const productRef = await getProductReferenceForOrderItem(transaction, item);
        const productSnapshot = await transaction.get(productRef);

        if (!productSnapshot.exists) {
          throw new Error(`${item.name || item.sku || "A product"} is no longer available.`);
        }

        const product = productSnapshot.data() || {};
        const availableStock = normalizeAvailableStock(product.availableStock);

        if (product.status !== "active" || availableStock < item.quantity) {
          throw new Error(`${product.name || item.name || item.sku || "A product"} is no longer available.`);
        }

        const nextAvailableStock = availableStock - item.quantity;
        transaction.update(productRef, {
          availableStock: nextAvailableStock,
          status: nextAvailableStock > 0 ? "active" : "out_of_stock",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    transaction.update(orderRef, inventoryAlreadyCommitted
      ? orderUpdates
      : {
          ...orderUpdates,
          inventoryCommitted: true,
          inventoryCommittedAt: admin.firestore.FieldValue.serverTimestamp()
        });
  });
}

async function getProductReferenceForOrderItem(transaction, item) {
  if (item?.productId) {
    return db.collection(PRODUCT_COLLECTION).doc(String(item.productId));
  }

  const snapshot = await transaction.get(
    db.collection(PRODUCT_COLLECTION).where("sku", "==", String(item?.sku || "")).limit(1)
  );

  if (snapshot.empty) {
    throw new Error(`${item?.name || item?.sku || "A product"} is no longer available.`);
  }

  return snapshot.docs[0].ref;
}

async function findOrderReference(internalOrderId, razorpayOrderId) {
  if (internalOrderId) {
    const orderRef = db.collection(ORDER_COLLECTION).doc(String(internalOrderId));
    const snapshot = await orderRef.get();

    if (snapshot.exists) {
      return orderRef;
    }
  }

  if (!razorpayOrderId) {
    return null;
  }

  const snapshot = await db
    .collection(ORDER_COLLECTION)
    .where("razorpayOrderId", "==", String(razorpayOrderId))
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].ref;
}

function truncateValue(value, maxLength) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function isAppCheckEnforced() {
  return APP_CHECK_ENFORCEMENT === "enforce" || APP_CHECK_ENFORCEMENT === "strict";
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left), "utf8");
  const rightBuffer = Buffer.from(String(right), "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getErrorMessage(error, fallback) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function getErrorStatus(error, fallback) {
  if (error instanceof HttpError && Number.isInteger(error.status)) {
    return error.status;
  }

  return fallback;
}
