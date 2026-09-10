"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuthSession } from "@/components/auth-provider";
import { useCart } from "@/components/cart-provider";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { buildReorderSelections, subscribeToCustomerOrders } from "@/lib/orders";
import { openOrderReceiptPreview, type OrderConfirmationData } from "@/lib/order-confirmation";
import { subscribeToSarees } from "@/lib/sarees";
import type { CheckoutOrder } from "@/types/order";
import type { Saree } from "@/types/saree";

export function CustomerOrdersPage() {
  const router = useRouter();
  const { user, loading, signIn } = useAuthSession();
  const { addItem } = useCart();
  const [orders, setOrders] = useState<CheckoutOrder[]>([]);
  const [catalogueProducts, setCatalogueProducts] = useState<Saree[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setOrders([]);
      setOrdersLoading(false);
      setOrdersError(null);
      return;
    }

    setOrdersLoading(true);
    setOrdersError(null);

    return subscribeToCustomerOrders(
      user.uid,
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
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setCatalogueProducts([]);
      return;
    }

    return subscribeToSarees(
      (nextProducts) => setCatalogueProducts(nextProducts.filter((product) => product.status !== "draft")),
      { status: ["active", "out_of_stock"] },
      () => setCatalogueProducts([])
    );
  }, [user?.uid]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => setMessage(null), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  function handleShopAgain(order: CheckoutOrder) {
    const selections = buildReorderSelections(order, catalogueProducts);

    if (selections.length === 0) {
      setMessage(null);
      setOrdersError("These items are no longer available to add back into the cart.");
      return;
    }

    selections.forEach(({ product, quantity }) => addItem(product, quantity));
    const totalAdded = selections.reduce((total, selection) => total + selection.quantity, 0);
    setOrdersError(null);
    setMessage(`${totalAdded} item${totalAdded === 1 ? "" : "s"} added to cart.`);
    router.push("/shop");
  }

  return (
    <div className="web-storefront min-h-screen bg-[#fbf4e8] text-[#2b2a29]">
      <StorefrontHeader />

      <main className="px-6 py-10 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">MY ORDERS</p>
              <h1 className="brand-copy mt-3 text-3xl leading-tight text-[#2b2a29] sm:text-[2.8rem]">Order history</h1>
              <p className="mt-3 text-sm leading-7 text-[#667056]">Track and revisit orders linked to your account.</p>
            </div>
            {user ? (
              <span className="rounded-full bg-white/72 px-4 py-2 text-xs font-semibold text-[#5e684f]">{orders.length}</span>
            ) : null}
          </div>

          {loading ? (
            <section className="rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8 text-sm text-[#667056] shadow-[0_22px_60px_rgba(94,104,79,0.08)]">Checking your account...</section>
          ) : !user ? (
            <section className="rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8 shadow-[0_22px_60px_rgba(94,104,79,0.08)]">
              <h2 className="brand-copy text-3xl text-[#2b2a29]">Sign in to view your orders</h2>
              <p className="mt-4 text-sm leading-7 text-[#667056]">Use the account you used at checkout to see your order history.</p>
              <button
                type="button"
                onClick={() => void signIn()}
                className="brand-caption mt-8 inline-flex rounded-2xl bg-[#5e684f] px-6 py-3 text-[0.66rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
              >
                CONTINUE WITH SMS
              </button>
            </section>
          ) : (
            <section className="rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-6 shadow-[0_22px_60px_rgba(94,104,79,0.08)] sm:p-8">
              {ordersError ? <p className="mb-4 text-sm text-[#9d4b45]">{ordersError}</p> : null}
              {message ? <p className="mb-4 text-sm text-[#5e684f]">{message}</p> : null}
              {ordersLoading ? (
                <p className="text-sm text-[#667056]">Loading your orders...</p>
              ) : orders.length === 0 ? (
                <div className="rounded-[1.3rem] border border-dashed border-[#d8cbb7] bg-[#fbf4e8] p-6 text-sm leading-7 text-[#667056]">No orders linked to this account yet.</div>
              ) : (
                <OrdersTable orders={orders} onShopAgain={handleShopAgain} />
              )}
            </section>
          )}
        </div>
      </main>

      <SiteFooter homeHref="/" contactId="contact" />
    </div>
  );
}

function OrdersTable({ orders, onShopAgain }: { orders: CheckoutOrder[]; onShopAgain: (order: CheckoutOrder) => void }) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-[#ddd1c0] bg-[#fbf7ef] shadow-[0_10px_25px_rgba(94,104,79,0.04)]">
      <div className="hidden grid-cols-[1.35fr_1.3fr_0.8fr_0.7fr_0.8fr_1.25fr] gap-4 border-b border-[#e4d8c8] bg-white/55 px-5 py-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#7d876f] md:grid">
        <span>Order</span><span>Date</span><span>Total</span><span>Items</span><span>Status</span><span>Actions</span>
      </div>
      {orders.map((order, index) => (
        <article key={order.id} className={`px-5 py-4 ${index !== orders.length - 1 ? "border-b border-[#eadfce]" : ""}`}>
          <div className="grid gap-3 md:grid-cols-[1.35fr_1.3fr_0.8fr_0.7fr_0.8fr_1.25fr] md:items-center md:gap-4">
            <OrderValue label="Order"><p className="text-sm font-semibold text-[#2b2a29]">#{order.id.slice(0, 8).toUpperCase()}</p></OrderValue>
            <OrderValue label="Date"><p className="text-sm text-[#4f5942]">{formatTimestamp(order.createdAt)}</p></OrderValue>
            <OrderValue label="Total"><p className="text-sm text-[#2b2a29]">{formatCurrency(order.amountBreakdown?.total)}</p></OrderValue>
            <OrderValue label="Items"><p className="text-sm text-[#4f5942]">{order.cartItems?.length || 0}</p></OrderValue>
            <OrderValue label="Status"><p className="text-sm font-medium text-[#5e684f]">{formatOrderStatus(order)}</p></OrderValue>
            <OrderValue label="Actions">
              <div className="flex flex-wrap gap-3 md:justify-end">
                <button type="button" onClick={() => openOrderReceiptPreview(buildOrderConfirmation(order))} className="brand-caption inline-flex border-b border-[#7d876f] pb-0.5 text-[0.62rem] font-semibold tracking-[0.08em] text-[#4f5942]">VIEW RECEIPT</button>
                <button type="button" onClick={() => onShopAgain(order)} className="brand-caption inline-flex border-b border-[#7d876f] pb-0.5 text-[0.62rem] font-semibold tracking-[0.08em] text-[#4f5942]">SHOP AGAIN</button>
              </div>
            </OrderValue>
          </div>
        </article>
      ))}
    </div>
  );
}

function OrderValue({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#7d876f] md:hidden">{label}</p>{children}</div>;
}

function formatTimestamp(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value) || typeof value.toDate !== "function") return "Just now";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(value.toDate());
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value || 0);
}

function formatOrderStatus(order: CheckoutOrder) {
  if (order.paymentStatus === "captured" || order.status === "paid") return "PAID";
  if (order.paymentStatus === "failed" || order.status === "payment_failed") return "FAILED";
  if (order.paymentStatus === "authorized" || order.status === "authorized") return "AUTHORIZED";
  return "PENDING";
}

function buildOrderConfirmation(order: CheckoutOrder) {
  return {
    createdAtIso: orderCreatedAtIso(order.createdAt),
    customer: { address: order.customer?.address || "", city: order.customer?.city || "", email: order.customer?.email || "", fullName: order.customer?.fullName || "Customer", phone: order.customer?.phone || "", pincode: order.customer?.pincode || "", state: order.customer?.state || "" },
    internalOrderId: order.id,
    items: (order.cartItems ?? []).map((item) => ({ color: item.color, name: item.name, primaryImageUrl: item.primaryImageUrl, quantity: item.quantity, sku: item.sku, unitOriginalPrice: item.unitOriginalPrice, unitPrice: item.unitPrice })),
    notes: order.notes || "",
    paymentStatus: order.paymentStatus || order.status || "pending",
    razorpayOrderId: order.razorpayOrderId || "",
    razorpayPaymentId: order.razorpayPaymentId || "",
    summary: { currency: order.currency || "INR", packagingFee: order.amountBreakdown?.packagingFee || 0, savings: order.amountBreakdown?.savings || 0, shippingFee: order.amountBreakdown?.shippingFee || 0, subtotal: order.amountBreakdown?.subtotal || 0, total: order.amountBreakdown?.total || 0 }
  } satisfies OrderConfirmationData;
}

function orderCreatedAtIso(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value) || typeof value.toDate !== "function") return new Date().toISOString();
  return value.toDate().toISOString();
}
