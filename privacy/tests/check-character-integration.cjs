// 공통 팩 공식 캐릭터 연결 확인: 맵 걷기 시트·대화 초상화·관계 얼굴이 ethicity-elementary-common-v1(민준은 같은 규격의 전용 그림)에서 온다.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
async function pastWarning(p){const b=p.getByRole('button',{name:'확인했어요'});if(await b.isVisible().catch(()=>false))await b.click();}
const WALK=/(shared\/ethicity-elementary-common-v1\/characters|assets\/characters-official|assets\/shared-webp\/ethicity-elementary-common-v1\/characters)\/([a-z_]+)-walk\.(png|webp)$/; // 2026-11-02 webp 사본도 같은 그림
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
     if(/-walk\.(png|webp)$/.test(im?.src||'')) {
      window.characterDraws.push({src:im.src,args,smooth:this.imageSmoothingEnabled});
      if(window.characterDraws.length>2000)window.characterDraws.shift();
     }
     return draw.call(this,im,...args);
    };
   });
   await page.goto(base);
   await page.locator('label[data-look=m]').click();
   await page.locator('#btn-new').click();await page.waitForTimeout(500);await pastWarning(page);
   await page.waitForFunction(()=>window.characterDraws.some(d=>/\/onyu-walk\.(png|webp)$/.test(d.src)));
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
    PrivacyMap.stage({place:'classroom',tint:'day',me:{x:7,y:5,dir:'down'},cast:['saebom','jiho','haneul','minjun','teacher','friend'].map((who,i)=>({who,x:4+i*2,y:4,dir:'down'}))});
    const holder=document.createElement('div');holder.id='character-test';
    ['saebom','jiho','haneul','minjun','teacher','lumi'].forEach(who=>holder.append(PrivacySprite.el(who,{face:true,look:'f',initial:'검'})));
    document.body.append(holder);
   });
   // 좁은 화면은 카메라가 주인공 둘레만 보여 준다(옛 테스트와 같이 주인공만 확인)
   const ids=mobile?['daon']:['daon','saebom','jiho','haneul','minjun','teacher','friend'];
   await page.waitForFunction(ids=>ids.every(id=>window.characterDraws.some(d=>d.src.endsWith('/'+id+'-walk.png')||d.src.endsWith('/'+id+'-walk.webp'))),ids);
   await page.waitForFunction(()=>document.querySelectorAll('#character-test .loaded').length===6);
   const draws=await page.evaluate(()=>window.characterDraws);
   assert(draws.every(d=>WALK.test(d.src)),'only common-pack (or same-spec minjun) walk sheets');
   assert(draws.every(d=>d.args[2]===96&&d.args[3]===128),'official 96×128 source cells');
   assert(draws.every(d=>!d.smooth),'pixel art drawn without smoothing');
   const faces=await page.evaluate(()=>Array.from(document.querySelectorAll('#character-test .spr')).map(n=>n.style.backgroundImage));
   assert(faces.every(f=>/-portraits\.(png|webp)/.test(f)),'faces come from portrait sheets');
   assert(faces.some(f=>f.includes('robot-portraits.')),'루미 = 안내 로봇');
   assert.equal(errors.length,0,errors.join('\n'));
   await page.screenshot({path:path.join(__dirname,mobile?'_shot-characters-mobile.png':'_shot-characters-desktop.png'),fullPage:false});
   await page.close(); console.log('PASS actual game: '+(mobile?'mobile':'desktop')+' movement, official sheets, portraits');
  }
  // 공통 팩을 못 불러와도: 맵은 옛 시트로, 얼굴은 이니셜로 — 예외 없이
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/ethicity-elementary-common-v1/characters/**',r=>r.abort());
  await page.addInitScript(()=>{window.oldDrawn=false;const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(im,...args){if(/char_player_m|walk-boy/.test(im?.src||''))window.oldDrawn=true;return draw.call(this,im,...args);};});
  await page.goto(base);await page.locator('label[data-look=m]').click();await page.locator('#btn-new').click();await page.waitForTimeout(500);await pastWarning(page);
  await page.waitForFunction(()=>window.oldDrawn);
  await page.evaluate(()=>document.body.append(PrivacySprite.el('saebom',{face:true,initial:'새'})));
  await page.waitForTimeout(500);
  assert(await page.evaluate(()=>Array.from(document.querySelectorAll('.spr')).some(n=>n.classList.contains('fallback')&&n.textContent==='새')),'initial fallback');
  assert.equal(errors.length,0,errors.join('\n')); await page.close();console.log('PASS missing common pack: legacy map sheet and initial fallback');
  for(const sc of ['opening','stage-mode','stage-resize','map-resume','portrait','chapter-face']) {
   const p=await browser.newPage();await p.goto(base+'?probe='+sc);
   await p.waitForSelector('#probe-out',{state:'attached',timeout:60000});
   const r=JSON.parse(await p.locator('#probe-out').textContent());
   assert.deepEqual(r.fail,[],sc);assert.deepEqual(r.errors,[],sc);console.log('PASS '+sc+': '+r.pass.length);await p.close();
  }
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
