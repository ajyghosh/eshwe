const { Transaction } = require('../../functions/node_modules/@google-cloud/firestore/build/src/transaction');

// Optimistic transaction fixture: aborted writes never commit, concurrent changes
// cause retries, and the real installed SDK enforces read-before-write ordering.
function memoryFirestore(initial = {}) {
  const records = new Map(Object.entries(structuredClone(initial)));
  const versions = new Map();
  let sequence = 0; let idSequence = 0;
  const snapshot = ref => ({ id: ref.id, ref, exists: records.has(ref.path), data: () => structuredClone(records.get(ref.path)) });
  function apply(ref, value, merge) {
    if (value === null) records.delete(ref.path);
    else records.set(ref.path, { ...(merge ? records.get(ref.path) : {}), ...structuredClone(value) });
    versions.set(ref.path, (versions.get(ref.path) || 0) + 1);
    sequence++;
  }
  const db = { collection(name) {
    const makeQuery = (filters = [], count = Infinity) => ({
      where: (field, op, value) => makeQuery([...filters, { field, op, value }], count),
      limit: nextCount => makeQuery(filters, nextCount),
      async get() {
        const docs = [...records].filter(([key, value]) => key.startsWith(name + '/') && key.split('/').length === name.split('/').length + 1 && filters.every(f => f.op === '==' ? value[f.field] === f.value : f.op === '<=' ? value[f.field] <= f.value : false)).slice(0,count).map(([key]) => snapshot(db.collection(name).doc(key.slice(name.length + 1))));
        return { docs, size: docs.length, empty: !docs.length };
      },
      doc(id = `auto-${++idSequence}`) {
        const ref = { id, path: `${name}/${id}` };
        ref.get = async () => snapshot(ref);
        ref.set = async (value, options) => apply(ref, value, options?.merge);
        ref.update = async value => { if (!records.has(ref.path)) throw Error('Document missing'); apply(ref, value, true); };
        ref.delete = async () => apply(ref, null);
        ref.collection = child => db.collection(`${ref.path}/${child}`);
        return ref;
      }
    });
    return makeQuery();
  }, async runTransaction(callback) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const reads = new Map(); const writes = []; let queryVersion;
      const tx = {
        async get(ref) {
          if (writes.length) Transaction.prototype.get.call({ _writeBatch: { isEmpty: false } }, ref);
          if (!ref.path) { queryVersion = sequence; return ref.get(); }
          reads.set(ref.path, versions.get(ref.path) || 0); return snapshot(ref);
        },
        update: (ref, value) => writes.push({ ref, value, merge: true }),
        create: (ref, value) => writes.push({ ref, value, create: true }),
        set: (ref, value, options) => writes.push({ ref, value, merge: options?.merge }),
        delete: ref => writes.push({ ref, value: null })
      };
      const result = await callback(tx);
      if ([...reads].some(([key, version]) => (versions.get(key) || 0) !== version) || (queryVersion !== undefined && queryVersion !== sequence)) continue;
      if (writes.some(w => w.create && records.has(w.ref.path))) continue;
      for (const write of writes) apply(write.ref, write.value, write.merge);
      return result;
    }
    throw new Error('Transaction contention exceeded test retry budget');
  } };
  return { db, records };
}
module.exports = { memoryFirestore };
