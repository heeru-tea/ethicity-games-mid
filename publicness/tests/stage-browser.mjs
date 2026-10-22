import {beginPlan} from './browser-fixture.mjs';
// Stage card: phase 1 after the character intro (over the map), later phases before Sol / Yuna·Daeun cuts; no skip text; key, click or timer moves on.
import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {startServer} from './serve.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),server=await startServer(0);let browser;
const url=q=>`http://127.0.0.1:${server.address().port}/publicness/?no3d=1${q||''}`;
async function card(page,title,sub){
 await page.locator('#goal-intro[data-stage="true"]').waitFor();
 assert.equal(await page.locator('#story-stage-title').textContent(),title);assert.equal(await page.locator('#story-stage-sub').textContent(),sub);
 assert.ok(await page.locator('#story-stage-title').isVisible());assert.ok(!await page.locator('#btn-goal-start').isVisible());assert.ok(!await page.locator('#story-next').isVisible());
 assert.equal(await page.locator('#goal-intro').evaluate(d=>getComputedStyle(d,'::backdrop').backgroundColor),'rgba(0, 0, 0, 0.78)');
}
async function playPhase(page){
 if(await page.locator('#learning-dialog:modal').count())await page.locator('#btn-learning-continue').click();await beginPlan(page);
 await page.evaluate(()=>{const s=PB.App.s,S=PB.Session,paths=[['F','C','D','A'],['B','A','G','E'],['H','A','D'],['I','A']];for(const r of s.draft.routes){const n=paths[r.num-1].filter(x=>S.graph(s).has(x));S.updateRoute(s,r.num,{nodes:n,stops:n.map(()=>true)});}s.draft.buses.forEach(b=>{if(b.routeNum==null)S.assign(s,b.id,1);});PB.App.render();});
 await page.locator('#btn-depart').click();await page.locator('#confirm-yes').click();await page.locator('#resident-summary').waitFor({timeout:60000});
 await page.locator('#btn-route-report-close').click();await page.locator('#btn-next-phase').click();
}
try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url());await page.locator('#btn-start').click();
 // intro first (title screen behind), then Stage 1 over the reveal map
 assert.equal(await page.locator('#goal-intro').getAttribute('data-stage'),'false');assert.equal(await page.locator('#goal-intro-h').textContent(),'하늘');
 assert.equal(await page.locator('#story-count').textContent(),'1 / 4');assert.equal(await page.locator('body').getAttribute('data-screen'),'title');await page.locator('#btn-goal-start').click();
 await card(page,'Stage 1','학기 초 · 1 / 5');assert.equal(await page.locator('body').getAttribute('data-screen'),'reveal');assert.equal(await page.evaluate(()=>PB.App.s.phase),1);
 await page.waitForTimeout(450);await page.screenshot({path:'publicness/tests/_shot-stage-1366.png'});
 // timer alone closes the card and the phase-1 learning dialog opens
 await page.locator('#learning-dialog:modal').waitFor({timeout:4000});assert.equal(await page.locator('#goal-intro').evaluate(d=>d.open),false);
 await page.evaluate(()=>window.__pbFast=true);
 // phase 2: card only, any key closes it and the phase opens
 await playPhase(page);await card(page,'Stage 2','적응기 · 2 / 5');assert.equal(await page.evaluate(()=>PB.App.s.phase),1);
 await page.keyboard.press('x');assert.equal(await page.locator('#goal-intro').evaluate(d=>d.open),false);
 await page.locator('#btn-begin-plan').waitFor();assert.equal(await page.evaluate(()=>PB.App.s.phase),2);
 // phase 3: card first, click → Sol
 await playPhase(page);await card(page,'Stage 3','변화기 · 3 / 5');await page.locator('#story-stage').click();
 assert.equal(await page.locator('#goal-intro').getAttribute('data-stage'),'false');assert.equal(await page.locator('#goal-intro-h').textContent(),'솔');
 assert.equal(await page.locator('#goal-intro').getAttribute('aria-labelledby'),'goal-intro-h');await page.locator('#btn-goal-start').click();
 // phase 4: card first, Escape → Yuna (does not skip the cut)
 await playPhase(page);await card(page,'Stage 4','조정기 · 4 / 5');await page.keyboard.press('Escape');
 assert.ok(await page.locator('#goal-intro').evaluate(d=>d.open));assert.match(await page.locator('#goal-intro-h').textContent(),/유나/);await page.locator('#btn-goal-start').click();
 // phase 5: card closes on its own
 await playPhase(page);await card(page,'Stage 5','학기 말 · 5 / 5');await page.locator('#btn-begin-plan').waitFor({timeout:4000});
 assert.equal(await page.locator('#goal-intro').evaluate(d=>d.open),false);
 // ending: no stage card
 await playPhase(page);await page.locator('#goal-intro[open]').waitFor();
 assert.equal(await page.locator('#goal-intro').getAttribute('data-scene'),'ending');assert.equal(await page.locator('#goal-intro').getAttribute('data-stage'),'false');
 assert.deepEqual(errors,[]);await page.close();
 // random challenge: 8 phases, reduced motion has no fade; phone width
 const r=await browser.newPage({viewport:{width:375,height:812}});
 await r.goto(url());await r.evaluate(()=>{PB.App.motion=true;});await r.locator('input[name=setting][value=random]').check();await r.locator('#btn-start').click();await r.locator('#btn-goal-start').click();
 await card(r,'Stage 1','학기 초 · 1 / 8');assert.equal(await r.locator('#story-stage').evaluate(n=>getComputedStyle(n).animationName),'none');
 const box=await r.locator('#story-stage-title').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=375);
 await r.screenshot({path:'publicness/tests/_shot-stage-375.png'});await r.keyboard.press('Enter');await r.locator('#learning-dialog:modal').waitFor({timeout:4000});
 await r.close();
 const f=await browser.newPage({viewport:{width:1366,height:900}});await f.goto(url('&seed=9'));await f.locator('#btn-start').click();await f.locator('#btn-goal-start').click();await card(f,'Stage 1','학기 초 · 1 / 8');await f.close();
 console.log('PASS stage card: phase 1 after intro over the map, 2-5 before Sol/Yuna cuts, key/click/Escape/timer, no skip text, no card before ending, random/seed 8 phases, reduced motion, phone');
}finally{if(browser)await browser.close();server.close();}
