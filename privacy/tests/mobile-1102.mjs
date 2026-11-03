// 2026-11-02 모바일 조작 회귀 검사: node privacy/tests/mobile-1102.mjs  (PLAYWRIGHT_PATH = playwright 모듈 경로, 기본 token_economy)
//   (a) 휴대폰 세로 360×740·390×844·가로 740×360: D-4 아침 내 방에서 조이스틱만으로(터치 끌기) 출구 매트 → 마을 길. 8방향·빠르게 포함
//   (b) 프롤로그 → 에필로그 모든 걷기 구간(대표 경로 A): 조이스틱을 한 칸씩 밀어 목적지 옆까지 걸어가 말 걸기 → 엔진 E.advance와 같은 장면
//   (c) 조이스틱 받침이 주인공·출구 칸을 가리지 않음   (d) 이름표 ↔ 목적지 핀·? 말풍선 겹침 없음
//   (e) '목적지로 바로 가기': 일반 플레이 숨김(눌러도 안 됨) · ?debug=1 보임(교사용) + 말 걸기 버튼이 줄 전체
//   (f) PC 1280×800: 조이스틱·설정 없음, 키보드 이동·카메라 배치 그대로 · 문 매트 탭/조사 버튼으로도 나가기
//   (g) 모바일 터치 지시서(2026-11-02 밤): 360×780·412×915·780×360·915×412에서 문 지나기 5가지·핀만으로 교실까지·? 탭·회전·메뉴 → 시나리오×화면 표
// ONLY=a,b,... 로 일부만. 스크린샷은 tests/_shot-mobile-1102-*.png(gitignore).
// 터치는 CDP Input.dispatchTouchEvent(실제 터치 → pointer 이벤트)로 넣는다 — 순간이동(바로 가기·debug.place) 쓰지 않음.
import { createRequire } from 'node:module'; import assert from 'node:assert/strict'; import { startServer } from './serve.mjs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js'), ROUTES = require('./routes.js');
story.triggers = WORLD.triggers;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ONLY = (process.env.ONLY || 'a,b,c,d,e,f,g').split(',');
const shot = (name) => path.join(HERE, `_shot-mobile-1102-${name}.png`);

const PHONES = {
  p360: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  p390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  l740: { viewport: { width: 740, height: 360 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
};
const DESKTOP = { viewport: { width: 1280, height: 800 } };

function firstMap() {
  let s = E.createState(story);
  for (let i = 0; i < 50 && !(s.screen === 'map' && s.mapTarget === 'pro_1'); i++) s = E.advance(story, s);
  assert.equal(s.mapTarget, 'pro_1');
  return s;
}

// 장면(선택지) 상태: 대표 탐색으로 그 장면에 닿은 진행
function makeRunScene(target) {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let tries = 0; tries < 2000; tries++) {
    let s = E.createState(story);
    for (let step = 0; step < 500 && s.screen !== 'ending'; step++) {
      if (s.screen === 'scene' && s.scene === target && !s.reaction) { s.history = s.history.slice(-1); return s; }
      if (s.screen === 'scene' && E.needsChoice(story, s)) { const cs = E.visibleChoices(story, story.scenes[s.scene], s); s = E.choose(story, s, cs[Math.floor(rnd() * cs.length)].id); s.history = []; }
      s = E.advance(story, s);
    }
  }
  throw new Error('경로 없음 ' + target);
}
const page_choices = (p) => p.evaluate(() => document.querySelectorAll('#g-dock .choice').length > 0);

const server = await startServer(0), base = `http://127.0.0.1:${server.address().port}/privacy/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗ ' + m); } };

async function open(run, dev, query = '') {
  const ctx = await browser.newContext(dev);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((p) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('ethicity.player', '{"character":"char_03","nickname":"반짝이는 고래"}');
    localStorage.setItem('ethicity.privacy.settings.v1', '{"speed":"instant","reduceMotion":true,"look":"f"}');
    localStorage.setItem('ethicity.privacy.progress.v2', p);
  }, JSON.stringify({ v: 1, run, explored: {}, endingsSeen: [] }));
  await page.goto(base + query);
  await page.click('#btn-continue');
  await page.waitForTimeout(1200);
  page.errors = errors; page.ctx = ctx;
  page.cdp = dev.hasTouch ? await ctx.newCDPSession(page) : null;
  return page;
}
const close = (page) => page.ctx.close();
const me = (page) => page.evaluate(() => PrivacyMap.debug.me());
const view = (page) => page.evaluate(() => document.body.getAttribute('data-view'));
async function waitFor(page, fn, arg, ms = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await page.waitForTimeout(15); }
  return false;
}
const touch = (page, type, x, y) => page.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
// 조이스틱 받침 기본 자리 가운데(화면 좌표)
const joyCenter = (page) => page.evaluate(() => {
  const j = PrivacyMap.debug.joy(), r = document.getElementById('m-canvas').getBoundingClientRect();
  return j.shown && j.rest ? { x: r.left + (j.rest.x0 + j.rest.x1) / 2, y: r.top + (j.rest.y0 + j.rest.y1) / 2 } : null;
});
// 조이스틱으로 한 칸: 받침을 누르고 그쪽으로 60% 밀었다가 걷기 시작하면 뗀다(뗀 뒤 그 칸까지만 걷고 선다)
async function joyStep(page, dir) {
  const c = await joyCenter(page), before = await me(page);
  if (!c) return false;
  await touch(page, 'touchStart', c.x, c.y);
  await touch(page, 'touchMove', c.x + VEC[dir][0] * 31, c.y + VEC[dir][1] * 31);
  const moved = await waitFor(page, (b) => { const m = PrivacyMap.debug.me(); return m.moving || m.x !== b.x || m.y !== b.y; }, before, 1500);
  await touch(page, 'touchEnd');
  await waitFor(page, () => !PrivacyMap.debug.me().moving, null, 1500);
  return moved;
}
// 조이스틱을 누른 채 방향만 바꿔 가며 목표까지(사람이 하듯 손을 떼지 않음). goal = 'exit'(이 장면을 나갈 때까지)
async function joyHoldTo(page, getDirs, done, ms = 20000) {
  const c = await joyCenter(page);
  await touch(page, 'touchStart', c.x, c.y);
  const t0 = Date.now(); let last = null, n = 0;
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(done)) break;
    const dirs = await page.evaluate(getDirs);
    if (!dirs || !dirs.length) break;
    if (dirs[0] !== last) { last = dirs[0]; n++; await touch(page, 'touchMove', c.x + VEC[last][0] * 31, c.y + VEC[last][1] * 31); }
    await page.waitForTimeout(25);
  }
  await touch(page, 'touchEnd');
  await waitFor(page, () => !PrivacyMap.debug.me().moving, null, 1500);
  return n;
}
const inter = (a, b) => a && b && a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
// (d) 지금 그린 화면에서 이름표와 표시 그림(목적지 핀·?)이 겹치는지
const tagClash = (page) => page.evaluate(() => {
  const D = PrivacyMap.debug, tags = D.tags().map((r) => ({ x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h, label: r.label }));
  const marks = D.talkMarks().map((m) => ({ x0: m.x - m.w / 2, y0: m.y - m.h / 2, x1: m.x + m.w / 2, y1: m.y + m.h / 2, k: '?' + m.who }));
  const mk = D.marker();
  if (mk && mk.x != null && mk.w) marks.push({ x0: mk.x - mk.w / 2, y0: mk.y - mk.h / 2, x1: mk.x + mk.w / 2, y1: mk.y + mk.h / 2, k: 'dest' });
  const hit = [];
  tags.forEach((t) => marks.forEach((m) => { if (m.x0 < t.x1 && t.x0 < m.x1 && m.y0 < t.y1 && t.y0 < m.y1) hit.push(m.k + '↔' + t.label); }));
  return { hit, tags: tags.length, marks: marks.length };
});
// (c) 조이스틱 받침이 주인공·(화면 안의) 출구 칸을 가리는지
const joyCover = (page) => page.evaluate(() => {
  const D = PrivacyMap.debug, j = D.joy(), m = D.meRect(), cells = D.exitCells();
  const hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  return { shown: j.shown, me: !!j.rest && hit(j.rest, m), exit: !!j.rest && cells.some((c) => hit(j.rest, c)), cells: cells.length, rest: j.rest, meRect: m };
});

try {
  /* (a)(c)(d) 내 방 → 출구: 조이스틱만 */
  if (ONLY.includes('a') || ONLY.includes('c') || ONLY.includes('d')) for (const [name, dev] of Object.entries(PHONES)) {
    const page = await open(firstMap(), dev);
    const s0 = await me(page);
    ok(s0.area === '내 방', `${name} 내 방에서 시작 ${JSON.stringify(s0)}`);
    const j = await page.evaluate(() => PrivacyMap.debug.joy());
    ok(j.shown && !!j.rest, `${name} 터치 기기 → 조이스틱 보임`);
    const skipVis = await page.evaluate(() => { const b = document.getElementById('btn-map-skip'); return b.getClientRects().length > 0; });
    ok(!skipVis, `${name} 바로 가기 버튼 안 보임`);
    // 받침 투명도: 평소 약 40%, 누르는 중 약 80%
    const op0 = await page.evaluate(() => getComputedStyle(document.querySelector('#joy .joy-base')).opacity);
    const c = await joyCenter(page);
    await touch(page, 'touchStart', c.x, c.y);
    const op1 = await page.evaluate(() => getComputedStyle(document.querySelector('#joy .joy-base')).opacity);
    await touch(page, 'touchEnd');
    ok(Math.abs(op0 - 0.4) < 0.05 && Math.abs(op1 - 0.8) < 0.05, `${name} 조이스틱 투명도 평소 ${op0} · 누르는 중 ${op1}`);
    ok(await page.evaluate(() => getComputedStyle(document.getElementById('joy')).touchAction) === 'none', `${name} 조이스틱 영역 touch-action none`);
    // (c) 시작 자리
    let cv = await joyCover(page);
    ok(!cv.me && !cv.exit, `${name} 시작: 조이스틱이 주인공·출구를 가리지 않음 ${JSON.stringify(cv)}`);
    if (name === 'p360') {
      // 8방향: 오른쪽 아래로 밀면 가로·세로를 번갈아 비스듬히
      await touch(page, 'touchStart', c.x, c.y);
      await touch(page, 'touchMove', c.x + 22, c.y + 22);
      await page.waitForTimeout(500);
      await touch(page, 'touchEnd');
      await waitFor(page, () => !PrivacyMap.debug.me().moving);
      const s1 = await me(page);
      ok(s1.x > s0.x && s1.y > s0.y, `${name} 대각선(↘) 밀기 → 가로·세로 둘 다 이동 ${s0.x},${s0.y} → ${s1.x},${s1.y}`);
      // 끝까지 밀면 빠르게
      await touch(page, 'touchStart', c.x, c.y);
      await touch(page, 'touchMove', c.x - 60, c.y);
      await page.waitForTimeout(60);
      const fast = await page.evaluate(() => PrivacyMap.debug.joy().fast);
      await page.waitForTimeout(300);
      await touch(page, 'touchMove', c.x - 20, c.y); // 살짝 = 걷기
      await page.waitForTimeout(250);
      const slow = await page.evaluate(() => PrivacyMap.debug.joy().fast);
      await touch(page, 'touchEnd');
      await waitFor(page, () => !PrivacyMap.debug.me().moving);
      ok(fast === true && slow === false, `${name} 끝까지 밀면 빠르게(${fast}) · 살짝 밀면 걷기(${slow})`);
    }
    // 조이스틱을 누른 채로 출구 매트까지 → 장면이 마을 길로
    const turns = await joyHoldTo(page, () => { const m = PrivacyMap.debug.me(); const tp = PrivacyMap.debug.tapPath(128 + 15, 17); return m.area === '내 방' ? tp && tp.dirs : []; },
      () => PrivacyMap.debug.me().area !== '내 방');
    const s2 = await me(page);
    ok(s2.area === '마을 길', `${name} 조이스틱만으로 내 방 출구 → 마을 길 (방향 바꾼 횟수 ${turns}) ${JSON.stringify(s2)}`);
    // 다시 들어와 매트 바로 앞에서 (c)(d) 확인 + 스크린샷
    await page.evaluate(() => PrivacyMap.debug.place(128 + 15, 15, 'down')); // 검사용 자리(방 안 매트 두 칸 위) — 조이스틱 이동 검사는 위에서 끝남
    await page.waitForTimeout(150);
    // 한 칸 아래(매트 바로 위)로: 탭 한 번(조이스틱 한 칸은 느린 PC에서 손 떼기 전에 두 칸 — 매트까지 — 가 버릴 수 있어서)
    { const p1 = await page.evaluate(() => PrivacyMap.debug.tileToClient(128 + 15, 16)); await page.touchscreen.tap(p1.x, p1.y); }
    await waitFor(page, () => { const m = PrivacyMap.debug.me(); return !m.moving && m.y === 16; }, null, 3000);
    await page.waitForTimeout(200);
    cv = await joyCover(page);
    ok(cv.cells > 0 && !cv.me && !cv.exit, `${name} 매트 앞: 조이스틱이 주인공·출구 칸을 가리지 않음 ${JSON.stringify(cv)}`);
    const ex = await page.evaluate(() => { const cs = PrivacyMap.debug.exitCells(), cr = document.getElementById('m-canvas').getBoundingClientRect(),
      ctl = document.querySelector('#v-map .map-controls').getBoundingClientRect();
      return { cells: cs, below: cs.filter((c) => cr.top + c.y1 > ctl.top + 1).length, vh: innerHeight, stageBottom: document.getElementById('stage').getBoundingClientRect().bottom }; });
    ok(ex.cells.length === 4 && ex.below === 0, `${name} 매트 앞: 출구 칸 4개가 버튼 줄 위에 보임 ${JSON.stringify(ex.cells.map((c) => [c.x0, c.y1].map(Math.round)))}`);
    ok(ex.stageBottom <= ex.vh + 0.5, `${name} 무대가 화면 안(아래 잘림 없음) ${ex.stageBottom} ≤ ${ex.vh}`);
    const tc = await tagClash(page);
    ok(tc.tags > 0 && tc.marks > 0 && tc.hit.length === 0, `${name} 매트 앞: 이름표와 목적지 핀 안 겹침 ${JSON.stringify(tc)}`);
    const btn = await page.evaluate(() => document.getElementById('btn-map-act').textContent);
    ok(/밖으로 가기/.test(btn), `${name} 매트 앞: 버튼 '밖으로 가기' (${btn})`);
    await page.screenshot({ path: shot(name + '-mat') });
    // 말 걸기·조사하기 버튼(= 밖으로 가기)으로도 나간다
    await page.tap('#btn-map-act');
    await waitFor(page, () => PrivacyMap.debug.me().area === '마을 길');
    ok((await me(page)).area === '마을 길', `${name} 매트 앞에서 버튼으로 나가기`);
    // 매트 그림(문 칸 옆, 그림의 매트가 문 칸보다 넓음)을 탭해도 나간다
    await page.evaluate(() => PrivacyMap.debug.place(128 + 12, 15, 'down'));
    await page.waitForTimeout(150);
    const pt = await page.evaluate(() => PrivacyMap.debug.tileToClient(128 + 18, 17)); // (18,17)은 막힌 칸(매트 오른쪽 끝)
    await page.touchscreen.tap(pt.x, pt.y);
    await waitFor(page, () => PrivacyMap.debug.me().area === '마을 길', null, 4000);
    ok((await me(page)).area === '마을 길', `${name} 매트 끝(막힌 칸) 탭 → 출구로 걸어가 나감`);
    ok(page.errors.length === 0, `${name} 오류 없음 ${page.errors}`);
    await close(page);
  }

  /* (e) 바로 가기: ?debug=1에서만 */
  if (ONLY.includes('e')) {
    for (const [q, dev, nm] of [['', PHONES.p390, 'p390'], ['?debug=1', PHONES.p390, 'p390 debug'], ['', DESKTOP, 'pc'], ['?debug=1', DESKTOP, 'pc debug']]) {
      const page = await open(firstMap(), dev, q);
      const r = await page.evaluate(() => {
        const b = document.getElementById('btn-map-skip'), a = document.getElementById('btn-map-act'), ctl = document.querySelector('#v-map .map-controls');
        return { vis: b.getClientRects().length > 0, actW: a.getBoundingClientRect().width, ctlW: ctl.getBoundingClientRect().width, dbg: PrivacyMap.debugMode() };
      });
      const before = await me(page);
      await page.evaluate(() => document.getElementById('btn-map-skip').click());
      await page.waitForTimeout(150);
      const after = await me(page), near = await page.evaluate(() => PrivacyMap.debug.nearTarget());
      if (q) {
        ok(r.vis && r.dbg.grid && r.dbg.skip, `${nm}: 바로 가기 버튼 보임 + 칸 표시 ${JSON.stringify(r)}`);
        ok(near && after.area === '2학년 3반 교실', `${nm}: 바로 가기 → 목적지 옆 ${JSON.stringify(after)}`);
        await page.screenshot({ path: shot(nm.replace(' ', '-')) });
        await page.tap('#btn-map-act').catch(() => page.click('#btn-map-act'));
        await waitFor(page, () => PrivacyTalk.isOpen() || document.body.getAttribute('data-view') !== 'v-map');
        ok(await page.evaluate(() => PrivacyTalk.isOpen()), `${nm}: 바로 간 뒤 말 걸기 → 사건 인사말`);
      } else {
        ok(!r.vis && !r.dbg.skip && !r.dbg.grid, `${nm}: 바로 가기 버튼 없음 ${JSON.stringify(r)}`);
        ok(after.x === before.x && after.y === before.y, `${nm}: 숨은 버튼을 눌러도 이동 없음`);
        ok(r.actW >= r.ctlW - 2, `${nm}: 말 걸기 버튼이 줄 전체를 씀 ${Math.round(r.actW)}/${Math.round(r.ctlW)}`);
        if (dev.hasTouch) {
          // 메뉴 '조이스틱 표시' 끄기 → 숨김 + 설정 키에 저장(진행 저장 키는 그대로)
          await page.click('#btn-menu');
          const row = await page.evaluate(() => !document.getElementById('opt-joystick-row').hidden && document.getElementById('opt-joystick').checked);
          await page.click('#opt-joystick');
          await page.click('#btn-menu-close');
          await page.waitForTimeout(150);
          const off = await page.evaluate(() => ({ shown: PrivacyMap.debug.joy().shown, saved: JSON.parse(localStorage.getItem('ethicity.privacy.settings.v1')).joystick }));
          ok(row && !off.shown && off.saved === false, `${nm}: 메뉴에서 조이스틱 끄기 → 숨김·설정 저장 ${JSON.stringify({ row, ...off })}`);
          await page.reload(); await page.click('#btn-continue'); await page.waitForTimeout(900);
          ok(!(await page.evaluate(() => PrivacyMap.debug.joy().shown)), `${nm}: 다시 열어도 조이스틱 꺼짐 유지`);
        }
      }
      ok(page.errors.length === 0, `${nm}: 오류 없음 ${page.errors}`);
      await close(page);
    }
  }

  /* (f) PC 키보드 */
  if (ONLY.includes('f')) {
    const page = await open(firstMap(), DESKTOP);
    const r = await page.evaluate(() => ({ joy: PrivacyMap.debug.joy().shown, zone: !document.getElementById('joy').hidden, v: PrivacyMap.debug.view() }));
    ok(!r.joy && !r.zone, 'PC: 조이스틱 없음');
    // 카메라: 넓은 화면은 옛 배치 그대로(장면이 화면 가운데)
    const W = await page.evaluate(() => { const c = document.getElementById('m-canvas'); return { w: c.clientWidth, h: c.clientHeight }; });
    const sc = r.v.scene, sw = sc.x1 - sc.x0, sh = sc.y1 - sc.y0;
    ok(Math.abs(sc.x0 - (sw <= W.w ? (W.w - sw) / 2 : sc.x0)) <= 1 && Math.abs(sc.y0 - (sh <= W.h ? (W.h - sh) / 2 : sc.y0)) <= 1, `PC: 장면 배치 옛 그대로(가운데) ${JSON.stringify(sc)} ${JSON.stringify(W)}`);
    await page.click('#btn-menu');
    ok(await page.evaluate(() => document.getElementById('opt-joystick-row').hidden), 'PC: 메뉴에 조이스틱 설정 없음');
    await page.click('#btn-menu-close');
    // 키를 누르고 있으면 계속 걷는다(빠르게 아님)
    const s0 = await me(page);
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(600); await page.keyboard.up('ArrowRight');
    await waitFor(page, () => !PrivacyMap.debug.me().moving);
    const s1 = await me(page);
    ok(s1.x - s0.x >= 3 && s1.y === s0.y && !(await page.evaluate(() => PrivacyMap.debug.joy().fast)), `PC: → 길게 누름 ${s0.x}→${s1.x}`);
    // 키보드로 한 칸씩 출구까지 → 마을 길
    for (let g = 0; g < 60; g++) {
      const d = await page.evaluate(() => { const tp = PrivacyMap.debug.tapPath(128 + 15, 17); return PrivacyMap.debug.me().area === '내 방' && tp && tp.dirs[0]; });
      if (!d) break;
      await page.keyboard.press('Arrow' + d[0].toUpperCase() + d.slice(1));
      await waitFor(page, () => !PrivacyMap.debug.me().moving);
    }
    ok((await me(page)).area === '마을 길', 'PC: 키보드로 내 방 출구 → 마을 길');
    await page.screenshot({ path: shot('pc-village') });
    // 마우스로 문 매트 칸 클릭 → 출구로(옛 버그: 반응 없음)
    const page2 = await open(firstMap(), DESKTOP);
    const pt = await page2.evaluate(() => PrivacyMap.debug.tileToClient(128 + 16, 17));
    await page2.mouse.click(pt.x, pt.y);
    await waitFor(page2, () => PrivacyMap.debug.me().area === '마을 길', null, 5000);
    ok((await me(page2)).area === '마을 길', 'PC: 문 매트 칸 클릭 → 걸어가 나감');
    ok(page.errors.length === 0 && page2.errors.length === 0, `PC: 오류 없음 ${page.errors} ${page2.errors}`);
    await close(page); await close(page2);
  }

  /* (b) 프롤로그 → 에필로그 모든 걷기 구간: 조이스틱으로 걸어서 도착 */
  if (ONLY.includes('b')) {
    const route = {}; ROUTES.A.forEach((r) => { const [sc, id] = r.split('#'); route[sc] = id; });
    const page = await open(firstMap(), PHONES.p390);
    const walked = [];
    let tiles = 0;
    for (let guard = 0; guard < 600; guard++) {
      const v = await view(page);
      if (v === 'v-ending') break;
      if (v === 'v-map') {
        const st = await page.evaluate(() => PrivacyApp.state());
        const expected = E.advance(story, JSON.parse(JSON.stringify(st)));
        let n = 0, stuck = false;
        for (; n < 400; n++) {
          const dirs = await page.evaluate(() => PrivacyMap.debug.route());
          if (!dirs) { stuck = true; break; }
          if (!dirs.length) break;
          if (!(await joyStep(page, dirs[0]))) { stuck = true; break; }
        }
        tiles += n;
        const near = await page.evaluate(() => PrivacyMap.debug.nearTarget());
        const tc = await tagClash(page), cv = await joyCover(page);
        ok(!stuck && near, `${st.mapTarget}: 조이스틱으로 ${n}칸 걸어 목적지 옆 도착`);
        ok(tc.hit.length === 0, `${st.mapTarget}: 도착 화면 이름표·표시 겹침 없음 ${JSON.stringify(tc)}`);
        ok(!cv.me, `${st.mapTarget}: 조이스틱이 주인공을 가리지 않음`);
        await page.tap('#btn-map-act'); // 조이스틱을 뗀 직후 첫 탭(옛 버그: click이 안 와서 두 번 눌러야 했다 → map.js pointerup)
        for (let k = 0; k < 40 && await view(page) === 'v-map'; k++) {
          await page.evaluate(() => { if (PrivacyTalk.isOpen()) PrivacyTalk.next(); });
          await page.waitForTimeout(40);
        }
        const got = await page.evaluate(() => PrivacyApp.state());
        ok(got.screen === expected.screen && got.scene === expected.scene, `${st.mapTarget}: 걸어서 도착 → 같은 처리(${got.screen}/${got.scene} = 엔진 ${expected.screen}/${expected.scene})`);
        walked.push(st.mapTarget);
        continue;
      }
      // 장면: 대화 넘기기·대표 경로 선택·다음
      await page.evaluate((route) => {
        const $ = (s) => document.querySelector(s);
        if (document.body.getAttribute('data-view') === 'v-chapter') { $('#btn-chapter-go').click(); return; }
        if ($('#talk') && !$('#talk').hidden) { $('#btn-talk-next').click(); return; }
        if (PrivacyApp.staging && PrivacyApp.staging()) return;
        const skip = $('.skip-btn'); if (skip) { skip.click(); return; }
        const cs = [...document.querySelectorAll('#g-dock .choice')];
        if (cs.length) { const want = route[PrivacyApp.state().scene]; (cs.find((b) => b.getAttribute('data-choice') === want) || cs[0]).click(); return; }
        const nx = $('#btn-next'); if (nx) nx.click();
      }, route);
      await page.waitForTimeout(30);
    }
    const all = Object.keys(WORLD.triggers);
    ok(await view(page) === 'v-ending', `대표 경로 A 엔딩까지 (${await view(page)})`);
    ok(all.every((t) => walked.includes(t)), `모든 걷기 구간을 걸어서 지남 ${walked.join(' → ')} (총 ${tiles}칸)`);
    ok(page.errors.length === 0, `(b) 오류 없음 ${page.errors}`);
    await close(page);
  }

  /* (g) 2026-11-02 밤 모바일 터치 지시서(prompts 16): 360×780 · 412×915 · 780×360 · 915×412, 터치만.
   *   g1 내 방 출구: 매트 가운데·가장자리·연타·'!' 핀·문 옆에서 말 걸기 버튼(5가지) → 마을 길
   *   g2 내 방 → 2학년 3반 교실(새봄 옆)까지: 목적지 핀만 눌러 가며(바로 가기 없이) ×3
   *   g3 새봄의 ?·몸을 눌러 대화 열기   g4 회전(걷는 중·대화 중·선택지) 뒤 계속   g5 이전 선택(취소)·메뉴(바깥 눌러 닫기·처음 화면으로→이어 하기)
   *   + 화면 검사: 스크롤 없음·버튼이 화면 안·내 칸과 상하좌우 칸이 캔버스로 잡힘·문 도착 문구·이름표 글자·날짜 카드 통과·HUD 한 줄 버튼 */
  if (ONLY.includes('g')) {
    const SCREENS = Object.fromEntries(Object.entries({ '360x780': [360, 780], '412x915': [412, 915], '780x360': [780, 360], '915x412': [915, 412] }).filter(([k]) => !process.env.SCR || process.env.SCR.split(',').includes(k)));
    const TBL = {}; const rec = (sc, k, good) => { TBL[k] = TBL[k] || {}; const c = TBL[k][sc] = TBL[k][sc] || [0, 0]; c[1]++; if (good) c[0]++; };
    const dev = ([w, h]) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const ROOM = 128, VIL = 96, YARD = 64;
    // 편히 누를 수 있게 보이는 칸: 가운데와 위아래 14px이 모두 캔버스(버튼 바로 옆이면 휴대폰 터치 보정이 버튼으로 끌어간다)
    const onCanvas = (page, x, y) => page.evaluate(([x, y]) => { const p = PrivacyMap.debug.tileToClient(x, y); return [0, -14, 14].every((d) => { const e = document.elementFromPoint(p.x, p.y + d); return !!e && e.id === 'm-canvas'; }); }, [x, y]);
    // 사람은 화면에 보이는 칸만 누른다: 누를 칸이 화면 밖·버튼 밑이면 먼저 near 자리로 다가간 뒤(검사용 순간이동) 누른다
    const tapTile = async (page, x, y, near) => {
      if (near && !(await onCanvas(page, x, y))) { await page.evaluate((n) => PrivacyMap.debug.place(n[0], n[1], n[2] || 'down'), near); await page.waitForTimeout(500); }
      // 그래도 버튼 밑이면(가로 화면: 카메라가 걸어갈 때만 따라 내려온다) 한 칸 위까지 더 다가간다
      if (near && !(await onCanvas(page, x, y))) { await page.evaluate(([x, y]) => PrivacyMap.debug.place(x, y - 1, 'down'), [x, y]); await page.waitForTimeout(500); }
      const p = await page.evaluate(([x, y]) => PrivacyMap.debug.tileToClient(x, y), [x, y]); await page.touchscreen.tap(p.x, p.y);
    };
    const NEAR_MAT = [128 + 15, 13, 'down'];
    const tapPin = async (page) => { const m = await page.evaluate(() => { const k = PrivacyMap.debug.marker(), r = document.getElementById('m-canvas').getBoundingClientRect(); return k && k.x != null ? { x: r.left + k.x, y: r.top + k.y, who: k.who } : null; }); if (!m) return false; await page.touchscreen.tap(m.x, m.y); return m; };
    const area = async (page) => (await me(page)).area;
    // 화면 검사: 스크롤 없음, 말 걸기 버튼·HUD 버튼이 화면 안, 내 칸과 상하좌우가 캔버스
    const screenCheck = (page) => page.evaluate(() => {
      const D = PrivacyMap.debug, m = D.me(), inView = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.top >= -0.5 && r.left >= -0.5 && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5; };
      const cells = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => { const p = D.tileToClient(m.x + dx, m.y + dy); const e = document.elementFromPoint(p.x, p.y); return e && e.id === 'm-canvas'; });
      return { scroll: document.documentElement.scrollHeight <= innerHeight + 0.5 && document.documentElement.scrollWidth <= innerWidth + 0.5,
        act: inView(document.getElementById('btn-map-act')), hud: inView(document.getElementById('btn-menu')) && inView(document.getElementById('btn-undo')), canvas: cells.every(Boolean), cells };
    });
    const allOk = (c) => c.scroll && c.act && c.hud && c.canvas;
    const waitArea = (page, a, ms = 8000) => waitFor(page, (a) => PrivacyMap.debug.me().area === a, a, ms);
    for (const [sc, size] of Object.entries(SCREENS)) {
      // g1: 내 방 출구 5가지
      const ways = ['매트 가운데 탭', '매트 가장자리 탭', '매트 연타', "'!' 핀 탭", '문 옆 말 걸기 버튼'];
      for (const way of ways) {
        const page = await open(firstMap(), dev(size));
        await page.waitForTimeout(300);
        const c0 = await screenCheck(page);
        rec(sc, '화면 검사(스크롤·버튼·캔버스)', allOk(c0));
        if (way === ways[0]) ok(allOk(c0), `${sc} 시작 화면 검사 ${JSON.stringify(c0)}`);
        if (way === '매트 가운데 탭') await tapTile(page, ROOM + 15, 17, NEAR_MAT);
        else if (way === '매트 가장자리 탭') await tapTile(page, ROOM + 17, 17, NEAR_MAT);
        else if (way === '매트 연타') { await tapTile(page, ROOM + 16, 17, NEAR_MAT); await page.waitForTimeout(40); await tapTile(page, ROOM + 16, 17); await page.waitForTimeout(40); await tapTile(page, ROOM + 14, 17); }
        else if (way === "'!' 핀 탭") await tapPin(page);
        else { // 문 매트 바로 앞까지 걸어서(탭) → 말 걸기 버튼
          await tapTile(page, ROOM + 16, 16, NEAR_MAT); await waitFor(page, () => { const m = PrivacyMap.debug.me(); return !m.moving && m.x === 128 + 16 && m.y === 16; }, null, 8000);
          const c1 = await screenCheck(page); rec(sc, '화면 검사(스크롤·버튼·캔버스)', allOk(c1));
          const mat = await page.evaluate(() => [14, 15, 16, 17].map((x) => { const p = PrivacyMap.debug.tileToClient(128 + x, 17), e = document.elementFromPoint(p.x, p.y); return !!e && e.id === 'm-canvas'; }));
          ok(mat.every(Boolean) && allOk(c1), `${sc} 매트 앞: 매트 4칸·내 칸 주변이 캔버스로 잡힘 ${JSON.stringify({ mat, c1 })}`);
          await page.tap('#btn-map-act');
        }
        const good = await waitArea(page, '마을 길');
        rec(sc, '1 내 방 출구로 나가기', good);
        ok(good, `${sc} 내 방 출구: ${way} → 마을 길 ${good ? '' : JSON.stringify(await page.evaluate(() => ({ me: PrivacyMap.debug.me(), say: document.getElementById('m-say').textContent, talk: PrivacyTalk.isOpen(), v: document.body.getAttribute('data-view'), w: innerWidth, h: innerHeight })))}`);
        ok(page.errors.length === 0, `${sc} ${way} 오류 없음 ${page.errors}`);
        await close(page);
      }
      // g2·g3: 핀만 눌러 교실까지 ×3, 마지막 회차에서 새봄 ?·몸 탭
      for (let trial = 0; trial < 3; trial++) {
        const page = await open(firstMap(), dev(size));
        await page.waitForTimeout(300);
        const seen = [];
        for (let k = 0; k < 40; k++) {
          const a = await area(page); if (!seen.includes(a)) seen.push(a);
          if (await page.evaluate(() => PrivacyMap.debug.nearTarget())) break;
          if (a === '2학년 3반 교실') break;
          const m0 = await me(page);
          if (!(await tapPin(page))) break;
          await waitFor(page, (m0) => { const m = PrivacyMap.debug.me(); return !m.moving && (m.x !== m0.x || m.y !== m0.y) && !PrivacyMap.debug.me().moving; }, m0, 9000);
          await page.waitForTimeout(150);
        }
        const inClass = await area(page) === '2학년 3반 교실';
        if (inClass) {
          const say = await page.evaluate(() => { const s = document.getElementById('m-say'), h = document.getElementById('hud'); return { t: s.textContent, below: !s.textContent || s.getBoundingClientRect().top >= h.getBoundingClientRect().bottom - 0.5 }; });
          if (trial === 0) ok(say.below, `${sc} 문 도착 문구가 HUD 아래 ${JSON.stringify(say)}`);
        }
        rec(sc, '2 내 방 → 교실까지 걷기', inClass);
        ok(inClass, `${sc} 핀만 눌러 교실까지(시도 ${trial + 1}) ${seen.join(' → ')}`);
        if (inClass && trial === 0) {
          // 새봄의 ? 누르기 → 대화창
          const q = await page.evaluate(() => { const t = PrivacyMap.debug.marker(), r = document.getElementById('m-canvas').getBoundingClientRect(); return t && t.who === 'saebom' && t.x != null ? { x: r.left + t.x, y: r.top + t.y } : null; });
          if (q) await page.touchscreen.tap(q.x, q.y);
          const t1 = q && await waitFor(page, () => PrivacyTalk.isOpen(), null, 9000);
          rec(sc, '3 새봄 ?·몸 눌러 대화', !!t1);
          ok(!!t1, `${sc} 새봄 ? 탭 → 대화창 ${JSON.stringify(q)}`);
          // 대화 중 회전 → 계속 넘김
          const rot = [size[1], size[0]];
          await page.setViewportSize({ width: rot[0], height: rot[1] }); await page.waitForTimeout(400);
          await page.setViewportSize({ width: size[0], height: size[1] }); await page.waitForTimeout(400);
          let left = 0; for (; left < 30 && await view(page) === 'v-map'; left++) { const tk = await page.$('#talk:not([hidden])'); if (tk) await tk.tap().catch(() => page.evaluate(() => PrivacyTalk.next())); else await page.evaluate(() => PrivacyTalk.next()); await page.waitForTimeout(80); }
          const toScene = await view(page) === 'v-game';
          rec(sc, '4 회전 뒤 계속(걷기·대화·선택지)', toScene);
          ok(toScene, `${sc} 대화 중 회전 뒤 대화창 눌러 넘김 → 장면(${await view(page)})`);
        }
        ok(page.errors.length === 0, `${sc} 교실까지 오류 없음 ${page.errors}`);
        await close(page);
      }
      // g3: 새봄 몸 탭(교실 안 다른 자리에서)
      {
        const page = await open(firstMap(), dev(size));
        await page.evaluate(() => PrivacyMap.debug.place(15, 14, 'up')); await page.waitForTimeout(500);
        await tapTile(page, 12, 8, [12, 11, 'up']);
        const t2 = await waitFor(page, () => PrivacyTalk.isOpen(), null, 9000);
        rec(sc, '3 새봄 ?·몸 눌러 대화', t2);
        ok(t2, `${sc} 새봄 몸 탭 → 걸어가 대화창`);
        await close(page);
      }
      // g4: 걷는 중 회전 + 선택지 화면 회전
      {
        const page = await open(firstMap(), dev(size));
        await tapTile(page, ROOM + 15, 17, [128 + 15, 11, 'down']); await page.waitForTimeout(250);
        const rot = [size[1], size[0]];
        await page.setViewportSize({ width: rot[0], height: rot[1] }); await page.waitForTimeout(500);
        const c1 = await screenCheck(page);
        const out = await waitArea(page, '마을 길');
        await page.waitForTimeout(400);
        const c2 = await screenCheck(page);
        rec(sc, '4 회전 뒤 계속(걷기·대화·선택지)', allOk(c1) && out && allOk(c2));
        ok(allOk(c1) && out && allOk(c2), `${sc}→${rot.join('x')} 걷는 중 회전: 화면 검사·계속 걸어 나감 ${JSON.stringify({ c1, out, c2 })}`);
        await page.setViewportSize({ width: size[0], height: size[1] }); await page.waitForTimeout(300);
        await close(page);
        const pg = await open(makeRunScene('c1_e2_a'), dev(size));
        for (let k = 0; k < 20 && !(await page_choices(pg)); k++) { await pg.evaluate(() => { if (PrivacyTalk.isOpen()) PrivacyTalk.next(); }); await pg.waitForTimeout(60); }
        await pg.setViewportSize({ width: rot[0], height: rot[1] }); await pg.waitForTimeout(400);
        const ch = await pg.$('#g-dock .choice');
        if (ch) { await ch.scrollIntoViewIfNeeded().catch(() => {}); await ch.tap(); }
        await pg.waitForTimeout(400);
        const moved = await pg.evaluate(() => PrivacyApp.state().scene !== 'c1_e2_a' || !!PrivacyApp.state().reaction);
        rec(sc, '4 회전 뒤 계속(걷기·대화·선택지)', !!ch && moved);
        ok(!!ch && moved, `${sc} 선택지 화면 회전 뒤 선택 눌림`);
        ok(pg.errors.length === 0, `${sc} 회전 오류 없음 ${pg.errors}`);
        await close(pg);
      }
      // g5: 이전 선택(취소) · 메뉴 바깥 눌러 닫기 · 메뉴가 열려 있으면 멈춤 · 처음 화면으로 → 이어 하기
      {
        const page = await open(makeRunScene('c1_e1_b'), dev(size));
        let good = true;
        if (await page.evaluate(() => document.getElementById('btn-undo').disabled)) { // 되돌릴 선택이 생기게 하나 고른다
          for (let k = 0; k < 20 && !(await page_choices(page)); k++) { await page.evaluate(() => { if (PrivacyTalk.isOpen()) PrivacyTalk.next(); }); await page.waitForTimeout(60); }
          const c0 = await page.$('#g-dock .choice'); if (c0) await c0.tap(); await page.waitForTimeout(400);
        }
        const sc0 = await page.evaluate(() => JSON.stringify([PrivacyApp.state().scene, PrivacyApp.state().reaction]));
        await page.tap('#btn-undo'); await page.waitForTimeout(150);
        const cf = await page.evaluate(() => !document.getElementById('confirm').hidden);
        if (cf) await page.tap('#confirm-no'); await page.waitForTimeout(150);
        good = good && cf && await page.evaluate((sc0) => document.getElementById('confirm').hidden && JSON.stringify([PrivacyApp.state().scene, PrivacyApp.state().reaction]) === sc0, sc0);
        await close(page);
        const p2 = await open(firstMap(), dev(size));
        await tapTile(p2, ROOM + 15, 17); await p2.waitForTimeout(200);
        await p2.tap('#btn-menu'); await p2.waitForTimeout(150);
        const m1 = await me(p2); await p2.waitForTimeout(900); const m2 = await me(p2);
        const still = m1.x === m2.x && m1.y === m2.y || Math.abs(m1.x - m2.x) + Math.abs(m1.y - m2.y) <= 1;
        const sheetFits = await p2.evaluate(() => { const ids = ['btn-menu-close', 'btn-menu-home']; return ids.every((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 0.5; }); });
        await p2.touchscreen.tap(4, 4); await p2.waitForTimeout(150); // 바깥 어두운 곳
        const closed = await p2.evaluate(() => document.getElementById('menu').hidden);
        await p2.tap('#btn-menu'); await p2.waitForTimeout(150);
        await p2.tap('#btn-menu-home'); await p2.waitForTimeout(300);
        const home = await view(p2) === 'v-start';
        await p2.tap('#btn-continue'); await p2.waitForTimeout(900);
        const back = await view(p2) === 'v-map';
        good = good && still && closed && home && back;
        rec(sc, '5 이전 선택·메뉴', good);
        ok(good, `${sc} 이전 선택(취소)·메뉴: ${JSON.stringify({ cf, still, sheetFits, closed, home, back })}`);
        if (!sheetFits) console.log(`  (참고) ${sc} 메뉴 닫기·처음 화면으로 버튼은 시트 안을 스크롤해야 보임`);
        if (size[0] > size[1]) ok(sheetFits, `${sc} 메뉴 '닫기'·'처음 화면으로'가 스크롤 없이 보임(가로 화면)`);
        // 이름표 글자·배경, 날짜 카드 통과, HUD 버튼 한 줄, 시작 화면 '시작하기'
        const misc = await p2.evaluate(() => {
          const tg = PrivacyMap.debug.tags(), cut = getComputedStyle(document.getElementById('cut')).pointerEvents;
          const u = document.getElementById('btn-undo'), lh = parseFloat(getComputedStyle(u).lineHeight) || 20;
          return { tagH: tg.length ? Math.min(...tg.map((t) => t.h)) : 0, cut, undoOneLine: u.scrollHeight < lh * 1.9 + 16 };
        });
        ok(misc.tagH >= 16 && misc.cut === 'none' && misc.undoOneLine, `${sc} 이름표 높이 ≥16 · 날짜 카드 pointer-events none · '이전 선택' 한 줄 ${JSON.stringify(misc)}`);
        await p2.tap('#btn-menu'); await p2.tap('#btn-menu-home'); await p2.waitForTimeout(300);
        const st = await p2.evaluate(() => { const b = document.getElementById('btn-continue').getClientRects().length ? document.getElementById('btn-continue') : document.getElementById('btn-new'); const r = b.getBoundingClientRect(); return { bottom: r.bottom, vh: innerHeight }; });
        ok(st.bottom <= st.vh + 0.5, `${sc} 시작 화면: 시작/이어 하기 버튼이 첫 화면 안 ${JSON.stringify(st)}`);
        if (sc === '780x360' || sc === '360x780') { await p2.tap('#btn-continue'); await p2.waitForTimeout(800); await p2.screenshot({ path: shot('g-' + sc) }); }
        ok(p2.errors.length === 0, `${sc} 메뉴 오류 없음 ${p2.errors}`);
        await close(p2);
      }
    }
    // 키보드 회귀 1회(PC): 방향키로 문 지나기
    {
      const page = await open(firstMap(), DESKTOP);
      for (let g = 0; g < 60; g++) {
        const d = await page.evaluate(() => { const tp = PrivacyMap.debug.tapPath(128 + 15, 17); return PrivacyMap.debug.me().area === '내 방' && tp && tp.dirs[0]; });
        if (!d) break;
        await page.keyboard.press('Arrow' + d[0].toUpperCase() + d.slice(1));
        await waitFor(page, () => !PrivacyMap.debug.me().moving);
      }
      const say = await page.evaluate(() => document.getElementById('m-say').textContent);
      ok((await me(page)).area === '마을 길', 'PC 키보드로 문 지나기 그대로 ' + say);
      await close(page);
    }
    console.log('\n시나리오 × 화면 성공(성공/시도)');
    const cols = Object.keys(SCREENS);
    console.log('시나리오 | ' + cols.join(' | '));
    Object.keys(TBL).forEach((k) => console.log(k + ' | ' + cols.map((c) => (TBL[k][c] ? TBL[k][c].join('/') : '-')).join(' | ')));
  }
} finally {
  await browser.close(); server.close();
}
console.log(`\nmobile-1102: 통과 ${pass} · 실패 ${fails.length}`);
fails.forEach((f) => console.log('  - ' + f));
process.exit(fails.length ? 1 : 0);
