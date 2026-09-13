const test = require('node:test');
const assert = require('node:assert/strict');
const { createCommerce } = require('../functions/commerce');
const { memoryFirestore } = require('./helpers/firestore.cjs');
const { loadSource } = require('./helpers/source.cjs');
const { loadBackend, request } = require('./helpers/backend.cjs');

function fixture(extra = {}) {
  const f = memoryFirestore({ 'checkoutOrders/A': { userId: 'alice', amountPaise: 10000, currency: 'INR', paymentCaptured: true, inventoryCommitted: true, reservationState: 'committed', razorpayPaymentId: 'pay_original', razorpayOrderId: 'gateway_original', cartItems: [{ productId: 'P', quantity: 1 }], ...extra }, 'sarees/P': { availableStock: 0 } });
  const sent = []; const refunds = new Map();
  const gateway = {
    async refund(paymentId, body, key) { sent.push({ paymentId, body, key }); if (!refunds.has(key)) refunds.set(key, { id: `refund-${refunds.size}`, payment_id: paymentId, amount: body.amount, notes: body.notes, status: 'processed' }); return refunds.get(key); },
    async fetchPayments() { return { items: [] }; },
    async fetchRefund(id) { return [...refunds.values()].find(r => r.id === id); }
  };
  const service = createCommerce({ db: f.db, timestamp: () => 1, gateway });
  const input = (amountPaise = 2500, expectedRefundedAmountPaise = 0, requestId = 'refund-request-0000001') => ({ amountPaise, expectedRefundedAmountPaise, requestId });
  return { ...f, sent, refunds, gateway, service, input };
}

test('partial refund uses original payment, exact paise and preserves stock; remaining balance can be refunded', async () => {
  const f = fixture(); const first = await f.service.requestAmountRefund('A', f.input(2525), 'owner');
  assert.equal(first.refundStatus, 'partial'); assert.equal(first.refundedAmountPaise, 2525);
  assert.equal(f.sent[0].paymentId, 'pay_original'); assert.equal(f.sent[0].body.amount, 2525);
  assert.deepEqual(Object.keys(f.sent[0].body).sort(), ['amount', 'notes']);
  assert.equal(f.records.get('sarees/P').availableStock, 0);
  await assert.rejects(f.service.fulfilment('A', 'restock', 'owner'), e => e.status === 409);
  const final = await f.service.requestAmountRefund('A', f.input(7475, 2525, 'refund-request-0000002'), 'owner');
  assert.equal(final.refundStatus, 'processed'); assert.equal(final.refundedAmountPaise, 10000);
  assert.equal(f.records.get('sarees/P').availableStock, 0);
  assert.equal([...f.records.keys()].filter(k => k.includes('/history/')).length, 2);
});

test('zero, negative, fractional paise, strings and excessive refunds never call the provider', async () => {
  const f = fixture();
  for (const amount of [0, -1, 1.5, '100', NaN, Infinity, 10001]) await assert.rejects(f.service.requestAmountRefund('A', f.input(amount), 'owner'), e => e.status === 400);
  assert.equal(f.sent.length, 0); assert.equal(f.records.get('checkoutOrders/A').refundStatus, undefined);
});

test('concurrent same-reference requests and later replays create one provider refund', async () => {
  const f = fixture(); await Promise.all(Array.from({ length: 6 }, () => f.service.requestAmountRefund('A', f.input(), 'owner')));
  assert.equal(f.refunds.size, 1); assert.equal((await f.service.readOrder('A')).refundedAmountPaise, 2500);
  await f.service.requestAmountRefund('A', f.input(), 'owner');
  await assert.rejects(f.service.requestAmountRefund('A', f.input(1000), 'owner'), e => e.status === 409);
  assert.equal(f.refunds.size, 1);
});

test('two admins with different references cannot both refund a stale displayed balance', async () => {
  const f = fixture(); const results = await Promise.allSettled(['refund-request-0000001', 'refund-request-0000002'].map(key => f.service.requestAmountRefund('A', f.input(2500, 0, key), key)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(f.refunds.size, 1);
  await assert.rejects(f.service.requestAmountRefund('A', f.input(100, 0, 'refund-request-0000003'), 'owner'), e => e.status === 409);
});

test('response loss retries the same body/key and cannot accept a second request meanwhile', async () => {
  const f = fixture(); const send = f.gateway.refund; let first = true;
  f.gateway.refund = async (...args) => { const result = await send(...args); if (first) { first = false; throw Error('Response lost'); } return result; };
  await assert.rejects(f.service.requestAmountRefund('A', f.input(), 'owner'));
  assert.equal((await f.service.readOrder('A')).refundStatus, 'retry_required');
  await assert.rejects(f.service.requestAmountRefund('A', f.input(100, 0, 'refund-request-0000002'), 'owner'), e => e.status === 409);
  await f.service.reconcile('A'); assert.equal(f.refunds.size, 1);
  assert.deepEqual(f.sent[0], f.sent[1]); assert.equal((await f.service.readOrder('A')).refundedAmountPaise, 2500);
});

test('pending partial refund is polled by refund ID; a later processed event permits another amount', async () => {
  const f = fixture(); const send = f.gateway.refund;
  f.gateway.refund = async (...args) => { const entity = await send(...args); entity.status = 'pending'; return entity; };
  const pending = await f.service.requestAmountRefund('A', f.input(), 'owner');
  assert.equal(pending.refundStatus, 'pending'); assert.equal(pending.refundedAmountPaise, 0);
  await assert.rejects(f.service.requestAmountRefund('A', f.input(500, 0, 'refund-request-0000002'), 'owner'), e => e.status === 409);
  const entity = [...f.refunds.values()][0]; entity.status = 'processed';
  const refreshed = await f.service.reconcile('A'); assert.equal(refreshed.refundStatus, 'partial'); assert.equal(refreshed.refundedAmountPaise, 2500);
  await f.service.recordRefund('A', { ...entity, status: 'pending' });
  assert.equal((await f.service.readOrder('A')).refundStatus, 'partial');
});

test('second pending/failed partial refund is visible despite earlier processed money; old webhook cannot hide it', async () => {
  const f = fixture(); await f.service.requestAmountRefund('A', f.input(), 'owner'); const old = [...f.refunds.values()][0];
  const send = f.gateway.refund; f.gateway.refund = async (...args) => ({ ...await send(...args), status: 'pending' });
  await f.service.requestAmountRefund('A', f.input(1000, 2500, 'refund-request-0000002'), 'owner');
  await f.service.recordRefund('A', old); assert.equal((await f.service.readOrder('A')).refundStatus, 'pending');
  const latest = [...f.refunds.values()][1]; await f.service.recordRefund('A', { ...latest, status: 'failed' });
  await f.service.recordRefund('A', { ...latest, status: 'pending' });
  assert.equal((await f.service.readOrder('A')).refundStatus, 'failed');
  f.gateway.refund = send;
  await f.service.requestAmountRefund('A', f.input(1000, 2500, 'refund-request-0000003'), 'owner');
  assert.equal((await f.service.readOrder('A')).refundedAmountPaise, 3500);
});

test('processed webhook arriving before a failed HTTP response cannot be downgraded or counted twice', async () => {
  const f = fixture(); let reject;
  f.gateway.refund = () => new Promise((_, no) => { reject = no; });
  const pending = f.service.requestAmountRefund('A', f.input(), 'owner');
  while (!reject) await new Promise(resolve => setImmediate(resolve));
  const entity = { id: 'early', payment_id: 'pay_original', amount: 2500, status: 'processed', notes: { internalRefundRequestId: f.input().requestId } };
  await f.service.recordRefund('A', entity); reject(Error('Response lost')); await assert.rejects(pending);
  await f.service.recordRefund('A', entity);
  assert.equal((await f.service.readOrder('A')).refundStatus, 'partial'); assert.equal((await f.service.readOrder('A')).refundedAmountPaise, 2500);
});

test('legacy aggregate refund balances are retained when adding a new partial refund', async () => {
  const f = fixture({ refundedAmountPaise: 2000, refundStatus: 'partial' });
  await f.service.requestAmountRefund('A', f.input(1000, 2000), 'owner');
  assert.equal((await f.service.readOrder('A')).refundedAmountPaise, 3000);
  await f.service.recordRefund('A', { id: 'historical', payment_id: 'pay_original', amount: 2000, status: 'processed' });
  assert.equal((await f.service.readOrder('A')).refundedAmountPaise, 3000);
});

test('uncaptured orders and mismatched provider responses are rejected', async () => {
  const unpaid = fixture({ paymentCaptured: false }); await assert.rejects(unpaid.service.requestAmountRefund('A', unpaid.input(), 'owner'), e => e.status === 409); assert.equal(unpaid.sent.length, 0);
  const completed = fixture({ refundStatus: 'processed' }); await assert.rejects(completed.service.requestAmountRefund('A', completed.input(), 'owner'), e => e.status === 409); assert.equal(completed.sent.length, 0);
  const f = fixture(); f.gateway.refund = async () => ({ id: 'bad', payment_id: 'pay_wrong', amount: 2500, status: 'processed' });
  await assert.rejects(f.service.requestAmountRefund('A', f.input(), 'owner'), e => e.status === 400);
  assert.equal((await f.service.readOrder('A')).refundedAmountPaise || 0, 0);
});

test('refund amount entry converts exact decimal rupees and rejects malformed values', () => {
  const { parseRefundAmount } = loadSource('src/lib/refund-amount.ts');
  assert.equal(parseRefundAmount('10.01'), 1001); assert.equal(parseRefundAmount('0.50'), 50); assert.equal(parseRefundAmount(' 25 '), 2500);
  for (const value of ['0', '-1', '1.001', '1e3', 'abc', 'Infinity', '1,000', '']) assert.equal(parseRefundAmount(value), null);
});

test('owner API enforces authorization, forwards amount and refunds the stored original payment only', async () => {
  const f = fixture(); const calls = [];
  class Gateway { constructor() { this.orders = {}; } }
  const api = loadBackend(f.db, { users: { owner: { uid: 'owner', email: 'ajyghosh@gmail.com', email_verified: true }, alice: { uid: 'alice' } }, mocks: { razorpay: Gateway }, fetch: async (url, options) => { calls.push({ url, options }); const body = JSON.parse(options.body); return { ok: true, json: async () => ({ id: 'api-refund', payment_id: 'pay_original', amount: body.amount, notes: body.notes, status: 'processed' }) }; } });
  const payload = { orderId: 'A', action: 'refund', ...f.input(1234), paymentId: 'pay_attacker', bankAccount: 'ignored' };
  assert.equal((await request(api.ownerOrderAction, payload)).status, 403);
  assert.equal((await request(api.ownerOrderAction, payload, 'alice')).status, 403);
  const result = await request(api.ownerOrderAction, payload, 'owner'); assert.equal(result.status, 200); assert.equal(result.body.order.refundedAmountPaise, 1234);
  assert.equal(calls.length, 1); assert.equal(calls[0].url, 'https://api.razorpay.com/v1/payments/pay_original/refund');
  assert.equal(JSON.parse(calls[0].options.body).amount, 1234); assert.ok(calls[0].options.headers['X-Refund-Idempotency']);
});
