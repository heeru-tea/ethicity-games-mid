// 2026-11-12 수정 요청(14건)의 ‘완료 확인’을 진짜 Edge로 본다: 1280×800·390×844에서
//  ① 사건 4 공개 페이지 칸이 한 줄인지(고치기 전 모습도 같은 화면에서 재현해 숫자로 남긴다) ② 빈 칸 둘을 다 눌러야 확인 ③ 구청 답 쌓기·관련 자료 표시
//  ④ 사건 3 점원의 말 문장별 안내 ⑤ 사건 5 답이 아닌 곳 안내 ⑥ 보고서·수첩에 바뀐 판단 문장 ⑦ version 6 저장으로 이어하기
// 쓰기: node tests/request-1112-browser.cjs  (캡처 tests/screens/req1112-*.png) — 브라우저 검사는 한 번에 하나(D:\Works\.browser-test.lock).
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
const KEY = 'ethicity.transparency.progress.v1';
// 페이지 안에서 engine으로 정답대로 걸어가 그 사건·단계에 선 저장을 만든다(to = 'report'면 보고서까지). v6 = 이번 수정 전 저장 모양으로 바꾼다.
const BUILD = `([key, step, v6]) => {
  const E = window.TransparencyEngine; let s = E.initial();
  const goal = key === 'report' ? E.REPORT : E.sceneOf(key, step);
  while (s.scene < goal) { const k = E.caseKey(s.scene), st = E.stepOf(s.scene);
    if (st === 'hook' && k === 'camp') s = E.reduce(s, { type: 'ask', id: 'who' });
    if (st === 'check') { for (const id of E.checks[k]) s = E.reduce(s, { type: 'check', id }); for (const a of E.answers[k]) s = E.reduce(s, { type: 'judge', stamp: a }); }
    if (st === 'choose') { s = E.reduce(s, { type: 'choose', id: E.choices[k][1] }); continue; }
    if (st === 'follow') { const m = E.followMarks[k]; m.ids.forEach((id, i) => { s = E.reduce(s, { type: 'mark', id, value: k === 'photo' ? E.truth[i] : m.values[0] }); }); s = E.reduce(s, { type: 'follow-judge', stamp: E.followAnswers[k] }); }
    if (st === 'notice') { for (const id of E.noticeCards[k].must) s = E.reduce(s, { type: 'notice-pick', id }); s = E.reduce(s, { type: 'notice-post' }); }
    s = E.reduce(s, { type: 'next' }); }
  if (v6) { s = JSON.parse(JSON.stringify(s)); s.version = 6; s.evidence = s.evidence.filter(id => id !== 'camp-bus'); s.judgments.camp[2] = 'confirmed'; s.follows.share.judgment = 'different'; s.reflections.camp = { q1: '기준표를 보고', q2: '' }; s.reporter = { name: '하늘', number: '10203' }; }
  localStorage.setItem('${KEY}', JSON.stringify(s)); return s.scene;
}`;
// 공개 페이지 칸: 너비·높이·값 글자가 몇 줄인지
const CELLS = `() => [...document.querySelectorAll('[data-act="cell"]')].map(b => { const v = b.querySelector('.kv-v'), r = document.createRange(); r.selectNodeContents(v);
  // 줄 수: 글자 상자의 가운데 높이가 10px 넘게 벌어지면 다른 줄(강조·표시 글자는 같은 줄에서도 위치가 조금 다르다)
  const mids = [...r.getClientRects()].map(x => (x.top + x.bottom) / 2).sort((a, b) => a - b); const lines = mids.reduce((n, y, i) => n + (i && y - mids[i - 1] > 10 ? 1 : 0), 1);
  return { id: b.dataset.id, w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height), lines, parent: Math.round(b.parentElement.getBoundingClientRect().width) }; })`;

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ channel: 'msedge' });
  const open = async (viewport, where) => {
    const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' }), p = throughTitle(await ctx.newPage()), errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errs.push(r.status() + ' ' + r.url().replace(url, '')); });
    await p.goto(url);
    if (where) { await p.evaluate(`(${BUILD})(${JSON.stringify(where)})`); await p.reload(); }
    return { ctx, p, errs };
  };
  const click = (p, sel) => p.locator(sel).first().click();
  const state = p => p.evaluate(() => window.TransparencyGame.getState());
  const hint = async p => (await p.locator('.tap-hint').count()) ? p.locator('.tap-hint').innerText() : '';
  const shot = (p, name, full) => p.screenshot({ path: path.join(outDir, 'req1112-' + name + '.png'), fullPage: !!full });
  try {
    for (const [tag, vp] of [['1280', { width: 1280, height: 800 }], ['390', { width: 390, height: 844 }]]) {
      // ---- 사건 4: 구청에 묻기 → 공개 페이지 ----
      {
        const { ctx, p, errs } = await open(vp, ['camp', 'hook']);
        await click(p, '[data-act="ask"][data-id="criteria"]'); await click(p, '[data-act="ask"][data-id="appeal"]');
        const f = await p.locator('.finding.answers').innerText();
        ok(`${tag} 구청에 묻기: 받은 답이 모두 쌓임`, (await p.locator('.answer-item').count()) === 2 && /기준표를 보내/.test(f) && /아직 따로 정한 방법/.test(f) && !/안 적혀/.test(f), f);
        await shot(p, 'camp-asks-' + tag, true);
        await click(p, '.step-nav [data-act="next"]');
        const asked = await p.locator('.items button.asked').evaluateAll(a => a.map(b => b.dataset.id + ':' + b.innerText.replace(/\s+/g, ' ')));
        ok(`${tag} 직접 확인: 물어본 질문과 이어지는 자료 버튼에 ‘물어본 것’`, asked.length === 2 && asked.every(x => /물어본 것/.test(x)) && asked[0].startsWith('camp-page') && asked[1].startsWith('camp-criteria'), asked);
        await click(p, '[data-act="item"][data-id="camp-page"]');
        const now = await p.evaluate(`(${CELLS})()`);
        // 고치기 전 모습을 같은 화면에서 재현: 옛 전역 규칙(.blank)과 옛 class를 잠깐 되돌려 잰다
        const before = await p.evaluate(`(() => { const st = document.createElement('style'); st.textContent = '.blank{display:inline-block;width:3.2em;border-bottom:2px solid currentColor;vertical-align:-2px;margin:0 2px}'; document.head.appendChild(st);
          const bs = [...document.querySelectorAll('[data-act="cell"].is-empty')]; bs.forEach(b => b.classList.add('blank')); const m = (${CELLS})(); bs.forEach(b => b.classList.remove('blank')); st.remove(); return m; })()`);
        out.push(`INFO ${tag} 공개 페이지 칸 — 고치기 전(재현): ` + JSON.stringify(before.filter(c => c.id === 'office' || c.id === 'appeal')));
        out.push(`INFO ${tag} 공개 페이지 칸 — 지금: ` + JSON.stringify(now));
        ok(`${tag} 고치기 전 재현: 빈 칸 버튼이 좁아지고 여러 줄`, before.filter(c => c.id === 'office' || c.id === 'appeal').every(c => c.w < 80 && c.lines > 1), before);
        ok(`${tag} 공개 페이지 칸 넷 모두 가득 찬 너비·값 한 줄`, now.length === 4 && now.every(c => Math.abs(c.w - c.parent) <= 1 && c.lines === 1 && c.h <= 60), now);
        await click(p, '[data-act="cell"][data-id="office"]');
        const one = { marks: await p.locator('.visual mark').count(), tags: await p.locator('.cell-tag').count(), done: (await state(p)).evidence.includes('camp-page'), hint: await hint(p) };
        ok(`${tag} 빈 칸 하나: 그 칸만 확인 표시, 자료는 아직`, one.marks === 1 && one.tags === 1 && !one.done && /하나 더 있어/.test(one.hint), one);
        await shot(p, 'camp-page-one-' + tag);
        await click(p, '[data-act="cell"][data-id="appeal"]');
        const two = { marks: await p.locator('.visual mark').count(), done: (await state(p)).evidence.includes('camp-page'), cells: await p.evaluate(`(${CELLS})()`) };
        ok(`${tag} 빈 칸 둘: 확인됨, 표시가 붙어도 한 줄`, two.marks === 2 && two.done && two.cells.every(c => c.lines === 1 && c.h <= 60), two);
        await shot(p, 'camp-page-' + tag);
        await click(p, '[data-act="item"][data-id="camp-bus"]');
        const note = await p.locator('.note-card p:not(.doc-label)').first().evaluate(e => ({ size: parseFloat(getComputedStyle(e).fontSize), text: e.innerText }));
        ok(`${tag} 버스 쪽지: 본문 크기(16px 이상)의 자료 카드, 여는 것만으로 확인`, note.size >= 16 && /하루 네 번/.test(note.text) && (await state(p)).evidence.includes('camp-bus'), note);
        await shot(p, 'camp-bus-' + tag);
        ok(`${tag} 사건 4 오류 없음`, errs.length === 0, errs);
        await ctx.close();
      }
      // ---- 사건 3: 점원의 말 문장별 안내 ----
      {
        const { ctx, p, errs } = await open(vp, ['face', 'hook']);
        await click(p, '.step-nav [data-act="next"]'); await click(p, '[data-act="item"][data-id="face-clerk"]');
        await click(p, '[data-act="segment"][data-id="rule"]'); const a = await hint(p), ev1 = (await state(p)).evidence.includes('face-clerk');
        await shot(p, 'face-clerk-rule-' + tag);
        await click(p, '[data-act="segment"][data-id="system"]'); const b = await hint(p);
        await click(p, '[data-act="segment"][data-id="person"]'); const c = await hint(p), ev2 = (await state(p)).evidence.includes('face-clerk');
        ok(`${tag} 점원의 말: 문장마다 다른 안내, ‘그 손님이래요’로만 확인`, /가게 규칙/.test(a) && !ev1 && /알림을 띄운 건 맞아/.test(b) && /‘그 손님’이라고 정한 건 점원/.test(c) && ev2 && new Set([a, b, c]).size === 3, { a, b, c, ev1, ev2 });
        ok(`${tag} 점원의 말: 찾은 문장 하나만 표시`, (await p.locator('.visual .segments mark').count()) === 1);
        await shot(p, 'face-clerk-person-' + tag);
        ok(`${tag} 사건 3 오류 없음`, errs.length === 0, errs);
        await ctx.close();
      }
      // ---- 사건 5: 답이 아닌 곳 ----
      {
        const { ctx, p, errs } = await open(vp, ['share', 'hook']);
        await click(p, '.step-nav [data-act="next"]'); await click(p, '[data-act="item"][data-id="share-log"]');
        await click(p, '[data-act="part"][data-id="time"]'); const a = await hint(p), tag1 = await p.locator('.tried-tag').count();
        const vis = await p.locator('.tap-hint').evaluate(e => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, size: parseFloat(getComputedStyle(e).fontSize) }; });
        await shot(p, 'share-wrong-' + tag);
        await click(p, '[data-act="part"][data-id="pic"]'); const b = await hint(p);
        ok(`${tag} 사건 5: 답이 아닌 곳을 누르면 짧은 안내 + ‘아님’`, a === '이건 루루가 직접 한 부분이야.' && tag1 === 1 && b === '' && vis.size >= 15, { a, b, tag1, vis });
        ok(`${tag} 사건 5: 모아 해설 없음`, (await p.locator('.body .finding').count()) === 0 && (await p.locator('.body .who').count()) === 0);
        ok(`${tag} 사건 5 오류 없음`, errs.length === 0, errs);
        await ctx.close();
      }
      // ---- 보고서·수첩: 바뀐 판단 문장 ----
      {
        const { ctx, p, errs } = await open(vp, ['report']);
        const camp = await p.locator('#report-camp').innerText(), share = await p.locator('#report-share').innerText(), face = await p.locator('#report-face').innerText();
        ok(`${tag} 보고서: 사건 4 판단 3 새 문장 + 정답`, /3\. “참여 횟수 기준은 버스가 적은 솔숲마을에 불리하게 작용했을 수 있어\.”\s*내 판단: 자료로 확인돼 · 정답/.test(camp), camp.slice(0, 600));
        ok(`${tag} 보고서: 사건 5 후속 조사 새 문장 + 정답, 옛 문장 없음`, /“게시물과 게시판을 본 사람은 DM을 보지 못했어\.”\s*내 판단: 자료로 확인돼 · 정답/.test(share) && !/따로 안 알려도 돼/.test(share) && !/참여 횟수가 가장 크게 들어가\.”/.test(camp));
        ok(`${tag} 보고서: 확인한 자료에 버스 쪽지, 조치는 새 선택지 글`, /버스 쪽지/.test(camp) && /기준 공개와 재검토 요청하기/.test(camp) && /게시물 끝에 ‘#AI그림’/.test(share), camp.slice(0, 300));
        await p.locator('header [data-act="notebook"]').click();
        const nb = await p.locator('#modal-body').innerText();
        ok(`${tag} 수첩: 새 판단 문장과 버스 쪽지 사실 문장`, /참여 횟수 기준은 버스가 적은 솔숲마을에/.test(nb) && /버스는 하루 네 번이고/.test(nb) && /DM을 보지 못했어/.test(nb));
        if (tag === '1280') await shot(p, 'notebook-' + tag);
        ok(`${tag} 보고서 오류 없음`, errs.length === 0, errs); void face;
        await ctx.close();
      }
      // ---- version 6 저장으로 이어하기 ----
      {
        const { ctx, p, errs } = await open(vp, ['report', null, true]);
        const s = await state(p), raw = JSON.parse(await p.evaluate(k => localStorage.getItem(k), KEY));
        ok(`${tag} 옛 저장(version 6, 다 마침): 보고서부터 이어짐, 서술·이름 그대로`, s.version === 7 && s.completed && s.scene === 37 && s.reflections.camp.q1 === '기준표를 보고' && s.reporter.name === '하늘' && (await p.locator('[data-reporter="name"]').inputValue()) === '하늘', { scene: s.scene, v: s.version, stored: raw.version });
        ok(`${tag} 옛 저장: 문장이 바뀐 두 판단만 ‘아직 안 함’, 나머지 판단 그대로`, s.judgments.camp.join() === 'unknown,different,legacy' && s.follows.share.judgment === 'legacy' && s.judgments.share.join() === 'different,confirmed,unknown' && s.evidence.includes('camp-bus'), { camp: s.judgments.camp, share: s.follows.share });
        const camp = await p.locator('#report-camp').innerText();
        ok(`${tag} 옛 저장: 보고서에 새 문장 + ‘이전 저장에서 넘어와 아직 안 함’`, /3\. “참여 횟수 기준은[^”]*”\s*이전 저장에서 넘어와 아직 안 함/.test(camp), camp.slice(0, 700));
        await p.locator('header [data-act="notebook"]').click();
        await p.locator('#note-camp [data-act="revisit"]', { hasText: '남은 판단 해 보기' }).click();
        const head = await p.locator('.judge-head').innerText();
        await click(p, '[data-act="judge"][data-id="confirmed"]');
        const s2 = await state(p);
        ok(`${tag} 옛 저장: 수첩 → 남은 판단 해 보기 → 3/3 새 문장 판단`, /3\/3/.test(head) && s2.judgments.camp.join() === 'unknown,different,confirmed', { head, j: s2.judgments.camp });
        await p.reload(); const s3 = await state(p);
        ok(`${tag} 옛 저장: 새로 고쳐도 그대로(version 7로 저장)`, s3.version === 7 && s3.judgments.camp[2] === 'confirmed' && s3.follows.share.judgment === 'legacy');
        ok(`${tag} 옛 저장 오류 없음`, errs.length === 0, errs);
        await ctx.close();
      }
    }
    // 사건 4 도중의 version 6 저장(판단 1개만 함)
    {
      const { ctx, p, errs } = await open({ width: 1280, height: 800 }, ['camp', 'check']);
      await p.evaluate(k => { const s = JSON.parse(localStorage.getItem(k)); s.version = 6; s.evidence.push('camp-page', 'camp-results', 'camp-criteria'); s.judgments.camp = ['unknown', null, null]; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
      await p.reload(); const s = await state(p);
      ok('옛 저장(version 6, 사건 4 판단 도중): 같은 화면에서 2/3부터', s.version === 7 && s.judgments.camp.join() === 'unknown,,' && /2\/3/.test(await p.locator('.judge-head').innerText()) && s.evidence.includes('camp-bus'), { j: s.judgments.camp, ev: s.evidence.slice(-4) });
      ok('옛 저장 도중 오류 없음', errs.length === 0, errs);
      await ctx.close();
    }
  } catch (e) { out.push('FAIL 검사 예외 :: ' + e.message.split('\n').slice(0, 3).join(' / ')); }
  finally { await browser.close(); server.close(); }
  console.log(out.join('\n')); const fails = out.filter(x => x.startsWith('FAIL')).length;
  console.log(fails ? 'FAIL ' + fails : 'PASS ' + out.filter(x => x.startsWith('PASS')).length);
  process.exit(fails ? 1 : 0);
})();
