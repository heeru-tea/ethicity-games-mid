// 2026-11-14 회복 A 엔딩 화면 확인: node privacy/tests/ending-a-recovery-1114-browser.mjs
//   회복 A(사진 실수 → 내리고 사본 삭제 부탁) 진행을 엔딩 직전에 저장 → 이어 하기 → 엔딩 화면에 회복 A 요약·사건 줄·'없던 일이 되지는 않는다', 예방 A 문장 없음 (1280×800 · 390×844)
//   예방 A(routes.js A)는 예방 문장 그대로. 스크린샷 tests/_shot-1114-recovery-*.png · 브라우저 검사는 한 번에 하나(D:/Works/.browser-test.lock은 실행하는 쪽에서)
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), routes = require('./routes.js');
story.triggers = require('../js/world.js').triggers;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SIZES = [{ name: '1280x800', dev: { viewport: { width: 1280, height: 800 } } },
  { name: '390x844', dev: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } }];
const BASE = Object.fromEntries(routes.A.map((p) => p.split('#')));
// 마지막 장면에서 '계속'만 누르면 엔딩에 도착하는 상태(엔딩 연출·결과 저장까지 앱이 하게)
function beforeEnding(prefs) {
  let s = E.createState(story);
  for (let k = 0; k < 900; k++) {
    if (s.screen === 'scene' && E.needsChoice(story, s)) { const cs = E.visibleChoices(story, story.scenes[s.scene], s); s = E.choose(story, s, (cs.find((c) => c.id === prefs[s.scene]) || cs[0]).id); }
    if (s.screen === 'scene' && !E.needsChoice(story, s) && E.pendingNext(story, s) === '@ending') return s;
    s = E.advance(story, s);
  }
  throw new Error('엔딩 앞까지 못 감');
}
const server = await startServer(0), base = `http://127.0.0.1:${server.address().port}/privacy/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗ ' + m); } return !!c; };
async function endingText(run, dev, shotName) {
  const ctx = await browser.newContext(dev);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((p) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1'); localStorage.clear();
    localStorage.setItem('ethicity.player', '{"character":"char_03","nickname":"반짝이는 고래"}');
    localStorage.setItem('ethicity.privacy.settings.v1', '{"speed":"instant","reduceMotion":true,"look":"f"}');
    localStorage.setItem('ethicity.privacy.progress.v2', p);
  }, JSON.stringify({ v: 1, run, explored: {}, endingsSeen: [] }));
  await page.goto(base);
  await page.click('#btn-continue'); await page.waitForTimeout(800);
  for (let k = 0; k < 60; k++) {
    const st = await page.evaluate(() => PrivacyApp.state().screen);
    if (st === 'ending' && await page.evaluate(() => { const v = document.getElementById('v-ending'); return !!(v && !v.hidden && v.offsetParent !== null); })) break;
    await page.evaluate(() => {
      const od = document.querySelector('.finale-odds'); if (od) window.__oddsSeen = od.textContent; // 엔딩 연출 안의 확률 문장(엔딩 화면 글에는 없다)
      if (window.PrivacyTalk && PrivacyTalk.isOpen()) { PrivacyTalk.next(); return; }
      const fin = document.querySelector('.finale'); if (fin && fin.offsetParent !== null) { fin.click(); const b = fin.querySelector('button'); if (b) b.click(); return; }
      const b = [...document.querySelectorAll('#g-next button, #g-dock button')].filter((x) => !x.disabled && x.offsetParent !== null).pop(); if (b) b.click();
    });
    await page.waitForTimeout(250);
  }
  const txt = await page.evaluate(() => (document.getElementById('v-ending') || document.body).innerText);
  const odds = await page.evaluate(() => (document.querySelector('.finale-odds') || {}).textContent || window.__oddsSeen || ''); // 엔딩에 닿으면 연출이 엔딩 화면 위에 떠 있다
  await page.screenshot({ path: path.join(HERE, `_shot-1114-recovery-${shotName}.png`), fullPage: true });
  await ctx.close();
  return { txt, errors, odds };
}
try {
  for (const sz of SIZES) {
    const rec = await endingText(beforeEnding({ ...BASE, c1_e2_a: 'shoot', c1_e2_b: 'group', c1_e2_d: 'all' }), sz.dev, 'e2-' + sz.name);
    ok(/함께 세운 경계/.test(rec.txt) && /할 수 있는 수습을 했다/.test(rec.txt) && /민준이의 사진을 묻지 않고 찍어/.test(rec.txt) && /없던 일이 되지는 않는다/.test(rec.txt), `${sz.name} 회복 A 엔딩 문장 ${rec.txt.slice(0, 200)}`);
    ok(!/매번 상대에게|필요할 때 상대에게 물으며|함부로 꺼내지 않는 데서|\[\[/.test(rec.txt), `${sz.name} 회복 A에 예방 A 문장·강조 기호 없음`);
    ok(rec.errors.length === 0, `${sz.name} 회복 A 오류 ${rec.errors}`);
    // 2026-11-14 사용자 결정: 엔딩 A는 확률 숫자 대신 문장
    ok(rec.odds === '아무렇게나 골라서는 거의 나오지 않는 엔딩이에요.', `${sz.name} 엔딩 A 연출의 확률 문장(숫자 없음) “${rec.odds}”`);
    const pre = await endingText(beforeEnding(BASE), sz.dev, 'prevent-' + sz.name);
    ok(/함께 세운 경계/.test(pre.txt) && /매번 상대에게 물으며/.test(pre.txt) && !/수습을 했다|없던 일이 되지는/.test(pre.txt), `${sz.name} 예방 A 문장 그대로 ${pre.txt.slice(0, 160)}`);
    ok(pre.errors.length === 0, `${sz.name} 예방 A 오류 ${pre.errors}`);
    // 2026-11-14 최종 검토: 올리기 전에 멈추고 찍어 둔 사진을 지운 경로(c1_e2_k del)도 회복 A — 문장은 "단톡방에 올렸다"가 아니라 한 일 그대로
    const early = await endingText(beforeEnding({ ...BASE, c1_e2_a: 'shoot', c1_e2_b: 'ask', c1_e2_k: 'del' }), sz.dev, 'e2-early-' + sz.name);
    ok(/함께 세운 경계/.test(early.txt) && /올리기 전에 민준이에게 물었고/.test(early.txt) && /찍어 둔 사진도 지우고/.test(early.txt) && !/단톡방에 올렸다/.test(early.txt), `${sz.name} 게시 전 수습 회복 A 문장 ${early.txt.slice(0, 220)}`);
    ok(early.errors.length === 0, `${sz.name} 게시 전 수습 오류 ${early.errors}`);
    const left = await endingText(beforeEnding({ ...BASE, c1_e2_a: 'shoot', c1_e2_b: 'ask', c1_e2_k: 'kept' }), sz.dev, 'e2-kept-' + sz.name);
    ok(!/함께 세운 경계/.test(left.txt) && /멈춘 확산, 남은 과제/.test(left.txt), `${sz.name} 사진을 그대로 둔 경로는 A가 아니다(B) ${left.txt.slice(0, 120)}`);
  }
} finally { await browser.close(); server.close(); }
console.log(`\nending-a-recovery-1114-browser: 통과 ${pass} · 실패 ${fails.length}`);
if (fails.length) process.exit(1);
