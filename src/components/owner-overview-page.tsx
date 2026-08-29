"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { OwnerBackofficeNav } from "@/components/owner-backoffice-nav";
import { OwnerSectionHero } from "@/components/owner-section-hero";
import { getUnreadCustomerMessageCount, subscribeToCustomerMessages } from "@/lib/customer-messages";
import { firebaseReady } from "@/lib/firebase";
import { normalizeAvailableStock } from "@/lib/inventory";
import { getPendingDispatchCount, subscribeToSuccessfulOrders } from "@/lib/orders";
import { subscribeToSarees } from "@/lib/sarees";
import { useOwnerAccess } from "@/lib/use-owner-access";
import { subscribeToWaitlistEntries } from "@/lib/waitlist";
import type { CheckoutOrder } from "@/types/order";
import type { Saree } from "@/types/saree";

export function OwnerOverviewPage() {
  const { authLoading, ownerAccessError, ownerAccountsLoading, ownerAuthorized, signIn, signOut, user } = useOwnerAccess();
  const [products, setProducts] = useState<Saree[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [orders, setOrders] = useState<CheckoutOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [waitlistLoading, setWaitlistLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerAuthorized) {
      setProducts([]);
      setOrders([]);
      setUnreadMessagesCount(0);
      setWaitlistCount(0);
      setProductsLoading(false);
      setOrdersLoading(false);
      setMessagesLoading(false);
      setWaitlistLoading(false);
      return;
    }

    setProductsLoading(true);
    setOrdersLoading(true);
    setMessagesLoading(true);
    setWaitlistLoading(true);

    const unsubscribeProducts = subscribeToSarees(
      (nextProducts) => {
        setProducts(nextProducts);
        setProductsLoading(false);
      },
      {},
      (error) => {
        setReadError(error.message);
        setProducts([]);
        setProductsLoading(false);
      }
    );

    const unsubscribeOrders = subscribeToSuccessfulOrders(
      (nextOrders) => {
        setOrders(nextOrders);
        setOrdersLoading(false);
      },
      (error) => {
        setReadError(error.message);
        setOrders([]);
        setOrdersLoading(false);
      }
    );

    const unsubscribeMessages = subscribeToCustomerMessages(
      (messages) => {
        setUnreadMessagesCount(getUnreadCustomerMessageCount(messages));
        setMessagesLoading(false);
      },
      (error) => {
        setReadError(error.message);
        setUnreadMessagesCount(0);
        setMessagesLoading(false);
      }
    );

    const unsubscribeWaitlist = subscribeToWaitlistEntries(
      (entries) => {
        setWaitlistCount(entries.length);
        setWaitlistLoading(false);
      },
      (error) => {
        setReadError(error.message);
        setWaitlistCount(0);
        setWaitlistLoading(false);
      }
    );

    return () => {
      unsubscribeProducts();
      unsubscribeOrders();
      unsubscribeMessages();
      unsubscribeWaitlist();
    };
  }, [ownerAuthorized]);

  async function handleSignIn() {
    setAuthError(null);

    try {
      await signIn();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google sign-in failed.");
    }
  }

  async function handleSignOut() {
    await signOut();
  }

  const metrics = useMemo(() => buildOwnerOverviewMetrics(orders, products), [orders, products]);
  const pendingDispatchCount = useMemo(() => getPendingDispatchCount(orders), [orders]);
  const navBadges = {
    "/owner/messages":
      messagesLoading
        ? { value: "...", tone: "neutral" as const }
        : unreadMessagesCount > 0
          ? { value: unreadMessagesCount, tone: "alert" as const }
          : undefined,
    "/owner/orders":
      ordersLoading
        ? { value: "...", tone: "neutral" as const }
        : pendingDispatchCount > 0
          ? { value: pendingDispatchCount, tone: "alert" as const }
          : undefined,
    "/owner/waitlist":
      waitlistLoading
        ? { value: "...", tone: "neutral" as const }
        : waitlistCount > 0
          ? { value: waitlistCount, tone: "neutral" as const }
          : undefined
  };

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
    <main className="min-h-screen bg-[#f5efe4] px-6 py-10 text-[#4f5942] sm:px-10 lg:px-12">
      <div className="mx-auto max-w-7xl">
        {authLoading || (user && ownerAccountsLoading && !ownerAuthorized) ? (
          <section className="rounded-[2rem] border border-[#ddd1c0] bg-[#fffaf2] p-8 text-sm text-[#667056] shadow-[0_18px_40px_rgba(94,104,79,0.06)]">
            Checking Google session…
          </section>
        ) : !ownerAuthorized ? (
          <section className="mx-auto max-w-3xl overflow-hidden rounded-[2.4rem] bg-[linear-gradient(135deg,#485343_0%,#5f6d58_48%,#d7c8ad_100%)] p-8 text-[#fbf4e8] shadow-[0_36px_100px_rgba(63,71,56,0.24)] sm:p-10">
            <p className="brand-caption text-[0.68rem] font-semibold tracking-[0.22em] text-[#efe0b6]">
              OWNER ACCESS
            </p>
            <h1 className="brand-copy mt-4 text-4xl leading-[1.04] text-[#fbf4e8] sm:text-5xl">
              Restricted admin area.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[#f8f1e3]/84 sm:text-[0.98rem]">
              Access is limited to authorized admins only. Sign in with Google to continue.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="brand-caption rounded-2xl border border-[#fbf4e8]/24 px-6 py-3 text-[0.66rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
                >
                  SIGN OUT
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="brand-caption rounded-2xl bg-[#fbf4e8] px-6 py-3 text-[0.66rem] font-semibold tracking-[0.08em] text-[#4e5943]"
                >
                  SIGN IN WITH GOOGLE
                </button>
              )}
            </div>

            {authError ? <p className="mt-4 text-sm text-[#ffe2da]">{authError}</p> : null}
            {ownerAccessError ? <p className="mt-4 text-sm text-[#ffe2da]">{ownerAccessError}</p> : null}
            {user && !ownerAuthorized ? (
              <p className="mt-4 text-sm text-[#ffe2da]">{user.email} does not have admin access.</p>
            ) : null}
          </section>
        ) : (
          <>
            <OwnerSectionHero
              eyebrow="OWNER OVERVIEW"
              title="Modern admin control for revenue, orders, inventory, and storefront operations."
              description="Use this screen as the owner entry point. It keeps the numbers visible and routes each part of the business into its own workspace."
              aside={
                <div className="grid gap-3 sm:grid-cols-2">
                  <HeroMiniCard label="Signed in as" value={user?.email || "Authorized admin"} />
                  <HeroMiniCard label="Dispatch queue" value={String(metrics.pendingDispatch)} />
                  <HeroMiniCard label="Revenue this month" value={formatCurrency(metrics.currentMonthRevenue)} />
                  <HeroMiniCard label="Orders this month" value={String(metrics.currentMonthOrders)} />
                </div>
              }
              action={
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="brand-caption rounded-2xl border border-[#fbf4e8]/24 px-6 py-3 text-[0.66rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
                >
                  SIGN OUT
                </button>
              }
            />

            <OwnerBackofficeNav badges={navBadges} className="mt-6" />

          <div className="mt-8 space-y-8">
            <section className="grid gap-4 xl:grid-cols-[1.15fr_1.15fr_1fr_1fr]">
              <UrgentActionCard
                href="/owner/orders"
                label="Needs action now"
                title="Dispatch queue"
                value={ordersLoading ? "..." : String(metrics.pendingDispatch)}
                description="Paid orders still waiting for dispatch."
                tone="alert"
              />
              <UrgentActionCard
                href="/owner/messages"
                label="Needs action now"
                title="Unread messages"
                value={messagesLoading ? "..." : String(unreadMessagesCount)}
                description="Customer questions that still need a reply."
                tone={unreadMessagesCount > 0 ? "alert" : "neutral"}
              />
              <UrgentActionCard
                href="/owner/catalogue"
                label="Store watch"
                title="Low stock"
                value={productsLoading ? "..." : String(metrics.lowStockProducts)}
                description="Active products with 2 or fewer pieces left."
                tone={metrics.lowStockProducts > 0 ? "neutral" : "calm"}
              />
              <UrgentActionCard
                href="/owner/waitlist"
                label="Demand signal"
                title="Waitlist"
                value={waitlistLoading ? "..." : String(waitlistCount)}
                description="Customers waiting for a restock alert."
                tone="calm"
              />
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <OverviewStatCard label="Total income" value={formatCurrency(metrics.totalRevenue)} tone="dark" />
              <OverviewStatCard label="Products sold" value={String(metrics.totalUnitsSold)} tone="light" />
              <OverviewStatCard label="Paid orders" value={String(metrics.totalOrders)} tone="light" />
              <OverviewStatCard label="Revenue this month" value={formatCurrency(metrics.currentMonthRevenue)} tone="accent" />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
              <article className="rounded-[2rem] border border-[#ddd1c0] bg-[#fffaf2] p-7 shadow-[0_18px_40px_rgba(94,104,79,0.06)] sm:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="brand-caption text-[0.58rem] font-semibold tracking-[0.16em] text-[#7d876f]">
                      REVENUE TREND
                    </p>
                    <h2 className="brand-copy mt-3 text-3xl text-[#2b2a29]">Income movement over the last 6 months</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[#667056]">
                      {metrics.revenueTrendLabel}
                    </p>
                  </div>
                  <span className={`rounded-full px-4 py-2 text-xs font-semibold ${metrics.revenueTrendTone}`}>
                    {metrics.revenueTrendValue}
                  </span>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-6">
                  {metrics.revenueSeries.map((item) => (
                    <div key={item.label} className="flex flex-col justify-end gap-3">
                      <div className="flex h-44 items-end rounded-[1.4rem] bg-[#f3ecdf] p-3">
                        <div
                          className="w-full rounded-[0.95rem] bg-[linear-gradient(180deg,#8a9a77_0%,#5e684f_100%)]"
                          style={{ height: `${item.heightPercent}%` }}
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7d876f]">{item.label}</p>
                        <p className="mt-1 text-xs text-[#667056]">{formatCompactCurrency(item.total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[2rem] border border-[#ddd1c0] bg-white/80 p-7 shadow-[0_18px_40px_rgba(94,104,79,0.06)] sm:p-8">
                <p className="brand-caption text-[0.58rem] font-semibold tracking-[0.16em] text-[#7d876f]">
                  BUSINESS HEALTH
                </p>
                <div className="mt-5 space-y-4">
                  <SnapshotRow label="Average order value" value={formatCurrency(metrics.averageOrderValue)} />
                  <SnapshotRow label="Active products" value={String(metrics.activeProducts)} />
                  <SnapshotRow label="Featured products" value={String(metrics.featuredProducts)} />
                  <SnapshotRow label="Low stock items" value={String(metrics.lowStockProducts)} />
                  <SnapshotRow label="Out of stock" value={String(metrics.outOfStockProducts)} />
                  <SnapshotRow label="Unread messages" value={messagesLoading ? "..." : String(unreadMessagesCount)} />
                  <SnapshotRow label="Waitlist requests" value={waitlistLoading ? "..." : String(waitlistCount)} />
                </div>
              </article>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <article className="rounded-[2rem] border border-[#ddd1c0] bg-white/80 p-7 shadow-[0_18px_40px_rgba(94,104,79,0.06)] sm:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="brand-caption text-[0.58rem] font-semibold tracking-[0.16em] text-[#7d876f]">
                      ADMIN SECTIONS
                    </p>
                    <h2 className="brand-copy mt-3 text-3xl text-[#2b2a29]">Open the exact workspace you need</h2>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <ActionCard href="/owner/catalogue" title="Catalogue" description="Products, pricing, stock, and featured records." />
                  <ActionCard href="/owner/storefront" title="Storefront" description="Homepage content, categories, and master data." />
                  <ActionCard href="/owner/orders" title="Orders" description="Paid orders, slips, address prints, and dispatch queue." />
                  <ActionCard href="/owner/messages" title="Messages" description="Storefront contact inbox for customer follow-up." />
                  <ActionCard href="/owner/waitlist" title="Waitlist" description="Back-in-stock requests from out-of-stock product pages." />
                  <ActionCard href="/owner/access" title="Access" description="Authorized owner emails and admin access control." />
                </div>
              </article>

              <article className="rounded-[2rem] border border-[#ddd1c0] bg-[#fffaf2] p-7 shadow-[0_18px_40px_rgba(94,104,79,0.06)] sm:p-8">
                <p className="brand-caption text-[0.58rem] font-semibold tracking-[0.16em] text-[#7d876f]">
                  RECENT ORDERS
                </p>
                <h2 className="brand-copy mt-3 text-3xl text-[#2b2a29]">Latest paid order activity</h2>
                <div className="mt-6 space-y-3">
                  {readError ? <p className="text-sm text-[#9d4b45]">{readError}</p> : null}
                  {ordersLoading ? (
                    <p className="text-sm text-[#667056]">Loading recent orders…</p>
                  ) : orders.length === 0 ? (
                    <div className="rounded-[1.4rem] border border-dashed border-[#d9ccb8] bg-white/70 p-5 text-sm leading-7 text-[#667056]">
                      No paid orders yet.
                    </div>
                  ) : (
                    orders.slice(0, 5).map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between gap-4 rounded-[1.35rem] border border-[#e7dccd] bg-white/70 px-4 py-4"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-[#2b2a29]">
                            {order.customer?.fullName || "Customer"}
                          </p>
                          <p className="mt-1 truncate text-sm text-[#667056]">
                            {shortOrderId(order.id)} · {formatTimestamp(order.createdAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-[#2b2a29]">{formatCurrency(getOrderTotal(order))}</p>
                          <p className="mt-1 text-xs text-[#667056]">
                            {order.dispatchStatus === "completed" ? "Dispatched" : "New dispatch"}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </section>
          </div>
          </>
        )}
      </div>
    </main>
  );
}

function buildOwnerOverviewMetrics(orders: CheckoutOrder[], products: Saree[]) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const previousMonthEnd = currentMonthStart;
  const totalRevenue = orders.reduce((sum, order) => sum + getOrderTotal(order), 0);
  const totalUnitsSold = orders.reduce((sum, order) => sum + getOrderUnits(order), 0);
  const currentMonthRevenue = sumOrdersByRange(orders, currentMonthStart, nextMonthStart);
  const previousMonthRevenue = sumOrdersByRange(orders, previousMonthStart, previousMonthEnd);
  const currentMonthOrders = countOrdersByRange(orders, currentMonthStart, nextMonthStart);
  const previousMonthOrders = countOrdersByRange(orders, previousMonthStart, previousMonthEnd);
  const pendingDispatch = orders.filter((order) => order.dispatchStatus !== "completed").length;
  const activeProducts = products.filter((product) => product.status === "active").length;
  const featuredProducts = products.filter((product) => product.featured).length;
  const outOfStockProducts = products.filter((product) => product.status === "out_of_stock").length;
  const lowStockProducts = products.filter(
    (product) => product.status === "active" && normalizeAvailableStock(product.availableStock) <= 2
  ).length;
  const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
  const revenueSeries = buildMonthlyRevenueSeries(orders, now);
  const revenueTrendDifference = currentMonthRevenue - previousMonthRevenue;
  const revenueTrendPercent =
    previousMonthRevenue > 0 ? (revenueTrendDifference / previousMonthRevenue) * 100 : currentMonthRevenue > 0 ? 100 : 0;
  const orderTrendDifference = currentMonthOrders - previousMonthOrders;

  return {
    activeProducts,
    averageOrderValue,
    currentMonthOrders,
    currentMonthRevenue,
    featuredProducts,
    lowStockProducts,
    outOfStockProducts,
    pendingDispatch,
    previousMonthOrders,
    previousMonthRevenue,
    revenueSeries,
    revenueTrendLabel:
      previousMonthRevenue > 0
        ? `${formatSignedPercent(revenueTrendPercent)} vs last month. ${formatSignedCurrency(
            revenueTrendDifference
          )} change in revenue and ${formatSignedNumber(orderTrendDifference)} order movement.`
        : currentMonthRevenue > 0
          ? "First recorded monthly revenue is visible here. The next month will show a direct comparison."
          : "No revenue recorded yet. As orders start landing, this area will show the monthly trend.",
    revenueTrendTone:
      revenueTrendDifference > 0
        ? "bg-[#dfe9d6] text-[#4d6a41]"
        : revenueTrendDifference < 0
          ? "bg-[#f3ddd6] text-[#8a4d43]"
          : "bg-[#ece7dd] text-[#6b665f]",
    revenueTrendValue:
      previousMonthRevenue > 0 ? formatSignedPercent(revenueTrendPercent) : currentMonthRevenue > 0 ? "NEW" : "FLAT",
    totalOrders: orders.length,
    totalRevenue,
    totalUnitsSold
  };
}

function buildMonthlyRevenueSeries(orders: CheckoutOrder[], now: Date) {
  const formatter = new Intl.DateTimeFormat("en-IN", { month: "short" });
  const buckets = Array.from({ length: 6 }).map((_, index) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      label: formatter.format(monthDate),
      start: monthDate.getTime(),
      total: 0
    };
  });

  orders.forEach((order) => {
    const timestamp = getTimestampValue(order.createdAt);

    if (timestamp <= 0) {
      return;
    }

    const match = buckets.find((bucket, index) => {
      const nextStart = buckets[index + 1]?.start ?? new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      return timestamp >= bucket.start && timestamp < nextStart;
    });

    if (!match) {
      return;
    }

    match.total += getOrderTotal(order);
  });

  const maxTotal = Math.max(...buckets.map((bucket) => bucket.total), 0);

  return buckets.map((bucket) => ({
    ...bucket,
    heightPercent: maxTotal > 0 ? Math.max(14, (bucket.total / maxTotal) * 100) : 14
  }));
}

function sumOrdersByRange(orders: CheckoutOrder[], start: number, end: number) {
  return orders.reduce((sum, order) => {
    const timestamp = getTimestampValue(order.createdAt);
    return timestamp >= start && timestamp < end ? sum + getOrderTotal(order) : sum;
  }, 0);
}

function countOrdersByRange(orders: CheckoutOrder[], start: number, end: number) {
  return orders.reduce((count, order) => {
    const timestamp = getTimestampValue(order.createdAt);
    return timestamp >= start && timestamp < end ? count + 1 : count;
  }, 0);
}

function getOrderTotal(order: CheckoutOrder) {
  if (typeof order.amountBreakdown?.total === "number") {
    return order.amountBreakdown.total;
  }

  if (typeof order.amountPaise === "number") {
    return order.amountPaise / 100;
  }

  return (order.cartItems ?? []).reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.quantity, 0);
}

function getOrderUnits(order: CheckoutOrder) {
  return (order.cartItems ?? []).reduce((sum, item) => sum + item.quantity, 0);
}

function getTimestampValue(value: unknown) {
  if (!value || typeof value !== "object") {
    return 0;
  }

  if ("toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if ("toDate" in value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  return 0;
}

function shortOrderId(orderId: string) {
  return orderId.slice(0, 8).toUpperCase();
}

function formatTimestamp(value: unknown) {
  const timestamp = getTimestampValue(value);

  if (!timestamp) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium"
  }).format(new Date(timestamp));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value);
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function formatSignedCurrency(value: number) {
  return `${value >= 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(1)}%`;
}

function formatSignedNumber(value: number) {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function HeroMiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.3rem] border border-[#fbf4e8]/10 bg-[#fbf4e8]/8 px-4 py-4 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.14em] text-[#efe0b6]">{label}</p>
      <p className="mt-2 text-base font-semibold text-[#fbf4e8]">{value}</p>
    </div>
  );
}

function OverviewStatCard({
  label,
  tone,
  value
}: {
  label: string;
  tone: "accent" | "dark" | "light";
  value: string;
}) {
  const toneClassName =
    tone === "dark"
      ? "border-[#5e684f] bg-[#5e684f] text-[#fbf4e8]"
      : tone === "accent"
        ? "border-[#d9c8ab] bg-[#f4ead9] text-[#2b2a29]"
        : "border-[#ddd1c0] bg-[#fffaf2] text-[#2b2a29]";

  return (
    <article className={`rounded-[1.8rem] border p-6 shadow-[0_18px_40px_rgba(94,104,79,0.06)] ${toneClassName}`}>
      <p className={`text-sm ${tone === "dark" ? "text-[#f8f1e3]/80" : "text-[#667056]"}`}>{label}</p>
      <p className="brand-copy mt-3 text-4xl">{value}</p>
    </article>
  );
}

function UrgentActionCard({
  description,
  href,
  label,
  title,
  tone,
  value
}: {
  description: string;
  href: string;
  label: string;
  title: string;
  tone: "alert" | "calm" | "neutral";
  value: string;
}) {
  const toneClassName =
    tone === "alert"
      ? "border-[#d7b2aa] bg-[#fff2ed]"
      : tone === "neutral"
        ? "border-[#ddd1c0] bg-[#fffaf2]"
        : "border-[#d5ddc8] bg-[#f3f7ed]";

  return (
    <Link
      href={href}
      className={`rounded-[1.8rem] border p-6 shadow-[0_18px_40px_rgba(94,104,79,0.06)] transition-transform duration-200 hover:-translate-y-0.5 ${toneClassName}`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7d876f]">{label}</p>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="brand-copy text-3xl text-[#2b2a29]">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-[#667056]">{description}</p>
        </div>
        <p className="brand-copy text-4xl text-[#2b2a29]">{value}</p>
      </div>
    </Link>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[1.2rem] bg-[#f8f1e6] px-4 py-3">
      <span className="text-sm text-[#667056]">{label}</span>
      <span className="text-sm font-semibold text-[#2b2a29]">{value}</span>
    </div>
  );
}

function ActionCard({
  description,
  href,
  title
}: {
  description: string;
  href: string;
  title: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[1.45rem] border border-[#e4d8c9] bg-[#fbf7ef] p-5 shadow-[0_12px_28px_rgba(94,104,79,0.05)] transition-colors duration-200 hover:border-[#cab99f] hover:bg-white"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="brand-copy text-2xl text-[#2b2a29]">{title}</h3>
          <p className="mt-2 text-sm leading-7 text-[#667056]">{description}</p>
        </div>
        <span className="text-2xl text-[#7d876f] transition-transform duration-200 group-hover:translate-x-1">›</span>
      </div>
    </Link>
  );
}
