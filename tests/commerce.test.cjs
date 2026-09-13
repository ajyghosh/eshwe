const test = require('node:test');
const assert = require('node:assert/strict');
const { createCommerce, HOLD_MS, normalizeItems, stock } = require('../functions/commerce');
const { memoryFirestore } = require('./helpers/firestore.cjs');

function fixture(count = 1) {
  const storage = memoryFirestore({ 'sarees/A': { sku: 'A', status: 'active', availableStock: count, price: 1 }, 'sarees/B': { sku: 'B', status: 'active', availableStock: count, price: 2 } });
  let now = 1000; const payments = new Map(); const refunds = new Map(); let creates = 0;
  const gateway = {
    async createOrder(value) { creates++; return { ...value, id: `gateway-${creates}` }; },
    async fetchPayments(id) { return { items: payments.get(id) || [] }; },
    async refund(id, body, key) { if (!refunds.has(key)) refunds.set(key, { id: `refund-${refunds.size}`, payment_id: id, amount: body.amount, status: 'processed' }); return refunds.get(key); }
  };
  const service = createCommerce({ db: storage.db, timestamp: () => now, gateway, now: () => now });
  const request = (uid='alice', key='checkout-0000000001', products=['A']) => ({ userId: uid, checkoutKey: key, items: products.map(id => ({ productId: id, sku: id, quantity: 1 })), customer: { fullName: 'Test Customer' } });
  const capture = order => ({ id: `pay-${order.id}`, order_id: order.razorpayOrderId, amount: order.amountPaise, currency: 'INR', status: 'captured', created_at: now });
  return { ...storage, service, gateway, request, capture, payments, refunds, tick: () => { now += HOLD_MS + 1; }, creates: () => creates };
}

test('two-product reservation and capture commit atomically and replay only once', async()=>{
  const f=fixture(2);const order=await f.service.reserve(f.request('alice',undefined,['A','B']));
  assert.equal(f.records.get('sarees/A').availableStock,1);assert.equal(f.records.get('sarees/B').reservedStock,1);
  await Promise.all([f.service.recordPayment(order.id,f.capture(order)), f.service.recordPayment(order.id,f.capture(order))]);
  assert.equal(f.records.get('sarees/A').availableStock,1);assert.equal(f.records.get('sarees/B').reservedStock,0);
  assert.equal((await f.service.readOrder(order.id)).inventoryCommitted,true);
});
test('ten customers racing one piece yield exactly one reservation and one gateway order',async()=>{
  const f=fixture();const attempts=await Promise.allSettled(Array.from({length:10},(_,i)=>f.service.reserve(f.request(`user${i}`))));
  assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);assert.equal(f.creates(),1);
  assert.equal(f.records.get('sarees/A').availableStock,0);assert.equal(f.records.get('sarees/A').reservedStock,1);
});
test('same checkout key retries do not reserve or create a gateway order twice',async()=>{
  const f=fixture(10);const results=await Promise.all([f.service.reserve(f.request()),f.service.reserve(f.request())]);
  assert.equal(results[0].id,results[1].id);assert.equal(f.creates(),1);assert.equal(f.records.get('sarees/A').availableStock,9);
  const replay=await f.service.reserve(f.request());assert.ok(replay.razorpayOrderId);
});
test('same customer cannot start a second active checkout across devices',async()=>{
  const f=fixture(10);const order=await f.service.reserve(f.request());
  await assert.rejects(f.service.reserve(f.request('alice','checkout-0000000002')),e=>e.status===409&&e.orderId===order.id);
});
test('insufficient final line rolls back the whole reservation',async()=>{
  const f=fixture();await f.db.collection('sarees').doc('B').update({availableStock:0});
  await assert.rejects(f.service.reserve(f.request('alice',undefined,['A','B'])));
  assert.equal(f.records.get('sarees/A').availableStock,1);assert.equal(f.creates(),0);
});
test('duplicate quantities are aggregated and unknown stock is unavailable',async()=>{
  assert.equal(normalizeItems([{sku:'A',quantity:1},{sku:'A',quantity:1}])[0].quantity,2);
  assert.throws(()=>normalizeItems([{sku:'A',quantity:6},{sku:'A',quantity:6}]));
  assert.equal(stock(undefined),0);assert.equal(stock('10'),0);assert.equal(stock(NaN),0);
  const f=fixture();await assert.rejects(f.service.reserve({...f.request(),items:[{sku:'A',quantity:1},{sku:'A',quantity:1}]}));
});
test('expiry reconciles provider before releasing and repeated expiry does not inflate stock',async()=>{
  const f=fixture();const order=await f.service.reserve(f.request());f.tick();
  await f.service.reconcile(order.id);await f.service.reconcile(order.id);
  assert.equal(f.records.get('sarees/A').availableStock,1);assert.equal(f.records.get('sarees/A').reservedStock,0);
});
test('captured/authorized provider payments are protected when reservation expires',async()=>{
  for(const status of ['captured','authorized']){
    const f=fixture();const order=await f.service.reserve(f.request());f.payments.set(order.razorpayOrderId,[{...f.capture(order),status}]);f.tick();
    const current=await f.service.reconcile(order.id);assert.equal(f.records.get('sarees/A').availableStock,0);
    assert.equal(current.reservationState,status==='captured'?'committed':'held');
  }
});
test('provider outage keeps stock held; no unsafe release',async()=>{
  const f=fixture();const order=await f.service.reserve(f.request());f.tick();f.gateway.fetchPayments=async()=>{throw Error('offline')};
  await assert.rejects(f.service.reconcile(order.id));assert.equal(f.records.get('sarees/A').reservedStock,1);
});
test('late capture after expiry and resale records money, flags fulfilment exception and refunds once',async()=>{
  const f=fixture();const order=await f.service.reserve(f.request());f.tick();await f.service.reconcile(order.id);
  await f.service.reserve(f.request('bob'));
  const current=await f.service.recordPayment(order.id,f.capture(order));assert.equal(current.paymentStatus,'captured');assert.equal(current.attentionRequired,true);assert.equal(current.inventoryCommitted,false);
  await Promise.all([f.service.refund(order.id),f.service.refund(order.id)]);assert.equal(f.refunds.size,1);
  assert.equal((await f.service.readOrder(order.id)).refundStatus,'processed');assert.equal(f.records.get('sarees/A').reservedStock,1);
});
test('old failed/authorized states never downgrade a capture; mismatched money is rejected',async()=>{
  const f=fixture();const order=await f.service.reserve(f.request());await f.service.recordPayment(order.id,f.capture(order));
  for(const status of ['authorized','failed','created'])await f.service.recordPayment(order.id,{...f.capture(order),status});
  assert.equal((await f.service.readOrder(order.id)).paymentStatus,'captured');
  await assert.rejects(f.service.recordPayment(order.id,{...f.capture(order),amount:999}));
  await assert.rejects(f.service.recordPayment(order.id,{...f.capture(order),currency:'USD'}));
});
test('a refund needs an explicit, once-only physical restock; dispatch blocked after refund',async()=>{
  const f=fixture();const order=await f.service.reserve(f.request());await f.service.recordPayment(order.id,f.capture(order));
  await f.service.fulfilment(order.id,'completed','owner');await f.service.fulfilment(order.id,'refund','owner');
  assert.equal(f.records.get('sarees/A').availableStock,0);
  await assert.rejects(f.service.fulfilment(order.id,'completed','owner'));
  await f.service.fulfilment(order.id,'restock','owner');assert.equal(f.records.get('sarees/A').availableStock,1);
  await assert.rejects(f.service.fulfilment(order.id,'restock','owner'));
});
test('unknown gateway-create outcome is never retried as a new charge/order',async()=>{
  const f=fixture();let calls=0;f.gateway.createOrder=async()=>{calls++;throw Error('response lost')};
  await assert.rejects(f.service.reserve(f.request()));const order=await f.service.reserve(f.request());
  assert.equal(calls,1);assert.equal(order.gatewaySetup,'needs_review');assert.equal(order.attentionRequired,true);
});
test('capture removes purchased cart units once and preserves later additions and other products',async()=>{
  const f=fixture(5);await f.db.collection('customerProfiles').doc('alice').set({cartItems:[{productId:'A',sku:'A',quantity:3},{productId:'B',sku:'B',quantity:1}]});const order=await f.service.reserve(f.request());await f.service.recordPayment(order.id,f.capture(order));await f.service.recordPayment(order.id,f.capture(order));assert.deepEqual(f.records.get('customerProfiles/alice').cartItems.map(x=>x.quantity),[2,1]);
});
test('pending refund stays discoverable for reconciliation; processed refunds never downgrade',async()=>{
 const f=fixture();const o=await f.service.reserve(f.request());await f.service.recordPayment(o.id,f.capture(o));const refund={id:'refund',payment_id:f.capture(o).id,amount:o.amountPaise,status:'pending'};await f.service.recordRefund(o.id,refund);assert.equal((await f.service.readOrder(o.id)).attentionRequired,true);await f.service.recordRefund(o.id,{...refund,status:'processed'});await f.service.recordRefund(o.id,refund);assert.equal((await f.service.readOrder(o.id)).refundStatus,'processed');
});
test('a payment already fully refunded before reconciliation never consumes inventory',async()=>{const f=fixture();const o=await f.service.reserve(f.request());f.tick();await f.service.reconcile(o.id);await f.service.recordPayment(o.id,{...f.capture(o),status:'refunded',amount_refunded:o.amountPaise});assert.equal(f.records.get('sarees/A').availableStock,1);assert.equal((await f.service.readOrder(o.id)).refundStatus,'processed');assert.equal((await f.service.readOrder(o.id)).inventoryCommitted,false);});
test('late failed duplicate refund request cannot downgrade a concurrent processed refund',async()=>{const f=fixture();const o=await f.service.reserve(f.request());await f.service.recordPayment(o.id,f.capture(o));let reject;f.gateway.refund=()=>new Promise((resolve,no)=>{reject=no;});const pending=f.service.refund(o.id);while(!reject)await new Promise(r=>setImmediate(r));await f.service.recordRefund(o.id,{id:'processed',payment_id:f.capture(o).id,amount:o.amountPaise,status:'processed'});reject(Error('duplicate response failed'));await assert.rejects(pending);assert.equal((await f.service.readOrder(o.id)).refundStatus,'processed');});
test('admin can explicitly retry a confirmed failed refund with a new idempotent attempt',async()=>{const f=fixture();const o=await f.service.reserve(f.request());await f.service.recordPayment(o.id,f.capture(o));await f.service.recordRefund(o.id,{id:'failed-refund',payment_id:f.capture(o).id,amount:o.amountPaise,status:'failed'});await f.service.fulfilment(o.id,'retry-refund','owner');assert.equal((await f.service.readOrder(o.id)).refundStatus,'processed');assert.equal((await f.service.readOrder(o.id)).refundAttempt,1);await assert.rejects(f.service.fulfilment(o.id,'retry-refund','owner'));assert.equal(f.refunds.size,1);});
