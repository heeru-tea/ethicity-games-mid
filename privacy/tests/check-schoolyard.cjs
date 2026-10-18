// Isolated browser: never touches the player's normal browser storage.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('node:path');
(async () => {
  const { startServer } = await import('./serve.mjs');
  const server = await startServer(0);
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + server.address().port + '/privacy/?probe=shot-road');
    await page.waitForTimeout(12000);
    await page.evaluate(() => {
      const key = 'ethicity.privacy.progress.v1';
      const p = JSON.parse(localStorage.getItem(key));
      p.pos = Object.assign({}, p.pos, { x: 11, y: 32, dir: 'right' });
      localStorage.setItem(key, JSON.stringify(p));
    });
    await page.goto('http://127.0.0.1:' + server.address().port + '/privacy/');
    await page.getByRole('button', { name: '이어 하기', exact: true }).click();
    await page.waitForTimeout(800);
    await page.waitForFunction(() => PrivacySchoolyard.ready());
    await page.screenshot({ path: path.join(__dirname, '_shot-schoolyard.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(__dirname, '_shot-schoolyard-mobile.png'), fullPage: true });
    console.log('Resumed position', await page.evaluate(() => PrivacyMap.debug.me()));
    await page.evaluate(() => {
      const key = 'ethicity.privacy.progress.v1', p = JSON.parse(localStorage.getItem(key));
      p.pos = Object.assign({}, p.pos, { x: 19, y: 16 });
      localStorage.setItem(key, JSON.stringify(p));
    });
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.reload();
    await page.getByRole('button', { name: '이어 하기', exact: true }).click();
    await page.waitForFunction(() => PrivacySchoolyard.ready());
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(__dirname, '_shot-schoolyard-gate.png'), fullPage: true });
    await page.evaluate(()=>{
      const c=document.createElement('canvas');c.id='yard-overview';c.width=768;c.height=1472;
      const g=c.getContext('2d'),t=32,cam={x:-16,y:0};g.fillStyle='#e7e9df';g.fillRect(0,0,c.width,c.height);
      for(let y=11;y<44;y++)for(let x=1;x<22;x++)PrivacySchoolyard.drawCell(g,PRIVACY_WORLD.grid[y][x],x,y,t,cam);
      PrivacySchool.exterior(g,t,cam);
      const list=[];PrivacyNeighborhood.collect(list,g,t,cam,{x0:0,y0:0,x1:23,y1:45});list.sort((a,b)=>a.y-b.y).forEach(d=>d.fn());
      PRIVACY_WORLD.OBJECTS.filter(o=>['store','tent1','tent2','yardGoalLeft','yardGoalRight'].includes(o.id)).forEach(o=>PrivacySchoolyard.object(g,o,t,cam));
      document.body.append(c);
    });
    await page.locator('#yard-overview').screenshot({path:path.join(__dirname,'_shot-schoolyard-overview.png')});
    console.log(JSON.stringify({ errors, screenshot: '_shot-schoolyard.png' }));
    if (errors.length) process.exitCode = 1;
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });



