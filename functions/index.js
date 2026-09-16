"use strict";

const crypto = require("node:crypto");

const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { createCommerce, CommerceError, normalizeItems } = require("./commerce");
const { createProductService } = require("./products");
const { createOrderNotificationWorker } = require("./order-notifications");
const { PRIMARY_REGION, shouldHandleEvent } = require("./background-region");
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
const REGION = PRIMARY_REGION;
const CURRENCY = "INR";
const ORDER_COLLECTION = "checkoutOrders";
const CUSTOMER_OTP_REQUEST_COLLECTION = "customerOtpRequests";
const CUSTOMER_OTP_CODE_COLLECTION = "customerOtpCodes";
const APP_CHECK_ENFORCEMENT = (process.env.APP_CHECK_ENFORCEMENT || "off").trim().toLowerCase();
const MSG91_SMS_FLOW_ENDPOINT = "https://control.msg91.com/api/v5/flow";
const MSG91_COUNTRY_CODE = normalizeDigits(process.env.MSG91_COUNTRY_CODE || "91") || "91";
const MSG91_SMS_CODE_VARIABLE = normalizeTemplateVariable(process.env.MSG91_SMS_CODE_VARIABLE || "numeric");
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

// The owner confirmed the migration. Export only the established US names.
function registerHttp(name, options, handler) {
  exports[`${name}Us`] = onRequest({ ...options, region: PRIMARY_REGION }, handler);
}

function registerBackground(name, registrar, options, handler) {
  const exportName = `${name}Us`;
  // Preserve the cutover boundary so delayed pre-migration events are not replayed.
  exports[exportName] = registrar({ ...options, region: PRIMARY_REGION }, async (event) => {
    if (!await shouldHandleEvent(db, PRIMARY_REGION, event)) {
      logger.info("Background function is on standby for this event.", { function: exportName, region: PRIMARY_REGION });
      return;
    }
    return handler(event);
  });
}

registerBackground("sendContactEmailNotification", onDocumentCreated,
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
        from: `eshwe studio <${CONTACT_SMTP_USER}>`,
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

// Separate from support notifications: one durable job per order/event.
registerBackground("sendOrderNotification", onDocumentCreated, {
  document: "checkoutOrders/{orderId}/notifications/{kind}",
  secrets: [contactSmtpPasswordSecret, msg91AuthKeySecret], retry: true
}, async event => {
  const deliver = createOrderNotificationWorker({
    db, timestamp: () => admin.firestore.FieldValue.serverTimestamp(),
    smsConfigured: () => Boolean(process.env.MSG91_DISPATCH_TEMPLATE_ID?.trim()),
    sendEmail: async (to, email, messageKey) => {
      if (!to) throw new Error("Customer email unavailable.");
      const transporter = nodemailer.createTransport({
        host: CONTACT_SMTP_HOST, port: CONTACT_SMTP_PORT, secure: true,
        auth: { user: CONTACT_SMTP_USER, pass: requireConfiguredSecret(contactSmtpPasswordSecret, "Email sender is not configured.") },
        connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000
      });
      try {
        const result = await transporter.sendMail({ ...email, to, from: `eshwe studio <${CONTACT_SMTP_USER}>`, replyTo: CONTACT_SMTP_USER, messageId: `<${messageKey}@eshwe.com>` });
        if (!result.accepted?.length) throw new Error("Email was not accepted.");
      } finally { transporter.close(); }
    },
    sendSms: async order => {
      const phone = normalizeCustomerOtpPhone(order.customer?.phone).msisdn;
      // Dispatch flow: "Your order is shipped! Track it using {#alphanumeric#}
      // at eshwe.com under Track Order. - athmasakhi". Use the saved AWB,
      // never the order ID or an OTP, for the template's single variable.
      const response = await fetch(MSG91_SMS_FLOW_ENDPOINT, {
        method: "POST", headers: { authkey: requireConfiguredSecret(msg91AuthKeySecret, "SMS sender is not configured."), "Content-Type": "application/json" },
        body: JSON.stringify({ flow_id: process.env.MSG91_DISPATCH_TEMPLATE_ID.trim(), recipients: [{ mobiles: phone, alphanumeric: order.awbNumber }] }),
        signal: AbortSignal.timeout(20000)
      });
      const payload = await response.json();
      if (!response.ok || payload.type !== "success") throw new Error("SMS provider did not accept the notification.");
    }
  });
  await deliver(event.params.orderId, event.params.kind);
});

registerHttp("sendCustomerOtp",
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

registerHttp("verifyCustomerOtp",
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
      await incrementOtpAllowance(`verify-ip:${hashValue(getRequestIpAddress(request) || "unknown")}`, {
        cooldownSeconds: 0, hourlyLimit: 120, messagePrefix: "This device"
      });
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

registerHttp("createRazorpayOrder",
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
      if (!verifiedUser) throw new HttpError(401, "Sign in before paying.");
      const commerce = getCommerce();
      const order = await commerce.reserve({ userId: verifiedUser.uid, checkoutKey: payload.checkoutKey, items: requestedItems, customer, notes: orderNotes, sourcePath });
      response.status(200).json(checkoutResponse(order));
    } catch (error) {
      logger.error("createRazorpayOrder failed", error);
      response.status(getErrorStatus(error, 400)).json({ error: getErrorMessage(error, "Unable to create payment order."), internalOrderId: error.orderId || null });
    }
  }
);

registerHttp("verifyRazorpayPayment",
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
      const user = await verifyOptionalAuthUser(request);
      if (!user) throw new HttpError(401, "Sign in to verify this order.");
      const ownedOrder = await db.collection(ORDER_COLLECTION).doc(internalOrderId).get();
      if (!ownedOrder.exists || ownedOrder.data().userId !== user.uid) throw new HttpError(404, "Order not found.");
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
        order: verificationResult.orderData,
        confirmation: buildOrderConfirmationPayload(internalOrderId, verificationResult.orderData, razorpayOrderId, razorpayPaymentId, verificationResult.paymentStatus),
        success: true
      });
    } catch (error) {
      logger.error("verifyRazorpayPayment failed", error);
      response.status(getErrorStatus(error, 400)).json({ error: getErrorMessage(error, "Unable to verify payment.") });
    }
  }
);

registerHttp("razorpayAppCallback",
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

registerHttp("razorpayWebhook",
  {
    region: REGION,
    secrets: [razorpayWebhookSecret, razorpayKeyIdSecret, razorpayKeySecretSecret]
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

function getCommerce() {
  const razorpay = createRazorpayClient();
  return createCommerce({ db, timestamp: () => admin.firestore.FieldValue.serverTimestamp(), gateway: {
    createOrder: payload => razorpay.orders.create(payload),
    fetchPayments: id => razorpay.orders.fetchPayments(id),
    fetchRefund: id => razorpay.refunds.fetch(id),
    refund: async (id, body, key) => {
      const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(id)}/refund`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Refund-Idempotency": key, Authorization: `Basic ${Buffer.from(`${razorpayKeyIdSecret.value()}:${razorpayKeySecretSecret.value()}`).toString("base64")}` },
        body: JSON.stringify(body), signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error("Refund could not be confirmed; queued for reconciliation.");
      return response.json();
    }
  } });
}

function checkoutResponse(order) {
  return { amount: order.amountPaise, currency: order.currency, internalOrderId: order.id, keyId: razorpayKeyIdSecret.value(), lineItems: order.cartItems, razorpayOrderId: order.razorpayOrderId || null, reservationExpiresAt: order.reservationExpiresAt, canPay: order.reservationState === "held" && order.reservationExpiresAt > Date.now() && order.gatewaySetup === "ready" && !order.paymentCaptured && order.paymentStatus !== "authorized", order };
}

async function requireOwner(request) {
  const user = await verifyOptionalAuthUser(request);
  if (!user?.email_verified || !user.email) throw new HttpError(403, "Owner access required.");
  if (user.email !== "ajyghosh@gmail.com" && !(await db.collection("ownerAccounts").doc(user.email).get()).exists) throw new HttpError(403, "Owner access required.");
  return user;
}

registerHttp("checkoutStatus", { region: REGION, secrets: [razorpayKeyIdSecret, razorpayKeySecretSecret] }, async (request, response) => {
  if (handleCors(request, response, ["POST"])) return;
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed." });
  try {
    await verifyAppCheck(request);
    const user = await verifyOptionalAuthUser(request);
    if (!user) throw new HttpError(401, "Sign in to view your order.");
    const payload = parseBody(request.body); const commerce = getCommerce();
    const id = payload.internalOrderId || (await commerce.sessionRef(user.uid).get()).data()?.orderId;
    if (!id) return response.json({ order: null });
    const existing = await commerce.readOrder(id);
    if (!existing || existing.userId !== user.uid) throw new HttpError(404, "Order not found.");
    const order = await commerce.reconcile(id, payload.cancel === true);
    response.json({ ...checkoutResponse(order), confirmation: buildOrderConfirmationPayload(id, order, order.razorpayOrderId || "", order.razorpayPaymentId || "", order.paymentStatus || "pending") });
  } catch (error) { response.status(getErrorStatus(error, 503)).json({ error: getErrorMessage(error, "Unable to check payment. Please retry status checking before paying again.") }); }
});

registerHttp("ownerOrderAction", { region: REGION, secrets: [razorpayKeyIdSecret, razorpayKeySecretSecret] }, async (request, response) => {
  if (handleCors(request, response, ["POST"])) return;
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed." });
  try {
    const owner = await requireOwner(request); const payload = parseBody(request.body);
    const commerce = getCommerce();
    const id = requireString(payload.orderId, "Order is required.");
    const order = payload.action === "refund"
      ? await commerce.requestAmountRefund(id, { amountPaise: payload.amountPaise, requestId: payload.requestId, expectedRefundedAmountPaise: payload.expectedRefundedAmountPaise }, owner.uid)
      : payload.action === "reconcile" ? await commerce.reconcile(id) : await commerce.fulfilment(id, payload.action, owner.uid, { awbNumber: payload.awbNumber });
    response.json({ order });
  } catch (error) { response.status(getErrorStatus(error, 400)).json({ error: getErrorMessage(error, "Order action failed.") }); }
});

registerHttp("ownerProductAction", { region: REGION }, async (request, response) => {
  if (handleCors(request, response, ["POST"])) return;
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed." });
  try {
    const owner = await requireOwner(request);
    const payload = parseBody(request.body);
    const service = createProductService({ db, timestamp: () => admin.firestore.FieldValue.serverTimestamp() });
    if (payload.action !== undefined && payload.action !== "delete") throw new HttpError(400, "Unknown product action.");
    const result = payload.action === "delete" ? await service.remove(payload, owner.uid) : await service.save(payload, owner.uid);
    response.json(result);
  } catch (error) { response.status(getErrorStatus(error, 400)).json({ error: getErrorMessage(error, "Product action failed.") }); }
});

registerBackground("reconcileCheckoutOrders", onSchedule, { schedule: "every 5 minutes", region: REGION, secrets: [razorpayKeyIdSecret, razorpayKeySecretSecret] }, async () => {
  const commerce = getCommerce();
  const [expired, exceptions] = await Promise.all([
    db.collection(ORDER_COLLECTION).where("reservationState", "==", "held").where("reservationExpiresAt", "<=", Date.now()).limit(100).get(),
    db.collection(ORDER_COLLECTION).where("attentionRequired", "==", true).limit(100).get()
  ]);
  const ids = new Set([...expired.docs, ...exceptions.docs].map(doc => doc.id));
  for (const id of ids) {
    try { await commerce.reconcile(id); }
    catch (error) { logger.error("Order reconciliation needs retry", { orderId: id, message: getErrorMessage(error, "Reconciliation failed") }); }
  }
});

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

function normalizeRequestedItems(value) { return normalizeItems(value); }

function normalizeCustomer(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Delivery address is missing.");
  }

  return {
    address: requireString(value.address, "Address is required."),
    city: requireString(value.city, "City is required."),
    email: value.email == null || (typeof value.email === "string" && !value.email.trim()) ? "" : requireEmail(value.email),
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
    throw new HttpError(400, "Payment signature verification failed.");
  }
  const payment = await createRazorpayClient().payments.fetch(razorpayPaymentId);
  const commerce = getCommerce();
  let order = await commerce.recordPayment(internalOrderId, payment);
  if (order.refundStatus === "requested") {
    try { order = await commerce.refund(internalOrderId); }
    catch (error) { logger.error("Refund queued for retry", { internalOrderId }); }
  }
  return { orderData: order, paymentStatus: order.paymentStatus };
}

function buildOrderConfirmationPayload(internalOrderId, orderData, razorpayOrderId, razorpayPaymentId, paymentStatus) {
  const customer = orderData.customer || {};
  const summary = orderData.amountBreakdown || {};
  const cartItems = Array.isArray(orderData.cartItems) ? orderData.cartItems : [];

  return {
    createdAtIso: orderData.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
    userId: orderData.userId,
    refundStatus: orderData.refundStatus || null,
    attentionRequired: Boolean(orderData.attentionRequired),
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

function renderAppCallbackSuccessHtml({ confirmation }) {
  const destination = `/app/order-confirmation/?order=${encodeURIComponent(confirmation.internalOrderId)}`;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment status</title></head><body><p>Checking your order. Sign in with the same account to view its payment status.</p><a href="${destination}">View order</a><script>location.replace(${JSON.stringify(destination)});</script></body></html>`;
}
function renderAppCallbackFailureHtml({ message }) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Check payment status</title></head><body><p>${escapeHtml(message)}</p><p>If you paid, check your order before attempting another payment.</p><a href="/app/orders/">View orders</a></body></html>`;
}

async function handleWebhookEvent(payload) {
  const eventName = payload.event || "unknown";
  const payment = payload?.payload?.payment?.entity;
  const externalOrder = payload?.payload?.order?.entity;
  const refundEntity = payload?.payload?.refund?.entity;
  const commerce = getCommerce();
  if (refundEntity) {
    const matches = await db.collection(ORDER_COLLECTION).where("razorpayPaymentId", "==", refundEntity.payment_id).limit(1).get();
    if (matches.empty) throw new Error("Refund order association is not ready; retry webhook.");
    await commerce.recordRefund(matches.docs[0].id, refundEntity);
    return;
  }
  if (!["payment.captured", "payment.authorized", "payment.failed", "order.paid"].includes(eventName)) return;
  const ref = await findOrderReference(externalOrder?.notes?.internalOrderId || payment?.notes?.internalOrderId, externalOrder?.id || payment?.order_id);
  if (!ref) throw new Error("Payment order association is not ready; retry webhook.");
  // Fetch current provider state; signed old events never downgrade a capture.
  if (payment?.id) await commerce.recordPayment(ref.id, await createRazorpayClient().payments.fetch(payment.id));
  await commerce.reconcile(ref.id);
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
  const result = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(codeRef);
    if (!snapshot.exists) return { status: 400, message: "The verification code is invalid or has expired." };
    const current = snapshot.data();
    if (current.expiresAt <= Date.now()) {
      transaction.delete(codeRef);
      return { status: 400, message: "The verification code is invalid or has expired." };
    }
    if ((current.attemptCount || 0) >= OTP_MAX_VERIFY_ATTEMPTS) {
      return { status: 429, message: "Too many incorrect attempts. Please request a new code." };
    }
    if (!safeEqual(current.codeHash || "", hashVerificationCode(msisdn, otp))) {
      const count = (current.attemptCount || 0) + 1;
      transaction.update(codeRef, { attemptCount: count, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return { status: count >= OTP_MAX_VERIFY_ATTEMPTS ? 429 : 400, message: count >= OTP_MAX_VERIFY_ATTEMPTS ? "Too many incorrect attempts. Please request a new code." : "The verification code is invalid or has expired." };
    }
    transaction.delete(codeRef);
    return null;
  });
  if (result) throw new HttpError(result.status, result.message);
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
  if ((error instanceof HttpError || error instanceof CommerceError) && Number.isInteger(error.status)) {
    return error.status;
  }

  return fallback;
}
