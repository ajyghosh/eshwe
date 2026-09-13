// Read-only audit probes: real application functions, isolated in-memory data and
// mocked providers. Assertions confirm the observed gaps, NOT correct behaviour.
const assert = require('node:assert/strict');
const { memoryFirestore } = require('../tests/helpers/firestore.cjs');
const { loadBackend, request } = require('../tests/helpers/backend.cjs');
const { loadSource } = require('../tests/helpers/source.cjs');
const { createCommerce } = require('../functions/commerce');
const customer = { fullName: 'Audit Customer', email: 'audit@example.com', phone: '9999999999', address: 'Test address', city: 'Kochi', state: 'Kerala', pincode: '682001' };
const items = [{ productId: 'A', sku: 'A', quantity: 1 }];
const product = { sku: 'A', status: 'active', availableStock: 5, price: 100 };
const findings = [];

function extractedHandler(file, globals) {
  const fs = require('node:fs'); const ts = require('typescript'); const vm = require('node:vm');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === 'handleSubmit') handler = node; ts.forEachChild(node, visit); }
  visit(source); assert.ok(handler);
  const code = ts.transpileModule(handler.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return vm.runInNewContext(code + '\nhandleSubmit', { Error, ...globals }, { filename: file });
}

async function main() {
  {
    const f = memoryFirestore({ 'checkoutOrders/paid': { userId: 'alice', paymentCaptured: true, paymentStatus: 'captured', inventoryCommitted: true, reservationState: 'committed', dispatchStatus: 'completed', razorpayOrderId: 'gateway-paid' } });
    class Gateway { constructor() { this.orders = { fetchPayments: async () => { throw Error('Simulated provider outage'); } }; } }
    const api = loadBackend(f.db, { users: { alice: { uid: 'alice' } }, mocks: { razorpay: Gateway } });
    const result = await request(api.checkoutStatus, { internalOrderId: 'paid' }, 'alice');
    assert.equal(result.status, 503);
    assert.equal(result.body.order, undefined);
    assert.equal(f.records.get('checkoutOrders/paid').paymentCaptured, true);
    findings.push({ id: 'FLOW-01', observed: 'A stored paid/dispatched order returns HTTP 503 and no order when the provider is unavailable.', reproduced: true });
  }
  {
    const seed = {};
    for (let i = 0; i < 101; i++) seed[`checkoutOrders/order-${String(i).padStart(3, '0')}`] = { attentionRequired: true, reservationState: 'released', razorpayOrderId: `gateway-${i}` };
    const f = memoryFirestore(seed); const calls = [];
    class Gateway { constructor() { this.orders = { fetchPayments: async id => { calls.push(id); throw Error('Persistent reconciliation failure'); } }; } }
    const api = loadBackend(f.db, { mocks: { razorpay: Gateway } });
    await api.reconcileCheckoutOrders(); await api.reconcileCheckoutOrders();
    assert.equal(calls.length, 200);
    assert.equal(new Set(calls).size, 100);
    assert.equal(calls.includes('gateway-100'), false);
    findings.push({ id: 'FLOW-04', observed: 'Two scheduler runs make 200 attempts on the same 100 unresolved orders; order 101 receives zero attempts.', reproduced: true, caveat: 'In-memory deterministic query fixture; source has no cursor or retry rotation.' });
  }
  {
    const f = memoryFirestore({ 'sarees/A': product }); let creates = 0;
    class Gateway { constructor() { this.orders = { create: async body => ({ ...body, id: `gateway-${++creates}` }) }; } }
    const api = loadBackend(f.db, { users: { alice: { uid: 'alice' } }, mocks: { razorpay: Gateway } });
    const result = await request(api.createRazorpayOrder, { checkoutKey: 'audit-invalid-pin-0001', items, customer: { ...customer, pincode: 'abc' } }, 'alice');
    assert.equal(result.status, 200); assert.equal(result.body.canPay, true); assert.equal(creates, 1);
    assert.equal(result.body.order.customer.pincode, 'abc');
    findings.push({ id: 'FLOW-05', observed: 'Authenticated checkout API accepts PIN abc, reserves stock, and returns canPay=true.', reproduced: true });
  }
  {
    const f = memoryFirestore({ 'sarees/A': product }); let creates = 0; const payments = [];
    const service = createCommerce({ db: f.db, timestamp: () => Date.now(), gateway: { createOrder: async body => ({ ...body, id: `gateway-${++creates}` }), fetchPayments: async () => ({ items: payments }) } });
    class ApiError extends Error { constructor(message, status, internalOrderId) { super(message); this.status = status; this.internalOrderId = internalOrderId; } }
    const storage = new Map();
    const response = order => ({ internalOrderId: order.id, order, canPay: order.reservationState === 'held' && !order.paymentCaptured });
    const checkout = loadSource('src/lib/checkout.ts', {
      '@/lib/firebase': { auth: { currentUser: { uid: 'alice' } } }, '@/lib/razorpay': {},
      '@/lib/api': { ApiError, postJson: async (url, body) => {
        try {
          if (url.endsWith('/status')) return response(await service.reconcile(body.internalOrderId || (await service.sessionRef('alice').get()).data().orderId));
          return response(await service.reserve({ ...body, userId: 'alice' }));
        } catch (error) { throw new ApiError(error.message, error.status, error.orderId); }
      } }
    }, { crypto: { randomUUID: () => 'audit-checkout-key-0001' }, localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }, window: { dispatchEvent() {}, location: { pathname: '/checkout' } }, Event: class {} });
    const first = await checkout.createCheckout(items, customer, '');
    const payment = { id: 'payment', order_id: first.order.razorpayOrderId, amount: first.order.amountPaise, currency: 'INR', status: 'captured' };
    payments.push(payment); await service.recordPayment(first.internalOrderId, payment);
    // Simulate payment completing after the customer closes the tab. On return,
    // the checkout banner calls checkCheckout, without mounting OrderStatusPage.
    const status = await checkout.checkCheckout(); assert.equal(status.order.paymentCaptured, true);
    assert.ok(checkout.pendingCheckout('alice'));
    const sameBag = await checkout.createCheckout(items, customer, '');
    assert.equal(sameBag.internalOrderId, first.internalOrderId); assert.equal(sameBag.canPay, false);
    await assert.rejects(checkout.createCheckout([{ ...items[0], quantity: 2 }], customer, ''), error => error.status === 409 && error.internalOrderId === first.internalOrderId);
    assert.equal(creates, 1);
    findings.push({ id: 'FLOW-02', observed: 'After capture outside the status page, a same-bag new purchase returns the previous paid order; a changed bag returns 409. Status checking alone retains the stale local key.', reproduced: true });
  }
  {
    const deleted = []; let saveAttempted = false; let error;
    const submit = extractedHandler('src/components/owner-category-manager.tsx', {
      setIsSaving() {}, setError: value => { error = value; }, editingId: 'category', imageFile: {},
      form: { title: 'Silk', imageUrl: 'old-url', imagePath: 'old-path', shopFilter: '', backgroundPosition: '', active: true, sortOrder: '1' },
      slugifySareeName: () => 'silk', uploadSiteAsset: async () => ({ url: 'new-url', path: 'new-path' }),
      deleteSareeImages: async paths => deleted.push(...paths),
      updateCategoryCard: async () => { saveAttempted = true; throw Error('Simulated save failure'); }
    });
    await submit({ preventDefault() {} });
    assert.deepEqual(deleted, ['old-path']); assert.equal(saveAttempted, true); assert.equal(error, 'Simulated save failure');
    const homeDeleted = []; let homeError;
    const homeSubmit = extractedHandler('src/components/owner-homepage-manager.tsx', {
      setIsSaving() {}, setError: value => { homeError = value; }, heroFile: {}, launchImageFile: null, removeLaunchImage: false,
      form: { heroImageUrl: 'old-home-url', heroImagePath: 'old-home-path' }, desktopHeroFiles: [], savedDesktopHeroSlides: [{ imageUrl: 'one-slide' }],
      uploadSiteAsset: async () => ({ url: 'new-home-url', path: 'new-home-path' }), deleteSareeImages: async paths => homeDeleted.push(...paths)
    });
    await homeSubmit({ preventDefault() {} });
    assert.deepEqual(homeDeleted, ['old-home-path']); assert.match(homeError, /at least 3 web home images/);
    findings.push({ id: 'FLOW-03', observed: 'Actual admin submit handlers delete the old category image before a failed metadata save, and the old home hero before carousel validation rejects the save.', reproduced: true, caveat: 'Handlers extracted from TypeScript AST and executed with mocked storage; no real assets deleted.' });
  }
  console.log(JSON.stringify({ audit: 'additional-product-flows', productionWrites: false, providerCalls: 'mocked only', findings }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
