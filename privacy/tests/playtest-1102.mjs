// 2026-11-02 플레이테스트 수정 회귀 검사: node privacy/tests/playtest-1102.mjs (PLAYWRIGHT_PATH = playwright 모듈 경로)
//   P0-1 장면 무대 카메라가 지금 장면 밖(검은 띠)을 비추지 않음 · P0-2 말 걸기 버튼은 목적지·? 인물만 ?로, 할 말 끝난 사람은 다음 목적지 안내
//   P0-3 속마음(kind:'thought')은 보낸 말풍선이 아님 · P0-4 저녁·밤 무대 시간대 · P1 휴대폰 알림 카드·엔딩 타임라인 날짜·선택지 ▶ 하나
// 진행 상태는 엔진으로 만든 뒤 저장소에 넣고 '이어 하기'로 연다(무작위 탐색, 시도 상한 있음).
import { createRequire } from 'node:module'; import assert from 'node:assert/strict'; import { startServer } from './serve.mjs';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;

function makeRun(target, need, opts = {}) {
  let seed = opts.seed || 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let tries = 0; tries < 20000; tries++) {
    let s = E.createState(story);
    for (let step = 0; step < 500 && s.screen !== 'ending'; step++) {
      const hit = opts.map ? s.screen === 'map' && s.mapTarget === target : s.screen === 'scene' && s.scene === target && !s.reaction;
      if (hit && (!need || E.evalCond(need, s))) { s.history = s.history.slice(-1); return s; }
      if (s.screen === 'scene' && E.needsChoice(story, s)) {
        const cs = E.visibleChoices(story, story.scenes[s.scene], s);
        s = E.choose(story, s, cs[Math.floor(rnd() * cs.length)].id); s.history = [];
      }
      s = E.advance(story, s);
    }
  }
  throw new Error('경로 없음: ' + target + ' ' + (need || ''));
}

const server = await startServer(0), base = `http://127.0.0.1:${server.address().port}/privacy/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let pass = 0;
const ok = (c, m) => { assert.ok(c, m); pass++; };
async function open(run, [w, h] = [1148, 977]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } }), errors = [];
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
  await page.waitForTimeout(1500);
  for (let k = 0; k < 40 && await page.evaluate(() => PrivacyTalk.isOpen()); k++) { await page.evaluate(() => PrivacyTalk.next()); await page.waitForTimeout(60); }
  await page.waitForTimeout(400);
  page.errors = errors;
  return page;
}
const gaps = (page) => page.evaluate(() => { const v = PrivacyMap.debug.view(); return Object.values(v.gap).map(Math.round); });

try {
  // P0-1: 선택지·폰이 열린 장면 무대 — 보이는 지도 영역에 장면 밖이 1px도 없어야
  for (const id of ['c1_e2_a', 'c1_e3_b', 'c2_e4_a', 'c2_e6_a', 'c2_e5_a']) {
    const run = makeRun(id);
    for (const size of [[1148, 977], [1280, 800], [390, 844]]) {
      const page = await open(run, size);
      const g = await gaps(page);
      ok(g.every((x) => x <= 1), `${id} ${size.join('x')} 장면 밖 빈 곳 없음 ${g}`);
      ok(page.errors.length === 0, `${id} 오류 없음 ${page.errors}`);
      await page.close();
    }
  }
  // P0-2: c3_e8_a(민준 일을 모르는 척) — 하늘이에게 한 번 말 건 뒤 ? 없이 보조 모양 → 그날 한마디 n줄 차례로(js/idle-lines.js, 안내 없음)
  //   → 첫 되풀이에 다음 목적지 한 줄 → 그다음은 방향 안내 강조
  {
    const page = await open(makeRun('c3_e8_a', 'e7b=none && e6=leave || e7b=none && e6b=deny', { map: true }));
    const { out: r, n } = await page.evaluate(async () => {
      const b = document.getElementById('btn-map-act'), out = [];
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      // 인물 배치가 바뀌어도 하늘이 바로 옆에서 시작: 두 칸 떨어진 곳에서 한 걸음 걸어 다가간다(걸음이 끝나야 버튼 글자가 바뀜)
      const hc = window.PRIVACY_WORLD.triggers[PrivacyApp.state().mapTarget].cast.filter((k) => k.who === 'haneul')[0];
      const press = async (key) => { document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); await sleep(60); document.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true })); await sleep(500); };
      for (const [dx, dy, dir, key] of [[1, 0, 'left', 'ArrowLeft'], [-1, 0, 'right', 'ArrowRight'], [0, 1, 'up', 'ArrowUp'], [0, -1, 'down', 'ArrowDown']]) {
        PrivacyMap.debug.place(hc.x + 2 * dx, hc.y + 2 * dy, dir); await sleep(100);
        const m0 = PrivacyMap.debug.me(); if (m0.x !== hc.x + 2 * dx || m0.y !== hc.y + 2 * dy) continue;
        await press(key);
        const m = PrivacyMap.debug.me(); if (m.x === hc.x + dx && m.y === hc.y + dy) break;
      }
      const n = PrivacyIdleLines.pool(PrivacyApp.state().mapTarget, 'haneul', (c) => PrivacyEngine.evalCond(c, PrivacyApp.state())).length;
      out.push({ icon: !!b.querySelector('.ico-talk'), txt: b.textContent.trim(), ghost: b.classList.contains('ghost') });
      for (let i = 0; i < n + 3; i++) {
        b.click(); await sleep(300);
        const t = document.querySelector('.talk-text').textContent;
        while (PrivacyTalk.isOpen()) { PrivacyTalk.next(); await sleep(80); }
        out.push({ talk: t, icon: !!b.querySelector('.ico-talk'), ghost: b.classList.contains('ghost'), skip: document.getElementById('btn-map-skip').classList.contains('primary'), guide: PrivacyMap.debug.guide(), say: document.getElementById('m-say').textContent });
      }
      return { out, n };
    });
    ok(r[0].txt === '하늘에게 말 걸기' && r[0].icon && !r[0].ghost, '처음: ?가 뜬 하늘 → ? 그림 ' + JSON.stringify(r[0]));
    ok(!r[1].icon && r[1].ghost && !/지금은/.test(r[1].talk), '첫 말 뒤: ? 없이 보조 모양, 대사만 ' + JSON.stringify(r[1]));
    const days = r.slice(2, n + 2);
    ok(n >= 2 && days.every((x) => !/지금은/.test(x.talk) && x.ghost && !x.icon) && new Set(days.map((x) => x.talk)).size === n, '그다음 n번: 그날 한마디를 차례로, 안내 없음 ' + days.map((x) => x.talk).join(' / '));
    ok(/지금은 집에 가서 쉬자/.test(r[n + 2].talk) && !r[n + 2].guide, '한마디를 다 쓴 뒤 첫 되풀이: 다음 목적지 한 줄 ' + r[n + 2].talk);
    // 2026-11-02 모바일: 바로 가기 버튼은 일반 플레이에서 없어짐 → 3번째는 방향 안내(출구 반짝임·주인공 옆 화살표) 강조
    ok(/같은 말만 돌아온다/.test(r[n + 3].talk) && r[n + 3].guide && !r[n + 3].skip && /반짝이는 출구/.test(r[n + 3].say), '그다음: 목적지 안내 강조 + 방향 안내 강조(바로 가기 아님) ' + JSON.stringify(r[n + 3]));
    await page.close();
  }
  // P0-3: 속마음은 회색 줄(보낸 말풍선 아님), 화면 읽기에는 '속마음:'
  {
    const page = await open(makeRun('c3_e9_a', 'e8_video_spread'));
    const r = await page.evaluate(() => ({ th: (document.querySelector('#g-log .ln.thought') || {}).textContent || '',
      me: [...document.querySelectorAll('#g-log .ln.msg.me')].some((e) => /몇 초짜리/.test(e.textContent)) }));
    ok(/^속마음: 나도 몇 초짜리/.test(r.th) && !/…\./.test(r.th) && !r.me, '속마음 줄 ' + JSON.stringify(r));
    await page.close();
  }
  // P0-4: 저녁 8시 이후 내 방 = 밤
  for (const [id, tint] of [['c1_e1_a', 'night'], ['c2_e5_a', 'night'], ['c3_e8_b', 'night'], ['c3_e8_a', 'evening']]) {
    const page = await open(makeRun(id));
    ok(await page.evaluate(() => PrivacyMap.debug.view().tint) === tint, `${id} 시간대 ${tint}`);
    await page.close();
  }
  ok(WORLD.timeTint('D-1 · 밤 9:30') === 'night' && WORLD.timeTint('저녁 8:30') === 'night' && WORLD.timeTint('축제 당일 · 저녁 7:40') === 'evening' && WORLD.timeTint('D-1 · 오후 1:10') === 'day', 'tint 없는 무대의 기본 시간대');
  // P1: 공용 PC 창의 하늘 개인톡 = 휴대폰 알림 카드
  {
    const page = await open(makeRun('c2_e6_b', 'e6=post'));
    const n = await page.evaluate(() => [...document.querySelectorAll('#g-log .ln.push')].map((e) => e.textContent));
    ok(n.length === 2 && n.every((t) => /휴대폰 알림 · 하늘 \(개인톡\)/.test(t) && !/^\(개인톡\)/.test(t)), '휴대폰 알림 카드 ' + n);
    await page.close();
  }
  // P1: 선택지 ▶는 한 줄에만(포커스 줄 + 마우스 올린 줄이 다르면 마우스 쪽)
  {
    const page = await open(makeRun('c1_e2_a'));
    await page.hover('#g-dock .choice:nth-child(2)'); await page.waitForTimeout(200);
    const v = await page.evaluate(() => [...document.querySelectorAll('#g-dock .choice')].map((b) => getComputedStyle(b, '::before').visibility));
    ok(v.filter((x) => x === 'visible').length === 1 && v[1] === 'visible', '▶ 하나 ' + v);
    await page.close();
  }
  // P1: 엔딩 타임라인 사건 4(2026-11-10부터 'AI가 만든 가짜 춤 영상') 날짜 = D-1
  {
    const page = await open(makeRun('ep_1', 'e4'));
    await page.click('#btn-next'); await page.waitForTimeout(2500);
    const rows = await page.evaluate(() => [...document.querySelectorAll('.finale-choice')].map((e) => e.querySelector('.finale-date').textContent + '|' + e.querySelector('.finale-ev').textContent));
    ok(rows.includes('D-1|AI가 만든 가짜 춤 영상') && rows.every((r) => r.split('|')[0]), '타임라인 날짜 칸 모두 채움 ' + rows.join(', '));
    await page.close();
  }
  // P1: 엔딩 판정 보조값 harmed_others(엔딩 조건은 그대로)
  const st = (flags) => Object.assign(E.createState(story), { flags });
  ok(E.evalCond('harmed_others', st({ e3: 'capture' })) && E.evalCond('harmed_others', st({ e6b: 'cap' })) && E.evalCond('harmed_others', st({ e2post: 'group' })), 'harmed_others: 캡처 전달 2건 추가 + 단톡방에 올린 사진(2026-11-10)');
} finally {
  await browser.close(); server.close();
}
console.log('PASS playtest-1102 (' + pass + ')');
