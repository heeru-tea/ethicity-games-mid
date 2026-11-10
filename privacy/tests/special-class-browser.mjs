// 특별 수업 「우리 교실에 AI CCTV를 단다면」(2026-11-10) 브라우저 검사: node privacy/tests/special-class-browser.mjs (PLAYWRIGHT_PATH, SIZE=w,d,m)
//   장 카드 · 마당→교실 문 워프 · 특별실 토론 · 이전 선택 · 선생님 정리 · 2장 카드 요약 · 결과 화면 칸 · 휴대폰 무대.
//   스크린샷 tests/_shot-sc-*.png(gitignore). 브라우저 잠금(D:/Works/.browser-test.lock)은 실행하는 쪽에서.
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SIZES = {
  w: { name: '1148x977', dev: { viewport: { width: 1148, height: 977 } } },
  d: { name: '1280x800', dev: { viewport: { width: 1280, height: 800 } } },
  m: { name: '390x844', dev: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } } };
const shot = (n) => path.join(HERE, `_shot-sc-${n}.png`);

// 엔진으로 미리 진행한 상태(prefs: 장면별 선택 id, 없으면 첫 선택) — stop(state)이 참이면 그 상태
function runTo(prefs, stop) {
  let s = E.createState(story);
  for (let i = 0; i < 800; i++) {
    if (stop(s)) { s.history = s.history.slice(-1); return s; }
    if (s.screen === 'scene' && E.needsChoice(story, s)) { const cs = E.visibleChoices(story, story.scenes[s.scene], s); s = E.choose(story, s, (cs.find((c) => c.id === prefs[s.scene]) || cs[0]).id); }
    s = E.advance(story, s);
  }
  throw new Error('못 감');
}
const SC_B = { sc_1: 'on', sc_2: 'all', sc_3: 'open', sc_4: 'open' };

const server = await startServer(0), base = `http://127.0.0.1:${server.address().port}/privacy/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let pass = 0; const fails = [], table = [];
const rec = (size, item, c, note = '') => { table.push([size, item, c ? '통과' : '실패', note]); if (c) pass++; else { fails.push(`${size} ${item} ${note}`); console.log(`  ✗ ${size} ${item} ${note}`); } };
async function open(dev, run, settings = { speed: 'instant', reduceMotion: true, look: 'm', helpFold: true, helpPlaces: ['a', 'b', 'c'] }) {
  const ctx = await browser.newContext(dev), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((p) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.clear();
    localStorage.setItem('ethicity.privacy.settings.v1', JSON.stringify(p.settings));
    if (p.run) localStorage.setItem('ethicity.privacy.progress.v2', JSON.stringify({ v: 1, run: p.run, explored: {}, endingsSeen: [] })); }, { run, settings });
  await page.goto(base); await page.waitForTimeout(500);
  page.errors = errors; page.ctx = ctx;
  if (run) { await page.click('#btn-continue'); await page.waitForTimeout(700); }
  return page;
}
const close = (p) => p.ctx.close();
const st = (p) => p.evaluate(() => PrivacyApp.state());
// 대화창·넘기기를 다음 선택지(또는 장 카드·엔딩)가 나올 때까지
async function until(p, want, n = 60) {
  for (let k = 0; k < n; k++) {
    const r = await p.evaluate(() => ({ v: document.body.getAttribute('data-view'), ch: document.querySelectorAll('#g-dock .choice').length }));
    if (want(r)) return r;
    await p.evaluate(() => { if (window.PrivacyTalk && PrivacyTalk.isOpen()) { PrivacyTalk.next(); return; } const b = document.querySelector('#g-next .skip-btn, #g-next #btn-next, #g-dock #btn-next'); if (b) b.click(); });
    await p.waitForTimeout(150);
  }
  return null;
}
const pick = (p, id) => p.evaluate((id) => { const b = [...document.querySelectorAll('#g-dock .choice')].find((x) => x.getAttribute('data-choice') === id); if (b) b.click(); return !!b; }, id);

try {
  for (const key of (process.env.SIZE || 'w,d,m').split(',')) {
    const { name: size, dev } = SIZES[key];
    console.log('── ' + size);
    // card: 1장 끝 → 특별 수업 장 카드
    {
      const p = await open(dev, runTo({}, (s) => s.screen === 'chapter' && s.nextChapter === 'sc'));
      const c = await p.evaluate(() => ({ v: document.body.getAttribute('data-view'), eb: document.getElementById('c-eyebrow').textContent, t: document.getElementById('c-title').textContent,
        btn: document.getElementById('btn-chapter-go').textContent, sum: document.getElementById('c-summary').textContent }));
      rec(size, 'card 장 카드 = 특별 수업', c.v === 'v-chapter' && c.eb === '특별 수업' && c.t === story.chapters.sc.title && c.btn === '특별 수업 시작' && /1장/.test(c.sum), JSON.stringify(c).slice(0, 220));
      await p.screenshot({ path: shot(`card-${size}`) });
      // walk: 걷기 시작(마당) → 교실 문으로 들어가면 특별실
      await p.click('#btn-chapter-go'); await p.waitForTimeout(1500);
      const w0 = await p.evaluate(() => ({ v: document.body.getAttribute('data-view'), area: PrivacyMap.debug.me().area }));
      const yox = WORLD.SCENES.find((x) => x.id === 'yard').ox;
      await p.evaluate((x) => PrivacyMap.debug.place(x, 5, 'up'), yox + 7); await p.waitForTimeout(300);
      await p.keyboard.down('ArrowUp'); await p.waitForTimeout(250); await p.keyboard.up('ArrowUp'); await p.waitForTimeout(1200);
      const w1 = await p.evaluate(() => ({ area: PrivacyMap.debug.me().area, mission: document.getElementById('m-mission').textContent }));
      rec(size, 'walk 마당에서 시작 → 교실 문 = 특별실', w0.v === 'v-map' && /현관|마당/.test(w0.area) && w1.area === 'AI 실습실' && /선생님/.test(w1.mission), JSON.stringify([w0, w1]));
      ok2(p);
      await close(p);
    }
    // debate·undo·wrap·2장 카드 요약
    {
      const p = await open(dev, runTo({}, (s) => s.screen === 'scene' && s.scene === 'sc_1'));
      const d0 = await p.evaluate(() => ({ cast: PrivacyMap.debug.stage().cast, chap: document.getElementById('g-chap').textContent }));
      const r = await until(p, (x) => x.ch > 0);
      const cgDown = await p.evaluate(() => document.getElementById('cg').hidden && !document.body.classList.contains('cg-on'));
      rec(size, 'debate 선택지가 뜰 때 감지 화면 그림은 내려가 있음', cgDown);
      rec(size, 'debate 특별실 무대 다섯 · HUD 특별 수업 · 선택지 2개', d0.cast.sort().join() === 'haneul,jiho,minjun,saebom,teacher' && /특별 수업 · 정보 시간/.test(d0.chap) && r && r.ch === 2, JSON.stringify(d0));
      if (key === 'm') { // 휴대폰 무대: 이름표·말풍선이 위 버튼 아래, 장면 밖 빈 칸 없음
        const m = await p.evaluate(() => { const cv = document.getElementById('m-canvas').getBoundingClientRect();
          const top = Math.max(...['.hud-left', '.hud .bar-actions'].map((q) => document.querySelector(q)).filter((e) => e && e.getClientRects().length).map((e) => e.getBoundingClientRect().bottom - cv.top));
          return { top, tags: PrivacyMap.debug.tags().filter((t) => t.y < top - 1).map((t) => t.label), bub: PrivacyMap.debug.bubbleRects().filter((b) => b.y < top - 1).length }; });
        rec(size, 'mobile 이름표·말풍선 위 버튼 아래', m.tags.length === 0 && m.bub === 0, JSON.stringify(m));
        await p.screenshot({ path: shot(`debate-${size}`) });
      }
      await pick(p, 'on'); await until(p, (x) => x.ch === 3);
      await pick(p, 'safety'); await until(p, (x) => x.ch === 3);
      const s3 = await st(p);
      await p.click('#btn-undo'); await p.waitForTimeout(300); await p.click('#confirm-yes'); await p.waitForTimeout(500); await until(p, (x) => x.ch === 3);
      const su = await st(p);
      rec(size, 'undo sc_3에서 이전 선택 → sc_2, 목적 플래그 되돌림', s3.scene === 'sc_3' && su.scene === 'sc_2' && !su.flags.ccxPurpose && su.flags.ccx === 'on', JSON.stringify([s3.scene, su.scene, su.flags.ccxPurpose]));
      await pick(p, 'all'); await until(p, (x) => x.ch === 3);
      await pick(p, 'open'); await until(p, (x) => x.ch === 3);
      await pick(p, 'open');
      const lines = [];
      for (let k = 0; k < 40; k++) {
        const t = await p.evaluate(() => { const e = document.querySelector('#talk .talk-text'); return e && !document.getElementById('talk').hidden ? e.textContent : null; });
        if (t) lines.push(t);
        const v = await p.evaluate(() => document.body.getAttribute('data-view'));
        if (v === 'v-chapter') break;
        await p.evaluate(() => { if (window.PrivacyTalk && PrivacyTalk.isOpen()) { PrivacyTalk.next(); return; } const b = document.querySelector('#g-next #btn-next, #g-dock #btn-next'); if (b) b.click(); });
        await p.waitForTimeout(150);
      }
      const want = E.specialClassNotes(story, Object.assign({}, await st(p), { flags: { ccx: 'on', ccxPurpose: 'all', ccxKeep: 'open', ccxAccess: 'open' } }));
      const all = lines.join('\n');
      rec(size, 'wrap 선생님 반문 3줄 + 마무리', want.length === 3 && want.every((t) => all.includes(t)) && all.includes(story.specialClass.closing), lines.length + '줄');
      const c2 = await p.evaluate(() => ({ eb: document.getElementById('c-eyebrow').textContent, sum: document.getElementById('c-summary').textContent }));
      rec(size, 'wrap 다음 = 2장 카드, 요약 = 우리 반 안', c2.eb === '2장' && /우리 반이 정한 AI CCTV 안/.test(c2.sum) && /알림 범위/.test(c2.sum) && /수업 태도까지/.test(c2.sum), JSON.stringify(c2).slice(0, 200));
      await p.screenshot({ path: shot(`ch2card-${size}`) });
      ok2(p);
      await close(p);
    }
    // none: 설치 안 함 → 바로 정리(반문 1줄)
    if (key !== 'd') {
      const p = await open(dev, runTo({}, (s) => s.screen === 'scene' && s.scene === 'sc_1'));
      await until(p, (x) => x.ch > 0); await pick(p, 'none');
      let seen5 = false, note = false;
      for (let k = 0; k < 40; k++) {
        const s = await st(p); if (s && s.scene === 'sc_5') seen5 = true;
        const t = await p.evaluate(() => { const e = document.querySelector('#talk .talk-text'); return e ? e.textContent : ''; });
        if (/아무도 없는 교실에서/.test(t)) note = true;
        if (await p.evaluate(() => document.body.getAttribute('data-view')) === 'v-chapter') break;
        await p.evaluate(() => { if (window.PrivacyTalk && PrivacyTalk.isOpen()) { PrivacyTalk.next(); return; } const b = document.querySelector('#g-next #btn-next, #g-dock #btn-next'); if (b) b.click(); });
        await p.waitForTimeout(150);
      }
      rec(size, 'none 설치 안 함 → 바로 정리, 반문 1줄', seen5 && note);
      await close(p);
    }
    // ending: 결과 화면 칸(특별 수업 했음 / 안 한 옛 진행)
    {
      const before = runTo(SC_B, (s) => s.screen === 'scene' && !E.needsChoice(story, s) && E.pendingNext(story, s) === '@ending');
      const p = await open(dev, before);
      for (let k = 0; k < 40 && await p.evaluate(() => document.body.getAttribute('data-view')) !== 'v-ending'; k++) {
        await p.evaluate(() => { if (window.PrivacyTalk && PrivacyTalk.isOpen()) { PrivacyTalk.next(); return; } const b = document.querySelector('#g-next .skip-btn, #g-next #btn-next, #g-dock #btn-next'); if (b) b.click(); const g = document.getElementById('finale-go'); if (g && !document.getElementById('finale').hidden) g.click(); });
        await p.waitForTimeout(200);
      }
      await p.evaluate(() => { const g = document.getElementById('finale-go'); if (g && !document.getElementById('finale').hidden) g.click(); }); await p.waitForTimeout(300);
      const e = await p.evaluate(() => { const b = document.getElementById('e-class'), cs = b && getComputedStyle(b);
        return { hidden: !b || b.hidden, txt: b ? b.textContent : '', rows: b ? b.querySelectorAll('dt').length : 0, qs: b ? b.querySelectorAll('.class-q').length : 0, bl: cs ? parseFloat(cs.borderLeftWidth) : 0, code: document.getElementById('e-eyebrow').textContent }; });
      const noSc = Object.assign({}, before, { flags: Object.fromEntries(Object.entries(before.flags).filter(([k]) => !/^ccx/.test(k))) });
      rec(size, 'ending 결과 칸 = 우리 반이 정한 AI CCTV 안(4줄·질문 ≤2·얇은 테두리)', !e.hidden && /우리 반이 정한 AI CCTV 안/.test(e.txt) && e.rows === 4 && e.qs >= 1 && e.qs <= 2 && e.bl <= 1, JSON.stringify(e).slice(0, 200));
      rec(size, 'ending 엔딩 코드 = 특별 수업 없는 같은 경로', e.code === '엔딩 ' + E.resolveEnding(story, noSc).code, e.code);
      await p.screenshot({ path: shot(`ending-${size}`), fullPage: true });
      await close(p);
      if (key === 'w') {
        const q = await open(dev, noSc);
        for (let k = 0; k < 40 && await q.evaluate(() => document.body.getAttribute('data-view')) !== 'v-ending'; k++) {
          await q.evaluate(() => { if (window.PrivacyTalk && PrivacyTalk.isOpen()) { PrivacyTalk.next(); return; } const b = document.querySelector('#g-next .skip-btn, #g-next #btn-next, #g-dock #btn-next'); if (b) b.click(); const g = document.getElementById('finale-go'); if (g && !document.getElementById('finale').hidden) g.click(); });
          await q.waitForTimeout(200);
        }
        rec(size, 'ending 특별 수업 안 한 옛 진행 → 칸 숨김', await q.evaluate(() => { const b = document.getElementById('e-class'); return !!b && b.hidden; }));
        await close(q);
      }
    }
  }
} finally { await browser.close(); server.close(); }
function ok2(p) { if (p.errors.length) { fails.push('페이지 오류 ' + p.errors.join(' | ')); console.log('  ✗ 페이지 오류 ' + p.errors.join(' | ')); } else pass++; }
console.log('\n항목 표'); for (const t of table) console.log(t.join(' | '));
console.log(`\n통과 ${pass} · 실패 ${fails.length}`);
process.exitCode = fails.length ? 1 : 0;
