// Public, read-only catalogue snapshot for static product metadata. Never writes Firestore.
const { loadEnvConfig } = require('@next/env');
const { mkdirSync, writeFileSync } = require('node:fs');
loadEnvConfig(process.cwd());
async function main() {
  if (process.env.ESHWE_CATALOGUE_SNAPSHOT) return;
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!project) throw Error('Firebase project is required to build product pages.');
  const host = process.env.FIRESTORE_EMULATOR_HOST ? `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1` : 'https://firestore.googleapis.com/v1';
  const response = await fetch(`${host}/projects/${project}/databases/(default)/documents:runQuery`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000),
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'sarees' }], where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'IN', value: { arrayValue: { values: [{ stringValue: 'active' }, { stringValue: 'out_of_stock' }] } } } } } })
  });
  if (!response.ok) throw Error(`Catalogue snapshot failed (${response.status}); build stopped.`);
  function decode(value) {
    if ('stringValue' in value) return value.stringValue;
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return value.doubleValue;
    if ('booleanValue' in value) return value.booleanValue;
    if ('timestampValue' in value) return value.timestampValue;
    if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
    return null;
  }
  const products = (await response.json()).filter(row => row.document).map(({ document }) => ({ id: document.name.split('/').pop(), ...Object.fromEntries(Object.entries(document.fields).map(([key, value]) => [key, decode(value)])) }));
  const slugs = new Set();
  for (const product of products) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug) || slugs.has(product.slug)) throw Error(`Invalid or duplicate published slug: ${product.slug}`);
    slugs.add(product.slug);
  }
  mkdirSync('.catalogue-build', { recursive: true });
  writeFileSync('.catalogue-build/products.json', JSON.stringify(products));
  console.log(`Read ${products.length} published products for static metadata.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
