// Read-only production checks: no sign-in, order, payment, refund or catalogue mutation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/Applications/Visual Studio Code.app/Contents/Resources/app/node_modules/playwright-core');
const base = 'https://eshwe.com';
const results = [];
async function check(name, run) {
  try { await run(); results.push({ name, status: 'passed' }); console.log('PASS', name); }
  catch (error) { results.push({ name, status: 'failed', error: error.message }); console.log('FAIL', name, error.message); }
}
async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await check('Live shop HTML matches the verified release', async () => {
      const response = await context.request.get(base + '/shop/'); assert.equal(response.status(), 200);
      const html = await response.text(); const local = fs.readFileSync('out/shop/index.html', 'utf8');
      const chunks = [...local.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]); assert.ok(chunks.length);
      for (const chunk of chunks) assert.ok(html.includes(chunk), 'Release chunk absent: ' + chunk);
    });
    for (const route of ['/', '/shop/', '/checkout/', '/payment/', '/app/', '/app/search/', '/app/account/', '/owner/']) {
      await check('Live route renders: ' + route, async () => {
        const response = await page.goto(base + route); assert.equal(response.status(), 200);
        await page.locator('body').waitFor(); assert.ok((await page.locator('body').innerText()).length > 80);
        assert.ok(!(await page.locator('body').innerText()).includes('Application error:'));
      });
    }
    await check('Web tracking link points to India Post', async () => {
      await page.goto(base + '/shop/');
      const link = page.getByRole('link', { name: 'Track order with India Post (opens in a new tab)', exact: true }).first();
      await link.waitFor(); assert.equal(await link.getAttribute('href'), 'https://www.indiapost.gov.in/');
      await page.locator('.web-product-grid .web-product-card').first().waitFor();
      await page.screenshot({ path: path.join(__dirname, 'live-web-shop.png'), fullPage: true });
    });
    await check('Live category and search URL survives reload', async () => {
      const catalogue = JSON.parse(fs.readFileSync('.catalogue-build/products.json', 'utf8'));
      const product = catalogue.find(p => p.category && p.name && p.availableStock > 0) || catalogue.find(p => p.category && p.name);
      assert.ok(product);
      await page.goto(base + '/shop/?browse=curated&filter=' + encodeURIComponent(product.category) + '&q=' + encodeURIComponent(product.name));
      const activeFilters = page.getByText('Active filters', { exact: true }).locator('..').locator('..');
      await activeFilters.getByRole('button', { name: product.category, exact: true }).waitFor();
      await page.locator('.web-product-grid .web-product-card').first().waitFor();
      const deepLink = page.url(); assert.match(deepLink, /\/shop\/category\/[^/]+\/search\//);
      await page.reload();
      await activeFilters.getByRole('button', { name: product.category, exact: true }).waitFor();
      assert.equal(page.url(), deepLink);
      assert.equal((await page.getByPlaceholder('Search saree, fabric, color, wedding...').inputValue()).toLowerCase(), product.name.toLowerCase());
      await page.locator('.web-product-grid .web-product-card').first().waitFor();
    });
    await check('PWA Account tracking link and mobile layout', async () => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.goto(base + '/app/account/');
      const link = page.getByRole('link', { name: 'Track order with India Post (opens in a new tab)', exact: true });
      await link.waitFor(); assert.equal(await link.getAttribute('href'), 'https://www.indiapost.gov.in/');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(__dirname, 'live-pwa-account.png'), fullPage: true });
    });
    await check('PWA worker matches the release and prevents stale worker caching', async () => {
      const response = await context.request.get(base + '/sw.js'); assert.equal(response.status(), 200);
      assert.equal(await response.text(), fs.readFileSync('out/sw.js', 'utf8'));
      assert.match(response.headers()['cache-control'], /no-store/);
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    });
    await check('PWA offline fallback renders and reconnect recovers', async () => {
      try {
        await context.setOffline(true); await page.goto(base + '/app/search/');
        await page.getByRole('heading', { name: "You're offline", exact: true }).waitFor();
      } finally { await context.setOffline(false); }
      // The offline page reloads itself on reconnect; wait for that navigation.
      await page.getByPlaceholder('Search sarees, fabrics…').waitFor();
      await page.getByRole('button', { name: 'ADD TO CART', exact: true }).first().waitFor();
    });
    for (const endpoint of ['/api/checkout/status', '/api/owner/order', '/api/owner/product']) {
      await check('New API rejects unauthenticated requests: ' + endpoint, async () => {
        const response = await context.request.post(base + endpoint, { data: {} });
        assert.ok([401, 403].includes(response.status()), 'Unexpected status ' + response.status());
        assert.ok((await response.json()).error);
      });
    }
    await check('No uncaught browser runtime errors', async () => assert.deepEqual(errors, []));
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(__dirname, 'production-smoke-results.json'), JSON.stringify({ origin: base, checkedAt: new Date().toISOString(), results }, null, 2));
  }
  if (results.some(r => r.status === 'failed')) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
