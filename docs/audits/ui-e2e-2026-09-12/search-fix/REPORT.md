# Catalogue search/filter fix — 12 September 2026

**Both failures from the UI audit are fixed locally and pass their browser regressions.** Live stock and category-card updates preserve unfinished search text and selected filters. Product availability still updates live.

The catalogue now tracks which URL state it has applied. Product subscriptions no longer reinitialize the form. URL changes made by the form preserve its selected fabric, availability and sort; actual navigation still initializes the intended state. Category links wait for catalogue data before resolving.

Reload testing also found that `/shop/category/mul-cotton/search/golden-checkered/` treated the search suffix as part of the category. The route parser now separates those parts, and a regression test covers the round-trip.

Changed application files: `src/components/shop-catalogue-page.tsx` and `src/lib/storefront-routes.ts`.

**Verification:**

- **9 browser checks passed:** the two original failures, live removal of sold-out cards under the Available filter, search submission preserving other controls, category/search reloads, back/forward/Clear, category-card updates, web/PWA cart syncing, and catalogue runtime-error checking. [Original-case regressions](live-update-cart-results.json), [navigation and state checks](catalogue-state-results.json).
- **54 regression tests passed**, including a new category/search URL round-trip test. [Output](regressions.log).
- Lint, TypeScript validation and the production static export passed. [Lint](lint.log), [production build](production-build.log).
- The cart browser check was corrected to wait for payment-page navigation before asserting its URL; the original timing failure is retained in [the initial log](initial-live-ui.log).

Browser tests used the isolated static build, local Firebase emulators, and demo products. No real payment, SMS or production data was changed. The verified production-configured export was copied to `out/`; this work has **not been deployed**. The earlier audit's unrelated launch findings remain outside this fix.

The entire earlier 58-check audit was not rerun. The checks above target the changed behavior, navigation regressions and the existing web/PWA cart path.
