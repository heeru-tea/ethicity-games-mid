const {chromium}=require('C:/Users/정벅/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href+'?preview=s01');
  await page.locator('.backdrop').evaluate(i=>i.decode());
  await page.waitForFunction(()=>Array.from(document.images).every(i=>i.complete));
  await page.locator('.work [data-act="photo-zoom"]').click();
  assert.equal(await page.locator('dialog').isVisible(),true);
  assert.match(await page.locator('#modal-title').textContent(),/원본과/);
  await page.locator('[data-act="close"]').click();
  await page.screenshot({path:path.join(__dirname,'s01-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(__dirname,'s01-mobile.png'),fullPage:true});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  assert.equal(overflow,false);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({errors,overflow,photoZoom:'passed',images:await page.locator('img').evaluateAll(a=>a.map(i=>({src:i.getAttribute('src'),loaded:i.naturalWidth>0})))},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
