const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadSource } = require('./helpers/source.cjs');
const { memoryFirestore } = require('./helpers/firestore.cjs');
const { CheckoutPaymentAction } = loadSource('src/components/checkout-payment-action.tsx', { 'next/link': { default: 'a' } });

const renderAction = overrides => renderToStaticMarkup(React.createElement(CheckoutPaymentAction, {
  orderId: null, recoveryError: null, processing: false, busy: false, disabled: false,
  mobile: true, onClick() {}, className: 'payment-action', children: 'PAY NOW', ...overrides
}));

test('a held checkout stays actionable even when its own reservation disables Pay Now', () => {
  const html = renderAction({ orderId: 'held-order', disabled: true });
  assert.match(html, /href="\/app\/order-confirmation\/\?order=held-order"/);
  assert.match(html, /RESUME \/ CHECK PAYMENT/);
  assert.doesNotMatch(html, /disabled|<button/);
});

test('web payment uses the same recovery action, scoped to the web status route', () => {
  const html = renderAction({ orderId: 'order/with space', mobile: false, disabled: true });
  assert.match(html, /href="\/order-confirmation\/\?order=order%2Fwith%20space"/);
});

test('an uncertain earlier payment offers status checking without creating another order', () => {
  const html = renderAction({ recoveryError: 'Status unavailable', disabled: true });
  assert.match(html, /href="\/app\/order-confirmation\/"/);
  assert.doesNotMatch(html, /<button/);
});

test('opening or verifying a payment keeps the processing button disabled', () => {
  const html = renderAction({ orderId: 'held-order', processing: true, busy: true, children: 'PROCESSING' });
  assert.match(html, /<button[^>]*disabled=""[^>]*aria-busy="true"/);
  assert.match(html, />PROCESSING<\/button>/);
  assert.doesNotMatch(html, /href=/);
});

test('a new checkout keeps normal payment availability checks', () => {
  assert.match(renderAction(), /<button/);
  assert.doesNotMatch(renderAction(), /disabled=/);
  assert.match(renderAction({ disabled: true }), /disabled=""/);
});

test('last-piece reservation explains disabled cart stock while the existing order remains payable', async () => {
  const f = memoryFirestore({ 'sarees/P': { sku: 'P', slug: 'one', name: 'One', price: 1, status: 'active', availableStock: 1, reservedStock: 0 } });
  const { createCommerce } = require('../functions/commerce.js');
  let creates = 0;
  const commerce = createCommerce({ db: f.db, timestamp: () => 1, now: () => 1000, gateway: {
    createOrder: async ({ amount, currency }) => { creates++; return { id: 'gateway-one', amount, currency }; },
    fetchPayments: async () => ({ items: [] })
  }});
  const held = await commerce.reserve({ userId: 'alice', checkoutKey: 'checkout-key-123456', items: [{ productId: 'P', sku: 'P', quantity: 1 }], customer: {} });
  const { syncCartItemsWithCatalogue } = loadSource('src/lib/cart-state.ts');
  const { isCartItemUnavailable } = loadSource('src/lib/inventory.ts');
  const displayed = syncCartItemsWithCatalogue([{ productId: 'P', sku: 'P', quantity: 1 }], [{ id: 'P', ...f.records.get('sarees/P') }]);
  assert.equal(isCartItemUnavailable(displayed[0]), true);
  const checked = await commerce.reconcile(held.id);
  assert.equal(checked.reservationState, 'held');
  assert.equal(checked.razorpayOrderId, 'gateway-one');
  assert.equal(creates, 1);
  assert.match(renderAction({ orderId: held.id, disabled: true }), /RESUME \/ CHECK PAYMENT/);
});

test('resuming uses the existing Razorpay order and verifies payment before redirecting', async () => {
  let options, opens = 0;
  const requests = [], statuses = [];
  const { openCheckout } = loadSource('src/lib/checkout.ts', {
    '@/lib/firebase': { auth: { currentUser: { uid: 'alice' } } },
    '@/lib/api': { ApiError: Error, postJson: async (url, body) => { requests.push({ url, body }); } },
    '@/lib/razorpay': { loadRazorpayCheckoutScript: async () => {} }
  }, { window: { Razorpay: function(config) { options = config; this.on = () => {}; this.open = () => { opens++; }; } } });
  await openCheckout({ internalOrderId: 'held', razorpayOrderId: 'gateway-one', canPay: true, reservationExpiresAt: Date.now() + 60000, order: {} }, id => statuses.push(id), () => {}, () => {});
  assert.equal(opens, 1);
  assert.equal(options.order_id, 'gateway-one');
  assert.equal(requests.length, 0);
  await options.handler({ razorpay_order_id: 'gateway-one', razorpay_payment_id: 'pay', razorpay_signature: 'signature' });
  assert.equal(requests[0].url, '/api/razorpay/verify-payment');
  assert.equal(requests[0].body.internalOrderId, 'held');
  assert.deepEqual(statuses, ['held']);
});
