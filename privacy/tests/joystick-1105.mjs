// 2026-11-05 사용자 피드백 '조이스틱이 너무 예민함' 회귀 검사: node privacy/tests/joystick-1105.mjs (390×844 터치, CDP로 실제 터치 이벤트)
//   ① 살짝 민 입력 ② 대각선 ③ 빠른 방향 전환 ④ 영역 가장자리 누르기 ⑤ 문 지난 뒤 한 박자 ⑥ 키·탭과 섞이지 않음
//   손가락 위치는 받침 기준 px. 실제 손 느낌은 사람이 확인해야 한다(이 검사는 입력 판정만 본다).
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;
const DEV = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const CLASS = 0, YARD = 64;

function firstMap() { let s = E.createState(story); for (let i = 0; i < 50 && !(s.screen === 'map' && s.mapTarget === 'pro_1'); i++) s = E.advance(story, s); return s; }
const server = await startServer(0), base = `http://127.0.0.1:${server.address().port}/privacy/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let pass = 0; const fails = [];
const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (c) pass++; else fails.push(m); };

async function open() {
  const ctx = await browser.newContext(DEV), page = await ctx.newPage();
  page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript((p) => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear();
    localStorage.setItem('ethicity.player', '{"character":"char_03","nickname":"반짝이는 고래"}');
    localStorage.setItem('ethicity.privacy.settings.v1', '{"speed":"instant","reduceMotion":true,"look":"f"}');
    localStorage.setItem('ethicity.privacy.progress.v2', p);
  }, JSON.stringify({ v: 1, run: firstMap(), explored: {}, endingsSeen: [] }));
  await page.goto(base); await page.click('#btn-continue'); await page.waitForTimeout(1000);
  page.cdp = await ctx.newCDPSession(page); page.ctx = ctx;
  return page;
}
const me = (p) => p.evaluate(() => PrivacyMap.debug.me());
const place = async (p, x, y, d = 'down') => { await p.evaluate(([a, b, c]) => PrivacyMap.debug.place(a, b, c), [x, y, d]); await p.waitForTimeout(150); };
const touch = (p, type, x, y) => p.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
const center = (p) => p.evaluate(() => { const j = PrivacyMap.debug.joy(), r = document.getElementById('m-canvas').getBoundingClientRect(); return { x: r.left + (j.rest.x0 + j.rest.x1) / 2, y: r.top + (j.rest.y0 + j.rest.y1) / 2, top: r.top + j.rest.y0, bottom: r.top + j.rest.y1, left: r.left + j.rest.x0 }; });
const settle = async (p) => { for (let i = 0; i < 80; i++) { if (!(await me(p)).moving) return; await p.waitForTimeout(20); } };
const polar = (c, deg, r) => ({ x: c.x + Math.cos(deg * Math.PI / 180) * r, y: c.y + Math.sin(deg * Math.PI / 180) * r });
async function push(p, c, deg, r) { const q = polar(c, deg, r); await touch(p, 'touchMove', q.x, q.y); }
// 넓은 복도(거실 아래 줄)에서: 양쪽으로 여유가 많은 칸
const HALL = [128 + 10, 14];

try {
  const p = await open();
  const c = await center(p);

  // ① 살짝 민 입력
  await place(p, HALL[0], HALL[1], 'down');
  await touch(p, 'touchStart', c.x, c.y);
  await push(p, c, 0, 15); await p.waitForTimeout(450);
  let m = await me(p);
  ok(m.x === HALL[0] && m.y === HALL[1] && m.dir === 'down', `15px(반지름의 29%)로 0.45초: 걷지도 돌지도 않음 ${JSON.stringify(m)}`);
  await touch(p, 'touchEnd'); await p.waitForTimeout(80);

  await place(p, HALL[0], HALL[1], 'down');
  await touch(p, 'touchStart', c.x, c.y);
  await push(p, c, 0, 24); await p.waitForTimeout(40);
  await touch(p, 'touchEnd'); await settle(p); await p.waitForTimeout(150);
  m = await me(p);
  ok(m.x === HALL[0] && m.dir === 'right', `24px를 톡 건드림(40ms): 방향만 돌고 안 걸음 ${JSON.stringify(m)}`);

  await place(p, HALL[0], HALL[1], 'down');
  await touch(p, 'touchStart', c.x, c.y);
  await push(p, c, 0, 24); await p.waitForTimeout(600);
  await touch(p, 'touchEnd'); await settle(p);
  m = await me(p);
  ok(m.x > HALL[0], `24px를 계속 밀면 걷는다 → ${m.x - HALL[0]}칸`);

  // ② 대각선
  await place(p, HALL[0], 15, 'right'); // 아래위 여유
  await touch(p, 'touchStart', c.x, c.y);
  await push(p, c, 25, 40); await p.waitForTimeout(500); // 25° = 옛 판정에선 대각선
  await touch(p, 'touchEnd'); await settle(p);
  m = await me(p);
  ok(m.y === 15 && m.x > HALL[0], `오른쪽에서 25° 기운 입력: 옆으로 안 튐 dx ${m.x - HALL[0]} dy ${m.y - 15}`);

  await place(p, HALL[0], 13, 'right');
  await touch(p, 'touchStart', c.x, c.y);
  await push(p, c, 45, 40); await p.waitForTimeout(350);
  await touch(p, 'touchEnd'); await settle(p);
  m = await me(p);
  ok(m.x > HALL[0] && m.y > 13, `정확히 45°: 가로·세로 번갈아 dx ${m.x - HALL[0]} dy ${m.y - 13}`);

  await place(p, HALL[0], 15, 'right');
  await touch(p, 'touchStart', c.x, c.y);
  await push(p, c, 0, 40); await p.waitForTimeout(150);
  const seen = [];
  for (const deg of [36, 30, 40, 28, 38, 32]) { await push(p, c, deg, 40); await p.waitForTimeout(60); seen.push((await me(p)).y); }
  await touch(p, 'touchEnd'); await settle(p);
  m = await me(p);
  ok(m.y === 15, `가로로 걷다 경계(28~40°)에서 손가락이 떨려도 가로 유지 y ${seen}`);

  // ③ 빠른 방향 전환
  await place(p, HALL[0], HALL[1], 'right');
  await touch(p, 'touchStart', c.x, c.y);
  await push(p, c, 0, 40); await p.waitForTimeout(350);
  const a = await me(p);
  await push(p, c, 180, 40);
  const t0 = Date.now(); let back = 0;
  while (Date.now() - t0 < 800) { const q = await me(p); if (q.x < a.x) { back = Date.now() - t0; break; } await p.waitForTimeout(10); }
  await touch(p, 'touchEnd'); await settle(p);
  ok(a.x > HALL[0] && back > 0 && back < 500, `오른쪽 → 왼쪽 빠른 전환: 멈춤 없이 ${back}ms 안에 되돌아 걸음`);

  await place(p, HALL[0], HALL[1], 'right');
  await touch(p, 'touchStart', c.x, c.y);
  await push(p, c, 0, 30); await p.waitForTimeout(250);
  await push(p, c, 90, 30); await p.waitForTimeout(250);
  await push(p, c, 180, 30); await p.waitForTimeout(250);
  await touch(p, 'touchEnd'); await settle(p);
  m = await me(p);
  ok(m.y > HALL[1], `→ ↓ ← 연속 전환도 따라감 ${JSON.stringify(m)}`);

  // ④ 영역 가장자리를 눌렀을 때: 3px 떨림으로 걷지 않음(옛: 받침이 안쪽으로 당겨져 큰 입력으로 쳤다)
  await place(p, HALL[0], HALL[1], 'down');
  const z = await p.evaluate(() => { const r = document.getElementById('joy').getBoundingClientRect(); return { x: r.left + 8, y: r.bottom - 6 }; });
  await touch(p, 'touchStart', z.x, z.y);
  await touch(p, 'touchMove', z.x + 2, z.y - 2); await p.waitForTimeout(300);
  const j = await p.evaluate(() => PrivacyMap.debug.joy());
  m = await me(p);
  await touch(p, 'touchEnd'); await settle(p);
  ok(m.x === HALL[0] && m.y === HALL[1] && j.mag < 0.2, `영역 가장자리 + 3px 떨림: 안 걸음 mag ${j.mag.toFixed(2)} ${JSON.stringify(m)}`);

  // ⑤ 문 지난 뒤 한 박자: 교실 문 앞에서 아래로 계속 밀기 → 마당 도착 → 멈췄다가 이어 걷기(되돌아 문으로 안 감)
  await place(p, CLASS + 15, 16, 'down');
  await touch(p, 'touchStart', c.x, c.y);
  await push(p, c, 90, 40);
  let arrivedAt = 0, moveAt = 0; const t1 = Date.now();
  while (Date.now() - t1 < 2500) {
    const q = await me(p);
    if (!arrivedAt && q.x >= YARD) arrivedAt = Date.now();
    if (arrivedAt && (q.moving || q.y !== 5)) { moveAt = Date.now(); break; }
    await p.waitForTimeout(10);
  }
  await touch(p, 'touchEnd'); await settle(p);
  m = await me(p);
  ok(arrivedAt && moveAt - arrivedAt >= 200 && moveAt - arrivedAt < 900 && m.x >= YARD && m.y > 5, `문 지난 뒤 ${moveAt - arrivedAt}ms 쉬고 같은 방향으로 이어 걷기 ${JSON.stringify(m)}`);

  // ⑥ 섞임: 조이스틱을 미는 동안 탭은 무시, 키를 누르면 조이스틱 입력 끝
  await place(p, HALL[0], HALL[1], 'right');
  await touch(p, 'touchStart', c.x, c.y);
  await push(p, c, 0, 30); await p.waitForTimeout(200);
  const before = await me(p);
  await p.evaluate(() => { const cv = document.getElementById('m-canvas'), r = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + 40, clientY: r.top + 300, bubbles: true })); });
  await p.waitForTimeout(250);
  const after = await me(p);
  ok(after.x >= before.x && after.y === before.y, `미는 중 탭은 무시(계속 오른쪽) ${before.x} → ${after.x}`);
  await touch(p, 'touchEnd'); await settle(p);
  await place(p, HALL[0], HALL[1], 'right');
  await touch(p, 'touchStart', c.x, c.y);
  await push(p, c, 0, 30); await p.waitForTimeout(200);
  const j0 = await p.evaluate(() => PrivacyMap.debug.joy());
  await p.keyboard.down('ArrowLeft'); await p.waitForTimeout(60); await p.keyboard.up('ArrowLeft');
  const jj = await p.evaluate(() => PrivacyMap.debug.joy());
  await settle(p);
  const k0 = await me(p); await p.waitForTimeout(350); const k1 = await me(p); // 키를 뗀 뒤 손가락이 그대로여도 더 걷지 않는다
  await touch(p, 'touchEnd'); await settle(p);
  ok(j0.on === true && jj.on === false && k0.x === k1.x, `키를 누르면 조이스틱 입력이 끝남 ${JSON.stringify({ before: j0.on, after: jj.on, x: [k0.x, k1.x] })}`);
  ok(p.errors.length === 0, '콘솔 오류 없음 ' + p.errors);
  await p.ctx.close();
} finally {
  await browser.close(); server.close();
}
console.log(`\n통과 ${pass} · 실패 ${fails.length}`);
fails.forEach((f) => console.log('  ✗ ' + f));
process.exit(fails.length ? 1 : 0);
