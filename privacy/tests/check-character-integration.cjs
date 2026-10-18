const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const {startServer}=await import('./serve.mjs'); const server=await startServer(0);
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const base='http://127.0.0.1:'+server.address().port+'/privacy/';
 try {
  for(const mobile of [false,true]) {
   const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1200,height:900}});
   const errors=[]; page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{
    window.characterDraws=[];
    const draw=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(im,...args){
     if(im?.src?.includes('characters-v3/walk-')) {
      window.characterDraws.push({src:im.src,args,smooth:this.imageSmoothingEnabled});
      if(window.characterDraws.length>2000)window.characterDraws.shift();
     }
     return draw.call(this,im,...args);
    };
   });
   await page.goto(base);
   await page.locator('label[data-look=m]').click();
   await page.locator('#btn-new').click();
   await page.waitForFunction(()=>window.characterDraws.some(d=>d.src.endsWith('walk-boy.png')));
   // Real keyboard movement in the opening map.
   const before=await page.evaluate(()=>PrivacyMap.debug.me());
   const route=await page.evaluate(()=>PrivacyMap.debug.route());
   assert(route.length);
   const key={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[route[0]];
   await page.keyboard.down(key); await page.waitForTimeout(180); await page.keyboard.up(key);
   await page.waitForTimeout(250);
   const after=await page.evaluate(()=>PrivacyMap.debug.me());
   assert(before.x!==after.x||before.y!==after.y,'keyboard movement');
   await page.evaluate(()=>{
    const r=document.querySelector('input[name=look][value=f]'); r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}));
    PrivacyMap.stage({place:'classroom',tint:'day',me:{x:7,y:5,dir:'down'},cast:['hayun','seoa','dohyun','minjun','teacher'].map((who,i)=>({who,x:5+i*2,y:4,dir:'down'}))});
    const holder=document.createElement('div');holder.id='character-test';
    ['hayun','seoa','dohyun','minjun','teacher','me'].forEach(who=>holder.append(PrivacySprite.el(who,{face:true,look:'f',initial:'검'})));
    document.body.append(holder);
   });
   await page.waitForFunction(ids=>ids.every(id=>window.characterDraws.some(d=>d.src.endsWith('walk-'+id+'.png'))),mobile?['girl']:['girl','hayun','seoa','dohyun','minjun','teacher']);
   await page.waitForFunction(()=>document.querySelectorAll('#character-test .loaded').length===6);
   const draws=await page.evaluate(()=>window.characterDraws);
   assert(draws.every(d=>d.args[2]===256&&d.args[3]===384),'natural source cells');
   assert(draws.every(d=>d.args[6]<=96&&d.args[7]<=144),'map does not scale to256px tiles');
   assert(draws.every(d=>d.smooth),'new art uses smoothing');
   assert.equal(errors.length,0,errors.join('\n'));
   await page.screenshot({path:path.join(__dirname,mobile?'_shot-characters-mobile.png':'_shot-characters-desktop.png'),fullPage:false});
   await page.close(); console.log('PASS actual game: '+(mobile?'mobile':'desktop')+' movement, 7 sheets, portraits, tile scale');
  }
  // New sheet unavailable: original sheet must still paint, with no exception.
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/characters-v3/**',r=>r.abort());
  await page.addInitScript(()=>{window.oldDrawn=false;const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(im,...args){if((im?.src||'').includes('char_player_m')||im?.naturalWidth===192)window.oldDrawn=true;return draw.call(this,im,...args);};});
  await page.goto(base);await page.locator('label[data-look=m]').click();await page.locator('#btn-new').click();
  await page.waitForFunction(()=>window.oldDrawn);
  await page.evaluate(()=>document.body.append(PrivacySprite.el('hayun',{face:true,initial:'하'})));
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.spr.loaded')).some(n=>n.style.backgroundImage.includes('char_hayun.png')));
  assert.equal(errors.length,0,errors.join('\n')); await page.close();console.log('PASS missing new assets: legacy map and DOM fallback');
  for(const sc of ['opening','stage-mode','stage-resize','map-resume','portrait','chapter-face']) {
   const p=await browser.newPage();await p.goto(base+'?probe='+sc);
   await p.waitForSelector('#probe-out',{state:'attached',timeout:60000});
   const r=JSON.parse(await p.locator('#probe-out').textContent());
   assert.deepEqual(r.fail,[],sc);assert.deepEqual(r.errors,[],sc);console.log('PASS '+sc+': '+r.pass.length);await p.close();
  }
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});


