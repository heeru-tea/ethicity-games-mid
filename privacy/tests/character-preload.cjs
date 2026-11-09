// node privacy/tests/character-preload.cjs (PLAYWRIGHT_PATH may override the local installation)
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const { startServer } = await import('./serve.mjs');
  const server = await startServer(0);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => requests.push(r.url()));
    await page.goto('http://127.0.0.1:' + server.address().port + '/privacy/');
    await page.waitForTimeout(2500);
    assert(requests.some(u => /saebom-portraits\.webp$/.test(u)), 'prepare portraits before their first dialogue');
    await page.waitForFunction(() => ['onyu', 'daon', 'saebom', 'jiho', 'haneul', 'teacher', 'robot', 'minjun', 'friend'].every(who =>
      PrivacyCast.ready(PrivacyCast.walk(who)) && PrivacyCast.ready(PrivacyCast.portraits(who))) && PrivacyCast.ready(PrivacyCast.sleep()));
    assert.equal(await page.locator('body').getAttribute('data-view'), 'v-start', 'warming must not start the game');
    assert.deepEqual(errors, []);
    console.log('PASS: all character sheets decoded on start screen; no automatic game advance or JS errors');
    await page.close();
    const saving = await browser.newPage();
    const savedRequests = [];
    await saving.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true } }));
    saving.on('request', r => savedRequests.push(r.url()));
    await saving.goto('http://127.0.0.1:' + server.address().port + '/privacy/');
    await saving.waitForTimeout(1500);
    assert(!savedRequests.some(u => /saebom-portraits\.webp$/.test(u)), 'respect data saver');
    console.log('PASS: data saver skips speculative character downloads');
    await saving.close();
  } finally { await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
