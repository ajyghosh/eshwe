"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useOwnerAccess } from "@/lib/use-owner-access";
import { useOwnerBackofficeBadges } from "@/lib/use-owner-backoffice-badges";
import { createOwnerArrivalTracker } from "@/lib/owner-arrivals";
import { getPendingDispatchCount } from "@/lib/orders";
import { isUnreadCustomerMessage } from "@/lib/customer-messages";

type Badges = ReturnType<typeof useOwnerBackofficeBadges>["badges"];
const emptyBadges: Badges = { "/owner/orders": undefined, "/owner/messages": undefined, "/owner/waitlist": undefined };
const OwnerActivityContext = createContext<Badges>(emptyBadges);
export const useOwnerActivityBadges = () => useContext(OwnerActivityContext);

export function OwnerActivityProvider({ children }: { children: ReactNode }) {
  const { user, ownerAuthorized, authLoading } = useOwnerAccess();
  if (authLoading || !user?.emailVerified || !ownerAuthorized) {
    return <OwnerActivityContext.Provider value={emptyBadges}>{children}</OwnerActivityContext.Provider>;
  }
  return <OwnerActivitySession key={user.uid}>{children}</OwnerActivitySession>;
}

function OwnerActivitySession({ children }: { children: ReactNode }) {
  const activity = useOwnerBackofficeBadges(true);
  const orderArrivals = useRef(createOwnerArrivalTracker());
  const messageArrivals = useRef(createOwnerArrivalTracker());
  const [notices, setNotices] = useState({ orders: 0, messages: 0 });

  useEffect(() => {
    const added = new Set(orderArrivals.current(activity.orders.flatMap(order => order.id ? [order.id] : []), !activity.ordersLoading && !activity.ordersError));
    const count = getPendingDispatchCount(activity.orders.filter(order => order.id && added.has(order.id)));
    if (count) setNotices(current => ({ ...current, orders: current.orders + count }));
  }, [activity.orders, activity.ordersLoading, activity.ordersError]);

  useEffect(() => {
    const added = new Set(messageArrivals.current(activity.messages.flatMap(message => message.id ? [message.id] : []), !activity.messagesLoading && !activity.messagesError));
    const count = activity.messages.filter(message => message.id && added.has(message.id) && isUnreadCustomerMessage(message)).length;
    if (count) setNotices(current => ({ ...current, messages: current.messages + count }));
  }, [activity.messages, activity.messagesLoading, activity.messagesError]);

  return <OwnerActivityContext.Provider value={activity.badges}>
    {children}
    {activity.ordersError || activity.messagesError ? <p role="status" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border bg-[#fffaf2] p-4 text-sm text-[#94473e]">Live notifications could not connect. Reload to retry.</p> : null}
    {notices.orders + notices.messages > 0 ? <aside aria-label="New owner activity" className="fixed right-4 top-4 z-[80] w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-[#d8ccb9] bg-[#fffaf2] p-4 text-[#354233] shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div role="status" aria-live="polite" aria-atomic="true">
          <p className="font-semibold">New activity</p>
          {notices.orders > 0 ? <p className="mt-2 text-sm">{notices.orders} new {notices.orders === 1 ? "order" : "orders"}</p> : null}
          {notices.messages > 0 ? <p className="mt-2 text-sm">{notices.messages} new {notices.messages === 1 ? "message" : "messages"}</p> : null}
        </div>
        <button type="button" aria-label="Dismiss notifications" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d8ccb9]" onClick={() => setNotices({ orders: 0, messages: 0 })}>×</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {notices.orders > 0 ? <Link href="/owner/orders/" className="rounded-xl bg-[#5e684f] px-4 py-3 text-sm font-semibold !text-white" onClick={() => setNotices(current => ({ ...current, orders: 0 }))}>View orders</Link> : null}
        {notices.messages > 0 ? <Link href="/owner/messages/" className="rounded-xl bg-[#5e684f] px-4 py-3 text-sm font-semibold !text-white" onClick={() => setNotices(current => ({ ...current, messages: 0 }))}>View messages</Link> : null}
      </div>
    </aside> : null}
  </OwnerActivityContext.Provider>;
}
