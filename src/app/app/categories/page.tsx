import { Suspense } from "react";

import { MobileAppSearchPage } from "@/components/mobile-app-pages";

export default function MobileAppCategoriesRoute() {
  return (
    <Suspense fallback={null}>
      <MobileAppSearchPage categoryFirst />
    </Suspense>
  );
}
