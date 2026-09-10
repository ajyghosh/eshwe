import type { Metadata } from "next";

import { MobileAppLegalPage } from "@/components/mobile-app-legal-page";

export const metadata: Metadata = {
  title: "Shipping and Returns Policy"
};

const LAST_UPDATED = "August 2026";

export default function MobileAppReturnPolicyPage() {
  return (
    <MobileAppLegalPage
      eyebrow="Shipping and returns"
      title="Shipping, delivery, returns, and refund terms"
      subtitle={`Last updated: ${LAST_UPDATED}`}
    >
      <section className="space-y-4">
        <p>We want every Eshwe order to reach you safely and in the condition in which it was prepared.</p>
        <p>Please read this policy carefully before completing your purchase.</p>
        <p>After successful payment and order confirmation, your order will be prepared for shipment.</p>
        <p>Processing and delivery times may vary depending on order volume, destination, courier availability, public holidays, and other operational circumstances.</p>
        <p>Once shipped, tracking information will be provided where tracking is available.</p>
      </section>

      <section className="space-y-4">
        <h2 className="brand-copy text-[1.45rem] leading-tight text-[#2b2a29]">1. Delivery information</h2>
        <p>Customers must provide an accurate and complete:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Recipient name.</li>
          <li>Delivery address.</li>
          <li>PIN code.</li>
          <li>Mobile number.</li>
          <li>Other information reasonably required by the courier.</li>
        </ul>
        <p>Eshwe is not responsible for delays or failed deliveries resulting from materially incorrect or incomplete information provided by the customer.</p>
      </section>

      <section className="space-y-4">
        <h2 className="brand-copy text-[1.45rem] leading-tight text-[#2b2a29]">2. Shipping timelines and charges</h2>
        <p>Any delivery date or timeframe displayed on the website is an estimated delivery period and should not be treated as a guaranteed delivery date.</p>
        <p>Courier delays, severe weather, transportation disruption, public holidays, regional restrictions, natural events, or other circumstances outside our reasonable control may affect delivery.</p>
        <p>Applicable shipping charges, if any, will be displayed during checkout before payment.</p>
        <p>Where the website states that shipping is free for an eligible order, no separate standard shipping charge will be added for that order.</p>
      </section>

      <section className="space-y-4">
        <h2 className="brand-copy text-[1.45rem] leading-tight text-[#2b2a29]">3. Returns not accepted</h2>
        <p>Eshwe currently does not offer product exchanges.</p>
        <p>We also do not accept returns because:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>You changed your mind.</li>
          <li>You no longer require the product.</li>
          <li>You selected the wrong product.</li>
          <li>You do not like the colour, fabric, style, or appearance after delivery.</li>
          <li>The product appears slightly different because of photography or screen or display settings.</li>
        </ul>
        <p>Please review the product information carefully before ordering.</p>
      </section>

      <section className="space-y-4">
        <h2 className="brand-copy text-[1.45rem] leading-tight text-[#2b2a29]">4. Eligible return claims</h2>
        <p>A return request may be considered where the product was received materially damaged or defective, or the product delivered is different from the product in the confirmed order.</p>
        <p>All claims are subject to verification by Eshwe.</p>
        <p>Any eligible damage, defect, or incorrect-product claim must be reported to Eshwe within 48 hours of the recorded delivery time.</p>
        <p>Please inspect your order promptly after receiving it.</p>
        <p>Claims received after the 48-hour period may not be eligible for return or refund, subject to applicable consumer law.</p>
      </section>

      <section className="space-y-4">
        <h2 className="brand-copy text-[1.45rem] leading-tight text-[#2b2a29]">5. Unboxing video and photographs</h2>
        <p>Customers are requested to record a clear, continuous and unedited video while opening the parcel for the first time.</p>
        <p>The video should show:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>The complete unopened package.</li>
          <li>The shipping label.</li>
          <li>The condition of the outer packaging.</li>
          <li>The package being opened continuously.</li>
          <li>The product being removed.</li>
          <li>The complete product.</li>
          <li>The claimed damage, defect, or incorrect item.</li>
        </ol>
        <p>The recording should begin before the parcel is opened.</p>
        <p>A recording made only after the parcel has already been opened may not establish the condition in which the product was delivered.</p>
        <p>Please also provide clear photographs showing the reported issue.</p>
      </section>

      <section className="space-y-4">
        <h2 className="brand-copy text-[1.45rem] leading-tight text-[#2b2a29]">6. Natural product variation</h2>
        <p>Sarees can naturally contain minor variations arising from weaving, dyeing, printing, stitching, finishing, or the characteristics of the fabric.</p>
        <p>Depending on the product, small weave variations, slubs, minor thread irregularities, natural texture variations, or slight variations in colour may occur.</p>
        <p>Similarly, colours displayed online may vary somewhat from the physical product because of photography, lighting, screen brightness, device settings, and display calibration.</p>
        <p>Such reasonable variations are not automatically considered product damage or manufacturing defects.</p>
      </section>

      <section className="space-y-4">
        <h2 className="brand-copy text-[1.45rem] leading-tight text-[#2b2a29]">7. Approved return conditions</h2>
        <p>If a return is approved, the product must be returned in substantially the same condition in which it was received.</p>
        <p>The product must not be:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Worn or used.</li>
          <li>Washed.</li>
          <li>Altered.</li>
          <li>Stained.</li>
          <li>Perfumed.</li>
          <li>Intentionally damaged.</li>
          <li>Modified in any manner.</li>
        </ul>
        <p>Original tags, packaging, accessories, and complimentary items supplied with the order should be included where applicable.</p>
      </section>

      <section className="space-y-4">
        <h2 className="brand-copy text-[1.45rem] leading-tight text-[#2b2a29]">8. Review and approval process</h2>
        <p>Submitting photographs or an unboxing video does not automatically mean that a return has been approved.</p>
        <p>Eshwe will review the evidence and order information before determining whether the claim satisfies this policy.</p>
        <p>If additional information is reasonably necessary, we may ask the customer to provide it.</p>
        <p>Do not send a product back before receiving return instructions from Eshwe.</p>
      </section>

      <section className="space-y-4">
        <h2 className="brand-copy text-[1.45rem] leading-tight text-[#2b2a29]">9. Refund handling</h2>
        <p>Once an approved return is received, the product will be inspected.</p>
        <p>If the return satisfies the approved claim and applicable return conditions, the refund will be initiated to the original payment method used for the order.</p>
        <p>Eshwe does not control the time taken by Razorpay, banks, card issuers, UPI providers, or other financial institutions to credit an initiated refund.</p>
      </section>

      <section className="space-y-4">
        <h2 className="brand-copy text-[1.45rem] leading-tight text-[#2b2a29]">10. Parcel damage or wrong item</h2>
        <p>If the outer parcel appears visibly opened, severely damaged, resealed, or tampered with at delivery, please photograph or record its condition before opening it.</p>
        <p>Where reasonably possible, bring visible package damage or tampering to the delivery person&apos;s attention.</p>
        <p>You should still record the complete unboxing if you accept the parcel.</p>
        <p>If you receive a product different from your confirmed order, contact Eshwe within 48 hours of delivery.</p>
        <p>Keep the item unused and retain its original packaging and tags. Please provide the continuous unboxing video, photographs, and your order information so that we can investigate the issue.</p>
      </section>

      <section className="space-y-4">
        <h2 className="brand-copy text-[1.45rem] leading-tight text-[#2b2a29]">11. How to contact us</h2>
        <p>For a shipping issue or eligible return request, contact Eshwe through the contact option in the app footer.</p>
        <p>For faster review, please provide order number, registered mobile or email, description of the issue, clear photographs, and a continuous unboxing video.</p>
      </section>
    </MobileAppLegalPage>
  );
}
