"use client";

import Link from "next/link";
import { useState } from "react";

import { useCart } from "@/components/cart-provider";
import { FavoriteToggleButton } from "@/components/favorite-toggle-button";
import { NotifyWaitlistDialog } from "@/components/notify-waitlist-dialog";
import { getPurchasableQuantityLimit, isProductPurchasable } from "@/lib/inventory";
import { buildProductDetailHref } from "@/lib/storefront-routes";
import type { Saree } from "@/types/saree";

export function CatalogueProductCard({
  product,
  buttonLabel,
  showDetailButton = true
}: {
  product: Saree;
  buttonLabel?: string;
  showDetailButton?: boolean;
}) {
  const { addItem, items, updateQuantity } = useCart();
  const [waitlistDialogOpen, setWaitlistDialogOpen] = useState(false);
  const cartQuantity = items.find((item) => item.sku === product.sku)?.quantity ?? 0;
  const canIncreaseCartQuantity = cartQuantity < getPurchasableQuantityLimit(product.availableStock);

  function handleAddToCart() {
    if (!isProductPurchasable(product)) {
      return;
    }

    addItem(product, 1);
  }

  function handleDecreaseCartQuantity() {
    if (cartQuantity <= 0) {
      return;
    }

    updateQuantity(product.sku, cartQuantity - 1);
  }

  function handleIncreaseCartQuantity() {
    if (!isProductPurchasable(product) || !canIncreaseCartQuantity) {
      return;
    }

    if (cartQuantity === 0) {
      addItem(product, 1);
      return;
    }

    updateQuantity(product.sku, cartQuantity + 1);
  }

  return (
    <article className="flex flex-col">
      <div className="relative">
        <Link href={buildProductDetailHref(product.slug)} className="group block">
          <ProductMedia product={product} />
        </Link>
        <FavoriteToggleButton sku={product.sku} className="absolute right-5 top-5 z-10" />
      </div>

      <div className="pt-5">
        <Link href={buildProductDetailHref(product.slug)} className="group block">
          <h3 className="brand-copy text-sm text-[#3f4738] transition-colors duration-300 group-hover:text-[#5e684f] sm:text-base">
            {product.name}
          </h3>
          <p className="mt-1 text-[0.68rem] text-[#667056] sm:text-xs">
            {product.sku}
            {"  -  "}
            {product.fabric}
          </p>
        </Link>

        <div className="mt-2 flex flex-wrap items-end gap-4">
          <span className="text-base font-semibold text-[#1f1a17] sm:text-[1.15rem]">
            {formatCurrency(product.price)}
          </span>
          {typeof product.originalPrice === "number" ? (
            <span className="text-base text-[#8d8b87] line-through sm:text-[1.15rem]">
              {formatCurrency(product.originalPrice)}
            </span>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {product.status === "out_of_stock" ? (
            <button
              type="button"
              onClick={() => setWaitlistDialogOpen(true)}
              className="brand-caption inline-flex h-[38px] w-[124px] shrink-0 items-center justify-center rounded-2xl bg-[#3f4738] px-3 text-[0.5rem] font-semibold tracking-[0.05em] text-[#fbf4e8] sm:text-[0.54rem]"
            >
              NOTIFY ME
            </button>
          ) : cartQuantity > 0 ? (
            <div className="grid h-[38px] w-[124px] shrink-0 grid-cols-[28px_1fr_28px] items-center rounded-2xl border border-[#d6ccb9] bg-[#5e684f] px-1 text-[#fbf4e8]">
              <InlineCartButton label="Decrease quantity" onClick={handleDecreaseCartQuantity}>
                -
              </InlineCartButton>
              <span className="text-center text-[0.82rem] font-semibold leading-none">{cartQuantity}</span>
              <InlineCartButton
                label="Increase quantity"
                onClick={handleIncreaseCartQuantity}
                disabled={!canIncreaseCartQuantity}
              >
                +
              </InlineCartButton>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAddToCart}
              className="brand-caption inline-flex h-[38px] w-[124px] shrink-0 items-center justify-center rounded-2xl bg-[#5e684f] px-3 text-[0.5rem] font-semibold tracking-[0.05em] text-[#fbf4e8] sm:text-[0.54rem]"
            >
              {buttonLabel ?? "ADD TO CART"}
            </button>
          )}

          {showDetailButton ? (
            <Link
              href={buildProductDetailHref(product.slug)}
              className="brand-caption inline-flex rounded-2xl border border-[#d6ccb9] px-5 py-2.5 text-[0.52rem] font-semibold tracking-[0.05em] text-[#5e684f] sm:text-[0.58rem]"
            >
              VIEW DETAILS
            </Link>
          ) : null}
        </div>
      </div>

      <NotifyWaitlistDialog
        open={waitlistDialogOpen}
        product={waitlistDialogOpen ? product : null}
        onClose={() => setWaitlistDialogOpen(false)}
      />
    </article>
  );
}

function InlineCartButton({
  label,
  children,
  onClick,
  disabled = false
}: {
  label: string;
  children: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-[26px] w-[26px] items-center justify-center rounded-[0.8rem] bg-[#fbf4e8]/14 text-[0.95rem] leading-none text-[#fbf4e8] transition-colors duration-200 hover:bg-[#fbf4e8]/22 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[#fbf4e8]/14"
    >
      {children}
    </button>
  );
}

export function ProductMedia({ product }: { product: Saree }) {
  const backgroundImage = product.primaryImageUrl
    ? `linear-gradient(180deg, rgba(255,249,236,0.04), rgba(43,24,14,0.08)), url('${product.primaryImageUrl}')`
    : undefined;

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] bg-[#efe5d7]">
      <div
        className="aspect-[0.86] w-full transition-transform duration-500 group-hover:scale-[1.02]"
        style={{
          backgroundImage,
          backgroundPosition: "center",
          backgroundSize: "cover"
        }}
      />

      <div className="absolute left-5 top-5 flex flex-col gap-3">
        {typeof product.discountPercent === "number" && product.discountPercent > 0 ? (
          <span className="brand-caption inline-flex w-fit rounded-[0.85rem] bg-[#5e684f] px-3 py-1.5 text-[0.52rem] font-semibold tracking-[0.05em] text-[#fbf4e8]">
            -{product.discountPercent}%
          </span>
        ) : null}
        {product.status === "out_of_stock" ? (
          <span className="brand-caption inline-flex w-fit rounded-[0.85rem] bg-[#5e684f] px-3 py-1.5 text-[0.52rem] font-semibold tracking-[0.05em] text-[#fbf4e8]">
            OUT OF STOCK
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function ProductLoadingGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="animate-pulse">
          <div className="aspect-[0.86] rounded-[1.75rem] bg-[#e8decf]" />
          <div className="mt-5 h-5 w-3/4 rounded-full bg-[#eadfce]" />
          <div className="mt-3 h-4 w-1/2 rounded-full bg-[#eadfce]" />
          <div className="mt-4 h-6 w-2/3 rounded-full bg-[#eadfce]" />
          <div className="mt-5 h-11 w-32 rounded-full bg-[#d9ceb9]" />
        </div>
      ))}
    </div>
  );
}

export function EmptyCatalogueState({
  title,
  description,
  minHeightClass = "min-h-[10rem]"
}: {
  title?: string;
  description?: string;
  minHeightClass?: string;
}) {
  return (
    <div
      className={`rounded-[1.6rem] border border-dashed border-[#d8cbb7] bg-[#fbf4e8] p-8 text-center ${minHeightClass}`}
    >
      {title || description ? (
        <>
          {title ? <h3 className="brand-copy text-2xl text-[#3f4738]">{title}</h3> : null}
          {description ? <p className="mt-3 text-sm leading-7 text-[#667056]">{description}</p> : null}
        </>
      ) : null}
    </div>
  );
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value);
}
