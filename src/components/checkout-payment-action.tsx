"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function CheckoutPaymentAction({
  orderId, recoveryError, mobile = false, processing, busy, disabled,
  onClick, className, children
}: {
  orderId: string | null;
  recoveryError: string | null;
  mobile?: boolean;
  processing: boolean;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  className: string;
  children: ReactNode;
}) {
  // Resuming a held order must not depend on the unreserved catalogue stock.
  // The status page verifies the existing order before it can reopen payment.
  if (!processing && (orderId || recoveryError)) {
    const base = mobile ? "/app" : "";
    const query = orderId ? `?order=${encodeURIComponent(orderId)}` : "";
    return <Link href={`${base}/order-confirmation/${query}`} className={`${className} !text-[#fbf4e8]`}>RESUME / CHECK PAYMENT</Link>;
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled || processing} aria-busy={busy} className={className}>
      {children}
    </button>
  );
}
