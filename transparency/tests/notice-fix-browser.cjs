// 2026-11-12 수정 요청 10·후속 6: 사건 4·5 미리 알리기 ‘고치기’를 진짜 Edge로 본다(1280×800·390×844, 움직임 줄이기).
//  ① 사건 4 마우스: 칸 넷(초안 한 줄·선택지), 모든 칸을 골라야 붙이기, 틀리게 붙이면 다시 볼 칸, 고쳐 다시 붙이기, 새로고침 유지, 생각 정리로
//  ② 사건 5 키보드: Tab·Space·Enter만으로 칸 고르기·붙이기, 초점 유지, 접근성 트리(칸 묶음 이름·눌림), ‘#AI그림’만으로는 실제 하늘 칸이 남음
//  ③ 글자 16px·누르는 곳 44px·가로 넘침 없음·붙이기 전 높이(잰 값)
//  ④ version 6 저장: 카드로 붙인 안내문은 ‘이전 방식으로 작성한 안내문’, 미리 알리기에 선 저장은 고치기로 시작해 보고서까지
// 쓰기: node tests/notice-fix-browser.cjs  (캡처 tests/screens/noticefix-*.png) — 브라우저 검사는 한 번에 하나(D:\Works\.browser-test.lock).
'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..'), outDir = path.join(__dirname, 'screens');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const throughTitle = require('./through-title.cjs');
const E = require('../engine.js');
const D = (() => { global.window = {}; require('../story.js'); return global.window.TransparencyStory; })();
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (file === path.resolve(root)) file = path.join(root, 'index.html');
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream'); res.end(data); });
});
const out = [], nums = [];
const ok = (name, cond, extra) => out.push((cond ? 'PASS ' : 'FAIL ') + name + (cond || extra === undefined ? '' : ' :: ' + JSON.stringify(extra)));
const KEY = 'ethicity.transparency.progress.v1';
const NF = D.notice.fix;
// 정답대로 걸어가 그 사건·단계에 선 저장(key = 'report'면 보고서까지). v6 = 이 기능 전 저장 모양(사건 4·5 안내문은 카드로 꼭 필요 카드만, 미리 알리기에 서 있으면 빈 칸).
function build(key, step, v6) {
  let s = E.initial(); const goal = key === 'report' ? E.REPORT : E.sceneOf(key, step);
  while (s.scene < goal) { const k = E.caseKey(s.scene), st = E.stepOf(s.scene);
    if (st === 'hook' && k === 'camp') s = E.reduce(s, { type: 'ask', id: 'who' });
    if (st === 'check') { for (const id of E.checks[k]) s = E.reduce(s, { type: 'check', id }); for (const a of E.answers[k]) s = E.reduce(s, { type: 'judge', stamp: a }); }
    if (st === 'choose') { s = E.reduce(s, { type: 'choose', id: E.choices[k][1] }); continue; }
    if (st === 'follow') { const m = E.followMarks[k]; m.ids.forEach((id, i) => { s = E.reduce(s, { type: 'mark', id, value: k === 'photo' ? E.truth[i] : m.values[0] }); }); s = E.reduce(s, { type: 'follow-judge', stamp: E.followAnswers[k] }); }
    if (st === 'notice') { if (E.noticeFix(s, k)) for (const x of E.noticeSlots[k]) s = E.reduce(s, { type: 'notice-slot', slot: x.id, opt: x.ok[0] }); else for (const id of E.noticeCards[k].must) s = E.reduce(s, { type: 'notice-pick', id }); s = E.reduce(s, { type: 'notice-post' }); }
    s = E.reduce(s, { type: 'next' }); }
  s = JSON.parse(JSON.stringify(s));
  if (v6) { s.version = 6; s.evidence = s.evidence.filter(id => id !== 'camp-bus'); if (s.follows.share.judgment) s.follows.share.judgment = 'different';
    if (s.follows.camp.marks.office) s.follows.camp.marks = { changed: 'found' };
    if (Array.isArray(s.judgments.camp) && E.stamps.includes(s.judgments.camp[2])) s.judgments.camp[2] = 'confirmed';
    for (const k of ['camp', 'share']) { const n = s.notices[k]; if (n.mode === 'fix') { const done = !!n.posted; s.notices[k] = { picked: done ? E.noticeCards[k].must.slice() : [], posted: done ? E.noticeCards[k].must.slice() : null }; } } }
  return s;
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ channel: 'msedge' });
  const open = async (viewport, save) => {
    const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' }), p = throughTitle(await ctx.newPage()), errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errs.push(r.status() + ' ' + r.url().replace(url, '')); });
    await p.goto(url);
    if (save) { await p.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(save)]); await p.reload(); }
    return { ctx, p, errs };
  };
  const click = (p, sel) => p.locator(sel).first().click();
  const state = p => p.evaluate(() => window.TransparencyGame.getState());
  const opt = (p, slot, value) => p.locator(`[data-act="notice-slot"][data-id="${slot}"][data-value="${value}"]`);
  const choose = (p, slot, value) => opt(p, slot, value).click();
  const tag = async (p, id) => (await p.locator('#fb-slot-' + id + ' .fb-tag').innerText()).replace(/\s+/g, ' ');
  const shot = (p, name, full) => p.screenshot({ path: path.join(outDir, 'noticefix-' + name + '.png'), fullPage: !!full });
  const layout = p => p.evaluate(() => {
    const vis = e => e.offsetParent && e.textContent.trim();
    return { font: Math.min(...[...document.querySelectorAll('.body p,.body button,.body button span')].filter(vis).map(e => parseFloat(getComputedStyle(e).fontSize))),
      tap: Math.min(...[...document.querySelectorAll('.body button')].filter(vis).map(b => b.getBoundingClientRect().height)),
      over: document.documentElement.scrollWidth > innerWidth, page: document.documentElement.scrollHeight,
      slotBorder: [...document.querySelectorAll('.fix-slot')].map(e => { const c = getComputedStyle(e); return c.borderLeftWidth + '/' + c.borderTopWidth + ' r' + c.borderTopLeftRadius; }).filter((v, i, a) => a.indexOf(v) === i),
      paper: (() => { const x = document.querySelector('.notice-paper'); return x ? { shown: !!x.offsetParent, cls: x.className } : null; })() };
  });
  try {
    for (const [tag_, vp] of [['1280', { width: 1280, height: 800 }], ['390', { width: 390, height: 844 }]]) {
      const phone = vp.width < 500;
      // ---- ① 사건 4, 마우스 ----
      {
        const { ctx, p, errs } = await open(vp, build('camp', 'notice'));
        const X = D.cases.camp.notice.fix;
        ok(tag_ + ' camp: title / task', (await p.locator('h1').innerText()) === X.title && (await p.locator('.body .task').innerText()) === NF.task);
        ok(tag_ + ' camp: four slots with their draft line', (await p.locator('.fix-slot').count()) === 4 && (await p.locator('.fix-slot').nth(3).locator('.slot-draft').innerText()) === '초안: “AI가 뽑으니 절대 차별이 없어요.”');
        ok(tag_ + ' camp: post locked until every slot is chosen', await p.locator('[data-act="notice-post"]').isDisabled() && /남은 칸 4개/.test(await p.locator('.notice-post-row .hint').innerText()));
        const L = await layout(p); nums.push(tag_ + ' camp before posting: ' + JSON.stringify(L));
        ok(tag_ + ' camp: text 16px+ / tap 44px+ / no sideways scroll', L.font >= 16 && L.tap >= 44 && !L.over, L);
        ok(tag_ + ' camp: slot boxes have a thin full border (no left bar), nested radius 14', L.slotBorder.length === 1 && L.slotBorder[0] === '1px/1px r14px', L.slotBorder);
        ok(tag_ + ' camp: paper ' + (phone ? 'hidden on phone before posting' : 'shows the first draft'), phone ? !L.paper.shown : (L.paper.shown && (await p.locator('.notice-paper').innerText()).includes(NF.draftLabel + ' · ' + X.paper)), L.paper);
        await p.evaluate(() => scrollTo(0, 0)); await shot(p, 'camp-start-' + tag_, phone);
        for (const [s, o] of [['role', 'camp-auto'], ['office', 'blank'], ['appeal', 'camp-everyone']]) await choose(p, s, o);
        ok(tag_ + ' camp: three of four → still locked', await p.locator('[data-act="notice-post"]').isDisabled());
        await choose(p, 'claim', 'keep'); await click(p, '[data-act="notice-post"]');
        const v1 = await p.locator('.notice-verdict').innerText();
        ok(tag_ + ' camp: verdict names the slots to look at again', v1.includes('다시 볼 칸: AI가 하는 일, 담당 부서, 재검토 방법, 마지막 문장.') && v1.includes(NF.againMore), v1);
        ok(tag_ + ' camp: slot tags', (await tag(p, 'role')) === '! AI가 하는 일 · 다시 보기' && (await tag(p, 'appeal')) === '! 재검토 방법 · 다시 보기', [await tag(p, 'role'), await tag(p, 'appeal')]);
        ok(tag_ + ' camp: can move on after one post', !(await p.locator('.step-nav [data-act="next"]').isDisabled()));
        await shot(p, 'camp-wrong-' + tag_, true);
        for (const [s, o] of [['role', 'camp-role'], ['office', 'camp-office'], ['appeal', 'camp-appeal'], ['claim', 'drop']]) await choose(p, s, o);
        ok(tag_ + ' camp: changed → repost hint, feedback hidden', (await p.locator('.card-fb').count()) === 0 && (await p.locator('.body .repost').count()) === 1);
        await click(p, '[data-act="notice-post"]');
        ok(tag_ + ' camp: all fixed', /다 맞았어/.test(await p.locator('.notice-verdict').innerText()) && (await tag(p, 'claim')) === '✓ 마지막 문장');
        const L2 = await layout(p); nums.push(tag_ + ' camp after posting: page ' + L2.page + 'px, over ' + L2.over);
        ok(tag_ + ' camp: no sideways scroll after feedback', !L2.over);
        await p.evaluate(() => scrollTo(0, 0)); await shot(p, 'camp-done-' + tag_, phone);
        await p.reload();
        ok(tag_ + ' camp: reload keeps the choices and the posted notice', (await opt(p, 'claim', 'drop').getAttribute('aria-checked')) === 'true' && (await p.locator('.card-fb').count()) === 4 && (await state(p)).notices.camp.posted.claim === 'drop');
        await click(p, '.step-nav [data-act="next"]'); ok(tag_ + ' camp: moves on to 생각 정리', E.stepOf((await state(p)).scene) === 'reflect');
        ok(tag_ + ' camp: no page errors', errs.length === 0, errs); await ctx.close();
      }
      // ---- ② 사건 5, 키보드만 ----
      {
        const { ctx, p, errs } = await open(vp, build('share', 'notice'));
        const X = D.cases.share.notice.fix;
        ok(tag_ + ' share: title', (await p.locator('h1').innerText()) === X.title);
        const snap = await p.locator('.fix-slots').ariaSnapshot();
        ok(tag_ + ' share: a11y tree — slot groups named with the draft, option radios(2026-11-12 라디오로)', /radiogroup "칸 2\. 실제 하늘, 초안: “토요일에 이 그림처럼 보일 거예요\.”"/.test(snap) && snap.includes('radio "#AI그림"') && snap.includes('radio "덧붙이지 않기"') && !/button "(#AI그림|덧붙이지 않기)"/.test(snap), snap);
        await p.locator('h1').focus(); let n = 0; while (n++ < 40 && (await p.evaluate(() => document.activeElement.dataset.act)) !== 'notice-slot') await p.keyboard.press('Tab');
        ok(tag_ + ' share: Tab reaches the first option', (await p.evaluate(() => document.activeElement.dataset.value)) === 'blank', n);
        await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
        ok(tag_ + ' share: Tab order inside the slot', (await p.evaluate(() => document.activeElement.dataset.value)) === 'share-tag');
        await p.keyboard.press('Space');
        ok(tag_ + ' share: Space chooses, focus stays', (await opt(p, 'ai', 'share-tag').getAttribute('aria-checked')) === 'true' && (await p.evaluate(() => document.activeElement.dataset.value)) === 'share-tag');
        await opt(p, 'sky', 'keep').focus(); await p.keyboard.press('Enter'); await opt(p, 'more', 'blank').focus(); await p.keyboard.press('Enter');
        await p.locator('[data-act="notice-post"]').focus(); await p.keyboard.press('Enter');
        const v = await p.locator('.notice-verdict').innerText();
        ok(tag_ + ' share: ‘#AI그림’ with the old sky line → look again at 실제 하늘 (one line, alone)', v.trim() === '고칠 점이 있어 · 다시 볼 칸: 실제 하늘.' && (await p.locator('#fb-slot-ai').innerText()).trim() === '✓ AI로 만든 부분' && (await p.locator('.line.moa').count()) === 0, v);
        ok(tag_ + ' share: focus stays on the post button', (await p.evaluate(() => document.activeElement.dataset.act)) === 'notice-post');
        await opt(p, 'sky', 'share-real').focus(); await p.keyboard.press('Enter');
        await p.locator('[data-act="notice-post"]').focus(); await p.keyboard.press('Enter');
        ok(tag_ + ' share: fixed with the keyboard', (await p.locator('.notice-verdict').innerText()).trim() === '다 맞았어.');
        ok(tag_ + ' share: option described by its slot feedback', (await opt(p, 'sky', 'share-real').getAttribute('aria-describedby')) === 'fb-slot-sky');
        await shot(p, 'share-done-' + tag_, true);
        ok(tag_ + ' share: no page errors', errs.length === 0, errs); await ctx.close();
      }
    }
    // ---- ④ version 6 저장 ----
    {
      const fin = build('report', null, true);
      const { ctx, p, errs } = await open({ width: 1280, height: 800 }, fin);
      const s = await state(p);
      ok('v6 finished: notices as posted (card-style kept)', JSON.stringify(s.notices.camp) === JSON.stringify(fin.notices.camp) && JSON.stringify(s.notices.share) === JSON.stringify(fin.notices.share));
      const camp = await p.locator('.report .case-card').nth(3).innerText();
      ok('v6 finished: report shows ‘이전 방식으로 작성한 안내문’ for cases 4·5 only', camp.includes(NF.old) && (await p.locator('.report .case-card').nth(4).innerText()).includes(NF.old) && !(await p.locator('.report .case-card').nth(0).innerText()).includes(NF.old));
      ok('v6 finished: no page errors', errs.length === 0, errs); await ctx.close();
    }
    {
      const at = build('camp', 'notice', true);
      const { ctx, p, errs } = await open({ width: 390, height: 844 }, at);
      ok('v6 at case 4 notice: resume notice + fix screen', (await p.locator('.resume').count()) === 1 && (await p.locator('.fix-slot').count()) === 4 && (await state(p)).notices.camp.mode === 'fix');
      for (const x of E.noticeSlots.camp) await choose(p, x.id, x.options[0]);
      await click(p, '[data-act="notice-post"]'); await click(p, '.step-nav [data-act="next"]');
      ok('v6: continues past the notice step', E.stepOf((await state(p)).scene) === 'reflect');
      let e = JSON.parse(JSON.stringify(await state(p))); e = E.reduce(e, { type: 'next' });
      while (E.stepOf(e.scene) !== 'notice') { const st = E.stepOf(e.scene);
        if (st === 'check') { for (const id of E.checks.share) e = E.reduce(e, { type: 'check', id }); for (const a of E.answers.share) e = E.reduce(e, { type: 'judge', stamp: a }); }
        if (st === 'choose') { e = E.reduce(e, { type: 'choose', id: 'tag' }); continue; }
        if (st === 'follow') { for (const id of E.followMarks.share.ids) e = E.reduce(e, { type: 'mark', id, value: 'open' }); e = E.reduce(e, { type: 'follow-judge', stamp: 'confirmed' }); }
        e = E.reduce(e, { type: 'next' }); }
      await p.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(e)]); await p.reload();
      ok('v6 → case 5 notice also opens the fix step', (await p.locator('.fix-slot').count()) === 3);
      for (const [s, o] of [['ai', 'share-tag'], ['sky', 'keep'], ['more', 'blank']]) await choose(p, s, o);
      await click(p, '[data-act="notice-post"]');
      await click(p, '.step-nav [data-act="next"]'); await click(p, '.step-nav [data-act="next"]'); await click(p, '.step-nav [data-act="next"]');
      ok('v6 → report reached', E.stepOf((await state(p)).scene) === 'report');
      const camp = await p.locator('.report .case-card').nth(3).innerText(), share = await p.locator('.report .case-card').nth(4).innerText();
      ok('report camp: made notice, slots to look at again, verdict', camp.includes(NF.made) && camp.includes('다시 볼 칸: AI가 하는 일, 담당 부서, 재검토 방법, 마지막 문장') && camp.includes('AI가 뽑으니 절대 차별이 없어요.') && /판정: 고칠 점 있음/.test(camp), camp);
      ok('report share: #AI그림 kept, sky to look at again', share.includes('#AI그림') && share.includes('다시 볼 칸: 실제 하늘') && share.includes('토요일에 이 그림처럼 보일 거예요.'), share);
      await p.locator('.report .case-card').nth(3).screenshot({ path: path.join(outDir, 'noticefix-report-camp-390.png') });
      await p.emulateMedia({ media: 'print' });
      ok('print: the label is inline (same line as the notice list)', await p.evaluate(() => getComputedStyle(document.querySelector('.n-kind')).display === 'inline'));
      ok('v6 path: no page errors', errs.length === 0, errs); await ctx.close();
    }
  } catch (e) { out.push('FAIL exception :: ' + (e && e.stack || e)); }
  finally { await browser.close(); server.close(); }
  console.log(out.join('\n')); console.log(nums.join('\n'));
  const fails = out.filter(x => x.startsWith('FAIL')).length;
  console.log(fails ? `FAIL ${fails}` : `PASS ${out.length}`); process.exitCode = fails ? 1 : 0;
})();
