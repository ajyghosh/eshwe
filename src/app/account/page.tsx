import type { Metadata } from "next";

import { AccountPage } from "@/components/account-page";

export const metadata: Metadata = {
  title: "My Account",
  description: "Manage your profile and saved addresses at eshwe.",
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
