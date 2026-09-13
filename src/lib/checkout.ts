"use client";
import { auth } from "@/lib/firebase";
import { ApiError, postJson } from "@/lib/api";
import { loadRazorpayCheckoutScript, type RazorpayHandlerResponse } from "@/lib/razorpay";
import type { CartItem } from "@/types/cart";
import type { CheckoutOrder, CheckoutOrderCustomer } from "@/types/order";
import type { OrderConfirmationData } from "@/lib/order-confirmation";

export type CheckoutResponse = { internalOrderId: string; keyId: string; amount: number; currency: string; razorpayOrderId: string | null; canPay: boolean; reservationExpiresAt: number; order: CheckoutOrder | null; confirmation?: OrderConfirmationData };
const pendingKey = (uid: string) => `eshwe.pendingCheckout:${uid}`;
export function pendingCheckout(uid: string): { checkoutKey: string; internalOrderId?: string } | null {
  try { return JSON.parse(localStorage.getItem(pendingKey(uid)) || "null"); } catch { return null; }
}
export function clearPendingCheckout(uid: string) { try { localStorage.removeItem(pendingKey(uid)); window.dispatchEvent(new Event("eshwe-checkout")); } catch { /* Server session still prevents duplicate checkout. */ } }
function savePending(uid: string, value: { checkoutKey: string; internalOrderId?: string }) { localStorage.setItem(pendingKey(uid), JSON.stringify(value)); window.dispatchEvent(new Event("eshwe-checkout")); }
export function checkCheckout(internalOrderId?: string, cancel = false) { return postJson<CheckoutResponse>("/api/checkout/status", { internalOrderId, cancel }); }

export async function createCheckout(items: CartItem[], customer: CheckoutOrderCustomer, notes: string) {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error("Sign in before paying.");
  const pending = pendingCheckout(uid) || { checkoutKey: crypto.randomUUID() };
  // Persist the idempotency key before making any request that can reserve stock.
  try { savePending(uid, pending); } catch { throw new Error("Enable browser storage before starting payment so your order can be recovered."); }
  try {
    const result = await postJson<CheckoutResponse>("/api/razorpay/create-order", { checkoutKey: pending.checkoutKey, items: items.map(item=>({productId:item.productId,sku:item.sku,quantity:item.quantity})),customer,notes,sourcePath:window.location.pathname });
    savePending(uid,{...pending,internalOrderId:result.internalOrderId});return result;
  } catch(error) {
    if(error instanceof ApiError && error.internalOrderId)savePending(uid,{...pending,internalOrderId:error.internalOrderId});
    else if(error instanceof ApiError && error.status>=400 && error.status<500)clearPendingCheckout(uid);
    throw error;
  }
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
