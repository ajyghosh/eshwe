const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/source.cjs');
const { matchesPriceRange, normalizePriceRange } = loadSource('src/lib/price-ranges.ts');
const mocks = { '@/lib/sarees': { slugifySareeName: value => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') } };

test('Affordable Elegance includes both price boundaries and uses selling price, not original price', () => {
  for (const price of [399, 799, 999]) {
    assert.equal(matchesPriceRange({ price, originalPrice: 2500 }, 'affordable'), true);
  }
  for (const price of [0, 398.99, 999.01, 1000, NaN, Infinity]) {
    assert.equal(matchesPriceRange({ price, originalPrice: 799 }, 'affordable'), false);
  }
  const product = { price: 799, category: 'Soft Silk' };
  assert.equal(matchesPriceRange(product, 'affordable'), true);
  product.price = 1200;
  assert.equal(matchesPriceRange(product, 'affordable'), false);
  assert.equal(product.category, 'Soft Silk');
});

test('all prices and invalid URL presets fall back safely; the wider budget remains inclusive', () => {
  assert.equal(normalizePriceRange('unknown'), '');
  assert.equal(normalizePriceRange(null), '');
  assert.equal(matchesPriceRange({ price: 5000 }, ''), true);
  assert.equal(matchesPriceRange({ price: 2000 }, 'under-2000'), true);
  assert.equal(matchesPriceRange({ price: 2001 }, 'under-2000'), false);
});

test('PWA links preserve price alongside category, fabric, occasion, search and sort after reload', () => {
  const routes = loadSource('src/lib/mobile-app-routes.ts', mocks);
  for (const q of ['', 'gold']) {
    const state = { priceRange: 'affordable', category: 'Soft Silk', fabric: 'Silk', intent: 'Everyday', q, sort: 'price-asc' };
    for (const href of [routes.buildAppSearchHref(state), routes.buildAppSearchVisiblePath(state)]) {
      const url = new URL(href, 'https://eshwe.test');
      const restored = routes.resolveAppSearchState(url.pathname, Object.fromEntries(url.searchParams));
      assert.equal(restored.priceRange, 'affordable');
      assert.equal(restored.category.toLowerCase(), 'soft silk');
      assert.equal(restored.fabric, 'Silk');
      assert.equal(restored.intent, 'Everyday');
      assert.equal(restored.sort, 'price-asc');
      assert.equal(restored.q, q);
    }
  }
  assert.equal(routes.buildAppSearchHref({ priceRange: '' }), '/app/search/');
});

test('web banner and search links retain the price range in every browse mode', () => {
  const routes = loadSource('src/lib/storefront-routes.ts', mocks);
  assert.equal(routes.buildShopHref({ priceRange: 'affordable' }), '/shop/?priceRange=affordable');
  for (const browse of ['all', 'curated', 'new-arrivals', 'featured']) {
    const state = { browse, filter: 'Soft Silk', q: 'gold', priceRange: 'affordable' };
    for (const href of [routes.buildShopSearchHref(state), routes.buildShopVisiblePath(state)]) {
      const url = new URL(href, 'https://eshwe.test');
      assert.equal(url.searchParams.get('priceRange'), 'affordable');
      assert.equal(routes.resolveShopSearchQuery(url.pathname, url.searchParams.get('q')), 'gold');
      assert.equal(routes.resolveShopLocation(url.pathname, url.searchParams.get('browse'), url.searchParams.get('filter')).browse, browse);
    }
  }
  assert.equal(routes.buildShopHref({ priceRange: 'invalid' }), '/shop/');
});
