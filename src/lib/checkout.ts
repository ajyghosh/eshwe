"use client";
import { auth } from "@/lib/firebase";
import { ApiError, postJson } from "@/lib/api";
import { loadRazorpayCheckoutScript, type RazorpayHandlerResponse } from "@/lib/razorpay";
import type { CartItem } from "@/types/cart";
import type { CheckoutOrder, CheckoutOrderCustomer } from "@/types/order";
import type { OrderConfirmationData } from "@/lib/order-confirmation";

export type CheckoutResponse = { internalOrderId: string; keyId: string; amount: number; currency: string; razorpayOrderId: string | null; canPay: boolean; reservationExpiresAt: number; order: CheckoutOrder | null; confirmation?: OrderConfirmationData };
type PendingCheckout = { checkoutKey: string; internalOrderId?: string };
const pendingKey = (uid: string) => `eshwe.pendingCheckout:${uid}`;
export function pendingCheckout(uid: string): PendingCheckout | null {
  try { return JSON.parse(localStorage.getItem(pendingKey(uid)) || "null"); } catch { return null; }
}
function forgetPending(uid: string, expected: PendingCheckout) {
  try {
    const current = pendingCheckout(uid);
    if (current?.checkoutKey !== expected.checkoutKey || current?.internalOrderId !== expected.internalOrderId) return;
    localStorage.removeItem(pendingKey(uid));
    window.dispatchEvent(new Event("eshwe-checkout"));
  } catch { /* Server session still prevents duplicate checkout. */ }
}
export function clearPendingCheckout(uid: string, expectedOrderId?: string) {
  const current = pendingCheckout(uid);
  if (current && (!expectedOrderId || current.internalOrderId === expectedOrderId)) forgetPending(uid, current);
}
function savePending(uid: string, value: PendingCheckout) { localStorage.setItem(pendingKey(uid), JSON.stringify(value)); window.dispatchEvent(new Event("eshwe-checkout")); }

function hasConfirmedPayment(order: CheckoutOrder) {
  return Boolean(order.paymentCaptured || order.inventoryCommitted || order.paymentStatus === "captured" || order.paymentStatus === "refunded" || order.status === "paid");
}

export function isResolvedCheckout(order: CheckoutOrder | null) {
  if (!order) return false;
  if (hasConfirmedPayment(order) || order.reservationState === "committed") return true;
  return order.reservationState === "released" && order.paymentStatus !== "authorized";
}

export function needsCheckoutRecovery(order: CheckoutOrder | null) {
  return Boolean(order && !isResolvedCheckout(order) && (order.reservationState === "held" || order.attentionRequired));
}

export async function checkCheckout(internalOrderId?: string, cancel = false) {
  const uid = auth?.currentUser?.uid;
  const previous = uid ? pendingCheckout(uid) : null;
  const result = await postJson<CheckoutResponse>("/api/checkout/status", { internalOrderId, cancel });
  // Clear only the exact browser attempt whose final state the server verified.
  // Viewing an older receipt must never clear a newer checkout reference.
  if (uid && auth?.currentUser?.uid === uid && previous?.internalOrderId && previous.internalOrderId === result.internalOrderId && isResolvedCheckout(result.order)) {
    forgetPending(uid, previous);
  }
  return result;
}

function canStartAfterCheckout(order: CheckoutOrder | null) {
  return Boolean(order?.reservationState === "released" && !hasConfirmedPayment(order) && order.paymentStatus !== "authorized");
}

export async function createCheckout(items: CartItem[], customer: CheckoutOrderCustomer, notes: string) {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error("Sign in before paying.");
  function requireSameAccount() {
    if (auth?.currentUser?.uid !== uid) throw new Error("Your account changed. Return to checkout before paying.");
  }
  let pending = pendingCheckout(uid);
  if (pending?.internalOrderId) {
    const previous = await checkCheckout(pending.internalOrderId);
    requireSameAccount();
    // Never reopen a paid order or abandon an uncertain payment as a new charge.
    if (!canStartAfterCheckout(previous.order)) return { ...previous, canPay: false };
    pending = pendingCheckout(uid);
    if (pending?.internalOrderId === previous.internalOrderId) throw new Error("Your browser could not reset the expired checkout. Allow site storage and reload.");
  }

  // Retry once only when the server confirms that the old attempt is released
  // and unpaid. Timeouts and unknown gateway outcomes retain the original key.
  for (let attempt = 0; attempt < 2; attempt++) {
    requireSameAccount();
    const reference = pending || pendingCheckout(uid) || { checkoutKey: crypto.randomUUID() };
    try { savePending(uid, reference); } catch { throw new Error("Enable browser storage before starting payment so your order can be recovered."); }
    try {
      const result = await postJson<CheckoutResponse>("/api/razorpay/create-order", { checkoutKey: reference.checkoutKey, items: items.map(item=>({productId:item.productId,sku:item.sku,quantity:item.quantity})),customer,notes,sourcePath:window.location.pathname });
      requireSameAccount();
      savePending(uid,{...reference,internalOrderId:result.internalOrderId});
      return result;
    } catch(error) {
      requireSameAccount();
      if (error instanceof ApiError && error.internalOrderId) {
        savePending(uid,{...reference,internalOrderId:error.internalOrderId});
        const previous = await checkCheckout(error.internalOrderId);
        requireSameAccount();
        if (attempt === 0 && canStartAfterCheckout(previous.order)) {
          pending = pendingCheckout(uid);
          if (pending?.internalOrderId !== previous.internalOrderId) continue;
        }
        return { ...previous, canPay: false };
      }
      if(error instanceof ApiError && error.status>=400 && error.status<500) forgetPending(uid, reference);
      throw error;
    }
  }
  throw new Error("Check your earlier payment before starting another checkout.");
}

export async function openCheckout(order: CheckoutResponse, onStatus: (id: string) => void, onClose: () => void, onError: (message: string) => void) {
  if(!order.canPay || !order.razorpayOrderId || order.reservationExpiresAt<=Date.now()){onStatus(order.internalOrderId);return;}
  await loadRazorpayCheckoutScript();
  if(!window.Razorpay)throw new Error("Payment could not be opened. Resume your existing checkout.");
  let completed=false;
  const checkout=new window.Razorpay({key:order.keyId,amount:order.amount,currency:order.currency,order_id:order.razorpayOrderId,timeout:Math.max(1,Math.floor((order.reservationExpiresAt-Date.now())/1000)),prefill:{name:order.order?.customer?.fullName,email:order.order?.customer?.email,contact:order.order?.customer?.phone},modal:{ondismiss:()=>{if(!completed)onClose();}},handler:async(response:RazorpayHandlerResponse)=>{
    completed=true;
    try{await postJson("/api/razorpay/verify-payment",{internalOrderId:order.internalOrderId,...response});}
    catch{ /* Always recover by server order ID; never ask for a second charge. */ }
    onStatus(order.internalOrderId);
  }});
  checkout.on("payment.failed",()=>onError("That payment attempt did not complete. Check your existing order before trying again."));
  checkout.open();
}
