// 2026-11-10 사용자 요청: 에필로그(ep_1, 다음 주 월요일 교실) 칠판에 '프라이버시'가 적혀 있게 — 그림은 그대로, 캔버스에 분필 글씨.
//   검사: ep_1 무대에서 칠판 글씨가 그려지고(debug.board) 칠판 안쪽에 밝은 분필 점이 있음. 다른 교실 무대(c1_e2_a)에는 없음.
//   node privacy/tests/board-1110.mjs (PLAYWRIGHT_PATH), 스크린샷 tests/_shot-board-*.png
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;
const HERE = path.dirname(fileURLToPath(import.meta.url));
function runTo(id) {
  let s = E.createState(story);
  for (let i = 0; i < 800; i++) {
    if (s.screen === 'scene' && s.scene === id) { s.history = s.history.slice(-1); return s; }
    if (s.screen === 'scene' && E.needsChoice(story, s)) { const c = E.visibleChoices(story, story.scenes[s.scene], s)[0]; s = E.choose(story, s, c.id); }
    s = E.advance(story, s);
  }
  throw new Error('못 감 ' + id);
}
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };
const server = await startServer(0), base = `http://127.0.0.1:${server.address().port}/privacy/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const vp of [{ width: 1148, height: 977 }, { width: 390, height: 844, m: 1 }]) {
    for (const id of ['ep_1', 'c1_e2_a']) {
      const ctx = await browser.newContext(vp.m ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: vp });
      const p = await ctx.newPage(), errs = []; p.on('pageerror', (e) => errs.push(e.message));
      await p.addInitScript((run) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.clear();
        localStorage.setItem('ethicity.privacy.settings.v1', JSON.stringify({ speed: 'instant', reduceMotion: true, look: 'm', helpFold: true, helpPlaces: ['a', 'b', 'c'] }));
        localStorage.setItem('ethicity.privacy.progress.v2', JSON.stringify({ v: 1, run, explored: {}, endingsSeen: [] })); }, runTo(id));
      await p.goto(base); await p.waitForTimeout(500); await p.click('#btn-continue'); await p.waitForTimeout(2500);
      const r = await p.evaluate(() => {
        const b = PrivacyMap.debug.board && PrivacyMap.debug.board();
        if (!b) return { b: null };
        const cv = document.getElementById('m-canvas'), ctx = cv.getContext('2d'), k = cv.width / cv.getBoundingClientRect().width;
        const d = ctx.getImageData(Math.round(b.x0 * k), Math.round(b.y0 * k), Math.max(1, Math.round((b.x1 - b.x0) * k)), Math.max(1, Math.round((b.y1 - b.y0) * k))).data;
        let bright = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) bright++;
        return { b, bright };
      });
      if (id === 'ep_1') ok(!!r.b && r.b.text === '프라이버시' && r.bright > 50, `${vp.width} 에필로그 칠판에 '프라이버시' 분필 글씨 ${JSON.stringify(r)}`);
      else ok(!r.b, `${vp.width} 다른 교실 장면(${id})에는 칠판 글씨 없음 ${JSON.stringify(r.b)}`);
      ok(errs.length === 0, `${vp.width} ${id} 오류 ${errs}`);
      await p.screenshot({ path: path.join(HERE, `_shot-board-${id}-${vp.width}.png`) });
      await ctx.close();
    }
  }
} finally { await browser.close(); server.close(); }
console.log(`통과 ${pass} · 실패 ${fail}`); process.exitCode = fail ? 1 : 0;
