const assert = require('node:assert/strict'); const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Applications/Visual Studio Code.app/Contents/Resources/app/node_modules/playwright-core');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const { Firestore } = require('../../functions/node_modules/@google-cloud/firestore');
const db = new Firestore({ projectId: 'demo-eshwe-launch' }); const results = [];
async function main() {
  const ref = db.doc('checkoutOrders/tracking-refund-ui');
  await ref.set({ userId: 'alice', status: 'paid', paymentCaptured: true, paymentStatus: 'captured', amountPaise: 10000, currency: 'INR', amountBreakdown: { subtotal: 100, total: 100, shippingFee: 0, packagingFee: 0, savings: 0 }, customer: { fullName: 'Refund UI Customer', email: 'audit@example.test', phone: '9999999991', address: 'Demo address', city: 'Kochi', state: 'Kerala', pincode: '682001' }, cartItems: [{ productId: 'A', sku: 'UI-A', name: 'Refund UI Saree', quantity: 1, unitPrice: 100 }], razorpayPaymentId: 'pay_ui_original', razorpayOrderId: 'order_ui_original', inventoryCommitted: true, reservationState: 'committed', createdAt: new Date() });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('https://www.indiapost.gov.in/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>India Post test destination</h1>' }));
    await page.goto('http://127.0.0.1:3000/shop/');
    const tracking = page.getByRole('link', { name: 'Track order with India Post (opens in a new tab)', exact: true });
    assert.equal(await tracking.getAttribute('href'), 'https://www.indiapost.gov.in/');
    const popupPromise = context.waitForEvent('page'); await tracking.click(); const popup = await popupPromise; await popup.waitForLoadState(); assert.equal(popup.url(), 'https://www.indiapost.gov.in/'); await popup.close();
    results.push('Web top navigation opens India Post in a new tab');
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto('http://127.0.0.1:3000/app/account/');
    await tracking.waitFor(); assert.equal(await tracking.getAttribute('target'), '_blank');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    results.push('PWA account tracking link is visible without sign-in and fits a 390px screen');
    await page.getByRole('button', { name: 'CONTINUE WITH SMS' }).click(); await page.getByPlaceholder('9876543210').fill('9999999993');
    await page.getByRole('button', { name: 'PROCEED', exact: true }).click(); await page.getByPlaceholder('6-digit code').fill('123456'); await page.getByRole('button', { name: 'VERIFY', exact: true }).click();
    await page.getByRole('button', { name: 'SIGN OUT', exact: true }).waitFor(); await tracking.waitFor();
    results.push('Tracking remains available in the signed-in PWA account');
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('http://127.0.0.1:3000/owner/orders/');
    const article = page.locator('article').filter({ hasText: 'Refund UI Customer' });
    await article.getByRole('button', { name: 'Refund', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Refund payment' }); const amount = dialog.getByRole('textbox', { name: 'Refund amount (₹)' });
    for (const invalid of ['0', '100.01', '1.001', '-1']) {
      await amount.fill(invalid); assert.equal(await dialog.locator('button[type=submit]').isDisabled(), true);
    }
    await amount.fill('25.25'); assert.equal(await dialog.locator('button[type=submit]').isEnabled(), true);
    await page.screenshot({ path: `${process.env.ESHWE_UI_RESULTS_DIR || 'docs/audits/launch-2026-09-12'}/refund-dialog.png` });
    results.push('Admin refund dialog rejects zero, excessive and malformed amounts');
    await dialog.getByRole('button', { name: 'Refund ₹25.25', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
    await article.getByText('Refunded: ₹25.25 · Remaining: ₹74.75', { exact: true }).waitFor();
    assert.equal((await ref.get()).data().refundedAmountPaise, 2525);
    results.push('Admin submits ₹25.25 through the real API handler and displays the ₹74.75 balance');
    await article.getByRole('button', { name: 'Refund', exact: true }).click(); assert.equal(await amount.inputValue(), '74.75');
    await dialog.getByRole('button', { name: 'Refund ₹74.75', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
    await article.getByText('Refunded: ₹100.00 · Remaining: ₹0.00', { exact: true }).waitFor();
    assert.equal(await article.getByRole('button', { name: 'Refund', exact: true }).count(), 0);
    assert.equal((await ref.get()).data().refundStatus, 'processed');
    assert.equal((await ref.collection('refundRequests').get()).size, 2);
    results.push('Refunding the remaining amount completes the refund and removes the refund button');
    assert.deepEqual(errors, []); results.push('No browser runtime errors');
  } finally {
    await browser.close(); await db.terminate();
    fs.writeFileSync(`${process.env.ESHWE_UI_RESULTS_DIR || 'docs/audits/launch-2026-09-12'}/tracking-refund-browser-results.json`, JSON.stringify({ environment: 'Chrome with local Firebase emulators; Razorpay and external tracking destination mocked', results }, null, 2));
  }
}
main().then(() => console.log(`${results.length} browser checks passed`)).catch(error => { console.error(error); process.exitCode = 1; });
