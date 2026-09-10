"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import {
  formatOrderConfirmationId,
  formatOrderConfirmationDate,
  formatOrderConfirmationDateOnly,
  formatOrderConfirmationPaymentStatus,
  openOrderReceiptPreview,
  readLatestOrderConfirmation,
  type OrderConfirmationData
} from "@/lib/order-confirmation";

const CONFETTI_PIECES = Array.from({ length: 22 }, (_, index) => ({
  delay: `${(index % 6) * 120}ms`,
  duration: `${4600 + (index % 5) * 320}ms`,
  left: `${4 + index * 4.2}%`,
  rotate: `${(index % 7) * 23}deg`,
  shape:
    index % 3 === 0
      ? "rounded-[999px]"
      : index % 3 === 1
        ? "rounded-[0.35rem]"
        : "rounded-[0.2rem]",
  size: index % 4 === 0 ? "h-4 w-2.5" : "h-3 w-3",
  tone:
    index % 4 === 0 ? "bg-[#c9923f]" : index % 4 === 1 ? "bg-[#5e684f]" : index % 4 === 2 ? "bg-[#b06f3d]" : "bg-[#d6b87f]"
}));

export function OrderConfirmationPage() {
  const [confirmation, setConfirmation] = useState<OrderConfirmationData | null>(null);
  const displayOrderId = confirmation ? formatOrderConfirmationId(confirmation.internalOrderId) : "-";

  useEffect(() => {
    const savedConfirmation = readLatestOrderConfirmation();

    if (!savedConfirmation) {
      setConfirmation(null);
      return;
    }

    setConfirmation(savedConfirmation);
  }, []);

  if (!confirmation) {
    return (
      <main className="web-storefront min-h-screen bg-[#fbf4e8] text-[#4f5942]">
        <StorefrontHeader />
        <section className="px-6 py-12 sm:px-10 lg:px-12">
          <div className="web-surface mx-auto max-w-3xl rounded-[2rem] border border-[#e3d8c9] bg-[#fffaf2] p-8 text-center shadow-[0_24px_60px_rgba(94,104,79,0.1)]">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[1.8rem] border border-[#dcc9ad] bg-[linear-gradient(135deg,#fff3df_0%,#efd8ab_100%)] shadow-[0_18px_40px_rgba(176,111,61,0.18)]">
              <Image
                src="/eshwelogo.png"
                alt="Eshwe"
                width={76}
                height={76}
                className="h-[4.75rem] w-[4.75rem] object-contain"
                priority
              />
            </div>
            <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
              ORDER CONFIRMATION
            </p>
            <h1 className="brand-copy mt-4 text-3xl text-[#2b2a29]">Your order has been received.</h1>
            <p className="mt-4 text-sm leading-7 text-[#667056]">
              We could not reload the full confirmation snapshot in this tab.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/shop"
                className="brand-caption inline-flex rounded-full bg-[#5e684f] px-6 py-3 text-[0.68rem] font-semibold tracking-[0.14em] text-[#fbf4e8]"
              >
                CONTINUE SHOPPING
              </Link>
              <Link
                href="/account"
                className="brand-caption inline-flex rounded-full border border-[#d6ccb9] bg-white/70 px-6 py-3 text-[0.68rem] font-semibold tracking-[0.14em] text-[#4f5942]"
              >
                VIEW ACCOUNT
              </Link>
            </div>
          </div>
        </section>
        <SiteFooter homeHref="/" contactId="contact" />
      </main>
    );
  }

  return (
    <main className="web-storefront min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#fff9ec_0%,#fbf4e8_45%,#f5ebdc_100%)] text-[#4f5942]">
      <StorefrontHeader />

      <section className="relative px-6 py-10 sm:px-10 lg:px-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {CONFETTI_PIECES.map((piece, index) => (
            <span
              key={index}
              className={`absolute top-[-10%] ${piece.size} ${piece.shape} ${piece.tone} opacity-90 [animation:confirmation-confetti_var(--duration)_linear_infinite]`}
              style={
                {
                  "--duration": piece.duration,
                  animationDelay: piece.delay,
                  left: piece.left,
                  rotate: piece.rotate
                } as CSSProperties
              }
            />
          ))}
        </div>

        <div className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-[2.4rem] border border-[#e3d8c9] bg-[#fffaf2]/95 p-8 shadow-[0_24px_80px_rgba(94,104,79,0.13)] backdrop-blur sm:p-10">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#c6a96c] to-transparent" />

            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_360px]">
              <div>
                <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                  ORDER CONFIRMATION
                </p>
                <h1 className="brand-copy mt-4 text-4xl leading-tight text-[#2b2a29] sm:text-[3.3rem]">
                  Thank you. Your order is confirmed.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[#667056]">
                  We have received your payment and saved the order details below. Open the receipt in a clean browser
                  view if you want to review it separately.
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <InfoCard label="Order ID" value={displayOrderId} />
                  <InfoCard label="Payment ID" value={confirmation.razorpayPaymentId} />
                  <InfoCard label="Status" value={formatOrderConfirmationPaymentStatus(confirmation.paymentStatus)} />
                  <InfoCard label="Placed" value={formatOrderConfirmationDateOnly(confirmation.createdAtIso)} />
                </div>

                <div className="mt-8 flex flex-wrap gap-4">
                  <button
                    type="button"
                    onClick={() => openOrderReceiptPreview(confirmation)}
                    className="brand-caption inline-flex items-center justify-center rounded-full bg-[#5e684f] px-6 py-3 text-[0.68rem] font-semibold tracking-[0.14em] text-[#fbf4e8]"
                  >
                    VIEW RECEIPT
                  </button>
                  <Link
                    href="/shop"
                    className="brand-caption inline-flex items-center justify-center rounded-full border border-[#d6ccb9] bg-white/70 px-6 py-3 text-[0.68rem] font-semibold tracking-[0.14em] text-[#4f5942]"
                  >
                    CONTINUE SHOPPING
                  </Link>
                </div>
              </div>

              <aside className="web-surface rounded-[2rem] border border-[#e3d8c9] bg-[#fbf6ee] p-6 shadow-[0_18px_40px_rgba(94,104,79,0.08)]">
                <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">SHIP TO</p>
                <div className="mt-4 space-y-2 text-sm leading-7 text-[#667056]">
                  <p className="brand-copy text-2xl leading-tight text-[#2b2a29]">{confirmation.customer.fullName}</p>
                  <p>{confirmation.customer.address}</p>
                  <p>
                    {confirmation.customer.city}, {confirmation.customer.state} {confirmation.customer.pincode}
                  </p>
                  <p>{confirmation.customer.phone}</p>
                  <p>{confirmation.customer.email}</p>
                </div>

                <div className="mt-6 border-t border-[#e7dccb] pt-6">
                  <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">NOTE</p>
                  <p className="mt-3 text-sm leading-7 text-[#667056]">
                    {confirmation.notes.trim() || "No additional note was added to this order."}
                  </p>
                </div>
              </aside>
            </div>

            <div className="mt-10">
              <section className="web-surface rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-6 shadow-[0_20px_50px_rgba(94,104,79,0.07)]">
                <div className="flex items-center justify-between gap-4 border-b border-[#e7dccb] pb-4">
                  <p className="brand-copy text-2xl text-[#2b2a29]">Order Items</p>
                  <p className="text-sm text-[#667056]">
                    {confirmation.items.length} item{confirmation.items.length === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="mt-6 space-y-4">
                  {confirmation.items.map((item) => (
                    <article
                      key={`${item.sku}-${item.quantity}`}
                      className="grid gap-4 rounded-[1.5rem] border border-[#ddd1c0] bg-[#fbf7ef] p-4 sm:grid-cols-[110px_minmax(0,1fr)]"
                    >
                      <div
                        className="aspect-[0.84] rounded-[1.15rem] bg-[#efe5d7]"
                        style={{
                          backgroundImage: item.primaryImageUrl
                            ? `linear-gradient(180deg, rgba(255,249,236,0.05), rgba(43,24,14,0.1)), url('${item.primaryImageUrl}')`
                            : "linear-gradient(180deg, #e8dfd4 0%, #b7b2ad 100%)",
                          backgroundPosition: "center",
                          backgroundSize: "cover"
                        }}
                      />

                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="brand-copy text-xl text-[#2b2a29]">{item.name}</p>
                            <p className="mt-1 text-sm text-[#667056]">
                              {item.sku}
                              {item.color ? ` · ${item.color}` : ""}
                            </p>
                          </div>

                          <div className="text-left sm:text-right">
                            <p className="text-lg font-semibold text-[#2b2a29]">
                              {formatCurrency((item.unitPrice || 0) * item.quantity, confirmation.summary.currency)}
                            </p>
                            {typeof item.unitOriginalPrice === "number" &&
                            typeof item.unitPrice === "number" &&
                            item.unitOriginalPrice > item.unitPrice ? (
                              <p className="text-sm text-[#8d8b87] line-through">
                                {formatCurrency(item.unitOriginalPrice * item.quantity, confirmation.summary.currency)}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#667056]">
                          <span>Quantity: {item.quantity}</span>
                          {typeof item.unitPrice === "number" ? (
                            <span>Unit price: {formatCurrency(item.unitPrice, confirmation.summary.currency)}</span>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="mt-6 border-t border-[#ddd1c0] pt-5">
                  <div className="max-w-sm space-y-4 sm:ml-auto">
                    <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                      SUMMARY
                    </p>

                    <div className="space-y-3 text-sm text-[#667056]">
                    <SummaryRow
                      label="Subtotal"
                      value={formatCurrency(confirmation.summary.subtotal, confirmation.summary.currency)}
                    />
                    <SummaryRow
                      label="Shipping"
                      value={formatCurrency(confirmation.summary.shippingFee, confirmation.summary.currency)}
                    />
                    <SummaryRow
                      label="Packaging"
                      value={formatCurrency(confirmation.summary.packagingFee, confirmation.summary.currency)}
                    />
                    <SummaryRow
                      label="Savings"
                      value={`-${formatCurrency(confirmation.summary.savings, confirmation.summary.currency)}`}
                    />
                    </div>

                    <div className="border-t border-[#e3d8c9] pt-4">
                      <div className="flex items-center justify-between text-lg font-semibold text-[#2b2a29]">
                        <span>Total</span>
                        <span>{formatCurrency(confirmation.summary.total, confirmation.summary.currency)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter homeHref="/" contactId="contact" />
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  const isLongToken = !value.includes(" ") && value.length > 14;

  return (
    <div className="min-w-0 rounded-[1.4rem] border border-[#e3d8c9] bg-[#fbf7ef] p-4">
      <p className="text-[0.65rem] font-semibold tracking-[0.16em] text-[#7d876f]">{label}</p>
      <p
        className={`mt-2 font-medium text-[#2b2a29] ${isLongToken ? "break-all text-[0.95rem] leading-5" : "text-sm leading-6"}`}
      >
        {value}
      </p>
    </div>
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

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(amount);
}
