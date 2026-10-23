// 2026-10-23 모드별 재정 실패·재시도(헤드리스 Edge, 2D 지도). 회차 수지는 출발 직후 시험값으로 바꿔 판정만 본다(경제 수치는 그대로).
// 랜덤(지정 세팅 7): 규칙 안내 → 누적 적자 1/3·2/3 경고(결과 화면 본문) → 새로고침 뒤에도 같은 횟수 → 3회째 결과 뒤 ‘적자 누적으로 운영 계약 종료’
//   → 종료 화면 새로고침 복구 → 같은 조건으로 재도전(같은 세팅·사건, 상태 초기화) / 새 랜덤 게임
// 기본: 잔액이 낮을 때 ‘학기 말 평가’ 안내 → 학기 말 잔액 < 0이면 파산 엔딩(인물 결과 유지) → 같은 시나리오로 다시 시작
import {beginPlan} from './browser-fixture.mjs';
import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {startServer} from './serve.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),server=await startServer(0);let browser;
const base=`http://127.0.0.1:${server.address().port}/publicness/?no3d=1`;
async function closeStory(page){for(let i=0;i<20&&await page.locator('#goal-intro').evaluate(d=>d.open);i++){await page.keyboard.press('Escape');await page.waitForTimeout(50);}}
// 버스를 쉬게 둔 채 출발 → 정산 전에 회차 수지를 시험값으로
// 정산(finishRun) 직전에 끼어들어 시험값을 넣는다 — 재생이 빨리 끝나도 경쟁 없이(새로고침하면 다시 건다)
async function runPhase(page,total){
  await page.evaluate(t=>{window.__pbFast=true;PB.App.setSpeed(4);window.__forceTotal=t;const S=PB.Session;
    if(!S.__forced){const orig=S.finishRun;S.finishRun=function(s){if(window.__forceTotal!=null&&s.current){s.current.metrics.costs.total=window.__forceTotal;window.__forceTotal=null;}return orig(s);};S.__forced=true;}},total);
  await page.locator('#btn-depart').click();await page.locator('#confirm-yes').click();
  try{await page.locator('#resident-summary').waitFor({timeout:90000});}catch(e){await page.screenshot({path:'publicness/tests/_shot-failure-debug.png'});throw e;}
}
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const ctx=await browser.newContext({viewport:{width:1366,height:900}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'&seed=7');
  assert.match(await page.locator('label.radio').nth(1).innerText(),/적자가 누적 3번이면 운영 계약이 끝나요/);
  await page.locator('#btn-start').click();await page.locator('#btn-goal-start').click();
  assert.match(await page.locator('#phase-changes').innerText(),/재정 규칙[\s\S]*누적 3번이면 잔액이 남아 있어도 운영 계약이 종료돼요/);
  assert.equal(await page.locator('#top-deficit').innerText(),'누적 적자 0/3회');
  const startEvents=await page.evaluate(()=>JSON.stringify(PB.App.s.events));
  await beginPlan(page);await runPhase(page,-10);
  assert.match(await page.locator('#finance-status').innerText(),/적자예요[\s\S]*누적 적자 1\/3회/);
  assert.equal(await page.locator('#top-deficit').innerText(),'누적 적자 1/3회');
  await page.locator('#btn-next-phase').click();await beginPlan(page);await runPhase(page,5000);
  assert.equal(await page.locator('#finance-status').count(),0,'흑자 단계엔 알림 없음(1/3 유지)');
  assert.equal(await page.locator('#top-deficit').innerText(),'누적 적자 1/3회');
  await page.evaluate(()=>{PB.Session.nextPhase(PB.App.s);PB.App.go('reveal');}); // 2단계 뒤 인물 소개 컷은 건너뜀
  await beginPlan(page);await runPhase(page,-10);
  assert.match(await page.locator('#finance-status').innerText(),/누적 적자 2\/3회 — 한 번 더 적자가 발생하면 운영 계약이 종료됩니다/);
  assert.equal(await page.locator('[role=dialog]:modal, dialog:modal').count(),0,'경고는 새 창 없이 결과 화면에');
  // 결과 화면 새로고침 → 이어하기: 같은 횟수·같은 정산(중복 집계 없음)
  const snap=()=>page.evaluate(()=>JSON.stringify({l:PB.App.s.ledger,d:PB.App.s.deficits,h:PB.App.s.history.length}));
  const before=await snap();await page.reload();await page.locator('#btn-continue').click();await page.locator('#resident-summary').waitFor();
  assert.equal(await snap(),before);assert.equal(await page.locator('#top-deficit').innerText(),'누적 적자 2/3회');
  await page.locator('#btn-next-phase').click();await beginPlan(page);await runPhase(page,-10);
  assert.match(await page.locator('#finance-status').innerText(),/누적 적자 3\/3회 — 적자 누적으로 운영 계약이 종료돼요/);
  assert.equal(await page.locator('#btn-next-phase').innerText(),'운영 종료 화면 보기');
  await page.locator("#btn-next-phase").click();await page.locator("#ending-title").waitFor();await closeStory(page);
  assert.equal(await page.locator('#ending-title').innerText(),'적자 누적으로 운영 계약 종료');
  assert.equal(await page.locator('#failure-ledger tbody tr').count(),4);
  assert.match(await page.locator('#failure-report').innerText(),/적자 단계: 1·3·4단계 \(누적 3\/3회\)/);
  assert.match(await page.locator('#failure-cause').innerText(),/보유 잔액 −?[\d,]+원이 남아 있어도 적자 횟수로 판정/);
  const tips=await page.locator('#failure-tips li').count();assert.ok(tips>=1&&tips<=3,'제안 1~3개 '+tips);
  assert.match(await page.locator('#failure-report').innerText(),/외곽 노선을 없애는 것만이 답은 아니에요/);
  assert.ok(await page.locator('.resident-card').count()>0,'인물 결과도 함께');
  await page.screenshot({path:'publicness/tests/_shot-failure-contract.png',fullPage:false});
  // 종료 화면 새로고침 → 이어하기에 종료 원인 표시, 같은 종료 화면
  await page.reload();assert.match(await page.locator('#continue-note').innerText(),/적자 누적으로 운영 계약 종료/);
  await page.locator('#btn-continue').click();await closeStory(page);assert.equal(await page.locator('#ending-title').innerText(),'적자 누적으로 운영 계약 종료');
  assert.equal(await page.evaluate(()=>PB.App.s.history.length),4);
  // 같은 조건으로 재도전: 세팅·사건 그대로, 진행 상태는 처음부터
  const seed=await page.evaluate(()=>PB.App.s.seed);
  await page.locator('#btn-retry-same').click();await page.locator('#phase-changes').waitFor();
  const st=await page.evaluate(()=>{const s=PB.App.s;return {seed:s.seed,mode:s.mode,phase:s.phase,stage:s.stage,h:s.history.length,l:s.ledger.length,d:s.deficits,end:s.end,events:JSON.stringify(s.events)};});
  assert.deepEqual(st,{seed,mode:'fixed',phase:1,stage:'reveal',h:0,l:0,d:0,end:null,events:startEvents});
  assert.equal(await page.locator('#top-deficit').innerText(),'누적 적자 0/3회');
  // 새 랜덤 게임은 다른 세팅
  await page.evaluate(()=>{PB.App.s.end={cause:'contract',phase:1,balance:0};PB.App.s.stage='ending';PB.App.go('ending');});await closeStory(page);
  await page.locator('#btn-retry-new').click();await page.locator('#phase-changes').waitFor();
  assert.deepEqual(await page.evaluate(()=>[PB.App.s.mode,PB.App.s.history.length,PB.App.s.deficits]),['random',0,0]);
  assert.notEqual(await page.evaluate(()=>PB.App.s.seed),seed);
  await ctx.close();

  // 기본 모드
  const c2=await browser.newContext({viewport:{width:1366,height:900}}),p2=await c2.newPage();p2.on('pageerror',e=>errors.push(e.message));
  await p2.goto(base);await p2.locator('#btn-start').click();await p2.locator('#btn-goal-start').click();
  assert.match(await p2.locator('#phase-changes').innerText(),/재정 규칙[\s\S]*마지막 단계가 끝난 뒤 누적 잔액이 0원 미만이면 파산/);
  assert.ok(await p2.locator('#top-deficit').isHidden(),'기본 모드엔 적자 횟수 표시 없음');
  await beginPlan(p2);await runPhase(p2,-50000);
  assert.match(await p2.locator('#finance-status').innerText(),/기본 모드는 재정을 학기 말에 평가해요/);
  assert.equal(await p2.locator('#btn-next-phase').innerText(),'2단계로','마이너스여도 다음 단계로');
  // 나머지 단계는 시험 상태로 빠르게: 학기 말 잔액 < 0 → 파산 엔딩
  await p2.evaluate(()=>{const S=PB.Session,s=PB.App.s;S.nextPhase(s);
    while(s.stage!=='ending'){S.beginPlan(s);S.startRun(s);s.current.metrics.costs.total=-1000;S.finishRun(s);S.nextPhase(s);}PB.App.go('ending');});
  await closeStory(p2);
  assert.equal(await p2.locator('#ending-title').innerText(),'파산 — 학기 말 잔액이 0원 미만이에요');
  assert.match(await p2.locator('#ending-verdict').innerText(),/주요 인물 \d명 중 \d명이 만족했지만/);
  assert.equal(await p2.locator('#failure-ledger tbody tr').count(),5);assert.equal(await p2.locator('#failure-ledger thead th').count(),5,'기본 모드는 적자 횟수 열 없음');
  assert.match(await p2.locator('#ending-profit').innerText(),/보유 잔액 −54,000원/);
  assert.ok(await p2.locator('.resident-card').count()>0);assert.equal(await p2.locator('#btn-retry-new').count(),0);
  await p2.screenshot({path:'publicness/tests/_shot-failure-bankrupt.png'});
  await p2.locator('#btn-retry-same').click();await p2.locator('#phase-changes').waitFor();
  assert.deepEqual(await p2.evaluate(()=>[PB.App.s.mode,PB.App.s.seed,PB.App.s.phase,PB.App.s.history.length,PB.App.s.end]),['default',PB_DEFAULT_SEED(),1,0,null].map(x=>x));
  assert.deepEqual(errors,[]);await c2.close();
  console.log('PASS random: rule shown, 1/3·2/3 warnings in result body, reload keeps count, 3rd deficit → contract ending w/ ledger·tips·residents, ending reload, same-condition retry resets & reproduces events, new random; default: low-balance note, continues below zero, bankrupt ending with residents, same-scenario retry');
}finally{if(browser)await browser.close();server.close();}
function PB_DEFAULT_SEED(){return require('../js/config.js').defaultSeed;}
