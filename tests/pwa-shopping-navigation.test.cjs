const test = require('node:test'); const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/source.cjs');
function fixture(path = '/app/search/category/cotton/?sort=price-asc') {
  const values = new Map(); const location = new URL('https://eshwe.com' + path);
  const history = { state: { __NA: true }, replaceState(value) { this.state = value; } };
  const sessionStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const api = loadSource('src/lib/pwa-shopping-navigation.ts', {}, { location, history, sessionStorage, window: { scrollY: 840 } });
  return { api, location, history, values };
}
test('PWA product visit preserves catalogue filters and scroll through a product reload', () => {
  const f = fixture(); f.api.rememberPwaProductVisit('/app/product/?slug=cotton-one');
  f.location.href = 'https://eshwe.com/app/product/cotton-one/';
  f.api.attachPwaProductOrigin('/app/product/cotton-one/');
  f.api.attachPwaProductOrigin('/app/product/cotton-one/');
  assert.equal(f.history.state.__NA, true);
  assert.equal(f.api.preparePwaShoppingReturn('/app/product/cotton-one/'), '/app/search/category/cotton/?sort=price-asc');
  assert.equal(JSON.parse(f.values.get('eshwe.pwaShoppingReturn')).scrollY, 840);
});
test('related products retain the catalogue origin instead of returning to another product', () => {
  const f = fixture(); f.api.rememberPwaProductVisit('/app/product/one/'); f.location.href = 'https://eshwe.com/app/product/one/';
  f.api.attachPwaProductOrigin('/app/product/one/'); f.api.rememberPwaProductVisit('/app/product/two/');
  f.location.href = 'https://eshwe.com/app/product/two/'; f.api.attachPwaProductOrigin('/app/product/two/');
  assert.match(f.api.preparePwaShoppingReturn('/app/product/two/'), /^\/app\/search\/category/);
});
test('shared links and stale origins fall back to Browse at the top', () => {
  const f = fixture('/app/product/shared/'); assert.equal(f.api.preparePwaShoppingReturn('/app/product/shared/'), '/app/search/');
  assert.equal(JSON.parse(f.values.get('eshwe.pwaShoppingReturn')).scrollY, 0);
  f.history.state.eshweProductOrigin = { productPath: '/app/product/other/', origin: { href: '/app/favorites/', scrollY: 50 } };
  assert.equal(f.api.preparePwaShoppingReturn('/app/product/shared/'), '/app/search/');
});
test('shopping return accepts only PWA browsing destinations and valid scroll positions', () => {
  const { api } = fixture();
  for (const href of ['https://example.com/app/search/', '//example.com/app/', '/owner/', '/app/checkout/', 'javascript:alert(1)', 'http://']) assert.equal(api.validBrowsePosition({ href, scrollY: 0 }), null);
  assert.equal(api.validBrowsePosition({ href: '/app/search/', scrollY: -1 }), null);
  assert.equal(api.validBrowsePosition({ href: '/app/', scrollY: 0 }).href, '/app/');
});
test('a loading-shell remount retains the pending scroll until the catalogue is ready', () => {
  const key='eshwe.pwaShoppingReturn'; const values=new Map([[key,JSON.stringify({href:'/app/search/',scrollY:840})]]);
  const frames=[]; const cancelled=new Set(); const scrolls=[];
  const document={documentElement:{scrollHeight:844}};
  const api=loadSource('src/lib/pwa-shopping-navigation.ts',{}, {
    location:new URL('https://eshwe.com/app/search/'),document,innerHeight:844,
    sessionStorage:{getItem:k=>values.get(k)||null,removeItem:k=>values.delete(k)},
    window:{scrollTo:options=>scrolls.push(options.top),addEventListener(){},removeEventListener(){}},
    ResizeObserver:class{observe(){}disconnect(){}},
    requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},cancelAnimationFrame:id=>cancelled.add(id),
    setTimeout:()=>1,clearTimeout(){}
  });
  const cleanup=api.restorePwaShoppingPosition({}); cleanup();
  assert.ok(values.has(key)); document.documentElement.scrollHeight=3000;
  api.restorePwaShoppingPosition({}); frames.forEach((fn,i)=>{if(!cancelled.has(i+1))fn();});
  assert.deepEqual(scrolls,[840]); assert.equal(values.has(key),false);
});
