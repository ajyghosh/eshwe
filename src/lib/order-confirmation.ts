export type OrderConfirmationCustomer = {
  address: string;
  city: string;
  email: string;
  fullName: string;
  phone: string;
  pincode: string;
  state: string;
};

export type OrderConfirmationItem = {
  color?: string;
  name: string;
  primaryImageUrl?: string;
  quantity: number;
  sku: string;
  unitOriginalPrice?: number | null;
  unitPrice?: number | null;
};

export type OrderConfirmationSummary = {
  currency: string;
  packagingFee: number;
  savings: number;
  shippingFee: number;
  subtotal: number;
  total: number;
};

export type OrderConfirmationData = {
  createdAtIso: string;
  customer: OrderConfirmationCustomer;
  internalOrderId: string;
  items: OrderConfirmationItem[];
  notes: string;
  paymentStatus: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  summary: OrderConfirmationSummary;
};

const STORAGE_KEY = "eshwe.latestOrderConfirmation";

export function saveLatestOrderConfirmation(confirmation: OrderConfirmationData) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(confirmation));
}

export function readLatestOrderConfirmation() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as OrderConfirmationData;
  } catch {
    return null;
  }
}

export function formatOrderConfirmationDate(isoString: string) {
  const dateValue = new Date(isoString);

  if (Number.isNaN(dateValue.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(dateValue);
}

export function formatOrderConfirmationDateOnly(isoString: string) {
  const dateValue = new Date(isoString);

  if (Number.isNaN(dateValue.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium"
  }).format(dateValue);
}

export function formatOrderConfirmationPaymentStatus(status: string) {
  const normalizedStatus = status.trim().toLowerCase();

  if (normalizedStatus === "captured") {
    return "Paid";
  }

  if (normalizedStatus === "authorized") {
    return "Authorized";
  }

  if (normalizedStatus === "failed") {
    return "Failed";
  }

  return status;
}

export function formatOrderConfirmationId(internalOrderId: string) {
  const normalizedValue = internalOrderId.trim();

  if (!normalizedValue) {
    return "-";
  }

  return `#${normalizedValue.slice(0, 8).toUpperCase()}`;
}

export function openOrderReceiptPreview(confirmation: OrderConfirmationData) {
  if (typeof window === "undefined") {
    return;
  }

  const currentPath = window.location.pathname || "/";
  const isAppPath = currentPath.startsWith("/app");
  const returnHref = isAppPath ? "/app/orders/" : "/account/";
  const returnLabel = isAppPath ? "Back" : "Back to account";
  const previewWindow = window.open("", "_blank", "width=980,height=1200");

  if (!previewWindow) {
    return;
  }

  const receiptHtml = buildOrderReceiptHtml(confirmation, window.location.origin, returnHref, returnLabel, isAppPath);

  previewWindow.document.open();
  previewWindow.document.write(receiptHtml);
  previewWindow.document.close();
}

function buildOrderReceiptHtml(
  confirmation: OrderConfirmationData,
  origin: string,
  returnHref: string,
  returnLabel: string,
  isAppPath: boolean
) {
  const displayOrderId = formatOrderConfirmationId(confirmation.internalOrderId);
  const placedAt = formatOrderConfirmationDate(confirmation.createdAtIso);
  const noteValue = confirmation.notes.trim() ? escapeHtml(confirmation.notes) : "No note added";
  const paymentStatus = formatOrderConfirmationPaymentStatus(confirmation.paymentStatus.trim() || "pending");
  const itemCount = String(confirmation.items.length);
  const shareText = [
    "Eshwe order receipt",
    `Order ID: ${displayOrderId}`,
    `Razorpay order ID: ${confirmation.razorpayOrderId || "-"}`,
    `Payment ID: ${confirmation.razorpayPaymentId || "-"}`,
    `Placed: ${placedAt}`,
    `Payment status: ${paymentStatus}`,
    "",
    "Items:",
    ...confirmation.items.map((item) => {
      const lineTotal = typeof item.unitPrice === "number" ? item.unitPrice * item.quantity : null;
      return `• ${item.name} (${item.sku}) × ${item.quantity}${lineTotal === null ? "" : ` — ${formatCurrency(lineTotal, confirmation.summary.currency)}`}`;
    }),
    "",
    `Subtotal: ${formatCurrency(confirmation.summary.subtotal, confirmation.summary.currency)}`,
    `Shipping: ${formatCurrency(confirmation.summary.shippingFee, confirmation.summary.currency)}`,
    `Packaging: ${formatCurrency(confirmation.summary.packagingFee, confirmation.summary.currency)}`,
    `Savings: -${formatCurrency(confirmation.summary.savings, confirmation.summary.currency)}`,
    `Total paid: ${formatCurrency(confirmation.summary.total, confirmation.summary.currency)}`
  ].join("\n");
  const itemsMarkup = confirmation.items
    .map((item) => {
      const unitPrice =
        typeof item.unitPrice === "number" ? formatCurrency(item.unitPrice, confirmation.summary.currency) : "-";
      const lineTotal =
        typeof item.unitPrice === "number"
          ? formatCurrency(item.unitPrice * item.quantity, confirmation.summary.currency)
          : "-";
      const originalTotal =
        typeof item.unitOriginalPrice === "number" &&
        typeof item.unitPrice === "number" &&
        item.unitOriginalPrice > item.unitPrice
          ? formatCurrency(item.unitOriginalPrice * item.quantity, confirmation.summary.currency)
          : "";

      return `
        <tr>
          <td>
            <strong>${escapeHtml(item.name)}</strong>
            <div class="sku">${escapeHtml(item.sku)}${item.color ? ` · ${escapeHtml(item.color)}` : ""}</div>
          </td>
          <td>${escapeHtml(String(item.quantity))}</td>
          <td>${escapeHtml(unitPrice)}</td>
          <td>
            <strong>${escapeHtml(lineTotal)}</strong>
            ${originalTotal ? `<div class="strike">${escapeHtml(originalTotal)}</div>` : ""}
          </td>
        </tr>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Order Receipt ${escapeHtml(displayOrderId)}</title>
    <style>
      :root {
        color-scheme: light;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background: #f7efdf;
        color: #2b2a29;
        font: 15px/1.6 "Avenir Next", "Segoe UI", sans-serif;
      }
      .page {
        max-width: 920px;
        margin: 0 auto;
        padding: 28px 20px 40px;
      }
      .sheet {
        background: #fffaf2;
        border: 1px solid #dfd2bd;
        border-radius: 28px;
        box-shadow: 0 28px 70px rgba(94, 104, 79, 0.12);
        overflow: hidden;
      }
      .toolbar-button {
        appearance: none;
        border: 1px solid #d7ccb9;
        border-radius: 999px;
        background: rgba(255, 250, 242, 0.92);
        color: #4f5942;
        cursor: pointer;
        font: 600 12px/1 "Avenir Next", "Segoe UI", sans-serif;
        letter-spacing: 0.14em;
        padding: 13px 18px;
        text-transform: uppercase;
      }
      .toolbar-button.primary {
        background: #5e684f;
        border-color: #5e684f;
        color: #fbf4e8;
      }
      .receipt-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid #e7dccb;
      }
      .header {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        padding: 28px;
        background: linear-gradient(135deg, #fff7eb 0%, #f2e4ca 100%);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .logo {
        width: 58px;
        height: 58px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.8);
        border: 1px solid rgba(94, 104, 79, 0.12);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .logo img {
        width: 42px;
        height: 42px;
      }
      .eyebrow {
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #7d876f;
      }
      h1 {
        margin: 6px 0 0;
        font: 400 32px/1.1 Georgia, serif;
      }
      .meta {
        text-align: right;
        font-size: 13px;
        color: #667056;
      }
      .content {
        padding: 28px;
      }
      .grid {
        display: grid;
        gap: 18px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .card {
        border: 1px solid #e7dccb;
        border-radius: 20px;
        padding: 18px;
        background: #ffffff;
      }
      .card.wide {
        grid-column: 1 / -1;
      }
      .card-title {
        margin-bottom: 10px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #7d876f;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        padding: 12px 0;
        border-bottom: 1px solid #efe5d7;
        text-align: left;
        vertical-align: top;
      }
      th {
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #7d876f;
      }
      .sku {
        margin-top: 4px;
        font-size: 12px;
        color: #667056;
      }
      .strike {
        margin-top: 4px;
        font-size: 12px;
        color: #8d8b87;
        text-decoration: line-through;
      }
      .summary-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 7px 0;
      }
      .summary-total {
        margin-top: 10px;
        padding-top: 12px;
        border-top: 1px solid #dfd2bd;
        font-weight: 700;
      }
      .footer {
        margin-top: 18px;
        font-size: 12px;
        color: #667056;
      }
      @media (max-width: 699px) {
        .toolbar-button {
          flex: 1 1 calc(50% - 5px);
          text-align: center;
        }
        .header {
          flex-direction: column;
        }
        .meta {
          text-align: left;
        }
        .grid {
          grid-template-columns: 1fr;
        }
        .receipt-actions .toolbar-button {
          flex: 1 1 calc(50% - 5px);
          text-align: center;
        }
      }
      @media print {
        body {
          background: #ffffff;
        }
        .page {
          max-width: none;
          padding: 0;
        }
        .sheet {
          border-radius: 0;
          box-shadow: none;
        }
        .toolbar,
        .receipt-actions {
          display: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="sheet">
        <div class="header">
          <div class="brand">
            <div class="logo">
              <img src="${escapeHtml(origin)}/eshwelogo-transparent.png" alt="Eshwe" width="42" height="42" />
            </div>
            <div>
              <div class="eyebrow">Order Confirmation</div>
              <h1>Receipt</h1>
            </div>
          </div>
          <div class="meta">
            <div><strong>Order ID:</strong> ${escapeHtml(displayOrderId)}</div>
            <div><strong>Razorpay Order:</strong> ${escapeHtml(confirmation.razorpayOrderId || "-")}</div>
            <div><strong>Payment ID:</strong> ${escapeHtml(confirmation.razorpayPaymentId || "-")}</div>
            <div><strong>Placed:</strong> ${escapeHtml(placedAt)}</div>
          </div>
        </div>

        <div class="content">
          <div class="grid">
            <section class="card">
              <div class="card-title">Shipping To</div>
              <div><strong>${escapeHtml(confirmation.customer.fullName)}</strong></div>
              <div>${escapeHtml(confirmation.customer.address)}</div>
              <div>${escapeHtml(confirmation.customer.city)}, ${escapeHtml(confirmation.customer.state)} ${escapeHtml(confirmation.customer.pincode)}</div>
              <div>${escapeHtml(confirmation.customer.phone)}</div>
              <div>${escapeHtml(confirmation.customer.email)}</div>
            </section>

            <section class="card">
              <div class="card-title">Payment</div>
              <div><strong>Status:</strong> ${escapeHtml(paymentStatus)}</div>
              <div><strong>Items:</strong> ${escapeHtml(itemCount)}</div>
              <div><strong>Currency:</strong> ${escapeHtml(confirmation.summary.currency)}</div>
              <div><strong>Customer Note:</strong> ${noteValue}</div>
            </section>

            <section class="card wide">
              <div class="card-title">Order Items</div>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsMarkup}
                </tbody>
              </table>
            </section>

            <section class="card">
              <div class="card-title">Summary</div>
              <div class="summary-row"><span>Subtotal</span><strong>${escapeHtml(formatCurrency(confirmation.summary.subtotal, confirmation.summary.currency))}</strong></div>
              <div class="summary-row"><span>Shipping</span><strong>${escapeHtml(formatCurrency(confirmation.summary.shippingFee, confirmation.summary.currency))}</strong></div>
              <div class="summary-row"><span>Packaging</span><strong>${escapeHtml(formatCurrency(confirmation.summary.packagingFee, confirmation.summary.currency))}</strong></div>
              <div class="summary-row"><span>Savings</span><strong>${escapeHtml(`-${formatCurrency(confirmation.summary.savings, confirmation.summary.currency)}`)}</strong></div>
              <div class="summary-row summary-total"><span>Total</span><strong>${escapeHtml(formatCurrency(confirmation.summary.total, confirmation.summary.currency))}</strong></div>
            </section>
          </div>

          <div class="footer">
            ${isAppPath
              ? "Share a complete PDF copy of this receipt directly from your phone."
              : "Keep this receipt for your records. You can print this file directly from your browser."}
          </div>

          <div class="receipt-actions">
            ${isAppPath
              ? `
            <button class="toolbar-button" type="button" onclick="shareReceipt()">Share</button>`
              : `
            <button class="toolbar-button" type="button" onclick="window.print()">Print receipt</button>`}
            <button class="toolbar-button primary" type="button" onclick="goBackToStore()">${escapeHtml(returnLabel)}</button>
          </div>
        </div>
      </div>
    </div>
    <script>
      async function shareReceipt() {
        const shareData = {
          title: ${JSON.stringify(`Eshwe Receipt ${displayOrderId}`)},
          text: ${JSON.stringify(shareText)}
        };
        try {
          if (navigator.share) {
            await navigator.share(shareData);
            return;
          }
        } catch (error) {
          if (error && error.name === "AbortError") {
            return;
          }
        }

        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(shareData.text);
            window.alert("Receipt details copied. You can paste and share them now.");
            return;
          }
        } catch (error) {}

        window.print();
      }

      function goBackToStore() {
        const fallbackHref = ${JSON.stringify(returnHref)};

        try {
          if (window.opener && !window.opener.closed) {
            window.close();
            window.setTimeout(function () {
              window.location.href = fallbackHref;
            }, 120);
            return;
          }
        } catch (error) {}

        if (window.history.length > 1) {
          window.history.back();
          return;
        }

        window.location.href = fallbackHref;
      }
    </script>
  </body>
</html>`;
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(amount);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
