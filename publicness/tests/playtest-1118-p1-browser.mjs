// 2026-11-18 플레이테스트(pb-3.2.0) P1 — 화면 검사. 엔진·문장 쪽은 tests/playtest-1118-p1.test.mjs
//  p4  운행 HUD: 수지 줄이 #run-controls를 덮지 않음(top 오프셋 없음) · 6자리·음수에도 한 줄 · 소리 버튼은 선택 테두리 없음 — 1148×977 · 1280×800 · 390×844 × 계획·운행·일시정지
// 실행: PLAYWRIGHT_MODULE=… node publicness/tests/playtest-1118-p1-browser.mjs [p4,…]  (브라우저는 한 번에 하나) · 스크린샷 = publicness/tests/_shot-pt1118-*.png
import { createRequire } from 'node:module'; import assert from 'node:assert/strict'; import { startServer } from './serve.mjs';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'), server = await startServer(0);
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const base = `http://127.0.0.1:${server.address().port}/publicness/`, SHOT = process.env.SHOT_DIR || 'publicness/tests', shot = (n) => `${SHOT}/_shot-pt1118-${n}.png`;
const only = (process.argv[2] || 'p4').split(','), log = (m) => console.log('  ok ' + m);
const SOFT = process.env.PT1118_SOFT === '1', fails = [], check = (c, m) => { if (c) return; if (SOFT) { fails.push(m); console.log('  FAIL ' + m); } else assert.fail(m); };
const { PLAN: PLAN1111 } = require('./playtest-1111-plan.cjs');
async function begin(page) {
  page.setDefaultNavigationTimeout(120000);
  await page.goto(base + '?no3d=1', { waitUntil: 'domcontentloaded' }); await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#btn-start').click();
  while (await page.locator('#goal-intro').evaluate((d) => d.open)) { if (await page.locator('#goal-intro').getAttribute('data-stage') === 'true') await page.keyboard.press('Enter'); else await page.locator('#btn-goal-start').click(); }
}
const frames = (page, n = 3) => page.evaluate((n) => new Promise((ok) => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const layPhase1 = (page) => page.evaluate((P) => {
  const A = PB.App, S = PB.Session, s = A.s; s.tutorialSeen = true; S.beginPlan(s); s.draft.routes = []; s.draft.buses.forEach((b) => { b.routeNum = null; });
  P[0].forEach(([nodes, n], i) => { s.draft.routes.push({ num: i + 1, nodes: nodes.slice(), stops: nodes.map(() => true), autoPlaced: true }); for (let k = 0; k < n; k++) { const b = s.draft.buses.filter((x) => x.routeNum == null)[0]; if (b) b.routeNum = i + 1; } });
  A.enterPlan(); document.querySelectorAll('dialog[open]').forEach((d) => d.close());
}, PLAN1111);

/* 수지 줄·운행 조작·시계 자리. big = 6자리·음수 글자를 넣어 본 뒤 같은 자리에서 다시 잰다(다시 그리기 전, 같은 evaluate 안) */
const hud = (page, big) => page.evaluate((big) => {
  const box = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return b.width ? { top: Math.round(b.top * 10) / 10, bottom: Math.round(b.bottom * 10) / 10, left: Math.round(b.left), right: Math.round(b.right) } : null; };
  const p = document.querySelector('#minimal-profit');
  if (big && p) { const st = p.querySelector('strong'), ex = p.querySelector('.minimal-profit-expected'); if (st) st.textContent = big[0]; if (ex) ex.textContent = '예상 ' + big[1]; }
  const kids = p ? [...p.children].filter((c) => c.tagName !== 'UL' && c.getBoundingClientRect().width > 0).map((c) => c.getBoundingClientRect()) : [];
  const oneLine = kids.length < 2 || Math.max(...kids.map((k) => k.top)) - Math.min(...kids.map((k) => k.top)) < Math.min(...kids.map((k) => k.height));
  const snd = document.querySelector('#run-sound'), sp = document.querySelector('#run-controls [id^="speed-"][aria-pressed="true"]'), cs = (e) => e ? (({ boxShadow, backgroundColor, borderColor }) => ({ boxShadow, backgroundColor, borderColor }))(getComputedStyle(e)) : null;
  return { screen: document.body.dataset.screen, profit: box(p), controls: box(document.querySelector('#run-controls')), clock: box(document.querySelector('#map-clock')), pos: p && getComputedStyle(p).position, top: p && getComputedStyle(p).top, oneLine, text: p && p.innerText.replace(/\s+/g, ' ').trim().slice(0, 60),
    sound: snd ? { pressed: snd.getAttribute('aria-pressed'), style: cs(snd), icon: snd.innerHTML.length } : null, speedPressed: cs(sp), paused: !!document.querySelector('#run-controls.is-paused'), hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
}, big || null);
const xOverlap = (a, b) => a && b && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0;
function hudOk(h, label) {
  check(!!h.profit, label + ': 수지 줄 보임 ' + JSON.stringify(h));
  check(h.top === 'auto' || h.pos === 'static' || h.top === '0px', `${label}: 수지 줄에 위쪽 밀기 없음(top ${h.top}, ${h.pos})`);
  check(h.oneLine, `${label}: 수지 줄 한 줄 ${h.text}`);
  check(!h.hscroll, label + ': 가로 넘침 없음');
  if (h.controls && xOverlap(h.profit, h.controls) && h.controls.top >= h.profit.top) check(h.profit.bottom <= h.controls.top - 6 + 0.5, `${label}: 수지 줄 아래(${h.profit.bottom}) + 6px ≤ #run-controls 위(${h.controls.top})`);
  if (h.clock && h.profit && Math.min(h.clock.bottom, h.profit.bottom) - Math.max(h.clock.top, h.profit.top) > 4) check(h.profit.left - h.clock.right >= 8, `${label}: 시계와 같은 줄이면 둘 사이 8px 이상(${h.clock.right} → ${h.profit.left})`);
  if (h.controls && xOverlap(h.profit, h.controls) && h.controls.top < h.profit.top) check(h.controls.bottom <= h.profit.top, `${label}: 조작 줄이 위에 있으면 겹치지 않음`);
}
if (only.includes('p4')) {
  for (const [w, hgt] of [[1148, 977], [1280, 800], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width: w, height: hgt } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await begin(page); await layPhase1(page); await frames(page, 6); await page.waitForTimeout(700);
    const tag = `${w}x${hgt}`;
    let h = await hud(page); hudOk(h, tag + ' 계획'); log(`${tag} 계획: 수지 ${JSON.stringify(h.profit)} · ${h.text}`);
    h = await hud(page, ['+1,234,567', '−1,234,567']); hudOk(h, tag + ' 계획 6자리·음수');
    await page.screenshot({ path: shot(`p4-plan-${tag}`) });
    await page.locator('#btn-depart').click();
    await (async () => { if (await page.locator('#confirm-depart').evaluate((d) => d.open)) await page.locator('#confirm-yes').click(); })();
    await page.waitForFunction(() => document.body.dataset.screen === 'run' && PB.UI.runState() && PB.UI.runState().tf > 3, null, { timeout: 60000 });
    await page.waitForTimeout(600);
    h = await hud(page); hudOk(h, tag + ' 운행'); log(`${tag} 운행: 수지 ${JSON.stringify(h.profit)} · 조작 ${JSON.stringify(h.controls)} · ${h.text}`);
    check(/지금까지/.test(h.text) && /예상/.test(h.text), tag + ' 운행: 지금까지·예상 ' + h.text);
    check(h.sound && h.sound.pressed === 'true', tag + ' 소리 켜짐(aria-pressed)');
    check(h.sound && h.speedPressed && h.sound.style.boxShadow !== h.speedPressed.boxShadow, `${tag}: 소리 켜짐 버튼에 선택된 배속과 같은 테두리 없음 ${JSON.stringify(h.sound.style)} vs ${JSON.stringify(h.speedPressed)}`);
    check(h.sound && h.sound.style.boxShadow === 'none' && /rgba\(0, 0, 0, 0\)|transparent/.test(h.sound.style.backgroundColor), `${tag}: 소리 버튼은 누르지 않은 버튼 모양 ${JSON.stringify(h.sound && h.sound.style)}`);
    const big = await hud(page, ['+1,234,567', '−1,234,567']); hudOk(big, tag + ' 운행 6자리·음수');
    await page.screenshot({ path: shot(`p4-run-${tag}`) });
    await page.locator('#run-pause').click(); await page.waitForTimeout(400);
    h = await hud(page); hudOk(h, tag + ' 일시정지'); check(h.paused, tag + ' 일시정지 상태');
    check(h.sound && h.sound.style.boxShadow === 'none', `${tag} 일시정지: 소리 버튼 테두리 없음 ${JSON.stringify(h.sound && h.sound.style)}`);
    await page.screenshot({ path: shot(`p4-paused-${tag}`) });
    log(`${tag} 일시정지: 수지 ${JSON.stringify(h.profit)} · 조작 ${JSON.stringify(h.controls)}`);
    check(errors.length === 0, '페이지 오류 ' + errors.join(' | '));
    await page.close();
  }
  console.log(fails.length ? 'P1-4 FAIL ' + fails.length : 'P1-4 PASS');
}

/* p5 소외 지역 한 목록: 1단계 빨강 외곽 마을→병원→기차역→밀집 주거지→대학교(버스 1대) → 결과(엔진 정산) → ‘오래 기다린 사람부터’ → 2단계 계획 AI 패널 */
if (only.includes('p5')) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await begin(page);
  const info = await page.evaluate(() => { const A = PB.App, S = PB.Session, s = A.s; s.tutorialSeen = true; S.beginPlan(s); s.draft.routes = [{ num: 1, nodes: ['F', 'D', 'A', 'B', 'C'], stops: [1, 1, 1, 1, 1].map(Boolean), autoPlaced: true }, { num: 2, nodes: [], stops: [] }]; s.draft.buses.forEach((b) => { b.routeNum = null; }); s.draft.buses[0].routeNum = 1;
    S.startRun(s); S.finishRun(s); A.go('result'); return { names: PB.Advisor.targets(S.revealed(S.plannedNext(s), { allowNodes: S.visibleNodeIds(s) })).map(A.nodeName) }; /* = Session.underserved(결과 화면) */ });
  await page.locator('#result-ai-rows').waitFor({ state: 'attached', timeout: 90000 });
  await page.locator('#result-think .think-option[data-choice="longest"]').click(); await frames(page, 2);
  const r = await page.evaluate(() => { const li = document.querySelector('#result-ai-rows li[data-goal="reach"]'), s = PB.App.s, h = s.history[s.history.length - 1];
    return { think: document.querySelector('#think-underserved') && document.querySelector('#think-underserved').textContent, bridge: document.querySelector('#think-bridge') && document.querySelector('#think-bridge').textContent, reach: li && li.textContent, tag: li && !li.querySelector('.ai-picked-tag').hidden,
      targets: s.aiCards[h.phase].rows.find((x) => x.goal === 'reach').targets, pick: PB.Narrative.thinkFocus(s.config, h.phase, s.current.result.passengers, h.scores.mobility, {}).pick, summary: document.querySelector('#result-ai-summary').textContent }; });
  const names = info.names.join('·');
  check(r.think && r.think.indexOf(names) >= 0, `다음 운행 목표에 소외 지역 ${names} ${JSON.stringify(r.think)}`);
  check(r.reach && r.reach.indexOf('다음 단계 ‘소외 지역’(' + names + ')') >= 0, `AI라면? 소외 지역 줄이 같은 이름 ${r.reach}`);
  check(!r.targets.includes(r.pick), '재현 조건: 살펴볼 곳이 소외 지역 제안 대상에 없음 ' + JSON.stringify(r));
  check(r.tag === false, `‘내 목표와 가까운 기준’은 살펴볼 곳(${r.pick})을 다루지 않는 소외 지역 제안에 붙지 않음 ${JSON.stringify(r)}`);
  log('결과 1단계: ' + r.think + ' / ' + r.reach.slice(0, 80) + ' · 표시 ' + r.tag);
  await page.screenshot({ path: shot('p5-result1-1280') });
  await page.evaluate(() => { const A = PB.App, S = PB.Session; S.nextPhase(A.s); A.enterPlan(); document.querySelectorAll('dialog[open]').forEach((d) => d.close()); });
  await page.locator('#plan-ai-toggle').click(); await page.locator('#goal-reach').click(); await page.locator('#rec-card').waitFor({ timeout: 60000 });
  const crit = await page.locator('#rec-criterion').innerText();
  check(crit.indexOf(names) >= 0, `2단계 AI 패널 소외 지역이 같은 이름 ${crit}`);
  check(!/[가-힣]이이에요|교이에요|리이에요/.test(crit), '조사: ' + crit);
  log('2단계 AI 패널: ' + crit);
  check(errors.length === 0, '페이지 오류 ' + errors.join(' | '));
  await page.close();
  console.log(fails.length ? 'P1-5 FAIL' : 'P1-5 PASS');
}

/* p6 AI라면? 숫자: 2단계(무난한 노선 + 빌린 버스 한 대를 주황에) 결과 — 화살표 앞 숫자의 뜻 + 빌린 버스 반납 반영 / 1단계(빌리지 않음)는 덧붙임 없음 */
const toResult = (page, phase, lease) => page.evaluate(([P, phase, lease]) => {
  const A = PB.App, S = PB.Session, s = A.s; s.tutorialSeen = true;
  const lay = (plan) => { S.beginPlan(s); s.draft.routes = []; s.draft.buses.forEach((b) => { b.routeNum = null; }); plan.forEach(([nodes, n], i) => { s.draft.routes.push({ num: i + 1, nodes: nodes.slice(), stops: nodes.map(() => true), autoPlaced: true }); for (let k = 0; k < n; k++) { const b = s.draft.buses.filter((x) => x.routeNum == null && !x.leased)[0]; if (b) b.routeNum = i + 1; } }); };
  for (;;) { lay(P[s.phase - 1]); if (s.phase === phase && lease) { const b = S.lease(s); b.routeNum = 3; } if (s.phase === 3) PB.Choices.set(s, 'petition', 'choice', 'reflect'); if (s.phase === 4) PB.Choices.set(s, 'elder', 'choice', 'keep'); S.startRun(s); S.finishRun(s); if (s.phase >= phase) break; S.nextPhase(s); }
  A.go('result'); return { phase: s.phase, rate: s.history[s.history.length - 1].metrics.arrivalRate };
}, [PLAN1111, phase, lease]);
const aiRows = (page) => page.evaluate(() => [...document.querySelectorAll('#result-ai-rows li')].map((li) => li.textContent));
if (only.includes('p6')) {
  for (const [phase, lease] of [[2, true], [1, false]]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await begin(page); const info = await toResult(page, phase, lease);
    await page.locator('#result-ai-rows').waitFor({ state: 'attached', timeout: 90000 });
    const rows = await aiRows(page), sum = await page.locator('#result-ai-summary').innerText();
    rows.concat([sum]).forEach((t) => check(/다음 단계에 지금 노선을 그대로 두면(\(빌린 버스 반납 반영\))? 도착률 \d+% → AI 제안 \d+%/.test(t), `${phase}단계: 화살표 앞 숫자의 뜻 ${t}`));
    rows.forEach((t) => check(lease === /\(빌린 버스 반납 반영\)/.test(t), `${phase}단계: 빌린 버스 반납 반영 ${lease ? '있음' : '없음'} ${t}`));
    log(`${phase}단계(이번 도착률 ${Math.round(info.rate * 100)}%): ${sum}`);
    if (lease) await page.locator('#result-ai').screenshot({ path: shot('p6-ai-2') }).catch(() => {});
    check(errors.length === 0, '페이지 오류 ' + errors.join(' | '));
    await page.close();
  }
  console.log(fails.length ? 'P1-6 FAIL' : 'P1-6 PASS');
}

await browser.close(); server.close();
if (fails.length) process.exitCode = 1;
