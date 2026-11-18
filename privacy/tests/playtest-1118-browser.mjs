// 2026-11-18 플레이테스트 수정 확인(브라우저): node privacy/tests/playtest-1118-browser.mjs  (PLAYWRIGHT_PATH = playwright 모듈 경로, 기본 token_economy)
//   지시서 = docs/queue/2026-11-18-playtest-workers.md. 브라우저 검사는 한 번에 하나(D:/Works/.browser-lock), 노드 검사는 tests/playtest-1118.mjs
//   a 제목·주의 화면(P0-1, P2 주인공 안내·✓·한 장면 카드) 1148×977·390×844   b 선택지 접근성 이름(P1-5)
//   c HUD 장 이름·시각·밤 색(P0-4)   d 새봄을 눌러 말 걸기(P1-6)   e 큰 버튼(P1-9)   f 지도 설명(P1-10)   g 첫 지도 출구 핀(P2)
//   h 확인 경로 화면: 1장 카드 요약(P2) · AI 붙여 넣기(P1-7) · 에필로그 담임(P0-2) · 엔딩 C 본문(P0-3)
//   ONLY=a,b,…  스크린샷 = tests/_shot-1118-*.png(gitignore)
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ONLY = (process.env.ONLY || 'a,b,c,d,e,f,g,h').split(',');
const W = { name: '1148x977', dev: { viewport: { width: 1148, height: 977 } } };
const M = { name: '390x844', dev: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const D = { name: '1280x800', dev: { viewport: { width: 1280, height: 800 } } };
const shot = (n) => path.join(HERE, `_shot-1118-${n}.png`);

// 확인 경로(지시서) — 지나가며 상태를 모아 둔다
const ROUTE = ['money', 'public', 'fixboth', 'shoot', 'group', 'all', 'capture', 'full', 'on', 'danger', '30d', 'self', 'forward', 'confess',
  'all', 'anon', 'scoped', 'del', 'post', 'own', 'warn', 'help', 'tell', 'critique', 'calm'];
const SNAP = { chapters: [], maps: {}, scenes: {} };
{
  let s = E.createState(story), k = 0;
  for (let n = 0; n < 900; n++) {
    if (s.screen === 'chapter') SNAP.chapters.push(E.clone(s));
    if (s.screen === 'map' && !SNAP.maps[s.mapTarget]) SNAP.maps[s.mapTarget] = E.clone(s); // 걷기 상태의 scene은 앞 장면 — 갈 곳은 mapTarget
    if (s.screen === 'scene' && !s.reaction && !SNAP.scenes[s.scene]) SNAP.scenes[s.scene] = E.clone(s);
    if (s.screen === 'ending') { SNAP.ending = E.clone(s); break; }
    if (s.screen === 'scene' && E.needsChoice(story, s)) s = E.choose(story, s, ROUTE[k++]);
    s = E.advance(story, s);
  }
}

const server = await startServer(0), base = `http://127.0.0.1:${server.address().port}/privacy/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗ ' + m); } return !!c; };

async function open(dev, opts = {}) {
  const ctx = await browser.newContext(dev);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((o) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    if (o.player) localStorage.setItem('ethicity.player', o.player);
    localStorage.setItem('ethicity.privacy.settings.v1', JSON.stringify(Object.assign({ speed: 'instant', reduceMotion: true, soundSet: true, sound: false }, o.settings || {})));
    if (o.run) localStorage.setItem('ethicity.privacy.progress.v2', JSON.stringify({ v: 1, run: o.run, explored: {}, endingsSeen: [] }));
  }, { run: opts.run || null, settings: opts.settings || { look: 'f' }, player: opts.player || null });
  await page.goto(base);
  await page.waitForTimeout(600);
  if (opts.run) { await page.click('#btn-continue'); await page.waitForTimeout(900); }
  page.errors = errors; page.ctx = ctx;
  return page;
}
async function passTalk(p, until) {
  for (let k = 0; k < 80; k++) {
    if (until && await p.evaluate(until)) return true;
    if (await p.evaluate(() => document.querySelectorAll('#g-dock .choice').length > 0 || !!document.getElementById('btn-next'))) return false;
    if (await p.evaluate(() => PrivacyTalk.isOpen())) await p.evaluate(() => PrivacyTalk.next());
    await p.waitForTimeout(60);
  }
  return false;
}

try {
  /* ── a 제목·주의 화면 ── */
  if (ONLY.includes('a')) for (const sz of [W, M]) {
    const p = await open(sz.dev, { settings: {} }); // 주인공을 고르기 전
    const L = await p.evaluate(() => {
      const r = (q) => { const e = document.querySelector(q); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
      return { facts: !!document.querySelector('.facts-box'), note: r('#name-note'), field: r('#name-field'), btn: r('#btn-new'),
        noteText: document.getElementById('name-note').textContent, sh: document.scrollingElement.scrollHeight, ih: innerHeight, sw: document.scrollingElement.scrollWidth, iw: innerWidth,
        peek: (() => { const c = document.querySelector('.peek-choice'); if (!c) return null; const cs = getComputedStyle(c); return { bw: cs.borderTopWidth, shadow: cs.boxShadow, cursor: cs.cursor, color: cs.color, text: getComputedStyle(document.querySelector('.peek-q')).color }; })() };
    });
    ok(!L.facts, `a ${sz.name} 제목 화면에 '게임 안내'(details) 없음`);
    ok(L.note && L.field && L.note.top >= L.field.bottom - 1 && L.note.top - L.field.bottom < 24, `a ${sz.name} 개인정보 한 줄 = 이름 칸 바로 아래 ${JSON.stringify([L.field, L.note])}`);
    ok(L.sw <= L.iw + 1, `a ${sz.name} 가로 넘침 없음 (${L.sw}/${L.iw})`);
    if (sz === W) ok(L.sh <= L.ih + 1, `a ${sz.name} 제목 화면 스크롤 없음(펼칠 것 없음) (${L.sh}/${L.ih})`);
    ok(L.peek && L.peek.bw === '0px' && L.peek.shadow === 'none' && L.peek.cursor === 'default' && L.peek.color !== L.peek.text, `a ${sz.name} P2 한 장면 선택지 = 테두리·그림자 없음·기본 커서·흐린 글씨 ${JSON.stringify(L.peek)}`);
    await p.screenshot({ path: shot(`title-${sz.name}`) });
    // 주인공 없이 시작하기 → 안내 한 줄만(P2)
    await p.click('#btn-new'); await p.waitForTimeout(300);
    const msgs = await p.evaluate(() => ['#look-msg', '#player-note'].filter((q) => { const e = document.querySelector(q); return e && !e.hidden && e.getClientRects().length && /주인공을 골라/.test(e.textContent); }));
    ok(msgs.length === 1, `a ${sz.name} P2 주인공 없이 시작: '골라 주세요' 안내 하나 (${msgs})`);
    // 다온 고르기 → ✓가 이름을 덮지 않음(P2)
    await p.click('.hero-card[data-look="f"]'); await p.waitForTimeout(200);
    const ck = await p.evaluate(() => {
      const card = document.querySelector('.hero-card[data-look="f"]'), cr = card.getBoundingClientRect(), a = getComputedStyle(card, '::after');
      const w = parseFloat(a.width), h = parseFloat(a.height), top = cr.top + parseFloat(a.top), right = cr.right - parseFloat(a.right);
      const range = document.createRange(); range.selectNodeContents(card.querySelector('.hero-name')); const nr = range.getBoundingClientRect();
      return { mark: { x0: right - w, x1: right, y0: top, y1: top + h }, name: { x0: nr.left, x1: nr.right, y0: nr.top, y1: nr.bottom } };
    });
    const ov = Math.max(0, Math.min(ck.mark.x1, ck.name.x1) - Math.max(ck.mark.x0, ck.name.x0)) * Math.max(0, Math.min(ck.mark.y1, ck.name.y1) - Math.max(ck.mark.y0, ck.name.y0));
    ok(ov === 0, `a ${sz.name} P2 ✓가 '다온' 글자를 덮지 않음 ${JSON.stringify(ck)}`);
    // 주의 화면
    await p.click('#btn-new'); await p.waitForTimeout(500);
    const w = await p.evaluate(() => {
      const box = document.getElementById('warning'), b = document.getElementById('btn-warning-ok').getBoundingClientRect();
      const know = document.querySelector('.warning-know'), kb = know && know.getBoundingClientRect();
      return { open: !box.hidden, sub: (document.querySelector('.warning-sub') || {}).textContent, know: !!know && kb.bottom <= b.top, btnBottom: b.bottom, ih: innerHeight, scroll: box.scrollHeight - box.clientHeight,
        items: [...document.querySelectorAll('.warning-know li')].map((li) => li.textContent), buttons: box.querySelectorAll('button').length };
    });
    ok(w.open && w.sub === '시작하기 전에', `a ${sz.name} WARNING + 부제 '시작하기 전에' (${w.sub})`);
    ok(w.know && w.items.length === 2 && w.buttons === 1, `a ${sz.name} 확인 버튼 위 '시작 전에 알아 둘 것' 두 줄, 버튼 하나 ${JSON.stringify(w.items)}`);
    ok(w.btnBottom <= w.ih && w.scroll <= 1, `a ${sz.name} 주의 화면이 한 화면에(확인 버튼 스크롤 없이 보임) bottom ${Math.round(w.btnBottom)}/${w.ih} · 넘침 ${w.scroll}`);
    await p.screenshot({ path: shot(`warning-${sz.name}`) });
    ok(p.errors.length === 0, `a ${sz.name} 오류 없음 ${p.errors}`);
    await p.ctx.close();
  }

  /* ── b 선택지 접근성 이름 ── */
  if (ONLY.includes('b')) for (const sz of [W, M]) {
    const p = await open(sz.dev, { run: SNAP.scenes.pro_1 || SNAP.scenes.c1_e1_a });
    await passTalk(p);
    const first = p.locator('#g-dock .choice').first();
    await first.focus(); await p.waitForTimeout(100);
    const want = await first.locator('.choice-text').textContent();
    const snapF = await first.ariaSnapshot();
    ok(snapF.includes(`button "${want}"`), `b ${sz.name} 포커스된 선택지 이름 = 문장 전체 (${snapF.trim()})`);
    await p.mouse.move(2, 2); await first.focus(); await p.waitForTimeout(100); // 마우스가 선택지 위에 있으면 마우스 줄에 ▶(2026-11-02 규칙) — 비켜 두고 포커스 줄을 본다
    const mark = await p.evaluate(() => { const b = document.querySelector('#g-dock .choice'), m = b.querySelector('.choice-mark'); return { aria: m && m.getAttribute('aria-hidden'), vis: m && getComputedStyle(m).visibility, before: getComputedStyle(b, '::before').content, focus: b.matches(':focus'), act: document.activeElement && document.activeElement.className, hover: !!document.querySelector('#g-dock .choices:hover') }; });
    ok(mark.aria === 'true' && mark.vis === 'visible' && (mark.before === 'none' || mark.before === 'normal'), `b ${sz.name} ▶ = 보이는 aria-hidden 표시, ::before 글자 없음 ${JSON.stringify(mark)}`);
    if (sz === W) {
      const second = p.locator('#g-dock .choice').nth(1);
      await second.hover(); await p.waitForTimeout(100);
      const w2 = await second.locator('.choice-text').textContent(), s2 = await second.ariaSnapshot();
      ok(s2.includes(`button "${w2}"`), `b ${sz.name} 마우스 올린 선택지 이름 = 문장 전체 (${s2.trim()})`);
    }
    ok(p.errors.length === 0, `b ${sz.name} 오류 없음 ${p.errors}`);
    await p.ctx.close();
  }

  /* ── c HUD 장 이름·시각·밤 색 ── */
  if (ONLY.includes('c')) {
    const sz = D;
    const hud = (p) => p.evaluate(() => ({ chap: document.getElementById('g-chap').textContent, time: document.getElementById('m-time').textContent }));
    // 장 카드 '시작하기'를 누르는 순간 다음 장 이름(프롤로그 → 1장, 1장 → 특별 수업, 3장 → 에필로그)
    const goes = (s) => { const n = E.advance(story, s); return story.scenes[(n.screen === 'map' && n.mapTarget) || n.scene].chapter; };
    const cases = SNAP.chapters.map((s) => ({ s, next: goes(s) }));
    ok(cases.filter((x) => [1, 'sc', 4].includes(x.next)).length === 3, 'c 장 카드 세 장(→1장·특별 수업·에필로그) 상태 ' + cases.map((x) => x.next));
    for (const c of cases.filter((x) => [1, 'sc', 4].includes(x.next))) {
      const p = await open(sz.dev, { run: c.s });
      await p.click('#btn-chapter-go'); await p.waitForTimeout(500);
      const h = await hud(p), want = c.next === 1 ? /^1장/ : c.next === 'sc' ? /^특별 수업/ : /^에필로그/;
      ok(want.test(h.chap), `c 장 카드 → ${c.next}: 걷는 동안 장 이름 '${h.chap}'`);
      await p.ctx.close();
    }
    // 휴대폰 대화 시각 = HUD 시각
    for (const id of ['c1_e3_b', 'c1_e3_cap', 'c3_e8_a']) {
      const s = SNAP.scenes[id]; if (!ok(!!s, `c ${id} 상태 있음`)) continue;
      const p = await open(sz.dev, { run: s });
      const sys = (E.visibleLines(story, story.scenes[id].lines, s).find((l) => l.who === 'sys') || {}).text;
      const h = await hud(p);
      ok(h.time === sys, `c ${id}: HUD 시각 = 장면 시각 (${h.time} / ${sys})`);
      if (id === 'c3_e8_a') ok(await p.evaluate(() => PrivacyMap.debug.tint()) === 'night', `c ${id}: 내 방 밤 색`);
      await p.ctx.close();
    }
  }

  /* ── d 새봄을 눌러 말 걸기 — 새봄 칸 위 빈 칸으로 걸어 들어가 겹쳐 서지 않는다 ── */
  if (ONLY.includes('d')) for (const sz of [D, M]) {
    const run = E.createState(story); // pro_1 걷기
    const p = await open(sz.dev, { run });
    const cls = WORLD.SCENES.find((x) => x.id === 'classroom').ox, sb = WORLD.triggers.pro_1.cast.find((c) => c.who === 'saebom');
    await p.evaluate(([x, y]) => PrivacyMap.debug.place(x, y, 'up'), [cls + 8, 13]);
    await p.waitForTimeout(500);
    const head = await p.evaluate(() => { const cv = document.getElementById('m-canvas').getBoundingClientRect(), b = PrivacyMap.debug.bodies().find((q) => q.who === 'saebom'); return b && { x: cv.left + (b.x0 + b.x1) / 2, y: cv.top + b.y0 + (b.y1 - b.y0) * 0.22 }; });
    if (!ok(!!head, `d ${sz.name} 새봄 몸 자리`)) { await p.ctx.close(); continue; }
    if (sz === M) await p.touchscreen.tap(head.x, head.y); else await p.mouse.click(head.x, head.y);
    for (let k = 0; k < 60 && !(await p.evaluate(() => PrivacyTalk.isOpen())); k++) await p.waitForTimeout(100);
    const me = await p.evaluate(() => PrivacyMap.debug.me());
    const dx = me.x - sb.x, dy = me.y - sb.y, dist = Math.abs(dx) + Math.abs(dy);
    ok(await p.evaluate(() => PrivacyTalk.isOpen()), `d ${sz.name} 새봄 머리를 누르면 그 사람에게 말 걸기(대화창)`);
    ok(dist >= 1 && dist <= 2 && (dx === 0 || dy === 0) && !(dx === 0 && dy === -1), `d ${sz.name} 새봄 옆 칸에 섬(겹친 칸·바로 위 칸 아님) me (${me.x},${me.y}) 새봄 (${sb.x},${sb.y})`);
    const face = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[me.dir];
    ok(face && Math.sign(-dx) === Math.sign(face[0]) && Math.sign(-dy) === Math.sign(face[1]), `d ${sz.name} 새봄을 바라봄 (${me.dir})`);
    await p.waitForTimeout(400);
    const cover = await p.evaluate(() => {
      const tags = PrivacyMap.debug.tags(), mine = tags.find((t) => t.who === 'me'), bub = PrivacyMap.debug.bubbleRects();
      const tailHits = mine ? bub.filter((b) => b.tail && Math.min(b.tail.x0, b.tail.x1) - 8 < mine.x + mine.w && mine.x < Math.max(b.tail.x0, b.tail.x1) + 8 && Math.min(b.tail.y0, b.tail.y1) < mine.y + mine.h && mine.y < Math.max(b.tail.y0, b.tail.y1)) : [];
      const boxHits = mine ? bub.filter((b) => b.who !== 'me' && b.x < mine.x + mine.w && mine.x < b.x + b.w && b.y < mine.y + mine.h && mine.y < b.y + b.h) : [];
      return { tail: tailHits.length, redrawn: !!(mine && mine.overTail), box: boxHits.length };
    });
    ok(cover.box === 0 && (cover.tail === 0 || cover.redrawn), `d ${sz.name} 말풍선이 내 이름표를 덮지 않음 ${JSON.stringify(cover)}`);
    await p.screenshot({ path: shot(`saebom-talk-${sz.name}`) });
    ok(p.errors.length === 0, `d ${sz.name} 오류 없음 ${p.errors}`);
    await p.ctx.close();
  }

  /* ── e 큰 버튼: 한 번 본 사물은 다시 차지하지 않음 · 할 일 쪽 출구 우선 ── */
  if (ONLY.includes('e')) {
    const p = await open(D.dev, { run: SNAP.maps.c3_e8_a }); // 축제 부스 → '집에 가서 쉬기'
    const r = await p.evaluate(() => {
      const WD = window.PRIVACY_WORLD, tent = WD.OBJECTS.find((o) => o.id === 'tent2'), out = {};
      // 천막 바로 옆 걸을 수 있는 칸
      const cells = [];
      for (let x = tent.x - 1; x <= tent.x + tent.w; x++) for (let y = tent.y - 1; y <= tent.y + tent.h; y++) {
        const inside = x >= tent.x && x < tent.x + tent.w && y >= tent.y && y < tent.y + tent.h;
        if (!inside && WD.walkable(x, y, {}) && !WD.DOORS[x + ',' + y]) cells.push([x, y]);
      }
      const c = cells.sort((a, b) => b[1] - a[1])[0];
      PrivacyMap.debug.place(c[0], c[1], c[1] >= tent.y + tent.h ? 'up' : 'down');
      out.cell = c; out.before = document.getElementById('btn-map-act').textContent;
      return out;
    });
    ok(/천막 조사하기/.test(r.before), `e 천막 옆: 처음엔 '천막 조사하기' (${r.before})`);
    await p.click('#btn-map-act'); await p.waitForTimeout(300);
    for (let k = 0; k < 10 && await p.evaluate(() => PrivacyTalk.isOpen()); k++) { await p.evaluate(() => PrivacyTalk.next()); await p.waitForTimeout(150); }
    await p.waitForTimeout(300);
    const after = await p.evaluate(() => document.getElementById('btn-map-act').textContent);
    ok(!/옆 반 천막 조사하기/.test(after), `e 한 번 본 천막은 다시 큰 버튼을 차지하지 않음 (${after})`);
    // 출구 옆 + 사물 옆 칸이 있으면: 할 일 쪽 출구가 먼저
    const both = await p.evaluate(() => {
      const WD = window.PRIVACY_WORLD, res = [];
      const ex = PrivacyMap.debug.exitCells();
      for (const e of ex) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const x = e.x + dx, y = e.y + dy;
        if (!WD.walkable(x, y, {}) || WD.DOORS[x + ',' + y]) continue;
        const near = WD.OBJECTS.filter((o) => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([a, b]) => x + a >= o.x && x + a < o.x + o.w && y + b >= o.y && y + b < o.y + o.h));
        if (near.length) res.push({ x, y, ob: near.map((o) => o.id) });
      }
      return res;
    });
    for (const c of both.slice(0, 3)) {
      const txt = await p.evaluate(([x, y]) => { PrivacyMap.debug.place(x, y, 'down'); return document.getElementById('btn-map-act').textContent; }, [c.x, c.y]);
      ok(/가기/.test(txt), `e 할 일 쪽 출구 옆이면서 사물(${c.ob}) 옆 (${c.x},${c.y}): 큰 버튼 = 출구 (${txt})`);
    }
    if (!both.length) console.log('  (e 출구와 사물이 함께 닿는 칸 없음 — 그 경우는 건너뜀)');
    ok(p.errors.length === 0, `e 오류 없음 ${p.errors}`);
    await p.ctx.close();
    // 바닥 쿠션(침대로 가는 길, c1_e1_a 걷기)
    const q = await open(D.dev, { run: SNAP.maps.c1_e1_a });
    const cu = await q.evaluate(() => {
      const WD = window.PRIVACY_WORLD, o = WD.OBJECTS.find((x) => x.id === 'cushion');
      for (const [dx, dy, dir] of [[0, 1, 'up'], [0, -1, 'down'], [1, 0, 'left'], [-1, 0, 'right']]) { const x = o.x + dx, y = o.y + dy; if (WD.walkable(x, y, {}) && !WD.DOORS[x + ',' + y]) { PrivacyMap.debug.place(x, y, dir); return document.getElementById('btn-map-act').textContent; } }
      return null;
    });
    ok(/쿠션 조사하기/.test(cu || ''), `e 쿠션 옆: 처음엔 '쿠션 조사하기' (${cu})`);
    await q.click('#btn-map-act'); await q.waitForTimeout(300);
    for (let k = 0; k < 10 && await q.evaluate(() => PrivacyTalk.isOpen()); k++) { await q.evaluate(() => PrivacyTalk.next()); await q.waitForTimeout(150); }
    await q.waitForTimeout(300);
    const cu2 = await q.evaluate(() => document.getElementById('btn-map-act').textContent);
    ok(!/쿠션 조사하기/.test(cu2), `e 한 번 본 쿠션은 다시 큰 버튼을 차지하지 않음 (${cu2})`);
    await q.ctx.close();
  }

  /* ── f 지도 설명(aria-label) ── */
  if (ONLY.includes('f')) {
    const label = (p) => p.evaluate(() => document.getElementById('m-canvas').getAttribute('aria-label'));
    for (const id of ['pro_1', 'c1_e1_a', 'c3_e7_a', 'c3_e8_a']) {
      const s = id === 'pro_1' ? E.createState(story) : SNAP.maps[id]; if (!ok(!!s, `f ${id} 걷기 상태`)) continue;
      const p = await open(D.dev, { run: s });
      const tg = WORLD.triggers[id].target, name = tg.npc ? story.characters[tg.npc].name : WORLD.OBJECTS.find((o) => o.id === tg.obj).name;
      const l = await label(p), mission = await p.evaluate(() => document.getElementById('m-mission').textContent);
      ok(l.includes('목적지: ' + name), `f ${id}: 걷기 시작하자마자 설명의 목적지 = ${name} (${l.slice(0, 80)}… / 할 일 ${mission})`);
      await p.ctx.close();
    }
    const p = await open(D.dev, { run: SNAP.scenes.c1_e3_b });
    const l = await label(p);
    ok(/휴대폰 화면을 보는 중/.test(l) && !/목적지/.test(l), `f 휴대폰 장면 중: '휴대폰 화면을 보는 중', 목적지 없음 (${l})`);
    await p.ctx.close();
  }

  /* ── g 첫 지도(내 방) 출구 핀이 아래 안내 띠에 가리지 않음 ── */
  if (ONLY.includes('g')) for (const sz of [W, D]) {
    const p = await open(sz.dev, { run: E.createState(story) });
    await p.waitForTimeout(600);
    const g = await p.evaluate(() => {
      const cv = document.getElementById('m-canvas').getBoundingClientRect(), help = document.querySelector('#v-map .map-help'), m = PrivacyMap.debug.marker();
      const hr = help && help.getClientRects().length ? help.getBoundingClientRect() : null;
      return { m: m && { x: m.x, y: m.y, w: m.w, h: m.h, exit: m.exit, hidden: m.hidden }, helpTop: hr && hr.top - cv.top, helpL: hr && hr.left - cv.left, helpR: hr && hr.right - cv.left };
    });
    ok(g.m && g.m.exit, `g ${sz.name} 첫 지도 목적지 표시 = 출구 핀 ${JSON.stringify(g.m)}`);
    if (g.m && g.helpTop != null) ok(g.m.y + g.m.h / 2 <= g.helpTop + 1, `g ${sz.name} 출구 핀 아래 끝(${Math.round(g.m.y + g.m.h / 2)})이 안내 띠 위(${Math.round(g.helpTop)})`);
    else ok(g.helpTop == null, `g ${sz.name} 안내 띠 없음`);
    await p.screenshot({ path: shot(`room-exit-${sz.name}`) });
    await p.ctx.close();
  }

  /* ── h 확인 경로 화면 ── */
  if (ONLY.includes('h')) {
    // 1장 카드 요약: '찍혔다' + '28명에게 퍼졌다'
    const ch1 = SNAP.chapters.find((s) => { const n = E.advance(story, s); return story.scenes[(n.screen === 'map' && n.mapTarget) || n.scene].chapter === 'sc'; });
    if (ok(!!ch1, 'h 1장 카드 상태')) {
      const p = await open(D.dev, { run: ch1 });
      const rec = await p.evaluate(() => [...document.querySelectorAll('#c-summary .c-recap li')].map((li) => li.textContent));
      ok(rec.includes('민준이가 자는 모습이 동의 없이 찍혔다.') && rec.includes('사진이 반 단톡방 28명에게 퍼졌다.'), `h 1장 카드 요약에 올린 사실도 ${JSON.stringify(rec)}`);
      await p.screenshot({ path: shot('chapter1-1280x800') });
      await p.ctx.close();
    }
    // AI 붙여 넣기: 고른 직후 내 메시지
    {
      const p = await open(D.dev, { run: SNAP.scenes.c2_e5_a });
      await passTalk(p);
      await p.click('#g-dock .choice[data-choice="all"]'); await p.waitForTimeout(700);
      const log = await p.evaluate(() => [...document.querySelectorAll('#g-log .ln')].map((li) => li.className + '|' + li.textContent));
      const meAt = log.findIndex((t) => /붙여 넣음/.test(t)), draftAt = log.findIndex((t) => /안내문 초안입니다/.test(t));
      ok(meAt >= 0 && (draftAt < 0 || meAt < draftAt), `h AI 창: 붙여 넣은 내용(내 메시지)이 안내문보다 먼저 (${meAt}/${draftAt})`);
      ok(meAt >= 0 && /me|mine|self/.test(log[meAt].split('|')[0]), `h AI 창: 내가 보낸 말풍선 (${log[meAt] && log[meAt].split('|')[0]})`);
      await p.evaluate(() => { const m = [...document.querySelectorAll('#g-log .ln.me')].pop(); if (m) m.scrollIntoView({ block: 'start' }); }); // 스크린샷에 붙여 넣은 메시지가 보이게
      await p.waitForTimeout(200);
      await p.screenshot({ path: shot('ai-paste-1280x800') });
      await p.ctx.close();
    }
    // 에필로그 담임
    for (const sz of [D, M]) {
      const p = await open(sz.dev, { run: SNAP.scenes.ep_1 });
      const seen = await passTalk(p, () => /이미 퍼진 건 되돌릴 수 없지만/.test((document.getElementById('talk') || {}).textContent || ''));
      const txt = await p.evaluate(() => (document.getElementById('talk') || {}).textContent || '');
      ok(seen && !/더 커지기 전에/.test(txt), `h ${sz.name} 에필로그 담임: 퍼진 것을 인정하는 대사`);
      await p.screenshot({ path: shot(`epilogue-teacher-${sz.name}`) });
      await p.ctx.close();
    }
    // 엔딩 C 본문
    for (const sz of [D, M]) {
      // 엔딩 화면은 '이어 하기'가 없다 → 에필로그에서 넘겨 엔딩에 도착(연출 닫기까지, ending-a-recovery-1114-browser와 같은 방식)
      const p = await open(sz.dev, { run: SNAP.scenes.ep_1 });
      for (let k = 0; k < 80; k++) {
        if (await p.evaluate(() => { const v = document.getElementById('v-ending'); return PrivacyApp.state().screen === 'ending' && !!(v && !v.hidden && v.offsetParent !== null); })) break;
        await p.evaluate(() => {
          if (window.PrivacyTalk && PrivacyTalk.isOpen()) { PrivacyTalk.next(); return; }
          const fin = document.querySelector('.finale'); if (fin && fin.offsetParent !== null) { fin.click(); const b = fin.querySelector('button'); if (b) b.click(); return; }
          const b = [...document.querySelectorAll('#g-next button, #g-dock button')].filter((x) => !x.disabled && x.offsetParent !== null).pop(); if (b) b.click();
        });
        await p.waitForTimeout(250);
      }
      await p.waitForTimeout(500);
      const body = await p.evaluate(() => document.getElementById('e-body').textContent);
      ok(/지우고 사과했지만, 이미 본 사람들의 기억까지/.test(body) && !/아무 말도 하지 않았던 순간들/.test(body), `h ${sz.name} 엔딩 C 본문: 수습 경로 문장`);
      for (let k = 0; k < 4 && await p.evaluate(() => { const f = document.querySelector('.finale'); return !!(f && f.offsetParent !== null); }); k++) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); } // 엔딩 연출을 닫고 본문을 찍는다
      await p.evaluate(() => document.getElementById('e-body').scrollIntoView({ block: 'start' }));
      await p.waitForTimeout(200);
      await p.screenshot({ path: shot(`ending-c-${sz.name}`) });
      ok(p.errors.length === 0, `h ${sz.name} 엔딩 오류 없음 ${p.errors}`);
      await p.ctx.close();
    }
  }
} finally {
  await browser.close(); server.close();
}
console.log(`\nplaytest-1118-browser: 통과 ${pass} · 실패 ${fails.length}`);
process.exit(fails.length ? 1 : 0);
