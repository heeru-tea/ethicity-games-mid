// AI 프라이버시 반영(2026-11-10) 브라우저 검사: node privacy/tests/ai-privacy-browser.mjs
//   ONLY=a,b,c(기본 전부) · SIZE=d,m(기본 둘 다: 1280×800 · 390×844) · PLAYWRIGHT_MODULE(또는 PLAYWRIGHT_PATH)
//   a = 특별 수업 감지 화면 네 장(빨간 사각형·꼬리표·알림 카드, 그림 내리기, '한 번에', 되돌리기, 그림 없음)
//   b = 사건 4 가짜 춤 영상(휴대폰 틀·장면 넘김·움직임 줄이기·선택 전 내리기·그림 없음)
//   c = 성찰 카드(자동 채움·자동 저장·인쇄 제목·지우기와 확인 창·PDF 한 장)
//   스크린샷 tests/_shot-ai-*.png(gitignore). 브라우저 잠금(D:/Works/.browser-test.lock)은 실행하는 쪽에서 잡는다 — 한 번에 하나.
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
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
    /* @@B@@ */
    /* @@C@@ */
  }
} finally { await browser.close(); server.close(); }
console.log('\n항목 표'); for (const t of table) console.log(t.join(' | '));
console.log(`\n통과 ${pass} · 실패 ${fails.length}`);
process.exitCode = fails.length ? 1 : 0;
