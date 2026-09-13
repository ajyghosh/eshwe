"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuthSession } from "@/components/auth-provider";
import { checkCheckout, needsCheckoutRecovery, pendingCheckout } from "@/lib/checkout";

type RecoveryState = { uid: string; orderId: string | null; error: string | null };
const CheckoutRecoveryContext = createContext<{ orderId: string | null; error: string | null }>({ orderId: null, error: null });

export function CheckoutRecoveryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthSession();
  const path = usePathname() || "";
  const checkout = /\/(checkout|payment)\/?$/.test(path);
  const [state, setState] = useState<RecoveryState | null>(null);

  useEffect(() => {
    if (!checkout || !user) return;
    const uid = user.uid;
    setState({ uid, orderId: null, error: null });
    let active = true;
    let requestVersion = 0;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(expiryTimer);
      const version = ++requestVersion;
      const savedId = pendingCheckout(uid)?.internalOrderId;
      // A saved browser reference alone does not prove a payment is pending.
      void checkCheckout().then(result => {
        if (!active || version !== requestVersion) return;
        const needsRecovery = needsCheckoutRecovery(result.order);
        setState({ uid, orderId: needsRecovery ? result.internalOrderId : null, error: null });
        if (needsRecovery && result.order?.reservationExpiresAt) {
          expiryTimer = setTimeout(refresh, Math.max(30000, result.order.reservationExpiresAt - Date.now() + 1000));
        }
      }).catch(() => {
        if (!active || version !== requestVersion) return;
        setState(current => ({
          uid,
          orderId: savedId || (current?.uid === uid ? current.orderId : null),
          error: "Unable to check an earlier payment. Check payment status before paying again."
        }));
      });
    };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    refresh();
    window.addEventListener("eshwe-checkout", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearTimeout(expiryTimer);
      window.removeEventListener("eshwe-checkout", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [checkout, user]);

  const value = checkout && state && user && state.uid === user.uid ? state : { orderId: null, error: null };
  return <CheckoutRecoveryContext.Provider value={value}>{children}</CheckoutRecoveryContext.Provider>;
}

export function useCheckoutRecovery() {
  return useContext(CheckoutRecoveryContext);
}
