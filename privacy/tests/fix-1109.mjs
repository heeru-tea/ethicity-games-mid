// 2026-11-09 교사 지시서(Phase A·B·C) 확인: node privacy/tests/fix-1109.mjs  (PLAYWRIGHT_PATH = playwright 모듈 경로, 기본 token_economy)
//   화면 1148×977 · 1280×800(마우스) · 390×844(터치). ONLY=A,B,C 로 일부만, SIZE=w,d,m 으로 일부 화면만.
//   스크린샷 = tests/_shot-1109-*.png(gitignore). 브라우저 잠금(D:/Works/.browser-test.lock)은 실행하는 쪽에서 잡을 것.
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ONLY = (process.env.ONLY || 'A,B,C').split(',');
const SIZES = {
  w: { name: '1148x977', dev: { viewport: { width: 1148, height: 977 } } },
  d: { name: '1280x800', dev: { viewport: { width: 1280, height: 800 } } },
  m: { name: '390x844', dev: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } } };
const shots = [];
const shot = (n) => { const f = path.join(HERE, `_shot-1109-${n}.png`); shots.push(path.relative(path.join(HERE, '..'), f).replace(/\\/g, '/')); return f; };

// 지시서 Phase A 재현 경로(선택 id). tools/ending-v2-report.mjs '섞은 선택'과 같다
const REPRO = { pro_1: 'photo', c1_e1_a: 'propose', c1_e1_b: 'pass', c1_e2_a: 'no', c1_e3_b: 'ask', c2_e4_a: 'refuse', c2_e4_b: 'ask',
  c2_e5_a: 'all', c2_e5_b: 'close', c2_e6_a: 'post', c2_e6_b: 'own', c3_e7_a: 'stop', c3_e7_small: 'help', c3_e7_b: 'help', c3_e8_a: 'tell', c3_e9_a: 'report', c3_e9_b: 'calm' };
// 마지막 선택까지 고른 상태(반응 표시 중) — 이어 하기 → 한 번 넘기면 엔딩
function runBeforeEnding(prefs, v2 = true) {
  const keep = story.endingV2; story.endingV2 = v2;
  let s = E.createState(story);
  for (let step = 0; step < 600; step++) {
    if (s.screen === 'scene' && E.needsChoice(story, s)) {
      const cs = E.visibleChoices(story, story.scenes[s.scene], s);
      const c = cs.find((x) => x.id === prefs[s.scene]) || cs[0];
      s = E.choose(story, s, c.id); s.history = s.history.slice(-1);
    }
    if (s.screen === 'scene' && !E.needsChoice(story, s) && E.pendingNext(story, s) === '@ending') { story.endingV2 = keep; return s; } // 에필로그 마지막 장면
    s = E.advance(story, s);
  }
  throw new Error('엔딩 앞까지 못 감');
}

const server = await startServer(0), base = `http://127.0.0.1:${server.address().port}/privacy/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let pass = 0; const fails = [], table = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗ ' + m); } return !!c; };
const rec = (size, item, c, note = '') => { table.push([size, item, c ? '통과' : '실패', note]); ok(c, `${size} ${item} ${note}`); };

// player: 공통 ethicity.player(문자열 JSON, 없으면 null), settings: privacy 설정, progress: 진행(없으면 null)
async function open(dev, { player = '{"character":"char_03","nickname":"반짝이는 고래"}', settings = { speed: 'instant', reduceMotion: true, look: 'f' }, progress = null, config = null, query = '' } = {}) {
  const ctx = await browser.newContext(dev);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (config) await page.route('**/js/config.js', async (r) => { const res = await r.fetch(); let t = await res.text(); for (const [a, b] of config) t = t.replace(a, b); r.fulfill({ response: res, body: t }); });
  await page.addInitScript((p) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    if (p.player) localStorage.setItem('ethicity.player', p.player);
    localStorage.setItem('ethicity.privacy.settings.v1', JSON.stringify(p.settings));
    if (p.progress) localStorage.setItem('ethicity.privacy.progress.v2', p.progress);
  }, { player, settings, progress: progress && JSON.stringify(progress) });
  await page.goto(base + query);
  await page.waitForTimeout(500);
  page.errors = errors; page.ctx = ctx; page.touch = !!dev.hasTouch;
  return page;
}
const close = (p) => p.ctx.close();
const view = (p) => p.evaluate(() => document.body.getAttribute('data-view'));
// 게임 화면을 엔딩 페이지까지 넘긴다(선택지가 나오면 멈춤)
async function toEnding(p) {
  for (let k = 0; k < 80; k++) {
    const v = await view(p);
    if (v === 'v-ending') break;
    await p.evaluate(() => {
      const talk = document.getElementById('talk');
      if (talk && !talk.hidden && window.PrivacyTalk) { PrivacyTalk.next(); return; }
      const b = document.querySelector('.skip-btn') || document.getElementById('btn-next'); if (b) b.click();
    });
    await p.waitForTimeout(120);
  }
  await p.waitForTimeout(300);
  await p.evaluate(() => { const g = document.getElementById('finale-go'); if (g && !document.getElementById('finale').hidden) g.click(); });
  await p.waitForTimeout(300);
}

try {
  for (const key of (process.env.SIZE || 'w,d,m').split(',')) {
    const { name: size, dev } = SIZES[key];
    console.log('── ' + size);

    /* ── Phase A: 엔딩 본문·결과 지표 ── */
    if (ONLY.includes('A')) {
      const run = runBeforeEnding(REPRO, true);
      const p = await open(dev, { progress: { v: 1, run, explored: {}, endingsSeen: [] } });
      await p.click('#btn-continue'); await p.waitForTimeout(400);
      await toEnding(p);
      const r = await p.evaluate(() => ({
        v: document.body.getAttribute('data-view'), code: document.getElementById('e-eyebrow').textContent,
        body: [...document.querySelectorAll('#e-body p')].map((x) => x.textContent),
        rows: [...document.querySelectorAll('#e-stats .stat-row')].map((x) => x.querySelector('dt').textContent + '=' + x.querySelector('dd').textContent)
      }));
      rec(size, 'A 재현 경로 → 엔딩 B(V2)', r.v === 'v-ending' && r.code === '엔딩 B', r.code);
      rec(size, 'A 본문에 AI 통째 입력 한 줄', r.body.some((t) => /AI 도우미에 반 친구 28명/.test(t)), r.body.join(' | '));
      rec(size, 'A 본문에 계정 도용 한 줄', r.body.some((t) => /하늘이의 계정을 허락 없이/.test(t)));
      rec(size, 'A 안전 지표 두 줄(내가 위험 0 / 남을 위험 1)', r.rows.includes('내가 위험한 상황에 놓였던 일=0') && r.rows.includes('내가 다른 사람을 위험하게 한 일=1') && !r.rows.some((x) => /현실의 안전/.test(x)), r.rows.join(', '));
      ok(p.errors.length === 0, 'A 오류 ' + p.errors);
      await p.screenshot({ path: shot(`A-ending-${size}`), fullPage: true });
      await close(p);
      if (key === 'd') { // ENDING_V2=false: 이전과 똑같이(엔딩 A, 지표 한 줄, 선택별 줄 없음)
        const run1 = runBeforeEnding(REPRO, false);
        const q = await open(dev, { progress: { v: 1, run: run1, explored: {}, endingsSeen: [] }, config: [['ENDING_V2: true', 'ENDING_V2: false']] });
        await q.click('#btn-continue'); await q.waitForTimeout(400);
        await toEnding(q);
        const r1 = await q.evaluate(() => ({ code: document.getElementById('e-eyebrow').textContent, body: [...document.querySelectorAll('#e-body p')].map((x) => x.textContent),
          rows: [...document.querySelectorAll('#e-stats .stat-row')].map((x) => x.querySelector('dt').textContent), odds: window.PRIVACY_ODDS.A }));
        rec(size, 'A ENDING_V2=false → 이전 그대로(엔딩 A·지표 6줄·선택별 줄 없음·확률 V1)', r1.code === '엔딩 A' && r1.rows.length === 6 && r1.rows.includes('현실의 안전이 위협받거나 위협한 상황') && !r1.body.some((t) => /AI 도우미에 반 친구/.test(t)) && r1.odds === 8.9, JSON.stringify(r1).slice(0, 300));
        await close(q);
      }
    }
  }
} finally {
  await browser.close(); server.close();
}
console.log('\n항목 표'); for (const t of table) console.log(t.join(' | '));
console.log('\n스크린샷:\n' + [...new Set(shots)].join('\n'));
console.log(`\n통과 ${pass} · 실패 ${fails.length}`);
process.exitCode = fails.length ? 1 : 0;
