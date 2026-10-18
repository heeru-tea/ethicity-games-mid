// Run only once all ten PNGs are present. Uses a fresh isolated Edge session.
const fs = require('node:fs');
const path = require('node:path');
const files = [
  'boy-arrival', 'girl-arrival', 'boy-confrontation', 'girl-confrontation',
  'boy-clash', 'girl-clash', 'boy-recorded', 'girl-recorded',
  'classroom-reaction', 'teacher-support'
].map(name => name + '.png');

(async () => {
  const missing = files.filter(file => !fs.existsSync(path.join(__dirname, file)));
  if (missing.length) throw new Error('PNG 준비 후 실행하세요: ' + missing.join(', '));
  const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
  const {startServer} = await import('../../tests/serve.mjs');
  const server = await startServer(0);
  let browser;
  try {
    browser = await chromium.launch({channel: 'msedge', headless: true});
    const context = await browser.newContext({viewport: {width: 1280, height: 1000}, deviceScaleFactor: 1});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/privacy/assets/nightfox-event/preview.html`, {waitUntil: 'load'});
    await page.waitForFunction(() => window.assetChecksReady === true, null, {timeout: 30000});
    await page.evaluate(() => document.fonts.ready);
    const results = await page.evaluate(() => window.assetChecks);
    const layout = await page.locator('#sheet img').evaluateAll(images => images.map(img => ({
      file: img.getAttribute('src'), fit: getComputedStyle(img).objectFit,
      width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height
    })));
    fs.writeFileSync(path.join(__dirname, 'asset-metadata.json'), JSON.stringify({
      checkedAt: new Date().toISOString(), assets: results, layout, errors
    }, null, 2) + '\n');
    await page.screenshot({path: path.join(__dirname, 'preview.png'), fullPage: true});
    const invalid = results.filter(item => item.error || !item.width || !item.height || !item.opaque || !item.ratioValid);
    const found = results.map(item => item.file);
    if (results.length !== 10 || files.some(file => !found.includes(file)) || invalid.length || errors.length ||
        layout.length !== 10 || layout.some(item => item.fit !== 'contain' || item.width <= 0 || item.height <= 0 || Math.abs(item.height - item.width * 9 / 16) > 1)) {
      throw new Error('검증 실패. asset-metadata.json 및 preview.png 확인: ' + invalid.map(item => item.file).join(', '));
    }
    console.log('PASS: 10 opaque 16:9 PNGs loaded, DOM images use contain. Saved preview.png and asset-metadata.json.');
  } finally {
    try { if (browser) await browser.close(); }
    finally { await new Promise(resolve => server.close(resolve)); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
