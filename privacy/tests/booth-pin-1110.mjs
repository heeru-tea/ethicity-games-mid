// 2026-11-10 사용자 버그: 3장 축제 부스(c3_e7_a 걷기)에서 하늘 머리 위 느낌표가 옆으로 비켜 서며 하늘 머리로 선(꼬리)이 이어짐.
//   원인 = 옆 반 친구가 하늘 바로 오른쪽 위(17,12)에 붙어 서서 핀 자리를 몸·이름표가 차지. 검사: 세 자리에서 핀이 제자리(tail 없음)
//   node privacy/tests/booth-pin-1110.mjs (PLAYWRIGHT_PATH), 스크린샷 tests/_shot-bug-tail-*.png
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;
const HERE = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
let s = E.createState(story);
for (let i = 0; i < 400 && !(s.screen === 'map' && s.mapTarget === 'c3_e7_a'); i++) {
  if (s.screen === 'scene' && E.needsChoice(story, s)) { const c = E.visibleChoices(story, story.scenes[s.scene], s)[0]; s = E.choose(story, s, c.id); }
  s = E.advance(story, s);
}
s.history = [];
const server = await startServer(0), base = `http://127.0.0.1:${server.address().port}/privacy/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const vp of [{ width: 1148, height: 977 }, { width: 390, height: 844, m: 1 }]) {
    const ctx = await browser.newContext(vp.m ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: vp });
    const p = await ctx.newPage();
    await p.addInitScript((run) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.clear();
      localStorage.setItem('ethicity.privacy.settings.v1', JSON.stringify({ speed: 'instant', reduceMotion: true, look: 'm', helpFold: true, helpPlaces: ['a', 'b', 'c'] }));
      localStorage.setItem('ethicity.privacy.progress.v2', JSON.stringify({ v: 1, run, explored: {}, endingsSeen: [] })); }, s);
    await p.goto(base); await p.waitForTimeout(500); await p.click('#btn-continue'); await p.waitForTimeout(1500);
    for (let k = 0; k < 20 && await p.evaluate(() => PrivacyTalk.isOpen()); k++) { await p.evaluate(() => PrivacyTalk.next()); await p.waitForTimeout(100); }
    const tr = WORLD.triggers.c3_e7_a, h = tr.cast.find((c) => c.who === 'haneul');
    for (const [dx, dy, dir, tag] of [[-3, 0, 'right', 'far'], [-1, 0, 'right', 'front'], [0, 1, 'up', 'below']]) {
      await p.evaluate(([x, y, d]) => PrivacyMap.debug.place(x, y, d), [h.x + dx, h.y + dy, dir]); await p.waitForTimeout(400);
      const m = await p.evaluate(() => PrivacyMap.debug.marker());
      const good = m && m.who === 'haneul' && !m.tail && !m.hidden;
      if (good) pass++; else { fail++; console.log('  ✗', vp.width, tag, JSON.stringify(m)); }
      await p.screenshot({ path: path.join(HERE, `_shot-bug-tail-${vp.width}-${tag}.png`) });
    }
    await ctx.close();
  }
} finally { await browser.close(); server.close(); }
console.log(`통과 ${pass} · 실패 ${fail}`); process.exitCode = fail ? 1 : 0;
