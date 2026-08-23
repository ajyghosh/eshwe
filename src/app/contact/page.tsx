import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#fbf4e8] text-[#4f5942]">
      <StorefrontHeader />

      <section className="px-6 py-14 sm:px-10 sm:py-16 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8 shadow-[0_24px_60px_rgba(94,104,79,0.08)] sm:p-10">
            <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
              CONTACT
            </p>
            <h1 className="brand-copy mt-4 text-3xl leading-[1.08] text-[#3f4738] sm:text-[3.1rem]">
              Boutique support for product queries, gifting, and occasion styling.
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-[#667056] sm:text-[0.98rem]">
              If you need help choosing a saree, checking availability, or planning a purchase for a
              special event, use this page as your contact point with eshwe.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/shop/"
                className="brand-caption inline-flex items-center justify-center rounded-full bg-[#5e684f] px-6 py-3 text-[0.64rem] font-semibold tracking-[0.12em] text-[#fbf4e8]"
              >
                BROWSE COLLECTION
              </Link>
              <Link
                href="/checkout/"
                className="brand-caption inline-flex items-center justify-center rounded-full border border-[#d6ccb9] px-6 py-3 text-[0.64rem] font-semibold tracking-[0.12em] text-[#5e684f]"
              >
                GO TO CHECKOUT
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter homeHref="/" featuredHref="/shop/featured/" contactId="contact" />
    </main>
  );
}
