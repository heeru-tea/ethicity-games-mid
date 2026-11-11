// 게임이 실제로 받아 가는 파일 재기(2026-11-12): 대표 경로 A·D를 따라가며 장면·지도 상태마다 한 번씩 열어, 브라우저가 요청한 파일을 모은다.
//   node privacy/tests/asset-trace-1112.mjs  → 확장자별 개수·용량, 50KB 넘는 PNG 요청, 실패한 요청, 한 번도 요청되지 않은 assets 파일
//   배포 사본에서 PNG 원본을 빼도 되는지 판단하는 근거용(전수 조사가 아니라 표본 — 엔딩 B·C만의 장면, 드문 분기는 빠질 수 있다)
//   MAX=상태 수 상한(기본 60) · 브라우저 검사는 한 번에 하나(D:/Works/.browser-test.lock은 실행하는 쪽에서)
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js'), routes = require('./routes.js');
story.triggers = WORLD.triggers;
const HERE = path.dirname(fileURLToPath(import.meta.url)), PRIV = path.resolve(HERE, '..'), REPO = path.resolve(PRIV, '..');
const MAX = Number(process.env.MAX || 60);

// 대표 경로를 따라가며 화면이 바뀌는 자리(지도 구간·새 장면)의 상태를 모은다
function statesOf(route) {
  const prefs = Object.fromEntries(route.map((p) => p.split('#'))), out = [], seen = new Set();
  let s = E.createState(story);
  for (let n = 0; n < 800 && s.screen !== 'ending'; n++) {
    const key = s.screen + ':' + (s.screen === 'map' ? s.mapTarget : s.scene);
    if ((s.screen === 'map' || s.screen === 'scene') && !s.reaction && !seen.has(key)) { seen.add(key); const c = E.clone(s); c.history = c.history.slice(-1); out.push({ key, run: c }); }
    if (s.screen === 'scene' && E.needsChoice(story, s)) { const cs = E.visibleChoices(story, story.scenes[s.scene], s); s = E.choose(story, s, (cs.find((c) => c.id === prefs[s.scene]) || cs[0]).id); }
    s = E.advance(story, s);
  }
  out.push({ key: 'ending:' + s.ending, run: s });
  return out;
}
const all = new Map();
for (const code of ['A', 'D', 'B', 'C']) for (const st of statesOf(routes[code])) if (!all.has(st.key)) all.set(st.key, st.run);
const states = [...all.entries()].slice(0, MAX);

const server = await startServer(0), origin = `http://127.0.0.1:${server.address().port}`, base = origin + '/privacy/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const got = new Map(), failed = new Map(), errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => { const u = decodeURIComponent(new URL(r.url()).pathname); if (r.status() >= 400) failed.set(u, r.status()); else got.set(u, (got.get(u) || 0) + 1); });
  page.on('requestfailed', (r) => failed.set(decodeURIComponent(new URL(r.url()).pathname), 'failed'));
  await page.goto(base); await page.waitForTimeout(1500); // 시작 화면
  for (const [key, run] of states) {
    await page.evaluate(([p, s]) => { localStorage.setItem('ethicity.privacy.progress.v2', p); localStorage.setItem('ethicity.privacy.settings.v1', s); },
      [JSON.stringify({ v: 1, run, explored: {}, endingsSeen: run.screen === 'ending' ? [run.ending] : [] }), JSON.stringify({ speed: 'instant', reduceMotion: true, look: 'f', sound: false, soundSet: true })]);
    await page.reload(); await page.waitForTimeout(400);
    if (run.screen === 'ending') { const b = await page.$('#btn-start-card:not([hidden])'); if (b) { await b.click(); await page.waitForTimeout(600); } }
    else { const b = await page.$('#btn-continue:not([hidden])'); if (b) { await b.click(); await page.waitForTimeout(1300); } }
    // 장면 무대의 대화창을 몇 번 넘겨 그림 줄(사진·영상·CCTV)이 뜨게
    for (let k = 0; k < 6; k++) { await page.evaluate(() => { if (window.PrivacyTalk && PrivacyTalk.isOpen()) PrivacyTalk.next(); const b = document.querySelector('.skip-btn'); if (b) b.click(); }); await page.waitForTimeout(150); }
  }
  await ctx.close();
} finally { await browser.close(); server.close(); }

const fileOf = (u) => path.join(REPO, u.replace(/^\//, ''));
const rows = [...got.keys()].map((u) => { const f = fileOf(u); return { u, ext: path.extname(u).toLowerCase() || '(없음)', size: fs.existsSync(f) && fs.statSync(f).isFile() ? fs.statSync(f).size : 0 }; });
const byExt = {};
for (const r of rows) { const e = byExt[r.ext] || (byExt[r.ext] = { n: 0, kb: 0 }); e.n++; e.kb += r.size / 1024; }
console.log(`상태 ${states.length}개(전체 ${all.size}) · 요청된 파일 ${rows.length}개 · 합 ${(rows.reduce((a, r) => a + r.size, 0) / 1048576).toFixed(1)}MB`);
for (const [e, v] of Object.entries(byExt).sort((a, b) => b[1].kb - a[1].kb)) console.log(`  ${e.padEnd(6)} ${String(v.n).padStart(4)}개 ${(v.kb / 1024).toFixed(2)}MB`);
const bigPng = rows.filter((r) => r.ext === '.png' && r.size > 50 * 1024).sort((a, b) => b.size - a.size);
console.log(`50KB 넘는 PNG 요청 ${bigPng.length}개:`); bigPng.slice(0, 30).forEach((r) => console.log(`  ${(r.size / 1024).toFixed(0).padStart(6)}KB ${r.u}`));
console.log(`PNG 요청 전체 ${rows.filter((r) => r.ext === '.png').length}개 · 합 ${(rows.filter((r) => r.ext === '.png').reduce((a, r) => a + r.size, 0) / 1024).toFixed(0)}KB`);
console.log(`실패한 요청 ${failed.size}개:`, [...failed.entries()].slice(0, 12).map(([u, s]) => u + ' ' + s).join(' | '));
// assets 아래에서 한 번도 요청되지 않은 파일
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((x) => (x.isDirectory() ? walk(path.join(d, x.name)) : [path.join(d, x.name)]));
const asked = new Set(rows.map((r) => path.normalize(fileOf(r.u))));
const unused = walk(path.join(PRIV, 'assets')).filter((f) => !asked.has(path.normalize(f))).map((f) => ({ f: path.relative(PRIV, f).replace(/\\/g, '/'), size: fs.statSync(f).size }));
const uExt = {};
for (const x of unused) { const e = path.extname(x.f).toLowerCase(); const v = uExt[e] || (uExt[e] = { n: 0, mb: 0 }); v.n++; v.mb += x.size / 1048576; }
console.log(`요청되지 않은 assets 파일 ${unused.length}개 · 합 ${(unused.reduce((a, x) => a + x.size, 0) / 1048576).toFixed(1)}MB:`, Object.entries(uExt).map(([e, v]) => `${e} ${v.n}개 ${v.mb.toFixed(1)}MB`).join(' · '));
fs.writeFileSync(path.join(process.env.OUT_DIR || (await import('node:os')).tmpdir(), 'privacy-asset-trace-1112.json'), JSON.stringify({ states: states.map((s) => s[0]), requested: rows, failed: [...failed.entries()], unused }, null, 1));
console.log('오류', errors.length, errors.slice(0, 3).join(' | '));
