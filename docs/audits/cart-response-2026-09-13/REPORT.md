# Cart and favourite responsiveness — 13 September 2026

**Fixed and deployed to https://eshwe.com at 08:49 IST.** Hosting version: `c75bfc791fed709a`.

Signed-in cart and wishlist controls previously waited for a Firestore transaction and listener update before changing on screen. Add, quantity changes, removal and favourite changes now update immediately while transactions save in the background. An ordered queue preserves tap order, and revision numbers prevent delayed responses from undoing newer state or doubling quantities. Failed saves roll back the failed edit and show the existing save-error banner. Signing out disposes pending UI work without exposing it to another account.

Guest cart actions also apply directly to local state during initial cart readiness instead of silently ignoring the tap. The reported five-second guest delay was **not reproduced**: pre-change guest measurements were 5–69 ms, including a 4× CPU slowdown. The production checks below verify current behavior on this test machine, rather than establish the cause on the user's device.

Browsing and bag navigation remain available during saves. The final payment button shows “SAVING BAG…” and stays disabled until pending cart saves finish. Stock caps and server checkout validation remain in force.

## Results

- **60 regression tests passed**, including six new queue tests covering slow saves, ordered edits, listener echoes, stale responses, remote/payment changes, rollback and account disposal. [Output](regressions.log).
- **20 local browser checks passed** across signed-out/signed-in web and PWA: add, quantity, favourites, reload persistence, cross-tab syncing, stock limits, failure feedback and payment handoff. Signed-in writes were deliberately held for **five seconds** while UI changes were checked and the database was verified unchanged. Measured feedback was **1–20 ms**. [Cart/favourite results](browser-results.json), [payment handoff](payment-handoff-results.json).
- **6 live checks passed**: both platforms served the new release, cart/quantity/favourite controls updated, guest state survived reload, bags opened correctly, and no uncaught browser errors occurred. Live feedback was **2–12 ms**; bag navigation took **325 ms on web** and **273 ms on PWA**. [Live results](live-results.json).
- Lint, TypeScript validation, production build and `git diff --check` passed. The production build read 95 published products without changing catalogue data and was checked for demo/emulator configuration before deployment.

Timing measures the control click to the next rendered update in Chromium, not a physical phone's end-to-end touch latency or database completion. Authenticated tests used real local Auth/Firestore emulators with simulated OTP. Live checks used isolated guest browsers; no production account, order, refund, payment or SMS test was performed.

The first browser run identified missing product/search rewrites in the local PWA test server, an overstrict delayed-write assertion (the SDK can queue later writes), and duplicate error feedback from a newly added banner. The server now mirrors Hosting rewrites; the test verifies a held commit plus unchanged cart/wishlist data; feedback uses the existing shared banner. Initial output is retained in [initial-browser.log](initial-browser.log). The payment test was adjusted to use the actual PWA Bag/Delivery steps.

This was a Hosting-only release. Existing backend, rules and stock logic were not changed. [Release and rollback reference](hosting-releases.json).
