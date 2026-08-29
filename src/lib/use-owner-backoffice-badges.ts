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
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  useEffect(() => {
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
      (nextOrders) => {
        setOrders(nextOrders);
        setOrdersLoading(false);
      },
      () => {
        setOrders([]);
        setOrdersLoading(false);
      }
    );

    const unsubscribeMessages = subscribeToCustomerMessages(
      (nextMessages) => {
        setMessages(nextMessages);
        setMessagesLoading(false);
      },
      () => {
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
    pendingOrdersCount,
    unreadMessagesCount,
    waitlistCount
  };
}
