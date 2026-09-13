// Guest-only production checks; cart and wishlist changes remain in this browser.
const fs = require('node:fs'); const assert = require('node:assert/strict');
const { chromium } = require('/Applications/Visual Studio Code.app/Contents/Resources/app/node_modules/playwright-core');
const base = 'https://eshwe.com'; const results = []; const timings = [];
const release = fs.readFileSync('/private/tmp/eshwe-cart-release-root', 'utf8');
const product = JSON.parse(fs.readFileSync(release + '/.catalogue-build/products.json')).find(p => p.status === 'active' && p.availableStock >= 3);
async function feedback(button, selector, expected, label) {
  const milliseconds = await button.evaluate((element, { selector, expected }) => new Promise((resolve, reject) => {
    const start = performance.now(); let timer;
    const observer = new MutationObserver(() => {
      const match = document.querySelector(selector);
      if (match && (!expected || match.textContent.trim() === expected)) {
        observer.disconnect(); clearTimeout(timer); requestAnimationFrame(() => resolve(Math.round(performance.now() - start)));
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    timer = setTimeout(() => { observer.disconnect(); reject(Error('Feedback took over 1000 ms')); }, 1000); element.click();
  }), { selector, expected });
  timings.push({ label, milliseconds }); assert.ok(milliseconds < 300, `${label}: ${milliseconds} ms`);
}
async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const mode of ['web', 'PWA']) {
      const context = await browser.newContext({ viewport: mode === 'web' ? { width: 1440, height: 1000 } : { width: 390, height: 844 } });
      const page = await context.newPage(); page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
      try {
        const route = mode === 'web' ? '/shop/' : '/app/search/';
        const response = await page.goto(base + route + '?q=' + encodeURIComponent(product.name)); assert.equal(response.status(), 200);
        const html = await response.text(); const local = fs.readFileSync('out' + route + 'index.html', 'utf8');
        for (const match of local.matchAll(/src="([^"]+\.js)"/g)) assert.ok(html.includes(match[1]), 'Live release chunk mismatch');
        const add = page.getByRole('button', { name: mode === 'web' ? 'ADD TO BAG' : 'ADD TO CART', exact: true }).first(); await add.waitFor();
        await feedback(add, '[aria-label="Decrease quantity"]', '', mode + ' add');
        await feedback(page.getByRole('button', { name: 'Increase quantity', exact: true }).first(), 'button[aria-label="Decrease quantity"] + span', '2', mode + ' quantity');
        await feedback(page.getByRole('button', { name: 'Save to favorites', exact: true }).first(), 'button[aria-label="Remove from favorites"]', '', mode + ' favourite');
        results.push({ name: mode + ': current release and immediate cart/quantity/favourite feedback', status: 'passed' });
        await page.reload(); await page.getByRole('button', { name: 'Remove from favorites', exact: true }).first().waitFor();
        await page.getByRole('button', { name: 'Decrease quantity', exact: true }).first().waitFor();
        assert.equal(await page.locator('button[aria-label="Decrease quantity"] + span').first().innerText(), '2');
        const start = Date.now(); await page.getByRole('link', { name: 'View bag with 2 items', exact: true }).first().click();
        await page.getByText(product.name, { exact: true }).first().waitFor();
        timings.push({ label: mode + ' open bag', milliseconds: Date.now() - start });
        assert.equal(await page.getByRole('button', { name: 'Decrease quantity', exact: true }).first().locator('..').locator('span').innerText(), '2');
        results.push({ name: mode + ': guest cart and favourite survive reload and bag opens correctly', status: 'passed' });
        assert.deepEqual(errors, []); results.push({ name: mode + ': no uncaught runtime errors', status: 'passed' });
        await page.screenshot({ path: __dirname + '/live-' + mode + '-bag.png', fullPage: true });
      } catch (error) { results.push({ name: mode + ' live check', status: 'failed', error: error.message }); }
      finally { await context.close(); }
    }
  } finally { await browser.close(); fs.writeFileSync(__dirname + '/live-results.json', JSON.stringify({ origin: base, results, timings }, null, 2)); }
  console.log(JSON.stringify({ results, timings }, null, 2)); if (results.some(r => r.status === 'failed')) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
