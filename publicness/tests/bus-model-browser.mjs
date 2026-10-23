// 3D 운행에서 버스가 fal.ai 모델(assets/models/bus.js)로 그려지고, 버스마다 노선 색 재질을 쓰는지
import {plannedTown,beginPlan} from './browser-fixture.mjs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {startServer} from './serve.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=await startServer(0);let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/publicness/`);
  await page.locator('#btn-start').click();await page.locator('#btn-goal-start').click();if(await page.locator('#learning-dialog:modal').count())await page.locator('#btn-learning-continue').click();await beginPlan(page);await plannedTown(page);
  await page.locator('#btn-depart').click();await page.locator('#confirm-yes').click();
  await page.waitForFunction(()=>PB.App.view.busInfo&&PB.App.view.busInfo().length>=2,{},{timeout:20000});
  const info=await page.evaluate(()=>{const s=PB.App.s,want={};s.current.plan.buses.forEach(b=>{if(b.route)want[b.id]=PB.App.routeStyle(PB.App.numForPlanRoute(b.route)).color;});return{buses:PB.App.view.busInfo(),want};});
  assert.ok(info.buses.every(b=>b.model),'모든 버스가 모델: '+JSON.stringify(info.buses));
  info.buses.forEach(b=>assert.equal(b.color,info.want[b.id],b.id+'호차 노선 색'));
  assert.equal(await page.locator('.bus-num').evaluateAll(ls=>ls.filter(l=>/호차/.test(l.textContent)).length),0,'버스 위 호차 이름표 없음');
  assert.deepEqual(errors,[]);
  console.log('PASS 3d: bus model on every bus, route-color material, no name tag ('+info.buses.length+' buses)');
}finally{await browser?.close();server.close();}
