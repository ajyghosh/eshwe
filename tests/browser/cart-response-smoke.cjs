const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('/Applications/Visual Studio Code.app/Contents/Resources/app/node_modules/playwright-core');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const { Firestore } = require('../../functions/node_modules/@google-cloud/firestore');
const db = new Firestore({ projectId: 'demo-eshwe-launch' });
const base = 'http://127.0.0.1:3000';
const dir = 'docs/audits/cart-response-2026-09-13';
const results = []; const timings = [];
const products = JSON.parse(fs.readFileSync('/private/tmp/eshwe-browser-fixture.json'));
const product = products[2];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function check(name, run) { try { await run(); results.push({ name, status: 'passed' }); console.log('PASS', name); } catch (error) { results.push({ name, status: 'failed', error: error.message }); console.log('FAIL', name, error.message); } }
async function saved(predicate) { for (let i = 0; i < 100; i++) { const profile = (await db.doc('customerProfiles/alice').get()).data(); if (predicate(profile)) return profile; await sleep(100); } throw Error('Server cart/wishlist did not settle'); }
async function login(page) {
  await page.goto(base + '/app/account/'); await page.getByRole('button', { name: 'CONTINUE WITH SMS' }).click();
  await page.getByPlaceholder('9876543210').fill('9999999991'); await page.getByRole('button', { name: 'PROCEED', exact: true }).click();
  await page.getByPlaceholder('6-digit code').fill('123456'); await page.getByRole('button', { name: 'VERIFY', exact: true }).click();
  await page.getByRole('button', { name: 'SIGN OUT', exact: true }).waitFor();
}
async function measure(button, selector, text, label) {
  const milliseconds = await button.evaluate((element, { selector, text }) => new Promise((resolve, reject) => {
    const start = performance.now(); let timer;
    const observer = new MutationObserver(() => {
      const node = document.querySelector(selector);
      if (node && (!text || node.textContent.trim() === text)) {
        observer.disconnect(); clearTimeout(timer); requestAnimationFrame(() => resolve(Math.round(performance.now() - start)));
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    timer = setTimeout(() => { observer.disconnect(); reject(Error('Control did not update within 1000 ms')); }, 1000);
    element.click();
  }), { selector, text });
  timings.push({ label, milliseconds }); assert.ok(milliseconds < 300, label + ': ' + milliseconds + ' ms');
}
async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const signedIn of [false, true]) for (const mode of ['web', 'PWA']) {
      const label = (signedIn ? 'Signed-in ' : 'Guest ') + mode;
      if (signedIn) await db.doc('customerProfiles/alice').update({ cartItems: [], favoriteSkus: [], cartRevision: 100, favoriteRevision: 100 });
      const context = await browser.newContext({ viewport: mode === 'web' ? { width: 1440, height: 1000 } : { width: 390, height: 844 } });
      const page = await context.newPage(); page.setDefaultTimeout(15000); const errors = []; page.on('pageerror', e => errors.push(e.message));
      let release = () => {}; let held = 0;
      const pending = new Promise(resolve => { release = resolve; });
      let hold = signedIn; let rejectWrites = false;
      await page.route(/\/documents:commit(?:\?|$)/, async route => {
        if (rejectWrites) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { code: 403, status: 'PERMISSION_DENIED', message: 'Test save denied' } }) });
        if (hold) { held++; await pending; }
        await route.continue();
      });
      try {
        if (signedIn) await login(page);
        const url = mode === 'web' ? `/product/${product.slug}/` : `/app/product/?slug=${product.slug}`;
        const scope = mode === 'web' ? '.web-product-info' : '.mobile-app-action-bar';
        await page.goto(base + url);
        const add = page.locator(scope).getByRole('button', { name: 'ADD TO CART', exact: true }); await add.waitFor();
        await page.getByRole('button', { name: 'Save to favorites', exact: true }).first().waitFor();
        await check(label + ': add, quantity and favourite respond within 300 ms', async () => {
          const started = Date.now();
          await measure(add, scope + ' [aria-label="Decrease quantity"]', '', label + ' add');
          await measure(page.locator(scope).getByRole('button', { name: 'Increase quantity', exact: true }), scope + ' button[aria-label="Decrease quantity"] + span', '2', label + ' quantity');
          await measure(page.getByRole('button', { name: 'Save to favorites', exact: true }).first(), 'button[aria-label="Remove from favorites"]', '', label + ' favourite');
          if (signedIn) {
            await sleep(Math.max(0, 5000 - (Date.now() - started)));
            assert.ok(held >= 1, 'A real commit must be held (the SDK may queue subsequent transactions behind it)');
            const before = (await db.doc('customerProfiles/alice').get()).data();
            assert.equal(before.cartItems.length, 0); assert.equal(before.favoriteSkus.length, 0);
            assert.equal(await page.locator(scope + ' button[aria-label="Decrease quantity"] + span').innerText(), '2');
            assert.equal(await page.getByRole('button', { name: 'Remove from favorites', exact: true }).first().getAttribute('aria-pressed'), 'true');
          }
        });
        hold = false; release();
        await check(label + ': persisted values and web/PWA bag agree without doubling', async () => {
          if (signedIn) await saved(p => p.cartItems?.[0]?.quantity === 2 && p.favoriteSkus?.includes(product.sku));
          await page.reload();
          await page.locator(scope).getByRole('button', { name: 'Decrease quantity', exact: true }).waitFor();
          assert.equal(await page.locator(scope + ' button[aria-label="Decrease quantity"] + span').innerText(), '2');
          await page.getByRole('button', { name: 'Remove from favorites', exact: true }).first().waitFor();
          const other = await context.newPage(); await other.goto(base + (mode === 'web' ? '/app/checkout/' : '/checkout/'));
          await other.getByText(product.name, { exact: true }).first().waitFor();
          const quantity = other.getByRole('button', { name: 'Decrease quantity', exact: true }).first().locator('..').locator('span');
          assert.equal(await quantity.innerText(), '2');
          await page.locator(scope).getByRole('button', { name: 'Increase quantity', exact: true }).click();
          await other.waitForFunction(() => document.querySelector('button[aria-label="Decrease quantity"]')?.parentElement?.querySelector('span')?.textContent === '3');
          await other.close();
        });
        if (signedIn) await check(label + ': failed saves roll back and show a message', async () => {
          await saved(p => p.cartItems?.[0]?.quantity === 3); rejectWrites = true;
          await page.locator(scope).getByRole('button', { name: 'Increase quantity', exact: true }).click();
          await page.getByText('Your bag change could not be saved. Please try again.', { exact: true }).waitFor();
          assert.equal(await page.locator(scope + ' button[aria-label="Decrease quantity"] + span').innerText(), '3');
          await page.getByRole('button', { name: 'Remove from favorites', exact: true }).first().click();
          await page.getByText('Your wishlist change could not be saved. Please try again.', { exact: true }).waitFor();
          await page.getByRole('button', { name: 'Remove from favorites', exact: true }).first().waitFor();
          rejectWrites = false;
          await page.screenshot({ path: `${dir}/${mode}-failed-save-feedback.png`, fullPage: true });
        });
        await check(label + ': stock limits still prevent extra quantities', async () => {
          const plus = page.locator(scope).getByRole('button', { name: 'Increase quantity', exact: true });
          await plus.click(); await plus.click(); assert.ok(await plus.isDisabled());
          assert.equal(await page.locator(scope + ' button[aria-label="Decrease quantity"] + span').innerText(), '5');
          if (signedIn) await saved(p => p.cartItems?.[0]?.quantity === 5);
        });
        await check(label + ': no uncaught browser errors', async () => assert.deepEqual(errors, []));
      } finally { hold = false; release(); await context.close(); }
    }
  } finally {
    await browser.close(); await db.terminate();
    fs.writeFileSync(`${dir}/browser-results.json`, JSON.stringify({ results, timings }, null, 2));
  }
  if (results.some(r => r.status === 'failed')) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
