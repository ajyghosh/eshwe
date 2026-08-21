import { Suspense } from "react";

import { ProductDetailPage } from "@/components/product-detail-page";

export default function ProductPage() {
  return (
    <Suspense fallback={null}>
      <ProductDetailPage />
    </Suspense>
  );
}
