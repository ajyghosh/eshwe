import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Read the eshwe privacy policy covering the information we collect, how it is used, payment processing, cookies, data security, and customer rights."
};

const LAST_UPDATED = "August 2026";

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#fbf4e8] text-[#4f5942]">
      <StorefrontHeader />

      <section className="px-6 py-14 sm:px-10 sm:py-16 lg:px-12">
        <div className="mx-auto max-w-4xl">
          <article className="rounded-[2rem] border border-[#e3d8c9] bg-[#fffaf2] p-8 shadow-[0_24px_60px_rgba(94,104,79,0.08)] sm:p-10">
            <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
              PRIVACY POLICY
            </p>
            <h1 className="brand-copy mt-4 text-3xl leading-[1.08] text-[#2b2a29] sm:text-[3.1rem]">
              How eshwe collects, uses, and protects your information
            </h1>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-[#667056]">
              <span className="font-medium text-[#4f5942]">Last updated:</span>
              <span>{LAST_UPDATED}</span>
            </div>

            <div className="mt-6 h-px w-full bg-[#e3d8c9]" />

            <div className="mt-8 space-y-8 text-sm leading-7 text-[#667056] sm:text-[0.98rem]">
              <section className="space-y-4">
                <p>
                  At <strong>Eshwe</strong>, we respect your privacy and are committed to handling
                  personal information responsibly.
                </p>
                <p>
                  This Privacy Policy explains the types of information we may collect when you
                  browse our website, create an account, make a purchase, or contact us, and how
                  that information may be used.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">1. Information We Collect</h2>
                <p>Depending on how you interact with Eshwe, we may collect:</p>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-[#2b2a29]">Contact Information</h3>
                    <p>
                      Your name, email address, telephone number, billing address, delivery
                      address, and other information you voluntarily provide.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-[#2b2a29]">Account Information</h3>
                    <p>
                      Information associated with an Eshwe account, including saved addresses and
                      account preferences.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-[#2b2a29]">Order Information</h3>
                    <p>
                      Products ordered, transaction details, order history, delivery information,
                      return/refund requests, and communications concerning purchases.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-[#2b2a29]">Payment Information</h3>
                    <p>
                      Payments are processed using <strong>Razorpay and/or payment services
                      available through our checkout</strong>.
                    </p>
                    <p>
                      Eshwe does not intend to directly store sensitive payment credentials such as
                      your complete card number, CVV, UPI PIN, OTP, or internet-banking password.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-[#2b2a29]">Technical Information</h3>
                    <p>
                      We may collect technical information such as IP address, browser type, device
                      information, website activity, referring pages, and cookie information.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">2. How We Use Your Information</h2>
                <p>We may use information to:</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Process and fulfil orders.</li>
                  <li>Arrange shipping and delivery.</li>
                  <li>Send order and transaction updates.</li>
                  <li>Manage customer accounts.</li>
                  <li>Respond to customer enquiries.</li>
                  <li>Process eligible returns and refunds.</li>
                  <li>Prevent fraud and protect our website.</li>
                  <li>Diagnose technical problems.</li>
                  <li>Understand website usage.</li>
                  <li>Improve our website, products, and customer experience.</li>
                  <li>Meet applicable legal, tax, accounting, or regulatory requirements.</li>
                </ul>
                <p>
                  Where permitted, we may also send marketing communications. Customers may opt out
                  of marketing communications using the unsubscribe mechanism provided.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">3. Payment Processing</h2>
                <p>
                  Online payments are processed through Razorpay or another payment service
                  displayed during checkout.
                </p>
                <p>
                  Payment providers may independently process certain personal and financial
                  information according to their respective terms and privacy policies.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">4. Information Sharing</h2>
                <p>
                  Eshwe does <strong>not sell or rent your personal information</strong>.
                </p>
                <p>
                  We may provide information where reasonably necessary to trusted service providers
                  involved in operating our business, including:
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Payment processing.</li>
                  <li>Shipping and delivery.</li>
                  <li>Website infrastructure and hosting.</li>
                  <li>Customer communications.</li>
                  <li>Analytics and security.</li>
                  <li>Accounting or professional services.</li>
                </ul>
                <p>
                  Information may also be disclosed where required by applicable law, court order,
                  governmental authority, or to investigate fraud or protect legal rights.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">5. Cookies</h2>
                <p>
                  Our website may use cookies and similar technologies for essential website
                  functionality, shopping-cart operation, login sessions, preferences, analytics,
                  performance, and security.
                </p>
                <p>
                  You may control cookies through your browser settings. Disabling essential cookies
                  may prevent certain website functions from operating correctly.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">6. Data Security</h2>
                <p>
                  Eshwe uses reasonable administrative and technical safeguards designed to protect
                  customer information.
                </p>
                <p>
                  Our website uses HTTPS encryption, and payment transactions are processed through
                  secure third-party payment infrastructure.
                </p>
                <p>
                  However, no internet transmission or electronic storage method can be guaranteed
                  to be completely secure.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">7. Data Retention</h2>
                <p>
                  We may retain order and customer information for as long as reasonably necessary
                  to provide our services and meet legitimate business, accounting, tax,
                  fraud-prevention, dispute-resolution, and legal requirements.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">8. Your Information</h2>
                <p>
                  Subject to applicable law, you may contact us to request access to, correction
                  of, or deletion of personal information associated with you.
                </p>
                <p>
                  Some information may need to be retained where required for legal, taxation,
                  accounting, fraud-prevention, or transaction-record purposes.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">9. Changes to This Policy</h2>
                <p>
                  We may update this Privacy Policy when our website, services, or legal
                  requirements change.
                </p>
                <p>
                  The latest version will be published on the Eshwe website together with its
                  updated date.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="brand-copy text-2xl text-[#2b2a29]">10. Contact</h2>
                <p>
                  For privacy-related questions or requests, please contact <strong>Eshwe</strong>{" "}
                  using the contact information available on our website.
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
