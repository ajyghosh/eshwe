import type { Metadata } from "next";

import { PaymentPage } from "@/components/payment-page";

export const metadata: Metadata = {
  title: "Payment",
  description: "Complete delivery details and proceed to secure payment for your eshwe order.",
  alternates: {
    canonical: "/payment/"
  },
  robots: {
    index: false,
    follow: false
  }
};

export default function PaymentRoute() {
  return <PaymentPage />;
}
