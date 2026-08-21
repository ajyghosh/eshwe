import { Suspense } from "react";

import { ShopCataloguePage } from "@/components/shop-catalogue-page";

export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopCataloguePage />
    </Suspense>
  );
}
