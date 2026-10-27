// 노선 철거: 지도에서 노선 선을 두 번 누르면(마우스 더블클릭·터치 두 번 탭) 노선 삭제, 버스는 대기로, 되돌리기 한 번으로 복구.
// 한 번 클릭·느린 두 번 클릭·정류장 더블클릭·AI 미리보기에서는 철거하지 않는다. 2D·3D
import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {startServer} from './serve.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),server=await startServer(0);
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const base=`http://127.0.0.1:${server.address().port}/publicness/`;
// 노선 num 첫 구간의 f 지점(차선 반영) — ‘버스 ×N’ 표시와 겹치지 않게 f를 고른다
const linePoint=(p,num,f)=>p.evaluate(([num,f])=>{const A=PB.App,v=A.view,r=PB.Session.routeByNum(A.s,num),a=A.nodeXY(r.nodes[0]),b=A.nodeXY(r.nodes[1]),o=v.laneOffset(r.nodes[0],r.nodes[1],num),
 P=v.project(a.x+o.dx/110,a.y+o.dy/110),Q=v.project(b.x+o.dx/110,b.y+o.dy/110),box=document.querySelector('#stage').getBoundingClientRect();
 // 정류장 선택 반경(정류장이 우선)·표시·인물에 걸리지 않게, 선 위에서 정류장들과 가장 먼 점을 고른다
 const stops=PB.Session.graph(A.s).nodes.map(id=>{const n=A.nodeXY(id),q=v.project(n.x,n.y);return {x:box.left+q.left,y:box.top+q.top};});let best=null,score=-1;
 for(let g=.1;g<=.9;g+=.05){const x=box.left+P.left+(Q.left-P.left)*g,y=box.top+P.top+(Q.top-P.top)*g,hit=document.elementFromPoint(x,y);if(!hit||hit.closest('.route-bus,.map-person'))continue;const m=Math.min(...stops.map(s=>Math.hypot(s.x-x,s.y-y)));if(m>score){score=m;best={x,y};}}
 return best;},[num,f]);
const routes=p=>p.evaluate(()=>PB.App.s.draft.routes.filter(r=>r.nodes.length).map(r=>r.num));
const buses=p=>p.evaluate(()=>PB.App.s.draft.buses.map(b=>b.routeNum));
try{for(const view of (process.env.VIEWS||'2d,3d').split(',')){
 const page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+(view==='2d'?'?no3d=1':''));
 await page.evaluate(()=>{localStorage.clear();PB.App.startGame();PB.Session.beginPlan(PB.App.s);PB.App.go('plan');PB.App.onNodeClick('F');PB.App.onNodeClick('D');});
 assert.deepEqual(await routes(page),[1]);assert.deepEqual(await buses(page),[1,null]);
 let pt=await linePoint(page,1,.3);
 // 한 번 클릭 → 편집 선택만, 느린 두 번(0.7초 간격) → 철거 안 함
 await page.mouse.click(pt.x,pt.y);await page.waitForTimeout(700);await page.mouse.click(pt.x,pt.y);await page.waitForTimeout(150);
 assert.deepEqual(await routes(page),[1],'한 번·느린 두 번 클릭은 철거 아님');
 // 정류장 더블클릭은 노선 철거가 아니다
 const F=await page.evaluate(()=>{const A=PB.App,n=A.nodeXY('F'),q=A.view.project(n.x,n.y),b=document.querySelector('#stage').getBoundingClientRect();return {x:b.left+q.left,y:b.top+q.top};});
 await page.waitForTimeout(500);await page.mouse.dblclick(F.x,F.y);await page.waitForTimeout(150);assert.deepEqual(await routes(page),[1],'정류장 더블클릭은 철거 아님');
 // 더블클릭 → 철거, 버스 대기로, 대기 숫자·표시 갱신
 await page.waitForTimeout(500);pt=await linePoint(page,1,.3);await page.mouse.dblclick(pt.x,pt.y);await page.waitForTimeout(200);
 assert.deepEqual(await routes(page),[],view+' 더블클릭으로 철거');assert.deepEqual(await buses(page),[null,null],'버스는 대기로(보유 대수 그대로)');
 assert.equal(await page.evaluate(()=>PB.App.s.draft.buses.length),2);assert.match(await page.locator('#depot-count').innerText(),/^2대$/);
 assert.equal(await page.locator('#route-bus-1').count(),0);
 assert.match(await page.locator('#map-plan-message').innerText(),/1번 노선을 철거했어요 · 1호차는 대기로\. 잘못 지웠다면 ↶ 되돌리기/);
 // 되돌리기 한 번 → 노선·버스 모두 복구
 await page.locator('#btn-undo').click();assert.deepEqual(await routes(page),[1]);assert.deepEqual(await buses(page),[1,null],'되돌리기로 노선과 배치 복구');
 // 터치 두 번 탭(합성 pointerType touch)
 await page.waitForTimeout(500);pt=await linePoint(page,1,.3);
 await page.evaluate(({x,y})=>{const o={pointerId:5,pointerType:'touch',isPrimary:true,bubbles:true,cancelable:true,button:0,clientX:x,clientY:y};
  for(let i=0;i<2;i++){const t=document.elementFromPoint(x,y);t.dispatchEvent(new PointerEvent('pointerdown',o));document.elementFromPoint(x,y).dispatchEvent(new PointerEvent('pointerup',o));}},pt);await page.waitForTimeout(200);
 assert.deepEqual(await routes(page),[],view+' 두 번 탭으로 철거');
 await page.locator('#btn-undo').click();assert.deepEqual(await routes(page),[1]);
 // AI 미리보기 중에는 철거하지 않는다
 await page.locator('#plan-ai-toggle').click();await page.locator('#goal-time').click();await page.locator('#rec-card').waitFor();await page.locator('#plan-ai-toggle').click();
 await page.waitForTimeout(500);const before=await page.evaluate(()=>JSON.stringify(PB.App.s.draft));pt=await linePoint(page,1,.3);
 if(pt){await page.mouse.dblclick(pt.x,pt.y);await page.waitForTimeout(150);}
 assert.equal(await page.evaluate(()=>JSON.stringify(PB.App.s.draft)),before,'미리보기 중 초안 그대로');
 assert.deepEqual(errors,[]);await page.close();console.log('PASS route-demolish',view);
}}finally{await browser.close();server.close();}
