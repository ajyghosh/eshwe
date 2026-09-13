"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuthSession } from "@/components/auth-provider";
import { claimGuestData } from "@/lib/guest-migration";
import { changeCustomerFavorites, updateCustomerFavorites, subscribeToCustomerProfile } from "@/lib/customer-profiles";
import { createOptimisticList } from "@/lib/optimistic-list";
const KEY="eshwe-favorites-v1:guest";
type FavoritesContextValue={favoriteSkus:string[];favoritesCount:number;isReady:boolean;syncError:string|null;isFavorite:(sku:string)=>boolean;toggleFavorite:(sku:string)=>void;removeFavoriteSkus:(skus:string[])=>void;clearFavorites:()=>void;};
const Context=createContext<FavoritesContextValue|null>(null);
function read(){try{const raw=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(raw)?[...new Set(raw.filter((v):v is string=>typeof v==="string"))]:[];}catch{return [];}}
export function FavoritesProvider({children}:{children:ReactNode}){
  const {user,loading}=useAuthSession();const [skus,setSkus]=useState<string[]>([]);const [resolved,setResolved]=useState<string|null>(null);const [syncError,setSyncError]=useState<string|null>(null);const owner=user?.uid||"guest";
  const favoriteSync=useRef<{uid:string;sync:ReturnType<typeof createOptimisticList<string>>}|null>(null);
  useEffect(()=>{
    if(loading)return;let active=true;setSkus([]);setResolved(null);setSyncError(null);
    if(!user){const sync=()=>{setSkus(read());setResolved("guest");};sync();const storage=(e:StorageEvent)=>{if(e.key===KEY||e.key===null)sync();};window.addEventListener("storage",storage);window.addEventListener("eshwe-favorites",sync);return()=>{window.removeEventListener("storage",storage);window.removeEventListener("eshwe-favorites",sync);};}
    const uid=user.uid;
    const sync=createOptimisticList<string>(change=>updateCustomerFavorites(uid,change),items=>{if(active)setSkus(items);},()=>{if(active)setSyncError("Your wishlist change could not be saved. Please try again.");});
    favoriteSync.current={uid,sync};
    const unsubscribe=subscribeToCustomerProfile(uid,profile=>{if(active){sync.receive({items:profile?.favoriteSkus||[],revision:profile?.favoriteRevision||0});setResolved(uid);}},error=>{if(active)setSyncError(error.message);});
    try { for (const job of claimGuestData(localStorage, KEY, uid)) void changeCustomerFavorites(uid, job.items.filter((value): value is string => typeof value === "string"), [], job.id).then(() => localStorage.removeItem(job.key)).catch(error => { if (active) setSyncError(error.message); }); }
    catch { setSyncError("Your browser could not prepare wishlist syncing. Please allow site storage."); }
    return()=>{active=false;sync.dispose();favoriteSync.current=null;unsubscribe();};
  },[loading,user]);
  const value=useMemo<FavoritesContextValue>(()=>{
    const visible=resolved===owner?skus:[];
    function change(add:string[],remove:string[]){setSyncError(null);const apply=(items:string[])=>[...new Set([...items.filter(s=>!remove.includes(s)),...add])];if(user){if(favoriteSync.current?.uid===user.uid){setResolved(user.uid);favoriteSync.current.sync.change(apply);}}else{try{const next=apply(read());localStorage.setItem(KEY,JSON.stringify(next));window.dispatchEvent(new Event("eshwe-favorites"));setSkus(next);setResolved("guest");}catch{setSyncError("Your browser could not save the wishlist.");}}}
    return{favoriteSkus:visible,favoritesCount:visible.length,isReady:resolved===owner,syncError,isFavorite:sku=>visible.includes(sku),toggleFavorite:sku=>change(visible.includes(sku)?[]:[sku],visible.includes(sku)?[sku]:[]),removeFavoriteSkus:skus=>change([],skus),clearFavorites:()=>change([],visible)};
  },[skus,resolved,owner,user,syncError]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useFavorites(){const context=useContext(Context);if(!context)throw new Error("useFavorites must be used within FavoritesProvider.");return context;}
