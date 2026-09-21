const test = require('node:test');
const assert = require('node:assert/strict');
const { regionForEvent, shouldHandleEvent, LEGACY_REGION, PRIMARY_REGION } = require('../functions/background-region');
const { memoryFirestore } = require('./helpers/firestore.cjs');
const { loadBackend, request } = require('./helpers/backend.cjs');
const cutoff = Date.parse('2026-09-14T18:00:00Z');
const schedule = ms => ({ scheduleTime: new Date(ms).toISOString() });

test('existing background workers remain active until a cutover is configured', async () => {
  const { db } = memoryFirestore();
  assert.equal(await shouldHandleEvent(db, LEGACY_REGION, schedule(cutoff)), true);
  assert.equal(await shouldHandleEvent(db, PRIMARY_REGION, schedule(cutoff)), false);
});

test('both regions agree on the owner before, at, and after the cutoff, including delayed events', () => {
  for (const [time, expected] of [[cutoff - 1, LEGACY_REGION], [cutoff, PRIMARY_REGION], [cutoff + 1, PRIMARY_REGION]]) {
    assert.equal(regionForEvent({ cutoverAt: cutoff }, schedule(time)), expected);
    const event = { time: new Date(cutoff + 5000).toISOString(), data: { createTime: { toMillis: () => time } } };
    assert.equal(regionForEvent({ cutoverAt: cutoff }, event), expected);
  }
});

test('rollback routes future events back to retained workers without reassigning earlier events', () => {
  const config = { cutoverAt: cutoff, rollbackAt: cutoff + 1000 };
  assert.equal(regionForEvent(config, schedule(cutoff - 1)), LEGACY_REGION);
  assert.equal(regionForEvent(config, schedule(cutoff + 500)), PRIMARY_REGION);
  assert.equal(regionForEvent(config, schedule(cutoff + 1000)), LEGACY_REGION);
});

test('invalid routing and failed reads do not accidentally run both workers', async () => {
  assert.throws(() => regionForEvent({ cutoverAt: 'invalid' }, schedule(cutoff)));
  assert.throws(() => regionForEvent({ cutoverAt: cutoff }, {}));
  assert.throws(() => regionForEvent({ cutoverAt: cutoff, rollbackAt: cutoff - 1 }, schedule(cutoff)));
  const db = { collection: () => ({ doc: () => ({ get: async () => { throw Error('Read unavailable'); } }) }) };
  await assert.rejects(shouldHandleEvent(db, PRIMARY_REGION, schedule(cutoff)), /Read unavailable/);
});

test('retained US notification trigger sends new events and skips pre-cutover events', async () => {
  const { db } = memoryFirestore({ '_functionMigration/regions': { cutoverAt: cutoff } });
  let sent = 0;
  const api = loadBackend(db, { mocks: { nodemailer: { createTransport: () => ({ sendMail: async mail => { assert.equal(mail.from, 'eshwe studio <hello@nohello.in>'); sent++; }, close() {} }) } } });
  for (const time of [cutoff - 1, cutoff, cutoff + 1]) {
    const event = { time: new Date(time).toISOString(), params: { messageId: String(time) }, data: { createTime: { toMillis: () => time }, data: () => ({ name: 'Migration fixture', message: 'Local test only' }) } };
    const before = sent;
    await api.sendContactEmailNotificationUs(event);
    assert.equal(sent - before, time >= cutoff ? 1 : 0);
  }
});

test('new HTTP exports retain authentication and ownership checks', async () => {
  const api = loadBackend(memoryFirestore().db);
  assert.equal((await request(api.checkoutStatusUs)).status, 401);
  assert.equal((await request(api.ownerOrderActionUs)).status, 403);
  assert.equal((await request(api.ownerProductActionUs)).status, 403);
  assert.equal((await request(api.razorpayWebhookUs)).status, 400);
});

test('deployment exports only the expected US functions and all Hosting routes resolve to them', () => {
  const deployed = require('../functions');
  const names = ['sendOrderNotification', 'sendContactEmailNotification', 'reconcileCheckoutOrders', 'sendCustomerOtp', 'verifyCustomerOtp', 'createRazorpayOrder', 'verifyRazorpayPayment', 'razorpayAppCallback', 'razorpayWebhook', 'checkoutStatus', 'ownerOrderAction', 'ownerProductAction'];
  assert.deepEqual(Object.keys(deployed).sort(), names.map(name => `${name}Us`).sort());
  for (const name of Object.keys(deployed)) {
    assert.deepEqual(deployed[name].__endpoint.region, [PRIMARY_REGION]);
  }
  const config = require('../firebase.json');
  for (const route of config.hosting.rewrites.filter(route => route.function)) {
    assert.equal(route.function.region, PRIMARY_REGION);
    assert.ok(deployed[route.function.functionId]);
    assert.ok(route.function.functionId.endsWith('Us'));
  }
});

test('PWA friendly routes preserve Next route-data responses before HTML fallbacks', () => {
  const rewrites = require('../firebase.json').hosting.rewrites;
  for (const route of ['product', 'search']) {
    const dataSource = `/app/${route}/**/*.txt`;
    const htmlSource = `/app/${route}/**`;
    const dataIndex = rewrites.findIndex(rewrite => rewrite.source === dataSource);
    const htmlIndex = rewrites.findIndex(rewrite => rewrite.source === htmlSource);

    assert.ok(dataIndex >= 0, `${dataSource} route-data rewrite is required`);
    assert.ok(htmlIndex >= 0, `${htmlSource} HTML fallback is required`);
    assert.ok(dataIndex < htmlIndex, `${dataSource} must run before ${htmlSource}`);
    assert.equal(rewrites[dataIndex].destination, `/app/${route}/index.txt`);
    assert.equal(rewrites[htmlIndex].destination, `/app/${route}/index.html`);
  }
});

test('local development targets US copies while production keeps stable API URLs', () => {
  const { loadSource } = require('./helpers/source.cjs');
  const mocks = {
    '@/lib/firebase': { auth: null },
    'firebase/auth': {},
    '@/lib/protected-request': {}
  };
  const local = { window: { location: { hostname: 'localhost', origin: 'http://localhost:3000' } } };
  const production = { window: { location: { hostname: 'eshwe.com', origin: 'https://eshwe.com' } } };
  const payments = loadSource('src/lib/razorpay.ts', mocks, local);
  assert.equal(payments.getRazorpayApiUrl('create-order'), 'https://us-central1-eshwesareestudio.cloudfunctions.net/createRazorpayOrderUs');
  assert.equal(payments.getRazorpayCallbackUrl('app-callback'), 'https://us-central1-eshwesareestudio.cloudfunctions.net/razorpayAppCallbackUs');
  const login = loadSource('src/lib/customer-auth.ts', mocks, local);
  assert.equal(login.getCustomerAuthApiUrl('send-otp'), 'https://us-central1-eshwesareestudio.cloudfunctions.net/sendCustomerOtpUs');
  assert.equal(loadSource('src/lib/razorpay.ts', mocks, production).getRazorpayApiUrl('create-order'), '/api/razorpay/create-order');
  assert.equal(loadSource('src/lib/customer-auth.ts', mocks, production).getCustomerAuthApiUrl('verify-otp'), '/api/customer-auth/verify-otp');
});
