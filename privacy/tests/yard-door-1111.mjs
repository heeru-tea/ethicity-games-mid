// 2026-11-11 플레이테스트: 마당 현관 출입구를 문 안쪽(y 4)에서 계단(6~8, 5)으로. node privacy/tests/yard-door-1111.mjs
//   1 출입구 칸 = 계단 세 칸, 느낌표 핀이 그 위(?debug=grid 스크린샷) · 2 계단을 밟으면 교실로 · 3 교실에서 나오면 [7,7], 다시 빨려 들어가지 않고 핀이 머리에 안 얹힘
//   4 (10,5)에서 (4,5)를 누르면 계단을 돌아서 감(교실로 안 들어감) · 5 화분 칸 (5,5)·(9,5)은 막힘 · 6 옛 저장이 [6~8, 4]·[7, 5]에 서 있으면 [7,7]로
//   SIZE=d|m (1280×800 · 390×844). 스크린샷 = tests/_shot-yard-*.png(gitignore). 브라우저 검사는 한 번에 하나(D:/Works/.browser-test.lock)
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SIZES = { d: { name: '1280x800', dev: { viewport: { width: 1280, height: 800 } } }, m: { name: '390x844', dev: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } } };
const WANT = (process.env.SIZE || 'd,m').split(',');
const ox = (id) => WORLD.SCENES.find((s) => s.id === id).ox, YARD = ox('yard'), CLASS = ox('classroom');

function makeMap(target) { // 그 장면으로 걸어가는 구간(맵 화면)에 선 상태
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let tries = 0; tries < 20000; tries++) {
    let s = E.createState(story);
    for (let step = 0; step < 500 && s.screen !== 'ending'; step++) {
      if (s.screen === 'map' && s.mapTarget === target) { s.history = s.history.slice(-1); return s; }
      if (s.screen === 'scene' && E.needsChoice(story, s)) { const cs = E.visibleChoices(story, story.scenes[s.scene], s); s = E.choose(story, s, cs[Math.floor(rnd() * cs.length)].id); s.history = []; }
      s = E.advance(story, s);
    }
  }
  throw new Error('경로 없음: ' + target);
}
const server = await startServer(0), base = `http://127.0.0.1:${server.address().port}/privacy/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗ ' + m); } return !!c; };
async function open(run, dev, extra = {}, query = '') {
  const ctx = await browser.newContext(dev); const page = await ctx.newPage(); page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript((p) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1'); localStorage.clear();
    localStorage.setItem('ethicity.player', '{"character":"char_03","nickname":"반짝이는 고래"}');
    localStorage.setItem('ethicity.privacy.settings.v1', '{"speed":"instant","reduceMotion":true,"look":"f"}');
    localStorage.setItem('ethicity.privacy.progress.v2', p);
  }, JSON.stringify({ v: 1, run, explored: {}, endingsSeen: [], ...extra }));
  await page.goto(base + query); await page.click('#btn-continue'); await page.waitForTimeout(1000);
  page.ctx = ctx; page.touch = !!dev.hasTouch; return page;
}
const me = (p) => p.evaluate(() => PrivacyMap.debug.me());
const place = async (p, x, y, dir = 'down') => { await p.evaluate(([a, b, c]) => PrivacyMap.debug.place(a, b, c), [x, y, dir]); await p.waitForTimeout(160); };
async function settle(p, ms = 9000) { const t0 = Date.now(); let n = 0; while (Date.now() - t0 < ms) { const m = await me(p); if (m.moving) n = 0; else if (++n > 6) return m; await p.waitForTimeout(40); } return me(p); }
async function waitHold(p) { for (let k = 0; k < 40 && await p.evaluate(() => PrivacyMap.debug.holding()); k++) await p.waitForTimeout(40); }
async function tapTile(p, x, y) { const c = await p.evaluate(([a, b]) => PrivacyMap.debug.tileToClient(a, b), [x, y]); if (p.touch) await p.touchscreen.tap(c.x, c.y); else await p.mouse.click(c.x, c.y); }
const passTalk = async (p) => { for (let k = 0; k < 40 && await p.evaluate(() => PrivacyTalk.isOpen()); k++) { await p.evaluate(() => PrivacyTalk.next()); await p.waitForTimeout(60); } };
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

try {
  // 정적: 격자·출입구
  {
    const cell = (x, y) => (WORLD.DOORS[(YARD + x) + ',' + y] ? 'D' : WORLD.walkable(YARD + x, y) ? '.' : '#');
    ok([6, 7, 8].every((x) => cell(x, 5) === 'D' && WORLD.DOORS[(YARD + x) + ',5'].scene === 'classroom'), '출입구 칸 = 계단 (6~8, 5) → 교실');
    ok([6, 7, 8].every((x) => cell(x, 4) === '#'), '문 안쪽 (6~8, 4)은 다시 막힘');
    ok(cell(5, 5) === '#' && cell(9, 5) === '#', '계단 양옆 화분 칸 (5,5)·(9,5)은 막힘');
    ok([25, 26, 27].every((x) => cell(x, 4) === 'D'), '도서관 문 (25~27, 4)은 그대로');
    ok(WORLD.SPAWNS.hall.x === YARD + 7 && WORLD.SPAWNS.hall.y === 7, '현관 앞 시작 자리 = (7, 7)');
    const pth = WORLD.findPath({ x: YARD + 10, y: 5 }, (x, y) => x === YARD + 4 && y === 5, {});
    let cur = { x: YARD + 10, y: 5 }, hitDoor = false;
    (pth || []).forEach((d) => { cur = WORLD.stepFrom(cur.x, cur.y, d, {}); if (WORLD.DOORS[cur.x + ',' + cur.y]) hitDoor = true; });
    ok(pth && !hitDoor && cur.x === YARD + 4 && cur.y === 5, '(10,5) → (4,5) 길이 계단을 돌아서 감 ' + (pth || []).join(' '));
  }
  for (const key of WANT) {
    const { name: size, dev } = SIZES[key];
    // 1 출입구 표시와 핀(?debug=grid)
    const p = await open(makeMap('c1_e2_a'), dev, {}, '?debug=grid');
    await passTalk(p); await p.waitForTimeout(500);
    const ex = await p.evaluate(() => PrivacyMap.debug.exitCells().map((c) => [c.x, c.y]));
    ok(JSON.stringify(ex.sort()) === JSON.stringify([[YARD + 6, 5], [YARD + 7, 5], [YARD + 8, 5]]), `${size} 반짝이는 출입구 = 계단 세 칸 ${JSON.stringify(ex)}`);
    const mk = await p.evaluate(() => { const k = PrivacyMap.debug.marker(), t = PrivacyMap.debug.tileToClient, r = document.getElementById('m-canvas').getBoundingClientRect(); return k && { x: k.x, y: k.y, hidden: !!k.hidden, exit: !!k.exit, stairL: t(64 + 6, 5).x - r.left, stairR: t(64 + 8, 5).x - r.left, stairY: t(64 + 7, 5).y - r.top }; });
    const offscreen = mk && (mk.stairR < 0 || mk.stairL > dev.viewport.width); // 휴대폰은 교문 앞에서 계단이 화면 밖 → 가장자리 핀(화살표)
    ok(mk && mk.exit && (mk.hidden || offscreen || (mk.x >= mk.stairL - 30 && mk.x <= mk.stairR + 30 && mk.y <= mk.stairY + 10)), `${size} 느낌표 핀이 계단 위쪽에(계단이 화면 밖이면 가장자리 핀) ${JSON.stringify(mk)}`);
    await p.screenshot({ path: path.join(HERE, `_shot-yard-grid-${size}.png`) });
    // 2 계단을 밟으면 교실로
    await place(p, YARD + 7, 6, 'up');
    if (p.touch) await tapTile(p, YARD + 7, 5); else { await p.keyboard.down('ArrowUp'); await p.waitForTimeout(60); await p.keyboard.up('ArrowUp'); }
    let m = await settle(p); await waitHold(p);
    ok(m.x === CLASS + 15 && m.y === 16, `${size} 계단을 밟으면 교실 안 (15,16) ${JSON.stringify(m)}`);
    // 3 교실에서 나오면 [7,7], 다시 안 들어감, 핀이 머리에 안 얹힘
    await tapTile(p, CLASS + 15, 17); m = await settle(p); await waitHold(p); await p.waitForTimeout(900);
    m = await me(p);
    ok(m.x === YARD + 7 && m.y === 7, `${size} 교실에서 나오면 마당 (7,7)에 서 있음(다시 빨려 들어가지 않음) ${JSON.stringify(m)}`);
    await p.evaluate(() => PrivacyMap.debug.tick(2600)); await p.waitForTimeout(300); // '방금 지나온 문' 표시가 풀린 뒤의 핀
    const head = await p.evaluate(() => { const k = PrivacyMap.debug.marker(), r = PrivacyMap.debug.meRect(); return { k: k && { x: k.x, y: k.y, w: k.w, h: k.h, hidden: !!k.hidden, dim: !!k.dim }, r }; });
    const pin = head.k && !head.k.hidden && head.k.x != null ? { x0: head.k.x - head.k.w / 2, x1: head.k.x + head.k.w / 2, y0: head.k.y - head.k.h / 2, y1: head.k.y + head.k.h / 2 } : null;
    ok(!pin || !overlap(pin, head.r), `${size} (7,7)에 서 있을 때 느낌표 핀이 내 몸·머리와 안 겹침 ${JSON.stringify(head)}`);
    await p.screenshot({ path: path.join(HERE, `_shot-yard-arrived-${size}.png`) });
    // 4 계단 옆을 가로질러 가기
    await place(p, YARD + 10, 5, 'left'); await p.waitForTimeout(300);
    await tapTile(p, YARD + 4, 5); m = await settle(p);
    ok(m.x === YARD + 4 && m.y === 5, `${size} (10,5)에서 (4,5)를 누르면 교실로 안 들어가고 도착 ${JSON.stringify(m)}`);
    // 5 화분 칸: 키보드로 못 들어감
    if (!p.touch) {
      await place(p, YARD + 10, 5, 'left');
      for (let k = 0; k < 3; k++) { await p.keyboard.down('ArrowLeft'); await p.waitForTimeout(60); await p.keyboard.up('ArrowLeft'); await settle(p); }
      m = await me(p);
      ok(m.x === YARD + 10 && m.y === 5, `${size} (10,5)에서 ← 를 눌러도 화분 칸에 막혀 계단으로 못 감 ${JSON.stringify(m)}`);
    }
    ok(p.errors.length === 0, `${size} 오류 ${p.errors}`);
    await p.ctx.close();
    // 6 옛 저장 자리
    for (const [sx, sy] of [[7, 4], [6, 4], [7, 5]]) {
      const q = await open(makeMap('c1_e2_a'), dev, { pos: { x: YARD + sx, y: sy, dir: 'up', for: 'c1_e2_a', v: WORLD.VERSION } });
      await passTalk(q); await q.waitForTimeout(600);
      const s = await me(q);
      ok(s.x === YARD + 7 && s.y === 7, `${size} 옛 저장 (${sx},${sy}) → (7,7) ${JSON.stringify(s)}`);
      await q.waitForTimeout(700);
      ok((await me(q)).x === YARD + 7, `${size} 옛 저장 (${sx},${sy}): 교실로 끌려가지 않음`);
      ok(q.errors.length === 0, `${size} 옛 저장 오류 ${q.errors}`);
      await q.ctx.close();
    }
  }
} finally { await browser.close(); server.close(); }
console.log(`\n통과 ${pass} · 실패 ${fails.length}`);
if (fails.length) { fails.forEach((f) => console.log(' - ' + f)); process.exit(1); }
