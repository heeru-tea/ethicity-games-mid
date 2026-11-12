// 게임 안 움직임과 2026-11-12 다듬기 확인(진짜 Edge): 장면이 바뀔 때만 .arrive, 판단한 직후에만 .fresh(다시 그리면 없음), 결과 화면의 그림 위 표시,
// 움직임 줄이기에서는 연출 없음, 판단해도 scrollY 그대로 / 도장 셋 한 줄(1366·390, 낱말 안에서 안 끊김), 마지막 화면 메뉴 줄, 시작 화면 한 장면의 이름표.
// 다른 브라우저 검사(flow·playtest-1106·review-1110)는 움직임 줄이기로 돌린다(캡처가 연출 도중에 찍히지 않게) — 움직임은 이 파일이 본다.
// 쓰기: node tests/motion-browser.cjs  (캡처 tests/screens/motion-*.png)
'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..'), outDir = path.join(__dirname, 'screens');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json; charset=utf-8' };
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (file === path.resolve(root)) file = path.join(root, 'index.html');
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream'); res.end(data); });
});
const out = [];
const ok = (name, cond, extra) => out.push((cond ? 'PASS ' : 'FAIL ') + name + (cond || extra === undefined ? '' : ' :: ' + JSON.stringify(extra)));

// 페이지 안에서 engine으로 원하는 곳까지 진행한 저장을 만든다
const BUILD = `(where) => {
  const E = window.TransparencyEngine;
  const stop = { photoCheck: s => E.stepOf(s.scene) === 'check' && E.caseKey(s.scene) === 'photo' && E.checked(s, 'photo'),
                 campChoose: s => E.stepOf(s.scene) === 'choose' && E.caseKey(s.scene) === 'camp',
                 end: s => s.scene === E.END }[where];
  let s = E.initial();
  for (let g = 0; g < 3000; g++) {
    if (stop(s)) { localStorage.setItem('ethicity.transparency.progress.v1', JSON.stringify(s)); return s.scene; }
    const k = E.caseKey(s.scene), step = E.stepOf(s.scene), before = JSON.stringify(s);
    if (step === 'hook' && k === 'camp' && !s.asked.length) s = E.reduce(s, { type: 'ask', id: E.questions[0] });
    else if (step === 'check' && !E.checked(s, k)) { for (const id of E.checks[k]) s = E.reduce(s, { type: 'check', id }); }
    else if (step === 'check' && !E.judged(s, k)) s = E.reduce(s, { type: 'judge', stamp: E.answers[k][E.currentJudgment(s, k)] });
    else if (step === 'choose') s = E.reduce(s, { type: 'choose', id: E.choices[k][1] });
    else if (step === 'follow' && !E.followReady(s, k)) { const m = E.followMarks[k]; for (const id of m.ids) s = E.reduce(s, { type: 'mark', id, value: m.values[0] }); }
    else if (step === 'follow' && !E.followDone(s, k)) s = E.reduce(s, { type: 'follow-judge', stamp: E.followAnswers[k] });
    else if (step === 'notice' && !E.noticeDone(s, k)) { s = E.reduce(s, { type: 'notice-pick', id: E.noticeIds(k)[0] }); s = E.reduce(s, { type: 'notice-post' }); }
    else s = E.reduce(s, { type: 'next' });
    if (JSON.stringify(s) === before) throw new Error('stuck at scene ' + s.scene + ' ' + step);
  }
  throw new Error('not reached');
}`;
// 도장 글이 몇 줄인지, 낱말 안에서 끊겼는지
const STAMPS = `() => [...document.querySelectorAll('.judge-card .stamps button')].map(b => {
  const t = [...b.childNodes].find(n => n.nodeType === 3); const r = document.createRange(); r.selectNodeContents(t);
  const tops = [...new Set([...r.getClientRects()].map(x => Math.round(x.top)))];
  return { text: t.textContent.trim(), lines: tops.length, w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) };
})`;
const anim = sel => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); return el ? getComputedStyle(el).animationName : 'MISSING'; })()`;

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const open = async (viewport, where, opts = {}) => {
      const ctx = await browser.newContext({ viewport, ...opts }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.goto(url); if (where) { await p.evaluate(`(${BUILD})(${JSON.stringify(where)})`); await p.reload(); }
      return { ctx, p, errs };
    };
    // ---- 1366×768, 움직임 보통 ----
    {
      const { ctx, p, errs } = await open({ width: 1366, height: 768 }, 'photoCheck');
      ok('시작 화면에는 .arrive 없음', await p.evaluate(`!document.querySelector('.screen.arrive')`));
      await p.locator('#app [data-act="start"]').click();
      ok('이어하기 → 장면 그리기에 .arrive, 연출 scene-in', await p.evaluate(anim('.screen.arrive > .head')) === 'scene-in', await p.evaluate(anim('.screen.arrive > .head')));
      const st = await p.evaluate(`(${STAMPS})()`);
      ok('1366: 도장 셋이 모두 한 줄', st.length === 3 && st.every(x => x.lines === 1), st);
      ok('1366: 도장 셋이 한 줄에 나란히(높이 같음)', new Set(st.map(x => x.h)).size === 1, st);
      await p.locator('.judge-src [data-act="source"]').first().click();
      ok('자료를 바꿔 다시 그리면 .arrive 없음(되풀이 안 함)', await p.evaluate(`!!document.querySelector('.screen') && !document.querySelector('.screen.arrive')`));
      const y0 = await p.evaluate('scrollY');
      const answer = await p.evaluate(`window.TransparencyEngine.answers.photo[0]`);
      await p.locator(`.stamps [data-act="judge"][data-id="${answer}"]`).click();
      ok('판단 직후 .fresh, 정답 도장 stamp-pop', await p.evaluate(anim('.judge-card.fresh .stamp-right')) === 'stamp-pop', await p.evaluate(anim('.judge-card.fresh .stamp-right')));
      ok('판단 직후 피드백 상자 scene-in', await p.evaluate(anim('.judge-card.fresh .finding')) === 'scene-in');
      ok('판단해도 화면이 움직이지 않음(scrollY 그대로)', await p.evaluate('scrollY') === y0, [y0, await p.evaluate('scrollY')]);
      await p.locator('.judge-src [data-act="source"]').first().click();
      ok('다시 그리면 .fresh 없음(피드백은 그대로 보임)', await p.evaluate(`!document.querySelector('.judge-card.fresh') && !!document.querySelector('.judge-card .finding')`));
      await p.waitForTimeout(600);
      await p.screenshot({ path: path.join(outDir, 'motion-judged-1366.png') });
      ok('JS 오류 없음(1366 판단)', errs.length === 0, errs);
      await ctx.close();
    }
    // ---- 결과 화면 ----
    {
      const { ctx, p, errs } = await open({ width: 1366, height: 768 }, 'campChoose');
      await p.locator('#app [data-act="start"]').click();
      await p.locator('.options [data-act="choose"]').nth(1).click();
      ok('결과 화면: 그림 위 결과 카드 mark-in', await p.evaluate(anim('.step-result .screen.arrive .stage-screen')) === 'mark-in', await p.evaluate(anim('.step-result .screen.arrive .stage-screen')));
      await p.locator('[data-act="rechoose"]').click();
      ok('선택 화면으로 돌아가면 결과 카드 연출 없음', await p.evaluate(anim('.stage-screen')) === 'none', await p.evaluate(anim('.stage-screen')));
      ok('JS 오류 없음(결과)', errs.length === 0, errs);
      await ctx.close();
    }
    // ---- 마지막 화면 ----
    {
      const { ctx, p, errs } = await open({ width: 1366, height: 768 }, 'end');
      await p.locator('#app [data-act="start"]').click();
      const m = await p.evaluate(`(() => { const menu = document.querySelector('.step-end .menu').getBoundingClientRect(); const bs = [...document.querySelectorAll('.step-end .menu button')].map(b => { const r = b.getBoundingClientRect(); return { act: b.dataset.act, top: Math.round(r.top), right: Math.round(r.right), h: Math.round(r.height) }; }); return { right: Math.round(menu.right), bs, overflow: document.documentElement.scrollWidth > innerWidth }; })()`);
      const reset = m.bs.find(b => b.act === 'reset-ask'), others = m.bs.filter(b => b.act !== 'reset-ask');
      ok('마지막: 더 볼 것 셋이 한 줄', new Set(others.map(b => b.top)).size === 1, m);
      ok('마지막: 처음부터 다시 하기는 오른쪽 끝', Math.abs(reset.right - m.right) <= 1, m);
      ok('마지막: 메뉴 버튼 높이 44px 이상', m.bs.every(b => b.h >= 44), m);
      await p.waitForTimeout(500);
      await p.locator('.step-end .menu').scrollIntoViewIfNeeded();
      await p.screenshot({ path: path.join(outDir, 'motion-end-1366.png') });
      ok('JS 오류 없음(마지막)', errs.length === 0, errs);
      await ctx.close();
    }
    // ---- 390×844 ----
    {
      const { ctx, p, errs } = await open({ width: 390, height: 844 }, 'photoCheck');
      await p.locator('#app [data-act="start"]').click();
      const st = await p.evaluate(`(${STAMPS})()`);
      ok('390: 도장 글이 모두 한 줄(낱말 안에서 안 끊김)', st.length === 3 && st.every(x => x.lines === 1), st);
      ok('390: 가로 넘침 없음', await p.evaluate('document.documentElement.scrollWidth <= innerWidth'));
      const answer = await p.evaluate(`window.TransparencyEngine.answers.photo[0]`);
      await p.locator(`.stamps [data-act="judge"][data-id="${answer}"]`).click();
      await p.waitForTimeout(600);
      await p.locator('.judge-card .stamps').scrollIntoViewIfNeeded();
      await p.screenshot({ path: path.join(outDir, 'motion-judged-390.png') });
      ok('390: 도장 누르는 곳 44px 이상', st.every(x => x.h >= 44), st);
      ok('JS 오류 없음(390)', errs.length === 0, errs);
      await ctx.close();
    }
    // ---- 움직임 줄이기 ----
    {
      const { ctx, p } = await open({ width: 1366, height: 768 }, 'photoCheck', { reducedMotion: 'reduce' });
      await p.locator('#app [data-act="start"]').click();
      ok('움직임 줄이기: 장면 연출 없음', await p.evaluate(anim('.screen.arrive > .head')) === 'none', await p.evaluate(anim('.screen.arrive > .head')));
      await ctx.close();
    }
    // ---- 시작 화면 ----
    {
      const { ctx, p } = await open({ width: 1280, height: 800 }, null, { reducedMotion: 'reduce' });
      const s = await p.evaluate(`(() => { const x = document.querySelector('.peek-stamps span'); const c = getComputedStyle(x); const all = [...document.querySelectorAll('.peek-stamps span')]; const r = all.map(e => e.getBoundingClientRect()); return { border: c.borderTopWidth, radius: c.borderTopLeftRadius, bg: c.backgroundColor, pad: c.paddingLeft, n: all.length, sep: all.slice(1).map(e => getComputedStyle(e, '::before').content), gaps: r.slice(1).map((x, i) => Math.round(x.left - r[i].right)), sameRow: r.every(x => Math.abs(x.top - r[0].top) < 2), focusable: all.some(e => e.tabIndex >= 0), role: document.querySelector('.peek-card').getAttribute('role') }; })()`);
      ok('시작 화면: 한 장면의 세 갈래에 테두리 없음', s.border === '0px', s);
      // 2026-11-12: 글자만(바탕·안쪽 여백 없음), 가운뎃점으로 셋을 나눈다. 누를 수 없는 그림 구실은 그대로.
      ok('시작 화면: 세 갈래는 글자만(바탕 없음)·가운뎃점으로 나뉨·초점 안 받음', s.bg === 'rgba(0, 0, 0, 0)' && s.pad === '0px' && s.n === 3 && s.sep.every(x => x.includes('·')) && !s.focusable && s.role === 'img', s);
      await p.screenshot({ path: path.join(outDir, 'motion-title-1280.png') });
      await ctx.close();
    }
  } catch (e) { out.push('FAIL 검사 예외 :: ' + e.message.split('\n')[0]); }
  finally { await browser.close(); server.close(); }
  console.log(out.join('\n')); const fails = out.filter(x => x.startsWith('FAIL')).length;
  console.log(fails ? 'FAIL ' + fails : 'PASS ' + out.length);
  process.exitCode = fails ? 1 : 0;
})();
