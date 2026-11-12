// 배경음악(ui/bgm.js)을 진짜 Edge로 본다(2026-11-12). 헤드리스라 소리는 들을 수 없다 — audio의 src·paused·volume·loop 상태와 요청만 본다.
//  ① 첫 화면: 누르기 전에는 곡을 받지 않는다 ② ‘게임 시작하기’ → 메인곡 반복 재생, 약 1초 뒤 0.14 ③ 직접 확인 → 조사곡으로 겹쳐 넘김(메인곡은 멈춤)
//  ④ 설정 → 배경음악 끄기: 모두 멈춤, 따로 키에 저장(진행 저장에는 없음) ⑤ 새로고침 뒤에도 꺼짐 유지, 다시 켜면 재생 ⑥ file://로 열어도 오류 없음
// 쓰기: node tests/bgm-browser.cjs — 브라우저 검사는 한 번에 하나(D:\Works\.browser-test.lock).
'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), { pathToFileURL } = require('node:url');
const root = path.join(__dirname, '..');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (file === path.resolve(root)) file = path.join(root, 'index.html');
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream'); res.end(data); });
});
const out = [];
const ok = (name, cond, extra) => out.push((cond ? 'PASS ' : 'FAIL ') + name + (cond || extra === undefined ? '' : ' :: ' + JSON.stringify(extra)));
const KEY = 'ethicity.transparency.settings.v1', PROGRESS = 'ethicity.transparency.progress.v1';
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ channel: 'msedge' });
  const st = p => p.evaluate(() => window.TransparencyBgm.state());
  try {
    for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      const tag = vp.width;
      const ctx = await browser.newContext({ viewport: vp }), p = await ctx.newPage(), errs = [], mp3 = [];
      p.on('pageerror', e => errs.push(e.message)); p.on('request', r => { if (/\.mp3/.test(r.url())) mp3.push(r.url().replace(url, '')); });
      await p.goto(url); await p.waitForTimeout(800);
      let s = await st(p);
      ok(`${tag} 첫 화면: 누르기 전에는 곡을 받지 않음`, Object.keys(s.tracks).length === 0 && mp3.length === 0 && s.on === true, { s, mp3 });
      // 곡을 받기 시작한 뒤(재생이 시작된 뒤) 1초 동안 커진다 — 받는 시간이 있어 끝날 때까지 기다린다(최대 5초)
      await p.locator('#app [data-act="start"]').click();
      await p.waitForFunction(() => { const t = window.TransparencyBgm.state().tracks.main; return t && Math.abs(t.volume - 0.14) < 0.001; }, null, { timeout: 5000 }).catch(() => {});
      s = await st(p);
      const m = s.tracks.main;
      ok(`${tag} 게임 시작하기 → 메인곡(반복·preload none) 재생, 약 1초 뒤 0.14`, s.cur === 'main' && m && /noche-del-taller\.mp3$/.test(m.src) && m.loop && m.preload === 'none' && !m.paused && Math.abs(m.volume - 0.14) < 0.001, s);
      await p.locator('.step-nav [data-act="next"]').click(); await p.locator('.step-nav [data-act="next"]').click(); await p.waitForTimeout(400);
      s = await st(p);
      ok(`${tag} 직접 확인 → 조사곡으로 겹쳐 넘기는 중(둘 다 재생)`, s.cur === 'search' && !s.tracks.search.paused && !s.tracks.main.paused && s.tracks.main.volume < 0.14, s);
      await p.waitForTimeout(1000); s = await st(p);
      ok(`${tag} 약 1초 뒤 메인곡 멈춤, 조사곡 0.14`, s.tracks.main.paused && !s.tracks.search.paused && Math.abs(s.tracks.search.volume - 0.14) < 0.001 && /searching-motif\.mp3$/.test(s.tracks.search.src), s);
      const t0 = s.tracks.search.time;
      await p.locator('[data-act="item"]').first().click(); await p.waitForTimeout(500); s = await st(p);
      ok(`${tag} 같은 화면 안에서 자료를 눌러도 같은 곡을 다시 시작하지 않음`, s.cur === 'search' && !s.tracks.search.paused && s.tracks.search.time >= t0, { t0, t: s.tracks.search.time });
      await p.locator('header [data-act="settings"]').click();
      const box = p.locator('#opt-bgm');
      ok(`${tag} 설정 창: ‘배경음악’ 체크(켜짐)`, (await box.isChecked()) && (await p.locator('label.check-row', { hasText: '배경음악' }).count()) === 1);
      const hit = await p.locator('label.check-row', { hasText: '배경음악' }).evaluate(e => Math.round(e.getBoundingClientRect().height));
      ok(`${tag} 설정 창: 누르는 곳 44px 이상`, hit >= 44, hit);
      await box.press('Space'); await p.waitForTimeout(200); s = await st(p);
      const saved = await p.evaluate(([a, b]) => [localStorage.getItem(a), localStorage.getItem(b)], [KEY, PROGRESS]);
      ok(`${tag} 키보드로 끄기: 모두 멈춤, 따로 키 {"bgm":false}, 진행 저장에는 없음`, !s.on && Object.values(s.tracks).every(x => x.paused) && saved[0] === '{"bgm":false}' && !/bgm/.test(saved[1] || ''), { s, saved });
      await p.reload(); await p.waitForTimeout(300); await p.locator('#app [data-act="start"]').click(); await p.waitForTimeout(500); s = await st(p);
      ok(`${tag} 새로고침 뒤에도 꺼짐 유지(눌러도 곡 없음)`, !s.on && Object.keys(s.tracks).length === 0, s);
      await p.locator('header [data-act="settings"]').click();
      ok(`${tag} 새로고침 뒤 설정 창 체크 해제`, !(await p.locator('#opt-bgm').isChecked()));
      await p.locator('#opt-bgm').click(); await p.waitForTimeout(1300); s = await st(p);
      ok(`${tag} 다시 켜면 지금 화면의 곡(직접 확인 → 조사곡) 재생`, s.on && s.cur === 'search' && !s.tracks.search.paused, s);
      await p.emulateMedia({ media: 'print' }); ok(`${tag} 인쇄 화면으로 바꿔도 오류 없음`, errs.length === 0, errs);
      ok(`${tag} 곡 파일 요청은 두 개(각 곡 한 번 이상)`, mp3.some(u => /noche/.test(u)) && mp3.some(u => /searching/.test(u)), mp3);
      ok(`${tag} 오류 없음`, errs.length === 0, errs);
      await ctx.close();
    }
    // file://로 열기(더블클릭): 저장이 막혀도, 소리를 못 읽어도 오류 없이
    {
      const ctx = await browser.newContext(), p = await ctx.newPage(), errs = [];
      p.on('pageerror', e => errs.push(e.message));
      await p.goto(pathToFileURL(path.join(root, 'index.html')).href); await p.locator('#app [data-act="start"]').click(); await p.waitForTimeout(1300);
      const s = await st(p);
      ok('file://: 시작 후 메인곡 상태, 오류 없음', s.cur === 'main' && errs.length === 0, { s, errs });
      await ctx.close();
    }
  } catch (e) { out.push('FAIL exception :: ' + (e && e.stack || e)); }
  finally { await browser.close(); server.close(); }
  console.log(out.join('\n'));
  const fails = out.filter(x => x.startsWith('FAIL')).length;
  console.log(fails ? `FAIL ${fails}` : `PASS ${out.length}`); process.exitCode = fails ? 1 : 0;
})();
