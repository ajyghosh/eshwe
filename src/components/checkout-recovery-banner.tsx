"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthSession } from "@/components/auth-provider";
import { checkCheckout } from "@/lib/checkout";
import { useCart } from "@/components/cart-provider";
import { useFavorites } from "@/components/favorites-provider";

export function CheckoutRecoveryBanner(){
  const {user}=useAuthSession();const path=usePathname()||"";const cart=useCart();const favorites=useFavorites();const [pending,setPending]=useState<{uid:string;id:string}|null>(null);const [error,setError]=useState<string|null>(null);
  const checkout=/\/(checkout|payment)\/?$/.test(path);
  useEffect(()=>{if(!checkout||!user)return;let active=true;const refresh=()=>{void checkCheckout().then(result=>{if(!active)return;setError(null);setPending(result.order?.reservationState==="held"||result.order?.attentionRequired?{uid:user.uid,id:result.internalOrderId}:null);}).catch(()=>{if(active)setError("Unable to check an earlier payment. Check order history before paying again.");});};refresh();window.addEventListener("eshwe-checkout",refresh);return()=>{active=false;window.removeEventListener("eshwe-checkout",refresh);};},[checkout,user]);
  const messages=[cart.syncError,favorites.syncError,checkout?error:null].filter((message):message is string=>Boolean(message));
  const active=pending?.uid===user?.uid?pending:null;
  if(!messages.length&&(!checkout||(!active&&cart.stockReady)))return null;
  return <aside className="relative z-40 border-b border-[#dcc9ad] bg-[#fff3dd] px-5 py-3 text-center text-sm text-[#3f4738]" role="status">
    {messages.map(message=><p key={message}>{message}</p>)}
    {checkout&&!cart.stockReady?<p>Waiting for a fresh stock update. Check your connection before starting payment.</p>:null}
    {checkout&&active?<Link className="font-semibold underline" href={`${path.startsWith('/app')?'/app':''}/order-confirmation/?order=${encodeURIComponent(active.id)}`}>You have a checkout in progress. Resume or check payment</Link>:null}
  </aside>;
}
