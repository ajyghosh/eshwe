import type { Metadata } from "next";
import { Suspense } from "react";

import { ProductDetailPage } from "@/components/product-detail-page";

export const metadata: Metadata = {
  title: "Product",
  description:
    "Explore saree details, styling notes, and boutique craftsmanship from the eshwe collection.",
  alternates: {
    canonical: "/product/"
  },
  openGraph: {
    title: "Product | eshwe",
    description:
      "Explore saree details, styling notes, and boutique craftsmanship from the eshwe collection.",
    url: "https://eshwe.com/product/"
  },
  twitter: {
    title: "Product | eshwe",
    description:
      "Explore saree details, styling notes, and boutique craftsmanship from the eshwe collection."
  }
};

export default function ProductPage() {
  return (
    <Suspense fallback={null}>
      <ProductDetailPage />
    </Suspense>
  );
}
