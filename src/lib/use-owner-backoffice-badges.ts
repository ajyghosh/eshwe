"use client";

import { useEffect, useMemo, useState } from "react";

import { getUnreadCustomerMessageCount, subscribeToCustomerMessages } from "@/lib/customer-messages";
import { getPendingDispatchCount, subscribeToSuccessfulOrders } from "@/lib/orders";
import { subscribeToWaitlistEntries } from "@/lib/waitlist";
import type { CustomerMessage } from "@/types/customer-message";
import type { CheckoutOrder } from "@/types/order";
import type { WaitlistEntry } from "@/types/waitlist-entry";

type OwnerBackofficeBadge = {
  value: number | string;
  tone?: "alert" | "neutral";
};

function buildBadge(value: number, tone: "alert" | "neutral" = "neutral") {
  return value > 0 ? { value, tone } : undefined;
}

export function useOwnerBackofficeBadges(enabled: boolean) {
  const [orders, setOrders] = useState<CheckoutOrder[]>([]);
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(enabled);
  const [messagesLoading, setMessagesLoading] = useState(enabled);
  const [waitlistLoading, setWaitlistLoading] = useState(enabled);

  const [ordersError, setOrdersError] = useState(false);
  const [messagesError, setMessagesError] = useState(false);

  useEffect(() => {
    setOrdersError(false);
    setMessagesError(false);
    if (!enabled) {
      setOrders([]);
      setMessages([]);
      setWaitlistEntries([]);
      setOrdersLoading(false);
      setMessagesLoading(false);
      setWaitlistLoading(false);
      return;
    }

    setOrdersLoading(true);
    setMessagesLoading(true);
    setWaitlistLoading(true);

    const unsubscribeOrders = subscribeToSuccessfulOrders(
      (nextOrders, fromCache) => {
        setOrdersError(false);
        setOrders(nextOrders);
        setOrdersLoading(Boolean(fromCache));
      },
      () => {
        setOrdersError(true);
        setOrders([]);
        setOrdersLoading(false);
      }
    );

    const unsubscribeMessages = subscribeToCustomerMessages(
      (nextMessages, fromCache) => {
        setMessagesError(false);
        setMessages(nextMessages);
        setMessagesLoading(Boolean(fromCache));
      },
      () => {
        setMessagesError(true);
        setMessages([]);
        setMessagesLoading(false);
      }
    );

    const unsubscribeWaitlist = subscribeToWaitlistEntries(
      (nextEntries) => {
        setWaitlistEntries(nextEntries);
        setWaitlistLoading(false);
      },
      () => {
        setWaitlistEntries([]);
        setWaitlistLoading(false);
      }
    );

    return () => {
      unsubscribeOrders();
      unsubscribeMessages();
      unsubscribeWaitlist();
    };
  }, [enabled]);

  const pendingOrdersCount = useMemo(() => getPendingDispatchCount(orders), [orders]);
  const unreadMessagesCount = useMemo(() => getUnreadCustomerMessageCount(messages), [messages]);
  const waitlistCount = waitlistEntries.length;

  const badges = useMemo<Record<string, OwnerBackofficeBadge | undefined>>(
    () => ({
      "/owner/orders": ordersLoading ? { value: "...", tone: "neutral" } : buildBadge(pendingOrdersCount, "alert"),
      "/owner/messages": messagesLoading ? { value: "...", tone: "neutral" } : buildBadge(unreadMessagesCount, "alert"),
      "/owner/waitlist": waitlistLoading ? { value: "...", tone: "neutral" } : buildBadge(waitlistCount)
    }),
    [messagesLoading, ordersLoading, pendingOrdersCount, unreadMessagesCount, waitlistCount, waitlistLoading]
  );

  return {
    badges,
    orders,
    messages,
    ordersLoading,
    messagesLoading,
    ordersError,
    messagesError,
    pendingOrdersCount,
    unreadMessagesCount,
    waitlistCount
  };
}
