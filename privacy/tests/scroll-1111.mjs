// 2026-11-11 플레이테스트: 화면을 열 때 늘 맨 위부터(장 카드 안 스크롤 상자 포함). node privacy/tests/scroll-1111.mjs
//   a 장 카드(특별 수업)를 끝까지 내리고 '계속하기' → 특별 수업을 지나 다음 장 카드(2장)가 맨 위에서 열림 (1280×800 · 1280×560 · 390×844)
//   b 엔딩 화면을 내린 채 '선택 경로 돌아보기' → 맨 위, 돌아가기 → 엔딩 화면 맨 위
//   c 채팅(폰) 창은 예전처럼 새 메시지 쪽(맨 아래)을 따라감
//   ONLY=a,b,c. PLAYWRIGHT_PATH = playwright 모듈 경로(기본 token_economy). 브라우저 검사는 한 번에 하나(D:/Works/.browser-test.lock)
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;
const ONLY = (process.env.ONLY || 'a,b,c').split(',');
const SIZES = [{ name: '1280x800', dev: { viewport: { width: 1280, height: 800 } } }, { name: '1280x560', dev: { viewport: { width: 1280, height: 560 } } },
  { name: '390x844', dev: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } }];

function makeRun(hit) {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let tries = 0; tries < 40000; tries++) {
    let s = E.createState(story);
    for (let step = 0; step < 600; step++) {
      if (hit(s)) { s.history = s.history.slice(-1); return s; }
      if (s.screen === 'ending') break;
      if (s.screen === 'scene' && E.needsChoice(story, s)) { const cs = E.visibleChoices(story, story.scenes[s.scene], s); s = E.choose(story, s, cs[Math.floor(rnd() * cs.length)].id); s.history = []; }
      s = E.advance(story, s);
    }
  }
  throw new Error('경로 없음');
}
const server = await startServer(0), base = `http://127.0.0.1:${server.address().port}/privacy/?debug=1`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗ ' + m); } return !!c; };
async function open(run, dev) {
  const ctx = await browser.newContext(dev); const page = await ctx.newPage(); page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript((p) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1'); localStorage.clear();
    localStorage.setItem('ethicity.player', '{"character":"char_03","nickname":"반짝이는 고래"}');
    localStorage.setItem('ethicity.privacy.settings.v1', '{"speed":"instant","reduceMotion":true,"look":"f"}');
    localStorage.setItem('ethicity.privacy.progress.v2', p);
  }, JSON.stringify({ v: 1, run, explored: {}, endingsSeen: [] }));
  await page.goto(base); await page.click('#btn-continue'); await page.waitForTimeout(900);
  page.ctx = ctx; return page;
}
const view = (p) => p.evaluate(() => document.body.getAttribute('data-view'));
// 그 화면 안에서 스크롤돼 있는 상자와 창 스크롤
const scrolled = (p, id) => p.evaluate((id) => {
  const out = []; const root = document.getElementById(id);
  [root, ...root.querySelectorAll('*')].forEach((n) => { if (n.scrollTop > 0) out.push((n.id || n.className || n.tagName) + ':' + Math.round(n.scrollTop)); });
  return { win: Math.round(window.scrollY), inner: out };
}, id);
// 장 카드·화면을 끝까지 내린다 → 실제로 내려간 양(내려갈 것이 없으면 0)
const scrollDown = (p, id) => p.evaluate((id) => {
  const root = document.getElementById(id); let moved = 0;
  [root, ...root.querySelectorAll('*')].forEach((n) => { if (n.scrollHeight > n.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(n).overflowY)) { n.scrollTop = n.scrollHeight; moved += n.scrollTop; } });
  window.scrollTo(0, document.documentElement.scrollHeight); moved += window.scrollY;
  return Math.round(moved);
}, id);
// 게임을 앞으로: 걷기는 '목적지로 바로 가기', 대화창은 넘기고, 선택지는 첫 번째 — until()이 참이 될 때까지
async function drive(p, until, max = 400) {
  for (let k = 0; k < max; k++) {
    if (await until()) return true;
    await p.evaluate(() => {
      const v = document.body.getAttribute('data-view');
      if (window.PrivacyTalk && PrivacyTalk.isOpen()) { PrivacyTalk.next(); return; }
      if (v === 'v-map') { // 목적지 옆으로 옮긴 뒤 말 걸기·조사 버튼
        const b = document.getElementById('btn-map-skip'); if (b && !b.hidden) b.click();
        setTimeout(() => { if (document.body.getAttribute('data-view') === 'v-map' && !PrivacyTalk.isOpen()) document.getElementById('btn-map-act').click(); }, 70);
        return;
      }
      if (v === 'v-game') { const c = document.querySelector('#g-dock .choice'); if (c) { c.click(); return; } const n = document.querySelector('#g-next button, #g-dock #btn-next, #g-dock .btn.primary'); if (n) n.click(); }
    });
    await p.waitForTimeout(140);
  }
  return false;
}

try {
  if (ONLY.includes('a')) for (const sz of SIZES) {
    const p = await open(makeRun((s) => s.screen === 'chapter' && s.nextChapter === 'sc'), sz.dev);
    ok(await view(p) === 'v-chapter', `${sz.name} 장 카드(특별 수업)가 열림`);
    const top0 = await scrolled(p, 'v-chapter');
    ok(top0.win === 0 && top0.inner.length === 0, `${sz.name} 첫 장 카드는 맨 위 ${JSON.stringify(top0)}`);
    const moved = await scrollDown(p, 'v-chapter');
    console.log(`  ${sz.name} 장 카드를 내린 양 ${moved}px`);
    if (sz.name !== '1280x800') ok(moved > 0, `${sz.name} 장 카드가 넘쳐 실제로 내려감(${moved}px) — 검사가 의미 있음`);
    await p.click('#btn-chapter-go'); await p.waitForTimeout(400);
    const reached = await drive(p, async () => (await view(p)) === 'v-chapter' && (await p.evaluate(() => PrivacyApp.state().nextChapter)) === 2);
    ok(reached, `${sz.name} 특별 수업을 지나 2장 카드에 닿음 ${reached ? '' : JSON.stringify(await p.evaluate(() => { const s = PrivacyApp.state(); return { view: document.body.getAttribute('data-view'), screen: s.screen, scene: s.scene, mapTarget: s.mapTarget, next: s.nextChapter, reaction: s.reaction, talk: PrivacyTalk.isOpen(), skipHidden: document.getElementById('btn-map-skip').hidden, dock: document.getElementById('g-dock').textContent.slice(0, 60), staging: PrivacyApp.staging() }; }))}`);
    await p.waitForTimeout(300);
    const top1 = await scrolled(p, 'v-chapter');
    ok(top1.win === 0 && top1.inner.length === 0, `${sz.name} 다음 장 카드가 맨 위에서 열림 ${JSON.stringify(top1)}`);
    const head = await p.evaluate(() => { const e = document.getElementById('c-eyebrow').getBoundingClientRect(), t = document.getElementById('c-title').getBoundingClientRect(), c = document.querySelector('.chapter-card').getBoundingClientRect(); return { eyebrowIn: e.top >= c.top - 1 && e.bottom <= innerHeight, titleIn: t.top >= c.top - 1 && t.bottom <= innerHeight, text: document.getElementById('c-eyebrow').textContent }; });
    ok(head.eyebrowIn && head.titleIn, `${sz.name} 'N장' 표시와 제목이 보임 ${JSON.stringify(head)}`);
    ok(p.errors.length === 0, `${sz.name} a 오류 ${p.errors}`);
    await p.ctx.close();
  }
  if (ONLY.includes('b')) for (const sz of [SIZES[0], SIZES[2]]) {
    const p = await open(makeRun((s) => s.screen === 'scene' && s.scene === 'ep_1' && !s.reaction), sz.dev);
    const atEnd = await drive(p, async () => (await view(p)) === 'v-ending', 200);
    ok(atEnd, `${sz.name} 엔딩 화면에 닿음`);
    for (let k = 0; k < 14; k++) { await p.keyboard.press('Enter'); await p.waitForTimeout(150); } // 엔딩 연출 넘기기
    await p.waitForTimeout(400);
    const e0 = await scrolled(p, 'v-ending');
    ok(e0.win === 0 && e0.inner.length === 0, `${sz.name} 엔딩 화면이 맨 위에서 열림 ${JSON.stringify(e0)}`);
    const moved = await scrollDown(p, 'v-ending');
    ok(moved > 0, `${sz.name} 엔딩 화면을 내림(${moved}px)`);
    await p.evaluate(() => document.getElementById('btn-end-path').click()); await p.waitForTimeout(400);
    const p0 = await scrolled(p, 'v-path');
    ok((await view(p)) === 'v-path' && p0.win === 0 && p0.inner.length === 0, `${sz.name} 선택 경로 화면이 맨 위 ${JSON.stringify(p0)}`);
    await scrollDown(p, 'v-path');
    await p.evaluate(() => document.getElementById('btn-path-back').click()); await p.waitForTimeout(400);
    const e1 = await scrolled(p, await view(p));
    ok(e1.win === 0 && e1.inner.length === 0, `${sz.name} 돌아간 화면도 맨 위 ${JSON.stringify(e1)}`);
    ok(p.errors.length === 0, `${sz.name} b 오류 ${p.errors}`);
    await p.ctx.close();
  }
  if (ONLY.includes('c')) {
    const sz = SIZES[2];
    const p = await open(makeRun((s) => s.screen === 'scene' && s.scene === 'c1_e1_a' && !s.reaction), sz.dev);
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => { const ph = document.getElementById('g-phone'); return { top: Math.round(ph.scrollTop), max: Math.round(ph.scrollHeight - ph.clientHeight), lines: ph.querySelectorAll('.ln').length }; });
    ok(r.max <= 4 || r.top >= r.max - 4, `채팅 창은 새 메시지 쪽(맨 아래)을 따라감 ${JSON.stringify(r)}`);
    ok(r.max > 4, `채팅 창이 넘쳐 스크롤이 생김(검사가 의미 있음) ${JSON.stringify(r)}`);
    ok(p.errors.length === 0, `c 오류 ${p.errors}`);
    await p.ctx.close();
  }
} finally { await browser.close(); server.close(); }
console.log(`\n통과 ${pass} · 실패 ${fails.length}`);
if (fails.length) { fails.forEach((f) => console.log(' - ' + f)); process.exit(1); }
