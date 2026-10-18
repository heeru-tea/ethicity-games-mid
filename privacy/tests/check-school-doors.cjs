const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{const {startServer}=await import('./serve.mjs');const server=await startServer(0);let browser;
try{browser=await chromium.launch({channel:'msedge',headless:true});let page=await browser.newPage({viewport:{width:1200,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base='http://127.0.0.1:'+server.address().port+'/privacy/';
await page.goto(base+'?probe=shot-road');await page.waitForTimeout(12000);
const seed=await page.evaluate(()=>({...localStorage})); await page.close();
for(const [kind,x] of [['classroom',8],['library',15]]){
page=await browser.newPage({viewport:{width:1200,height:900}});page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(({seed,x})=>{Object.entries(seed).forEach(([k,v])=>localStorage.setItem(k,v));const k='ethicity.privacy.progress.v1',p=JSON.parse(seed[k]);p.pos=Object.assign({},p.pos,{x,y:6,dir:'down'});localStorage.setItem(k,JSON.stringify(p));},{seed,x});await page.goto(base+'?doorX='+x,{waitUntil:'domcontentloaded'});await page.evaluate(()=>Object.values(PRIVACY_WORLD.triggers).forEach(t=>(t.cast||[]).forEach(c=>{if(c.x===15&&c.y===8)c.x=17;})));await page.getByRole('button',{name:'이어 하기',exact:true}).click();await page.waitForFunction(()=>PrivacySchool.ready());await page.waitForTimeout(500);
assert.equal((await page.evaluate(()=>PrivacyMap.debug.me())).x,x);
await page.screenshot({path:path.join(__dirname,'_shot-door-'+kind+'.png')});
for(const [key,y] of [['ArrowDown',7],['ArrowDown',8],['ArrowUp',7],['ArrowUp',6]]){await page.keyboard.press(key);await page.waitForTimeout(400);assert.equal((await page.evaluate(()=>PrivacyMap.debug.me())).y,y,'step through doorway');}
assert.equal((await page.evaluate(()=>PrivacyMap.debug.me())).y,6,'door passes both directions');
const checks=await page.evaluate(({kind,x})=>{const c=document.createElement('canvas'),ctx=c.getContext('2d');const urls=[];ctx.drawImage=(im)=>urls.push(im.src);function at(y){urls.length=0;const list=[];PrivacySchool.collectDoors(list,ctx,48,{x:0,y:0},{fx:x,fy:y});list.forEach(v=>v.fn());return urls.find(u=>u.includes('door-'+kind));}return [at(3),at(6),at(5.2),at(4)];},{kind,x});
assert(checks[0].endsWith('-closed.png'));assert(checks[1].endsWith('-open.png'));assert(checks[2].endsWith('-open.png'),'hysteresis');assert(checks[3].endsWith('-closed.png'));
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.screenshot({path:path.join(__dirname,'_shot-door-'+kind+'-mobile.png')});await page.close();
}
assert.deepEqual(errors,[]);console.log('PASS: both doors loaded; proximity open/close and hysteresis; bidirectional keyboard passage; desktop/mobile screenshots; page errors 0');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});






