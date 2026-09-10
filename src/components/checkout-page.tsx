"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  CatalogueProductCard,
  ProductLoadingGrid,
  formatCurrency
} from "@/components/catalogue-product-card";
import { useCart } from "@/components/cart-provider";
import { CheckoutProgress } from "@/components/checkout-progress";
import { ProductCardCarousel } from "@/components/product-card-carousel";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { getPurchasableQuantityLimit, isCartItemUnavailable, isProductPurchasable } from "@/lib/inventory";
import { getProductDiscoveryTags } from "@/lib/product-discovery";
import { subscribeToSarees } from "@/lib/sarees";
import { buildProductDetailHref } from "@/lib/storefront-routes";
import type { CartItem } from "@/types/cart";
import type { Saree } from "@/types/saree";

const MAX_CHECKOUT_RECOMMENDATIONS = 6;

export function CheckoutPage() {
  const { items, subtotal, savings, shippingFee, packagingFee, total, updateQuantity, removeItem, clearCart } =
    useCart();
  const [products, setProducts] = useState<Saree[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const hasUnavailableItems = items.some((item) => isCartItemUnavailable(item));
  const canContinueToPayment = items.length > 0 && !hasUnavailableItems;
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);
  const subtotalLabel = `Subtotal${itemCount > 0 ? ` (${itemCount} item${itemCount === 1 ? "" : "s"})` : ""}`;

  useEffect(() => {
    return subscribeToSarees(
      (nextProducts) => {
        setProducts(nextProducts.filter((product) => product.status !== "draft"));
        setRecommendationsLoading(false);
      },
      { status: ["active", "out_of_stock"] },
      () => {
        setProducts([]);
        setRecommendationsLoading(false);
      }
    );
  }, []);

  const recommendationState = useMemo(
    () => buildCheckoutRecommendations(products, items),
    [items, products]
  );

  return (
    <main className="web-storefront web-checkout min-h-screen bg-[#fbf4e8] text-[#4f5942]">
      <StorefrontHeader />

      <section className="px-6 py-10 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <CheckoutProgress currentStep="bag" />
          <div className="mb-8">
            <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">CHECKOUT</p>
            <h1 className="brand-copy mt-3 text-3xl leading-tight text-[#2b2a29] sm:text-[2.8rem]">
              Review your bag before secure checkout.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#667056]">
              Confirm quantities here. Address and payment happen in the next step.
            </p>
          </div>

          <div className="web-checkout-grid grid items-start gap-8 xl:grid-cols-[minmax(0,1.15fr)_390px]">
            <div className="space-y-8">
              <section className="web-surface rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-6 shadow-[0_22px_60px_rgba(94,104,79,0.08)] sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="brand-copy text-2xl text-[#2b2a29]">Cart Items</h2>
                  </div>

                  {items.length > 0 ? (
                    <button
                      type="button"
                      onClick={clearCart}
                      className="text-sm font-medium text-[#9d4b45] transition-opacity duration-200 hover:opacity-70"
                    >
                      Clear cart
                    </button>
                  ) : null}
                </div>

                {items.length === 0 ? (
                  <div className="mt-6 rounded-[1.6rem] border border-dashed border-[#d8cbb7] bg-[#fbf4e8] p-8 text-center">
                    <p className="text-sm leading-7 text-[#667056]">
                      Your cart is empty. Add a few sarees from the catalogue to start checkout.
                    </p>
                    <Link
                      href="/shop"
                      className="brand-caption mt-5 inline-flex rounded-full bg-[#5e684f] px-6 py-3 text-[0.64rem] font-semibold tracking-[0.12em] text-[#fbf4e8]"
                    >
                      CONTINUE SHOPPING
                    </Link>
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {items.map((item) => (
                      <CheckoutItemCard
                        key={item.sku}
                        item={item}
                        onDecrease={() => updateQuantity(item.sku, item.quantity - 1)}
                        onIncrease={() => updateQuantity(item.sku, item.quantity + 1)}
                        onRemove={() => removeItem(item.sku)}
                      />
                    ))}

                    {hasUnavailableItems ? (
                      <div className="rounded-[1.3rem] border border-[#e2c8bc] bg-[#fff2ed] px-4 py-3 text-sm leading-6 text-[#9d4b45]">
                        One or more sarees in your bag are no longer available. Remove them to continue to payment.
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <CheckoutBenefit
                    icon={
                      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-none stroke-current stroke-[1.7]">
                        <path d="M2.5 6.5h11v8.5h-11z" />
                        <path d="M13.5 9h3l2.5 2.5v3.5h-5.5" />
                        <path d="M6 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                        <path d="M16.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                        <path d="M3.5 15.5H4" />
                        <path d="M13.5 15.5H12" />
                      </svg>
                    }
                    title="Free Shipping"
                    description="On all prepaid orders"
                  />
                  <CheckoutBenefit
                    icon={
                      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-none stroke-current stroke-[1.7]">
                        <path d="M12 3.5 5.5 6v5.7c0 3.9 2.4 7.3 6.5 8.8 4.1-1.5 6.5-4.9 6.5-8.8V6L12 3.5Z" />
                        <path d="m9.3 11.8 1.8 1.8 3.7-4.1" />
                      </svg>
                    }
                    title="Secure Payments"
                    description="100% protected"
                  />
                  <CheckoutBenefit
                    icon={
                      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-none stroke-current stroke-[1.7]">
                        <path d="M12 4.2 14 5a3.8 3.8 0 0 0 3.3 0l2-.8v5.2c0 3.4-2.2 6.5-5.4 7.6L12 17.8l-1.9-.8C6.9 15.9 4.7 12.8 4.7 9.4V4.2l2 .8A3.8 3.8 0 0 0 10 5l2-.8Z" />
                        <path d="m9.2 11.6 1.4 1.4 2.8-3.2" />
                        <path d="m8.1 17.2-.9 2.8 2.6-1.1L12 21l2.2-2.1 2.6 1.1-.9-2.8" />
                      </svg>
                    }
                    title="Quality Assured"
                    description="Handpicked with care"
                  />
                </div>
              </section>

            </div>

            <aside className="web-order-summary space-y-6">
              <section className="web-surface rounded-[2rem] border border-[#dfd4c5] bg-[#fffdf8] p-5 shadow-[0_24px_60px_rgba(94,104,79,0.08)] sm:p-6">
                <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#2b2a29]">
                  CHECKOUT SUMMARY
                </p>
                <p className="mt-3 text-sm leading-6 text-[#667056]">
                  Your address and payment will be completed in the secure Razorpay step.
                </p>

                <div className="mt-5 space-y-4 text-sm text-[#5f6259]">
                  <SummaryRow label={subtotalLabel} value={formatCurrency(subtotal)} />
                  <SummaryRow
                    label="Shipping"
                    value={shippingFee === 0 && subtotal > 0 ? "Free" : formatCurrency(shippingFee)}
                    valueClassName={shippingFee === 0 && subtotal > 0 ? "text-[#5e684f]" : undefined}
                  />
                  <SummaryRow
                    label="Packaging"
                    value={packagingFee === 0 && subtotal > 0 ? "Free" : formatCurrency(packagingFee)}
                    valueClassName={packagingFee === 0 && subtotal > 0 ? "text-[#5e684f]" : undefined}
                  />
                  {savings > 0 ? (
                    <SummaryRow
                      label="Product savings"
                      value={`-${formatCurrency(savings)}`}
                      valueClassName="text-[#b85b52]"
                    />
                  ) : null}
                </div>

                <div className="mt-6 border-t border-[#e9dfd1] pt-5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="brand-copy text-[1.7rem] leading-none text-[#2b2a29]">Total</span>
                    <span className="text-[1.8rem] font-semibold leading-none text-[#2b2a29]">{formatCurrency(total)}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#9a9a93]">
                    Inclusive of all taxes
                  </p>
                </div>

                <Link
                  href={canContinueToPayment ? "/payment" : "/checkout"}
                  aria-disabled={!canContinueToPayment}
                  className={`brand-caption mt-5 inline-flex w-full items-center justify-center gap-2.5 rounded-[1rem] px-5 py-3.5 text-[0.68rem] font-semibold tracking-[0.14em] !text-[#fbf4e8] ${
                    canContinueToPayment ? "bg-[#5e684f]" : "cursor-not-allowed bg-[#c8c2b6]"
                  }`}
                  onClick={(event) => {
                    if (!canContinueToPayment) {
                      event.preventDefault();
                    }
                  }}
                >
                  <span aria-hidden="true" className="inline-flex">
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-none stroke-current stroke-[1.8]">
                      <path d="M6.5 8V6.5a3.5 3.5 0 1 1 7 0V8" />
                      <rect x="4.5" y="8" width="11" height="8.5" rx="2" />
                    </svg>
                  </span>
                  {items.length === 0
                    ? "ADD ITEMS TO CONTINUE"
                    : hasUnavailableItems
                      ? "REMOVE UNAVAILABLE ITEMS"
                      : "CONTINUE TO ADDRESS"}
                </Link>

              </section>
            </aside>
          </div>

          {items.length > 0 && (recommendationsLoading || recommendationState.products.length > 0) ? (
            <section className="web-surface mt-10 rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] px-5 py-6 shadow-[0_22px_60px_rgba(94,104,79,0.08)] sm:px-7 sm:py-7 lg:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                    YOU MAY ALSO LIKE
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[#667056]">{recommendationState.description}</p>
                </div>
                {!recommendationsLoading && recommendationState.products.length > 0 ? (
                  <p className="text-sm text-[#667056]">
                    {recommendationState.products.length} more saree
                    {recommendationState.products.length === 1 ? "" : "s"} selected for this checkout
                  </p>
                ) : null}
              </div>

              <div className="mt-8">
                {recommendationsLoading ? (
                  <ProductLoadingGrid count={4} />
                ) : recommendationState.products.length > 4 ? (
                  <ProductCardCarousel
                    products={recommendationState.products}
                    buttonLabel="ADD"
                    maxWidthClassName="max-w-none"
                    cardClassName="w-[220px] shrink-0 snap-start sm:w-[250px] lg:w-[280px] xl:w-[calc((100%-10rem)/6)]"
                  />
                ) : (
                  <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
                    {recommendationState.products.map((product) => (
                      <CatalogueProductCard
                        key={product.id ?? product.sku}
                        product={product}
                        buttonLabel="ADD"
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </div>
      </section>

      <SiteFooter homeHref="/" contactId="contact" />
    </main>
  );
}

function CheckoutItemCard({
  item,
  onDecrease,
  onIncrease,
  onRemove
}: {
  item: CartItem;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
}) {
  const isUnavailable = isCartItemUnavailable(item);
  const canIncreaseQuantity = !isUnavailable && item.quantity < getPurchasableQuantityLimit(item.availableStock);

  return (
    <article className="grid gap-3 rounded-[1.5rem] border border-[#ddd1c0] bg-[#fbf7ef] p-3 sm:grid-cols-[82px_minmax(0,1fr)]">
      <div
        className="aspect-[0.84] rounded-[1.15rem] bg-[#efe5d7]"
        style={{
          backgroundImage: item.primaryImageUrl
            ? `linear-gradient(180deg, rgba(255,249,236,0.04), rgba(43,24,14,0.08)), url('${item.primaryImageUrl}')`
            : "linear-gradient(180deg, #e8dfd4 0%, #b7b2ad 100%)",
          backgroundPosition: "center",
          backgroundSize: "cover"
        }}
      />

      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="brand-copy text-xl text-[#2b2a29]">{item.name}</p>
            <p className="mt-1 text-sm text-[#667056]">
              {item.sku} · {item.fabric} · {item.color}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-lg font-semibold text-[#2b2a29]">{formatCurrency(item.price * item.quantity)}</p>
            {typeof item.originalPrice === "number" && item.originalPrice > item.price ? (
              <p className="text-sm text-[#8d8b87] line-through">
                {formatCurrency(item.originalPrice * item.quantity)}
              </p>
            ) : null}
          </div>
        </div>

        {isUnavailable ? (
          <p className="text-sm font-medium text-[#9d4b45]">
            This saree is no longer available. Remove it to continue.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center rounded-full border border-[#d6ccb9] bg-white/70 p-0.5">
            <QuantityButton label="Decrease quantity" onClick={onDecrease}>
              −
            </QuantityButton>
            <span className="min-w-10 px-1 text-center text-sm font-semibold text-[#2b2a29]">{item.quantity}</span>
            <QuantityButton label="Increase quantity" onClick={onIncrease} disabled={!canIncreaseQuantity}>
              +
            </QuantityButton>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href={buildProductDetailHref(item.slug)}
              className="text-sm font-medium text-[#5e684f] underline decoration-1 underline-offset-4"
            >
              View product
            </Link>
            <button type="button" onClick={onRemove} className="text-sm font-medium text-[#9d4b45]">
              Remove
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function QuantityButton({
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
      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3eadb] text-lg text-[#4f5942] disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}

function SummaryRow({
  label,
  value,
  valueClassName
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <span className={`font-medium text-[#2b2a29] ${valueClassName ?? ""}`}>{value}</span>
    </div>
  );
}

function buildCheckoutRecommendations(products: Saree[], cartItems: CartItem[]) {
  const cartSkus = new Set(cartItems.map((item) => item.sku));
  const cartProducts = products.filter((product) => cartSkus.has(product.sku));
  const dominantCategory = getDominantCartCategory(products, cartItems);
  const cartTags = new Set(cartProducts.flatMap((product) => getProductDiscoveryTags(product)));
  const recommendations = products
    .filter((product) => !cartSkus.has(product.sku) && isProductPurchasable(product))
    .map((product) => ({
      product,
      score: getCheckoutRecommendationScore(product, dominantCategory, cartTags)
    }))
    .sort((left, right) => right.score - left.score)
    .map(({ product }) => product)
    .slice(0, MAX_CHECKOUT_RECOMMENDATIONS);
  const usesDominantCategory = Boolean(dominantCategory && recommendations.some((product) => product.category === dominantCategory));
  const usesSharedIntent = recommendations.some((product) => getProductDiscoveryTags(product).some((tag) => cartTags.has(tag)));

  return {
    description: usesSharedIntent
      ? "Similar picks chosen from the same shopping intent already in your bag."
      : usesDominantCategory
        ? `More ${dominantCategory} sarees picked to match what is already in your bag.`
        : "A few more in-stock sarees from the current collection.",
    products: recommendations
  };
}

function getDominantCartCategory(products: Saree[], cartItems: CartItem[]) {
  const categoryTotals = new Map<string, number>();

  cartItems.forEach((item) => {
    const matchingProduct = products.find((product) => product.sku === item.sku || product.slug === item.slug);
    const category = matchingProduct?.category?.trim();

    if (!category) {
      return;
    }

    categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + item.quantity);
  });

  let dominantCategory = "";
  let dominantCount = 0;

  categoryTotals.forEach((count, category) => {
    if (count > dominantCount) {
      dominantCategory = category;
      dominantCount = count;
    }
  });

  return dominantCategory;
}

function getCheckoutRecommendationScore(product: Saree, dominantCategory: string, cartTags: Set<string>) {
  let score = 0;

  if (product.category === dominantCategory) {
    score += 8;
  }

  if (product.featured) {
    score += 3;
  }

  getProductDiscoveryTags(product).forEach((tag) => {
    if (cartTags.has(tag)) {
      score += 5;
    }
  });

  return score;
}

function CheckoutBenefit({
  icon,
  title,
  description
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[84px] flex-col items-center justify-center rounded-[1.2rem] bg-[#f5eee2] px-4 py-3 text-center text-[#a89667]">
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
      <div className="mt-2 min-w-0">
        <p className="text-xs font-medium leading-none text-[#2b2a29]">{title}</p>
        <p className="mt-1 text-[0.68rem] leading-4 text-[#7f7c73]">{description}</p>
      </div>
    </div>
  );
}
