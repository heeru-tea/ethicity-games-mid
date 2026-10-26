import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {startServer} from './serve.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),server=await startServer(0),browser=await chromium.launch({channel:'msedge',headless:true});
try{const page=await browser.newPage();page.on('pageerror',e=>console.log('PAGE ERROR',e.stack));await page.goto(`http://127.0.0.1:${server.address().port}/publicness/?no3d=1`);
 await page.evaluate(()=>{PB.App.startGame();const s=PB.App.s;s.phase=3;s.owned=4;s.draft.buses=[1,2,3,4].map(id=>({id,routeNum:id===1?1:null,offset:0}));PB.Session.beginPlan(s);PB.Session.updateRoute(s,1,{nodes:['A','B'],stops:[true,true]});PB.Session.updateRoute(s,2,{nodes:['F','D'],stops:[true,true]});PB.Session.startRun(s);PB.App.go('run');});
 assert.equal(await page.locator('#run-skip').count(),1,'run can be skipped');
 await page.locator('#run-skip').click();await page.locator('#emergency-dialog[open]').waitFor();
 assert.equal(await page.evaluate(()=>PB.App.s.runCursor),34);
 await page.locator('#emergency-bus').selectOption('2');await page.locator('#emergency-route').selectOption('2');await page.locator('#emergency-apply').click();
 assert.equal(await page.evaluate(()=>PB.App.s.emergencyLog.length),1);
 await page.locator('#run-skip').click();await page.locator('#emergency-dialog[open]').waitFor();assert.equal(await page.evaluate(()=>PB.App.s.runCursor),67);
 await page.reload();await page.locator('#btn-continue').click();await page.locator('#emergency-dialog[open]').waitFor();
 assert.equal(await page.evaluate(()=>PB.App.s.emergencyLog.length),1);
 await page.locator('#emergency-continue').click();await page.locator('#run-skip').click();await page.locator('#resident-day-results').waitFor();
 assert.equal(await page.evaluate(()=>PB.App.s.history.length),1);assert.equal(await page.evaluate(()=>PB.App.s.emergencyLog.length),2);
 assert.ok(await page.locator('#emergency-report').isVisible());console.log('PASS: skip stops twice, one change, saved checkpoint resumes, settlement once');
}finally{await browser.close();server.close();}
