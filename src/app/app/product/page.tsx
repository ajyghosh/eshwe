import { Suspense } from "react";

import { MobileAppProductPage } from "@/components/mobile-app-pages";

export default function MobileAppProductRoute() {
  return (
    <Suspense fallback={null}>
      <MobileAppProductPage />
    </Suspense>
  );
}
