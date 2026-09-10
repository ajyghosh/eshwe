"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { OwnerBackofficeNav } from "@/components/owner-backoffice-nav";
import { OwnerSectionHero } from "@/components/owner-section-hero";
import { getUnreadCustomerMessageCount, subscribeToCustomerMessages } from "@/lib/customer-messages";
import { firebaseReady } from "@/lib/firebase";
import { subscribeToSuccessfulOrders } from "@/lib/orders";
import { buildOwnerOverviewMetrics, formatCurrency, formatCompactCurrency, formatTimestamp, getOrderTotal, getTimestampValue, shortOrderId } from "@/lib/owner-overview";
import { subscribeToSarees } from "@/lib/sarees";
import { useOwnerAccess } from "@/lib/use-owner-access";
import { subscribeToWaitlistEntries } from "@/lib/waitlist";
import type { CheckoutOrder } from "@/types/order";
import type { Saree } from "@/types/saree";

type Source = "orders" | "products" | "messages" | "waitlist";
const initialLoading = { orders: true, products: true, messages: true, waitlist: true };
const emptyErrors: Record<Source, string | null> = { orders: null, products: null, messages: null, waitlist: null };

export function OwnerOverviewPage() {
  const { authLoading, ownerAccessError, ownerAccountsLoading, ownerAuthorized, signIn, signOut, user } = useOwnerAccess();
  const [products, setProducts] = useState<Saree[]>([]);
  const [orders, setOrders] = useState<CheckoutOrder[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [loading, setLoading] = useState(initialLoading);
  const [errors, setErrors] = useState(emptyErrors);
  const [retry, setRetry] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(initialLoading);
    setErrors(emptyErrors);
    if (!ownerAuthorized) {
      setProducts([]);
      setOrders([]);
      setUnreadMessages(0);
      setWaitlistCount(0);
      return;
    }
    function ready(source: Source) {
      setLoading(current => ({ ...current, [source]: false }));
      setErrors(current => ({ ...current, [source]: null }));
    }
    function failed(source: Source, error: Error) {
      setLoading(current => ({ ...current, [source]: false }));
      setErrors(current => ({ ...current, [source]: error.message }));
    }
    const subscriptions = [
      subscribeToSarees(items => { setProducts(items); ready("products"); }, {}, error => failed("products", error)),
      subscribeToSuccessfulOrders(items => { setOrders(items); ready("orders"); }, error => failed("orders", error)),
      subscribeToCustomerMessages(items => { setUnreadMessages(getUnreadCustomerMessageCount(items)); ready("messages"); }, error => failed("messages", error)),
      subscribeToWaitlistEntries(items => { setWaitlistCount(items.length); ready("waitlist"); }, error => failed("waitlist", error))
    ];
    return () => subscriptions.forEach(unsubscribe => unsubscribe());
  }, [ownerAuthorized, retry]);

  const metrics = useMemo(() => buildOwnerOverviewMetrics(orders, products), [orders, products]);
  const recentOrders = useMemo(() => [...orders].sort((a, b) => getTimestampValue(b.createdAt) - getTimestampValue(a.createdAt)).slice(0, 5), [orders]);
  function value(source: Source, result: string | number) {
    return errors[source] ? "Unavailable" : loading[source] ? "Loading…" : String(result);
  }
  function badge(source: Source, count: number) {
    return errors[source] ? { value: "!", tone: "alert" as const } : loading[source] ? "…" : count || undefined;
  }
  async function authenticate() {
    setAuthError(null);
    try { await signIn(); } catch (error) { setAuthError(error instanceof Error ? error.message : "Google sign-in failed."); }
  }
  async function leave() {
    setAuthError(null);
    try { await signOut(); } catch { setAuthError("Unable to sign out. Please try again."); }
  }

  if (!firebaseReady) return <main><p role="alert">Owner access is temporarily unavailable. Firebase configuration is missing.</p></main>;

  return (
    <main className="min-h-screen bg-[#f5efe4] px-6 py-10 text-[#4f5942] sm:px-10 lg:px-12">
      <div className="mx-auto max-w-7xl">
        {authLoading || (user && ownerAccountsLoading && !ownerAuthorized) ? (
          <div className="owner-panel" role="status">Checking Google session…</div>
        ) : !ownerAuthorized ? (
          <section className="owner-login owner-panel">
            <p className="owner-eyebrow">ESHWE OWNER ACCESS</p>
            <h1>Sign in to your workspace</h1>
            <p>Use an authorized Google account to manage your store.</p>
            <button className="owner-primary" onClick={user ? leave : authenticate}>{user ? "Sign out" : "Sign in with Google"}</button>
            {authError || ownerAccessError ? <p role="alert">{authError || ownerAccessError}</p> : null}
            {user ? <p role="alert">{user.email} does not have owner access.</p> : null}
          </section>
        ) : (
          <>
            <OwnerSectionHero eyebrow="ESHWE BACKOFFICE" title="Overview" description="Your store at a glance. Start with the tasks that need attention."
              action={<><span className="owner-signed-in">{user?.email}</span><button className="owner-secondary" onClick={leave}>Sign out</button></>} />
            <OwnerBackofficeNav badges={{ "/owner/orders": badge("orders", metrics.pendingDispatch), "/owner/messages": badge("messages", unreadMessages), "/owner/waitlist": badge("waitlist", waitlistCount) }} />
            {authError ? <p className="owner-error" role="alert">{authError}</p> : null}
            {Object.values(errors).some(Boolean) ? (
              <div className="owner-error" role="alert">
                <p>Some data could not be loaded. Affected totals are marked unavailable.</p>
                <ul>{(Object.keys(errors) as Source[]).filter(source => errors[source]).map(source => <li key={source}>{source}: {errors[source]}</li>)}</ul>
                <button className="owner-secondary" onClick={() => setRetry(current => current + 1)}>Retry loading</button>
              </div>
            ) : null}
            <section className="owner-task-grid" aria-label="Tasks needing attention">
              <TaskCard href="/owner/orders" label="Pending dispatch" value={value("orders", metrics.pendingDispatch)} description="Paid orders waiting to ship" urgent={!loading.orders && !errors.orders && metrics.pendingDispatch > 0} />
              <TaskCard href="/owner/messages" label="Unread messages" value={value("messages", unreadMessages)} description="Customer questions to review" urgent={!loading.messages && !errors.messages && unreadMessages > 0} />
              <TaskCard href="/owner/catalogue" label="Low stock" value={value("products", metrics.lowStockProducts)} description="Active products with 2 or fewer left" />
              <TaskCard href="/owner/waitlist" label="Restock requests" value={value("waitlist", waitlistCount)} description="Customers waiting for a piece" />
            </section>
            <section className="owner-stat-grid" aria-label="Sales summary">
              <Stat label="Total income · all time" value={value("orders", formatCurrency(metrics.totalRevenue))} />
              <Stat label="Pieces sold · all time" value={value("orders", metrics.totalUnitsSold)} />
              <Stat label="Paid orders · all time" value={value("orders", metrics.totalOrders)} />
              <Stat label="Revenue · this month" value={value("orders", formatCurrency(metrics.currentMonthRevenue))}
                detail={!loading.orders && !errors.orders ? `${metrics.currentMonthOrders} paid order${metrics.currentMonthOrders === 1 ? "" : "s"} this month` : undefined} />
            </section>
            <div className="owner-overview-columns">
              <section className="owner-panel" aria-labelledby="owner-revenue-title">
                <h2 id="owner-revenue-title">Revenue over six months</h2>
                {errors.orders ? <p role="status">Revenue is unavailable until orders can be loaded.</p> : loading.orders ? <p role="status">Loading revenue…</p> : (
                  <>
                    <p>{metrics.revenueTrendLabel}</p>
                    <p className="owner-muted">This month to date compared with the previous full month.</p>
                    <div className="owner-revenue-chart" role="list" aria-label="Monthly revenue">
                      {metrics.revenueSeries.map(month => (
                        <div key={month.label} role="listitem" aria-label={`${month.label}: ${formatCurrency(month.total)}`}>
                          <div className="owner-revenue-track" aria-hidden="true"><div style={{ height: `${month.heightPercent}%` }} /></div>
                          <span>{month.label}</span><strong title={formatCurrency(month.total)}>{formatCompactCurrency(month.total)}</strong>
                        </div>
                      ))}
                    </div>
                    {metrics.revenueSeries.every(month => month.total === 0) ? <p className="owner-muted">No paid revenue in this period.</p> : null}
                  </>
                )}
              </section>
              <section className="owner-panel">
                <h2>Inventory and order value</h2>
                <dl className="owner-summary-list">
                  <Summary label="Average order value" value={value("orders", formatCurrency(metrics.averageOrderValue))} />
                  <Summary label="Active products" value={value("products", metrics.activeProducts)} />
                  <Summary label="Featured products" value={value("products", metrics.featuredProducts)} />
                  <Summary label="Out of stock" value={value("products", metrics.outOfStockProducts)} />
                </dl>
              </section>
            </div>
            <section className="owner-panel">
              <div className="owner-panel-heading"><h2>Recent paid orders</h2><Link href="/owner/orders" className="owner-text-link">View all orders</Link></div>
              {errors.orders ? <p role="status">Recent orders are unavailable.</p> : loading.orders ? <p role="status">Loading recent orders…</p> : recentOrders.length === 0 ? <p>No paid orders yet.</p> : (
                <ul className="owner-recent-orders">{recentOrders.map(order => <li key={order.id}>
                  <div><strong>{order.customer?.fullName || "Customer"}</strong><p>{shortOrderId(order.id)} · {formatTimestamp(order.createdAt)}</p></div>
                  <div><strong>{formatCurrency(getOrderTotal(order))}</strong><p>{order.dispatchStatus === "completed" ? "Dispatched" : "Awaiting dispatch"}</p></div>
                </li>)}</ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function TaskCard({ href, label, value, description, urgent = false }: { href: string; label: string; value: string; description: string; urgent?: boolean }) {
  return <Link href={href} className={`owner-task-card ${urgent ? "owner-task-urgent" : ""}`}><h2>{label}</h2><strong>{value}</strong><p>{description}</p><span aria-hidden="true">Open →</span></Link>;
}
function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <article className="owner-stat"><h2>{label}</h2><strong>{value}</strong>{detail ? <p className="owner-muted mt-2">{detail}</p> : null}</article>;
}
function Summary({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
