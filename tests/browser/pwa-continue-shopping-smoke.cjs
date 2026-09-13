const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http'); const assert = require('node:assert/strict');
const { chromium } = require('/Applications/Visual Studio Code.app/Contents/Resources/app/node_modules/playwright-core');
const root = path.join(fs.readFileSync('/private/tmp/eshwe-pwa-continue-root', 'utf8'), 'out');
const dir = 'docs/audits/pwa-continue-shopping-2026-09-13';
const products = JSON.parse(fs.readFileSync(path.join(root, '../.catalogue-build/products.json')));
const product = products.find(p => p.status === 'active' && p.availableStock === 2);
const results = []; const errors = [];
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.txt': 'text/x-component', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
async function main() {
  let server; let base = process.env.ESHWE_LIVE_ORIGIN;
  if (!base) {
    server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost'); let target = path.join(root, decodeURIComponent(url.pathname));
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      if (!fs.existsSync(target)) {
        const route = ['/app/product/', '/app/search/', '/product/', '/shop/'].find(prefix => url.pathname.startsWith(prefix));
        if (route) target = path.join(root, route, url.pathname.endsWith('.txt') ? 'index.txt' : 'index.html');
      }
      if (!fs.existsSync(target)) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(target));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = 'http://127.0.0.1:' + server.address().port;
  }
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
  const bar = page.locator('.mobile-app-action-bar'); const continueButton = bar.getByRole('button', { name: 'Continue shopping', exact: true });
  async function check(name, run) {
    try { await run(); results.push({ name, status: 'passed' }); console.log('PASS', name); }
    catch (error) { results.push({ name, status: 'failed', error: error.message }); console.log('FAIL', name, error.message); await page.screenshot({ path: `${dir}/${process.env.ESHWE_LIVE_ORIGIN ? 'live-' : ''}${name.replace(/\W+/g, '-')}-failure.png`, fullPage: true }).catch(() => {}); }
  }
  async function addIfNeeded() { const add = bar.getByRole('button', { name: 'ADD TO CART', exact: true }); if (await add.count()) await add.click(); await continueButton.waitFor(); }
  try {
    await check('PWA add button becomes quantity controls and Continue shopping', async () => {
      await page.goto(base + '/app/product/?slug=' + product.slug); await bar.getByRole('button', { name: 'ADD TO CART', exact: true }).waitFor();
      assert.equal(await continueButton.count(), 0); await addIfNeeded();
      assert.equal(await bar.locator('button[aria-label="Decrease quantity"] + span').innerText(), '1');
      await page.getByRole('link', { name: 'View bag with 1 item', exact: true }).waitFor();
      assert.equal(await bar.getByText('View bag', { exact: true }).count(), 0);
    });
    await check('Split action bar fits 320 390 and 430 pixel screens', async () => {
      for (const width of [320, 390, 430]) {
        await page.setViewportSize({ width, height: 844 });
        const quantity = await bar.getByRole('button', { name: 'Decrease quantity', exact: true }).locator('..').boundingBox();
        const action = await continueButton.boundingBox();
        assert.ok(action.width > quantity.width); assert.ok(quantity.x + quantity.width <= action.x);
        assert.ok(action.height >= 44); assert.ok((await bar.getByRole('button', { name: 'Decrease quantity', exact: true }).boundingBox()).width >= 44);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await bar.screenshot({ path: `${dir}/${process.env.ESHWE_LIVE_ORIGIN ? 'live-' : ''}action-bar-${width}.png` });
      }
      await page.setViewportSize({ width: 390, height: 844 });
    });
    await check('Quantity caps remain enforced and removing the item restores Add to Cart', async () => {
      await bar.getByRole('button', { name: 'Increase quantity', exact: true }).click();
      assert.ok(await bar.getByRole('button', { name: 'Increase quantity', exact: true }).isDisabled());
      await bar.getByRole('button', { name: 'Decrease quantity', exact: true }).click(); await bar.getByRole('button', { name: 'Decrease quantity', exact: true }).click();
      await bar.getByRole('button', { name: 'ADD TO CART', exact: true }).waitFor(); assert.equal(await continueButton.count(), 0);
    });
    await check('Shared product links return to Browse and retain the bag', async () => {
      await addIfNeeded(); await continueButton.click();
      await page.waitForURL(base + '/app/search/'); await page.locator('.mobile-app-product-card').first().waitFor();
      assert.ok(await page.evaluate(() => scrollY < 5)); await page.getByRole('link', { name: 'View bag with 1 item', exact: true }).waitFor();
    });
    let origin; let scrollY; let selectedHref;
    await check('Continue shopping restores search filters sort and scroll position', async () => {
      await page.goto(base + '/app/search/?category=' + encodeURIComponent(product.category) + '&q=Golden&sort=price-desc');
      const card = page.locator('.mobile-app-product-card').nth(6); await card.waitFor();
      const link = card.locator('a').first(); await link.scrollIntoViewIfNeeded();
      origin = page.url(); scrollY = await page.evaluate(() => window.scrollY); assert.ok(scrollY > 300);
      selectedHref = await link.getAttribute('href'); await link.click(); await bar.waitFor(); await addIfNeeded();
      await continueButton.click(); await page.waitForURL(origin);
      await page.waitForFunction(y => Math.abs(window.scrollY - y) < 10, scrollY);
      assert.match(page.url(), /sort=price-desc/); assert.match(page.url(), /category=/); assert.match(page.url(), /golden/);
    });
    await check('The return destination survives a product reload', async () => {
      await page.locator(`.mobile-app-product-card a[href="${selectedHref}"]`).first().click(); await continueButton.waitFor();
      await page.reload(); await continueButton.waitFor(); await continueButton.click(); await page.waitForURL(origin);
      await page.waitForFunction(y => Math.abs(window.scrollY - y) < 10, scrollY);
    });
    await check('Related product navigation keeps the original catalogue destination', async () => {
      await page.locator(`.mobile-app-product-card a[href="${selectedHref}"]`).first().click(); await continueButton.waitFor();
      const related = page.locator('.mobile-app-product-card').filter({ has: page.getByRole('button', { name: 'ADD TO CART', exact: true }) }).first();
      await related.locator('a').first().click(); await bar.getByRole('button', { name: /ADD TO CART|Continue shopping/, exact: true }).waitFor();
      await addIfNeeded(); await continueButton.click(); await page.waitForURL(origin);
    });
    await check('Desktop web product controls are unchanged', async () => {
      await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(base + '/product/' + product.slug + '/');
      await page.locator('.web-product-info').waitFor(); assert.equal(await page.getByRole('button', { name: 'Continue shopping', exact: true }).count(), 0);
      await page.locator('.web-product-info').getByRole('button', { name: 'Decrease quantity', exact: true }).waitFor();
    });
    await check('No uncaught browser errors', async () => assert.deepEqual(errors, []));
  } finally {
    await browser.close(); if (server) await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(`${dir}/${process.env.ESHWE_LIVE_ORIGIN ? 'live' : 'browser'}-results.json`, JSON.stringify({ origin: base, results }, null, 2));
  }
  if (results.some(r => r.status === 'failed')) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
