# Production deployment — 12 September 2026

Deployed to **https://eshwe.com** (Firebase project `eshwesareestudio`). Final Hosting release: **21:53 IST**, version `c639c4c391606533`.

The release includes the approved stock/reservation, checkout, customer syncing, admin, tracking/refund and catalogue search/filter changes. The excluded catalogue prices, discounts and dummy SKUs were not edited.

Deployment completed in order: Firestore indexes, Functions, then matching Firestore rules and Hosting. All **3 required indexes are READY**, all **11 functions are ACTIVE**, and the reconciliation scheduler is **ENABLED every 5 minutes**. The already verified production export was published; the temporary deployment configuration skipped its redundant build hook and was removed afterward.

## Verification

- **18 live checks passed:** release assets, eight web/PWA/admin routes, both India Post tracking links, category/search reloads, mobile account layout, current service worker and cache headers, offline fallback with automatic reconnect, unauthenticated rejection by the three new APIs, and no uncaught browser errors. [Results](production-smoke-results.json).
- **54 regression tests passed** before publishing. [Output](regressions.log). The preceding fix verification also passed lint, TypeScript and production build.
- **2 additional browser regressions passed** for the PWA correction found during live verification. [Output](pwa-http-cache.log).

Initial live testing exposed a real offline issue: browser HTTP caching could supply an app shell that remained on “Loading the collection…” instead of the offline document. Navigation fetches now use `cache: "no-store"`, and worker cache version is `eshwe-app-v6`. The corrected worker was published in the final Hosting release. No application bundle rebuild was needed for this static public asset.

The initial category test incorrectly expected the category dropdown to change when the production catalogue uses a curated browse filter. Diagnostics confirmed the correct filter and product survived reload; the final test checks the visible active filter and URL. The reconnect test also waits for the page's automatic reload instead of racing it with a second reload. [Initial results](initial-production-smoke-results.json) are retained.

Checks used desktop and mobile Chromium, with read-only production API probes. No test order, real payment/refund, SMS, or authenticated admin mutation was performed. These results do not certify physical installed Android/iPhone behavior or resolve the earlier unrelated audit findings.

Release references: [final Hosting](hosting-release.json), [previous Hosting rollback reference](previous-hosting-release.json), [functions](function-status.json), [indexes](index-status.json), [scheduler](scheduler-status.json).
