// 2026-11-12 외부 검토: 사건 4 마을별 결과·선발 기준표의 접근성 이름을 진짜 Edge의 접근성 트리로 본다.
// 표 머리는 aria-hidden이라 줄마다 열 이름이 든 이름을 준다 — 버튼은 aria-label ‘솔숲마을, 신청 12명, 합격 1명’, 읽기만 하는 줄은 화면 읽기 전용 글자(.sr) ‘비중’.
// 쓰기: node tests/a11y-camp-browser.cjs  (캡처 tests/screens/a11y-camp-*.png). 스크린리더가 실제로 읽는 소리는 보지 못한다.
'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..'), outDir = path.join(__dirname, 'screens');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const throughTitle = require('./through-title.cjs');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (file === path.resolve(root)) file = path.join(root, 'index.html');
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream'); res.end(data); });
});
const out = [];
const ok = (name, cond, extra) => out.push((cond ? 'PASS ' : 'FAIL ') + name + (cond || extra === undefined ? '' : ' :: ' + JSON.stringify(extra)));
const BUILD = `() => { const E = window.TransparencyEngine; let s = E.initial(); const goal = E.sceneOf('camp', 'check');
  while (s.scene < goal) { const k = E.caseKey(s.scene), st = E.stepOf(s.scene);
    if (st === 'hook' && k === 'camp') s = E.reduce(s, { type: 'ask', id: 'who' });
    if (st === 'check') { for (const id of E.checks[k]) s = E.reduce(s, { type: 'check', id }); for (const a of E.answers[k]) s = E.reduce(s, { type: 'judge', stamp: a }); }
    if (st === 'choose') { s = E.reduce(s, { type: 'choose', id: E.choices[k][0] }); continue; }
    if (st === 'follow') { const m = E.followMarks[k]; m.ids.forEach((id, i) => { s = E.reduce(s, { type: 'mark', id, value: k === 'photo' ? E.truth[i] : m.values[0] }); }); s = E.reduce(s, { type: 'follow-judge', stamp: E.followAnswers[k] }); }
    if (st === 'notice') { for (const id of E.noticeCards[k].must) s = E.reduce(s, { type: 'notice-pick', id }); s = E.reduce(s, { type: 'notice-post' }); }
    s = E.reduce(s, { type: 'next' }); }
  localStorage.setItem('ethicity.transparency.progress.v1', JSON.stringify(s)); }`;

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    for (const [tag, vp] of [['1280', { width: 1280, height: 800 }], ['390', { width: 390, height: 844 }]]) {
      const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'reduce' }), p = throughTitle(await ctx.newPage()), errs = [];
      p.on('pageerror', e => errs.push(e.message));
      await p.goto(url); await p.evaluate(`(${BUILD})()`); await p.reload();
      const D = await p.evaluate(() => window.TransparencyStory.cases.camp);
      await p.locator('[data-act="item"][data-id="camp-results"]').click();
      const want = D.results.rows.map(r => `${r.name}, 신청 ${r.apply}명, 합격 ${r.pass}명`);
      // 접근성 트리에서 읽은 이름(브라우저가 계산한 것)
      const snap = await p.locator('.camp-table').ariaSnapshot();
      out.push(`INFO ${tag} 마을별 결과 접근성 트리:\n` + snap);
      const names = [...snap.matchAll(/- button "([^"]*)"/g)].map(m => m[1]);
      ok(`${tag} 마을 버튼 넷의 접근성 이름에 신청·합격 구분`, JSON.stringify(names) === JSON.stringify(want), names);
      for (const n of want) ok(`${tag} role=button 이름 ‘${n}’로 하나 찾음`, (await p.getByRole('button', { name: n, exact: true }).count()) === 1);
      ok(`${tag} 표 머리는 접근성 트리에 없음(두 번 읽히지 않음)`, !/마을\s*신청\s*합격/.test(snap.replace(/"[^"]*"/g, '')) && (snap.match(/신청/g) || []).length === 4 && (snap.match(/합격/g) || []).length === 4, snap);
      const attrs = await p.locator('[data-act="village"]').evaluateAll(a => a.map(b => ({ label: b.getAttribute('aria-label'), mark: !!b.querySelector('mark'), cls: b.className, h: Math.round(b.getBoundingClientRect().height), nums: [...b.querySelectorAll('.num')].map(n => Math.round(n.getBoundingClientRect().right)), srW: [...b.querySelectorAll('.sr')].map(s => Math.round(s.getBoundingClientRect().width)) })));
      ok(`${tag} 정답 노출 없음: 네 버튼의 class·표시가 같고 이름은 모두 같은 형식`, attrs.every((a, i) => a.label === want[i] && !a.mark && a.cls === attrs[0].cls), attrs);
      ok(`${tag} 보이는 모양 그대로: 숫자 칸 오른쪽 맞춤, 버튼 안에 숨은 글자 없음, 줄 높이 44~60px`, attrs.every(a => a.nums.join() === attrs[0].nums.join() && a.srW.length === 0 && a.h >= 44 && a.h <= 60), attrs);
      await p.screenshot({ path: path.join(outDir, `a11y-camp-results-${tag}.png`) });
      // 키보드로 고르기: 틀린 마을 → 안내, 솔숲마을 → 확인
      const st0 = await p.evaluate(() => { const s = window.TransparencyGame.getState(); s.evidence = s.evidence.filter(id => id !== 'camp-results'); s.judgments.camp = [null, null, null]; s.furthest = s.scene; localStorage.setItem('ethicity.transparency.progress.v1', JSON.stringify(s)); return s.scene; });
      await p.reload(); await p.locator('[data-act="item"][data-id="camp-results"]').click(); void st0;
      await p.getByRole('button', { name: want[0], exact: true }).focus(); await p.keyboard.press('Enter');
      const hint = await p.locator('.tap-hint').innerText();
      await p.getByRole('button', { name: want[3], exact: true }).focus(); await p.keyboard.press('Space');
      const s = await p.evaluate(() => window.TransparencyGame.getState());
      const after = [...(await p.locator('.camp-table').ariaSnapshot()).matchAll(/- button "([^"]*)"/g)].map(m => m[1]);
      ok(`${tag} 키보드(Enter·Space)로 자료 찾기 그대로`, /절반 넘게/.test(hint) && s.evidence.includes('camp-results') && (await p.locator('.camp-table mark').innerText()) === '솔숲마을', { hint, ev: s.evidence });
      ok(`${tag} 찾은 뒤에도 이름 형식 같음`, JSON.stringify(after) === JSON.stringify(want), after);
      // 선발 기준표
      await p.locator('[data-act="item"][data-id="camp-criteria"]').click();
      const c0 = await p.locator('.crit-table').ariaSnapshot();
      ok(`${tag} 기준표: 안 연 줄은 ‘… 비중 열기’`, (c0.match(/비중 열기"/g) || []).length === 4 && !/0\.\d/.test(c0), c0);
      await p.getByRole('button', { name: '지난 구청 프로그램 참여 횟수 비중 열기', exact: true }).focus(); await p.keyboard.press('Enter');
      const c1 = await p.locator('.crit-table').ariaSnapshot();
      ok(`${tag} 기준표: 연 줄은 ‘항목, 비중 0.5’`, c1.includes('- button "지난 구청 프로그램 참여 횟수, 비중 0.5"'), c1);
      for (const id of ['essay', 'order', 'secret']) await p.locator(`[data-act="crit"][data-id="${id}"]`).click();
      const c2 = await p.locator('.crit-table').ariaSnapshot();
      out.push(`INFO ${tag} 선발 기준표(다 연 뒤) 접근성 트리:\n` + c2);
      ok(`${tag} 기준표: 다 연 뒤 읽기 줄에도 ‘비중’`, D.criteria.rows.every(r => c2.replace(/\s+/g, ' ').includes(`${r.name} 비중 ${r.w.toFixed(1)}`)), c2);
      await p.screenshot({ path: path.join(outDir, `a11y-camp-criteria-${tag}.png`) });
      ok(`${tag} 오류 없음`, errs.length === 0, errs);
      await ctx.close();
    }
  } catch (e) { out.push('FAIL 검사 예외 :: ' + e.message.split('\n').slice(0, 4).join(' / ')); }
  finally { await browser.close(); server.close(); }
  console.log(out.join('\n')); const fails = out.filter(x => x.startsWith('FAIL')).length;
  console.log(fails ? 'FAIL ' + fails : 'PASS ' + out.filter(x => x.startsWith('PASS')).length);
  process.exit(fails ? 1 : 0);
})();
