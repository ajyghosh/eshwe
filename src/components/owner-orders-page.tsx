"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";

import { OwnerBackofficeNav } from "@/components/owner-backoffice-nav";
import { OwnerSectionHero } from "@/components/owner-section-hero";
import {
  isPrimaryOwnerEmail,
  normalizeEmail,
  signInAsOwner,
  signOutOwner,
  subscribeToAuth
} from "@/lib/auth";
import { firebaseReady } from "@/lib/firebase";
import {
  normalizeOwnerEmail,
  subscribeToOwnerAccounts,
  type OwnerAccount
} from "@/lib/owner-access";
import { useOwnerBackofficeBadges } from "@/lib/use-owner-backoffice-badges";
import { subscribeToSuccessfulOrders, updateOrderDispatchStatus } from "@/lib/orders";
import type { CheckoutOrder } from "@/types/order";

function waitForPrintWindowAssets(printWindow: Window, timeoutMs = 1600) {
  const images = Array.from(printWindow.document.images);

  if (images.length === 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      resolve();
    };

    const pendingImages = images.filter((image) => !image.complete);

    if (pendingImages.length === 0) {
      finish();
      return;
    }

    let remaining = pendingImages.length;

    const markDone = () => {
      remaining -= 1;

      if (remaining <= 0) {
        finish();
      }
    };

    pendingImages.forEach((image) => {
      image.addEventListener("load", markDone, { once: true });
      image.addEventListener("error", markDone, { once: true });
    });

    window.setTimeout(finish, timeoutMs);
  });
}

export function OwnerOrdersPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [ownerAccounts, setOwnerAccounts] = useState<OwnerAccount[]>([]);
  const [ownerAccountsLoading, setOwnerAccountsLoading] = useState(true);
  const [orders, setOrders] = useState<CheckoutOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [ownerAccessError, setOwnerAccessError] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState("");

  useEffect(() => {
    return subscribeToAuth((nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setOwnerAccounts([]);
      setOwnerAccountsLoading(false);
      setOwnerAccessError(null);
      return;
    }

    setOwnerAccountsLoading(true);

    return subscribeToOwnerAccounts(
      (nextOwners) => {
        setOwnerAccounts(nextOwners);
        setOwnerAccountsLoading(false);
      },
      (error) => {
        setOwnerAccounts([]);
        setOwnerAccountsLoading(false);
        setOwnerAccessError(error.message);
      }
    );
  }, [user]);

  const normalizedUserEmail = normalizeEmail(user?.email);
  const ownerAuthorized =
    isPrimaryOwnerEmail(user?.email) ||
    ownerAccounts.some((owner) => normalizeOwnerEmail(owner.email) === normalizedUserEmail);
  const { badges: navBadges } = useOwnerBackofficeBadges(ownerAuthorized);

  useEffect(() => {
    if (!user || !ownerAuthorized) {
      setOrders([]);
      setOrdersLoading(false);
      setOrdersError(null);
      return;
    }

    setOrdersLoading(true);

    return subscribeToSuccessfulOrders(
      (nextOrders) => {
        setOrders(nextOrders);
        setOrdersLoading(false);
      },
      (error) => {
        setOrders([]);
        setOrdersLoading(false);
        setOrdersError(error.message);
      }
    );
  }, [ownerAuthorized, user]);

  async function handleSignIn() {
    setAuthError(null);

    try {
      await signInAsOwner();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google sign-in failed.");
    }
  }

  async function handleSignOut() {
    await signOutOwner();
    router.replace("/owner");
  }

  function handleViewSlip(orderId: string) {
    const order = orders.find((item) => item.id === orderId);

    if (!order) {
      return;
    }

    const viewWindow = window.open("", "_blank", "width=960,height=1200");

    if (!viewWindow) {
      setActionError("Enable pop-ups to open the slip.");
      return;
    }

    const origin = window.location.origin;
    const html = buildOwnerSlipPrintHtml(order, origin);

    viewWindow.document.open();
    viewWindow.document.write(html);
    viewWindow.document.close();

    try {
      viewWindow.history.replaceState({}, "", `/owner/orders/print/${orderId}`);
    } catch {
      // Ignore history updates if the browser blocks them for the preview window.
    }
  }

  function handlePrintOrder(orderId: string, mode: "order" | "address") {
    const order = orders.find((item) => item.id === orderId);

    if (!order) {
      return;
    }

    const printWindow = window.open("", "_blank", "width=960,height=1200");

    if (!printWindow) {
      setActionError("Enable pop-ups to print the slip.");
      return;
    }

    const origin = window.location.origin;
    const html =
      mode === "address" ? buildOwnerAddressPrintHtml(order, origin) : buildOwnerSlipPrintHtml(order, origin);

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    try {
      const printPath = mode === "address" ? `/owner/orders/address/${orderId}` : `/owner/orders/print/${orderId}`;
      printWindow.history.replaceState({}, "", printPath);
    } catch {
      // Ignore history updates if the browser blocks them for the print window.
    }

    void waitForPrintWindowAssets(printWindow).finally(() => {
      printWindow.focus();
      printWindow.print();
    });
  }

  async function handleMarkComplete(orderId: string) {
    setActionError(null);
    setUpdatingOrderId(orderId);

    try {
      await updateOrderDispatchStatus(orderId, "completed");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to update dispatch status.");
    } finally {
      setUpdatingOrderId("");
    }
  }

  if (!firebaseReady) {
    return (
      <main className="min-h-screen bg-[#fbf4e8] px-6 py-20 text-[#4f5942] sm:px-10 lg:px-12">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8">
          <h1 className="brand-copy text-3xl text-[#3f4738]">Firebase configuration missing</h1>
          <p className="mt-4 text-sm leading-7 text-[#667056]">
            Add your `NEXT_PUBLIC_FIREBASE_*` variables before using the owner backoffice.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbf4e8] px-6 py-12 text-[#4f5942] sm:px-10 lg:px-12 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-7xl print:max-w-none">
        <OwnerSectionHero
          eyebrow="OWNER ORDERS"
          title="Successful orders and print slips"
          description="Open confirmed orders, print the order slip or address label, and mark dispatched orders complete."
          className="print:hidden"
          action={
            user ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="brand-caption rounded-2xl bg-[#f8ecd2] px-5 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#5a6851]"
              >
                SIGN OUT
              </button>
            ) : null
          }
        />

        {ownerAuthorized ? (
          <OwnerBackofficeNav className="mt-6 print:hidden" badges={navBadges} />
        ) : null}

        {authLoading || (user && !isPrimaryOwnerEmail(user?.email) && ownerAccountsLoading) ? (
          <div className="mt-10 rounded-[1.8rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8 text-sm text-[#667056] print:hidden">
            Checking Google session…
          </div>
        ) : !ownerAuthorized ? (
          <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] print:hidden">
            <section className="rounded-[1.8rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8">
              <h2 className="brand-copy text-3xl text-[#3f4738]">Sign in to view orders</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#667056]">
                Use Google login with an authorized owner account to open paid orders and print slips.
              </p>
              {user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="brand-caption mt-8 inline-flex rounded-2xl border border-[#cfc2ad] px-6 py-3 text-[0.66rem] font-semibold tracking-[0.08em] text-[#5e684f]"
                >
                  SIGN OUT
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="brand-caption mt-8 inline-flex rounded-2xl bg-[#5e684f] px-6 py-3 text-[0.66rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
                >
                  SIGN IN WITH GOOGLE
                </button>
              )}
              {authError ? <p className="mt-4 text-sm text-[#9d4b45]">{authError}</p> : null}
              {ownerAccessError ? <p className="mt-4 text-sm text-[#9d4b45]">{ownerAccessError}</p> : null}
              {user && !ownerAuthorized ? (
                <p className="mt-4 text-sm text-[#9d4b45]">
                  {user.email} is signed in, but does not have owner access.
                </p>
              ) : null}
            </section>

            <aside className="rounded-[1.8rem] border border-[#e3d8c9] bg-white/70 p-8">
              <h3 className="brand-copy text-2xl text-[#3f4738]">Orders notes</h3>
              <ul className="mt-5 space-y-3 text-sm leading-7 text-[#667056]">
                <li>This section shows successful paid orders from Razorpay checkout.</li>
                <li>New orders stay at the top until they are marked complete.</li>
                <li>Use `Print Slip` for the box and `Print Address` for the outer cover label.</li>
              </ul>
            </aside>
          </div>
        ) : (
          <>
            <div className="mt-10 print:hidden">
              <section className="rounded-[1.8rem] border border-[#e3d8c9] bg-white/70 p-7 sm:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="brand-copy text-2xl text-[#3f4738]">Paid orders</h2>
                    <p className="mt-2 text-sm leading-7 text-[#667056]">
                      Clean queue for viewing slips, printing address labels, and marking dispatch.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#f8f0e3] px-4 py-2 text-xs font-semibold text-[#5e684f]">
                    {orders.length} order{orders.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-6">
                  {ordersError ? <p className="text-sm text-[#9d4b45]">{ordersError}</p> : null}
                  {actionError ? <p className="mt-2 text-sm text-[#9d4b45]">{actionError}</p> : null}
                  {ordersLoading ? (
                    <p className="text-sm text-[#667056]">Loading successful orders…</p>
                  ) : orders.length === 0 ? (
                    <div className="rounded-[1.3rem] border border-dashed border-[#d8cbb7] bg-[#fbf4e8] p-5 text-sm leading-7 text-[#667056]">
                      No successful orders yet.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-[1.5rem] border border-[#e3d8c9] bg-[#fffaf1]">
                      <div className="hidden grid-cols-[1.1fr_1fr_0.95fr_1.2fr_1.55fr_0.8fr] gap-4 border-b border-[#e8dccd] bg-[#f6edde] px-5 py-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#7d876f] lg:grid">
                        <span>Name</span>
                        <span>Order ID</span>
                        <span>Phone</span>
                        <span>Email</span>
                        <span>Actions</span>
                        <span>Status</span>
                      </div>

                      <div className="divide-y divide-[#ece1d3]">
                        {orders.map((order) => (
                          <article
                            key={order.id}
                            className="grid gap-4 px-5 py-5 text-sm text-[#4f5942] lg:grid-cols-[1.1fr_1fr_0.95fr_1.2fr_1.55fr_0.8fr] lg:items-center"
                          >
                            <div>
                              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8a836f] lg:hidden">
                                Name
                              </p>
                              <p className="font-semibold text-[#2b2a29]">
                                {order.customer?.fullName || "Customer"}
                              </p>
                            </div>

                            <div>
                              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8a836f] lg:hidden">
                                Order ID
                              </p>
                              <p>Order ID {shortOrderId(order.id)}</p>
                            </div>

                            <div>
                              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8a836f] lg:hidden">
                                Phone
                              </p>
                              <p>{order.customer?.phone || "NA"}</p>
                            </div>

                            <div className="min-w-0">
                              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8a836f] lg:hidden">
                                Email
                              </p>
                              <p className="truncate">{order.customer?.email || "NA"}</p>
                            </div>

                            <div>
                              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8a836f] lg:hidden">
                                Actions
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleViewSlip(order.id)}
                                  className="brand-caption inline-flex rounded-full border border-[#d6ccb9] bg-white/80 px-3 py-1.5 text-[0.5rem] font-semibold tracking-[0.08em] text-[#4f5942]"
                                >
                                  VIEW SLIP
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePrintOrder(order.id, "address")}
                                  className="brand-caption inline-flex rounded-full border border-[#cbbda5] bg-[#fff8eb] px-3 py-1.5 text-[0.5rem] font-semibold tracking-[0.08em] text-[#5e684f]"
                                >
                                  PRINT ADDRESS
                                </button>
                              </div>
                            </div>

                            <div>
                              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8a836f] lg:hidden">
                                Status
                              </p>
                              {order.dispatchStatus === "completed" ? (
                                <span className="inline-flex rounded-full bg-[#e6efe1] px-3 py-1.5 text-[0.68rem] font-semibold text-[#48603f]">
                                  DISPATCHED
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleMarkComplete(order.id)}
                                  disabled={updatingOrderId === order.id}
                                  className="brand-caption inline-flex rounded-full border border-[#7d876f] px-3 py-1.5 text-[0.5rem] font-semibold tracking-[0.08em] text-[#5e684f] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {updatingOrderId === order.id ? "UPDATING..." : "MARK COMPLETE"}
                                </button>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function shortOrderId(orderId: string) {
  return orderId.slice(0, 8).toUpperCase();
}

function formatTimestamp(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value) || typeof value.toDate !== "function") {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value.toDate());
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value || 0);
}

function formatPaymentMethod(value?: string | null) {
  if (!value) {
    return "Razorpay";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildAddressLines(order: CheckoutOrder) {
  const customer = order.customer;

  if (!customer) {
    return ["Address details unavailable."];
  }

  return [
    customer.address,
    `${customer.city}, ${customer.state} - ${customer.pincode}`,
    customer.phone,
    customer.email
  ].filter(Boolean);
}

function buildShippingLabelLines(order: CheckoutOrder) {
  const customer = order.customer;

  if (!customer) {
    return ["Address details unavailable."];
  }

  return [
    customer.address,
    customer.city,
    `${customer.state} - ${customer.pincode}`
  ].filter(Boolean);
}

function buildOwnerSlipPrintHtml(order: CheckoutOrder, origin: string) {
  const shortId = shortOrderId(order.id);
  const itemCount = order.cartItems?.length || 0;
  const orderNote = order.notes?.trim() || "No customer note added for this order.";
  const placedAt = formatTimestamp(order.createdAt);

  const itemRows = (order.cartItems || [])
    .map(
      (item) => `
        <div class="item-row">
          <div>
            <div class="item-name">${escapeHtml(item.name)}</div>
            <div class="item-sub">SKU ${escapeHtml(item.sku)}${item.color ? ` · ${escapeHtml(item.color)}` : ""}</div>
          </div>
          <div class="item-meta">
            <div>Qty ${item.quantity}</div>
            <div class="item-price">${escapeHtml(formatCurrency(item.unitPrice))}</div>
          </div>
        </div>
      `
    )
    .join("");
  const summaryRows = `
    <div class="summary-row summary-divider">
      <span>Subtotal</span>
      <strong>${escapeHtml(formatCurrency(order.amountBreakdown?.subtotal))}</strong>
    </div>
    <div class="summary-row">
      <span>Shipping</span>
      <strong>${escapeHtml(formatCurrency(order.amountBreakdown?.shippingFee))}</strong>
    </div>
    <div class="summary-row">
      <span>Packaging</span>
      <strong>${escapeHtml(formatCurrency(order.amountBreakdown?.packagingFee))}</strong>
    </div>
    <div class="summary-row summary-total">
      <span>Total</span>
      <strong>${escapeHtml(formatCurrency(order.amountBreakdown?.total))}</strong>
    </div>
  `;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>eshwe-dispatch-slip-${escapeHtml(shortId)}.pdf</title>
    <style>
      @page {
        margin: 16mm;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background: #ffffff;
        color: #344132;
        font-family: Arial, Helvetica, sans-serif;
      }
      .sheet {
        width: 100%;
        max-width: 920px;
        margin: 0 auto;
        border: 1px solid #d9ccb8;
        border-radius: 28px;
        background: #fffdf9;
        overflow: hidden;
      }
      .content {
        padding: 24px;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 20px;
        padding-bottom: 18px;
        border-bottom: 1px solid #d9ccb8;
      }
      .header-left {
        display: flex;
        align-items: flex-start;
        gap: 14px;
      }
      .logo-box {
        border: 1px solid #e0d2bf;
        border-radius: 16px;
        padding: 10px;
        background: #fbf4e8;
      }
      .brand {
        font-size: 10px;
        letter-spacing: 0.24em;
        color: #7d876f;
        text-transform: uppercase;
      }
      .title {
        margin: 8px 0 0;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 24px;
        line-height: 1.1;
        color: #2b2a29;
      }
      .sub {
        margin-top: 8px;
        font-size: 13px;
        color: #667056;
      }
      .header-right {
        text-align: right;
      }
      .status {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.14em;
        color: #2b2a29;
        text-transform: uppercase;
      }
      .order-ref {
        margin-top: 10px;
        font-size: 15px;
        font-weight: 700;
        color: #2b2a29;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
        margin-top: 18px;
      }
      .panel {
        border: 1px solid #eadfce;
        border-radius: 20px;
        background: #fffdf9;
        padding: 16px 18px;
      }
      .panel-title {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.2em;
        color: #2b2a29;
        text-transform: uppercase;
      }
      .panel-body {
        margin-top: 12px;
        font-size: 14px;
        line-height: 1.7;
        color: #4f5942;
      }
      .panel-body strong {
        color: #2b2a29;
      }
      .spaced > div + div {
        margin-top: 6px;
      }
      .wide {
        grid-column: 1 / -1;
      }
      .items-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid #eadfce;
      }
      .muted {
        font-size: 12px;
        color: #667056;
      }
      .item-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 0;
        border-bottom: 1px solid #f0e7da;
      }
      .item-row:last-child {
        border-bottom: 0;
        padding-bottom: 0;
      }
      .item-name {
        font-size: 15px;
        font-weight: 700;
        color: #2b2a29;
      }
      .item-sub {
        margin-top: 5px;
        font-size: 12px;
        color: #667056;
      }
      .item-meta {
        text-align: right;
        font-size: 14px;
        color: #4f5942;
      }
      .item-price {
        margin-top: 4px;
      }
      .items-summary {
        margin-top: 10px;
        padding-top: 14px;
      }
      .summary-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 5px 0;
      }
      .summary-divider {
        padding-top: 2px;
      }
      .summary-total {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #eadfce;
        font-weight: 700;
        color: #2b2a29;
      }
      .note-block {
        padding: 4px 2px 0;
      }
      .footer {
        margin-top: 18px;
        padding-top: 12px;
        border-top: 1px solid #d9ccb8;
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 12px;
        color: #667056;
      }
      @media print {
        body {
          background: #ffffff;
        }
        .sheet {
          border-radius: 0;
        }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="content">
        <div class="header">
          <div class="header-left">
            <div class="logo-box">
              <img src="${escapeHtml(origin)}/eshwelogo-transparent.png" alt="Eshwe" width="46" height="46" />
            </div>
            <div>
              <div class="brand">Eshwe Saree Studio</div>
              <h1 class="title">Order Dispatch Slip</h1>
            </div>
          </div>
          <div class="header-right">
            <div class="status">Paid Order</div>
            <div class="order-ref">${escapeHtml(shortId)}</div>
          </div>
        </div>

        <div class="grid">
          <section class="panel">
            <div class="panel-title">Ship To</div>
            <div class="panel-body spaced">
              <div><strong>${escapeHtml(order.customer?.fullName || "Customer")}</strong></div>
              ${buildAddressLines(order)
                .map((line) => `<div>${escapeHtml(line)}</div>`)
                .join("")}
            </div>
          </section>

          <section class="panel">
            <div class="panel-title">Order Details</div>
            <div class="panel-body spaced">
              <div><strong>Order ID:</strong> ${escapeHtml(order.id)}</div>
              ${
                order.razorpayOrderId
                  ? `<div><strong>Razorpay Order:</strong> ${escapeHtml(order.razorpayOrderId)}</div>`
                  : ""
              }
              <div><strong>Payment:</strong> ${escapeHtml(formatPaymentMethod(order.paymentMethod))}</div>
              <div><strong>Amount:</strong> ${escapeHtml(formatCurrency(order.amountBreakdown?.total))}</div>
              <div><strong>Status:</strong> ${escapeHtml(formatPrintStatus(order))}</div>
            </div>
          </section>

          <section class="panel wide">
            <div class="items-head">
              <div class="panel-title">Order Items</div>
              <div class="muted">${itemCount} item${itemCount === 1 ? "" : "s"}</div>
            </div>
            <div class="panel-body">
              ${itemRows || `<div class="muted">No items available for this order.</div>`}
              ${itemRows ? `<div class="items-summary">${summaryRows}</div>` : ""}
            </div>
          </section>

          <section class="note-block">
            <div class="panel-title">Order Note</div>
            <div class="panel-body">${escapeHtml(orderNote)}</div>
          </section>
        </div>

        <div class="footer">
          <div>eshwe.com</div>
          <div>${escapeHtml(placedAt)}</div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function buildOwnerAddressPrintHtml(order: CheckoutOrder, origin: string) {
  const labelLines = buildShippingLabelLines(order);
  const shortId = shortOrderId(order.id);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>eshwe-address-label-${escapeHtml(shortId)}.pdf</title>
    <style>
      @page {
        size: 4in 6in;
        margin: 0;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background: #ffffff;
        color: #1f1f1f;
        font-family: Arial, Helvetica, sans-serif;
      }
      .label {
        width: 4in;
        min-height: 6in;
        padding: 0.2in 0.22in;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .topbar {
        display: block;
      }
      .eyebrow {
        font-size: 10px;
        letter-spacing: 0.22em;
        color: #6b745d;
        text-transform: uppercase;
        font-weight: 700;
      }
      .name {
        margin-top: 0.16in;
        font-size: 28px;
        font-weight: 700;
        line-height: 1.08;
      }
      .line {
        margin-top: 0.08in;
        font-size: 20px;
        line-height: 1.35;
      }
      .phone {
        margin-top: 0.18in;
        font-size: 20px;
        font-weight: 700;
      }
      .site {
        margin-top: 0.16in;
        font-size: 13px;
        letter-spacing: 0.16em;
        color: #6b745d;
        text-transform: uppercase;
      }
      .footer {
        margin-top: 0.24in;
        padding-top: 0.14in;
        border-top: 1px solid #dddddd;
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }
      .footer-label {
        font-size: 10px;
        letter-spacing: 0.14em;
        color: #666666;
        text-transform: uppercase;
      }
      .footer-value {
        margin-top: 4px;
        font-size: 13px;
        font-weight: 700;
      }
      .footer-qr {
        width: 0.82in;
        height: 0.82in;
        border: 1px solid #d8d8d8;
        border-radius: 8px;
        background: #ffffff;
        padding: 4px;
        object-fit: contain;
      }
      @media print {
        html, body {
          width: 4in;
          height: 6in;
        }
      }
    </style>
  </head>
  <body>
    <div class="label">
      <div>
        <div class="topbar">
          <div class="eyebrow">Deliver To</div>
        </div>
        <div class="name">${escapeHtml(order.customer?.fullName || "Customer")}</div>
        ${labelLines.map((line) => `<div class="line">${escapeHtml(line)}</div>`).join("")}
        ${
          order.customer?.phone
            ? `<div class="phone">${escapeHtml(order.customer.phone)}</div>`
            : ""
        }
        <div class="site">eshwe.com</div>
      </div>
      <div class="footer">
        <div>
          <img src="${escapeHtml(origin)}/eshweqr.png" alt="Eshwe QR" class="footer-qr" />
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <div>
            <div class="footer-label">Order ID</div>
            <div class="footer-value">${escapeHtml(shortOrderId(order.id))}</div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function formatPrintStatus(order: CheckoutOrder) {
  if (order.dispatchStatus === "completed") {
    return "Dispatched";
  }

  if (order.paymentStatus === "captured" || order.status === "paid" || order.paymentCaptured === true) {
    return "Success";
  }

  return "Pending";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
