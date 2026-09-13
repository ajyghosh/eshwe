const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Applications/Visual Studio Code.app/Contents/Resources/app/node_modules/playwright-core');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const { Firestore } = require('../../functions/node_modules/@google-cloud/firestore');
const db = new Firestore({ projectId: 'demo-eshwe-launch' });
const products = JSON.parse(fs.readFileSync('/private/tmp/eshwe-browser-fixture.json'));
const dir = process.env.ESHWE_UI_RESULTS_DIR || 'docs/audits/ui-e2e-2026-09-12/search-fix';
const base = 'http://127.0.0.1:3000'; const results = [];
async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const search = page.getByPlaceholder('Search saree, fabric, color, wedding...');
    const controls = page.locator('.web-filter-toolbar select');
    async function ready(url = '/shop/') { await page.goto(base + url); await page.locator('.web-product-grid .web-product-card').first().waitFor(); }
    async function check(name, fn) { try { await fn(); results.push({ name, status: 'passed' }); console.log('PASS', name); } catch (error) { results.push({ name, status: 'failed', error: error.message }); await page.screenshot({ path: `${dir}/${name.replace(/\W+/g, '-')}-failure.png`, fullPage: true }); console.log('FAIL', name, error.message); } }
    await check('Available filter stays selected while sold-out cards update live', async () => {
      await ready(); await controls.nth(3).selectOption('AVAILABLE');
      const ref = db.doc(`sarees/${products[2].id}`); const original = (await ref.get()).data();
      try {
        await ref.update({ availableStock: 0 });
        await page.waitForFunction(name => ![...document.querySelectorAll('.web-product-grid .web-product-card')].some(card => card.innerText.includes(name)), products[2].name);
        assert.equal(await controls.nth(3).inputValue(), 'AVAILABLE');
        assert.equal(await page.locator('.web-product-grid .web-product-card').count(), 2);
      } finally { await ref.update({ availableStock: original.availableStock }); }
    });
    await check('Submitting a search preserves fabric availability and sort', async () => {
      await ready(); await controls.nth(2).selectOption(products[1].fabric); await controls.nth(3).selectOption('AVAILABLE'); await controls.first().selectOption('Price: High to Low');
      await search.fill(products[1].name); await page.getByRole('button', { name: 'APPLY', exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll('.web-product-grid .web-product-card').length === 1);
      assert.equal(await controls.nth(2).inputValue(), products[1].fabric); assert.equal(await controls.nth(3).inputValue(), 'AVAILABLE'); assert.equal(await controls.first().inputValue(), 'Price: High to Low');
      assert.equal(await search.inputValue(), products[1].name);
    });
    await check('Category and query deep links survive initial load and reload', async () => {
      await ready(`/shop/?browse=curated&filter=${encodeURIComponent(products[1].category)}&q=${encodeURIComponent(products[1].name)}`);
      await page.waitForFunction(category => document.querySelectorAll('.web-filter-toolbar select')[1]?.value === category, products[1].category);
      await page.reload(); await page.locator('.web-product-grid .web-product-card').first().waitFor();
      await page.waitForFunction(category => document.querySelectorAll('.web-filter-toolbar select')[1]?.value === category, products[1].category);
      assert.equal(await controls.nth(1).inputValue(), products[1].category);
      assert.equal((await search.inputValue()).toLowerCase(), products[1].name.toLowerCase());
      assert.equal(await page.locator('.web-product-grid .web-product-card').count(), 1);
    });
    await check('Back forward navigation and Clear restore the intended form state', async () => {
      await ready(`/shop/?q=${encodeURIComponent(products[0].name)}`);
      await page.evaluate(query => window.history.pushState(null, '', `/shop/?q=${encodeURIComponent(query)}`), products[1].name);
      await page.waitForFunction(query => document.querySelector('.web-filter-toolbar input')?.value.toLowerCase() === query.toLowerCase(), products[1].name);
      await page.goBack(); await page.waitForFunction(query => document.querySelector('.web-filter-toolbar input')?.value.toLowerCase() === query.toLowerCase(), products[0].name);
      await page.goForward(); await page.waitForFunction(query => document.querySelector('.web-filter-toolbar input')?.value.toLowerCase() === query.toLowerCase(), products[1].name);
      await page.getByRole('button', { name: 'CLEAR', exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll('.web-product-grid .web-product-card').length === 3);
      assert.equal(await search.inputValue(), ''); assert.equal(await controls.nth(3).inputValue(), 'ALL'); assert.equal(await controls.first().inputValue(), 'Newest');
    });
    await check('Category-card refresh preserves an unfinished query and selected availability', async () => {
      await ready(); await controls.nth(3).selectOption('AVAILABLE'); await search.fill('unfinished customer search');
      const ref = db.doc('categoryCards/ui-search-refresh');
      try {
        await ref.set({ title: 'UI refresh category', shopFilter: products[0].category, imageUrl: '/eshwelogo-transparent.png', imagePath: '', active: true, sortOrder: 99, backgroundPosition: 'center' });
        await page.getByRole('link', { name: 'UI refresh category', exact: true }).first().waitFor();
        assert.equal(await search.inputValue(), 'unfinished customer search'); assert.equal(await controls.nth(3).inputValue(), 'AVAILABLE');
      } finally { await ref.delete(); }
    });
    await check('No catalogue runtime errors', async () => assert.deepEqual(errors, []));
  } finally { await browser.close(); await db.terminate(); fs.writeFileSync(`${dir}/catalogue-state-results.json`, JSON.stringify(results, null, 2)); }
  if (results.some(r => r.status === 'failed')) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
