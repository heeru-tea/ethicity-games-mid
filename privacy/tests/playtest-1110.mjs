// 2026-11-10 플레이테스트 수정 확인(브라우저): node privacy/tests/playtest-1110.mjs  (PLAYWRIGHT_PATH = playwright 모듈 경로, 기본 token_economy)
//   a "찍을까?"(c1_e2_a): 선택지가 떠 있을 때 엎드린 민준이·하늘·주인공이 선택 상자·대화창 밑에 가리지 않음 (1280×800 · 1148×977 · 390×844)
//   b 사과 장면(c3_e9_j): 지호와 마주 선 무대, 선택지 둘, 오류 없음
//   c AI 도우미(c2_e5_a): 자료 설명이 실제 단톡방에 올라간 정보(하늘이 계좌·전화번호)로
//   ONLY=a,b,c · 스크린샷 = tests/_shot-1110-*.png(gitignore). 브라우저 검사는 한 번에 하나(D:/Works/.browser-test.lock)
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ONLY = (process.env.ONLY || 'a,b,c').split(',');
const SIZES = [{ name: '1280x800', dev: { viewport: { width: 1280, height: 800 } } }, { name: '1148x977', dev: { viewport: { width: 1148, height: 977 } } },
  { name: '390x844', dev: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } }];
const shot = (n) => path.join(HERE, `_shot-1110-${n}.png`);

// 무작위로 걸어 들어가 그 장면(선택 전)에 선 상태. want(s)가 있으면 그 조건도 맞는 것만
function makeRun(target, want) {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let tries = 0; tries < 40000; tries++) {
    let s = E.createState(story);
    for (let step = 0; step < 500 && s.screen !== 'ending'; step++) {
      if (s.screen === 'scene' && s.scene === target && !s.reaction) { if (want && !want(s)) break; s.history = s.history.slice(-1); return s; }
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

async function open(run, dev) {
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
  await page.goto(base);
  await page.click('#btn-continue');
  await page.waitForTimeout(1000);
  page.errors = errors; page.ctx = ctx;
  return page;
}
// 대화창을 끝까지 넘겨 선택지가 뜰 때까지
async function toChoices(p) {
  for (let k = 0; k < 60; k++) {
    if (await p.evaluate(() => document.querySelectorAll('#g-dock .choice').length > 0)) break;
    if (await p.evaluate(() => PrivacyTalk.isOpen())) await p.evaluate(() => PrivacyTalk.next());
    await p.waitForTimeout(80);
  }
  await p.waitForTimeout(500); // 카메라가 새 '보이는 영역'으로 옮겨 감(움직임 줄이기라 바로)
  return p.evaluate(() => document.querySelectorAll('#g-dock .choice').length);
}
// 인물 몸(캔버스 좌표) → 화면 좌표, 가리는 상자(선택 상자·대화창·폰)
const layout = (p) => p.evaluate(() => {
  const cv = document.getElementById('m-canvas').getBoundingClientRect();
  const bodies = PrivacyMap.debug.bodies().map((b) => ({ who: b.who, x0: cv.left + b.x0, x1: cv.left + b.x1, y0: cv.top + b.y0, y1: cv.top + b.y1 }));
  const boxes = ['#g-dock', '#talk', '#g-phone'].map((q) => { const e = document.querySelector(q); if (!e || e.hidden || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return r.width < 8 || r.height < 8 ? null : { q, x0: r.left, x1: r.right, y0: r.top, y1: r.bottom }; }).filter(Boolean);
  return { bodies, boxes, view: { w: innerWidth, h: innerHeight }, cv: { x0: cv.left, y0: cv.top, x1: cv.right, y1: cv.bottom } };
});
const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

try {
  if (ONLY.includes('a')) for (const sz of SIZES) {
    const p = await open(makeRun('c1_e2_a'), sz.dev);
    const n = await toChoices(p);
    ok(n === 3, `${sz.name} 찍을까?: 선택지 3개가 뜸 (${n})`);
    const L = await layout(p);
    for (const who of ['minjun', 'haneul', 'me']) {
      const b = L.bodies.filter((x) => x.who === who)[0];
      if (!ok(!!b, `${sz.name} 찍을까?: ${who} 몸이 그려짐`)) continue;
      const area = (b.x1 - b.x0) * (b.y1 - b.y0);
      const hid = L.boxes.reduce((s, o) => s + overlap(b, o), 0);
      const inside = b.x0 >= L.cv.x0 - 1 && b.x1 <= L.cv.x1 + 1 && b.y0 >= L.cv.y0 - 1 && b.y1 <= L.cv.y1 + 1;
      ok(hid / area < 0.05 && inside, `${sz.name} 찍을까?: ${who}가 선택 상자·대화창에 가리지 않고 화면 안 (가린 비율 ${(hid / area * 100).toFixed(0)}%, 화면 안 ${inside})`);
    }
    ok(p.errors.length === 0, `${sz.name} a 오류 ${p.errors}`);
    await p.screenshot({ path: shot(`shoot-${sz.name}`) });
    await p.ctx.close();
  }
  if (ONLY.includes('b')) for (const sz of [SIZES[0], SIZES[2]]) {
    const p = await open(makeRun('c3_e9_j'), sz.dev);
    const n = await toChoices(p);
    ok(n === 2, `${sz.name} 사과 장면: 선택지 2개 (${n})`);
    const L = await layout(p), st = await p.evaluate(() => PrivacyMap.debug.stage());
    ok(st.cast.join() === 'jiho', `${sz.name} 사과 장면: 무대에 지호만 (${st.cast})`);
    const me = L.bodies.filter((x) => x.who === 'me')[0], jh = L.bodies.filter((x) => x.who === 'jiho')[0];
    ok(me && jh && overlap(me, jh) === 0, `${sz.name} 사과 장면: 나와 지호가 겹치지 않음`);
    for (const b of [me, jh].filter(Boolean)) ok(L.boxes.reduce((s, o) => s + overlap(b, o), 0) / ((b.x1 - b.x0) * (b.y1 - b.y0)) < 0.05, `${sz.name} 사과 장면: ${b.who}가 상자에 가리지 않음`);
    const texts = await p.evaluate(() => [...document.querySelectorAll('#g-dock .choice')].map((b) => b.textContent.trim()));
    ok(/사과한다/.test(texts[0]) && /설명한다/.test(texts[1]), `${sz.name} 사과 장면: 선택지 문구 ${texts.join(' / ')}`);
    await p.screenshot({ path: shot(`sorry-${sz.name}`) });
    await p.click('#g-dock .choice'); await p.waitForTimeout(600);
    const s2 = await p.evaluate(() => PrivacyApp.state());
    ok(s2.flags.e9j === 'sorry' && s2.trust.jiho < 0 && s2.reaction === 'sorry', `${sz.name} 사과 장면: 사과 뒤 e9j·지호 믿음 ${s2.flags.e9j} ${s2.trust.jiho}`);
    ok(p.errors.length === 0, `${sz.name} b 오류 ${p.errors}`);
    await p.ctx.close();
  }
  if (ONLY.includes('c')) {
    const sz = SIZES[0];
    for (const [name, want, re] of [['하늘이 번호만', (s) => s.flags.e1 !== 'public', /28명 이름 · 하늘이 계좌·전화번호 포함/], ['내 계좌도', (s) => s.flags.e1 === 'public', /하늘이 계좌·전화번호 · 내 계좌번호 포함/]]) {
      const p = await open(makeRun('c2_e5_a', want), sz.dev);
      await p.waitForTimeout(800);
      const txt = await p.evaluate(() => (document.getElementById('g-phone') || document.body).textContent);
      ok(re.test(txt) && !/28명 이름·전화번호·계좌번호/.test(txt) && !/\[\[/.test(txt), `AI 도우미 자료 설명(${name})`);
      ok(p.errors.length === 0, `c 오류 ${p.errors}`);
      if (name === '내 계좌도') await p.screenshot({ path: shot(`lumi-${sz.name}`) });
      await p.ctx.close();
    }
  }
} finally {
  await browser.close(); server.close();
}
console.log(`\n통과 ${pass} · 실패 ${fails.length}`);
if (fails.length) { fails.forEach((f) => console.log(' - ' + f)); process.exit(1); }
