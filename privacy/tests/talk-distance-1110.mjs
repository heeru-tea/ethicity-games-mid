// 2026-11-10 사용자 결정(말 걸 때 밀치지 않기): 화면에서 사람을 누르면 바로 옆이 아니라 한 칸 띄운 자리(같은 줄 2칸)에서 멈춰 말을 건다.
//   node privacy/tests/talk-distance-1110.mjs (PLAYWRIGHT_PATH) — 1148×977 마우스 · 390×844 터치
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;
let s = E.createState(story);
for (let i = 0; i < 50 && !(s.screen === 'map' && s.mapTarget === 'pro_1'); i++) s = E.advance(story, s);
s.history = [];
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };
const server = await startServer(0), base = `http://127.0.0.1:${server.address().port}/privacy/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const vp of [{ width: 1148, height: 977 }, { width: 390, height: 844, m: 1 }]) {
    const ctx = await browser.newContext(vp.m ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: vp });
    const p = await ctx.newPage(), errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript((run) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.clear();
      localStorage.setItem('ethicity.privacy.settings.v1', JSON.stringify({ speed: 'instant', reduceMotion: true, look: 'm', helpFold: true, helpPlaces: ['a', 'b', 'c'] }));
      localStorage.setItem('ethicity.privacy.progress.v2', JSON.stringify({ v: 1, run, explored: {}, endingsSeen: [] })); }, s);
    await p.goto(base); await p.waitForTimeout(500); await p.click('#btn-continue'); await p.waitForTimeout(1500);
    for (let k = 0; k < 20 && await p.evaluate(() => PrivacyTalk.isOpen()); k++) { await p.evaluate(() => PrivacyTalk.next()); await p.waitForTimeout(100); }
    // 교실 민준(29,11) — 목적지가 아니라 대화만 열림. 교실 안 떨어진 자리(25,14)에서 민준을 누른다
    await p.evaluate(() => PrivacyMap.debug.place(25, 14, 'up')); // 휴대폰 화면에도 민준이 보이는 거리 await p.waitForTimeout(500);
    for (let k = 0; k < 40; k++) { const v = await p.evaluate(() => { const q = PrivacyMap.debug.tileToClient(29, 11), r = document.getElementById('m-canvas').getBoundingClientRect(); return q.x > r.left && q.x < r.right && q.y > r.top && q.y < r.bottom; }); if (v) break; await p.waitForTimeout(150); } // 순간이동 뒤 카메라가 따라올 때까지
    const pt = await p.evaluate(() => { const r = document.getElementById('m-canvas').getBoundingClientRect(), q = PrivacyMap.debug.tileToClient(29, 11), T = PrivacyMap.debug.view().T; return { x: q.x, y: q.y, r: [r.left, r.top], T }; }); // tileToClient = 칸 가운데
    if (vp.m) await p.touchscreen.tap(pt.x, pt.y); else await p.mouse.click(pt.x, pt.y);
    let me = null;
    for (let k = 0; k < 60; k++) { await p.waitForTimeout(150); const r = await p.evaluate(() => ({ me: PrivacyMap.debug.me(), open: PrivacyTalk.isOpen() })); if (r.open) { me = r.me; break; } }
    if (!me) console.log("   진단", vp.width, JSON.stringify(await p.evaluate(() => ({ me: PrivacyMap.debug.me(), say: document.getElementById("m-say").textContent, btn: document.getElementById("btn-map-act").textContent }))), JSON.stringify(pt));
    const d = me ? Math.abs(me.x - 29) + Math.abs(me.y - 11) : -1;
    ok(!!me && d === 2 && (me.x === 29 || me.y === 11), `${vp.width} 민준을 누르면 한 칸 띄운 자리에서 멈춰 말 걸기: ${JSON.stringify(me)} 거리 ${d}`);
    const n = await p.evaluate(() => PrivacyMap.debug.nudge());
    ok(n === null, `${vp.width} 한 칸 띄운 자리 대화 = 아무도 안 움직임 ${JSON.stringify(n)}`);
    ok(errs.length === 0, `${vp.width} 오류 ${errs}`);
    await ctx.close();
  }
} finally { await browser.close(); server.close(); }
console.log(`통과 ${pass} · 실패 ${fail}`); process.exitCode = fail ? 1 : 0;
