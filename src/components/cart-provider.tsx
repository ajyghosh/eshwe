"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuthSession } from "@/components/auth-provider";
import { clampCartQuantityToStock, isProductPurchasable } from "@/lib/inventory";
import { normalizeCart, syncCartItemsWithCatalogue } from "@/lib/cart-state";
import { createCustomerCartSession } from "@/lib/customer-cart-session";
import { subscribeToSarees } from "@/lib/sarees";
import type { Saree } from "@/types/saree";
import type { CartItem } from "@/types/cart";

const GUEST_KEY = "eshwe-cart-v1:guest";
const CLEAR_KEY = "eshwe.clearCartAfterPayment";
type CartContextValue = {
  items: CartItem[]; isReady: boolean; isSyncing: boolean; stockReady: boolean; syncError: string | null;
  subtotal: number; savings: number; shippingFee: number; packagingFee: number; total: number; totalItems: number;
  addItem: (product: Saree, quantity?: number) => void;
  updateQuantity: (sku: string, quantity: number) => void;
  removeItem: (sku: string) => void; clearCart: () => void;
};
const CartContext=createContext<CartContextValue|null>(null);
function readGuest() { try{return normalizeCart(JSON.parse(localStorage.getItem(GUEST_KEY)||"[]"));}catch{return [];} }
function writeGuest(items: CartItem[]) { localStorage.setItem(GUEST_KEY,JSON.stringify(items));window.dispatchEvent(new Event("eshwe-guest-cart")); }

export function CartProvider({children}:{children:ReactNode}) {
  const {user,loading}=useAuthSession();
  const [rawItems,setRawItems]=useState<CartItem[]>([]);
  const [resolvedUser,setResolvedUser]=useState<string|null>(null);
  const [catalogue,setCatalogue]=useState<Saree[]>([]);
  const [stockReady,setStockReady]=useState(false);
  const [syncError,setSyncError]=useState<string|null>(null);
  const [isSyncing,setIsSyncing]=useState(false);
  const cartSync=useRef<{ uid: string; sync: ReturnType<typeof createCustomerCartSession> } | null>(null);
  const [online,setOnline]=useState(true);
  const owner=user?.uid||"guest";
  useEffect(()=>{
    const connected=()=>setOnline(navigator.onLine);connected();window.addEventListener("online",connected);window.addEventListener("offline",connected);
    return()=>{window.removeEventListener("online",connected);window.removeEventListener("offline",connected);};
  },[]);
  useEffect(()=>{
    if(loading)return;
    setRawItems([]);setResolvedUser(null);setSyncError(null);setIsSyncing(false);
    if(!user){
      const sync=()=>{setRawItems(readGuest());setResolvedUser("guest");};sync();
      const storage=(event:StorageEvent)=>{if(event.key===GUEST_KEY||event.key===null)sync();};
      window.addEventListener("storage",storage);window.addEventListener("eshwe-guest-cart",sync);
      return()=>{window.removeEventListener("storage",storage);window.removeEventListener("eshwe-guest-cart",sync);};
    }
    const uid=user.uid;
    const sync=createCustomerCartSession(uid,localStorage,GUEST_KEY,(items,pending,ready)=>{setRawItems(items);setIsSyncing(pending);setResolvedUser(ready?uid:null);},setSyncError);
    cartSync.current={uid,sync};
    return()=>{sync.dispose();cartSync.current=null;};
  },[loading,user]);
  useEffect(()=>{
    setStockReady(false);
    return subscribeToSarees(products=>{setCatalogue(products);},{status:["active","out_of_stock"]},error=>{setStockReady(false);setSyncError(error.message);},fresh=>setStockReady(fresh));
  },[online]);
  const items=useMemo(()=>resolvedUser!==owner?[]:syncCartItemsWithCatalogue(rawItems,catalogue),[rawItems,catalogue,resolvedUser,owner]);
  const value=useMemo<CartContextValue>(()=>{
    function change(fn:(items:CartItem[])=>CartItem[]){
      setSyncError(null);
      if(user){if(resolvedUser===user.uid&&cartSync.current?.uid===user.uid){cartSync.current.sync.change(fn);}}
      else {try{const next=fn(readGuest());writeGuest(next);setRawItems(next);setResolvedUser("guest");}catch{setSyncError("Your browser could not save the bag. Please allow site storage.");}}
    }
    const subtotal=items.reduce((sum,item)=>sum+item.price*item.quantity,0);
    return {items,isReady:resolvedUser===owner,isSyncing,stockReady:stockReady&&online,syncError,subtotal,savings:items.reduce((sum,item)=>sum+Math.max(0,(item.originalPrice||item.price)-item.price)*item.quantity,0),shippingFee:0,packagingFee:0,total:subtotal,totalItems:items.reduce((sum,item)=>sum+item.quantity,0),
      addItem(product,quantity=1){if(!isProductPurchasable(product)||!Number.isInteger(quantity)||quantity<1)return;change(current=>{const latest=syncCartItemsWithCatalogue(current,catalogue);const existing=latest.find(item=>(Boolean(product.id)&&item.productId===product.id)||item.sku===product.sku);const next={productId:product.id,sku:product.sku,slug:product.slug,name:product.name,price:product.price,originalPrice:product.originalPrice??null,primaryImageUrl:product.primaryImageUrl,fabric:product.fabric,color:product.color,status:product.status,availableStock:product.availableStock,reservedStock:product.reservedStock??0,quantity:clampCartQuantityToStock((existing?.quantity||0)+quantity,product.availableStock)};return existing?latest.map(item=>item.sku===existing.sku?next:item):[...latest,next];});},
      updateQuantity(sku,quantity){if(!Number.isInteger(quantity)||quantity<0)return;change(current=>quantity===0?current.filter(item=>item.sku!==sku):syncCartItemsWithCatalogue(current,catalogue).map(item=>item.sku===sku?{...item,quantity:clampCartQuantityToStock(quantity,item.availableStock)}:item));},
      removeItem(sku){change(current=>current.filter(item=>item.sku!==sku));},clearCart(){change(()=>[]);}
    };
  },[items,resolvedUser,owner,user,catalogue,stockReady,online,syncError,isSyncing]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart(){const context=useContext(CartContext);if(!context)throw new Error("useCart must be used within CartProvider.");return context;}
export function markCartForPostPaymentClear(){try{sessionStorage.setItem(CLEAR_KEY,"1");}catch{/* Server order still records the payment. */}}
