// 2026-11-10 사용자 피드백: 축제 다음 날 '교실 내 자리에 앉기'(c3_e9_a)의 느낌표가 지호 이름표 옆에 떠서 어느 자리인지 헷갈림.
//   검사: 내 책상(desk8) 핀이 지호 이름표와 겹치지 않고 그 아래(이름표 아래 끝보다 아래), 내 책상 칸 가로 범위 안.
//   node privacy/tests/desk-pin-1110.mjs (PLAYWRIGHT_PATH), 스크린샷 tests/_shot-desk-pin-*.png
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;
const HERE = path.dirname(fileURLToPath(import.meta.url));
let s = E.createState(story);
for (let i = 0; i < 400 && !(s.screen === 'map' && s.mapTarget === 'c3_e9_a'); i++) {
  if (s.screen === 'scene' && E.needsChoice(story, s)) { const c = E.visibleChoices(story, story.scenes[s.scene], s)[0]; s = E.choose(story, s, c.id); }
  s = E.advance(story, s);
}
s.history = [];
let pass = 0, fail = 0;
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
    const cox = WORLD.SCENES.find((x) => x.id === 'classroom').ox;
    await p.evaluate((x) => PrivacyMap.debug.place(x, 15, 'up'), cox + 22); await p.waitForTimeout(500); // 교실 안, 내 책상에서 조금 떨어진 통로
    const r = await p.evaluate(() => ({ m: PrivacyMap.debug.marker(), tags: PrivacyMap.debug.tags(), cam: PrivacyMap.debug.cam(), T: PrivacyMap.debug.view().T }));
    const jiho = r.tags.find((t) => t.label === '지호'), m = r.m, d = WORLD.OBJECTS.find((o) => o.id === 'desk8');
    const dx0 = d.x * r.T - r.cam.x, dx1 = (d.x + d.w) * r.T - r.cam.x;
    const top = m.y - m.h / 2;
    const good = !!m && !!jiho && top >= jiho.y + jiho.h && m.x >= dx0 && m.x <= dx1;
    if (good) pass++; else { fail++; console.log('  ✗', vp.width, JSON.stringify({ m, jiho, desk: [dx0, dx1] })); }
    await p.screenshot({ path: path.join(HERE, `_shot-desk-pin-${vp.width}.png`) });
    await ctx.close();
  }
} finally { await browser.close(); server.close(); }
console.log(`통과 ${pass} · 실패 ${fail}`); process.exitCode = fail ? 1 : 0;
