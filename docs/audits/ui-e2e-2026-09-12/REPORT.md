# Web and PWA end-to-end UI checks — 12 September 2026

**Follow-up:** the catalogue reset issue below has now been fixed locally and its regressions pass. See [fix and verification results](search-fix/REPORT.md). The audit results below preserve the original findings.

**56 checks passed; 2 checks failed. Both failures are manifestations of one confirmed web catalogue state-reset bug.** This was a browser audit of the current local application. No application code or production data was changed in this pass. [Complete results](RESULTS.json).

| Journey group | Passed | Failed |
| --- | ---: | ---: |
| Page rendering and layout: 11 web routes, 10 PWA routes | 21 | 0 |
| Search, sorting, web sign-in, wishlist sync, address editing, support, waitlist, manifest, responsive navigation and runtime checks | 14 | 0 |
| Last-piece competition, guest cart migration, payment recovery/capture, account isolation, metadata and PWA offline recovery | 10 | 0 |
| Desktop checkout, authorization pending capture, confirmed capture and receipt access | 3 | 0 |
| Tracking links and Admin amount-selectable refunds | 7 | 0 |
| Cart quantity/removal sync and catalogue behavior during live stock changes | 1 | 2 |
| **Total** | **56** | **2** |

These totals use the final corrected test results and count each scenario once. The six focused offline repetitions are recorded separately, not added to the headline total. Browser payment amounts used demo fixtures; catalogue prices/SKUs were not audited or changed.

**Confirmed issue: live stock updates reset customer search/filter choices — medium priority.**

1. Open the web shop, wait for its catalogue, and type search text without submitting. Change another product's stock in the demo database. The search field becomes empty.
2. Select **AVAILABLE** in the web shop and apply it. Change another product's stock. The availability selector returns to **ALL**.

Both failures were reproduced in the browser with actual Firestore subscriptions; the demo stock values were restored after each probe. This can interrupt discovery when another customer reserves or buys a product, or an admin updates stock. It does not demonstrate overselling or a payment error.

The cause is the URL-to-form effect in `src/components/shop-catalogue-page.tsx:124`. It resets search text, category, fabric, availability and intent, and also depends on catalogue-derived arrays at line 203. New product snapshots recreate those arrays and rerun the reset.

Fix: apply URL state when navigation changes; preserve user-entered search/filter state during product refreshes. Validate an invalidated option separately instead of resetting the entire form. Acceptance: with two customer sessions, a stock change must update product availability without changing the first customer's unfinished search or selected availability filter.

Evidence: [live-update results](live-update-cart-results.json), [search reset screenshot](Live-stock-update-preserves-an-unfinished-web-search-failure.png), [availability reset screenshot](Live-stock-update-preserves-an-applied-web-availability-filter-failure.png). Reproduce with `node tests/browser/live-ui-audit.cjs` against the local demo fixture server. **This issue is documented, not fixed in this audit.**

**What passed in the customer journeys:**

- Web SMS entry rejects a short phone number; an injected incorrect-code response is shown; entering the correct demo code completes sign-in. The SMS provider itself is simulated.
- Product-name searches, empty-result clearing and web price sorting work. PWA search and filter controls work. Search tests use the product name, matching the supported search fields.
- Web wishlist additions appear in PWA, and PWA removal synchronizes back to web.
- Editing the selected address in PWA updates web while preserving the other saved address. Selected-address changes also synchronize between tabs.
- Guest cart changes synchronize, sign-in migration does not double quantity, and quantity changes/removal work across web and PWA. An empty PWA bag returns to the catalogue, as implemented.
- Two customer sessions see the last available item become temporarily reserved and then sold out. An interrupted payment resumes the same order. Authorized payment is not displayed as paid; confirmed capture uses the server total and removes purchased cart units once.
- Account switching does not expose the previous customer's order. Checked browser storage does not contain the earlier delivery address or an unscoped receipt object.
- Web and PWA support forms save their requests to demo Firestore; the sold-out waitlist form saves the request. This verifies form submission, not support response or restock notification delivery.
- India Post links are available in web navigation and PWA Account; the web link opens a separate tab. The destination is intercepted in this test, so no claim is made about India Post's tracking service availability.
- Admin can submit ₹25.25 against a ₹100 demo payment, see ₹74.75 remaining, refund that remainder, and lose the Refund button at zero balance. Invalid amounts are blocked. The gateway is simulated; no real refund was issued.

**Offline investigation:** the first full journey timed out waiting for Orders to return after reconnecting. Three fresh guest sessions and three signed-in sessions then recovered automatically, and the final uninterrupted full journey also passed. The initial failure is retained as an intermittent observation; its root cause was not established. It should be included in physical-device/network testing rather than silently discarded. [Initial log](initial-customer-journeys.log), [guest repetitions](offline-reproduction.json), [signed-in repetitions](offline-reproduction-signed-in.json), [final customer results](fix-browser-results.json).

**Visual review and scope:** Chrome was exercised at 1440px desktop and 390px mobile viewports, with extra web navigation checks at 360, 768 and 1024px. No horizontal page overflow or unexpected JavaScript exceptions were observed in the checked screens. Screenshots were visually reviewed for representative catalogue, product, account and PWA home layouts. This is not a complete accessibility certification or a Safari/iPhone test.

Representative screenshots: [PWA home](pwa--app-.png), [PWA account](pwa--app-account-.png), [desktop catalogue](web-1440px.png), [360px web catalogue](web-360px.png), [refund dialog](refund-dialog.png).

The test used an isolated production-mode static build, real local Firebase Auth/Firestore emulators, three demo catalogue products and demo customer profiles. OTP, Razorpay and the external tracking destination were simulated. Homepage content used local defaults where no demo content was seeded; production catalogue/content fidelity was not certified. The existing production export and development server were left untouched. No deployed website, real SMS delivery, bank credit or physical installed PWA is claimed as tested.

Initial expanded-test failures caused by incorrect selectors, an unsupported SKU-search expectation, exact address-text matching and render timing were corrected in the test harness. Final interactive results are [here](interactive-ui-results.json); initial results remain available in [the first expanded run](extended-ui-results.json) and [the first interaction rerun](initial-interactive-ui-results.json). No product change was used to turn those checks green.

Further evidence: [desktop checkout](fix-web-checkout-results.json), [tracking/refund UI](tracking-refund-browser-results.json), [isolated build](test-build.log). The earlier [launch/product-flow audit](../launch-2026-09-12/PRODUCT-FLOW-AUDIT.md) still applies: this UI pass does not mark its unrelated outstanding findings resolved.
