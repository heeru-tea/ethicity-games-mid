// AI 프라이버시 반영(2026-11-10) 브라우저 검사: node privacy/tests/ai-privacy-browser.mjs
//   ONLY=a,b,c(기본 전부) · SIZE=d,m(기본 둘 다: 1280×800 · 390×844) · PLAYWRIGHT_MODULE(또는 PLAYWRIGHT_PATH)
//   a = 특별 수업 감지 화면 네 장(빨간 사각형·꼬리표·알림 카드, 그림 내리기, '한 번에', 되돌리기, 그림 없음)
//   b = 사건 4 가짜 춤 영상(휴대폰 틀·장면 넘김·움직임 줄이기·선택 전 내리기·그림 없음)
//   c = 성찰 카드(자동 채움·자동 저장·인쇄 제목·지우기와 확인 창·PDF 한 장)
//   스크린샷 tests/_shot-ai-*.png(gitignore). 브라우저 잠금(D:/Works/.browser-test.lock)은 실행하는 쪽에서 잡는다 — 한 번에 하나.
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
import path from 'node:path'; import os from 'node:os'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SIZES = {
  d: { name: '1280x800', dev: { viewport: { width: 1280, height: 800 } } },
  m: { name: '390x844', dev: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } } };
const ONLY = (process.env.ONLY || 'a,b,c').split(',');
const shot = (n) => path.join(HERE, `_shot-ai-${n}.png`);
const PDF_DIR = process.env.OUT_DIR || os.tmpdir(); // 쪽수 확인용 PDF(저장소 밖)

// 엔진으로 미리 진행한 상태(prefs: 장면별 선택 id, 없으면 첫 선택) — stop(state)이 참이면 그 상태
function runTo(prefs, stop, keepHistory) {
  let s = E.createState(story);
  for (let i = 0; i < 800; i++) {
    if (stop(s)) { if (!keepHistory) s.history = s.history.slice(-1); return s; }
    if (s.screen === 'scene' && E.needsChoice(story, s)) { const cs = E.visibleChoices(story, story.scenes[s.scene], s); s = E.choose(story, s, (cs.find((c) => c.id === prefs[s.scene]) || cs[0]).id); }
    s = E.advance(story, s);
  }
  throw new Error('못 감');
}
const atScene = (id) => (s) => s.screen === 'scene' && s.scene === id && !s.reaction;

const server = await startServer(0), base = `http://127.0.0.1:${server.address().port}/privacy/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let pass = 0; const fails = [], table = [];
const rec = (size, item, c, note = '') => { table.push([size, item, c ? '통과' : '실패', note]); if (c) pass++; else { fails.push(`${size} ${item} ${note}`); console.log(`  ✗ ${size} ${item} ${note}`); } };
const SET_SLOW = { speed: 'normal', reduceMotion: false, look: 'm', sound: false, soundSet: true, helpFold: true, helpPlaces: ['a', 'b', 'c'] };
const SET_FAST = { speed: 'instant', reduceMotion: true, look: 'm', sound: false, soundSet: true, helpFold: true, helpPlaces: ['a', 'b', 'c'] };
// run = 이어 할 진행(없으면 시작 화면), extra = { card, block: 막을 주소 정규식, media: { reducedMotion } }
async function open(dev, run, settings = SET_FAST, extra = {}) {
  const ctx = await browser.newContext(Object.assign({}, dev, extra.media || {})), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (extra.block) await page.route(extra.block, (r) => r.abort());
  await page.addInitScript((p) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.clear();
    localStorage.setItem('ethicity.privacy.settings.v1', JSON.stringify(p.settings));
    if (p.card) localStorage.setItem('ethicity.privacy.card.v1', JSON.stringify(p.card));
    if (p.run) localStorage.setItem('ethicity.privacy.progress.v2', JSON.stringify({ v: 1, run: p.run, explored: {}, endingsSeen: p.run.ending ? [p.run.ending] : [] })); }, { run, settings, card: extra.card || null });
  await page.goto(base); await page.waitForTimeout(500);
  page.errors = errors; page.ctx = ctx;
  if (extra.pre) await page.evaluate(extra.pre); // 이어 하기 전에 페이지 안에서 돌릴 것(검사용 손질)
  if (run && run.screen !== 'ending') { await page.click('#btn-continue'); await page.waitForTimeout(700); }
  return page;
}
const close = (p) => p.ctx.close();
const st = (p) => p.evaluate(() => PrivacyApp.state());
const noErr = (size, item, p) => rec(size, item + ' 페이지 오류 없음', p.errors.length === 0, p.errors.join(' | '));
// 대화창 한 줄 넘기기(치는 중이면 먼저 다 보여 주고, 다음 줄로)
async function nextLine(p) {
  await p.evaluate(() => { if (PrivacyTalk.typing()) PrivacyTalk.next(); });
  await p.waitForTimeout(40);
  await p.evaluate(() => { if (PrivacyTalk.isOpen()) PrivacyTalk.next(); });
  await p.waitForTimeout(120);
}
const talkText = (p) => p.evaluate(() => { const t = document.getElementById('talk'); return t && !t.hidden ? t.querySelector('.talk-text').textContent : ''; });
const pick = (p, id) => p.evaluate((id) => { const b = [...document.querySelectorAll('#g-dock .choice')].find((x) => x.getAttribute('data-choice') === id); if (b) b.click(); return !!b; }, id);
const choices = (p) => p.evaluate(() => document.querySelectorAll('#g-dock .choice').length);
// 대화창이 열려 있으면 넘기고, 아니면 '다음'·'모두 보기' 버튼
async function step(p, ms = 150) {
  await p.evaluate(() => { if (window.PrivacyTalk && PrivacyTalk.isOpen()) { PrivacyTalk.next(); return; } const b = document.querySelector('#g-next .skip-btn, #g-next #btn-next, #g-dock #btn-next'); if (b) b.click(); });
  await p.waitForTimeout(ms);
}
// 그림 칸 상태: 보이는지·어느 그림·표시 사각형들(그림 기준 비율)
const cgState = (p) => p.evaluate(() => {
  const box = document.getElementById('cg'), im = box.querySelector('.cg-img'), R = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
  const op = (e) => parseFloat(getComputedStyle(e).opacity);
  const pic = R(box.querySelector('.cg-pic')), det = box.querySelector('.cg-det'), talk = document.getElementById('talk');
  const o = { hidden: box.hidden, key: box.getAttribute('data-cg'), mode: box.getAttribute('data-mode'), cgOn: document.body.classList.contains('cg-on'), pic,
    loaded: !im.hasAttribute('data-loading') && !im.hasAttribute('data-failed') && im.naturalWidth > 0, alt: im.alt, live: document.getElementById('cg-live').textContent,
    talkTop: talk && !talk.hidden ? talk.getBoundingClientRect().top : null,
    hud: ['.hud-left', '.hud .bar-actions'].map((q) => document.querySelector(q)).filter((e) => e && e.getClientRects().length).map(R) };
  if (det && !det.hidden) {
    const b = det.querySelector('.cg-box'), tag = det.querySelector('.cg-tag'), al = det.querySelector('.cg-alert'), cam = det.querySelector('.cg-cam'), cs = getComputedStyle(b);
    o.det = { on: box.classList.contains('det-on'), box: R(b), boxOp: op(b), color: cs.borderTopColor, bw: parseFloat(cs.borderTopWidth), radius: cs.borderTopLeftRadius,
      tag: R(tag), tagText: tag.textContent, tagFont: parseFloat(getComputedStyle(tag).fontSize), tagBg: getComputedStyle(tag).backgroundColor,
      alert: R(al), alertOp: op(al), alertText: al.textContent, alertBorder: [cs.borderLeftWidth, getComputedStyle(al).borderLeftWidth, getComputedStyle(al).borderTopWidth].join('/'),
      cam: R(cam), camText: cam.textContent, ariaHidden: det.getAttribute('aria-hidden') };
  }
  return o;
});
const inside = (a, b, pad = 1) => a.x >= b.x - pad && a.y >= b.y - pad && a.r <= b.r + pad && a.b <= b.b + pad;
const hit = (a, b) => a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
async function waitFor(p, fn, arg, ms = 6000) { try { await p.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (e) { return false; } }

try {
  for (const key of (process.env.SIZE || 'd,m').split(',')) {
    const { name: size, dev } = SIZES[key];
    console.log('── ' + size);

    /* ───────── a. 특별 수업: 교실 AI CCTV 감지 화면 ───────── */
    if (ONLY.includes('a')) {
      const SHOTS = story.cctv.shots, KEYS = ['cctv-collapse', 'cctv-fight', 'cctv-window', 'cctv-phone'];
      // a1 보통 속도(한 줄씩): 네 장을 차례로, 표시는 그림이 뜬 뒤 늦게 잡힌다
      {
        const p = await open(dev, runTo({}, atScene('sc_1')), SET_SLOW);
        const first = await cgState(p);
        rec(size, 'a1 장면 첫 화면은 그림 없이 실습실 무대', first.hidden && !first.cgOn, JSON.stringify({ h: first.hidden, on: first.cgOn }));
        const seen = [], looks = [];
        for (let k = 0; k < 14 && seen.length < 4; k++) {
          await nextLine(p);
          const c = await cgState(p);
          if (c.key && !seen.includes(c.key)) {
            seen.push(c.key);
            const early = await cgState(p); // 방금 뜬 직후: 사각형은 아직 안 보인다(늦게 잡힘)
            await waitFor(p, () => { const im = document.querySelector('#cg .cg-img'); return !im.hasAttribute('data-loading') && im.naturalWidth > 0; });
            await p.evaluate(() => { if (PrivacyTalk.typing()) PrivacyTalk.next(); }); // 대사는 다 보이게(스크린샷용)
            const ok = await waitFor(p, () => { const b = document.querySelector('#cg .cg-box'), a = document.querySelector('#cg .cg-alert'); return getComputedStyle(b).opacity === '1' && getComputedStyle(a).opacity === '1'; }, null, 4000);
            const s = await cgState(p), sh = SHOTS[c.key], d = s.det || {}, pic = s.pic, text = await talkText(p);
            rec(size, `a1 ${c.key} 그림이 뜨고 감지 화면 모드`, !s.hidden && s.mode === 'cctv' && s.loaded && s.cgOn, JSON.stringify({ h: s.hidden, mode: s.mode, loaded: s.loaded }));
            rec(size, `a1 ${c.key} 표시는 그림이 뜬 뒤 늦게 잡힌다`, !!early.det && early.det.boxOp < 0.5 && ok, 'early ' + (early.det && early.det.boxOp));
            const rel = d.box ? { x: (d.box.x - pic.x) / pic.w, y: (d.box.y - pic.y) / pic.h, w: d.box.w / pic.w, h: d.box.h / pic.h } : {};
            const tol = Math.max(0.004, 1.5 / pic.w);
            rec(size, `a1 ${c.key} 빨간 사각형 자리 = cctv-boxes.json`, ['x', 'y', 'w', 'h'].every((q) => Math.abs(rel[q] - sh.box[q]) <= tol), JSON.stringify(rel));
            rec(size, `a1 ${c.key} 꼬리표 = 장면 이름 + 확신 정도, 사각형 바로 위·그림 안`, d.tagText === sh.label + ' ' + sh.pct + '%' && inside(d.tag, pic) && d.tag.b <= d.box.y + 2 && d.tag.y >= d.cam.b - 1 && d.tagFont >= 10, JSON.stringify({ t: d.tagText, f: d.tagFont, tag: d.tag, camB: d.cam && d.cam.b }));
            rec(size, `a1 ${c.key} 알림 카드(오른쪽 아래, 그림 안, 사각형과 안 겹침)`, d.alertText.includes(story.cctv.room + ' · ' + sh.label) && d.alertText.includes(story.cctv.send) && inside(d.alert, pic) && !hit(d.alert, d.box) && !hit(d.alert, d.tag) && d.alert.x > pic.x + pic.w * 0.45 && d.alert.y > pic.y + pic.h * 0.6, JSON.stringify({ t: d.alertText, a: d.alert }));
            rec(size, `a1 ${c.key} 카메라 이름 줄(위쪽 띠 안)`, d.camText.includes(story.cctv.cam) && d.cam.b <= pic.y + pic.h * 0.16 + 1, JSON.stringify({ t: d.camText, h: (d.cam.b - pic.y) / pic.h }));
            rec(size, `a1 ${c.key} 대체 글·화면 읽기 알림 = 무엇이 보이고 무엇으로 알렸는지`, s.alt === sh.alt && s.live === sh.alt && d.ariaHidden === 'true', s.alt.slice(0, 30));
            rec(size, `a1 ${c.key} 대사에도 알림 이름(색만으로 전하지 않음)`, text.includes(sh.label), text.slice(0, 40));
            rec(size, `a1 ${c.key} 대화창·위 버튼이 사각형·꼬리표·알림 카드를 가리지 않음`, s.talkTop != null && s.talkTop >= pic.b - 1 && !s.hud.some((h) => hit(h, d.box) || hit(h, d.tag) || hit(h, d.alert)), JSON.stringify({ talkTop: s.talkTop, picB: pic.b }));
            looks.push([d.color, d.bw, d.radius, d.tagBg, d.alertBorder].join('|'));
            await p.screenshot({ path: shot(`cctv-${c.key.replace('cctv-', '')}-${size}`) });
          }
        }
        rec(size, 'a1 네 장 순서 = 쓰러짐 → 싸움 → 창문 → 휴대폰', seen.join() === KEYS.join(), seen.join());
        rec(size, 'a1 네 장면 모두 같은 빨간색·같은 모양', looks.length === 4 && new Set(looks).size === 1 && /rgb\(255, 59, 48\)/.test(looks[0] || ''), [...new Set(looks)].join(' / '));
        // 그림 내리기: "화면은 여기까지" 줄에서 내려가고, 그 뒤 토론은 무대에서
        let downAt = '';
        for (let k = 0; k < 6; k++) { await nextLine(p); const c = await cgState(p); if (c.hidden) { downAt = await talkText(p); break; } }
        rec(size, 'a1 그림 내리기(cg:null) 줄에서 무대로 돌아옴', /화면은 여기까지/.test(downAt), downAt.slice(0, 40));
        await p.evaluate(() => { if (PrivacyTalk.typing()) PrivacyTalk.next(); }); await p.waitForTimeout(150);
        await p.screenshot({ path: shot(`cctv-down-${size}`) });
        let stayedDown = true;
        for (let k = 0; k < 30 && !(await choices(p)); k++) { await nextLine(p); if (!(await cgState(p)).hidden) stayedDown = false; }
        rec(size, 'a1 토론·선택 내내 그림 없음, 선택지 2개', stayedDown && (await choices(p)) === 2);
        noErr(size, 'a1', p);
        await close(p);
      }
      // a2 '한 번에'+움직임 줄이기: 그림마다 대화창이 끊겨 네 장을 다 본다, 표시는 바로
      {
        const p = await open(dev, runTo({}, atScene('sc_1')), SET_FAST);
        const seq = []; let instantOn = true, stacked = 0;
        for (let k = 0; k < 20 && !(await choices(p)); k++) {
          const c = await cgState(p), cur = c.hidden ? null : c.key;
          if (seq[seq.length - 1] !== cur) {
            seq.push(cur);
            if (cur) { await p.waitForTimeout(120); const s = await cgState(p); if (!(s.det && s.det.on && s.det.boxOp === 1 && s.det.alertOp === 1)) instantOn = false; }
          }
          stacked = Math.max(stacked, await p.evaluate(() => document.querySelectorAll('#talk .talk-text p').length));
          await p.evaluate(() => { if (PrivacyTalk.isOpen()) PrivacyTalk.next(); }); await p.waitForTimeout(150);
        }
        rec(size, "a2 '한 번에'도 그림 네 장을 차례로(그림마다 대화창을 끊음)", seq.join() === [null].concat(KEYS, [null]).join(), seq.join());
        rec(size, 'a2 움직임 줄이기: 사각형·알림 카드가 바로 보임', instantOn);
        rec(size, "a2 '한 번에' 묶음(여러 줄 한 상자)은 그대로", stacked >= 3, '한 상자 최대 ' + stacked + '줄');
        // 되돌리기: sc_2에서 이전 선택 → sc_1 다시(처음 줄 = 그림 없음)
        await pick(p, 'on'); for (let k = 0; k < 14 && (await choices(p)) !== 3; k++) await step(p);
        const s2 = await st(p);
        await p.click('#btn-undo'); await p.waitForTimeout(300); await p.click('#confirm-yes'); await p.waitForTimeout(700);
        const su = await st(p), cu = await cgState(p);
        rec(size, 'a2 이전 선택 → sc_1 처음 줄부터(그림 없음)', s2.scene === 'sc_2' && su.scene === 'sc_1' && !su.flags.ccx && cu.hidden, JSON.stringify([s2.scene, su.scene, cu.hidden]));
        noErr(size, 'a2', p);
        await close(p);
      }
      // a3 선택 반응 중에 저장된 진행을 이어 하기: 그림은 내려간 상태(같은 줄 기준 복원)
      if (key === 'd') {
        let s = runTo({}, atScene('sc_1')); s = E.choose(story, s, 'on'); s.history = s.history.slice(-1);
        const p = await open(dev, s, SET_FAST);
        const c = await cgState(p);
        rec(size, 'a3 반응 중 이어 하기: 그림 내려간 상태', c.hidden && !c.cgOn && (await st(p)).reaction === 'on', JSON.stringify({ h: c.hidden }));
        noErr(size, 'a3', p);
        await close(p);
      }
      // a4 그림을 못 불러와도 글만으로 진행
      if (key === 'm') {
        const p = await open(dev, runTo({}, atScene('sc_1')), SET_SLOW, { block: /assets\/cctv\// });
        let shown = 0, texts = [];
        for (let k = 0; k < 40 && !(await choices(p)); k++) {
          await nextLine(p); await p.waitForTimeout(250);
          const c = await cgState(p); if (!c.hidden && c.loaded) shown++;
          texts.push(await talkText(p));
        }
        rec(size, 'a4 그림 없음: 그림 칸은 숨고 대사만으로 선택지까지', shown === 0 && (await choices(p)) === 2 && (await cgState(p)).hidden && KEYS.every((q) => texts.some((t) => t.includes(SHOTS[q].label))), '그림 보인 횟수 ' + shown);
        noErr(size, 'a4', p);
        await close(p);
      }
    }
    /* ───────── b. 사건 4: 휴대폰 틀 안의 셀카 → AI 가짜 춤 영상 ───────── */
    if (ONLY.includes('b')) {
      const CL = story.clips;
      const phone = (p) => p.evaluate(() => {
        const box = document.getElementById('cg'), ph = box.querySelector('.cg-phone'), R = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
        const fr = [...ph.querySelectorAll('.cg-frame')], step = ph.querySelector('.cg-step'), talk = document.getElementById('talk'), stage = document.getElementById('stage');
        return { hidden: box.hidden, key: box.getAttribute('data-cg'), mode: box.getAttribute('data-mode'), phHidden: ph.hidden, n: fr.length, on: fr.findIndex((f) => f.classList.contains('on')),
          onCount: fr.filter((f) => f.classList.contains('on')).length, loaded: fr.length > 0 && fr.every((f) => f.complete && f.naturalWidth > 0), src: fr.map((f) => f.getAttribute('src')),
          who: ph.querySelector('.cg-phone-who').textContent, barHidden: ph.querySelector('.cg-phone-bar').hidden, count: ph.querySelector('.cg-count').textContent,
          stepHidden: step.hidden, stepTag: step.tagName, stepH: step.hidden ? 0 : step.getBoundingClientRect().height, stepRect: step.hidden ? null : R(step),
          label: ph.querySelector('.cg-screen').getAttribute('aria-label'), role: ph.querySelector('.cg-screen').getAttribute('role'), live: document.getElementById('cg-live').textContent,
          pic: R(box.querySelector('.cg-pic')), stage: R(stage), talkTop: talk && !talk.hidden ? talk.getBoundingClientRect().top : null, cgOn: document.body.classList.contains('cg-on'),
          hudB: Math.max(0, ...['.hud-left', '.hud .bar-actions'].map((q) => document.querySelector(q)).filter((e) => e && e.getClientRects().length).map((e) => e.getBoundingClientRect().bottom)) };
      });
      const framesLoaded = (p) => waitFor(p, () => { const f = [...document.querySelectorAll('#cg .cg-frame')]; return f.length > 0 && f.every((x) => x.complete && x.naturalWidth > 0); });
      const untilKey = async (p, key, n = 12) => { for (let k = 0; k < n; k++) { const s = await phone(p); if (!s.hidden && s.key === key) return true; await nextLine(p); } return false; };
      // b1 보통 속도·움직임 허용: 셀카 → 춤 세 장이 0.4초쯤마다 넘어가고, 선택 전에 내린다
      {
        const p = await open(dev, runTo({}, atScene('c2_e4_a')), SET_SLOW);
        const s0 = await phone(p);
        rec(size, 'b1 장면 첫 화면은 그림 없이 매점 앞 무대', s0.hidden && !s0.cgOn, JSON.stringify({ h: s0.hidden }));
        const gotSelfie = await untilKey(p, 'saebom-selfie'); await framesLoaded(p);
        await p.evaluate(() => { if (PrivacyTalk.typing()) PrivacyTalk.next(); }); await p.waitForTimeout(150);
        const s1 = await phone(p), t1 = await talkText(p);
        rec(size, 'b1 하늘이 화면을 돌리는 줄에서 휴대폰 틀 + 셀카 한 장', gotSelfie && s1.mode === 'phone' && !s1.phHidden && s1.n === 1 && s1.on === 0 && s1.loaded && /saebom-selfie\.(webp|png)/.test(s1.src[0]) && /화면을 내 쪽으로 돌렸다/.test(t1), JSON.stringify({ n: s1.n, src: s1.src, t: t1.slice(0, 20) }));
        rec(size, 'b1 틀은 세로(3:4), 위 버튼 아래·대화창 위·무대 안', s1.pic.h > s1.pic.w * 1.25 && s1.pic.y >= s1.hudB - 1 && s1.talkTop != null && s1.pic.b <= s1.talkTop + 1 && s1.pic.x >= s1.stage.x && s1.pic.r <= s1.stage.r && s1.pic.w >= 200, JSON.stringify({ pic: s1.pic, hudB: s1.hudB, talkTop: s1.talkTop }));
        rec(size, 'b1 셀카: 계정 줄(새봄 공개 계정)·재생 표시 없음·대체 글', s1.who === CL['saebom-selfie'].who && s1.barHidden && s1.stepHidden && s1.role === 'img' && s1.label === CL['saebom-selfie'].alt && s1.live === CL['saebom-selfie'].alt, s1.who);
        await p.screenshot({ path: shot(`deepfake-selfie-${size}`) });
        const gotDance = await untilKey(p, 'saebom-dance'); await framesLoaded(p);
        await p.evaluate(() => { if (PrivacyTalk.typing()) PrivacyTalk.next(); });
        const s2 = await phone(p);
        rec(size, 'b1 춤 영상: 장면 세 장·익명 계정 줄·재생 표시, "AI" 딱지 없음', gotDance && s2.n === 3 && s2.loaded && s2.onCount === 1 && s2.who === CL['saebom-dance'].who && !/AI|가짜|딥페이크/.test(s2.who + s2.count) && !s2.barHidden && s2.stepHidden && s2.label === CL['saebom-dance'].alt, JSON.stringify({ n: s2.n, who: s2.who, on: s2.onCount }));
        // 2.4초 동안 50ms마다: 세 장을 모두 지나고, 바뀌는 간격이 0.4초쯤
        const samples = await p.evaluate(() => new Promise((res) => { const out = []; const t0 = performance.now(); const id = setInterval(() => {
          out.push([Math.round(performance.now() - t0), [...document.querySelectorAll('#cg .cg-frame')].findIndex((f) => f.classList.contains('on'))]);
          if (performance.now() - t0 > 2400) { clearInterval(id); res(out); } }, 50); }));
        const changes = []; for (let i = 1; i < samples.length; i++) if (samples[i][1] !== samples[i - 1][1]) changes.push(samples[i][0]);
        const gaps = changes.slice(1).map((t, i) => t - changes[i]), seenIdx = new Set(samples.map((x) => x[1]));
        rec(size, 'b1 세 장이 번갈아 넘어감(0.4초쯤)', seenIdx.size === 3 && !seenIdx.has(-1) && changes.length >= 4 && changes.length <= 7 && gaps.every((g) => g >= 300 && g <= 560), JSON.stringify({ changes: changes.length, gaps }));
        await p.screenshot({ path: shot(`deepfake-dance-${size}`) });
        // 영상이 떠 있는 줄 수, 내리는 줄
        let upLines = 1, downText = '';
        for (let k = 0; k < 8; k++) { await nextLine(p); const s = await phone(p); if (s.hidden) { downText = await talkText(p); break; } upLines++; }
        rec(size, 'b1 영상은 몇 줄 동안만 → "딥페이크" 줄에서 내림', upLines >= 2 && upLines <= 5 && /딥페이크/.test(downText), upLines + '줄 / ' + downText.slice(0, 30));
        const stopped = await p.evaluate(() => new Promise((res) => { const a = [...document.querySelectorAll('#cg .cg-frame')].findIndex((f) => f.classList.contains('on')); setTimeout(() => res(a === [...document.querySelectorAll('#cg .cg-frame')].findIndex((f) => f.classList.contains('on'))), 900); }));
        rec(size, 'b1 내린 뒤에는 장면 넘김도 멈춤', stopped);
        let down = true;
        for (let k = 0; k < 20 && !(await choices(p)); k++) { await nextLine(p); if (!(await phone(p)).hidden) down = false; }
        const sc = await phone(p);
        rec(size, 'b1 선택지가 뜰 때 영상은 내려가 있음(선택지 3개)', down && sc.hidden && !sc.cgOn && (await choices(p)) === 3);
        await p.screenshot({ path: shot(`deepfake-choice-${size}`) });
        noErr(size, 'b1', p);
        await close(p);
      }
      // b2 움직임 줄이기: 멈춘 한 장 + '다음 장면' 버튼으로 직접 넘김
      {
        const p = await open(dev, runTo({}, atScene('c2_e4_a')), Object.assign({}, SET_SLOW, { reduceMotion: true }));
        const got = await untilKey(p, 'saebom-dance'); await framesLoaded(p);
        await p.evaluate(() => { if (PrivacyTalk.typing()) PrivacyTalk.next(); }); await p.waitForTimeout(100);
        const a = await phone(p); await p.waitForTimeout(1100); const b = await phone(p), tBefore = await talkText(p);
        rec(size, "b2 움직임 줄이기: 저절로 안 넘어감 + '다음 장면' 버튼(진짜 버튼, 44px 이상, 틀 안·대화창 위)", got && a.on === 0 && b.on === 0 && !b.stepHidden && b.stepTag === 'BUTTON' && b.stepH >= 44 && inside(b.stepRect, b.pic, 2) && b.stepRect.b <= b.talkTop, JSON.stringify({ on: [a.on, b.on], h: b.stepH }));
        await p.click('#cg .cg-step'); const c1 = await phone(p);
        await p.click('#cg .cg-step'); const c2 = await phone(p);
        await p.click('#cg .cg-step'); const c3 = await phone(p);
        rec(size, 'b2 버튼으로 1 → 2 → 3 → 1, 화면 읽기 알림 "장면 n / 3"', c1.on === 1 && c2.on === 2 && c3.on === 0 && c1.live === '장면 2 / 3' && c2.live === '장면 3 / 3' && c1.count === '2 / 3', JSON.stringify([c1.on, c2.on, c3.on, c1.live]));
        rec(size, 'b2 버튼을 눌러도 대사는 그대로(넘어가지 않음)', (await talkText(p)) === tBefore);
        await p.focus('#cg .cg-step'); await p.keyboard.press('Enter'); const c4 = await phone(p);
        rec(size, 'b2 키보드(Enter)로도 장면만 넘어감', c4.on === 1 && (await talkText(p)) === tBefore, String(c4.on));
        await p.screenshot({ path: shot(`deepfake-reduced-${size}`) });
        for (let k = 0; k < 20 && !(await choices(p)); k++) await nextLine(p);
        rec(size, 'b2 선택지가 뜰 때 영상 내려감', (await phone(p)).hidden && (await choices(p)) === 3);
        noErr(size, 'b2', p);
        await close(p);
      }
      // b3 '한 번에': 셀카·영상을 따로 보고, 고른 뒤 이전 선택으로 돌아가도 그림 없이 처음 줄부터
      {
        const p = await open(dev, runTo({}, atScene('c2_e4_a')), SET_FAST);
        const seq = []; let overlap = 0;
        for (let k = 0; k < 20 && !(await choices(p)); k++) {
          const s = await phone(p), cur = s.hidden ? null : s.key;
          if (seq[seq.length - 1] !== cur) seq.push(cur);
          if (cur && s.talkTop != null && s.pic.b > s.talkTop + 1) overlap = Math.max(overlap, Math.round(s.pic.b - s.talkTop));
          if (cur === 'saebom-dance' && !seq.shot) { seq.shot = true; await framesLoaded(p); await p.screenshot({ path: shot(`deepfake-instant-${size}`) }); }
          await step(p);
        }
        rec(size, "b3 '한 번에': 그림 없음 → 셀카 → 영상 → 내림", seq.join() === [null, 'saebom-selfie', 'saebom-dance', null].join(), seq.join());
        rec(size, "b3 '한 번에' 쌓인 대화창이 휴대폰 틀을 덮지 않음", overlap === 0, '겹침 ' + overlap + 'px');
        rec(size, 'b3 선택지 3개·영상 내려감', (await choices(p)) === 3 && (await phone(p)).hidden);
        await pick(p, 'forward'); await p.waitForTimeout(300);
        const r = await st(p);
        await p.click('#btn-undo'); await p.waitForTimeout(300); await p.click('#confirm-yes'); await p.waitForTimeout(700);
        const u = await st(p), su = await phone(p);
        rec(size, 'b3 이전 선택 → 고르기 전으로, 처음 줄은 그림 없음', r.reaction === 'forward' && r.flags.e4 === 'forward' && u.scene === 'c2_e4_a' && !u.reaction && !u.flags.e4 && su.hidden, JSON.stringify([r.reaction, u.scene, su.hidden]));
        noErr(size, 'b3', p);
        await close(p);
      }
      // b4 그림 없음: 틀 없이 글만으로 / b5 이야기 줄에서 내리기가 빠져도 선택 전에는 내려감(안전망)
      if (key === 'd') {
        const p = await open(dev, runTo({}, atScene('c2_e4_a')), SET_SLOW, { block: /assets\/photos\/saebom/ });
        let shown = 0; const texts = [];
        for (let k = 0; k < 40 && !(await choices(p)); k++) { await nextLine(p); await p.waitForTimeout(250); const s = await phone(p); if (!s.hidden && s.loaded) shown++; texts.push(await talkText(p)); }
        rec(size, 'b4 그림 없음: 틀은 숨고 대사만으로 선택지까지', shown === 0 && (await phone(p)).hidden && (await choices(p)) === 3 && texts.some((t) => /딥페이크/.test(t)) && texts.some((t) => /춘 적이 없다/.test(t)), '보인 횟수 ' + shown);
        noErr(size, 'b4', p);
        await close(p);
        const q = await open(dev, runTo({}, atScene('c2_e4_a')), SET_FAST, { pre: () => { window.PRIVACY_STORY.scenes.c2_e4_a.lines.forEach((l) => { if (l && typeof l === 'object' && l.cg === null) delete l.cg; }); } });
        let upAtEnd = false;
        for (let k = 0; k < 20 && !(await choices(q)); k++) { const s = await phone(q); upAtEnd = !s.hidden; await step(q); }
        rec(size, 'b5 안전망: 내리는 줄이 없어도 선택지가 뜰 때는 내려감', upAtEnd && (await phone(q)).hidden && (await choices(q)) === 3, '끝까지 떠 있었나 ' + upAtEnd);
        noErr(size, 'b5', q);
        await close(q);
      }
    }
    /* ───────── c. 성찰 카드 ───────── */
    if (ONLY.includes('c')) {
      const Card = require('../js/card.js'), ROUTES = require('./routes.js'), CK = 'ethicity.privacy.card.v1', PK = 'ethicity.privacy.progress.v2';
      const prefs = (route) => Object.fromEntries(route.map((x) => x.split('#')));
      const ended = (route) => runTo(prefs(route), (s) => s.screen === 'ending', true); // 엔딩에 도착한 진행(선택 기록 전부)
      const view = (p) => p.evaluate(() => document.body.getAttribute('data-view'));
      const stored = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), CK);
      const confirmBox = (p) => p.evaluate(() => { const c = document.getElementById('confirm'); return { open: !c.hidden, title: document.getElementById('confirm-title').textContent, text: document.getElementById('confirm-text').textContent, yes: document.getElementById('confirm-yes').textContent }; });
      const TXT = (n, tag) => (tag + ' 공개로 올린 사진이라도 주인에게 먼저 물어봐야 한다고 생각했다. 친구가 싫다고 하면 바로 지우고, 왜 그런지도 들어 보고 싶다. ').repeat(4).slice(0, n);
      // 엔딩 화면 → 카드 열기(시작 화면의 '성찰 카드 쓰기' 링크로도)
      const openCard = async (p) => { await p.click('#btn-start-card'); await p.waitForTimeout(300); };
      // c1 엔딩 화면 버튼 · 자동 채움
      {
        const run = ended(ROUTES.D), p = await open(dev, run, SET_FAST);
        const s0 = await p.evaluate(() => ({ v: document.body.getAttribute('data-view'), link: !document.getElementById('btn-start-card').hidden, links: !document.getElementById('start-links').hidden }));
        rec(size, 'c1 엔딩을 본 진행: 시작 화면에 성찰 카드 링크', s0.v === 'v-start' && s0.link && s0.links, JSON.stringify(s0));
        await p.click('#btn-start-path'); await p.waitForTimeout(200); await p.click('#btn-path-back'); await p.waitForTimeout(200);
        // 엔딩 화면으로 가서 버튼 줄 확인(엔진 상태로 직접 그리기: 저장된 진행은 엔딩 화면)
        await openCard(p);
        const c = await p.evaluate(() => {
          const q = (s) => document.querySelector(s), all = (s) => [...document.querySelectorAll(s)];
          return { v: document.body.getAttribute('data-view'), h1: q('#k-title').textContent, game: q('#k-game').textContent, date: q('#k-date').textContent, ending: q('#k-ending').textContent,
            topics: all('.rcard-topic').map((t) => ({ id: t.getAttribute('data-topic'), h: t.querySelector('h2').textContent.trim(), label: t.querySelector('.rcard-auto-label').textContent,
              items: [...t.querySelectorAll('.rcard-auto li')].map((li) => ({ head: (li.querySelector('.rcard-ev') || {}).textContent || '', text: li.querySelector('.rcard-out').textContent })),
              q: t.querySelector('label.rcard-q').textContent, forId: t.querySelector('label.rcard-q').getAttribute('for'), ta: t.querySelector('textarea').id, max: t.querySelector('textarea').maxLength, count: t.querySelector('.rcard-count').textContent })),
            notes: [q('#k-device').textContent, q('#k-pdf').textContent, q('#k-need').textContent], needHidden: q('#k-need').hidden,
            leftBar: all('.rcard, .rcard-auto, .rcard-topic, .rcard-input').map((e) => { const cs = getComputedStyle(e); return parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth); }).filter((d) => d > 0).length,
            labelled: all('#v-card input').every((i) => i.closest('label')), btnTags: [q('#btn-card-print').tagName, q('#btn-card-back').tagName].join() };
        });
        const want = Card.topics(story, E, run), d = new Date();
        rec(size, 'c1 카드 화면: 머리(게임 이름·날짜·엔딩 이름)', c.v === 'v-card' && c.h1 === story.card.heading && c.game.includes(story.title) && c.date === `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일` && c.ending === '엔딩 D · ' + story.endings.find((e) => e.code === 'D').title, JSON.stringify([c.v, c.date, c.ending]));
        rec(size, 'c1 토픽 셋·자동으로 채운 선택 = 이번 진행', c.topics.length === 3 && want.every((t, i) => c.topics[i].id === t.id && c.topics[i].h.includes(t.title) && c.topics[i].label === t.label && JSON.stringify(c.topics[i].items) === JSON.stringify(t.items) && c.topics[i].q === t.q), JSON.stringify(c.topics.map((t) => t.items.length)));
        rec(size, 'c1 ① 일곱 사건 · ② 가짜 춤 영상 전달·AI 도우미 · ③ 우리 반 안 네 줄', c.topics[0].items.length === 7 && c.topics[1].items.some((i) => /가짜 춤 영상을 친구들에게 전달했다/.test(i.text)) && c.topics[1].items.some((i) => i.head === story.events.e5.title) && c.topics[2].items.length === 4 && c.topics[2].items[1].head === '알림 범위', JSON.stringify(c.topics[1].items.map((i) => i.text.slice(0, 14))));
        rec(size, 'c1 쓰는 칸 셋: 물음이 칸의 이름표, 글자 수 표시, 200자', c.topics.every((t, i) => t.forId === t.ta && t.ta === 'k-a' + (i + 1) && t.max === Card.MAX_TEXT && t.count === '0 / ' + Card.MAX_TEXT + '자') && c.labelled && c.btnTags === 'BUTTON,BUTTON', JSON.stringify(c.topics.map((t) => t.count)));
        rec(size, 'c1 안내: 이 기기에만 저장 · PDF는 크롬·엣지 · 학번·이름을 적으라는 안내(막지 않음)', c.notes[0] === story.card.deviceNote && c.notes[1] === story.card.pdfNote && c.notes[2] === story.card.needNote && !c.needHidden);
        rec(size, 'c1 상자에 왼쪽 굵은 색 띠 없음', c.leftBar === 0, String(c.leftBar));
        const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        rec(size, 'c1 가로로 넘치지 않음', overflow <= 1, overflow + 'px');
        await p.screenshot({ path: shot(`card-empty-${size}`), fullPage: true });
        // c2 쓰기 → 자동 저장 → 새로고침해도 그대로
        await p.evaluate(() => localStorage.setItem('ethicity.result.privacy', JSON.stringify({ game: 'privacy', completed: true, ending: 'D', card: '검사용 결과' }))); // 엔딩에 도착할 때 쓰는 공통 결과(여기서는 진행을 바로 넣어서 없음)
        await p.fill('#k-sid', '20315'); await p.fill('#k-name', '김 온유');
        await p.fill('#k-a1', TXT(150, '첫째')); await p.fill('#k-a2', TXT(150, '둘째')); await p.fill('#k-a3', TXT(150, '셋째'));
        const sv = await stored(p), cnt = await p.evaluate(() => [...document.querySelectorAll('.rcard-count')].map((e) => e.textContent));
        rec(size, 'c2 입력할 때마다 이 기기에 저장(엔딩 코드·진행 지문과 함께)', !!sv && sv.v === 1 && sv.ending === 'D' && sv.sig === Card.sig(run) && sv.sid === '20315' && sv.name === '김 온유' && sv.answers.length === 3 && sv.answers.every((a) => a.length === 150), JSON.stringify(sv && [sv.ending, sv.sid, sv.name, sv.answers.map((a) => a.length)]));
        rec(size, 'c2 글자 수 표시가 따라 바뀜 · 학번·이름 안내는 사라짐', cnt.every((t) => t === '150 / 200자') && await p.evaluate(() => document.getElementById('k-need').hidden), cnt.join());
        const others = await p.evaluate(() => ({ player: localStorage.getItem('ethicity.player'), keys: Object.keys(localStorage).sort() }));
        rec(size, 'c2 공통 키는 건드리지 않음(ethicity.player 없음 그대로)', others.player === null && !others.keys.some((k) => !/^ethicity\.(privacy\.|result\.privacy$)/.test(k)), others.keys.join());
        await p.screenshot({ path: shot(`card-filled-${size}`), fullPage: true });
        await p.reload(); await p.waitForTimeout(600); await openCard(p);
        const re = await p.evaluate(() => ({ sid: document.getElementById('k-sid').value, name: document.getElementById('k-name').value, a: [1, 2, 3].map((i) => document.getElementById('k-a' + i).value), cnt: document.querySelector('.rcard-count').textContent }));
        rec(size, 'c2 새로고침 뒤 다시 열면 그대로', re.sid === '20315' && re.name === '김 온유' && re.a[0] === TXT(150, '첫째') && re.a[2] === TXT(150, '셋째') && re.cnt === '150 / 200자', JSON.stringify([re.sid, re.name, re.a.map((x) => x.length)]));
        // c3 PDF로 저장하기: 인쇄하는 동안만 문서 제목 = 파일 이름, 끝나면 되돌림(window.print는 가짜로)
        const base = await p.title();
        await p.evaluate(() => { window.__printed = []; window.print = () => { window.__printed.push(document.title); window.dispatchEvent(new Event('afterprint')); }; });
        await p.click('#btn-card-print'); await p.waitForTimeout(150);
        const pr = await p.evaluate(() => ({ during: window.__printed, after: document.title }));
        rec(size, 'c3 인쇄하는 동안 제목 = 공유한순간_성찰카드_학번_이름(공백 → _), 끝나면 되돌림', pr.during.length === 1 && pr.during[0] === '공유한순간_성찰카드_20315_김_온유' && pr.after === base, JSON.stringify(pr));
        await p.evaluate(() => { window.dispatchEvent(new Event('beforeprint')); window.__t2 = document.title; window.dispatchEvent(new Event('afterprint')); });
        rec(size, 'c3 Ctrl+P(beforeprint)로 직접 인쇄해도 같은 제목', (await p.evaluate(() => window.__t2)) === '공유한순간_성찰카드_20315_김_온유' && (await p.title()) === base);
        await p.evaluate(() => { window.print = () => { window.__printed.push(document.title); }; }); // afterprint가 오지 않는 브라우저
        await p.click('#btn-card-print'); await p.waitForTimeout(100); await p.click('#btn-card-back'); await p.waitForTimeout(300);
        rec(size, 'c3 afterprint가 없어도 카드 화면을 나가면 제목이 되돌아옴', (await p.title()) === base && (await view(p)) === 'v-start', await p.title());
        // c4 인쇄 모양: A4 한 장(세 칸 150자) · 버튼·안내 숨김 · 답은 문단으로
        await openCard(p);
        if (key === 'd') {
          await p.emulateMedia({ media: 'print' });
          const pm = await p.evaluate(() => { const vis = (s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).length;
            return { buttons: vis('button'), noPrint: vis('.no-print'), ta: vis('textarea'), counts: vis('.rcard-count'), answers: [...document.querySelectorAll('.rcard-answer')].filter((e) => e.getClientRects().length).map((e) => e.textContent.length),
              stage: vis('#stage'), bg: getComputedStyle(document.body).backgroundColor, color: getComputedStyle(document.body).color, inputs: vis('#k-sid, #k-name') }; });
          rec(size, 'c4 인쇄 모양: 버튼·안내·입력 칸 숨김, 답은 문단, 흰 바탕 검은 글자', pm.buttons === 0 && pm.noPrint === 0 && pm.ta === 0 && pm.counts === 0 && pm.answers.join() === [1, 2, 3].map(() => Card.printText(TXT(150, '첫째')).length).join() && pm.stage === 0 && pm.bg === 'rgb(255, 255, 255)' && pm.color === 'rgb(0, 0, 0)' && pm.inputs === 2, JSON.stringify(pm));
          await p.screenshot({ path: shot('card-print-preview'), fullPage: true });
          await p.emulateMedia({ media: null });
          const pages = async (file) => { const buf = await p.pdf({ path: file, preferCSSPageSize: true, printBackground: false }); return (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length; };
          const n150 = await pages(path.join(PDF_DIR, 'privacy-card-150.pdf'));
          rec(size, 'c4 PDF 쪽수 = 1 (세 칸 150자씩)', n150 === 1, n150 + '쪽');
          for (const i of [1, 2, 3]) await p.fill('#k-a' + i, TXT(200, '가득'));
          const n200 = await pages(path.join(PDF_DIR, 'privacy-card-200.pdf'));
          rec(size, 'c4 PDF 쪽수 = 1 (세 칸을 200자 끝까지 채워도)', n200 === 1, n200 + '쪽');
          // 가장 긴 경우: 무작위 3,000회에서 자동 칸 자리마다 나온 가장 긴 문장 길이를 한 장에 다 모은다(실제 어느 진행보다 길다) + 세 칸 200자 — 그래도 한 장
          const lens = [[], [], []];
          { let seed = 20261110; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
            for (let i = 0; i < 3000; i++) {
              let r = E.createState(story);
              for (let k = 0; k < 800 && r.screen !== 'ending'; k++) {
                if (r.screen === 'scene' && E.needsChoice(story, r)) { const cs = E.visibleChoices(story, story.scenes[r.scene], r); r = E.choose(story, r, cs[Math.floor(rnd() * cs.length)].id); r.history = []; }
                r = E.advance(story, r);
              }
              Card.topics(story, E, r).forEach((t, k) => t.items.forEach((it, j) => { lens[k][j] = Math.max(lens[k][j] || 0, it.text.length); }));
            } }
          const worst = await p.evaluate((lens) => { let n = 0;
            document.querySelectorAll('.rcard-topic').forEach((t, k) => { const ul = t.querySelector('.rcard-auto ul'); while (ul.children.length < lens[k].length) ul.appendChild(ul.lastElementChild.cloneNode(true));
              [...ul.querySelectorAll('.rcard-out')].forEach((e, j) => { e.textContent = '가나다라마바사아자차'.repeat(10).slice(0, lens[k][j] || 10); n++; }); });
            return n; }, lens);
          const nWorst = await pages(path.join(PDF_DIR, 'privacy-card-worst.pdf'));
          rec(size, 'c4 PDF 쪽수 = 1 (자동 칸 자리마다 가장 긴 문장을 다 모은 경우 + 세 칸 200자)', worst === lens.flat().length && lens[0].length === 7 && nWorst === 1, worst + '줄(' + lens.map((l) => l.join('/')).join(' · ') + '자) · ' + nWorst + '쪽');
          await p.click('#btn-card-back'); await p.waitForTimeout(200); await openCard(p); // 화면을 다시 그려 원래 줄로
          for (const i of [1, 2, 3]) await p.fill('#k-a' + i, '');
          const blankTxt = await p.evaluate(() => [...document.querySelectorAll('.rcard-answer')].map((e) => e.textContent + '|' + e.classList.contains('none')));
          rec(size, "c4 비운 칸은 인쇄에 '작성 안 함'", blankTxt.every((t) => t === '작성 안 함|true') && (await pages(path.join(PDF_DIR, 'privacy-card-blank.pdf'))) === 1, blankTxt.join());
          for (const i of [1, 2, 3]) await p.fill('#k-a' + i, TXT(150, ['첫째', '둘째', '셋째'][i - 1]));
        }
        // c5 처음부터 다시: 쓴 글이 있으면 먼저 확인 창 → 취소하면 그대로, 확인하면 글·이름·학번 모두 지우고 새 진행
        await p.click('#btn-card-back'); await p.waitForTimeout(200);
        await p.click('#btn-new'); await p.waitForTimeout(250);
        const q1 = await confirmBox(p);
        rec(size, 'c5 쓴 글이 있으면 새로 시작 전에 확인 창("성찰 카드에 쓴 글이 지워져요. PDF로 저장했나요?")', q1.open && q1.text === '성찰 카드에 쓴 글이 지워져요. PDF로 저장했나요?', JSON.stringify(q1));
        await p.screenshot({ path: shot(`card-confirm-${size}`) });
        await p.click('#confirm-no'); await p.waitForTimeout(200);
        const keep = await stored(p);
        rec(size, 'c5 취소하면 글·진행 그대로', !!keep && keep.answers[0].length === 150 && (await view(p)) === 'v-start' && (await st(p)).screen === 'ending');
        await p.click('#btn-new'); await p.waitForTimeout(250); await p.click('#confirm-yes'); await p.waitForTimeout(300);
        const warn = await p.evaluate(() => !document.getElementById('warning').hidden);
        if (warn) { await p.click('#btn-warning-ok'); await p.waitForTimeout(600); }
        const after = await stored(p), ns = await st(p);
        rec(size, 'c5 확인하면 쓴 글·이름·학번 모두 지우고 새 진행', warn && after === null && !!ns && ns.screen !== 'ending' && ns.history.length === 0, JSON.stringify([after, ns && ns.screen]));
        const res = await p.evaluate(() => JSON.parse(localStorage.getItem('ethicity.result.privacy') || 'null'));
        rec(size, 'c5 공통 완료 결과(ethicity.result.privacy)는 그대로', !!res && res.game === 'privacy' && res.ending === 'D' && res.card === '검사용 결과', JSON.stringify(res));
        noErr(size, 'c1~c5', p);
        await close(p);
      }
      // c6 쓴 글이 없으면(이름·학번만) 묻지 않고 바로 시작, 그래도 이름·학번은 지움 · 엔딩 화면의 '처음부터 다시'
      {
        const run = ended(ROUTES.A);
        const p = await open(dev, run, SET_FAST, { card: Object.assign(Card.blank(run), { sid: '20101', name: '이다온' }) });
        await p.click('#btn-new'); await p.waitForTimeout(250);
        const q = await confirmBox(p), warn = await p.evaluate(() => !document.getElementById('warning').hidden);
        rec(size, 'c6 쓴 글이 없으면 확인 창 없이 바로(주의 화면)', !q.open && warn, JSON.stringify(q));
        await p.click('#btn-warning-ok'); await p.waitForTimeout(600);
        rec(size, 'c6 새 진행을 시작하면 이름·학번도 지워짐', (await stored(p)) === null && (await st(p)).history.length === 0);
        noErr(size, 'c6', p);
        await close(p);
      }
      // c7 엔딩 화면: '성찰 카드 쓰기'가 으뜸 버튼 · '처음부터 다시'도 쓴 글이 있으면 묻는다 · 메뉴 없이 '이 게임 기록 지우기'와 같은 지우기(저장 키)
      {
        const before = runTo(prefs(ROUTES.B), (s) => s.screen === 'scene' && !E.needsChoice(story, s) && E.pendingNext(story, s) === '@ending', true);
        const p = await open(dev, before, SET_FAST);
        for (let k = 0; k < 40 && (await view(p)) !== 'v-ending'; k++) await step(p, 200);
        await p.evaluate(() => { const g = document.getElementById('finale-go'); if (g && !document.getElementById('finale').hidden) g.click(); }); await p.waitForTimeout(300);
        const e = await p.evaluate(() => { const bs = [...document.querySelectorAll('#v-ending .actions button')].filter((b) => b.getClientRects().length);
          return { v: document.body.getAttribute('data-view'), ids: bs.map((b) => b.id), primary: bs.filter((b) => b.classList.contains('primary')).map((b) => b.id), first: bs[0] && bs[0].textContent }; });
        rec(size, "c7 엔딩 화면 버튼 줄: '성찰 카드 쓰기'가 첫째·하나뿐인 으뜸 버튼", e.v === 'v-ending' && e.ids[0] === 'btn-end-card' && e.primary.join() === 'btn-end-card' && e.first === '성찰 카드 쓰기' && e.ids.includes('btn-end-path') && e.ids.includes('btn-end-reflect'), JSON.stringify(e));
        await p.locator('#btn-end-card').scrollIntoViewIfNeeded();
        await p.screenshot({ path: shot(`card-ending-buttons-${size}`) });
        await p.click('#btn-end-card'); await p.waitForTimeout(300);
        const cv = await p.evaluate(() => ({ v: document.body.getAttribute('data-view'), ending: document.getElementById('k-ending').textContent, focus: document.activeElement && document.activeElement.id }));
        rec(size, 'c7 카드 열림(엔딩 B) · 제목에 초점', cv.v === 'v-card' && /^엔딩 B · /.test(cv.ending) && cv.focus === 'k-title', JSON.stringify(cv));
        await p.click('#k-a2'); await p.keyboard.type('wasd 12'); // 걷기·선택 단축키(WASD·숫자·스페이스)가 글쓰기를 가로채지 않는다
        rec(size, 'c7 쓰는 칸에서 WASD·숫자·스페이스가 그대로 써짐', (await p.inputValue('#k-a2')) === 'wasd 12' && (await view(p)) === 'v-card', await p.inputValue('#k-a2'));
        await p.fill('#k-a2', '한 줄만 썼다.');
        await p.click('#btn-card-back'); await p.waitForTimeout(300);
        rec(size, 'c7 돌아가기 = 엔딩 화면', (await view(p)) === 'v-ending');
        await p.click('#btn-end-replay'); await p.waitForTimeout(250);
        const q = await confirmBox(p);
        rec(size, "c7 엔딩 화면 '처음부터 다시'도 쓴 글이 있으면 먼저 묻는다", q.open && q.text === story.card.wipeAsk, JSON.stringify(q));
        await p.keyboard.press('Escape'); await p.waitForTimeout(200);
        rec(size, 'c7 Esc = 취소(글 그대로)', !(await confirmBox(p)).open && ((await stored(p)) || {}).answers[1] === '한 줄만 썼다.' && (await view(p)) === 'v-ending');
        // 「이 게임 기록 지우기」: 메뉴는 무대에서만 열리므로 새 진행을 시작해 메뉴에서 누른다
        await p.click('#btn-end-replay'); await p.waitForTimeout(250); await p.click('#confirm-yes'); await p.waitForTimeout(800);
        rec(size, 'c7 확인 → 새 진행(카드 지워짐)', (await stored(p)) === null && (await st(p)).history.length === 0);
        await p.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, ending: 'B', sig: 'x', sid: '1', name: '가', answers: ['남은 글', '', ''] })), CK);
        await p.click('#btn-menu'); await p.waitForTimeout(200); await p.click('#btn-menu-wipe'); await p.waitForTimeout(200);
        const wq = await confirmBox(p);
        await p.click('#confirm-yes'); await p.waitForTimeout(300);
        const left = await p.evaluate(() => Object.keys(localStorage).sort());
        rec(size, '「이 게임 기록 지우기」: 확인 문구에 성찰 카드, 쓴 글·이름·학번까지 지움', wq.open && /성찰 카드에 쓴 글과 이름·학번/.test(wq.text) && !left.includes(CK) && !left.includes(PK) && (await view(p)) === 'v-start', JSON.stringify(left));
        rec(size, 'c7 엔딩을 본 진행이 없으면 카드 링크 숨김', await p.evaluate(() => document.getElementById('btn-start-card').hidden));
        noErr(size, 'c7', p);
        await close(p);
      }
      // c8 다른 진행에서 쓴 글은 섞이지 않는다 · 특별 수업을 하지 않은 옛 진행
      if (key === 'd') {
        const run = ended(ROUTES.C), other = ended(ROUTES.B);
        const p = await open(dev, run, SET_FAST, { card: Object.assign(Card.blank(other), { sid: '9', name: '남', answers: ['다른 진행의 글', '', ''] }) });
        await openCard(p);
        const c = await p.evaluate(() => ({ a: document.getElementById('k-a1').value, sid: document.getElementById('k-sid').value, t3: document.querySelector('[data-topic="cctv"] .rcard-auto').textContent }));
        rec(size, 'c8 다른 진행에서 쓴 글·이름은 보이지 않음(빈 카드)', c.a === '' && c.sid === '' && ((await stored(p)) || {}).ending === 'C', JSON.stringify(c).slice(0, 80));
        rec(size, 'c8 설치 안 함 진행: ③ 한 줄', /설치 여부/.test(c.t3) && /설치하지 않음/.test(c.t3) && !/알림 범위/.test(c.t3), c.t3);
        await close(p);
        const old = Object.assign({}, run, { flags: Object.fromEntries(Object.entries(run.flags).filter(([k]) => !/^ccx/.test(k))) });
        const q = await open(dev, old, SET_FAST);
        await openCard(q);
        const o = await q.evaluate(() => { const t = document.querySelector('[data-topic="cctv"]'); return { empty: (t.querySelector('.rcard-empty') || {}).textContent, items: t.querySelectorAll('.rcard-auto li').length, ta: !!t.querySelector('textarea'), q: t.querySelector('.rcard-q').textContent }; });
        rec(size, 'c8 특별 수업 기록이 없는 옛 진행: 안내 문구 + 쓰는 칸은 그대로', o.empty === '이번 진행에는 특별 수업 기록이 없어요.' && o.items === 0 && o.ta && o.q === story.card.topics[2].q, JSON.stringify(o));
        noErr(size, 'c8', q);
        await close(q);
      }
    }
  }
} finally { await browser.close(); server.close(); }
console.log('\n항목 표'); for (const t of table) console.log(t.join(' | '));
console.log(`\n통과 ${pass} · 실패 ${fails.length}`);
process.exitCode = fails.length ? 1 : 0;
