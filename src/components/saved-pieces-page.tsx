"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuthSession } from "@/components/auth-provider";
import { useCart } from "@/components/cart-provider";
import { FavoriteToggleButton } from "@/components/favorite-toggle-button";
import { useFavorites } from "@/components/favorites-provider";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { getPurchasableQuantityLimit, isProductPurchasable } from "@/lib/inventory";
import { subscribeToSarees } from "@/lib/sarees";
import { buildProductDetailHref } from "@/lib/storefront-routes";
import type { Saree } from "@/types/saree";

export function SavedPiecesPage() {
  const { user, loading, signIn } = useAuthSession();
  const { favoriteSkus, favoritesCount } = useFavorites();
  const { addItem, items, removeItem, updateQuantity } = useCart();
  const [products, setProducts] = useState<Saree[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setProducts([]);
      setProductsLoading(false);
      return;
    }

    setProductsLoading(true);
    return subscribeToSarees(
      (nextProducts) => {
        setProducts(nextProducts.filter((product) => product.status !== "draft"));
        setProductsLoading(false);
      },
      { status: ["active", "out_of_stock"] },
      () => {
        setProducts([]);
        setProductsLoading(false);
      }
    );
  }, [user?.uid]);

  const savedProducts = useMemo(() => {
    const bySku = new Map(products.map((product) => [product.sku, product]));
    return favoriteSkus.map((sku) => bySku.get(sku)).filter((product): product is Saree => Boolean(product));
  }, [favoriteSkus, products]);
  const unavailableCount = Math.max(favoritesCount - savedProducts.length, 0);

  async function handleSignIn() {
    try {
      setSignInError(null);
      await signIn();
    } catch {
      setSignInError("Sign in failed.");
    }
  }

  return (
    <div className="min-h-screen bg-[#fbf4e8] text-[#2b2a29]">
      <StorefrontHeader />
      <main className="web-storefront px-6 py-10 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">FAVORITES</p>
              <h1 className="brand-copy mt-3 text-3xl leading-tight text-[#2b2a29] sm:text-[2.8rem]">Saved pieces</h1>
              <p className="mt-3 text-sm leading-7 text-[#667056]">Sarees you marked to revisit later.</p>
            </div>
            {user ? <span className="rounded-full bg-white/72 px-4 py-2 text-xs font-semibold text-[#5e684f]">{favoritesCount}</span> : null}
          </div>

          {loading ? (
            <section className="web-surface rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8 text-sm text-[#667056] shadow-[0_22px_60px_rgba(94,104,79,0.08)]">Checking your account...</section>
          ) : !user ? (
            <section className="web-surface rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8 shadow-[0_22px_60px_rgba(94,104,79,0.08)]">
              <h2 className="brand-copy text-3xl text-[#2b2a29]">Sign in to view saved pieces</h2>
              <p className="mt-4 text-sm leading-7 text-[#667056]">Use your account to revisit sarees you saved while browsing.</p>
              <button type="button" onClick={() => void handleSignIn()} className="brand-caption mt-8 inline-flex rounded-2xl bg-[#5e684f] px-6 py-3 text-[0.66rem] font-semibold tracking-[0.08em] text-[#fbf4e8]">CONTINUE WITH SMS</button>
              {signInError ? <p className="mt-4 text-sm text-[#9d4b45]">{signInError}</p> : null}
            </section>
          ) : productsLoading && favoritesCount > 0 ? (
            <p className="text-sm text-[#667056]">Loading your saved pieces...</p>
          ) : favoritesCount === 0 ? (
            <EmptySavedPieces>No favorites yet. Tap the heart on any saree to save it here.</EmptySavedPieces>
          ) : savedProducts.length === 0 ? (
            <EmptySavedPieces>Your saved sarees are not available to display right now.</EmptySavedPieces>
          ) : (
            <>
              {unavailableCount > 0 ? <p className="mb-4 text-sm text-[#667056]">{unavailableCount} saved {unavailableCount === 1 ? "piece is" : "pieces are"} unavailable right now.</p> : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
                {savedProducts.map((product) => (
                  <SavedPieceTile
                    key={product.sku}
                    product={product}
                    cartQuantity={items.find((item) => item.sku === product.sku)?.quantity ?? 0}
                    onAddToBag={() => isProductPurchasable(product) && addItem(product, 1)}
                    onDecreaseQuantity={() => updateQuantity(product.sku, (items.find((item) => item.sku === product.sku)?.quantity ?? 0) - 1)}
                    onIncreaseQuantity={() => updateQuantity(product.sku, (items.find((item) => item.sku === product.sku)?.quantity ?? 0) + 1)}
                    onRemoveFromBag={() => removeItem(product.sku)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
      <SiteFooter homeHref="/" contactId="contact" />
    </div>
  );
}

function EmptySavedPieces({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[1.3rem] border border-dashed border-[#d8cbb7] bg-[#fbf4e8] p-6 text-sm leading-7 text-[#667056]">{children}</div>;
}

function SavedPieceTile({ product, cartQuantity, onAddToBag, onDecreaseQuantity, onIncreaseQuantity, onRemoveFromBag }: { product: Saree; cartQuantity: number; onAddToBag: () => void; onDecreaseQuantity: () => void; onIncreaseQuantity: () => void; onRemoveFromBag: () => void }) {
  const inBag = cartQuantity > 0;
  const canIncrease = cartQuantity < getPurchasableQuantityLimit(product.availableStock);
  const href = buildProductDetailHref(product.slug);
  return <article className="flex h-full flex-col overflow-hidden rounded-[1.1rem] border border-[#e4d8c8] bg-[#fffaf2] p-2.5 shadow-[0_10px_24px_rgba(94,104,79,0.04)]"><div className="relative"><Link href={href} className="block"><div className="aspect-square w-full rounded-[0.8rem] border border-[#eadfce] bg-[#efe5d7]" style={{ backgroundImage: product.primaryImageUrl ? `linear-gradient(180deg, rgba(255,249,236,0.05), rgba(43,24,14,0.1)), url('${product.primaryImageUrl}')` : "linear-gradient(180deg, #e8dfd4 0%, #b7b2ad 100%)", backgroundPosition: "center", backgroundSize: "cover" }} /></Link><FavoriteToggleButton sku={product.sku} className="absolute right-2.5 top-2.5 h-9 w-9 border-white/65 bg-[#fbf4e8]/88" /></div><div className="flex flex-1 flex-col px-1 pb-1 pt-3"><Link href={href} className="block"><h2 className="brand-copy line-clamp-2 text-base leading-snug text-[#2b2a29]">{product.name}</h2></Link><p className="mt-1 text-sm text-[#667056]">{product.fabric}{product.color ? ` · ${product.color}` : ""}</p><div className="mt-2 flex flex-wrap items-center gap-3"><span className="text-sm font-semibold text-[#1f1a17]">{formatCurrency(product.price)}</span>{typeof product.originalPrice === "number" ? <span className="text-sm text-[#8d8b87] line-through">{formatCurrency(product.originalPrice)}</span> : null}{product.status === "out_of_stock" ? <span className="rounded-full bg-[#efe4c6] px-2.5 py-1 text-[0.66rem] font-semibold text-[#5e684f]">OUT OF STOCK</span> : null}</div><div className="mt-4 flex flex-wrap items-center gap-2">{product.status === "out_of_stock" ? null : inBag ? <><div className="inline-flex items-center rounded-full bg-[#5e684f] px-1.5 py-1 text-[#fbf4e8]"><button type="button" onClick={onDecreaseQuantity} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-base leading-none" aria-label="Decrease quantity">-</button><span className="min-w-[1.75rem] text-center text-[0.76rem] font-semibold">{cartQuantity}</span><button type="button" onClick={onIncreaseQuantity} disabled={!canIncrease} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-base leading-none disabled:opacity-45" aria-label="Increase quantity">+</button></div><button type="button" onClick={onRemoveFromBag} className="brand-caption inline-flex items-center justify-center rounded-full border border-[#d6ccb9] px-3 py-2.5 text-[0.55rem] font-semibold tracking-[0.08em] text-[#8d5c56]">REMOVE FROM BAG</button></> : <button type="button" onClick={onAddToBag} className="brand-caption inline-flex items-center justify-center rounded-full bg-[#5e684f] px-3 py-2.5 text-[0.55rem] font-semibold tracking-[0.08em] text-[#fbf4e8]">ADD TO BAG</button>}</div></div></article>;
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value || 0);
}
