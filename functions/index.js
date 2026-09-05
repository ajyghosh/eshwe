"use strict";

const crypto = require("node:crypto");

const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const { defineSecret } = require("firebase-functions/params");
const nodemailer = require("nodemailer");
const Razorpay = require("razorpay");

const CUSTOM_TOKEN_SIGNER_SERVICE_ACCOUNT =
  process.env.CUSTOM_TOKEN_SIGNER_SERVICE_ACCOUNT || "106884158684-compute@developer.gserviceaccount.com";

if (!admin.apps.length) {
  admin.initializeApp({
    serviceAccountId: CUSTOM_TOKEN_SIGNER_SERVICE_ACCOUNT
  });
}

const db = admin.firestore();
const REGION = "asia-south1";
const CURRENCY = "INR";
const MAX_ITEM_QUANTITY = 10;
const DEFAULT_AVAILABLE_STOCK = MAX_ITEM_QUANTITY;
const ORDER_COLLECTION = "checkoutOrders";
const PRODUCT_COLLECTION = "sarees";
const CUSTOMER_OTP_REQUEST_COLLECTION = "customerOtpRequests";
const CUSTOMER_OTP_CODE_COLLECTION = "customerOtpCodes";
const APP_CHECK_ENFORCEMENT = (process.env.APP_CHECK_ENFORCEMENT || "off").trim().toLowerCase();
const MSG91_SMS_FLOW_ENDPOINT = "https://control.msg91.com/api/v5/flow";
const MSG91_COUNTRY_CODE = normalizeDigits(process.env.MSG91_COUNTRY_CODE || "91") || "91";
const MSG91_SMS_CODE_VARIABLE = normalizeTemplateVariable(process.env.MSG91_SMS_CODE_VARIABLE || "num");
const OTP_LENGTH = normalizePositiveInteger(process.env.MSG91_OTP_LENGTH, 6);
const OTP_EXPIRY_MINUTES = normalizePositiveInteger(process.env.MSG91_OTP_EXPIRY_MINUTES, 10);
const OTP_COOLDOWN_SECONDS = normalizePositiveInteger(process.env.MSG91_OTP_COOLDOWN_SECONDS, 45);
const OTP_MAX_REQUESTS_PER_HOUR = normalizePositiveInteger(process.env.MSG91_OTP_MAX_REQUESTS_PER_HOUR, 12);
const OTP_MAX_VERIFY_ATTEMPTS = normalizePositiveInteger(process.env.MSG91_OTP_MAX_VERIFY_ATTEMPTS, 5);
const CONTACT_SMTP_HOST = "mail.nohello.in";
const CONTACT_SMTP_PORT = 465;
const CONTACT_SMTP_USER = "hello@nohello.in";
const CONTACT_NOTIFICATION_TO = CONTACT_SMTP_USER;
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
const msg91AuthKeySecret = defineSecret("MSG91_AUTH_KEY");
const msg91SmsTemplateIdSecret = defineSecret("MSG91_OTP_TEMPLATE_ID");
const contactSmtpPasswordSecret = defineSecret("CONTACT_SMTP_PASSWORD");

exports.sendContactEmailNotification = onDocumentCreated(
  {
    document: "customerMessages/{messageId}",
    region: REGION,
    secrets: [contactSmtpPasswordSecret]
  },
  async (event) => {
    const contactMessage = event.data?.data();

    if (!contactMessage) {
      logger.warn("Contact email notification skipped because the message data was unavailable.", {
        messageId: event.params.messageId
      });
      return;
    }

    const smtpPassword = contactSmtpPasswordSecret.value();

    if (!smtpPassword) {
      logger.error("Contact email notification skipped because CONTACT_SMTP_PASSWORD is not configured.", {
        messageId: event.params.messageId
      });
      return;
    }

    const customerEmail = getContactEmail(contactMessage.email);
    const transporter = nodemailer.createTransport({
      auth: {
        pass: smtpPassword,
        user: CONTACT_SMTP_USER
      },
      host: CONTACT_SMTP_HOST,
      port: CONTACT_SMTP_PORT,
      secure: true
    });

    try {
      await transporter.sendMail({
        from: `eshwe Contact <${CONTACT_SMTP_USER}>`,
        replyTo: customerEmail || undefined,
        subject: "New Contact Us message | eshwe",
        text: buildContactEmailText(contactMessage, event.params.messageId),
        to: CONTACT_NOTIFICATION_TO
      });
      logger.info("Contact email notification sent.", { messageId: event.params.messageId });
    } finally {
      transporter.close();
    }
  }
);

exports.sendCustomerOtp = onRequest(
  {
    region: REGION,
    secrets: [msg91AuthKeySecret, msg91SmsTemplateIdSecret]
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
      const phone = normalizeCustomerOtpPhone(payload.phone);
      await reserveOtpRequestAllowance(phone.msisdn, request);
      const verificationCode = generateVerificationCode();
      await storeCustomerVerificationCode(phone.msisdn, verificationCode);
      try {
        await sendVerificationSmsViaMsg91(phone.msisdn, verificationCode);
      } catch (error) {
        await clearStoredCustomerCode(phone.msisdn);
        throw error;
      }

      response.status(200).json({
        cooldownSeconds: OTP_COOLDOWN_SECONDS,
        success: true
      });
    } catch (error) {
      logger.error("sendCustomerOtp failed", error);
      response.status(getErrorStatus(error, 400)).json({ error: getErrorMessage(error, "Verification SMS could not be sent.") });
    }
  }
);

exports.verifyCustomerOtp = onRequest(
  {
    region: REGION
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
      const phone = normalizeCustomerOtpPhone(payload.phone);
      const otp = normalizeOtp(payload.otp);
      await verifyStoredCustomerCode(phone.msisdn, otp);
      const uid = await ensureCustomerAuthUser(phone.e164);
      const customToken = await admin.auth().createCustomToken(uid, {
        customer: true,
        signInMethod: "msg91_otp"
      });

      response.status(200).json({
        customToken,
        success: true
      });
    } catch (error) {
      logger.error("verifyCustomerOtp failed", error);
      response.status(getErrorStatus(error, 400)).json({ error: getErrorMessage(error, "Code verification failed.") });
    }
  }
);

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
      const verificationResult = await verifyPaymentForOrder({
        internalOrderId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      });

      response.status(200).json({
        paymentStatus: verificationResult.paymentStatus,
        success: true
      });
    } catch (error) {
      logger.error("verifyRazorpayPayment failed", error);
      response.status(getErrorStatus(error, 400)).json({ error: getErrorMessage(error, "Unable to verify payment.") });
    }
  }
);

exports.razorpayAppCallback = onRequest(
  {
    region: REGION,
    secrets: [razorpayKeySecretSecret, razorpayKeyIdSecret]
  },
  async (request, response) => {
    if (request.method === "OPTIONS") {
      response.status(204).send("");
      return;
    }

    if (request.method !== "POST") {
      response.status(405).send("Method not allowed.");
      return;
    }

    try {
      const payload = parseCallbackBody(request);
      const callbackSource = normalizeOptionalText(request.query?.source, 80) || "app-checkout";
      const internalOrderId = await resolveInternalOrderIdFromCallback(payload);
      const razorpayOrderId = requireString(payload.razorpay_order_id, "Razorpay order id is missing.");
      const razorpayPaymentId = requireString(payload.razorpay_payment_id, "Razorpay payment id is missing.");
      const razorpaySignature = requireString(payload.razorpay_signature, "Razorpay signature is missing.");
      const verificationResult = await verifyPaymentForOrder({
        internalOrderId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      });
      const confirmation = buildOrderConfirmationPayload(
        internalOrderId,
        verificationResult.orderData,
        razorpayOrderId,
        razorpayPaymentId,
        verificationResult.paymentStatus
      );

      setHtmlHeaders(response);
      response.status(200).send(renderAppCallbackSuccessHtml({ callbackSource, confirmation }));
    } catch (error) {
      logger.error("razorpayAppCallback failed", error);
      setHtmlHeaders(response);
      response.status(200).send(
        renderAppCallbackFailureHtml({
          message: getErrorMessage(error, "Payment could not be completed.")
        })
      );
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

function parseCallbackBody(request) {
  const body = request.body;

  if (body && typeof body === "object" && !Buffer.isBuffer(body)) {
    return body;
  }

  const rawBody = Buffer.isBuffer(request.rawBody)
    ? request.rawBody.toString("utf8")
    : typeof body === "string"
      ? body
      : "";

  if (!rawBody) {
    return {};
  }

  if (rawBody.trim().startsWith("{")) {
    return parseBody(rawBody);
  }

  const params = new URLSearchParams(rawBody);
  const parsed = {};

  for (const [key, value] of params.entries()) {
    parsed[key] = value;
  }

  return parsed;
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

function setHtmlHeaders(response) {
  response.set("Cache-Control", "no-store");
  response.set("Content-Type", "text/html; charset=utf-8");
}

function handleCors(request, response, allowedMethods) {
  setJsonHeaders(response);

  const origin = typeof request.get === "function" ? request.get("origin") : null;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    response.set("Access-Control-Allow-Origin", origin);
    response.set("Vary", "Origin");
  }

  response.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Firebase-AppCheck");
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

async function resolveInternalOrderIdFromCallback(payload) {
  const internalOrderId = normalizeOptionalText(payload.internalOrderId, 120);

  if (internalOrderId) {
    return internalOrderId;
  }

  const razorpayOrderId = requireString(payload.razorpay_order_id, "Razorpay order id is missing.");
  const matchingOrderSnapshot = await db
    .collection(ORDER_COLLECTION)
    .where("razorpayOrderId", "==", razorpayOrderId)
    .limit(1)
    .get();

  if (matchingOrderSnapshot.empty) {
    throw new Error("Order could not be found.");
  }

  return matchingOrderSnapshot.docs[0].id;
}

async function verifyPaymentForOrder({
  internalOrderId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature
}) {
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

  const verifiedOrderSnapshot = await orderRef.get();

  return {
    orderData: verifiedOrderSnapshot.data() || orderData,
    paymentStatus: normalizedPaymentStatus
  };
}

function buildOrderConfirmationPayload(internalOrderId, orderData, razorpayOrderId, razorpayPaymentId, paymentStatus) {
  const customer = orderData.customer || {};
  const summary = orderData.amountBreakdown || {};
  const cartItems = Array.isArray(orderData.cartItems) ? orderData.cartItems : [];

  return {
    createdAtIso: new Date().toISOString(),
    customer: {
      address: customer.address || "",
      city: customer.city || "",
      email: customer.email || "",
      fullName: customer.fullName || "",
      phone: customer.phone || "",
      pincode: customer.pincode || "",
      state: customer.state || ""
    },
    internalOrderId,
    items: cartItems.map((item) => ({
      color: item.color || "",
      name: item.name || item.sku || "Item",
      primaryImageUrl: item.primaryImageUrl || "",
      quantity: Number(item.quantity) || 1,
      sku: item.sku || "",
      unitOriginalPrice: typeof item.unitOriginalPrice === "number" ? item.unitOriginalPrice : null,
      unitPrice: typeof item.unitPrice === "number" ? item.unitPrice : null
    })),
    notes: typeof orderData.notes === "string" ? orderData.notes : "",
    paymentStatus,
    razorpayOrderId,
    razorpayPaymentId,
    summary: {
      currency: orderData.currency || CURRENCY,
      packagingFee: typeof summary.packagingFee === "number" ? summary.packagingFee : 0,
      savings: typeof summary.savings === "number" ? summary.savings : 0,
      shippingFee: typeof summary.shippingFee === "number" ? summary.shippingFee : 0,
      subtotal: typeof summary.subtotal === "number" ? summary.subtotal : 0,
      total: typeof summary.total === "number" ? summary.total : 0
    }
  };
}

function renderAppCallbackSuccessHtml({ callbackSource, confirmation }) {
  const serializedConfirmation = JSON.stringify(confirmation).replace(/</g, "\\u003c");
  const sourceLabel = escapeHtml(callbackSource || "app-checkout");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>eshwe Payment Complete</title>
    <style>
      *{box-sizing:border-box}
      body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fbf4e8;color:#2b2a29;font:16px/1.6 "Avenir Next","Segoe UI",sans-serif}
      .card{width:min(430px,calc(100vw - 28px));padding:30px 22px;border:1px solid #ddd0bc;border-radius:30px;background:linear-gradient(180deg,rgba(255,250,242,0.98) 0%,rgba(247,237,224,0.96) 100%);box-shadow:0 30px 100px rgba(94,104,79,0.18);text-align:center}
      .logo-wrap{display:flex;align-items:center;justify-content:center}
      .logo{display:flex;height:82px;width:82px;align-items:center;justify-content:center;border-radius:24px;border:1px solid #dcc9ad;background:linear-gradient(135deg,#fff3df 0%,#efd8ab 100%);box-shadow:0 18px 40px rgba(176,111,61,0.16)}
      .logo img{height:62px;width:62px;object-fit:contain}
      .pill{display:inline-flex;padding:8px 14px;border-radius:999px;background:#eef4e7;color:#5e684f;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
      h1{margin:18px 0 0;font:400 34px/1.08 Georgia,serif}
      p{margin:14px 0 0;color:#667056}
      .printer{margin:28px auto 0;max-width:288px}
      .printer-shell{position:relative;border:1px solid #d7ccb9;border-radius:28px;background:#667056;padding:20px 20px 24px;box-shadow:0 22px 45px rgba(94,104,79,0.2)}
      .printer-slot{margin:0 auto;height:8px;width:112px;border-radius:999px;background:rgba(255,250,242,.26)}
      .printer-shadow{position:absolute;left:50%;top:54px;height:12px;width:172px;transform:translateX(-50%);border-radius:999px;background:rgba(35,42,28,.18);filter:blur(10px)}
      .receipt{position:absolute;left:50%;top:54px;width:78%;transform:translateX(-50%);overflow:hidden;border:1px solid #eadfce;border-radius:14px 14px 22px 22px;background:#fffaf2;box-shadow:0 18px 34px rgba(47,40,32,0.16);animation:receipt-slide 1700ms cubic-bezier(.22,1,.36,1) infinite alternate}
      .receipt-shine{height:8px;width:100%;background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.72) 50%,rgba(255,255,255,0) 100%);animation:receipt-shine 1700ms ease-in-out infinite}
      .receipt-body{padding:16px 18px 20px}
      .receipt-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .line{display:block;height:10px;border-radius:999px;background:#e6dbc9}
      .line.soft{background:#efe6d9}
      .divider{margin:14px 0;height:1px;background:#ece1d3}
      .printer-pills{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding-top:138px}
      .status-pill{border:1px solid rgba(255,250,242,.14);border-radius:16px;background:rgba(255,250,242,.1);padding:10px 8px}
      .status-pill strong{display:block;font-size:11px;letter-spacing:.14em;color:rgba(255,250,242,.72);text-transform:uppercase}
      .status-pill span{display:block;margin-top:4px;font-size:13px;color:#fffaf2}
      .dots{margin-top:18px;display:flex;justify-content:center;gap:8px}
      .dot{width:10px;height:10px;border-radius:999px;background:#5e684f;animation:pulse 1100ms ease-in-out infinite}
      .dot:nth-child(2){animation-delay:180ms}.dot:nth-child(3){animation-delay:360ms}
      @keyframes pulse{0%,80%,100%{transform:scale(.72);opacity:.45}40%{transform:scale(1);opacity:1}}
      @keyframes receipt-slide{0%{transform:translateX(-50%) translateY(-2px)}100%{transform:translateX(-50%) translateY(20px)}}
      @keyframes receipt-shine{0%,100%{transform:translateX(-30%)}50%{transform:translateX(30%)}}
    </style>
  </head>
  <body>
    <div class="card">
      <div class="logo-wrap"><div class="logo"><img src="/eshwelogo-transparent.png" alt="eshwe" /></div></div>
      <span class="pill">Paid</span>
      <h1>Printing your receipt.</h1>
      <p>Your payment is confirmed. We are preparing the confirmation view and taking you back to the eshwe app.</p>
      <p style="font-size:13px;">Source: ${sourceLabel}</p>
      <div class="printer">
        <div class="printer-shell">
          <div class="printer-slot"></div>
          <div class="printer-shadow"></div>
          <div class="receipt">
            <div class="receipt-shine"></div>
            <div class="receipt-body">
              <div class="receipt-row">
                <span class="line" style="width:84px"></span>
                <span class="line soft" style="width:54px"></span>
              </div>
              <div class="divider"></div>
              <span class="line" style="width:100%"></span>
              <span class="line" style="margin-top:8px;width:82%"></span>
              <span class="line soft" style="margin-top:8px;width:65%"></span>
            </div>
          </div>
          <div class="printer-pills">
            <div class="status-pill"><strong>Payment</strong><span>Paid</span></div>
            <div class="status-pill"><strong>Receipt</strong><span>Printing</span></div>
            <div class="status-pill"><strong>Next</strong><span>Preview</span></div>
          </div>
        </div>
      </div>
      <div class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
    </div>
    <script>
      try {
        window.sessionStorage.setItem("eshwe.latestOrderConfirmation", JSON.stringify(${serializedConfirmation}));
        window.sessionStorage.setItem("eshwe.clearCartAfterPayment", "1");
        window.sessionStorage.removeItem("eshwe.mobilePaymentPending");
      } catch (error) {}
      window.setTimeout(function () {
        window.location.replace("/app/order-confirmation/");
      }, 1600);
    </script>
  </body>
</html>`;
}

function renderAppCallbackFailureHtml({ message }) {
  const safeMessage = escapeHtml(message || "Payment could not be completed.");
  const destination = `/app/checkout/?payment=failed&reason=${encodeURIComponent(message || "Payment could not be completed.")}`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>eshwe Payment Incomplete</title>
    <style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fbf4e8;color:#2b2a29;font:16px/1.6 "Avenir Next","Segoe UI",sans-serif}
      .card{width:min(420px,calc(100vw - 32px));padding:28px 24px;border:1px solid #e6d0c9;border-radius:28px;background:#fff8f4;box-shadow:0 30px 100px rgba(94,104,79,0.12);text-align:center}
      h1{margin:0;font:400 32px/1.08 Georgia,serif}
      p{margin:14px 0 0;color:#8b5a52}
      a{display:inline-flex;margin-top:22px;padding:12px 18px;border-radius:16px;background:#5e684f;color:#fbf4e8;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.14em}
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Payment incomplete.</h1>
      <p>${safeMessage}</p>
      <a href="${destination}">RETURN TO CHECKOUT</a>
    </div>
    <script>
      try { window.sessionStorage.removeItem("eshwe.mobilePaymentPending"); } catch (error) {}
      window.location.replace("${destination}");
    </script>
  </body>
</html>`;
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

async function reserveOtpRequestAllowance(msisdn, request) {
  const ipAddress = getRequestIpAddress(request);
  const phoneKey = `phone:${hashValue(msisdn)}`;
  const ipKey = `ip:${hashValue(ipAddress || "unknown")}`;
  await Promise.all([
    incrementOtpAllowance(phoneKey, {
      cooldownSeconds: OTP_COOLDOWN_SECONDS,
      hourlyLimit: OTP_MAX_REQUESTS_PER_HOUR,
      messagePrefix: "This mobile number"
    }),
    incrementOtpAllowance(ipKey, {
      cooldownSeconds: Math.max(15, Math.floor(OTP_COOLDOWN_SECONDS / 2)),
      hourlyLimit: OTP_MAX_REQUESTS_PER_HOUR * 4,
      messagePrefix: "This device"
    })
  ]);
}

async function incrementOtpAllowance(key, options) {
  const rateLimitRef = db.collection(CUSTOMER_OTP_REQUEST_COLLECTION).doc(key);
  const now = Date.now();

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(rateLimitRef);
    const current = snapshot.exists ? snapshot.data() || {} : {};
    const lastRequestedAt = normalizePositiveInteger(current.lastRequestedAt, 0);
    const requestCount = normalizePositiveInteger(current.requestCount, 0);
    const windowStartedAt = normalizePositiveInteger(current.windowStartedAt, now);

    if (lastRequestedAt > 0 && now - lastRequestedAt < options.cooldownSeconds * 1000) {
      const waitSeconds = Math.max(1, Math.ceil((options.cooldownSeconds * 1000 - (now - lastRequestedAt)) / 1000));
      throw new HttpError(429, `${options.messagePrefix} recently requested a code. Try again in ${waitSeconds} seconds.`);
    }

    const hourWindowActive = now - windowStartedAt < 60 * 60 * 1000;
    const nextRequestCount = hourWindowActive ? requestCount + 1 : 1;

    if (hourWindowActive && requestCount >= options.hourlyLimit) {
      const waitSeconds = Math.max(60, Math.ceil((60 * 60 * 1000 - (now - windowStartedAt)) / 1000));
      const waitMinutes = Math.max(1, Math.ceil(waitSeconds / 60));
      throw new HttpError(
        429,
        `${options.messagePrefix} has reached the verification limit for now. Try again in about ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"}.`
      );
    }

    transaction.set(
      rateLimitRef,
      {
        lastRequestedAt: now,
        requestCount: nextRequestCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        windowStartedAt: hourWindowActive ? windowStartedAt : now
      },
      { merge: true }
    );
  });
}

function generateVerificationCode() {
  const minValue = 10 ** Math.max(0, OTP_LENGTH - 1);
  const maxValue = 10 ** OTP_LENGTH - 1;

  return String(crypto.randomInt(minValue, maxValue + 1));
}

async function storeCustomerVerificationCode(msisdn, code) {
  const codeRef = db.collection(CUSTOMER_OTP_CODE_COLLECTION).doc(hashValue(msisdn));
  const expiresAt = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000;

  await codeRef.set(
    {
      attemptCount: 0,
      codeHash: hashVerificationCode(msisdn, code),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

async function clearStoredCustomerCode(msisdn) {
  await db.collection(CUSTOMER_OTP_CODE_COLLECTION).doc(hashValue(msisdn)).delete().catch(() => undefined);
}

async function sendVerificationSmsViaMsg91(msisdn, code) {
  const authKey = requireConfiguredSecret(msg91AuthKeySecret, "MSG91 auth key is not configured.");
  const templateId = requireConfiguredSecret(msg91SmsTemplateIdSecret, "MSG91 SMS template id is not configured.");
  const requestBody = {
    flow_id: templateId,
    recipients: [
      {
        mobiles: msisdn,
        [MSG91_SMS_CODE_VARIABLE]: code
      }
    ]
  };
  const result = await fetch(MSG91_SMS_FLOW_ENDPOINT, {
    method: "POST",
    headers: {
      authkey: authKey,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });
  const payload = await parseJsonResponse(result);

  if (!result.ok || isMsg91ErrorPayload(payload)) {
    throw new HttpError(400, readMsg91Error(payload, "MSG91 could not send the SMS."));
  }
}

async function verifyStoredCustomerCode(msisdn, otp) {
  const codeRef = db.collection(CUSTOMER_OTP_CODE_COLLECTION).doc(hashValue(msisdn));
  const now = Date.now();

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(codeRef);

    if (!snapshot.exists) {
      throw new HttpError(400, "The verification code is invalid or has expired.");
    }

    const current = snapshot.data() || {};
    const expiresAt = normalizePositiveInteger(current.expiresAt, 0);
    const attemptCount = normalizePositiveInteger(current.attemptCount, 0);

    if (expiresAt <= now) {
      transaction.delete(codeRef);
      throw new HttpError(400, "The verification code is invalid or has expired.");
    }

    if (attemptCount >= OTP_MAX_VERIFY_ATTEMPTS) {
      transaction.delete(codeRef);
      throw new HttpError(429, "Too many incorrect attempts. Please request a new code.");
    }

    if (!safeEqual(current.codeHash || "", hashVerificationCode(msisdn, otp))) {
      transaction.set(
        codeRef,
        {
          attemptCount: attemptCount + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      throw new HttpError(400, "The verification code is invalid or has expired.");
    }

    transaction.delete(codeRef);
  });
}

async function ensureCustomerAuthUser(phoneNumber) {
  const uid = buildCustomerAuthUid(phoneNumber);

  try {
    const existingUser = await admin.auth().getUser(uid);

    if (existingUser.phoneNumber !== phoneNumber) {
      await admin.auth().updateUser(uid, { phoneNumber });
    }
  } catch (error) {
    if (error && typeof error === "object" && error.code === "auth/user-not-found") {
      await admin.auth().createUser({
        uid,
        phoneNumber
      });
    } else {
      throw error;
    }
  }

  return uid;
}

function buildCustomerAuthUid(phoneNumber) {
  return `customer:${normalizeDigits(phoneNumber)}`;
}

function normalizeCustomerOtpPhone(value) {
  const digits = normalizeDigits(value);

  if (digits.length === 10) {
    return {
      e164: `+${MSG91_COUNTRY_CODE}${digits}`,
      msisdn: `${MSG91_COUNTRY_CODE}${digits}`
    };
  }

  if (digits.length === MSG91_COUNTRY_CODE.length + 10 && digits.startsWith(MSG91_COUNTRY_CODE)) {
    return {
      e164: `+${digits}`,
      msisdn: digits
    };
  }

  throw new Error("Enter a valid mobile number.");
}

function normalizeOtp(value) {
  const digits = normalizeDigits(value);

  if (digits.length !== OTP_LENGTH) {
    throw new Error(`Enter the ${OTP_LENGTH}-digit code.`);
  }

  return digits;
}

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeTemplateVariable(value) {
  const normalizedValue = String(value || "").trim();

  return normalizedValue || "num";
}

function normalizePositiveInteger(value, fallbackValue) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallbackValue;
}

function requireConfiguredSecret(secret, message) {
  const value = secret.value();

  if (!value || !String(value).trim()) {
    throw new Error(message);
  }

  return String(value).trim();
}

function hashVerificationCode(msisdn, otp) {
  return hashValue(`${msisdn}:${otp}:${OTP_LENGTH}`);
}

async function parseJsonResponse(response) {
  return response.json().catch(() => ({}));
}

function isMsg91ErrorPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const type = typeof payload.type === "string" ? payload.type.trim().toLowerCase() : "";
  return type === "error" || payload.error === true;
}

function readMsg91Error(payload, fallbackMessage) {
  if (!payload || typeof payload !== "object") {
    return fallbackMessage;
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const firstError = payload.errors[0];

    if (typeof firstError === "string" && firstError.trim()) {
      return firstError;
    }
  }

  return fallbackMessage;
}

function buildContactEmailText(contactMessage, messageId) {
  const email = getContactEmail(contactMessage.email) || "Not provided";
  const phone = readContactField(contactMessage.phone) || "Not provided";
  const message = readContactField(contactMessage.message) || "Not provided";
  const sourcePath = readContactField(contactMessage.sourcePath) || "/";

  return [
    "A new Contact Us message was submitted on eshwe.",
    "",
    `Message ID: ${messageId}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    `Source: ${sourcePath}`,
    "",
    "Message:",
    message
  ].join("\n");
}

function getContactEmail(value) {
  const email = readContactField(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function readContactField(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getRequestIpAddress(request) {
  const forwardedFor = request.get("x-forwarded-for");

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.ip || "";
}

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
