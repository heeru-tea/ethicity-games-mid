// 2026-11-03 플레이테스트 지시서 확인 목록: node privacy/tests/playtest-1103.mjs  (PLAYWRIGHT_PATH = playwright 모듈 경로, 기본 token_economy)
//   데스크톱 1280×800(마우스) · 모바일 세로 390×844(터치) 둘 다.
//   a 출구 핀 고정 · b 문을 지나면 멈춤 · c 도착 직후 버튼 · d 대화 겹침·민준이 장면·이름표·?·말풍선 · e 내 방 충돌·조사 · f 침대 장면 · g 옛 저장 · h 스크린샷
//   ONLY=a,b,... 로 일부만, SIZE=d|m 으로 한 화면만. 스크린샷 = tests/_shot-1103-*.png(gitignore)
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ONLY = (process.env.ONLY || 'a,b,c,d,e,f,g,h').split(',');
const SIZES = { d: { name: '1280x800', dev: { viewport: { width: 1280, height: 800 } } },
  m: { name: '390x844', dev: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } } };
const shot = (n) => path.join(HERE, `_shot-1103-${n}.png`);
const CLASS = 0, LIB = 32, YARD = 64, VIL = 96, ROOM = 128;

function makeRun(target, opts = {}) {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let tries = 0; tries < 20000; tries++) {
    let s = E.createState(story);
    for (let step = 0; step < 500 && s.screen !== 'ending'; step++) {
      const hit = opts.map ? s.screen === 'map' && s.mapTarget === target : s.screen === 'scene' && s.scene === target && !s.reaction;
      if (hit) { s.history = s.history.slice(-1); return s; }
      if (s.screen === 'scene' && E.needsChoice(story, s)) { const cs = E.visibleChoices(story, story.scenes[s.scene], s); s = E.choose(story, s, cs[Math.floor(rnd() * cs.length)].id); s.history = []; }
      s = E.advance(story, s);
    }
  }
  throw new Error('경로 없음: ' + target);
}

const server = await startServer(0), base = `http://127.0.0.1:${server.address().port}/privacy/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let pass = 0; const fails = [], table = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗ ' + m); } return !!c; };
const rec = (size, item, c, note = '') => { table.push([size, item, c ? '통과' : '실패', note]); ok(c, `${size} ${item} ${note}`); };

async function open(run, dev, extra = {}) {
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
  }, JSON.stringify({ v: 1, run, explored: {}, endingsSeen: [], ...extra }));
  await page.goto(base + (dev.query || ''));
  await page.click('#btn-continue');
  await page.waitForTimeout(1000);
  page.errors = errors; page.ctx = ctx; page.touch = !!dev.hasTouch;
  return page;
}
const close = (p) => p.ctx.close();
const me = (p) => p.evaluate(() => PrivacyMap.debug.me());
const place = async (p, x, y, dir = 'down') => { await p.evaluate(([a, b, c]) => PrivacyMap.debug.place(a, b, c), [x, y, dir]); await p.waitForTimeout(160); };
const btn = (p) => p.evaluate(() => { const b = document.getElementById('btn-map-act'); return { t: b.textContent.trim(), ghost: b.classList.contains('ghost'), primary: b.classList.contains('primary') }; });
const marker = (p) => p.evaluate(() => PrivacyMap.debug.marker());
const hit = (p, x, y) => (p.touch ? p.touchscreen.tap(x, y) : p.mouse.click(x, y));
async function tapPin(p) {
  const m = await p.evaluate(() => { const k = PrivacyMap.debug.marker(), r = document.getElementById('m-canvas').getBoundingClientRect(); return k && k.x != null ? { x: r.left + k.x, y: r.top + k.y } : null; });
  if (!m) return false;
  await hit(p, m.x, m.y); return true;
}
async function tapTile(p, x, y) { const c = await p.evaluate(([a, b]) => PrivacyMap.debug.tileToClient(a, b), [x, y]); await hit(p, c.x, c.y); }
async function settle(p, ms = 9000) { // 멈출 때까지
  const t0 = Date.now(); let n = 0;
  while (Date.now() - t0 < ms) { const m = await me(p); if (m.moving) n = 0; else if (++n > 6) return m; await p.waitForTimeout(40); }
  return me(p);
}
async function press(p, key, ms = 40) { await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key); await settle(p); }
async function passTalk(p) { for (let k = 0; k < 40 && await p.evaluate(() => PrivacyTalk.isOpen()); k++) { await p.evaluate(() => PrivacyTalk.next()); await p.waitForTimeout(60); } }
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const tagRect = (r) => ({ x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h });

try {
  for (const key of (process.env.SIZE || 'd,m').split(',')) {
    const { name: size, dev } = SIZES[key];
    console.log('── ' + size);

    /* a. 출구 핀 */
    if (ONLY.includes('a')) {
      // 내 방(거실 쪽 현관) 매트 바로 위 칸, 매트를 좌우로 걸어도 핀 고정
      const p = await open(makeRun('pro_1', { map: true }), dev);
      await place(p, ROOM + 24, 16, 'down');
      const xs = [], ys = [];
      for (const x of [24, 25, 26, 27]) {
        await place(p, ROOM + x, 16, 'down');
        const k = await p.evaluate(() => { const m = PrivacyMap.debug.marker(), c = PrivacyMap.debug.cam(); return { x: m.x + c.x, y: m.y + c.y }; }); xs.push(k.x); ys.push(k.y); // 장면 좌표(카메라가 따라와도 핀 자리는 같아야)
      }
      const c0 = await p.evaluate(() => { const cs = PrivacyMap.debug.exitCells(), a = Math.min(...cs.map((c) => c.x0)), b = Math.max(...cs.map((c) => c.x1)), cam = PrivacyMap.debug.cam(); return { mid: (a + b) / 2 + cam.x, y0: cs[0].y0, y1: cs[0].y1 }; });
      const r = await p.evaluate(() => PrivacyMap.debug.meRect());
      const k1 = await marker(p);
      rec(size, '내 방 문 매트 위 칸: 핀이 매트 위(머리 위 아님)', k1.exit && k1.y >= r.y1 - 2 && Math.abs(k1.y - (c0.y0 + c0.y1) / 2) <= 8, JSON.stringify({ y: k1.y, feet: r.y1, mat: [c0.y0, c0.y1], off: k1.off }));
      rec(size, '매트 위를 좌우로 걸어도 핀 고정', new Set(xs.map(Math.round)).size === 1 && new Set(ys.map(Math.round)).size === 1 && Math.abs(xs[0] - c0.mid) <= 2, `x ${xs.map(Math.round)} y ${ys.map(Math.round)} 가운데 ${Math.round(c0.mid)}`);
      rec(size, '문 바로 옆: 핀 흐리게', k1.dim === true, JSON.stringify(k1));
      await place(p, ROOM + 25, 14, 'down');
      rec(size, '문에서 떨어지면 핀 또렷', !(await marker(p)).dim, '');
      await p.screenshot({ path: shot(`pin-room-${size}`) });
      ok(p.errors.length === 0, 'a 오류 ' + p.errors); await close(p);
      // 교실 하교 시작 위치
      const q = await open(makeRun('c1_e1_a', { map: true }), dev);
      const m0 = await me(q), t = WORLD.SPAWNS.classroom;
      const k2 = await marker(q), r2 = await q.evaluate(() => PrivacyMap.debug.meRect());
      const cs2 = await q.evaluate(() => PrivacyMap.debug.exitCells());
      rec(size, '교실 하교 시작: 핀이 매트 위(머리 위 아님)', m0.x === t.x && m0.y === t.y && k2.y >= r2.y1 && k2.y <= cs2[0].y1 + 4, JSON.stringify({ me: m0, y: k2.y, feet: r2.y1, mat: cs2[0].y0 }));
      await q.screenshot({ path: shot(`pin-class-${size}`) });
      // 위쪽 출구(마당 → 교실): 핀은 매트 바로 바깥
      await close(q);
      const u = await open(makeRun('pro_1', { map: true }), dev);
      await place(u, YARD + 7, 8, 'up');
      const ku = await marker(u);
      const cu = await u.evaluate(() => PrivacyMap.debug.exitCells());
      ok(ku.exit && ku.tx >= YARD + 6 && ku.tx <= YARD + 8, '위쪽 출구도 핀 ' + JSON.stringify(ku));
      ok(!ku.off ? ku.y + ku.h / 2 <= cu[0].y0 + 4 : true, '위쪽 출구: 핀이 매트 바로 위 ' + JSON.stringify({ ku, cu: cu[0] }));
      // e) 탭: 핀을 누르면 문으로 간다
      const before = (await me(u)).area;
      await tapPin(u); await settle(u);
      rec(size, '핀 탭 판정(마당 → 교실)', (await me(u)).x === CLASS + 15, before + ' → ' + JSON.stringify(await me(u)));
      await close(u);
    }

    /* b. 문을 지나면 멈춤 */
    if (ONLY.includes('b')) {
      // 마을 길 왼쪽 끝 → 집 문 핀(지시서 2번·확인 목록)
      const p = await open(makeRun('c1_e1_a', { map: true }), dev);
      await place(p, VIL + 1, 6, 'right');
      let at = null;
      for (let i = 0; i < 12 && !(at && at.x >= ROOM); i++) { await tapPin(p); at = await settle(p); } // 화면 밖이면 가장자리 핀을 여러 번
      await p.waitForTimeout(700);
      const st = await me(p);
      rec(size, '마을 길 왼쪽 끝 → 집 문 핀 → 현관 안쪽에 멈춤', st.x === ROOM + 25 && st.y === 16 && !st.moving, JSON.stringify(st));
      await close(p);
      // 다른 문들: 매트 탭으로 지나 도착 칸에 멈춘다
      const cases = [
        ['교실 → 마당', 'pro_1', CLASS + 15, 16, CLASS + 15, 17, YARD + 7, 5],
        ['마당 → 교실', 'pro_1', YARD + 7, 5, YARD + 7, 4, CLASS + 15, 16],
        ['도서관 → 마당', 'pro_1', LIB + 15, 16, LIB + 15, 17, YARD + 26, 5],
        ['마당 → 도서관', 'pro_1', YARD + 26, 5, YARD + 26, 4, LIB + 15, 16],
        ['교문 → 마을 길', 'pro_1', YARD + 15, 16, YARD + 15, 17, VIL + 1, 6],
        ['마을 길 → 교문', 'pro_1', VIL + 1, 6, VIL + 0, 6, YARD + 15, 16],
        ['집 → 마을 길', 'pro_1', ROOM + 25, 16, ROOM + 25, 17, VIL + 24, 12]
      ];
      const q = await open(makeRun('pro_1', { map: true }), dev);
      for (const [n, , x0, y0, dx, dy, ax, ay] of cases) {
        await place(q, x0, y0, 'down');
        await tapTile(q, dx, dy); await settle(q); await q.waitForTimeout(500);
        const m = await me(q);
        rec(size, '문 지나 도착 칸에서 멈춤: ' + n, m.x === ax && m.y === ay, JSON.stringify(m));
      }
      ok(q.errors.length === 0, 'b 오류 ' + q.errors);
      await close(q);
      // 키를 누른 채 문을 지나면 한 박자 멈췄다가 이어 걷는다(키보드가 있는 화면에서)
      if (!dev.hasTouch) {
        const k = await open(makeRun('pro_1', { map: true }), dev);
        await place(k, CLASS + 15, 16, 'down');
        await k.keyboard.down('ArrowDown');
        let t0 = 0, moved = 0; const start = Date.now();
        while (Date.now() - start < 3000) {
          const m = await me(k);
          if (!t0 && m.x >= YARD) t0 = Date.now();
          if (t0 && (m.moving || m.y !== 5)) { moved = Date.now() - t0; break; }
          await k.waitForTimeout(10);
        }
        await k.keyboard.up('ArrowDown');
        await settle(k);
        rec(size, '누른 키: 문 지나고 한 박자 쉬었다 이어 걷기', moved >= 200 && moved < 900, moved + 'ms 뒤 다시 걸음');
        await close(k);
      }
    }

    /* c. 도착 직후 버튼 */
    if (ONLY.includes('c')) {
      const q = await open(makeRun('pro_1', { map: true }), dev);
      for (const [n, x0, y0, dx, dy, ax] of [['마당', CLASS + 15, 16, CLASS + 15, 17, YARD + 7], ['교실', YARD + 7, 5, YARD + 7, 4, CLASS + 15], ['마을 길', YARD + 15, 16, YARD + 15, 17, VIL + 1], ['집(현관)', VIL + 24, 12, VIL + 24, 11, ROOM + 25]]) {
        await place(q, x0, y0, 'down');
        await tapTile(q, dx, dy); await settle(q); await q.waitForTimeout(350);
        const b = await btn(q), m = await me(q);
        rec(size, `${n}에 막 도착: 큰 버튼이 지나온 문을 안 가리킴`, m.x === ax && b.t === '말 걸기 · 조사하기' && b.ghost && !b.primary, JSON.stringify({ b, m }));
      }
      // 2칸 걷고 돌아오면 다시 문 버튼
      if (!dev.hasTouch) {
        await place(q, YARD + 7, 5, 'up'); await tapTile(q, YARD + 7, 4); await settle(q); await q.waitForTimeout(350);
        await press(q, 'ArrowLeft'); await press(q, 'ArrowLeft'); await press(q, 'ArrowRight'); await press(q, 'ArrowRight');
        const b = await btn(q), a = await q.evaluate(() => PrivacyMap.debug.arrived());
        ok(a === null && /마당으로 가기/.test(b.t), '2칸 걸은 뒤에는 문 버튼이 돌아옴 ' + JSON.stringify({ a, b }));
        // 매트를 다시 밟는 것은 된다
        await q.waitForTimeout(100);
        await place(q, YARD + 7, 5, 'up'); await tapTile(q, YARD + 7, 4); await settle(q); await q.waitForTimeout(350);
        await press(q, 'ArrowDown');
        ok((await me(q)).x === YARD + 7, '도착 직후에도 걸어서 매트를 밟으면 돌아간다 ' + JSON.stringify(await me(q)));
      }
      ok(q.errors.length === 0, 'c 오류 ' + q.errors);
      await close(q);
    }

    /* d. 겹침 */
    if (ONLY.includes('d')) {
      // 4-1 말 걸 때 몸 겹침: 하늘·지호(오프닝 마당), 새봄(교실) — 옆에서·위아래에서
      const p = await open(makeRun('pro_1', { map: true }), dev);
      const cast = WORLD.triggers.pro_1.cast;
      for (const who of ['haneul', 'jiho']) {
        const c = cast.filter((k) => k.who === who)[0];
        await place(p, c.x - 1, c.y, 'right');
        await p.evaluate(() => document.getElementById('btn-map-act').click());
        await p.waitForTimeout(350);
        const r = await p.evaluate((w) => { const D = PrivacyMap.debug, b = D.bodies(); return { me: b.filter((k) => k.who === 'me')[0], o: b.filter((k) => k.who === w)[0], n: D.nudge(), open: PrivacyTalk.isOpen(), T: D.view().T }; }, who);
        rec(size, `${who}에게 말 걸 때 몸이 안 겹침(옆)`, r.open && r.me.x1 <= r.o.x0 + 0.5, JSON.stringify({ gap: r.o.x0 - r.me.x1, T: r.T, n: r.n }));
        if (who === 'haneul') await p.screenshot({ path: shot(`talk-side-${size}`) });
        await passTalk(p); await p.waitForTimeout(200);
        ok((await p.evaluate(() => PrivacyMap.debug.nudge())) === null, '대화가 끝나면 원래대로');
        await p.waitForTimeout(100);
      }
      { // 위아래로 붙으면 좌우로 비킴(하늘은 이미 말 걸어 ? 없음 — 목적지가 아니라 대화만 열린다)
        const c = cast.filter((k) => k.who === 'haneul')[0];
        await place(p, c.x, c.y + 1, 'up');
        await p.evaluate(() => document.getElementById('btn-map-act').click());
        await p.waitForTimeout(350);
        const n = await p.evaluate(() => PrivacyMap.debug.nudge());
        ok(n && Math.abs(n.cx) >= 0.2 && n.cx * n.mx < 0, '위아래로 붙으면 좌우로 비킴 ' + JSON.stringify(n));
        await p.screenshot({ path: shot(`talk-vert-${size}`) });
        await passTalk(p); await p.waitForTimeout(100);
      }
      { // 새봄 = 이 걷기의 목적지(말 걸면 장면이 열림) → 마지막에
        const c = cast.filter((k) => k.who === 'saebom')[0];
        await place(p, c.x - 1, c.y, 'right');
        await p.evaluate(() => document.getElementById('btn-map-act').click());
        await p.waitForTimeout(350);
        const r = await p.evaluate(() => { const D = PrivacyMap.debug, b = D.bodies(); return { me: b.filter((k) => k.who === 'me')[0], o: b.filter((k) => k.who === 'saebom')[0], n: D.nudge(), open: PrivacyTalk.isOpen() }; });
        rec(size, 'saebom에게 말 걸 때 몸이 안 겹침(옆)', r.open && r.me.x1 <= r.o.x0 + 0.5, JSON.stringify({ gap: r.o.x0 - r.me.x1, n: r.n }));
        await p.screenshot({ path: shot(`talk-saebom-${size}`) });
      }
      ok(p.errors.length === 0, 'd 오류 ' + p.errors);
      await close(p);
      // 4-2 민준이 장면: 셋이 2칸 이상, 이름표가 몸을 덮지 않음
      const s = await open(makeRun('c1_e2_a'), dev);
      for (let k = 0; k < 40 && await s.evaluate(() => PrivacyTalk.isOpen()); k++) { await s.waitForTimeout(40); break; }
      await s.waitForTimeout(500);
      const st = WORLD.STAGES.c1_e2_a, mj = st.cast.filter((c) => c.who === 'minjun')[0], hn = st.cast.filter((c) => c.who === 'haneul')[0];
      const gap = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
      const g = await s.evaluate(() => { const D = PrivacyMap.debug; return { bodies: D.bodies(), tags: D.tags(), stage: D.stage() }; });
      const covers = [];
      for (const t of g.tags) for (const b of g.bodies) if (b.who !== t.who && overlap(tagRect(t), b)) covers.push(t.label + '↔' + b.who);
      rec(size, '민준이 장면: 셋이 서로 2칸 이상', gap(st.me, mj) >= 2 && gap(st.me, hn) >= 2 && gap(mj, hn) >= 2, '');
      rec(size, '민준이 장면: 이름표가 얼굴을 안 덮음', covers.length === 0 && g.tags.length >= 3, covers.join(',') + ' 이름표 ' + g.tags.length);
      await s.screenshot({ path: shot(`minjun-stage-${size}`) });
      await close(s);
      // 4-3 맵의 ?: 지금 배치 + 일부러 겹치게 한 배치(하늘을 민준이 머리 바로 위로)
      const m = await open(makeRun('c1_e2_a', { map: true }), dev);
      await place(m, CLASS + 22, 11, 'right'); await m.waitForTimeout(200);
      const k0 = await marker(m);
      await m.screenshot({ path: shot(`minjun-map-${size}`) });
      const clash0 = await m.evaluate(() => { const k = PrivacyMap.debug.marker(); const r = { x0: k.x - k.w / 2, x1: k.x + k.w / 2, y0: k.y - k.h / 2, y1: k.y + k.h / 2 };
        const oth = PrivacyMap.debug.tags().filter((t) => t.who !== 'minjun').map((t) => ({ x0: t.x, x1: t.x + t.w, y0: t.y, y1: t.y + t.h })).concat(PrivacyMap.debug.bodies().filter((b) => b.who !== 'minjun'));
        return oth.filter((b) => r.x0 < b.x1 && b.x0 < r.x1 && r.y0 < b.y1 && b.y0 < r.y1).length; });
      rec(size, '민준이 ?가 다른 인물 몸·이름표와 안 겹침', clash0 === 0 && k0.who === 'minjun', JSON.stringify(k0));
      await m.evaluate(() => { const h = PRIVACY_WORLD.triggers.c1_e2_a.cast.filter((c) => c.who === 'haneul')[0]; h.x = 29; h.y = 8; PrivacyMap.show(PrivacyApp.state()); });
      await m.waitForTimeout(300);
      await place(m, CLASS + 22, 11, 'right'); await m.waitForTimeout(250);
      const k3 = await marker(m);
      await m.screenshot({ path: shot(`minjun-map-forced-${size}`) });
      const clash = await m.evaluate(() => { const k = PrivacyMap.debug.marker(); const r = { x0: k.x - k.w / 2, x1: k.x + k.w / 2, y0: k.y - k.h / 2, y1: k.y + k.h / 2 };
        const oth = PrivacyMap.debug.tags().filter((t) => t.who !== 'minjun').map((t) => ({ x0: t.x, x1: t.x + t.w, y0: t.y, y1: t.y + t.h }));
        return oth.filter((b) => r.x0 < b.x1 && b.x0 < r.x1 && r.y0 < b.y1 && b.y0 < r.y1).length; });
      rec(size, '? 규칙: 일부러 겹치면 비키고 꼬리로 잇기', clash === 0 && k3.tail === true, JSON.stringify(k3));
      await close(m);
      // 4-4 말풍선 ↔ 이름표
      const b = await open(makeRun('pro_1', { map: true }), dev);
      const hc = cast.filter((c) => c.who === 'haneul')[0];
      await place(b, hc.x - 2, hc.y, 'right');
      await b.keyboard.press('ArrowRight'); await settle(b); await b.waitForTimeout(300);
      const br = await b.evaluate(() => ({ b: PrivacyMap.debug.bubbleRects(), t: PrivacyMap.debug.tags() }));
      const bh = [];
      for (const q of br.b) for (const t of br.t) if (overlap({ x0: q.x, x1: q.x + q.w, y0: q.y, y1: q.y + q.h }, tagRect(t))) bh.push(t.label);
      rec(size, '말풍선이 이름표를 안 덮음', br.b.length > 0 && bh.length === 0, JSON.stringify(br));
      await b.screenshot({ path: shot(`bubble-${size}`) });
      await close(b);
    }

    /* e. 내 방 충돌·조사 */
    if (ONLY.includes('e')) {
      const p = await open(makeRun('pro_1', { map: true }), dev);
      const spots = [['bed', 6, 7, '침대'], ['mypc', 15, 8, '컴퓨터'], ['plush', 15, 10, '판다'], ['dtable', 24, 10, '식탁'], ['sofa', 22, 10, '소파'], ['corkboard', 7, 7, '코르크보드']];
      for (const [id, x, y, label] of spots) {
        const o = WORLD.object(id);
        const dir = x + ROOM >= o.x + o.w ? 'left' : y >= o.y + o.h ? 'up' : 'right';
        await place(p, ROOM + x, y, dir);
        const b = await btn(p);
        rec(size, `${label} 옆에서 조사 버튼`, b.t.includes(o.name), b.t);
        await p.evaluate(() => document.getElementById('btn-map-act').click());
        await p.waitForTimeout(200);
        const txt = await p.evaluate(() => document.querySelector('.talk-text').textContent);
        ok(txt.includes(o.look.slice(0, 6)), `${label} 조사 문구 ${txt}`);
        await passTalk(p); await p.waitForTimeout(80);
      }
      // 충돌: 방문 말고는 방 ↔ 거실이 막혀 있다
      const blocked = await p.evaluate(() => { const W = PRIVACY_WORLD, r = 128; let open = []; for (let x = 0; x < 32; x++) if (W.walkable(r + x, 12)) open.push(x); return { open, bed: W.walkable(r + 3, 7), desk: W.walkable(r + 14, 6), panda: W.walkable(r + 17, 11) }; });
      rec(size, '방문은 한 칸 + 침대·책상·인형 충돌', blocked.open.join() === '10,20,21,22,23,24,25,26,27,28,29,30' && !blocked.bed && !blocked.desk && !blocked.panda, JSON.stringify(blocked));
      await close(p);
    }

    /* f. 침대 장면 */
    if (ONLY.includes('f')) {
      const p = await open(makeRun('c1_e1_a', { map: true }), dev);
      await place(p, ROOM + 6, 7, 'left');
      const k0 = await marker(p), bed = WORLD.object('bed');
      await p.screenshot({ path: shot(`bed-before-${size}`) });
      const w = await p.evaluate(([x, y]) => PrivacyMap.debug.tileToClient(x, y), [bed.pin.x - 0.5, bed.pin.y - 0.5]);
      const cr = await p.evaluate(() => { const r = document.getElementById('m-canvas').getBoundingClientRect(); return { l: r.left, t: r.top }; });
      rec(size, '침대 핀이 매트리스 가운데', Math.abs(cr.l + k0.x - w.x) <= 3 && Math.abs(cr.t + k0.y - w.y) <= 12 + 3, JSON.stringify({ k0, w, cr }));
      await p.evaluate(() => document.getElementById('btn-map-act').click());
      await p.waitForTimeout(250);
      const a = await p.evaluate(() => ({ pose: PrivacyMap.debug.pose(), tint: PrivacyMap.debug.tint(), talk: document.querySelector('.talk-text').textContent }));
      rec(size, '침대 조사: 침대 위에 누움 + 밤 조명(인사말 동안)', a.pose === 'lie' && a.tint === 'night' && /침대에 눕자/.test(a.talk), JSON.stringify(a));
      await p.screenshot({ path: shot(`bed-greet-${size}`) });
      await passTalk(p); await p.waitForTimeout(900);
      const b = await p.evaluate(() => ({ st: PrivacyApp.state().scene, d: PrivacyMap.debug.stage(), pose: PrivacyMap.debug.pose(), tint: PrivacyMap.debug.tint(), at: PrivacyMap.debug.drawRect() }));
      rec(size, '이어지는 단톡 장면: 침대 위 + 밤', b.st === 'c1_e1_a' && b.pose === 'lie' && b.tint === 'night' && Math.abs(b.at.x - WORLD.BED_ME.x) < 0.01, JSON.stringify(b));
      await p.screenshot({ path: shot(`bed-scene-${size}`) });
      ok(p.errors.length === 0, 'f 오류 ' + p.errors);
      await close(p);
    }

    /* g. 옛 저장 */
    if (ONLY.includes('g')) {
      const run = makeRun('c1_e1_a', { map: true });
      const p = await open(run, dev, { pos: { x: ROOM + 15, y: 16, dir: 'up', for: 'c1_e1_a', v: 3 } });
      const m = await me(p), s = WORLD.SPAWNS.classroom;
      const fine = await p.evaluate(() => document.body.getAttribute('data-view'));
      rec(size, '옛 세이브(v3 위치) 이어 하기: 오류 없이 장면 시작점', m.x === s.x && m.y === s.y && fine === 'v-map' && p.errors.length === 0, JSON.stringify({ m, fine, e: p.errors }));
      await close(p);
      const p2 = await open(makeRun('c1_e2_b'), dev, { pos: { x: ROOM + 15, y: 16, dir: 'up', for: 'c1_e3_a', v: 3 } });
      rec(size, '옛 세이브(장면 중) 이어 하기: 오류 없음', p2.errors.length === 0, p2.errors.join());
      await close(p2);
    }

    /* h. 스크린샷: 방 전체·격자, 시작 화면, 폰 스크롤바 */
    if (ONLY.includes('h')) {
      const p = await open(makeRun('pro_1', { map: true }), { ...dev, query: '?debug=grid' });
      await place(p, ROOM + 8, 9, 'down'); await p.waitForTimeout(250);
      await p.screenshot({ path: shot(`room-grid-${size}`) });
      await close(p);
      const q = await open(makeRun('pro_1', { map: true }), dev);
      await place(q, ROOM + 8, 9, 'down'); await q.waitForTimeout(250);
      await q.screenshot({ path: shot(`room-${size}`) });
      await place(q, ROOM + 24, 13, 'down'); await q.waitForTimeout(250);
      await q.screenshot({ path: shot(`living-${size}`) });
      await close(q);
      // 폰 스크롤바: 말이 많이 쌓인 장면(사건 1 계좌번호 쪽)
      const c = await open(makeRun('c1_e1_b'), dev);
      await c.waitForTimeout(600);
      const sc = await c.evaluate(() => { const ph = document.getElementById('g-phone'); return ph ? { sh: ph.scrollHeight, ch: ph.clientHeight, cw: ph.clientWidth, ow: ph.offsetWidth, sbw: getComputedStyle(ph).scrollbarGutter } : null; });
      console.log('  폰 스크롤:', JSON.stringify(sc));
      await c.screenshot({ path: shot(`phone-${size}`) });
      await close(c);
      // 스크롤바까지 그린 화면(Playwright는 기본으로 스크롤바를 숨긴다) — 데스크톱은 창을 줄여 넘치게
      if (!dev.hasTouch) {
        const b2 = await chromium.launch({ channel: 'msedge', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
        const c2 = await (await b2.newContext({ viewport: { width: 1280, height: 620 } })).newPage();
        await c2.addInitScript((p) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear();
          localStorage.setItem('ethicity.player', '{"character":"char_03","nickname":"반짝이는 고래"}');
          localStorage.setItem('ethicity.privacy.settings.v1', '{"speed":"instant","reduceMotion":true,"look":"f"}');
          localStorage.setItem('ethicity.privacy.progress.v2', p); }, JSON.stringify({ v: 1, run: makeRun('c1_e1_b'), explored: {}, endingsSeen: [] }));
        await c2.goto(base); await c2.click('#btn-continue'); await c2.waitForTimeout(1500);
        const sb = await c2.evaluate(() => { const ph = document.getElementById('g-phone'); return { sh: ph.scrollHeight, ch: ph.clientHeight, cw: ph.clientWidth, ow: ph.offsetWidth }; });
        console.log('  스크롤바 켠 폰:', JSON.stringify(sb));
        await c2.screenshot({ path: shot('phone-scrollbar') });
        await b2.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log('\n항목 표');
for (const r of table) console.log(r.slice(0, 3).join(' | ') + (r[2] === '실패' ? ' | ' + r[3] : ''));
console.log(`\n통과 ${pass} · 실패 ${fails.length}`);
fails.forEach((f) => console.log('  ✗ ' + f));
process.exit(fails.length ? 1 : 0);
