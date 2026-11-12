// 2026-11-11 집 벽 그림(tools/house-walls.mjs) 전·후 비교 + 통과 검사: node privacy/tests/house-walls-1111.mjs
//   MODE=before,after(기본 둘 다) · SIZE=d,m(1280×800 · 390×844) · TINT=day,evening,night
//   before = house.webp/png 요청에 원본(assets/scenes/house-base.png)을 대신 내려 준다 → 언제 돌려도 같은 조건의 '전'을 다시 만들 수 있다.
//   after  = 지금 파일 그대로(게임이 실제로 쓰는 house.webp + 밤·저녁엔 벽 덧그림 house-walls-night.png).
//   light  = (기본으로는 안 돎, MODE=light) house.webp는 그대로, 밤 벽 덧그림만 막는다 = 2026-11-11 상태(밤에도 밝은 벽). 비교 그림 가운데 칸.
//   스크린샷 tests/_shot-walls-<before|light|after>-<자리>-<시간>-<화면>.png, 나란히 붙인 비교 tests/_shot-walls-cmp-<자리>-<시간>-<화면>.png (gitignore)
//     비교 그림 = 전(원본) | [밝은 벽(11-11) — light 스크린샷이 있을 때만] | 지금.
//   2026-11-12 밤 벽: 밝은 벽이 밤 화면에서 튀어 → map.js drawOuter가 밤(1)·저녁(0.3)에만 house-walls-night.png를 덧그린다. 낮은 덧그림 없음(벽 색 그대로).
//   브라우저는 한 번에 하나: D:/Works/.browser-test.lock(파일, 안에 누가 잡았는지 적음)을 스스로 잡고 끝나면 지운다(남의 잠금은 안 지움). COMPARE=only면 브라우저 없이 비교 그림만 다시 만든다.
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODES = (process.env.MODE || 'before,after').split(',');
const SIZES = { d: { name: '1280x800', dev: { viewport: { width: 1280, height: 800 } } },
  m: { name: '390x844', dev: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } } };
const TINTS = { day: 'pro_1', evening: 'c1_e1_a', night: 'c2_e5_a' }; // 걷기 트리거(world.js triggers[].tint)
const ROOM = WORLD.SCENES.find((s) => s.id === 'room').ox, VIL = WORLD.SCENES.find((s) => s.id === 'village').ox;
// 찍는 자리(우리 집 장면 칸): 방문 아래 복도 · 방↔거실 세로 벽 옆 · 현관 · 방 안(방문 위)
const VIEWS = [['door', 10, 13, 'up'], ['divider', 21, 11, 'left'], ['entry', 25, 15, 'down'], ['room', 10, 11, 'down']];
const shot = (n) => path.join(HERE, `_shot-walls-${n}.png`);
const LOCK = 'D:/Works/.browser-test.lock', LOCK_ME = 'privacy house-walls agent';
const NIGHT_PNG = /assets\/scenes\/house-walls-night\.png(\?.*)?$/, WALL_NIGHT = { day: 0, evening: 0.3, night: 1 }; // map.js WALL_NIGHT와 같은 값
const seen = {}; // 화면·시간대별 벽 윗면 밝기(전 ↔ 지금 견주기)

async function compare() {
  const sharp = require('D:/Works/sih26/node_modules/sharp');
  let n = 0;
  for (const key of (process.env.SIZE || 'd,m').split(',')) for (const tint of (process.env.TINT || 'day,evening,night').split(',')) for (const [view] of VIEWS) {
    const tag = `${view}-${tint}-${SIZES[key].name}`, a = shot('before-' + tag), b = shot('after-' + tag);
    if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
    const l = shot('light-' + tag), mid = tint !== 'day' && fs.existsSync(l) ? l : null, cols = mid ? 3 : 2; // 가운데 칸 = 밝은 벽 그대로(2026-11-11 상태)
    const ma = await sharp(a).metadata(), gap = 16, bar = 44;
    const label = (t) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ma.width}" height="${bar}"><rect width="100%" height="100%" fill="#222"/><text x="12" y="30" font-family="Malgun Gothic, sans-serif" font-size="24" fill="#fff">${t}</text></svg>`);
    const last = (ma.width + gap) * (cols - 1), nowLabel = tint === 'day' ? '후 (house.webp, 낮은 덧그림 없음)' : `지금 (밤 벽 덧그림 ${tint === 'night' ? '1' : '0.3'})`;
    await sharp({ create: { width: ma.width * cols + gap * (cols - 1), height: ma.height + bar, channels: 3, background: '#222222' } }).composite([
      { input: label(`전 (house-base.png) — ${tag}`), left: 0, top: 0 }, { input: a, left: 0, top: bar },
      ...(mid ? [{ input: label('11-11 밝은 벽 (덧그림 없음)'), left: ma.width + gap, top: 0 }, { input: mid, left: ma.width + gap, top: bar }] : []),
      { input: label(nowLabel), left: last, top: 0 }, { input: b, left: last, top: bar }
    ]).png().toFile(shot('cmp-' + tag));
    n++;
  }
  console.log(`비교 그림 ${n}장 → tests/_shot-walls-cmp-*.png`);
}
if (process.env.COMPARE === 'only') { await compare(); process.exit(0); }

// 잠금(다른 브라우저 검사와 한 번에 하나)
for (let i = 0; ; i++) {
  try { fs.writeFileSync(LOCK, LOCK_ME, { flag: 'wx' }); break; } catch (e) { if (i > 120) { console.error('잠금을 못 잡음(10분): ' + LOCK); process.exit(2); } if (i % 6 === 0) console.log('잠금 대기…'); await new Promise((r) => setTimeout(r, 5000)); }
}
const unlock = () => { try { if (fs.readFileSync(LOCK, 'utf8') === LOCK_ME) fs.unlinkSync(LOCK); } catch (e) { /* 이미 없음 · 남의 잠금 */ } };
process.on('exit', unlock); process.on('SIGINT', () => process.exit(130));
const killer = setTimeout(() => { console.error('시간 초과(9분) — 중단'); process.exit(3); }, 9 * 60 * 1000); killer.unref();

const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
function makeRun(target) { // playtest-1103.mjs와 같은 방식: 그 걷기 구간(map)에 닿는 진행 하나
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
const BASE_PNG = fs.readFileSync(path.join(HERE, '..', 'assets', 'scenes', 'house-base.png'));
let pass = 0; const fails = [], notes = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗ ' + m); } return !!c; };

async function open(run, dev, mode) {
  const ctx = await browser.newContext(dev);
  const page = await ctx.newPage(), errors = [], reqs = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (/assets\/scenes\/(house|room)\./.test(r.url())) reqs.push(r.url().replace(/^.*\/assets\//, '')); });
  const night = [];
  page.on('response', (r) => { if (NIGHT_PNG.test(r.url())) night.push(r.status()); });
  if (mode === 'before') await ctx.route(/assets\/scenes\/house\.(webp|png)(\?.*)?$/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: BASE_PNG }));
  if (mode !== 'after') await ctx.route(NIGHT_PNG, (r) => r.abort()); // 전·밝은 벽 = 밤 벽 덧그림 없이
  page.night = night;
  await page.addInitScript((p) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('ethicity.player', '{"character":"char_03","nickname":"반짝이는 고래"}');
    localStorage.setItem('ethicity.privacy.settings.v1', '{"speed":"instant","reduceMotion":true,"look":"f"}');
    localStorage.setItem('ethicity.privacy.progress.v2', p);
  }, JSON.stringify({ v: 1, run, explored: {}, endingsSeen: [] }));
  await page.goto(base);
  await page.click('#btn-continue');
  await page.waitForTimeout(1000);
  page.errors = errors; page.ctx = ctx; page.reqs = reqs;
  return page;
}
const me = (p) => p.evaluate(() => PrivacyMap.debug.me());
const place = async (p, x, y, dir = 'down') => { await p.evaluate(([a, b, c]) => PrivacyMap.debug.place(a, b, c), [x, y, dir]); await p.waitForTimeout(220); };
async function settle(p, ms = 9000) {
  const t0 = Date.now(); let n = 0;
  while (Date.now() - t0 < ms) { const m = await me(p); if (m.moving) n = 0; else if (++n > 6) return m; await p.waitForTimeout(40); }
  return me(p);
}
async function waitFree(p) { for (let i = 0; i < 40 && await p.evaluate(() => PrivacyMap.debug.holding()); i++) await p.waitForTimeout(50); }
async function press(p, key) { await waitFree(p); await p.keyboard.down(key); await p.waitForTimeout(40); await p.keyboard.up(key); return settle(p); }
async function walkCol(p, key, done) { const seen = []; for (let i = 0; i < 5; i++) { const m = await press(p, key); seen.push({ x: m.x, y: m.y, area: m.area }); if (done(m)) break; } return seen; } // 한 번 누름이 한 칸 또는 두 칸(느린 PC) — 지나간 칸을 모두 본다
// 캔버스에 실제로 그려진 색(장면 칸 가운데 + 칸 안 치우침) — 벽 그림이 화면에 나왔는지, 밤낮 밝기
const pixel = (p, tx, ty, fx = 0.5, fy = 0.5) => p.evaluate(([a, b, c, d]) => {
  const cv = document.getElementById('m-canvas'), r = cv.getBoundingClientRect(), o = PrivacyMap.debug.tileToClient(a, b), T = PrivacyMap.debug.view().T;
  const k = cv.width / r.width, x = Math.round((o.x - r.left + (c - 0.5) * T) * k), y = Math.round((o.y - r.top + (d - 0.5) * T) * k);
  if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) return null;
  const q = cv.getContext('2d').getImageData(x, y, 1, 1).data; return [q[0], q[1], q[2]];
}, [tx, ty, fx, fy]);
const lum = (c) => (c ? Math.round(0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) : null);

try {
  for (const mode of MODES) for (const key of (process.env.SIZE || 'd,m').split(',')) {
    const { name: size, dev } = SIZES[key];
    for (const tint of (process.env.TINT || 'day,evening,night').split(',')) {
      console.log(`── ${mode} ${size} ${tint}`);
      const p = await open(makeRun(TINTS[tint]), dev, mode);
      for (const [view, x, y, dir] of VIEWS) {
        await place(p, ROOM + x, y, dir); await p.waitForTimeout(250);
        const at = await me(p);
        ok(at.x === ROOM + x && at.y === y, `${mode} ${size} ${tint} ${view}: 자리 ${JSON.stringify(at)}`);
        await p.screenshot({ path: shot(`${mode}-${view}-${tint}-${size}`) });
        if (view === 'divider') { // 화면에 나온 색: 세로 벽 윗면(19,8) · 거실 바닥(23,11) · 거실 벽지(28.3,3.8 — 창과 냉장고 사이 빈 벽, 좁은 화면에선 화면 밖일 수 있다)
          const wall = await pixel(p, ROOM + 19, 8, 0.4, 0.5), floor = await pixel(p, ROOM + 23, 11), paper = await pixel(p, ROOM + 28, 3, 0.33, 0.83);
          const k = await p.evaluate(() => PrivacyMap.debug.marker());
          notes.push(`${mode} ${size} ${tint}: 벽 윗면 ${wall} (밝기 ${lum(wall)}) · 바닥 ${floor} (${lum(floor)}) · 벽지 ${paper} (${lum(paper)}) · 핀 ${k ? JSON.stringify({ x: Math.round(k.x), y: Math.round(k.y), exit: !!k.exit, off: !!k.off, dim: !!k.dim }) : '없음'}`);
          if (wall && tint === 'day') ok(mode === 'after' ? wall[0] > 180 && wall[0] - wall[2] < 45 : Math.abs(wall[0] - 110) < 12, `${mode} ${size}: 낮 벽 윗면 색 ${wall}`);
          (seen[size + ' ' + tint] ||= {})[mode] = lum(wall);
          if (wall && floor && mode === 'after' && tint !== 'night') ok((!paper || lum(wall) < lum(paper) + 6) && lum(wall) > lum(floor) * 0.7, `${mode} ${size} ${tint}: 벽 윗면이 벽지보다 밝지 않고 바닥보다 지나치게 어둡지 않다 ${lum(wall)}/${lum(paper)}/${lum(floor)}`);
          // 밤(2026-11-12): 벽이 방보다 먼저 눈에 들어오지 않게 — 벽 윗면이 바닥보다 어둡되(가라앉음) 새까맣지는 않다(바닥의 절반 이상)
          if (wall && floor && mode === 'after' && tint === 'night') ok(lum(wall) < lum(floor) && lum(wall) > lum(floor) * 0.5, `${mode} ${size} ${tint}: 밤 벽 윗면이 바닥보다 어둡고(가라앉음) 새까맣지 않다 ${lum(wall)}/${lum(floor)}`);
          if (wall && floor && mode === 'light' && tint === 'night') notes.push(`${mode} ${size} ${tint}: (참고) 덧그림이 없으면 벽 윗면 ${lum(wall)} > 바닥 ${lum(floor)} — ${lum(wall) > lum(floor) ? '재현됨' : '재현 안 됨'}`);
        }
      }
      const tv = await p.evaluate(() => PrivacyMap.debug.tint());
      ok(tv === tint, `${mode} ${size}: 시간대 ${tv} = ${tint}`);
      ok(p.reqs.some((u) => /house\.webp/.test(u)) && !p.reqs.some((u) => /house\.png/.test(u)), `${mode} ${size} ${tint}: house.webp만 요청(png 되돌리기 없음) ${p.reqs}`);
      { // 밤 벽 덧그림: 지금 판은 밤 1 · 저녁 0.3 · 낮 0(안 그림), 전·밝은 벽 판은 언제나 0. 그림은 낮에도 미리 받아 둔다(한 번, 200)
        const wn = await p.evaluate(() => PrivacyMap.debug.wallNight());
        ok(wn === (mode === 'after' ? WALL_NIGHT[tint] : 0), `${mode} ${size} ${tint}: 밤 벽 덧그림 세기 ${wn}`);
        if (mode === 'after') ok(p.night.length === 1 && p.night[0] === 200, `${mode} ${size} ${tint}: house-walls-night.png 한 번 받음(200) ${JSON.stringify(p.night)}`);
      }

      /* 통과: 방문(9~10,12)·현관(24~27,17), 문 옆 벽은 막힘 */
      if (tint === 'day') {
        for (const cx of [9, 10]) {
          await place(p, ROOM + cx, 11, 'down');
          const dn = await walkCol(p, 'ArrowDown', (m) => m.y >= 13);
          ok(dn.every((m) => m.x === ROOM + cx) && dn[dn.length - 1].y >= 13 && dn[dn.length - 1].area === '거실', `${mode} ${size}: 방문 ${cx}칸 아래로 통과 ${JSON.stringify(dn)}`);
          const up = await walkCol(p, 'ArrowUp', (m) => m.y <= 11);
          ok(up.every((m) => m.x === ROOM + cx) && up[up.length - 1].y <= 11 && up[up.length - 1].area === '내 방', `${mode} ${size}: 방문 ${cx}칸 위로 통과 ${JSON.stringify(up)}`);
        }
        await place(p, ROOM + 10, 12, 'down'); await p.waitForTimeout(200);
        await p.screenshot({ path: shot(`${mode}-doorway-${tint}-${size}`) }); // 방문 한가운데 선 모습(벽이 몸을 가리지 않는지)
        { // 벽 그림은 바탕이라 인물이 그 위에 그려진다: 방문 오른쪽 가로 벽 칸(11,12)의 화면 색이, 그 아래 칸(11,13)에 서면 몸(머리)으로 바뀐다
          await place(p, ROOM + 14, 15, 'down'); const bare = await pixel(p, ROOM + 11, 12, 0.5, 0.45), faceC = await pixel(p, ROOM + 14, 12, 0.5, 0.8), baseC = await pixel(p, ROOM + 14, 12, 0.5, 0.97), topC = await pixel(p, ROOM + 14, 12, 0.5, 0.3);
          await place(p, ROOM + 11, 13, 'down'); const body = await pixel(p, ROOM + 11, 12, 0.5, 0.45);
          const far = bare && body ? Math.max(Math.abs(bare[0] - body[0]), Math.abs(bare[1] - body[1]), Math.abs(bare[2] - body[2])) : -1;
          ok(far > 30, `${mode} ${size}: 벽 앞에 선 인물이 벽 그림에 가리지 않는다(벽 ${bare} → 몸 ${body})`);
          await p.screenshot({ path: shot(`${mode}-infront-${tint}-${size}`) });
          notes.push(`${mode} ${size}: 가로 벽 (14,12) 윗면 ${topC} · 옆면 ${faceC} · 걸레받이 ${baseC}`);
          if (mode === 'after') ok(topC && faceC && baseC && lum(topC) > lum(faceC) + 8 && lum(faceC) > lum(baseC) + 25, `${mode} ${size}: 가로 벽이 윗면 > 옆면 > 걸레받이 순으로 어두워진다 ${lum(topC)}/${lum(faceC)}/${lum(baseC)}`);
        }
        for (const [bx, by] of [[8, 13], [11, 13], [19, 13]]) { // 문 옆 가로 벽·세로 벽 아래 끝
          await place(p, ROOM + bx, by, 'up');
          const s = await press(p, 'ArrowUp');
          ok(s.x === ROOM + bx && s.y === by, `${mode} ${size}: 벽 (${bx},${by - 1})은 막힘 ${JSON.stringify(s)}`);
        }
        await place(p, ROOM + 17, 9, 'right'); // 방 안 오른쪽 끝 칸에서 세로 벽 쪽으로
        const w0 = await me(p), w1 = await press(p, 'ArrowRight');
        ok(w1.x === w0.x, `${mode} ${size}: 방↔거실 세로 벽은 막힘 ${JSON.stringify([w0, w1])}`);
        const route = await p.evaluate(([x, y]) => { PrivacyMap.debug.place(x + 6, 8, 'down'); const r = PrivacyMap.debug.routeTo(x + 25, 16); return r ? r.length : -1; }, [ROOM]);
        ok(route > 0, `${mode} ${size}: 방 안 → 현관 길 있음(${route}칸)`);
        await place(p, ROOM + 25, 16, 'down');
        const out = await press(p, 'ArrowDown'); await p.waitForTimeout(500);
        const fin = await settle(p);
        ok(fin.x >= VIL && fin.x < VIL + 32, `${mode} ${size}: 현관으로 나가면 마을 길 ${JSON.stringify([out, fin])}`);
      }
      if (tint === 'night') { // 목적지 핀(내 방 컴퓨터)이 벽 위에서도 보이는 자리에 있는지: 복도에서 본 핀
        await place(p, ROOM + 12, 13, 'up'); await p.waitForTimeout(250);
        { // 밤에도 벽으로 읽히는지: 가로 벽 (14,12) 윗면이 걸레받이보다는 밝다(옅게라도 면이 나뉜다)
          const topC = await pixel(p, ROOM + 14, 12, 0.5, 0.3), faceC = await pixel(p, ROOM + 14, 12, 0.5, 0.8), baseC = await pixel(p, ROOM + 14, 12, 0.5, 0.97), flo = await pixel(p, ROOM + 14, 14);
          notes.push(`${mode} ${size} 밤: 가로 벽 (14,12) 윗면 ${topC} (${lum(topC)}) · 옆면 ${faceC} (${lum(faceC)}) · 걸레받이 ${baseC} (${lum(baseC)}) · 복도 바닥 ${flo} (${lum(flo)})`);
          if (mode === 'after') ok(topC && faceC && baseC && flo && lum(topC) >= lum(faceC) && lum(topC) > lum(baseC) + 3 && lum(topC) < lum(flo), `${mode} ${size}: 밤 가로 벽 = 윗면 ≥ 옆면, 윗면 > 걸레받이, 윗면 < 복도 바닥 ${lum(topC)}/${lum(faceC)}/${lum(baseC)}/${lum(flo)}`);
        }
        const k = await p.evaluate(() => { const m = PrivacyMap.debug.marker(), cv = document.getElementById('m-canvas').getBoundingClientRect(); return m && { x: m.x, y: m.y, w: m.w, h: m.h, off: !!m.off, exit: !!m.exit, vw: cv.width, vh: cv.height }; });
        ok(k && !k.exit && k.x > 0 && k.y > 0 && k.x < k.vw && k.y < k.vh, `${mode} ${size}: 밤 목적지 핀이 화면 안 ${JSON.stringify(k)}`);
        await p.screenshot({ path: shot(`${mode}-pin-${tint}-${size}`) });
      }
      ok(p.errors.length === 0, `${mode} ${size} ${tint} 오류 ${p.errors}`);
      await p.ctx.close();
    }
  }
} finally {
  await browser.close(); server.close(); unlock();
}
for (const [k, v] of Object.entries(seen)) { // 밤: 지금 벽 윗면이 원본 갈색 띠(전)와 비슷한 밝기(±14) — '예전 어두운 덩어리만큼 조용하게'
  if (!/night/.test(k) || v.before == null || v.after == null) continue;
  ok(Math.abs(v.after - v.before) <= 14, `${k}: 밤 벽 윗면 밝기 지금 ${v.after} ↔ 전 ${v.before} (±14 안)`);
}
for (const n of notes) console.log('  · ' + n);
await compare();
console.log(`\n통과 ${pass} · 실패 ${fails.length}`);
for (const f of fails) console.log('  ✗ ' + f);
process.exit(fails.length ? 1 : 0);
