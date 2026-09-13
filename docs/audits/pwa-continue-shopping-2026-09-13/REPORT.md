# PWA Continue shopping — 13 September 2026

**Deployed to https://eshwe.com at 09:18 IST.** Final Hosting version: `2c774154c82733cf`.

On the **PWA product detail page only**, adding a product now changes the bottom action bar to **[− quantity +] [Continue shopping →]**. The shopping action receives more width, and the quantity buttons retain 44-pixel touch targets. Removing the last unit restores the full Add to Cart button. The existing floating bag and top Back button remain available.

Continue shopping returns to the previous PWA browsing URL with its search, filters, sorting and scroll position. The destination survives product reloads and related-product navigation. Shared product links without a browsing origin return to Browse at the top. The cart remains saved. Desktop web product controls were verified unchanged.

## Verification

- **65 regression tests passed**, including five navigation tests for origin handling, safe fallback and restoration across a loading-view remount. [Output](regressions.log).
- **9 browser checks passed against the isolated production build**, then **all 9 passed on the deployed site**. Coverage includes the split controls, quantity limits, removal, bag retention, shared links, filtered/scroll return, reloads, related products, unchanged desktop controls and uncaught runtime errors. [Local results](browser-results.json), [live results](live-results.json).
- Layout checked at **320, 390 and 430 pixels**. [390-pixel preview](live-action-bar-390.png), [320-pixel preview](live-action-bar-320.png).
- Lint, TypeScript, production build and `git diff --check` passed. The final export matched the checked application source and used production configuration.

The first live pass exposed a restoration timing issue: the stored position remained pending while the catalogue view reloaded. Restoration now observes the current view's own element, retries when its content changes, and retains the pending position through loading-view cleanup. The final local and live checks both pass. [Initial live evidence](initial-live-results.json) is retained. An earlier related-product test selected a sold-out item; that test now selects an available item without changing stock.

Checks used isolated guest Chromium browsers and read-only public catalogue data. No production account, inventory, price, order or payment was modified. Physical installed Android/iPhone behavior was not separately tested. This release changed Hosting only; the temporary deployment configuration and copied environment file were removed afterward.

[Deployment and rollback references](hosting-releases.json).
