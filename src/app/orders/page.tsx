import type { Metadata } from "next";

import { CustomerOrdersPage } from "@/components/customer-orders-page";

export const metadata: Metadata = {
  title: "My Orders",
  description: "View your Eshwe order history.",
  alternates: {
    canonical: "/orders/"
  },
  robots: {
    index: false,
    follow: false
  }
};

export default function OrdersRoute() {
  return <CustomerOrdersPage />;
}
