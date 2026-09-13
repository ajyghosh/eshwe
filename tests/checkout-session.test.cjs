const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/source.cjs');
const { memoryFirestore } = require('./helpers/firestore.cjs');
const { createCommerce, HOLD_MS } = require('../functions/commerce');

function fixture() {
  const f = memoryFirestore({
    'sarees/A': { sku: 'A', status: 'active', availableStock: 5, reservedStock: 0, price: 1 },
    'sarees/B': { sku: 'B', status: 'active', availableStock: 5, reservedStock: 0, price: 1 }
  });
  const storage = new Map(), calls = [], payments = new Map();
  let now = Date.now(), creates = 0, statusOverride = null;
  const auth = { currentUser: { uid: 'alice' } };
  class ApiError extends Error { constructor(message, status, internalOrderId) { super(message); this.status = status; this.internalOrderId = internalOrderId; } }
  const commerce = createCommerce({ db: f.db, timestamp: () => now, now: () => now, gateway: {
    createOrder: async value => ({ ...value, id: `gateway-${++creates}` }),
    fetchPayments: async id => ({ items: payments.get(id) || [] })
  }});
  const response = order => ({ internalOrderId: order.id, order, razorpayOrderId: order.razorpayOrderId, reservationExpiresAt: order.reservationExpiresAt, canPay: order.reservationState === 'held' && !order.paymentCaptured && order.paymentStatus !== 'authorized' });
  const api = loadSource('src/lib/checkout.ts', {
    '@/lib/firebase': { auth },
    '@/lib/razorpay': { loadRazorpayCheckoutScript: async () => {} },
    '@/lib/api': { ApiError, postJson: async (url, body) => {
      calls.push({ url, body });
      if (url === '/api/checkout/status') {
        if (statusOverride) return statusOverride(body);
        const id = body.internalOrderId || (await commerce.sessionRef(auth.currentUser.uid).get()).data()?.orderId;
        return id ? response(await commerce.reconcile(id, body.cancel)) : { order: null };
      }
      try { return response(await commerce.reserve({ ...body, userId: auth.currentUser.uid })); }
      catch (error) { throw new ApiError(error.message, error.status, error.orderId); }
    }}
  }, {
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    window: { location: { pathname: '/app/checkout/' }, dispatchEvent() {} },
    Event: class Event {}, crypto: require('node:crypto')
  });
  const items = sku => [{ productId: sku, sku, quantity: 1 }];
  return { ...f, api, auth, storage, calls, commerce, payments, creates: () => creates,
    buy: sku => api.createCheckout(items(sku), { fullName: 'Test' }, ''),
    expire: () => { now += HOLD_MS + 1; },
    overrideStatus: fn => { statusOverride = fn; },
    capture: order => payments.set(order.razorpayOrderId, [{ id: 'payment-one', order_id: order.razorpayOrderId, amount: order.order.amountPaise, currency: 'INR', status: 'captured' }])
  };
}

test('an expired checkout is cleared by a normal status refresh without visiting its receipt', async () => {
  const f = fixture(); const first = await f.buy('A'); f.expire();
  const result = await f.api.checkCheckout();
  assert.equal(result.order.reservationState, 'released');
  assert.equal(f.api.pendingCheckout('alice'), null);
  assert.equal(f.api.needsCheckoutRecovery(result.order), false);
  const second = await f.buy('B');
  assert.notEqual(second.internalOrderId, first.internalOrderId);
  assert.equal(f.creates(), 2);
});

test('Pay Now retires a stale expired reference before creating checkout for a changed bag', async () => {
  const f = fixture(); const first = await f.buy('A'); f.expire();
  const second = await f.buy('B');
  assert.notEqual(second.internalOrderId, first.internalOrderId);
  assert.equal(second.order.cartItems[0].sku, 'B');
  assert.equal(second.canPay, true);
  assert.equal(f.creates(), 2);
  assert.equal(f.records.get('sarees/A').availableStock, 5);
});

test('cancellation on another device cannot leave a browser trapped on the old key', async () => {
  const f = fixture(); const first = await f.buy('A');
  await f.commerce.reconcile(first.internalOrderId, true);
  const second = await f.buy('B');
  assert.notEqual(second.internalOrderId, first.internalOrderId);
  assert.equal(second.canPay, true);
});

test('a lost create response with only an old key recovers once after confirmed expiry', async () => {
  const f = fixture(); const first = await f.buy('A');
  const key = f.api.pendingCheckout('alice').checkoutKey;
  f.storage.set('eshwe.pendingCheckout:alice', JSON.stringify({ checkoutKey: key }));
  f.expire();
  const second = await f.buy('B');
  assert.notEqual(second.internalOrderId, first.internalOrderId);
  assert.equal(f.creates(), 2);
  assert.equal(f.calls.filter(call => call.url.endsWith('/create-order')).length, 3);
});

test('a genuinely held checkout is preserved instead of charging for a changed bag', async () => {
  const f = fixture(); const first = await f.buy('A');
  const next = await f.buy('B');
  assert.equal(next.internalOrderId, first.internalOrderId);
  assert.equal(next.canPay, false);
  assert.equal(f.creates(), 1);
  assert.equal(f.api.needsCheckoutRecovery(next.order), true);
});

test('a captured payment routes to its status and cannot be charged again on retry', async () => {
  const f = fixture(); const first = await f.buy('A'); f.capture(first);
  const retry = await f.buy('A');
  assert.equal(retry.internalOrderId, first.internalOrderId);
  assert.equal(retry.order.paymentCaptured, true);
  assert.equal(retry.canPay, false);
  assert.equal(f.creates(), 1);
  assert.equal(f.api.pendingCheckout('alice'), null);
});

test('reviewing an older paid receipt cannot erase a newer pending checkout', async () => {
  const f = fixture(); const first = await f.buy('A'); f.capture(first);
  await f.api.checkCheckout(first.internalOrderId);
  const second = await f.buy('B');
  await f.api.checkCheckout(first.internalOrderId);
  assert.equal(f.api.pendingCheckout('alice').internalOrderId, second.internalOrderId);
});

test('late status results cannot clear a reference replaced while the request was in flight', async () => {
  const f = fixture(); const first = await f.buy('A'); f.expire();
  let resolve;
  f.overrideStatus(() => new Promise(done => { resolve = done; }));
  const check = f.api.checkCheckout(first.internalOrderId);
  f.storage.set('eshwe.pendingCheckout:alice', JSON.stringify({ checkoutKey: 'new-checkout-key', internalOrderId: 'new-order' }));
  resolve({ internalOrderId: first.internalOrderId, order: { reservationState: 'released' } });
  await check;
  assert.equal(f.api.pendingCheckout('alice').internalOrderId, 'new-order');
});

test('a status outage or uncertain gateway outcome never rotates the checkout key', async () => {
  const f = fixture(); await f.buy('A'); const pending = f.api.pendingCheckout('alice');
  f.overrideStatus(async () => { throw Error('Status unavailable'); });
  await assert.rejects(f.buy('B'), /Status unavailable/);
  assert.equal(f.api.pendingCheckout('alice').checkoutKey, pending.checkoutKey);
  assert.equal(f.creates(), 1);
});

test('authorized payments and account switches cannot silently start a new charge', async () => {
  const f = fixture(); const first = await f.buy('A');
  f.overrideStatus(async () => ({ ...first, order: { reservationState: 'held', paymentStatus: 'authorized' }, canPay: false }));
  assert.equal((await f.buy('B')).canPay, false);
  assert.equal(f.api.pendingCheckout('alice').internalOrderId, first.internalOrderId);
  f.overrideStatus(async () => { f.auth.currentUser = { uid: 'bob' }; return { ...first, order: { reservationState: 'released' } }; });
  await assert.rejects(f.buy('B'), /account changed/);
  assert.equal(f.creates(), 1);
});
