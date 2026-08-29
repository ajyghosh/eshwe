import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description:
    "Read the eshwe terms and conditions covering website use, orders, payments, delivery, returns, and customer responsibilities."
};

const LAST_UPDATED = "August 2026";

export default function TermsAndConditionsPage() {
  return (
    <main className="min-h-screen bg-[#fbf4e8] text-[#4f5942]">
      <StorefrontHeader />

      <section className="px-6 py-14 sm:px-10 sm:py-16 lg:px-12">
        <div className="mx-auto max-w-4xl">
          <article className="rounded-[2rem] border border-[#e3d8c9] bg-[#fffaf2] p-8 shadow-[0_24px_60px_rgba(94,104,79,0.08)] sm:p-10">
            <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
              TERMS AND CONDITIONS
            </p>
            <h1 className="brand-copy mt-4 text-3xl leading-[1.08] text-[#2b2a29] sm:text-[3.1rem]">
              Terms for using eshwe and placing an order
            </h1>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-[#667056]">
              <span className="font-medium text-[#4f5942]">Last updated:</span>
              <span>{LAST_UPDATED}</span>
            </div>

            <div className="mt-6 h-px w-full bg-[#e3d8c9]" />

            <div className="mt-8 space-y-8 text-sm leading-7 text-[#667056] sm:text-[0.98rem]">
              <section className="space-y-4">
                <p>
                  Welcome to Eshwe. These Terms and Conditions govern your access to and use of our
                  website, products, and services. By accessing the website, creating an account, or
                  placing an order with Eshwe, you agree to these terms.
                </p>
                <p>
                  Eshwe is an online boutique offering sarees and related products through our
                  website.
                </p>
                <p>
                  We may update our products, prices, website features, policies, and these Terms
                  and Conditions from time to time. The version published on the website at the
                  relevant time will apply, subject to applicable law.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">1. Product information</h2>
                <p>
                  We make reasonable efforts to ensure that product photographs, descriptions,
                  fabric information, measurements, availability, and prices displayed on our
                  website are accurate.
                </p>
                <p>
                  However, colours may appear differently depending on photography, lighting
                  conditions, screen brightness, device settings, and display technology.
                </p>
                <p>
                  Sarees, particularly handloom, handwoven, cotton, naturally textured, dyed, or
                  artisan-produced products, may have minor variations in weave, thread, texture,
                  colour, or finish. Such characteristics may be inherent to the textile and are not
                  necessarily considered defects.
                </p>
                <p>
                  Customers are encouraged to carefully review the available product information
                  before placing an order.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">2. Pricing</h2>
                <p>
                  All prices displayed on the website are shown in Indian Rupees (₹), unless
                  otherwise specified.
                </p>
                <p>
                  Prices, promotional offers, and discounts may change without prior notice.
                  However, once an order has been successfully confirmed, subsequent price changes
                  will not normally affect that confirmed order.
                </p>
                <p>
                  An obvious technical or pricing error does not necessarily require Eshwe to fulfil
                  an order at the incorrect price. If such an error affects an order, we will
                  contact the customer and provide an appropriate resolution.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">3. Orders and acceptance</h2>
                <p>Placing an order does not by itself guarantee acceptance.</p>
                <p>
                  An order is considered confirmed after successful payment and confirmation by
                  Eshwe.
                </p>
                <p>
                  We reserve the right to cancel or decline an order where reasonably necessary,
                  including situations involving:
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Product unavailability.</li>
                  <li>Incorrect pricing or product information caused by a technical error.</li>
                  <li>Payment verification issues.</li>
                  <li>Suspected fraudulent or unauthorized transactions.</li>
                  <li>Incorrect or incomplete delivery information.</li>
                  <li>Circumstances preventing us from reasonably fulfilling the order.</li>
                </ul>
                <p>
                  If we cancel an already-paid order, the applicable amount will be refunded to the
                  original payment method.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">4. Payments</h2>
                <p>
                  Eshwe currently accepts online payments through Razorpay and the payment methods
                  made available through our checkout.
                </p>
                <p>Cash on Delivery (COD) is not available.</p>
                <p>
                  Depending on availability through the payment gateway, payment options may include
                  UPI, debit cards, credit cards, net banking, wallets, or other supported online
                  methods.
                </p>
                <p>
                  Payment processing and authentication may be handled by Razorpay, banks, UPI
                  providers, card networks, and other financial institutions.
                </p>
                <p>
                  Eshwe does not intend to directly collect or store complete card numbers, CVVs,
                  UPI PINs, banking passwords, or OTPs.
                </p>
                <p>
                  Never provide your OTP, UPI PIN, CVV, or banking password to anyone claiming to
                  represent Eshwe.
                </p>
                <p>
                  Occasionally, a payment may be debited from a customer&apos;s account even though
                  the order is not successfully confirmed.
                </p>
                <p>
                  If this occurs, please contact Eshwe with the relevant transaction and order
                  details. The transaction will be verified and, where applicable, the amount will
                  either be reconciled with the order or refunded through the appropriate payment
                  process.
                </p>
                <p>
                  Banking and payment-gateway processing times are outside Eshwe&apos;s direct
                  control.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">5. Delivery</h2>
                <p>
                  Customers are responsible for providing a complete and accurate delivery address,
                  PIN code, mobile number, and other information required for delivery.
                </p>
                <p>
                  Estimated delivery periods are estimates rather than guaranteed delivery dates.
                  Delays may occur due to courier operations, weather, public holidays, regional
                  restrictions, incorrect addresses, operational disruptions, or circumstances
                  outside our reasonable control.
                </p>
                <p>Detailed shipping conditions are provided in our Shipping and Returns Policy.</p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">6. Returns and cancellations</h2>
                <p>Eshwe does not offer exchanges or change-of-mind returns.</p>
                <p>
                  Returns are considered only for products received in an eligible damaged,
                  defective, or incorrect condition, subject to the requirements in our Shipping and
                  Returns Policy.
                </p>
                <p>
                  A qualifying issue must be reported within 48 hours of delivery and supported by
                  the evidence described in that policy, including a continuous unboxing video.
                </p>
                <p>
                  Customers should contact Eshwe as soon as possible if they wish to cancel an
                  order.
                </p>
                <p>
                  Cancellation cannot be guaranteed once an order has entered processing, packing,
                  or shipment.
                </p>
                <p>
                  If an order is eligible for cancellation and payment has already been completed,
                  the refund will ordinarily be initiated to the original payment method.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">7. Acceptable use</h2>
                <p>
                  Customers must not misuse the Eshwe website or attempt to interfere with its
                  security, operation, payment systems, accounts, servers, or underlying
                  technology.
                </p>
                <p>
                  Automated scraping, fraudulent transactions, unauthorized access attempts,
                  malicious software, or use of the website for unlawful purposes is prohibited.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">8. Intellectual property</h2>
                <p>
                  Unless otherwise stated, Eshwe&apos;s website design, branding, logos, product
                  presentation, written content, graphics, photographs owned by Eshwe, and other
                  original materials are protected by applicable intellectual-property rights.
                </p>
                <p>
                  They may not be commercially reproduced, republished, or distributed without
                  appropriate authorization.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">9. Liability</h2>
                <p>
                  To the extent permitted by applicable law, Eshwe will not be responsible for
                  indirect or consequential losses arising from circumstances outside our reasonable
                  control.
                </p>
                <p>
                  Nothing in these Terms is intended to exclude or restrict rights or remedies that
                  cannot legally be excluded under applicable Indian law.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">10. Governing law</h2>
                <p>These Terms and Conditions are governed by applicable laws of India.</p>
                <p>
                  Any dispute will be handled in accordance with applicable Indian law and the
                  jurisdiction legally applicable to Eshwe and the transaction.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">11. Contact</h2>
                <p>
                  For questions concerning an order or these Terms and Conditions, customers may
                  contact Eshwe using the contact details provided on our website.
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
