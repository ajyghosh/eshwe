import { Suspense } from "react";

import { MobileAppSearchPage } from "@/components/mobile-app-pages";

export default function MobileAppSearchRoute() {
  return (
    <Suspense fallback={null}>
      <MobileAppSearchPage />
    </Suspense>
  );
}
