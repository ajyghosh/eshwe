import type { Metadata } from "next";

import { ContactPageContent } from "@/components/contact-page-content";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact eshwe Saree Studio for product questions, saree styling help, gifting support, and order assistance.",
  alternates: {
    canonical: "/contact/"
  },
  openGraph: {
    title: "Contact | eshwe",
    description:
      "Contact eshwe Saree Studio for product questions, saree styling help, gifting support, and order assistance.",
    url: "https://eshwe.com/contact/"
  },
  twitter: {
    title: "Contact | eshwe",
    description:
      "Contact eshwe Saree Studio for product questions, saree styling help, gifting support, and order assistance."
  }
};

export default function ContactPage() {
  return <ContactPageContent />;
}
