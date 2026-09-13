const fs = require('node:fs'); const assert = require('node:assert/strict');
const { chromium } = require('/Applications/Visual Studio Code.app/Contents/Resources/app/node_modules/playwright-core');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const { Firestore } = require('../../functions/node_modules/@google-cloud/firestore');
const db = new Firestore({ projectId: 'demo-eshwe-launch' });
const dir = 'docs/audits/cart-response-2026-09-13'; const results = []; const base = 'http://127.0.0.1:3000';
async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const ref = db.doc('customerProfiles/alice'); const line = (await ref.get()).data().cartItems[0]; assert.ok(line);
    for (const mode of ['web', 'PWA']) {
      await ref.update({ cartItems: [{ ...line, quantity: 1 }] });
      const context = await browser.newContext({ viewport: mode === 'web' ? { width: 1440, height: 1000 } : { width: 390, height: 844 } });
      const page = await context.newPage(); page.setDefaultTimeout(15000); let release = () => {}; let hold = false;
      const gate = new Promise(resolve => { release = resolve; }); let held = 0;
      await page.route(/\/documents:commit(?:\?|$)/, async route => { if (hold) { held++; await gate; } await route.continue(); });
      try {
        await page.goto(base + '/app/account/'); await page.getByRole('button', { name: 'CONTINUE WITH SMS' }).click();
        await page.getByPlaceholder('9876543210').fill('9999999991'); await page.getByRole('button', { name: 'PROCEED', exact: true }).click();
        await page.getByPlaceholder('6-digit code').fill('123456'); await page.getByRole('button', { name: 'VERIFY', exact: true }).click();
        await page.getByRole('button', { name: 'SIGN OUT', exact: true }).waitFor();
        await page.goto(base + (mode === 'web' ? '/checkout/' : '/app/checkout/'));
        await page.getByRole('button', { name: 'Increase quantity', exact: true }).first().waitFor();
        if (mode === 'PWA') {
          await page.getByRole('button', { name: 'CHECKOUT', exact: true }).click();
          await page.getByRole('button', { name: 'CONFIRM ADDRESS AND PROCEED', exact: true }).waitFor();
          await page.getByRole('button', { name: 'Bag', exact: true }).click();
        }
        hold = true; await page.getByRole('button', { name: 'Increase quantity', exact: true }).first().click();
        if (mode === 'web') await page.getByRole('link', { name: 'CONTINUE TO ADDRESS', exact: true }).click();
        else {
          await page.getByRole('button', { name: 'CHECKOUT', exact: true }).click();
          await page.getByRole('button', { name: 'CONFIRM ADDRESS AND PROCEED', exact: true }).click();
        }
        const saving = page.getByRole('button', { name: 'SAVING BAG…', exact: true }); await saving.waitFor();
        assert.ok(await saving.isDisabled()); assert.ok(held > 0);
        hold = false; release();
        const pay = page.getByRole('button', { name: mode === 'web' ? 'CONTINUE TO RAZORPAY' : 'PAY NOW', exact: true });
        await pay.waitFor(); await page.waitForFunction(label => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === label && !b.disabled), mode === 'web' ? 'CONTINUE TO RAZORPAY' : 'PAY NOW');
        assert.equal((await ref.get()).data().cartItems[0].quantity, 2);
        results.push({ name: mode + ' waits for bag save before enabling payment', status: 'passed' }); console.log('PASS', results.at(-1).name);
      } catch (error) { results.push({ name: mode + ' waits for bag save before enabling payment', status: 'failed', error: error.message }); console.log('FAIL', mode, error.message); }
      finally { hold = false; release(); await context.close(); }
    }
  } finally { await browser.close(); await db.terminate(); fs.writeFileSync(`${dir}/payment-handoff-results.json`, JSON.stringify(results, null, 2)); }
  if (results.some(r => r.status === 'failed')) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
