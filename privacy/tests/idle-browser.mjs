// 요일·상황별 한마디(js/idle-lines.js) 실제 게임 확인: node privacy/tests/idle-browser.mjs (PLAYWRIGHT_PATH = playwright 모듈 경로)
//   같은 사람에게 두 날 말을 걸면 다른 줄 · 같은 날 다시 걸면 다음 줄로 차례 · 다 쓰면 '지금은 …자.' 안내
//   스크린샷 tests/_shot-idle-*.png (1280×800 · 390×844)
import { createRequire } from 'node:module'; import assert from 'node:assert/strict'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js'), IL = require('../js/idle-lines.js');
story.triggers = WORLD.triggers;
const HERE = path.dirname(fileURLToPath(import.meta.url));

// 무작위 진행으로 그 걷기 구간(맵) 앞 상태를 만든다. need = 그 순간 맞아야 할 조건
function mapRun(target, need) {
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let tries = 0; tries < 20000; tries++) {
    let s = E.createState(story);
    for (let step = 0; step < 500 && s.screen !== 'ending'; step++) {
      if (s.screen === 'map' && s.mapTarget === target && (!need || E.evalCond(need, s))) { s.history = s.history.slice(-1); return s; }
      if (s.screen === 'scene' && E.needsChoice(story, s)) {
        const cs = E.visibleChoices(story, story.scenes[s.scene], s);
        s = E.choose(story, s, cs[Math.floor(rnd() * cs.length)].id); s.history = [];
      }
      s = E.advance(story, s);
    }
  }
  throw new Error('경로 없음: ' + target);
}

const server = await startServer(0), base = `http://127.0.0.1:${server.address().port}/privacy/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let pass = 0;
const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok ' + m); };
async function open(run, [w, h]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } }), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((p) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('ethicity.player', '{"character":"char_03","nickname":"반짝이는 고래"}');
    localStorage.setItem('ethicity.privacy.settings.v1', '{"speed":"instant","reduceMotion":true,"look":"f","sound":false,"soundSet":true}');
    localStorage.setItem('ethicity.privacy.progress.v2', p);
  }, JSON.stringify({ v: 1, run, explored: {}, endingsSeen: [] }));
  await page.goto(base);
  await page.click('#btn-continue');
  await page.waitForTimeout(1500);
  for (let k = 0; k < 40 && await page.evaluate(() => PrivacyTalk.isOpen()); k++) { await page.evaluate(() => PrivacyTalk.next()); await page.waitForTimeout(60); }
  await page.waitForTimeout(300);
  // 장 넘김 화면이 먼저 나오면 넘긴다
  if (await page.evaluate(() => document.body.getAttribute('data-view') === 'v-chapter')) { await page.evaluate(() => document.getElementById('btn-chapter-go').click()); await page.waitForTimeout(800); }
  const view = await page.evaluate(() => document.body.getAttribute('data-view'));
  assert.equal(view, 'v-map', `${run.mapTarget}: 지도 화면이 아님(${view})`);
  page.errors = errors;
  return page;
}
// 그 사람 바로 옆 걷는 칸에 서서 바라보기
async function standBy(page, who) {
  return page.evaluate((who) => {
    const W = window.PRIVACY_WORLD, t = W.triggers[PrivacyApp.state().mapTarget], c = t.cast.filter((k) => k.who === who)[0];
    for (const [dx, dy, dir] of [[0, 1, 'up'], [-1, 0, 'right'], [1, 0, 'left'], [0, -1, 'down']]) {
      PrivacyMap.debug.place(c.x + dx, c.y + dy, dir);
      const m = PrivacyMap.debug.me();
      if (m.x === c.x + dx && m.y === c.y + dy) return true;
    }
    return false;
  }, who);
}
// 말 걸고 첫 줄·전체 줄을 읽은 뒤 닫기
async function talkOnce(page, shot) {
  await page.evaluate(() => document.getElementById('btn-map-act').click());
  await page.waitForTimeout(300);
  const lines = [];
  for (let k = 0; k < 10 && await page.evaluate(() => PrivacyTalk.isOpen()); k++) {
    lines.push(await page.evaluate(() => document.querySelector('.talk-text').textContent.trim()));
    if (shot && k === 0) await page.screenshot({ path: shot });
    await page.evaluate(() => PrivacyTalk.next()); await page.waitForTimeout(80);
  }
  return lines;
}

const CASES = [ // [인물, 걷기1, 걷기2, 그 상태 조건(사이가 멀어지지 않은 판으로)]
  ['saebom', 'c1_e2_a', 'c2_e6_a', 'trust.saebom>=0'],
  ['jiho', 'c1_e2_a', 'c2_e4_a', 'trust.jiho>=0']
];
const shots = [];
try {
  for (const [who, d1, d2, need] of CASES) {
    const seen = {};
    for (const walk of [d1, d2]) {
      const size = walk === d1 ? [1280, 800] : [390, 844];
      const run = mapRun(walk, need);
      const page = await open(run, size);
      ok(await standBy(page, who), `${walk} ${who} 옆에 섬`);
      const cond = (c) => E.evalCond(c, run);
      const pool = IL.pool(walk, who, cond);
      const got = [];
      for (let i = 0; i < pool.length + 2; i++) {
        const shot = i === 0 ? path.join(HERE, `_shot-idle-${who}-${walk}-${size[0]}.png`) : null;
        const lines = await talkOnce(page, shot);
        if (shot) shots.push(shot);
        got.push(lines);
      }
      // ?가 남아 있던 사람이면 첫 말은 그 줄(이야기 줄) — 한마디는 그 뒤부터
      const start = pool.includes(got[0][0]) ? 0 : 1;
      const firsts = got.slice(start, start + pool.length).map((l) => l[0]);
      ok(firsts.join('|') === pool.join('|') && got.slice(start, start + pool.length).every((l) => l.length === 1), `${walk} ${who}: 같은 날 다시 걸면 차례로 ${pool.length}줄 (${firsts.join(' / ')})`);
      const after = got[start + pool.length];
      // '한 번에' 속도는 대사와 안내를 한 창에 함께 보여 준다(줄 수가 아니라 글로 확인)
      const a = (after || []).join(' ');
      ok(a.includes(pool[0]) && /지금은/.test(a), `${walk} ${who}: 다 쓴 뒤 첫 줄로 돌아오고 다음 목적지 안내 ${JSON.stringify(after)}`);
      ok(page.errors.length === 0, `${walk} 오류 없음 ${page.errors}`);
      seen[walk] = new Set(pool);
      await page.close();
    }
    ok([...seen[d1]].every((t) => !seen[d2].has(t)), `${who}: ${d1}와 ${d2}의 줄이 서로 다름`);
  }
  console.log(`idle-browser: ${pass} PASS`);
  console.log('screenshots:\n' + shots.join('\n'));
} finally {
  await browser.close(); server.close();
}
