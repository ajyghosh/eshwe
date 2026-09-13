const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { chromium } = require('/Applications/Visual Studio Code.app/Contents/Resources/app/node_modules/playwright-core');

async function main() {
  const server = http.createServer((request, response) => {
    if (request.url === '/sw.js') {
      response.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' });
      return response.end(fs.readFileSync('public/sw.js'));
    }
    if (request.url === '/offline.html') {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      return response.end(fs.readFileSync('public/offline.html'));
    }
    response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=3600' });
    response.end('<!doctype html><h1>Online catalogue</h1><script>navigator.serviceWorker.register("/sw.js")</script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    const context = await browser.newContext(); const page = await context.newPage(); page.setDefaultTimeout(15000);
    await page.goto(base + '/app/search/');
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await page.goto(base + '/app/account/');
    await context.setOffline(true);
    await page.goto(base + '/app/search/');
    await page.getByRole('heading', { name: "You're offline", exact: true }).waitFor();
    assert.equal(await page.title(), 'Reconnect | eshwe');
    console.log('PASS HTTP-cached navigation reaches offline fallback');
    await context.setOffline(false);
    // The fallback reloads on the online event; do not race it with page.reload().
    await page.getByRole('heading', { name: 'Online catalogue', exact: true }).waitFor();
    console.log('PASS Automatic reconnect restores the catalogue');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
