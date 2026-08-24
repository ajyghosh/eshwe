import type { Metadata } from "next";

import { AccountPage } from "@/components/account-page";

export const metadata: Metadata = {
  title: "My Account",
  description: "View your saved addresses and recent orders at eshwe.",
  alternates: {
    canonical: "/account/"
  },
  robots: {
    index: false,
    follow: false
  }
};

export default function AccountRoute() {
  return <AccountPage />;
}
