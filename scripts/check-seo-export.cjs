// Run after npm run build:hosting. Checks the HTML that hosting serves to crawlers.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const root = process.env.BROWSER_BUILD_ROOT || 'out';
const read = file => readFileSync(join(root, file), 'utf8');
const head = html => html.slice(0, html.indexOf('</head>'));

const verificationName = 'google673ab1b38fc73443.html';
const verification = read(verificationName);
assert.equal(verification, readFileSync(join('public', verificationName), 'utf8'));
assert.equal(verification.trim(), `google-site-verification: ${verificationName}`);

const guide = read('saree-culture/index.html');
assert.match(head(guide), /<title>Saree Culture: Kerala Sarees &amp; Indian Saree Types \| eshwe<\/title>/);
assert.match(head(guide), /rel="canonical" href="https:\/\/eshwe.com\/saree-culture\/"/);
assert.match(head(guide), /name="robots" content="index, follow"/);
assert.match(head(guide), /property="og:type" content="article"/);
assert.match(head(guide), /name="description" content="Explore Kerala kasavu sarees/);
assert.equal((guide.match(/<h1[\s>]/g) || []).length, 1);
for (const section of ['kerala-sarees', 'saree-types', 'regional-weaves', 'choosing-a-saree', 'saree-care', 'questions']) {
  assert.ok(guide.includes(`id="${section}"`), `Missing static article section: ${section}`);
  assert.ok(guide.includes(`href="#${section}"`), `Missing table-of-contents target: ${section}`);
}
const schemas = [...guide.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(match => JSON.parse(match[1])['@graph'] || []);
assert.ok(schemas.some(schema => schema['@type'] === 'Article' && schema.mainEntityOfPage === 'https://eshwe.com/saree-culture/'));
assert.ok(schemas.some(schema => schema['@type'] === 'BreadcrumbList'));

const sitemap = read('sitemap.xml');
assert.match(sitemap, /<loc>https:\/\/eshwe.com\/saree-culture\/<\/loc>/);
assert.match(read('robots.txt'), /Sitemap: https:\/\/eshwe.com\/sitemap.xml/);
for (const file of ['index.html', 'app/index.html']) {
  const html = read(file);
  assert.match(head(html), /rel="canonical" href="https:\/\/eshwe.com\/"/);
  assert.match(head(html), /name="robots" content="index, follow"/);
  assert.doesNotMatch(head(html), /noindex/);
  assert.ok(html.includes('href="/saree-culture/"'), `Missing guide link in ${file}`);
}
assert.match(head(read('index.html')), /rel="alternate" media="only screen and \(max-width: 767px\)" href="https:\/\/eshwe.com\/app\/"/);
for (const file of ['app/account/index.html', 'app/checkout/index.html', 'owner/index.html']) {
  assert.match(head(read(file)), /name="robots" content="noindex/);
}
console.log('PASS: verification file, static guide, metadata, structured data, sitemap, mobile homepage and private-page indexing rules.');
