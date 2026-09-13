const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/source.cjs');
const { createOptimisticList } = loadSource('src/lib/optimistic-list.ts');
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(items = [], revision = 0) {
  const writes = []; const frames = []; const errors = [];
  const sync = createOptimisticList(change => new Promise((resolve, reject) => writes.push({ change, resolve, reject })), (items, syncing) => frames.push({ items: JSON.parse(JSON.stringify(items)), syncing }), error => errors.push(error.message));
  sync.receive({ items, revision });
  return { sync, writes, frames, errors, last: () => frames.at(-1) };
}
test('add, quantity and remove render immediately while writes are held, and save in tap order', async () => {
  const f = fixture();
  f.sync.change(items => [...items, { sku: 'A', quantity: 1 }]);
  assert.deepEqual(f.last(), { items: [{ sku: 'A', quantity: 1 }], syncing: true });
  f.sync.change(items => items.map(item => ({ ...item, quantity: 2 })));
  f.sync.change(() => []);
  assert.deepEqual(f.last().items, []); assert.equal(f.writes.length, 1);
  f.writes[0].resolve({ items: f.writes[0].change([]), revision: 1 }); await tick();
  assert.deepEqual(f.last().items, []); assert.equal(f.writes.length, 2);
  f.writes[1].resolve({ items: [{ sku: 'A', quantity: 2 }], revision: 2 }); await tick();
  f.writes[2].resolve({ items: [], revision: 3 }); await tick();
  assert.deepEqual(f.last(), { items: [], syncing: false });
});
test('an early listener echo never doubles an optimistic add', async () => {
  const f = fixture([{ quantity: 1 }]);
  f.sync.change(items => items.map(item => ({ quantity: item.quantity + 1 })));
  f.sync.receive({ items: [{ quantity: 2 }], revision: 1 });
  assert.equal(f.last().items[0].quantity, 2);
  f.writes[0].resolve({ items: [{ quantity: 2 }], revision: 1 }); await tick();
  assert.equal(f.last().items[0].quantity, 2);
});
test('delayed old snapshots cannot roll back a completed write', async () => {
  const f = fixture(); f.sync.change(() => ['A']);
  f.writes[0].resolve({ items: ['A'], revision: 2 }); await tick();
  f.sync.receive({ items: [], revision: 1 }); assert.deepEqual(f.last().items, ['A']);
  f.sync.receive({ items: ['A', 'B'], revision: 3 }); assert.deepEqual(f.last().items, ['A', 'B']);
});
test('newer remote changes, including payment removal at the same revision, survive a late save response', async () => {
  const f = fixture(); f.sync.change(() => ['A']);
  f.sync.receive({ items: ['A'], revision: 1 });
  f.sync.receive({ items: [], revision: 1 });
  f.writes[0].resolve({ items: ['A'], revision: 1 }); await tick();
  assert.deepEqual(f.last().items, []);
  f.sync.change(items => [...items, 'B']);
  f.sync.receive({ items: ['B', 'OTHER-DEVICE'], revision: 3 });
  f.writes[1].resolve({ items: ['B'], revision: 2 }); await tick();
  assert.deepEqual(f.last().items, ['B', 'OTHER-DEVICE']);
});
test('failed favourite save rolls back only that edit, surfaces failure, and preserves other queued edits', async () => {
  const f = fixture(['EXISTING']); f.sync.change(items => [...items, 'FAILED']); f.sync.change(items => [...items, 'SAVED']);
  f.writes[0].reject(Error('Offline')); await tick();
  assert.deepEqual(f.last().items, ['EXISTING', 'SAVED']); assert.deepEqual(f.errors, ['Offline']);
  f.writes[1].resolve({ items: ['EXISTING', 'SAVED'], revision: 1 }); await tick();
  assert.equal(f.last().syncing, false);
});
test('switching accounts stops queued writes and prevents old callbacks reaching the new session', async () => {
  const f = fixture(); f.sync.change(() => ['PRIVATE']); f.sync.change(() => ['QUEUED']); f.sync.dispose();
  const count = f.frames.length; f.writes[0].resolve({ items: ['PRIVATE'], revision: 1 }); await tick();
  f.sync.receive({ items: ['PRIVATE'], revision: 1 }); f.sync.change(() => ['LATE']);
  assert.equal(f.frames.length, count); assert.equal(f.writes.length, 1);
});
