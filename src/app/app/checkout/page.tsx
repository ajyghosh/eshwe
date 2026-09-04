import { Suspense } from "react";

import { MobileAppCheckoutPage } from "@/components/mobile-app-pages";

export default function MobileAppCheckoutRoute() {
  return (
    <Suspense fallback={null}>
      <MobileAppCheckoutPage />
    </Suspense>
  );
}
