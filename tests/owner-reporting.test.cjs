const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadSource(name, mocks = {}) {
  const filename = path.resolve(name);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module, exports: module.exports,
    require(id) {
      if (id in mocks) return mocks[id];
      if (id.startsWith('@/')) return loadSource(`src/${id.slice(2)}.ts`, mocks);
      return require(id);
    }
  }, { filename });
  return module.exports;
}

function orderFixture(documents) {
  let fail;
  let disposed = false;
  function matches(record, constraint) {
    if (constraint.kind === 'or') return constraint.filters.some(filter => matches(record, filter));
    return record[constraint.field] === constraint.value;
  }
  const firestore = {
    collection: () => 'orders',
    where: (field, operator, value) => ({ kind: 'where', field, operator, value }),
    or: (...filters) => ({ kind: 'or', filters }),
    orderBy: () => ({ kind: 'order' }),
    limit: count => ({ kind: 'limit', count }),
    query: (collection, ...constraints) => ({ collection, constraints }),
    onSnapshot(query, next, error) {
      fail = error;
      let selected = documents;
      for (const constraint of query.constraints) {
        if (constraint.kind === 'where' || constraint.kind === 'or') selected = selected.filter(record => matches(record, constraint));
        if (constraint.kind === 'limit') selected = selected.slice(0, constraint.count);
      }
      next({ docs: selected.map(record => ({ id: record.id, data: () => record })) });
      return () => { disposed = true; };
    }
  };
  return {
    api: loadSource('src/lib/orders.ts', { 'firebase/firestore': firestore, '@/lib/firebase': { db: {} } }),
    fail: error => fail(error),
    disposed: () => disposed
  };
}

const stamp = value => ({ toMillis: () => value });
const reporting = loadSource('src/lib/owner-overview.ts');

test('owner history includes paid orders beyond the newest 100 documents and legacy payment flags', () => {
  const records = Array.from({ length: 160 }, (_, index) => ({ id: `pending-${index}`, status: 'created', createdAt: stamp(1000 + index) }));
  records.push(
    { id: 'old-captured', paymentStatus: 'captured', createdAt: stamp(1), dispatchStatus: 'new' },
    { id: 'legacy-paid', status: 'paid', createdAt: stamp(2), dispatchStatus: 'completed' },
    { id: 'legacy-flag', paymentCaptured: true, createdAt: stamp(3), dispatchStatus: 'new' },
    { id: 'multiple-flags', status: 'paid', paymentStatus: 'captured', paymentCaptured: true, createdAt: stamp(4) }
  );
  const fixture = orderFixture(records);
  let result;
  const unsubscribe = fixture.api.subscribeToSuccessfulOrders(orders => { result = orders; });
  assert.deepEqual(Array.from(result, order => order.id), ['multiple-flags', 'legacy-flag', 'old-captured', 'legacy-paid']);
  assert.equal(fixture.api.getPendingDispatchCount(result), 3);
  unsubscribe();
  assert.equal(fixture.disposed(), true);
});

test('all-time totals cover more than 100 paid orders without double counting', () => {
  const records = Array.from({ length: 150 }, (_, index) => ({
    id: `paid-${index}`, status: 'paid', paymentCaptured: true, createdAt: stamp(new Date(2026, 8, 1).getTime()),
    amountBreakdown: { total: 200 }, cartItems: [{ quantity: 2, unitPrice: 100 }], dispatchStatus: 'completed'
  }));
  let orders;
  orderFixture(records).api.subscribeToSuccessfulOrders(result => { orders = result; });
  const metrics = reporting.buildOwnerOverviewMetrics(orders, [], new Date(2026, 8, 7));
  assert.equal(metrics.totalRevenue, 30000);
  assert.equal(metrics.totalOrders, 150);
  assert.equal(metrics.totalUnitsSold, 300);
  assert.equal(metrics.currentMonthRevenue, 30000);
});

test('zero and small monthly revenue remain proportional instead of showing a minimum bar', () => {
  const now = new Date(2026, 8, 7);
  const orders = [
    { createdAt: stamp(new Date(2026, 7, 1).getTime()), amountBreakdown: { total: 1000 } },
    { createdAt: stamp(new Date(2026, 8, 1).getTime()), amountBreakdown: { total: 10 } }
  ];
  const series = reporting.buildOwnerOverviewMetrics(orders, [], now).revenueSeries;
  assert.deepEqual(Array.from(series, month => month.heightPercent), [0, 0, 0, 0, 100, 1]);
  assert.equal(reporting.buildOwnerOverviewMetrics([], [], now).revenueSeries.every(month => month.heightPercent === 0), true);
});

test('subscription errors are surfaced to the owner UI', () => {
  const fixture = orderFixture([]);
  let error;
  fixture.api.subscribeToSuccessfulOrders(() => {}, value => { error = value; });
  fixture.fail(new Error('Permission denied'));
  assert.equal(error.message, 'Permission denied');
});
