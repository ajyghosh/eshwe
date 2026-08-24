"use client";

import Link from "next/link";

import { formatCurrency } from "@/components/catalogue-product-card";
import { useCart } from "@/components/cart-provider";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { buildProductDetailHref } from "@/lib/storefront-routes";

export function CheckoutPage() {
  const { items, subtotal, savings, shippingFee, packagingFee, total, updateQuantity, removeItem, clearCart } =
    useCart();

  return (
    <main className="min-h-screen bg-[#fbf4e8] text-[#4f5942]">
      <StorefrontHeader />

      <section className="px-6 py-10 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">CHECKOUT</p>
            <h1 className="brand-copy mt-3 text-3xl leading-tight text-[#2b2a29] sm:text-[2.8rem]">
              Review your bag and continue to payment.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#667056]">
              Keep the cart focused here. Address details, sign in, and Razorpay payment are handled in the next step.
            </p>
          </div>

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_390px]">
            <section className="rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-6 shadow-[0_22px_60px_rgba(94,104,79,0.08)] sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="brand-copy text-2xl text-[#2b2a29]">Cart Items</h2>
                  <p className="mt-2 text-sm leading-6 text-[#667056]">
                    Review items, adjust quantities, and remove anything you do not want.
                  </p>
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
                    <article
                      key={item.sku}
                      className="grid gap-4 rounded-[1.5rem] border border-[#ddd1c0] bg-[#fbf7ef] p-4 sm:grid-cols-[110px_minmax(0,1fr)]"
                    >
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

                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="brand-copy text-xl text-[#2b2a29]">{item.name}</p>
                            <p className="mt-1 text-sm text-[#667056]">
                              {item.sku} · {item.fabric} · {item.color}
                            </p>
                          </div>

                          <div className="text-left sm:text-right">
                            <p className="text-lg font-semibold text-[#2b2a29]">
                              {formatCurrency(item.price * item.quantity)}
                            </p>
                            {typeof item.originalPrice === "number" && item.originalPrice > item.price ? (
                              <p className="text-sm text-[#8d8b87] line-through">
                                {formatCurrency(item.originalPrice * item.quantity)}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="inline-flex items-center rounded-full border border-[#d6ccb9] bg-white/70 p-1">
                            <QuantityButton
                              label="Decrease quantity"
                              onClick={() => updateQuantity(item.sku, item.quantity - 1)}
                            >
                              −
                            </QuantityButton>
                            <span className="min-w-12 text-center text-sm font-semibold text-[#2b2a29]">
                              {item.quantity}
                            </span>
                            <QuantityButton
                              label="Increase quantity"
                              onClick={() => updateQuantity(item.sku, item.quantity + 1)}
                            >
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
                            <button
                              type="button"
                              onClick={() => removeItem(item.sku)}
                              className="text-sm font-medium text-[#9d4b45]"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <aside className="space-y-6">
              <section className="rounded-[2rem] border border-[#d9cebe] bg-[#fffaf2] p-6 shadow-[0_24px_60px_rgba(94,104,79,0.1)] sm:p-7">
                <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                  ORDER SUMMARY
                </p>

                <div className="mt-5 space-y-4 text-sm text-[#667056]">
                  <SummaryRow label="Subtotal" value={formatCurrency(subtotal)} />
                  <SummaryRow
                    label="Shipping"
                    value={shippingFee === 0 && subtotal > 0 ? "Free" : formatCurrency(shippingFee)}
                  />
                  <SummaryRow
                    label="Packaging"
                    value={packagingFee === 0 && subtotal > 0 ? "Free" : formatCurrency(packagingFee)}
                  />
                  {savings > 0 ? <SummaryRow label="Product savings" value={`-${formatCurrency(savings)}`} /> : null}
                </div>

                <div className="mt-5 border-t border-[#e3d8c9] pt-5">
                  <div className="flex items-center justify-between text-lg font-semibold text-[#2b2a29]">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#7a7f72]">
                    Address confirmation and payment happen in the next step.
                  </p>
                </div>

                <Link
                  href={items.length > 0 ? "/payment" : "/checkout"}
                  aria-disabled={items.length === 0}
                  className={`brand-caption mt-6 inline-flex w-full items-center justify-center rounded-[1.1rem] px-5 py-4 text-[0.68rem] font-semibold tracking-[0.14em] !text-[#fbf4e8] ${
                    items.length === 0
                      ? "cursor-not-allowed bg-[#c8c2b6]"
                      : "bg-[#5e684f]"
                  }`}
                  onClick={(event) => {
                    if (items.length === 0) {
                      event.preventDefault();
                    }
                  }}
                >
                  {items.length === 0 ? "ADD ITEMS TO CONTINUE" : "ADD ADDRESS AND CONTINUE"}
                </Link>
              </section>
            </aside>
          </div>
        </div>
      </section>

      <SiteFooter homeHref="/" contactId="contact" />
    </main>
  );
}

function QuantityButton({
  label,
  children,
  onClick
}: {
  label: string;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3eadb] text-xl text-[#4f5942]"
    >
      {children}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <span className="font-medium text-[#2b2a29]">{value}</span>
    </div>
  );
}
