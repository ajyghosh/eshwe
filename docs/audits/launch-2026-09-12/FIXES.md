# Launch fixes and verification — 12 September 2026

These changes address the source-code findings in [the original audit](REPORT.md). Finding 04 (₹1 prices, dummy SKUs and catalogue discounts) is excluded as requested. No production catalogue records, orders, payments, SMS messages or deployments were changed.

## Verified results

**62 checks passed:** 41 regression tests, 4 real Firestore emulator integration tests, and 17 browser checks (10 web/PWA, 4 admin, 3 desktop checkout). TypeScript, lint, backend syntax checks and the production static export also passed. The export includes 95 product pages. No skipped tests or browser runtime errors were recorded.

Evidence: [regression output](fix-regression-results.txt), [Firestore integration output](fix-emulator-results.txt), [web/PWA browser results](fix-browser-results.json), [admin browser results](fix-owner-browser-results.json), [desktop checkout results](fix-web-checkout-results.json), and [production build output](fix-production-build.txt).

The browser checks use real local Firebase Auth/Firestore emulators and simulated OTP/Razorpay services. These results do not claim a production payment, refund, SMS delivery or physical installed-device test.

## Behaviour after deployment

- Adding an item to a bag does not reserve stock. Starting payment atomically reserves all requested units for 15 minutes. Only the winning customer can open payment for the final piece.
- Other connected shoppers see “Temporarily reserved” when no unreserved units remain. After capture they see “Out of stock.” Checkout requires a fresh server catalogue snapshot and the backend revalidates inventory.
- The same account can resume one active checkout across devices. Repeated requests reuse its checkout identifier and payment order. Closing/reloading the payment page leads to a server-backed recovery page.
- Every five minutes, the backend checks expired reservations against Razorpay before releasing stock. Provider errors preserve the hold; authorized payments remain held and visible for review. Unfulfillable late captures become recorded payment exceptions and enter an idempotent refund workflow.
- Admin edits require the product version opened in the form, so a stale form cannot silently restore sold/reserved stock. Available and reserved counts are shown separately. Product removal archives its record and preserves images used by historical orders.
- Signed-in carts, wishlists and addresses use Firestore subscriptions and transactional changes. Guest imports are claimed for one account and retried with stable migration IDs. Logging out does not copy private account data into a guest cart.
- Web and PWA use the same payment/status flow. Receipt data is fetched for the signed-in order owner and held in memory; browser storage contains recovery identifiers, not receipt addresses.

## Findings addressed

| Audit ID | Implemented fix | Verification |
| --- | --- | --- |
| 01 | Read every transaction document before writing; atomic multi-line reservation and capture | Transaction regression suite and real Firestore emulator |
| 02 | Reservation ownership/expiry, checkout idempotency, provider reconciliation, late-capture exception/refund | Concurrent last-piece tests; browser with separate customer contexts |
| 03 | Commit incorrect OTP counters and expired-code deletion before returning errors | Five-attempt lockout, expired code, simultaneous/replayed valid code tests |
| 04 | **Excluded: catalogue/prices/dummy SKUs/discount data left untouched** | Public read-only snapshot only |
| 05 | Version-checked admin API; omit unchanged stock fields; block client stock writes | Stale-edit tests with in-memory and real Firestore transactions |
| 06 | Shared checkout, server-backed status/receipt, stable recovery key and same-order resume | Payment interruption, server total and repeat confirmation tests |
| 07 | Validate signature/order/amount/currency; monotonic capture/refund transitions | Forged signature, mismatched payment and stale event tests |
| 08 | Transactional per-address updates, preserve other addresses and selected pointer; PWA selector | Conflict/merge tests and cross-tab browser selection |
| 09 | Max-quantity snapshot merge, migration journal, account-separated carts | Repeated import, interrupted migration, account isolation tests |
| 10 | Account-scoped in-memory receipts; clear old session receipt on auth changes | Receipt storage regression and browser account switch |
| 11 | Live account subscriptions and transactional cart/wishlist/address updates | Concurrent mutations, guest tab syncing and live address checks |
| 12 | Unknown stock becomes unavailable; aggregate duplicate quantities; unique SKU/slug claims | Unknown stock, duplicate quantities and concurrent product creation tests |
| 13 | Reconcile cart by product ID; missing/draft/deleted products become unavailable | Catalogue/cart regression tests; backend availability enforcement |
| 14 | Separate payment, dispatch and refund states; visible exceptions; owner reconciliation/refund/restock actions | State-transition, refund/replay/restock tests and owner reporting suite |
| 15 | Generic offline navigation fallback; no authenticated HTML/RSC cache; revalidate mutable assets | Isolated Chrome service-worker/offline test |
| 16 | Preserve exported Next navigation `.txt` payloads | Static export and browser navigation checks |
| 17 | Explicit PWA loading/error states; ignore empty cache snapshots; low-stock/reserved labels | Empty-cache regression; browser product visibility |
| 18 | Archive products; retain previous product images after replacements/failed saves | Archive retention regression and product-save review |
| 19 | Generate product-specific titles, descriptions, images, canonicals and sitemap URLs | Production static export of 95 product pages; browser metadata checks |
| 20 | Server-side newest-first order query before limit; load older orders | Customer history test with 151 emulator orders |

## Reproduction

- `npm test`: regression tests for inventory/payment/OTP, product mutations, customer syncing, receipt privacy, catalogue loading and owner reporting.
- `npm run lint` and `npx tsc --noEmit`: application static checks.
- `npm run build:hosting`: reads the public catalogue and builds the static hosting export. `ESHWE_CATALOGUE_SNAPSHOT` can specify an already-read snapshot for offline builds.
- `npm run test:emulator`: requires the Firestore emulator on `127.0.0.1:8080` with project **demo-eshwe-launch** and the checked-in rules. This suite resets that demo project's local emulator data.
- `tests/browser/server.cjs` serves the emulator-configured static build on `127.0.0.1:3000`. It requires Firestore at 8080 and Auth at 9099, seeds demo customers/products, simulates OTP and Razorpay, and does not use live payment/SMS providers.
- `tests/browser/owner-smoke.cjs` checks the owner editor/archive and order recovery controls; `tests/browser/web-checkout-smoke.cjs` checks desktop checkout and authorized/captured states.
- `tests/browser/launch-smoke.cjs` runs Chrome with fresh contexts. Set `PLAYWRIGHT_MODULE` and `CHROME_PATH` for another machine. The JSON result records exactly which browser scenarios completed.

Browser test build configuration: `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-eshwe-launch`, `NEXT_PUBLIC_FIREBASE_API_KEY=demo-key`, `NEXT_PUBLIC_FIREBASE_EMULATOR_HOST=127.0.0.1:8080`, `NEXT_PUBLIC_AUTH_EMULATOR_URL=http://127.0.0.1:9099`, and `NEXT_PUBLIC_FUNCTIONS_EMULATOR_URL=http://127.0.0.1:3000/test-api`. **Never deploy an emulator-configured export.** Build again without these overrides before release.

## Release requirements and limits

The fixes are local until deployed. Deploy the Firestore indexes and wait until ready, then coordinate Functions, rules and Hosting together. The release introduces `checkoutStatus`, `ownerOrderAction`, `ownerProductAction` and `reconcileCheckoutOrders`; it also changes checkout request/response semantics and blocks direct client product/order writes. Existing open browser tabs/PWAs should refresh onto the new build.

Verify Razorpay auto-capture, webhook endpoint/signature configuration and refund permissions in the production account. The scheduler needs its deployment/runtime permissions. Confirm the deployed endpoints with provider test-mode capture/failure/refund and real-device Android/iOS installed-PWA checks before opening sales. No real Razorpay payment/refund or SMS was sent during local verification.

Catalogue pages and social previews are static: rebuild Hosting after publishing products or changing their names, descriptions, images or URLs. Old product images are intentionally retained to preserve order history; storage cleanup should only remove files proven unreferenced by products and historical orders.

An ambiguous gateway-order creation cannot safely be retried as a new payment; it remains visible for recovery/review until reconciled or its unused hold is released. Provider outages can delay hold release. Confirmed failed refunds have an explicit owner retry action with a new idempotent attempt; partial refunds remain visible for owner review. Restocking requires a separate, once-only owner action after full refund and physical inspection.
