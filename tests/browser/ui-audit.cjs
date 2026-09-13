// Expanded customer UI audit; all writes go to the demo emulator.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Applications/Visual Studio Code.app/Contents/Resources/app/node_modules/playwright-core');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const { Firestore } = require('../../functions/node_modules/@google-cloud/firestore');
const db = new Firestore({ projectId: 'demo-eshwe-launch' });
const base = 'http://127.0.0.1:3000';
const dir = process.env.ESHWE_UI_RESULTS_DIR || 'docs/audits/ui-e2e-2026-09-12';
const products = JSON.parse(fs.readFileSync('/private/tmp/eshwe-browser-fixture.json'));
const results = []; const observations = []; const runtimeErrors = [];
fs.mkdirSync(dir, { recursive: true });
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 110);
async function check(name, page, fn) {
  if (process.env.ESHWE_UI_INTERACTIONS_ONLY && name.includes('route and layout')) return;
  try { await fn(); results.push({ name, status: 'passed' }); console.log('PASS', name); }
  catch (error) {
    const screenshot = `${slug(name)}-failure.png`; await page.screenshot({ path: `${dir}/${screenshot}`, fullPage: true }).catch(() => {});
    results.push({ name, status: 'failed', error: error.message, url: page.url(), screenshot }); console.log('FAIL', name, error.message.split('\n')[0]);
  }
}
async function otp(page, phone) {
  await page.getByPlaceholder('9876543210').fill(phone); await page.getByRole('button', { name: 'PROCEED', exact: true }).click();
  await page.getByPlaceholder('6-digit code').fill('123456'); await page.getByRole('button', { name: 'VERIFY', exact: true }).click();
}
async function loginWeb(page) {
  await page.goto(`${base}/shop/`); await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByRole('button', { name: 'Continue with SMS', exact: true }).click(); await otp(page, '9999999991');
  await page.getByPlaceholder('6-digit code').waitFor({ state: 'hidden' });
}
async function main() {
  const profileRef = db.doc('customerProfiles/alice'); const original = (await profileRef.get()).data();
  await profileRef.update({ favoriteSkus: [], selectedAddressId: 'office', address: 'Office test street', addresses: original.addresses.map(a => a.id === 'office' ? { ...a, address: 'Office test street' } : a) });
  for (const [collection, field, values] of [['customerMessages', 'message', ['UI audit web support request', 'UI audit PWA support request']], ['waitlistEntries', 'email', ['waitlist-ui@example.test']]]) for (const value of values) for (const doc of (await db.collection(collection).where(field, '==', value).get()).docs) await doc.ref.delete();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  browser.on('disconnected', () => {});
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 }); const page = await context.newPage();
      page.setDefaultTimeout(12000); page.on('pageerror', e => runtimeErrors.push({ url: page.url(), error: e.message }));
      const prefix = viewport.width < 500 ? '/app' : '';
      const routes = prefix ? ['/app/', '/app/search/', `/app/product/?slug=${products[1].slug}`, '/app/checkout/', '/app/account/', '/app/orders/', '/app/favorites/', '/app/terms-and-conditions/', '/app/privacy-policy/', '/app/return-policy/'] : ['/', '/shop/', `/product/${products[1].slug}/`, '/checkout/', '/account/', '/orders/', '/saved/', '/contact/', '/terms-and-conditions/', '/privacy-policy/', '/return-policy/'];
      for (const route of routes) await check(`${prefix ? 'PWA' : 'Web'} route and layout ${route}`, page, async () => {
        const response = await page.goto(base + route); assert.equal(response.status(), 200);
        await page.locator('main').first().waitFor(); await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(450);
        const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, text: document.body.innerText, brokenImages: [...document.images].filter(image => { const r = image.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0 && image.complete && !image.naturalWidth; }).map(image => image.currentSrc) }));
        assert.ok(metrics.text.length > 100, 'Page has insufficient rendered content');
        assert.ok(!/Application error:|client-side exception|Firebase configuration missing/.test(metrics.text), 'Application error screen');
        assert.ok(metrics.scrollWidth <= metrics.width + 1, `Horizontal overflow: ${metrics.scrollWidth}px on ${metrics.width}px viewport`);
        if (metrics.brokenImages.length) observations.push({ route, viewport, brokenImages: metrics.brokenImages });
        if (['/', '/shop/', '/app/', '/app/search/', '/app/account/'].includes(route)) await page.screenshot({ path: `${dir}/${prefix ? 'pwa' : 'web'}-${slug(route) || 'home'}.png` });
      });
      await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); const web = await context.newPage();
    web.setDefaultTimeout(12000); web.on('pageerror', e => runtimeErrors.push({ url: web.url(), error: e.message }));
    await check('Web search submits query, narrows products and clears an empty result', web, async () => {
      await web.goto(`${base}/shop/`); await web.waitForFunction(() => document.querySelectorAll('.web-product-grid .web-product-card').length === 3); await web.getByPlaceholder('Search saree, fabric, color, wedding...').fill(products[1].name);
      await web.getByRole('button', { name: 'APPLY', exact: true }).click(); await web.locator('.web-product-grid').getByText(products[1].name, { exact: true }).waitFor();
      await web.waitForFunction(() => document.querySelectorAll('.web-product-grid .web-product-card').length === 1);
      await web.getByPlaceholder('Search saree, fabric, color, wedding...').fill('zz-no-match-ui-audit'); await web.getByRole('button', { name: 'APPLY', exact: true }).click();
      await web.locator('.web-product-grid').waitFor({ state: 'hidden' }); await web.getByRole('button', { name: 'CLEAR', exact: true }).click();
      await web.locator('.web-product-grid .web-product-card').first().waitFor(); await web.waitForFunction(() => document.querySelectorAll('.web-product-grid .web-product-card').length === 3);
    });
    await check('Web price sort changes product order', web, async () => {
      await web.goto(`${base}/shop/`); await web.locator('.web-filter-toolbar select').first().selectOption('Price: High to Low');
      await web.getByRole('button', { name: 'APPLY', exact: true }).click();
      await web.waitForFunction(name => document.querySelector('.web-product-grid .web-product-card')?.innerText.includes(name), products[2].name);
    });
    await check('Web header SMS sign-in validates phone and recovers from incorrect OTP', web, async () => {
      await web.goto(`${base}/shop/`); await web.getByRole('button', { name: 'Account', exact: true }).click(); await web.getByRole('button', { name: 'Continue with SMS', exact: true }).click();
      await web.getByPlaceholder('9876543210').fill('123'); await web.getByRole('button', { name: 'PROCEED', exact: true }).click(); await web.getByText(/10-digit/).first().waitFor();
      await web.getByPlaceholder('9876543210').fill('9999999991'); await web.getByRole('button', { name: 'PROCEED', exact: true }).click();
      await web.route('**/test-api/verifyCustomerOtp', route => route.request().postDataJSON().otp !== '123456' ? route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Incorrect verification code. Try again.' }) }) : route.continue());
      await web.getByPlaceholder('6-digit code').fill('000000'); await web.getByRole('button', { name: 'VERIFY', exact: true }).click(); await web.getByText('Incorrect verification code. Try again.', { exact: true }).waitFor();
      await web.getByPlaceholder('6-digit code').fill('123456'); await web.getByRole('button', { name: 'VERIFY', exact: true }).click(); await web.getByPlaceholder('6-digit code').waitFor({ state: 'hidden' });
      await web.goto(`${base}/account/`); await web.getByText('Office test street', { exact: false }).first().waitFor();
    });
    const pwa = await context.newPage(); await pwa.setViewportSize({ width: 390, height: 844 }); pwa.setDefaultTimeout(12000);
    pwa.on('pageerror', e => runtimeErrors.push({ url: pwa.url(), error: e.message }));
    await check('Wishlist added on web appears on PWA and removal syncs back', web, async () => {
      await web.goto(`${base}/product/${products[2].slug}/`); await pwa.goto(`${base}/app/favorites/`);
      await web.getByRole('button', { name: 'Save to favorites', exact: true }).first().click();
      await pwa.getByText(products[2].name, { exact: true }).first().waitFor();
      await pwa.getByRole('button', { name: 'Remove', exact: true }).first().click();
      await web.getByRole('button', { name: 'Save to favorites', exact: true }).first().waitFor();
    });
    await check('PWA address edit updates web and preserves another saved address', pwa, async () => {
      await pwa.goto(`${base}/app/account/`); await pwa.getByRole('button', { name: 'EDIT', exact: true }).click();
      await pwa.getByLabel('Address', { exact: true }).fill('UI audit edited Office address'); await pwa.getByRole('button', { name: 'SAVE', exact: true }).click();
      await pwa.getByText('UI audit edited Office address', { exact: true }).waitFor(); await web.goto(`${base}/account/`); await web.getByText('UI audit edited Office address', { exact: false }).first().waitFor();
      const profile = (await db.doc('customerProfiles/alice').get()).data(); assert.equal(profile.addresses.length, 2); assert.equal(profile.addresses.find(a => a.id === 'home').address, 'Home test street');
    });
    await check('PWA search submits, clears and opens filter controls', pwa, async () => {
      await pwa.goto(`${base}/app/search/`); await pwa.getByPlaceholder('Search sarees, fabrics…').fill(products[1].name); await pwa.getByPlaceholder('Search sarees, fabrics…').press('Enter');
      await pwa.locator('article.mobile-app-product-card').filter({ hasText: products[1].name }).first().waitFor(); await pwa.getByRole('button', { name: 'Clear search', exact: true }).click();
      await pwa.getByRole('button', { name: 'Filter and sort', exact: true }).click(); await pwa.getByRole('button', { name: 'APPLY', exact: true }).waitFor(); await pwa.getByRole('button', { name: 'CLEAR', exact: true }).click();
      await pwa.getByRole('button', { name: 'APPLY', exact: true }).waitFor({ state: 'hidden' });
    });
    await check('Web contact validates fields and stores the support request', web, async () => {
      await web.goto(`${base}/contact/`); await web.getByRole('button', { name: /SEND MESSAGE/i }).click(); await web.getByText('Email, phone, and message are required.', { exact: true }).waitFor();
      await web.getByLabel('Email', { exact: true }).fill('ui-audit@example.test'); await web.getByLabel('Phone Number', { exact: true }).fill('9999999991'); await web.getByLabel('Message', { exact: true }).fill('UI audit web support request');
      await web.getByRole('button', { name: /SEND MESSAGE/i }).click(); await web.getByText('Your message has been sent. We will get back to you soon.', { exact: true }).waitFor();
      assert.equal((await db.collection('customerMessages').where('message', '==', 'UI audit web support request').get()).size, 1);
    });
    await check('PWA contact sheet submits without leaving the app', pwa, async () => {
      await pwa.goto(`${base}/app/account/`); await pwa.getByRole('button', { name: 'Contact', exact: true }).click(); const sheet = pwa.locator('.mobile-app-contact-sheet');
      await sheet.getByLabel('Email', { exact: true }).fill('ui-audit@example.test'); await sheet.getByLabel('Phone', { exact: true }).fill('9999999991'); await sheet.getByLabel('Message', { exact: true }).fill('UI audit PWA support request');
      await sheet.getByRole('button', { name: 'SEND MESSAGE', exact: true }).click();
      await pwa.waitForFunction(() => document.body.innerText.includes('Your message has been sent'));
      assert.equal((await db.collection('customerMessages').where('message', '==', 'UI audit PWA support request').get()).size, 1);
    });
    await check('Sold-out product waitlist accepts customer contact', web, async () => {
      await web.goto(`${base}/product/${products[0].slug}/`); await web.locator('.web-product-info').getByRole('button', { name: 'NOTIFY ME', exact: true }).click();
      const form = web.locator('.customer-waitlist-overlay'); await form.getByPlaceholder('you@example.com').fill('waitlist-ui@example.test'); await form.getByRole('button', { name: 'NOTIFY', exact: true }).click();
      await form.getByText('We saved your request and will let you know when this saree is back.', { exact: true }).waitFor();
      assert.equal((await db.collection('waitlistEntries').where('email', '==', 'waitlist-ui@example.test').get()).size, 1);
    });
    await check('PWA manifest and worker register with same-origin install assets', pwa, async () => {
      await pwa.goto(`${base}/app/`); const href = await pwa.locator('link[rel=manifest]').getAttribute('href'); assert.ok(href);
      const response = await pwa.request.get(new URL(href, base).href); const manifest = await response.json(); assert.equal(manifest.display, 'standalone'); assert.ok(manifest.start_url.startsWith('/app'));
      for (const icon of manifest.icons) assert.equal((await pwa.request.get(new URL(icon.src, base).href)).status(), 200);
      await pwa.evaluate(() => navigator.serviceWorker.ready); await pwa.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    });
    for (const width of [360, 768, 1024]) await check(`Web navigation at ${width}px has no horizontal page overflow`, web, async () => {
      await web.setViewportSize({ width, height: 900 }); await web.goto(`${base}/shop/`); await web.getByRole('button', { name: 'Account', exact: true }).waitFor();
      assert.equal(await web.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true); await web.screenshot({ path: `${dir}/web-${width}px.png` });
    });
    await check('No unexpected customer UI JavaScript exceptions', web, async () => assert.deepEqual(runtimeErrors, []));
    await context.close();
  } finally {
    await browser.close(); await db.terminate();
    fs.writeFileSync(`${dir}/${process.env.ESHWE_UI_INTERACTIONS_ONLY ? 'interactive-ui-results' : 'extended-ui-results'}.json`, JSON.stringify({ environment: 'Local static build; real Auth/Firestore emulators; simulated SMS/payment; Chrome desktop/mobile viewports', results, observations, runtimeErrors }, null, 2));
  }
  if (results.some(r => r.status === 'failed')) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
