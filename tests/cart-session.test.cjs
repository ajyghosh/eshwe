const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/source.cjs');

const guestKey = 'eshwe-cart-v1:guest';
const line = { sku: 'A', slug: 'saree-a', name: 'Saree A', price: 100, quantity: 1, availableStock: 2, status: 'active' };
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(entries = [[guestKey, JSON.stringify([line])]], uid = 'alice') {
  const values = new Map(entries);
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    get length() { return values.size; },
    key: index => [...values.keys()][index]
  };
  const frames = [], writes = [], errors = [];
  let listener, unsubscribed = false;
  const { createCustomerCartSession } = loadSource('src/lib/customer-cart-session.ts', {
    '@/lib/customer-profiles': {
      subscribeToCustomerProfile: (_, next) => {
        listener = next;
        // Firebase can deliver an empty cached account immediately after OTP.
        next(null);
        return () => { unsubscribed = true; };
      },
      migrateCustomerCart: (userId, items, id) => new Promise((resolve, reject) => writes.push({ userId, items, id, resolve, reject })),
      changeCustomerCart: async () => { throw Error('Unexpected cart edit'); }
    }
  }, { crypto: require('node:crypto') });
  const session = createCustomerCartSession(uid, storage, guestKey,
    (items, syncing, ready) => frames.push({ items: JSON.parse(JSON.stringify(items)), syncing, ready }),
    message => errors.push(message));
  return { session, storage, frames, writes, errors, emit: profile => listener(profile), last: () => frames.at(-1), unsubscribed: () => unsubscribed };
}

test('OTP account snapshot cannot expose a ready empty bag before guest migration completes', async () => {
  const f = fixture();
  assert.equal(f.last().ready, false);
  assert.equal(f.last().syncing, true);
  assert.equal(f.writes.length, 1);
  f.emit({ cartItems: [], cartRevision: 0 });
  assert.equal(f.last().ready, false);
  // Completion alone is enough; checkout need not wait for a listener echo.
  f.writes[0].resolve({ items: [line], revision: 1 });
  await tick();
  assert.deepEqual(f.last(), { items: [line], syncing: false, ready: true });
  assert.equal(f.frames.some(frame => frame.ready && !frame.items.length), false);
  assert.equal(f.storage.length, 0);
  f.emit({ cartItems: [], cartRevision: 0 });
  assert.equal(f.last().items.length, 1);
  f.session.dispose();
});

test('guest and legacy imports must both finish, even if the listener echoes first', async () => {
  const f = fixture([[guestKey, JSON.stringify([line])], ['eshwe-cart-v1:alice', JSON.stringify([{ ...line, sku: 'B' }])]]);
  assert.equal(f.writes.length, 2);
  f.emit({ cartItems: [line], cartRevision: 1 });
  f.writes[0].resolve({ items: [line], revision: 1 });
  await tick();
  assert.equal(f.last().ready, false);
  const merged = [line, { ...line, sku: 'B' }];
  f.emit({ cartItems: merged, cartRevision: 2 });
  f.writes[1].resolve({ items: merged, revision: 2 });
  await tick();
  assert.deepEqual(f.last(), { items: merged, syncing: false, ready: true });
  f.session.dispose();
});

test('failed transfer keeps checkout unresolved, reports the error, and retains a retry journal', async () => {
  const f = fixture();
  f.writes[0].reject(Error('Offline'));
  await tick();
  f.emit({ cartItems: [], cartRevision: 0 });
  assert.equal(f.last().ready, false);
  assert.equal(f.last().syncing, false);
  assert.match(f.errors[0], /reload to try again/);
  const jobKey = f.storage.key(0);
  assert.match(jobKey, /migration:alice:/);
  const retry = fixture([[jobKey, f.storage.getItem(jobKey)]]);
  assert.equal(retry.writes[0].id, f.writes[0].id);
  retry.writes[0].resolve({ items: [line], revision: 1 });
  await tick();
  assert.equal(retry.last().ready, true);
  f.session.dispose(); retry.session.dispose();
});

test('a genuinely empty account with no guest bag remains ready for the empty-cart redirect', () => {
  const f = fixture([]);
  assert.deepEqual(f.last(), { items: [], syncing: false, ready: true });
  assert.equal(f.writes.length, 0);
  f.session.dispose();
});

test('account switch ignores late migration results and keeps claims with their original account', async () => {
  const f = fixture();
  const jobKey = f.storage.key(0);
  const other = fixture([[jobKey, f.storage.getItem(jobKey)]], 'bob');
  assert.equal(other.writes.length, 0);
  assert.equal(other.last().items.length, 0);
  f.session.dispose();
  const count = f.frames.length;
  f.writes[0].resolve({ items: [line], revision: 1 });
  await tick();
  assert.equal(f.frames.length, count);
  assert.equal(f.unsubscribed(), true);
  other.session.dispose();
});

test('newer remote cart changes survive a delayed migration response', async () => {
  const f = fixture();
  const remote = [{ ...line, quantity: 2 }];
  f.emit({ cartItems: remote, cartRevision: 3 });
  f.writes[0].resolve({ items: [line], revision: 1 });
  await tick();
  assert.deepEqual(f.last(), { items: remote, syncing: false, ready: true });
  f.session.dispose();
});

test('a delayed migration response cannot restore a cart already cleared by payment', async () => {
  const f = fixture();
  f.emit({ cartItems: [line], cartRevision: 1 });
  f.emit({ cartItems: [], cartRevision: 1 });
  f.writes[0].resolve({ items: [line], revision: 1 });
  await tick();
  assert.deepEqual(f.last(), { items: [], syncing: false, ready: true });
  f.session.dispose();
});
