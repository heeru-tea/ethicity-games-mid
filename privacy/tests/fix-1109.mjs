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

// 그 장면 첫 화면(선택 전)까지 무작위로 간 상태
function makeRunScene(target) {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let tries = 0; tries < 20000; tries++) {
    let s = E.createState(story);
    for (let step = 0; step < 500 && s.screen !== 'ending'; step++) {
      if (s.screen === 'scene' && s.scene === target && !s.reaction) { s.history = s.history.slice(-1); return s; }
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

    /* ── Phase B: 프롤로그 집 → 교실 → 새봄 대화 → 단톡방(이름표·말풍선·목적지·할 일·넘기기 버튼·이름 기본값) ── */
    if (ONLY.includes('B')) {
      // 공통 별명 없음 + 온유(m) + 이름 칸 비움 → 화면 이름은 '온유'
      const p = await open(dev, { player: null, settings: { speed: 'instant', reduceMotion: true, look: 'm', nickname: '' } });
      const st = await p.evaluate(() => ({ line: document.querySelector('.player-text').textContent.replace(/\s+/g, ' ').trim(), ph: document.getElementById('name-input').placeholder }));
      rec(size, 'B4 시작 화면 한 줄 = 이번 주인공: 온유 · 입력칸 placeholder 온유', st.line === '이번 주인공: 온유' && st.ph === '온유', JSON.stringify(st));
      await p.screenshot({ path: shot(`B-start-${size}`) });
      await p.click('#btn-new'); await p.waitForTimeout(200);
      await p.evaluate(() => { const b = document.getElementById('btn-warning-ok'); if (b && !document.getElementById('warning').hidden) b.click(); });
      await p.waitForTimeout(900);
      const home = await p.evaluate(() => ({ v: document.body.getAttribute('data-view'), mission: document.getElementById('m-mission').textContent, me: PrivacyMap.debug.me(), tag: PrivacyMap.debug.tags().find((t) => t.me), help: (document.querySelector('.map-help') || {}).textContent || '' }));
      rec(size, 'B 집에서 시작 · 지금 할 일 = 학교 가기', home.v === 'v-map' && /학교 가기/.test(home.mission), JSON.stringify(home).slice(0, 200));
      rec(size, 'B4 지도 내 이름표 = 온유', !!home.tag && home.tag.label === '온유', home.tag && home.tag.label);
      rec(size, 'B2 범례 = 목적지(사람이면 머리 위) / 해도 되고 안 해도 되는 대화', /다음 목적지\(사람이면 머리 위\)/.test(home.help) && /해도 되고 안 해도 되는 대화/.test(home.help));
      await p.screenshot({ path: shot(`B-home-${size}`) });
      // 교실: 새봄(12,8) 두 칸 아래로 옮겨 → 할 일이 바로 '새봄에게 말 걸기', 새봄 머리 위엔 느낌표 핀
      await p.evaluate(() => PrivacyMap.debug.place(12, 10, 'up')); await p.waitForTimeout(500);
      const cls = await p.evaluate(() => ({ mission: document.getElementById('m-mission').textContent, mk: PrivacyMap.debug.marker(), talk: PrivacyMap.debug.talkMarks(), tags: PrivacyMap.debug.tags() }));
      rec(size, 'B2 교실 도착 → 지금 할 일 = 새봄에게 말 걸기', cls.mission === '새봄에게 말 걸기', cls.mission);
      rec(size, 'B2 목적지 새봄 = 느낌표 핀(물음표 아님)', cls.mk && cls.mk.kind === 'dest' && cls.mk.who === 'saebom' && !cls.talk.some((t) => t.who === 'saebom'), JSON.stringify(cls.mk));
      const off = (tags) => tags.filter((t) => Math.abs(t.x + t.w / 2 - t.cx) > 1).map((t) => t.label);
      rec(size, 'B1 교실 이름표가 모두 자기 인물 가운데', off(cls.tags).length === 0, off(cls.tags).join(','));
      await p.screenshot({ path: shot(`B-class-${size}`) });
      // 새봄 바로 아래에서 말 걸기 → 말풍선 꼬리가 새봄을 가리킴 · 두 사람 사이 1칸 이상
      await p.evaluate(() => PrivacyMap.debug.place(12, 9, 'up')); await p.waitForTimeout(300);
      await p.evaluate(() => document.getElementById('btn-map-act').click()); await p.waitForTimeout(700);
      const tk = await p.evaluate(() => ({ open: PrivacyTalk.isOpen(), b: PrivacyMap.debug.bubbleRects(), n: PrivacyMap.debug.nudge(), tags: PrivacyMap.debug.tags(), bodies: PrivacyMap.debug.bodies() }));
      // 말풍선마다 꼬리 끝이 말한 사람(몸 가운데 ±3px, 머리 위 — 뒤집히면 발밑)을 가리키는지
      const badTail = tk.b.filter((q) => { const bd = tk.bodies.find((b) => b.who === q.who); if (!bd || !q.tail) return true; const cx = (bd.x0 + bd.x1) / 2; return Math.abs(q.tail.x1 - cx) > 3 || (q.flip ? q.tail.y1 < bd.y1 - 6 : q.tail.y1 > bd.y0 + 14); });
      rec(size, 'B1 말풍선 꼬리 끝 = 말한 사람(머리 위·뒤집히면 발밑)', tk.b.length > 0 && badTail.length === 0, JSON.stringify(tk.b.map((q) => ({ who: q.who, tail: q.tail, flip: q.flip }))) + ' bodies ' + JSON.stringify(tk.bodies.map((b) => [b.who, Math.round((b.x0 + b.x1) / 2), Math.round(b.y0)])));
      rec(size, 'B1 대화 중 두 사람 가로 1.5칸 이상(위아래로 붙음)', !!tk.n && Math.abs(tk.n.cx - tk.n.mx) >= 1.25, JSON.stringify(tk.n));
      rec(size, 'B1 대화 중 이름표 모두 자기 인물 가운데', off(tk.tags).length === 0, off(tk.tags).join(','));
      await p.screenshot({ path: shot(`B-talk-${size}`) });
      for (let k = 0; k < 40 && await p.evaluate(() => PrivacyTalk.isOpen()); k++) { await p.evaluate(() => PrivacyTalk.next()); await p.waitForTimeout(80); }
      await p.waitForTimeout(1200);
      const roleLog = await p.evaluate(() => document.getElementById('g-log').textContent);
      await p.evaluate(() => { const c = document.querySelector('#g-dock .choice'); if (c) c.click(); }); await p.waitForTimeout(900); // 역할 고르기 → 반응 뒤 '다음'
      // 단톡방(무대 pro_1): 첫 대사에 '온유', 이름표, 넘기기 버튼은 폰 바로 아래 같은 너비 '다음'
      const gc = await p.evaluate(() => {
        const ph = document.getElementById('g-phone').getBoundingClientRect(), nx = document.getElementById('g-next'), nb = nx.getBoundingClientRect(), btn = nx.querySelector('button');
        return { v: document.body.getAttribute('data-view'), log: document.getElementById('g-log').textContent, btn: btn && btn.textContent, nb: { t: nb.top, w: nb.width, l: nb.left }, ph: { b: ph.bottom, w: ph.width, l: ph.left }, dockBtn: !!document.querySelector('#g-dock #btn-next, #g-dock .skip-btn'), tags: PrivacyMap.debug.tags() };
      });
      rec(size, 'B4 첫 단톡방 대사 = "온유 넌 뭐 할래?"', gc.v === 'v-game' && /온유 넌 뭐 할래\?/.test(roleLog) && !/플레이어/.test(gc.log), roleLog.slice(0, 160));
      rec(size, 'B3 넘기기 버튼 = 폰 바로 아래·같은 너비·글자 "다음"', gc.btn === '다음' && !gc.dockBtn && gc.nb.t >= gc.ph.b - 1 && gc.nb.t - gc.ph.b <= 16 && Math.abs(gc.nb.w - gc.ph.w) <= 2 && Math.abs(gc.nb.l - gc.ph.l) <= 2, JSON.stringify(gc.nb) + ' ' + JSON.stringify(gc.ph));
      rec(size, 'B1 단톡방 무대 이름표 모두 자기 인물 가운데(하늘 포함)', off(gc.tags).length === 0 && gc.tags.some((t) => t.label === '하늘'), off(gc.tags).join(',') + ' / ' + gc.tags.map((t) => t.label).join(','));
      ok(p.errors.length === 0, 'B 오류 ' + p.errors);
      await p.screenshot({ path: shot(`B-group-${size}`) });
      await close(p);
      if (key === 'd') {
        // 다온 + 이름 비움 / 이름 입력 / 공통 별명 → 시작 화면 한 줄·placeholder·화면 이름
        for (const [label, opts, line, name] of [
          ['다온·이름 비움', { player: null, settings: { speed: 'instant', reduceMotion: true, look: 'f', nickname: '' } }, '이번 주인공: 다온', '다온'],
          ['온유·이름 별빛', { player: null, settings: { speed: 'instant', reduceMotion: true, look: 'm', nickname: '별빛' } }, '이번 주인공: 온유 (별명: 별빛)', '별빛'],
          ['공통 별명 반짝이는 고래', { settings: { speed: 'instant', reduceMotion: true, look: 'f' } }, '이번 주인공: 다온 (별명: 반짝이는 고래)', '반짝이는 고래']]) {
          const q = await open(dev, opts);
          const r = await q.evaluate(() => ({ line: document.querySelector('.player-text').textContent.replace(/\s+/g, ' ').trim(), name: PrivacyApp.player().nickname, stored: localStorage.getItem('ethicity.player') }));
          rec(size, `B4 ${label}: 한 줄·화면 이름`, r.line === line && r.name === name, JSON.stringify(r));
          await q.click('#btn-new'); await q.waitForTimeout(200);
          await q.evaluate(() => { const b = document.getElementById('btn-warning-ok'); if (b && !document.getElementById('warning').hidden) b.click(); });
          await q.waitForTimeout(800);
          const tg = await q.evaluate(() => (PrivacyMap.debug.tags().find((t) => t.me) || {}).label);
          rec(size, `B4 ${label}: 지도 이름표`, tg === (name.length > 8 ? name.slice(0, 8) + '…' : name), tg);
          const after = await q.evaluate(() => localStorage.getItem('ethicity.player'));
          rec(size, `B4 ${label}: 공통 ethicity.player는 그대로(쓰지 않음)`, after === r.stored, String(after));
          await close(q);
        }
        // 결과 화면: 이름 비움(온유)으로 끝까지 → '플레이어' 없음
        const run = runBeforeEnding(REPRO, true);
        const q2 = await open(dev, { player: null, settings: { speed: 'instant', reduceMotion: true, look: 'm', nickname: '' }, progress: { v: 1, run, explored: {}, endingsSeen: [] } });
        await q2.click('#btn-continue'); await q2.waitForTimeout(400);
        await toEnding(q2);
        const et = await q2.evaluate(() => ({ v: document.body.getAttribute('data-view'), has: /플레이어/.test(document.getElementById('v-ending').textContent), name: PrivacyApp.player().nickname }));
        rec(size, 'B4 결과 화면에 "플레이어" 없음(이름 = 온유)', et.v === 'v-ending' && !et.has && et.name === '온유', JSON.stringify(et));
        await close(q2);
        // 글자가 나오는 중 = '모두 보기'(폰 바로 아래) → 누르면 '다음'
        // 이어 하기(반응 중) → '다음'(폰 아래) → 다음 장면 글자가 나오는 중 '모두 보기'(폰 아래) → 누르면 선택지/다음
        const pr = E.choose(story, makeRunScene('c1_e1_a'), 'dm'); pr.history = pr.history.slice(-1);
        const q3 = await open(dev, { player: null, settings: { speed: 'normal', reduceMotion: false, look: 'm', nickname: '' }, progress: { v: 1, run: pr, explored: {}, endingsSeen: [] } });
        await q3.click('#btn-continue');
        const nextText = async () => q3.evaluate(() => { const b = document.querySelector('#g-next button'); return b && b.textContent; });
        let s0 = null; for (let k = 0; k < 60 && s0 !== '다음'; k++) { await q3.waitForTimeout(150); s0 = await nextText(); }
        await q3.evaluate(() => { const b = document.querySelector('#g-next #btn-next'); if (b) b.click(); });
        let s1 = null; for (let k = 0; k < 60 && s1 !== '모두 보기'; k++) { await q3.waitForTimeout(150); s1 = await nextText(); }
        await q3.screenshot({ path: shot(`B-skip-${size}`) });
        await q3.evaluate(() => { const b = document.querySelector('#g-next .skip-btn'); if (b) b.click(); }); await q3.waitForTimeout(400);
        const s2 = await q3.evaluate(() => ({ next: (document.querySelector('#g-next button') || {}).textContent || null, choices: document.querySelectorAll('#g-dock .choice').length, scene: PrivacyApp.state().scene }));
        rec(size, 'B3 반응 뒤 "다음" → 글자 나오는 중 "모두 보기"(둘 다 폰 아래) → 선택지', s0 === '다음' && s1 === '모두 보기' && (s2.choices > 0 || s2.next === '다음'), JSON.stringify({ s0, s1, s2 }));
        await close(q3);
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
