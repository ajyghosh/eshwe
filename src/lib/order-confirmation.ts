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

export function downloadOrderReceipt(confirmation: OrderConfirmationData) {
  if (typeof window === "undefined") {
    return;
  }

  const receiptHtml = buildOrderReceiptHtml(confirmation, window.location.origin);
  const shortOrderId = buildShortOrderId(confirmation.internalOrderId);
  const printWindow = window.open("", "_blank", "width=940,height=1180");

  if (!printWindow) {
    const receiptBlob = new Blob([receiptHtml], { type: "text/html;charset=utf-8" });
    const receiptUrl = window.URL.createObjectURL(receiptBlob);
    const link = document.createElement("a");

    link.href = receiptUrl;
    link.download = `eshwe-order-receipt-${shortOrderId}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(receiptUrl);
    return;
  }

  printWindow.document.open();
  printWindow.document.write(receiptHtml);
  printWindow.document.close();

  try {
    printWindow.history.replaceState({}, "", `/order-confirmation/receipt/${encodeURIComponent(shortOrderId)}`);
  } catch {
    // Ignore history updates if the browser blocks them for the print window.
  }

  void waitForPrintWindowAssets(printWindow).finally(() => {
    printWindow.focus();
    printWindow.print();
  });
}

function buildOrderReceiptHtml(confirmation: OrderConfirmationData, origin: string) {
  const shortOrderId = buildShortOrderId(confirmation.internalOrderId);
  const placedAt = formatOrderConfirmationDateOnly(confirmation.createdAtIso);
  const itemRows = confirmation.items
    .map((item) => {
      const unitPrice = typeof item.unitPrice === "number" ? formatCurrency(item.unitPrice, confirmation.summary.currency) : "-";
      const lineTotal =
        typeof item.unitPrice === "number" ? formatCurrency(item.unitPrice * item.quantity, confirmation.summary.currency) : "-";

      return `
        <tr>
          <td>
            <strong>${escapeHtml(item.name)}</strong>
            <div class="sku">${escapeHtml(item.sku)}${item.color ? ` · ${escapeHtml(item.color)}` : ""}</div>
          </td>
          <td>${escapeHtml(String(item.quantity))}</td>
          <td>${escapeHtml(unitPrice)}</td>
          <td>${escapeHtml(lineTotal)}</td>
        </tr>
      `;
    })
    .join("");
  const summaryRows = `
    <tr class="summary-row summary-divider">
      <td colspan="3">Subtotal</td>
      <td class="summary-value">${escapeHtml(formatCurrency(confirmation.summary.subtotal, confirmation.summary.currency))}</td>
    </tr>
    <tr class="summary-row">
      <td colspan="3">Shipping</td>
      <td class="summary-value">${escapeHtml(formatCurrency(confirmation.summary.shippingFee, confirmation.summary.currency))}</td>
    </tr>
    <tr class="summary-row">
      <td colspan="3">Packaging</td>
      <td class="summary-value">${escapeHtml(formatCurrency(confirmation.summary.packagingFee, confirmation.summary.currency))}</td>
    </tr>
    <tr class="summary-row">
      <td colspan="3">Savings</td>
      <td class="summary-value">${escapeHtml(`-${formatCurrency(confirmation.summary.savings, confirmation.summary.currency)}`)}</td>
    </tr>
    <tr class="summary-row summary-total">
      <td colspan="3">Total</td>
      <td class="summary-value">${escapeHtml(formatCurrency(confirmation.summary.total, confirmation.summary.currency))}</td>
    </tr>
  `;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>eshwe-order-receipt-${escapeHtml(shortOrderId)}.pdf</title>
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
        width: 76px;
        height: 76px;
        border-radius: 22px;
        background: radial-gradient(circle at top, #fff8ed 0%, #f1dfbc 100%);
        border: 1px solid rgba(176, 111, 61, 0.16);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .logo img {
        width: 66px;
        height: 66px;
        display: block;
        object-fit: contain;
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
      tfoot td {
        padding: 10px 0;
      }
      .summary-row td {
        border-bottom: 0;
        color: #5c6550;
      }
      .summary-divider td {
        padding-top: 16px;
      }
      .summary-value {
        text-align: right;
      }
      .summary-total td {
        font-weight: 700;
        color: #2b2a29;
      }
      .footer {
        margin-top: 18px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 12px;
        font-size: 12px;
        color: #667056;
      }
      @page {
        margin: 14mm;
        size: A4;
      }
      .card,
      .header,
      .sheet,
      table,
      tr {
        break-inside: avoid;
        page-break-inside: avoid;
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
        .footer {
          margin-top: 14px;
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
              <img src="${escapeHtml(origin)}/eshwelogo-transparent.png" alt="Eshwe" width="66" height="66" />
            </div>
            <div>
              <div class="eyebrow">Order Confirmation</div>
              <h1>Receipt</h1>
            </div>
          </div>
          <div class="meta">
            <div><strong>Order ID:</strong> ${escapeHtml(confirmation.internalOrderId)}</div>
            <div><strong>Razorpay Order:</strong> ${escapeHtml(confirmation.razorpayOrderId)}</div>
            <div><strong>Payment ID:</strong> ${escapeHtml(confirmation.razorpayPaymentId)}</div>
          </div>
        </div>

        <div class="content">
          <div class="grid">
            <section class="card">
              <div class="card-title">Shipping To</div>
              <div><strong>${escapeHtml(confirmation.customer.fullName)}</strong></div>
              <div>${escapeHtml(confirmation.customer.address)}</div>
              <div>${escapeHtml(confirmation.customer.city)}, ${escapeHtml(confirmation.customer.state)} ${escapeHtml(
    confirmation.customer.pincode
  )}</div>
              <div>${escapeHtml(confirmation.customer.phone)}</div>
              <div>${escapeHtml(confirmation.customer.email)}</div>
            </section>

            <section class="card">
              <div class="card-title">Payment</div>
              <div><strong>Status:</strong> ${escapeHtml(formatOrderConfirmationPaymentStatus(confirmation.paymentStatus))}</div>
              <div><strong>Items:</strong> ${escapeHtml(String(confirmation.items.length))}</div>
              <div><strong>Currency:</strong> ${escapeHtml(confirmation.summary.currency)}</div>
              <div><strong>Customer Note:</strong> ${escapeHtml(confirmation.notes || "No note added")}</div>
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
                  ${itemRows}
                </tbody>
                <tfoot>
                  ${summaryRows}
                </tfoot>
              </table>
            </section>
          </div>

          <div class="footer">
            <div>eshwe.com</div>
            <div>${escapeHtml(placedAt)}</div>
          </div>
        </div>
      </div>
    </div>
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

function buildShortOrderId(orderId: string) {
  return orderId.slice(-8).toUpperCase();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function waitForPrintWindowAssets(printWindow: Window, timeoutMs = 1800) {
  const images = Array.from(printWindow.document.images);

  if (images.length === 0) {
    return Promise.resolve();
  }

  return Promise.race([
    Promise.all(
      images.map(
        (image) =>
          new Promise<void>((resolve) => {
            if (image.complete) {
              resolve();
              return;
            }

            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          })
      )
    ).then(() => undefined),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, timeoutMs);
    })
  ]);
}
