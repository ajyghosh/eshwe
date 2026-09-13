# Tracking links and selectable refunds

Implemented locally on 12 September 2026. These changes have not been deployed and no real customer refund was issued.

- Web: **Track order** appears in the top navigation.
- PWA: **Track order** appears in Account, both before and after sign-in.
- Both links open `https://www.indiapost.gov.in/` in a separate tab/window. Customers enter their consignment number on India Post. This change does not assign tracking numbers to orders or automatically retrieve shipment status.
- Admin Orders: **Refund** opens an amount form showing the amount already refunded and the remaining balance. Enter rupees with up to two decimal places, then confirm the displayed amount. A successful partial refund leaves the balance available for a later refund.
- The backend refunds the payment ID stored on the original order. There is no destination-account entry: Razorpay returns the money to the original payment method. See [Razorpay's normal-refund documentation](https://razorpay.com/docs/payments/refunds/normal/?locale=en-US).

The server validates captured payment status, positive integer paise and the available balance. Durable request references protect duplicate submissions and retries; a transaction prevents two admins from acting on the same stale balance. Each amount request records its actor and amount in order history. Pending/ambiguous refunds block another request until resolved. The scheduler/status check can recover a lost response using the same body and idempotency key, and fetch a known refund by ID to update its status. These requests follow [Razorpay's refund idempotency contract](https://razorpay.com/docs/api/refunds/normal-refunds-idempotent/?preferred-country=IN).

Stock does not automatically increase when money is refunded. The existing full-order inspected-return control remains separate; line-specific returns/restocking are outside this change. Existing fulfilment review restrictions on refunded orders remain in effect.

**Verification: 65 automated checks passed.**

| Verification | Result | Evidence |
| --- | --- | --- |
| Regression suite | 53 passed, including 12 new refund tests | [Output](tracking-refund-regression-results.txt) |
| Real Firestore emulator integration | 5 passed, including concurrent partial refunds and protected refund-request writes | [Output](tracking-refund-emulator-results.txt) |
| Chrome browser checks | 7 passed; no browser runtime errors | [Results](tracking-refund-browser-results.json) |
| Lint | Passed, no lint warnings/errors | [Output](tracking-refund-lint-results.txt) |
| TypeScript and backend syntax | Passed | TypeScript also checked by the production build |
| Production static export | Passed using the existing catalogue snapshot | [Build output](tracking-refund-production-build.txt) |

The browser test submitted ₹25.25 against a ₹100 demo payment, observed ₹74.75 remaining, refunded the balance and verified that the Refund button disappeared. It also tested invalid input, the external web link, and the PWA account link at a 390px width. [Refund dialog screenshot](refund-dialog.png).

Payment-provider calls and the external tracking destination were mocked in automated tests. Firestore/Auth used local demo emulators. Browser testing was followed by a fresh production-configured export so `out/` is not left configured for emulators. No live Razorpay refund, bank credit, SMS, production deployment, or physical installed-device test is claimed.

The first production build in the shared working directory failed with missing generated product-page modules. An existing Next.js development server was also running. The build was rerun successfully from an isolated source copy, and its verified production export was copied to `out/`. The development server was left running; only this task's emulators and test server were stopped. [Initial build failure](tracking-refund-shared-build-retry.txt), [verification summary](tracking-refund-verification.json).

Before release, deploy the matching frontend and Functions together, including `functions/refunds.js`. Verify a provider test-mode partial refund and its processed/failed webhook against the deployed integration. Existing audit findings outside the tracking links and amount-selectable refunds are not marked fixed by this work.

Reproduction: `npm test`; `npm run test:emulator` with the demo Firestore emulator; and `node tests/browser/tracking-refund-smoke.cjs` with the existing emulator-configured browser test server. The browser test mutates only designated local demo records and uses mocked Razorpay responses.
