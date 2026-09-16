"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthSession } from "@/components/auth-provider";
import { LoadingDots } from "@/components/loading-dots";
import { MobileContactButton } from "@/components/mobile-contact-button";
import { checkCheckout, openCheckout, pendingCheckout, type CheckoutResponse } from "@/lib/checkout";
import { openOrderReceiptPreview, saveLatestOrderConfirmation } from "@/lib/order-confirmation";
import { paymentLabel, fulfilmentLabel } from "@/lib/order-status";

export function OrderStatusPage({ mobile = false }: { mobile?: boolean }) {
  const {user,loading,signIn}=useAuthSession();
  const [state,setState]=useState<{uid:string;result:CheckoutResponse}|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [pendingAction,setPendingAction]=useState<"cancel"|"resume"|null>(null);
  const busy=pendingAction!==null;
  const [tick,setTick]=useState(0);
  const result=state?.uid===user?.uid?state?.result:null;
  const order=result?.order;
  useEffect(()=>{
    if(!user)return;let active=true;const uid=user.uid;
    let latest: string | null = null;
    try { latest = localStorage.getItem(`eshwe.latestOrder:${uid}`); } catch { /* Recover from the server session. */ }
    const id=new URLSearchParams(location.search).get("order")||pendingCheckout(uid)?.internalOrderId||latest||undefined;
    let timer:ReturnType<typeof setTimeout>;
    const refresh=async()=>{
      try{const response=await checkCheckout(id);if(!active)return;setState({uid,result:response});setError(null);
        if(response.confirmation)saveLatestOrderConfirmation(response.confirmation);
        if(response.order?.reservationState==="held"||["requested","pending","retry_required"].includes(response.order?.refundStatus||""))timer=setTimeout(refresh,10000);
      }catch(e){if(active)setError(e instanceof Error?e.message:"Could not check payment. Retry checking before paying again.");}
    };void refresh();return()=>{active=false;clearTimeout(timer);};
  },[user,tick]);
  const base=mobile?"/app":"";
  const contactClassName="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#5e684f] bg-white px-5 py-3 text-center font-semibold !text-[#5e684f] transition-colors hover:bg-[#f4f5f0] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5e684f] sm:flex-1";
  async function cancel(){if(busy||!result?.internalOrderId)return;setPendingAction("cancel");setError(null);try{const response=await checkCheckout(result.internalOrderId,true);setState({uid:user!.uid,result:response});}catch(e){setError(e instanceof Error?e.message:"Unable to cancel.");}finally{setPendingAction(null);}}
  async function resume(){if(busy||!result)return;setPendingAction("resume");setError(null);try{const fresh=await checkCheckout(result.internalOrderId);await openCheckout(fresh,()=>{setPendingAction(null);setTick(t=>t+1);},()=>{setPendingAction(null);setTick(t=>t+1);},message=>{setPendingAction(null);setError(message);});}catch(e){setPendingAction(null);setError(e instanceof Error?e.message:"Unable to resume payment.");}}
  return <main className="min-h-screen bg-[#fbf4e8] px-5 py-12 text-[#2f342d]"><section className="mx-auto max-w-2xl rounded-3xl border border-[#dfd2bd] bg-white p-6 sm:p-10">
    <Link href={`${base}/orders/`} className="underline">Your orders</Link><h1 className="brand-copy mt-6 text-3xl">Order and payment status</h1>
    {loading?<p className="mt-4">Checking your account…</p>:!user?<><p className="mt-4">Sign in with the account used at checkout to view this order.</p><button onClick={()=>void signIn().catch(e=>setError(e.message))} className="mt-5 rounded-xl bg-[#5e684f] px-5 py-3 text-white">Sign in</button></>:<>
      {error?<p role="alert" className="mt-4 text-red-700">{error}</p>:null}
      {!result&&!error?<p className="mt-5" role="status">Checking payment with the server<LoadingDots /></p>:null}
      {order?<><p className="mt-5 break-all text-sm">Order #{order.id||result?.internalOrderId}</p><p className="mt-4 text-xl font-semibold">{paymentLabel(order)}</p><p className="mt-2">{fulfilmentLabel(order)}</p>
        {order.attentionRequired?<p className="mt-4">Your order needs attention. Any confirmed payment is recorded. Please check this status or contact us before making another payment.</p>:null}
        {order.reservationState==="held"?<p className="mt-4">Your pieces are temporarily reserved. Resume this checkout or release the reservation to change your bag.</p>:null}
        <p className="mt-5 text-xl">Total: ₹{((order.amountPaise||0)/100).toFixed(2)}</p>
        <ul className="mt-4 space-y-2">{order.cartItems?.map(item=><li key={item.productId||item.sku}>{item.name} × {item.quantity}</li>)}</ul>
        <div className="mt-6 flex flex-wrap gap-3">
          {result?.canPay?<button disabled={busy} aria-busy={pendingAction==="resume"} aria-live="polite" onClick={()=>void resume()} className="inline-flex items-center justify-center rounded-xl bg-[#5e684f] px-5 py-3 text-white disabled:cursor-wait disabled:opacity-70">{pendingAction==="resume"?<>Resuming payment<LoadingDots /></>:"Resume payment"}</button>:null}
          {order.reservationState==="held"&&!order.paymentCaptured?<button disabled={busy} aria-busy={pendingAction==="cancel"} aria-live="polite" onClick={()=>void cancel()} className="inline-flex items-center justify-center rounded-xl border px-5 py-3 disabled:cursor-wait disabled:opacity-70">{pendingAction==="cancel"?<>Cancelling reservation<LoadingDots /></>:"Cancel reservation"}</button>:null}
          {order.paymentCaptured&&result?.confirmation?<button onClick={()=>openOrderReceiptPreview(result.confirmation!)} className="rounded-xl border px-5 py-3">View receipt</button>:null}
          {order.reservationState==="released"&&!order.paymentCaptured?<Link href={`${base}/checkout/`} className="rounded-xl bg-[#5e684f] px-5 py-3 !text-white">Return to bag</Link>:null}
        </div>
      </>:result?<p className="mt-5">No order found. Open your order history to check earlier purchases.</p>:null}
      <button disabled={busy} className="mt-6 underline" onClick={()=>setTick(t=>t+1)}>Check status again</button>
    </>}
    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
      <Link className="inline-flex min-h-12 items-center justify-center rounded-xl border border-transparent bg-[#5e684f] px-5 py-3 text-center font-semibold !text-white transition-colors hover:bg-[#4d5740] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5e684f] sm:flex-1" href={mobile?"/app/search/":"/shop/"}>Continue shopping</Link>
      {mobile ? <MobileContactButton className={contactClassName} /> : <Link className={contactClassName} href="/contact/">Contact us</Link>}
    </div>
  </section></main>;
}
