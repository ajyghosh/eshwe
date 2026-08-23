import type { Metadata } from "next";
import { Suspense } from "react";

import { ShopCataloguePage } from "@/components/shop-catalogue-page";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Browse curated sarees from eshwe, including boutique cottons, silks, and occasion-ready drapes.",
  alternates: {
    canonical: "/shop/"
  },
  openGraph: {
    title: "Shop | eshwe",
    description:
      "Browse curated sarees from eshwe, including boutique cottons, silks, and occasion-ready drapes.",
    url: "https://eshwe.com/shop/"
  },
  twitter: {
    title: "Shop | eshwe",
    description:
      "Browse curated sarees from eshwe, including boutique cottons, silks, and occasion-ready drapes."
  }
};

export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopCataloguePage />
    </Suspense>
  );
}
