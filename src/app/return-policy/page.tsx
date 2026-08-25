import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";

export const metadata: Metadata = {
  title: "Return Policy",
  description:
    "Read the eshwe return, exchange, and refund policy, including parcel opening video and seal verification requirements."
};

const LAST_UPDATED = "August 25, 2026";

export default function ReturnPolicyPage() {
  return (
    <main className="min-h-screen bg-[#fbf4e8] text-[#4f5942]">
      <StorefrontHeader />

      <section className="px-6 py-14 sm:px-10 sm:py-16 lg:px-12">
        <div className="mx-auto max-w-4xl">
          <article className="rounded-[2rem] border border-[#e3d8c9] bg-[#fffaf2] p-8 shadow-[0_24px_60px_rgba(94,104,79,0.08)] sm:p-10">
            <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
              RETURN POLICY
            </p>
            <h1 className="brand-copy mt-4 text-3xl leading-[1.08] text-[#2b2a29] sm:text-[3.1rem]">
              Returns, exchanges, and refund terms
            </h1>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-[#667056]">
              <span className="font-medium text-[#4f5942]">Last updated:</span>
              <span>{LAST_UPDATED}</span>
            </div>

            <div className="mt-6 h-px w-full bg-[#e3d8c9]" />

            <div className="mt-8 space-y-8 text-sm leading-7 text-[#667056] sm:text-[0.98rem]">
              <section className="space-y-4">
                <p>
                  This policy explains how eshwe handles returns, exchanges, refunds, and delivery-related disputes.
                  Please read it carefully before placing an order.
                </p>
                <p>
                  Our products are packed carefully and sent with identification details for verification. Because of
                  the nature of sarees and boutique stock handling, all claims are reviewed strictly.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">1. No return and no refund policy</h2>
                <p>
                  We do not accept returns for change of mind, personal preference, styling preference, occasion
                  changes, late requirement changes, or similar reasons after delivery.
                </p>
                <p>
                  We do not provide refunds once an order has been delivered. If any case is reviewed and approved by
                  us, it will be considered only under exchange support and not as a cash refund.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">2. Parcel opening video is mandatory</h2>
                <p>
                  A continuous parcel opening video is required for any exchange request, damage claim, missing item
                  claim, incorrect product claim, or delivery dispute.
                </p>
                <p>
                  The video must clearly show the sealed parcel before opening, the full opening process without cuts
                  or edits, and the product as received inside the package.
                </p>
                <p>
                  If the opening video is not available, we may not be able to verify the claim, and the request may
                  be declined.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">3. Seal and tag verification</h2>
                <p>
                  Every product is sent with a unique seal, tag, or identification marker. Any exchange request will
                  be checked against these original details.
                </p>
                <p>
                  The product must remain unused, unwashed, unaltered, and in the same condition in which it was
                  delivered. Requests may be rejected if the seal is broken, the tag is removed, the item is worn, or
                  the product condition has changed after delivery.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">4. Damaged or incorrect product claims</h2>
                <p>
                  If you believe the delivered product is damaged, defective, incomplete, or not the same as your
                  order, please contact us promptly with your order ID and the parcel opening video.
                </p>
                <p>
                  We may also ask for clear photographs of the product, packaging, label, and shipping details to
                  complete the review. Approval is not automatic and depends on verification.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">5. Exchange review process</h2>
                <p>
                  If a request is eligible for review, our team will check the order details, the parcel opening video,
                  and the condition of the item. We may contact you for additional information before making a
                  decision.
                </p>
                <p>
                  An exchange is considered only after successful verification. If the claim cannot be verified, the
                  request may be declined.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">6. How to contact us</h2>
                <p>
                  For any delivery or product issue, please contact us with your order ID, product name, delivery
                  details, and parcel opening video so that the case can be reviewed properly.
                </p>
                <p>
                  We recommend raising any concern as soon as possible after delivery so the order condition can be
                  assessed without delay.
                </p>
              </section>

              <section className="border-t border-[#e3d8c9] pt-6 text-xs leading-6 text-[#7a7f72] sm:text-sm">
                <p>
                  By placing an order with eshwe, you acknowledge that you have read and accepted this return policy.
                </p>
              </section>
            </div>
          </article>
        </div>
      </section>

      <SiteFooter homeHref="/" contactId="contact" />
    </main>
  );
}
