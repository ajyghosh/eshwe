# Eshwe launch audit — 12 September 2026

> Historical findings before the requested fixes. See [the fix and verification report](FIXES.md) for the current implementation and remaining release checks.

**Recommendation: hold the public sales launch until the payment, inventory, authentication, and account-data issues below are fixed.** The application builds successfully, but checkout can accept money for an order it cannot fulfil or finish recording.

Audited local revision: `cc33ef6`. Public checks: `https://eshwe.com`, approximately 18:11 IST. Backend findings refer to the checked-out source; deployed Cloud Functions, private orders, Razorpay configuration, and authenticated admin operations were not inspected directly. No live payment, SMS, admin mutation, deployment, or production data change was performed. Changes made for this audit are this report, evidence files, and an offline reproduction script.

## What happens when only one piece remains?

| Customer action | Current behavior | Consequence for another customer |
| --- | --- | --- |
| Product has stock 1 | Web product details show “Only 1 left in stock.” Quantity increases are capped by stock. | Both customers can see and add the same piece. |
| Customer A adds it to the bag | Only A's browser cart changes. | Customer B still sees it as available. A bag does not reserve stock. |
| A opens Razorpay | Backend checks availability and price, then creates the payment order. It does not reserve or deduct stock. | B can also open payment for the last piece. |
| A pays and the inventory transaction succeeds | Stock becomes 0 and status becomes `out_of_stock`. | Connected catalogue/cart listeners receive the change; product buttons become “Notify me,” and existing cart items become unavailable. This depends on connectivity and successful processing. |
| B opens checkout after that change | The server rejects B's unavailable item before creating a new payment order. | This case is protected. |
| B already has a payment window open and pays | Payment can be captured externally, then B's inventory transaction throws for insufficient stock. | B can be charged without a confirmed order. There is no automatic refund or dedicated exception queue in this implementation. |
| A's bag contains two distinct products | The inventory transaction tries to read the second product after writing the first. | Firestore rejects the transaction; neither stock deduction nor the paid-order update commits. |

**Required behavior:** reserve the requested units atomically before enabling payment, with a reservation owner, expiry, and an idempotent checkout identifier. Other shoppers should see “Temporarily reserved” when all available units are held, then “Out of stock” after capture. Release expired/abandoned holds safely; reconcile in-flight payments before releasing a hold. Record late captures as a visible payment/fulfilment exception and reconcile or refund them. Do not treat browser cart contents as reservations.

The web currently promises “In-stock pieces are reserved at checkout,” although the backend does not implement that promise: [product-detail-page.tsx](/Users/ajayghosh/Desktop/eshwe/src/components/product-detail-page.tsx:468).

## Launch blockers and high-priority fixes

**01 — P0: Orders with multiple product lines fail after payment.**

The inventory loop reads a product, queues its update, then reads the next product. The installed Firestore SDK rejects reads after queued writes. The offline reproduction uses the installed SDK's actual guard and confirms that the order remains pending and stock is unchanged. Firebase also documents the requirement that transaction reads precede writes: [Firebase transaction documentation](https://firebase.google.com/docs/firestore/manage-data/transactions).

Fix: resolve all product references, read all documents, aggregate quantities per product, validate the entire order, and only then queue writes. Preserve the existing once-only inventory marker. Validate with two distinct products, duplicate input lines, insufficient stock on the final line, and repeated callback/webhook processing.

Evidence: [functions/index.js](/Users/ajayghosh/Desktop/eshwe/functions/index.js:1063).

**02 — P0: Two customers can pay for the last piece.**

`priceCart` performs ordinary reads; creating a Razorpay order does not hold stock. Stock is deducted only after capture. The transaction prevents negative inventory, but cannot undo the external charge when stock has gone. Because recording payment success and decrementing stock are coupled, the losing order can remain `pending` and be absent from the admin paid-order queue. The offline fixture confirms both checkouts pass pricing, then the second cannot commit.

Fix: implement the reservation and payment-reconciliation flow described above, including expiry and late-payment handling. Keep a durable record of confirmed payment independently of whether fulfilment can proceed. Add an admin queue for paid orders needing intervention.

Evidence: [order creation](/Users/ajayghosh/Desktop/eshwe/functions/index.js:211), [stock check](/Users/ajayghosh/Desktop/eshwe/functions/index.js:616), [capture commit](/Users/ajayghosh/Desktop/eshwe/functions/index.js:1050), [admin order selection](/Users/ajayghosh/Desktop/eshwe/src/lib/orders.ts:90).

**03 — P0: Incorrect OTP attempts do not consume the configured allowance.**

On an incorrect code, the transaction queues an attempt-count increment and then throws. Throwing aborts the transaction, including that increment. Seven simulated wrong attempts left the count at zero; the original code remained usable. Expired/locked-code deletions queued before throwing also roll back. SMS-send rate limits do not fix this verification-path defect.

Fix: return a result from the transaction so the counter/deletion commits, then throw the HTTP error outside it. Apply a separate verification rate limit and test concurrent failures, lockout, expiry, and one-time successful use.

Evidence: [functions/index.js](/Users/ajayghosh/Desktop/eshwe/functions/index.js:1254).

**04 — P1: The published catalogue still contains test pricing and test identifiers.**

A read-only query of published products returned **95 products, all priced at ₹1; 94 have `DUMMY-` SKUs; 94 have discount percentages inconsistent with their current prices**. Thirteen active products have stock 1. The visible web product cards use logo placeholders in place of saree photographs. The mobile homepage still says “OPENING SHORTLY” and “soft launch preview.” This may be intentional during preparation, but it is not ready for a public sales launch.

Fix: replace/archive dummy products, enter approved prices and counted physical stock, recompute discounts, review the final product URLs and photographs, and update the launch announcement. Protect test-price scripts against accidentally targeting production. No prices were changed during this audit.

Evidence: [live shop](https://eshwe.com/shop/), [public-smoke.json](public-smoke.json), [web screenshot](web-shop.png), [app screenshot](app-home.png), [test-price script](/Users/ajayghosh/Desktop/eshwe/scripts/set-all-saree-prices.mjs:21).

**05 — P1: Saving an old admin form can put sold stock back on sale.**

Opening the edit form copies stock and status into local form state. Saving submits that entire snapshot with `updateDoc`. Example: admin opens stock 1, a customer buys it, then admin changes the description and saves. The save writes stock 1/active back over stock 0/out-of-stock. Two admins can similarly overwrite one another.

Fix: separate descriptive edits from stock adjustments. Do not submit stock/status unless deliberately changed; apply inventory adjustments in a server transaction with a version/precondition and an adjustment history. Flag conflicts instead of silently overwriting a newer value.

Evidence: [form snapshot](/Users/ajayghosh/Desktop/eshwe/src/components/owner-dashboard.tsx:328), [full save payload](/Users/ajayghosh/Desktop/eshwe/src/components/owner-dashboard.tsx:455), [update helper](/Users/ajayghosh/Desktop/eshwe/src/lib/sarees.ts:112).

**06 — P1: Payment receipts can falsely say “Paid,” and interruption recovery can encourage a second purchase.**

Both payment clients discard the returned `paymentStatus`, accept `success: true`, and hardcode `captured` into the confirmation. The server can return success with an authorized, pending, or failed payment status. Client-generated receipt totals also use the earlier browser totals rather than one complete authoritative order snapshot. If verification/network/storage fails, the order reference is not durably retained for resuming the attempt; paying again creates a fresh order. The PWA's missing-confirmation text explicitly suggests placing the order again.

Fix: use a shared payment client and a server-backed order-status screen. Display pending/authorized/captured accurately, persist the pending order ID, recover after refresh/app termination/UPI app switching, and reuse a checkout idempotency key. Generate the receipt and all amounts from the persisted server order. Replace “place the order again” with “check payment status” and support guidance.

Evidence: [web verification](/Users/ajayghosh/Desktop/eshwe/src/components/payment-page.tsx:501), [hardcoded web status](/Users/ajayghosh/Desktop/eshwe/src/components/payment-page.tsx:550), [PWA verification](/Users/ajayghosh/Desktop/eshwe/src/components/mobile-app-pages.tsx:3787), [PWA hardcoded status](/Users/ajayghosh/Desktop/eshwe/src/components/mobile-app-pages.tsx:3851), [retry copy](/Users/ajayghosh/Desktop/eshwe/src/components/mobile-app-pages.tsx:2581), [server response](/Users/ajayghosh/Desktop/eshwe/functions/index.js:290).

**07 — P1: Payment state can move backwards, including after an invalid signature.**

An authorized/failed webhook updates an order unconditionally, even after capture. An invalid verification signature also changes the stored order to failed before rejecting the request. Both were reproduced offline against an already-paid fixture. This can leave contradictory fields such as `paymentCaptured: true` and `paymentStatus: authorized`; owner and customer screens interpret those fields differently. The captured-webhook branch returns before the later `razorpayPaymentId` assignment, so webhook-only recovery may also leave that top-level ID missing.

Fix: reject invalid signatures without mutating order/payment status. Use transactional state transitions and payment-attempt IDs; an old event must not downgrade a confirmed capture. Store the capture payment ID consistently, deduplicate events, validate the order/amount/currency, and distinguish refunds from payment failures.

Evidence: [invalid-signature mutation](/Users/ajayghosh/Desktop/eshwe/functions/index.js:785), [webhook updates](/Users/ajayghosh/Desktop/eshwe/functions/index.js:1026).

**08 — P1: PWA address saves remove addresses saved through the web.**

The web supports multiple addresses and a selected address ID. PWA account and checkout read `addresses[0]` rather than the selected address and write `addresses: [nextAddress]`. Editing an address in the PWA replaces the shared array with one entry, discarding the others and potentially choosing a different delivery address from the web.

Fix: share the address model and editing logic across both experiences. Resolve `selectedAddressId`, update a single address by stable ID, preserve other entries, and prevent stale full-array overwrites. Test two saved web addresses, selecting the second, opening PWA checkout, editing, and returning to web.

Evidence: [PWA address selection](/Users/ajayghosh/Desktop/eshwe/src/components/mobile-app-pages.tsx:1144), [PWA account save](/Users/ajayghosh/Desktop/eshwe/src/components/mobile-app-pages.tsx:1229), [PWA checkout save](/Users/ajayghosh/Desktop/eshwe/src/components/mobile-app-pages.tsx:1907), [web address payload](/Users/ajayghosh/Desktop/eshwe/src/components/account-page.tsx:522).

**09 — P1: Signing in can double bag quantities; signing out carries account items into the next session.**

At guest-to-account sign-in, `mergeCartItems` adds quantities from the in-memory cart to the guest localStorage cart even though they normally represent the same bag. A quantity of 1 becomes 2 when stock permits; the offline reproduction confirms this. Signing out copies account cart/favorites into the guest bucket, which the next account can inherit.

Fix: choose one authoritative guest snapshot and merge it into the account once. Clear active account state on logout and keep account-specific data isolated. Test guest sign-in, reload, repeated sign-out/sign-in, and customer A followed by customer B on one browser.

Evidence: [cart hydration](/Users/ajayghosh/Desktop/eshwe/src/components/cart-provider.tsx:67), [quantity merge](/Users/ajayghosh/Desktop/eshwe/src/components/cart-provider.tsx:336), [favorite logout merge](/Users/ajayghosh/Desktop/eshwe/src/components/favorites-provider.tsx:84).

**10 — P1: The latest receipt is not isolated to the signed-in account.**

A single sessionStorage key holds the receipt, including customer name, address, phone, and email. Confirmation pages read it without checking the current user. Sign-out only calls Firebase sign-out; the receipt remains in the tab. Another person using the same tab can open the previous customer's confirmation. This is a source-confirmed shared-device exposure, not an observed incident involving real customer data.

Fix: store only an order reference where possible, fetch through authenticated order ownership checks, clear cached receipt data on logout/account switch, and bind any temporary receipt cache to the user ID.

Evidence: [receipt storage](/Users/ajayghosh/Desktop/eshwe/src/lib/order-confirmation.ts:42), [confirmation reader](/Users/ajayghosh/Desktop/eshwe/src/components/order-confirmation-page.tsx:40), [sign-out](/Users/ajayghosh/Desktop/eshwe/src/lib/auth.ts:44).

## Syncing and product improvements

**11 — P2: Cart and favorites do not provide reliable cross-tab/device syncing.**

The public browser test added a guest item in tab A while tab B remained on an empty checkout. Cart state is localStorage-only, with no storage-event listener or server cart. Cross-device cart syncing is not implemented. Favorites read the profile once and then overwrite its entire array; stale tabs can lose new favorites or reintroduce removed ones. Failed profile reads fall back to an empty remote list, and failed saves are swallowed. Addresses also use one-time reads rather than live subscriptions.

Fix: subscribe to shared account data; use per-item updates/transactions for favorites and addresses, report sync errors, and respond to storage events for guest carts. Decide whether signed-in carts should sync between devices and implement that explicitly. Do not claim full syncing until these paths are covered.

Evidence: [cart provider](/Users/ajayghosh/Desktop/eshwe/src/components/cart-provider.tsx:108), [favorites hydration/write](/Users/ajayghosh/Desktop/eshwe/src/components/favorites-provider.tsx:63), [profile reads/writes](/Users/ajayghosh/Desktop/eshwe/src/lib/customer-profiles.ts:8), [cross-tab browser evidence](public-smoke.json).

**12 — P2: Inventory inputs have unsafe defaults and insufficient identity validation.**

Missing/invalid stock becomes 10 on both client and server. Repeated SKU lines are checked separately, so two lines of quantity 1 both pass against stock 1. Products are created with generated document IDs, while payment lookup uses SKU and `limit(1)`; SKU/slug uniqueness is not enforced by the save path. Current published data had no missing/invalid stock or duplicate SKUs/slugs, so these are prevention defects rather than observed catalogue corruption.

Fix: reject or treat unknown stock as unavailable; require explicit stock for new products. Aggregate duplicate product quantities before any validation. Use immutable product IDs throughout carts/orders and enforce SKU/slug uniqueness transactionally. Separate publication status from sellable quantity so restocking cannot silently leave positive stock hidden by `out_of_stock`.

Evidence: [client default](/Users/ajayghosh/Desktop/eshwe/src/lib/inventory.ts:5), [server default](/Users/ajayghosh/Desktop/eshwe/functions/index.js:692), [request normalization](/Users/ajayghosh/Desktop/eshwe/functions/index.js:537), [SKU lookup](/Users/ajayghosh/Desktop/eshwe/functions/index.js:621), [product creation](/Users/ajayghosh/Desktop/eshwe/src/lib/sarees.ts:98).

**13 — P2: Deleted or drafted products remain apparently available in existing bags.**

The catalogue subscription excludes drafts; cart synchronization returns the old item when its SKU is absent, and returns the whole old cart when the catalogue becomes empty. Thus hiding/deleting a product does not mark existing bag entries unavailable. Backend pricing rejects these items, but the customer only learns this after proceeding toward payment.

Fix: after a successful complete catalogue snapshot, mark missing products unavailable. Track loading/error/last-server-sync separately so a failed read is not mistaken for an empty catalogue. Notify customers when quantities or prices change rather than silently clamping quantities.

Evidence: [cart synchronization](/Users/ajayghosh/Desktop/eshwe/src/components/cart-provider.tsx:346).

**14 — P1: Admin/customer order state is not a complete fulfilment and recovery workflow.**

Admin listens to successful payment flags, while customer history includes created/failed/authorized attempts. PWA history labels orders only “Pending” or “Dispatched”; web history displays payment state and ignores dispatch status. An admin dispatch change can therefore appear in PWA but remain simply “PAID” on web. There is no implemented refund/cancellation/restock workflow, and refund webhooks do not update a refund state or reporting. Paid inventory exceptions from issues 01/02 are especially difficult to discover in admin.

Fix: model payment and fulfilment separately and show both consistently. Add an exception queue with payment IDs and recovery actions. Support cancellation/refund tracking and explicit restock decisions; a refund must not automatically imply a returned item is physically sellable. Keep an audit trail and reconcile provider payments against orders.

Evidence: [owner subscription](/Users/ajayghosh/Desktop/eshwe/src/lib/orders.ts:77), [web status](/Users/ajayghosh/Desktop/eshwe/src/components/customer-orders-page.tsx:181), [PWA status](/Users/ajayghosh/Desktop/eshwe/src/components/mobile-app-pages.tsx:1051), [handled webhook states](/Users/ajayghosh/Desktop/eshwe/functions/index.js:1004).

**15 — P2: PWA has no offline navigation/reload fallback.**

Service worker registration and control worked in the public mobile browser check. However, the worker skips navigations, has no precached offline document, and does not supply an offline fallback. Reloading `/app/search/` after switching the context offline failed with `ERR_INTERNET_DISCONNECTED`. It also caches same-URL static assets indefinitely until a worker update/cache change; unversioned logos/manifest assets can remain stale across deployments that leave the worker unchanged.

Fix: provide an offline/reconnecting screen with a retry action; disable checkout until fresh stock/order state is available. Cache only safe assets with an explicit version/revalidation strategy. Do not cache payment/API responses or customer data as static resources. Verify update behavior separately on installed iOS and Android PWAs.

Evidence: [service worker](/Users/ajayghosh/Desktop/eshwe/public/sw.js:49), [browser evidence](public-smoke.json).

**16 — P2: Hosting preparation deletes route data that Next.js still requests.**

The public browser observed 404s for `/checkout/index.txt`, `/shop/index.txt`, `/contact/index.txt`, and `/index.txt` during navigation/prefetch. The export preparation script explicitly removes these route payloads. The tested product navigation still completed; the evidence supports broken prefetch/route-data requests and extra navigation work, not a claim that every link fails.

Fix: retain the production route payloads generated by Next, remove only actual development artifacts, and validate direct loads and client navigation against the prepared hosting export. The service worker already excludes `.txt`/RSC responses from its static cache.

Evidence: [export cleanup](/Users/ajayghosh/Desktop/eshwe/scripts/prepare-hosting-export.mjs:24), [network observations](public-smoke.json).

**17 — P2: PWA loading and stock messages need parity with web.**

PWA search starts with an empty product array and displays “No sarees available right now” before the subscription resolves. The follow-up browser check loaded 95 results after approximately 3.3 seconds; this is a misleading loading state, not a persistent empty catalogue. Product details similarly have a “Product not found” branch while still loading. Read errors are not distinguished from empty results in these paths. Web details have a low-stock label; the browser check of a stock-1 product confirmed that PWA details do not provide the same “Only 1 left” message.

Fix: add explicit loading, empty, error, and reconnecting states; show low-stock/temporarily-held/sold-out states consistently on both storefronts. Keep the promise about reservations aligned with the backend implementation.

Evidence: [PWA search state/listener](/Users/ajayghosh/Desktop/eshwe/src/components/mobile-app-pages.tsx:374), [PWA product empty state](/Users/ajayghosh/Desktop/eshwe/src/components/mobile-app-pages.tsx:1503), [web low-stock copy](/Users/ajayghosh/Desktop/eshwe/src/components/product-detail-page.tsx:461).

**18 — P2: Admin image changes can break the existing product when save fails.**

Replacing the primary image deletes the old storage object before the new product document saves; gallery removals likewise happen before stock validation and the final write. A failed validation/write can leave the current product referencing deleted images. Deleting a product also deletes media first, and historical orders retain those image URLs.

Fix: validate first, upload new assets, commit the product change, then clean up unreferenced old assets with retry handling. Preserve assets still used in order history or store durable order thumbnails.

Evidence: [image replacement/deletion sequence](/Users/ajayghosh/Desktop/eshwe/src/components/owner-dashboard.tsx:411), [product deletion](/Users/ajayghosh/Desktop/eshwe/src/components/owner-dashboard.tsx:517).

**19 — P2: Product links lack product-specific search/share metadata.**

All pretty product URLs serve a shared client-loaded product page whose canonical URL is `/product/` and whose metadata says “Product.” The sitemap contains no product URLs. Product-specific names, images, canonical links, availability, and structured product data are not generated in the exported page metadata.

Fix: generate product-specific pages/metadata at build time or use a server-rendered product route, and include published product URLs in the sitemap. This improves launch discoverability and link previews; it is separate from payment safety.

Evidence: [product metadata](/Users/ajayghosh/Desktop/eshwe/src/app/product/page.tsx:6), [sitemap](/Users/ajayghosh/Desktop/eshwe/src/app/sitemap.ts:5), [hosting rewrites](/Users/ajayghosh/Desktop/eshwe/firebase.json:119).

**20 — P2: Customer history limits before sorting by date.**

Customer orders query uses `limit(100)` without `orderBy(createdAt)`, then sorts only the returned subset. After enough checkout attempts, recent orders can be omitted. Every create-order attempt contributes a document, including abandoned attempts, so this limit is not restricted to 100 successful purchases.

Fix: order on the server by creation time, paginate, and add the required index. Separate payment attempts from confirmed orders or label them clearly.

Evidence: [customer order query](/Users/ajayghosh/Desktop/eshwe/src/lib/orders.ts:49).

## What is already working

- Server pricing reads product prices from Firestore instead of trusting client-submitted prices.
- A new checkout rejects unavailable, draft, deleted, or insufficient-stock products when the server checks them.
- For a single-product order, the inventory transaction and `inventoryCommitted` marker prevent repeated captured-event processing from deducting twice. This passed the offline positive control.
- A successful stock-zero update causes the shared cart logic to mark the item unavailable. This passed the offline positive control. Catalogue and order views use Firestore snapshot listeners.
- Published product data currently has no missing/invalid stock values, duplicate SKUs, duplicate slugs, active-zero-stock records, or out-of-stock records with positive stock in the queried public set.
- Source Firestore rules restrict customer order reads to the order's user ID, protect owner writes, and exclude draft products from ordinary customer reads. Anonymous admin navigation showed a sign-in screen. These observations are not a substitute for emulator tests of deployed rules.
- Public web catalogue/product navigation worked without JavaScript exceptions in the smoke check. Mobile homepage redirected to `/app/`; tested home/search layouts had no horizontal overflow. The service worker registered and controlled the mobile page.
- Production hosting export, TypeScript, lint, function syntax check, and all four existing owner-reporting tests passed.

## Validation and evidence

| Check | Result |
| --- | --- |
| `npm run build:hosting` | Passed: static pages and hosting export prepared |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed; Next lint deprecation notice only |
| `npm --prefix functions run lint` | Passed syntax check |
| `npm run test:owner` | 4/4 passed |
| `node scripts/audit-launch.cjs` | 11/11 observations confirmed: 9 defect reproductions and 2 positive controls |
| Public web/PWA smoke | Completed in temporary anonymous Chrome contexts; API checkout/SMS calls blocked |
| Public catalogue validation | Read-only query of 95 published products; aggregate findings saved |
| Real payment/UPI/SMS/device-install/admin-write tests | Not performed |

The [offline reproduction script](/Users/ajayghosh/Desktop/eshwe/scripts/audit-launch.cjs) evaluates production source with in-memory service substitutes; it uses the installed Firestore SDK's actual read-after-write guard. Its passing assertions demonstrate current defects. It is intentionally not registered as a release regression suite and does not prove deployed backend behavior.

Browser evidence: [public-smoke.json](public-smoke.json), [mobile follow-up](mobile-followup.json), [web screenshot](web-shop.png), [PWA screenshot](app-home.png). Mobile viewport emulation used Chrome, not an installed Safari/Android PWA.

## Required release checks after fixes

1. In a staging project with Razorpay test mode, race two different customer accounts for one unit: only one reservation should be granted, and no unreconciled successful charge should remain.
2. Buy two distinct products, repeat the captured webhook/callback, send events out of order, and verify one paid order and one deduction per unit.
3. Test reservation timeout, closing checkout, delayed capture, app termination during UPI, lost verification response, and reload. Resume the same order without instructing the customer to pay again.
4. Edit product copy while a payment deducts stock; restock from two admin sessions; verify no lost inventory updates. Check explicit out-of-stock and draft transitions.
5. Exhaust incorrect OTP attempts, test concurrent attempts and expiry, and verify the code cannot be reused after success. Use emulator/mocks or test numbers, not real customer numbers.
6. Test guest sign-in without quantity changes, two tabs, two devices, logout/account switching, wishlist removals, and receipt privacy.
7. Save two addresses on web, select the second, edit from PWA, and confirm both addresses and selection remain correct.
8. Confirm owner dispatch/refund/exception changes appear accurately in both customer UIs. Check that recent order history is complete and paginated.
9. Replace test catalogue data; reconcile approved prices, discounts, SKUs, images, and physically counted stock. Verify Razorpay live mode/capture settings/webhook delivery, deployed function revision/rules/indexes, and effective App Check enforcement. The source default for App Check enforcement is off; actual deployed configuration was not verified.
10. Test installed Android/iOS PWA payment return, offline/reconnect, deployment updates, and direct/shared product links; check route-data requests against the final hosting export.

The stock/payment/authentication fixes are the first release gate. Visual polish and SEO can follow, but successful build output alone is not evidence that money, stock, and customer records remain consistent.
