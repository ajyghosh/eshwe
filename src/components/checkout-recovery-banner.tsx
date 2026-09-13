"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCheckoutRecovery } from "@/components/checkout-recovery-provider";
import { useCart } from "@/components/cart-provider";
import { useFavorites } from "@/components/favorites-provider";

export function CheckoutRecoveryBanner(){
  const path=usePathname()||"";const cart=useCart();const favorites=useFavorites();const {orderId,error}=useCheckoutRecovery();
  const checkout=/\/(checkout|payment)\/?$/.test(path);
  const messages=[cart.syncError,favorites.syncError,checkout?error:null].filter((message):message is string=>Boolean(message));
  if(!messages.length&&(!checkout||(!orderId&&cart.stockReady)))return null;
  return <aside className="relative z-40 border-b border-[#dcc9ad] bg-[#fff3dd] px-5 py-3 text-center text-sm text-[#3f4738]" role="status">
    {messages.map(message=><p key={message}>{message}</p>)}
    {checkout&&!cart.stockReady?<p>Waiting for a fresh stock update. Check your connection before starting payment.</p>:null}
    {checkout&&orderId?<Link className="font-semibold underline" href={`${path.startsWith('/app')?'/app':''}/order-confirmation/?order=${encodeURIComponent(orderId)}`}>You have a checkout in progress. Resume or check payment</Link>:null}
  </aside>;
}
