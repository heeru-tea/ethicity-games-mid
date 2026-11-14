// 2026-11-13 로컬 검토 2건(브라우저): node privacy/tests/review-1113-browser.mjs  (PLAYWRIGHT_PATH = playwright 모듈 경로)
//   i [P1] 저장이 막힌 동안 「이 게임 기록 지우기」 → 저장소가 되살아난 뒤 지운 기록이 다시 나타나면 안 된다
//     실패 방식: all(읽기·쓰기·지우기 모두) · write(쓰기만) · remove(지우기만) · write+remove
//     되살아나는 계기: 같은 탭(주인공 다시 고르기 = 설정 쓰기 / 창 초점 이벤트만) · 되살아난 뒤 바로 새로 고침
//     안내: all = "확인하지 못했어요" · remove = "지우지 못했어요" · write = 안내 없음(실제로 지워짐) · all → 읽기만 되살아남 = 그때 "지우지 못했어요"
//   j [P2] 메뉴 → 「이 게임 기록 지우기」·「처음부터 다시 하기」 → 확인 창 취소(버튼·Escape) → 메뉴가 다시 열리고 그 항목에 초점(BODY 아님)
//     → Escape 한 번 더 = 메뉴 닫힘, 메뉴 버튼으로 · 확인 창 안 Tab 가둠 · 확인은 그대로 동작 · 이어서 묻는 확인 창(성찰 카드)도 취소하면 같은 자리로
//     1280×800 · 390×844
//   ONLY=i,j · 브라우저 검사는 한 번에 하나(D:/Works/.browser-test.lock은 실행하는 쪽에서 잡는다)
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;
const ONLY = (process.env.ONLY || 'i,j').split(',');
const PROGRESS = 'ethicity.privacy.progress.v2', SETTINGS = 'ethicity.privacy.settings.v1', CARD = 'ethicity.privacy.card.v1', RESULT = 'ethicity.result.privacy', PLAYER = 'ethicity.player', OTHER = 'ethicity.result.data';

function makeRun(target) {
  let a = 7; const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let tries = 0; tries < 40000; tries++) {
    let s = E.createState(story);
    for (let step = 0; step < 500 && s.screen !== 'ending'; step++) {
      if (s.screen === 'scene' && s.scene === target && !s.reaction) { s.history = s.history.slice(-1); return s; }
      if (s.screen === 'scene' && E.needsChoice(story, s)) { const cs = E.visibleChoices(story, story.scenes[s.scene], s); s = E.choose(story, s, cs[Math.floor(rnd() * cs.length)].id); s.history = []; }
      s = E.advance(story, s);
    }
  }
  throw new Error('경로 없음: ' + target);
}

const server = await startServer(0), base = `http://127.0.0.1:${server.address().port}/privacy/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let pass = 0; const fails = [];
const ok = (c, m, extra) => { if (c) pass++; else { fails.push(m); console.log('  ✗ ' + m + (extra === undefined ? '' : ' :: ' + JSON.stringify(extra))); } return !!c; };

// review-1112b-browser.mjs와 같은 가짜 실패(localStorage에만). 'remove'(지우기만 실패) 추가. 검사는 진짜 저장소를 rawGet으로 읽는다
async function open(seed, fail = null, dev = { viewport: { width: 1280, height: 800 } }) {
  const ctx = await browser.newContext(dev), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(([s, f]) => {
    const SP = Storage.prototype, get = SP.getItem, set = SP.setItem, del = SP.removeItem;
    window.rawGet = (k) => get.call(localStorage, k);
    if (!sessionStorage.getItem('seeded')) { set.call(sessionStorage, 'seeded', '1'); localStorage.clear(); for (const k in s) set.call(localStorage, k, s[k]); if (f) set.call(sessionStorage, 'fail', f); }
    window.failMode = sessionStorage.getItem('fail') || 'off';
    const mine = (x) => x === localStorage, m = () => window.failMode;
    SP.setItem = function (k, v) { if (mine(this) && /^(write|all|write\+remove)$/.test(m())) throw new DOMException('quota', 'QuotaExceededError'); return set.call(this, k, v); };
    SP.getItem = function (k) { if (mine(this) && m() === 'all') throw new DOMException('denied', 'SecurityError'); return get.call(this, k); };
    SP.removeItem = function (k) { if (mine(this) && /^(all|write\+remove|remove)$/.test(m())) throw new DOMException('denied', 'SecurityError'); return del.call(this, k); };
    window.setFail = (x) => { window.failMode = x; set.call(sessionStorage, 'fail', x); };
  }, [seed, fail]);
  await page.goto(base); await page.waitForTimeout(500);
  page.errors = errors; page.ctx = ctx;
  return page;
}
const settings = (o) => JSON.stringify(Object.assign({ speed: 'instant', reduceMotion: true, look: 'f', sound: false, soundSet: true }, o));
const progress = (run) => JSON.stringify({ v: 1, run, explored: {}, endingsSeen: [] });
const card = JSON.stringify({ v: 1, ending: 'A', sig: 'x', sid: '00000', name: '검사용 가상 이름', answers: ['가상 답변 하나', '가상 답변 둘', ''] });
const player = JSON.stringify({ nickname: '', character: '' });
const disk = (p) => p.evaluate((ks) => Object.fromEntries(ks.map((k) => [k, window.rawGet(k)])), [PROGRESS, SETTINGS, CARD, RESULT, PLAYER, OTHER]);
const screen = (p) => p.evaluate(() => ({ view: document.body.getAttribute('data-view'), cont: document.getElementById('btn-continue').hidden, name: document.getElementById('name-input').value,
  notice: document.getElementById('notice').hidden ? '' : document.getElementById('notice').textContent, cardLink: [...document.querySelectorAll('#v-start a, #v-start button')].filter((b) => /성찰 카드/.test(b.textContent) && b.getClientRects().length).length }));
const tabRead = (p) => p.evaluate(() => { const S = window.PrivacyStorage; return { card: S.readJSON(S.KEYS.card).value, progress: S.readJSON(S.KEYS.progress).value, result: S.readJSON(S.KEYS.result).value, status: Object.assign({}, S.status) }; });
const wipe = async (p) => { await p.click('#btn-menu'); await p.waitForTimeout(200); await p.click('#btn-menu-wipe'); await p.waitForTimeout(200); await p.click('#confirm-yes'); await p.waitForTimeout(500); };
const seedAll = (run) => ({ [SETTINGS]: settings({ nickname: '검사용 별명' }), [PROGRESS]: progress(run), [CARD]: card, [RESULT]: JSON.stringify({ game: 'privacy', completed: true, ending: 'A', card: '검사용 결과' }), [PLAYER]: player, [OTHER]: '{"game":"data"}' });
const cleanDisk = (d) => d[CARD] === null && d[PROGRESS] === null && d[RESULT] === null && (d[SETTINGS] === null || !JSON.parse(d[SETTINGS]).nickname);
const NOTICE = { all: /확인하지 못했어요/, remove: /지우지 못했어요/, 'write+remove': /지우지 못했어요/, write: null };

try {
  const run = makeRun('c1_e1_a');

  if (ONLY.includes('i')) {
    for (const mode of ['all', 'write', 'remove', 'write+remove']) {
      for (const how of ['look', 'focus', 'reload']) {
        const tag = `i ${mode}/${how}`;
        console.log(tag);
        const p = await open(seedAll(run));
        await p.click('#btn-continue'); await p.waitForTimeout(900);
        await p.evaluate((m) => { window.failMode = m; }, mode);
        await wipe(p);
        const s1 = await screen(p), t1 = await tabRead(p), d1 = await disk(p);
        ok(s1.view === 'v-start' && s1.cont && s1.name === '', tag + ' 막힌 동안: 시작 화면 · 이어 하기 없음 · 이름 칸 빔', s1);
        ok(t1.card === null && t1.progress === null && t1.result === null, tag + ' 막힌 동안 이 탭은 지운 것으로 읽음', t1);
        if (NOTICE[mode]) ok(NOTICE[mode].test(s1.notice), tag + ' 안내: ' + NOTICE[mode], s1.notice);
        else ok(!/지우지 못했어요|확인하지 못했어요/.test(s1.notice), tag + ' 쓰기만 실패: 실제로 지워졌으니 지우기 안내 없음', s1.notice);
        if (mode === 'all') ok(!/지우지 못했어요/.test(s1.notice) && t1.status.readable === false && t1.status.removeFailed === false, tag + " 통째로 막힘: '지우지 못했다'고 단정하지 않음", [s1.notice, t1.status]);
        if (mode === 'write') ok(cleanDisk(d1), tag + ' 쓰기만 실패: 저장소에서 실제로 지워짐', d1);
        else ok(d1[CARD] === card, tag + ' (확인) 막힌 동안 저장소에는 아직 남아 있음 — 다시 해 볼 대상', d1[CARD]);
        // 되살아남
        await p.evaluate(() => window.setFail('off'));
        if (how === 'look') { await p.click('.hero-card[data-look="m"]'); await p.waitForTimeout(300); }
        else if (how === 'focus') { await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.waitForTimeout(200); }
        else { await p.reload(); await p.waitForTimeout(600); }
        const d2 = await disk(p), t2 = await tabRead(p), s2 = await screen(p);
        ok(cleanDisk(d2), tag + ' 되살아난 뒤: 저장소에서 성찰 카드·진행·결과·옛 이름이 지워짐', d2);
        ok(t2.card === null && t2.progress === null && t2.result === null, tag + ' 되살아난 뒤: 옛 이름·학번·답을 다시 읽지 않음', t2.card);
        ok(!t2.status.removeFailed && !t2.status.writeFailed && t2.status.readable, tag + ' 되살아난 뒤 표시가 모두 풀림', t2.status);
        ok(s2.cont && s2.name === '' && s2.cardLink === 0, tag + ' 화면: 이어 하기·이름·성찰 카드 링크가 되살아나지 않음', s2);
        ok(d2[PLAYER] === player && d2[OTHER] === '{"game":"data"}', tag + ' 공통 플레이어 정보·다른 게임 기록은 그대로', [d2[PLAYER], d2[OTHER]]);
        if (how !== 'reload') { // 되살아난 뒤 새로 고쳐도
          await p.reload(); await p.waitForTimeout(600);
          const s3 = await screen(p), d3 = await disk(p);
          ok(s3.cont && s3.name === '' && s3.cardLink === 0 && cleanDisk(d3), tag + ' 되살아난 뒤 새로 고쳐도 되살아나지 않음', [s3, d3[CARD]]);
        }
        ok(p.errors.length === 0, tag + ' 오류 없음', p.errors);
        await p.ctx.close();
      }
    }
    // 통째로 막힘 → 읽기만 되살아남(지우기는 아직 안 됨): 창 초점에서 다시 해 보고 이제는 "지우지 못했어요"라고 알린다 → 다 되살아나면 마저 지움
    console.log('i all → 읽기만 되살아남');
    const p = await open(seedAll(run));
    await p.click('#btn-continue'); await p.waitForTimeout(900);
    await p.evaluate(() => { window.failMode = 'all'; });
    await wipe(p);
    ok(/확인하지 못했어요/.test((await screen(p)).notice), 'i 부분 복구 (준비) 통째로 막힘 안내');
    await p.evaluate(() => { document.querySelector('#notice button').click(); window.failMode = 'write+remove'; window.dispatchEvent(new Event('focus')); });
    await p.waitForTimeout(200);
    const s4 = await screen(p), t4 = await tabRead(p);
    ok(/지우지 못했어요/.test(s4.notice) && t4.status.removeFailed && t4.status.readable, 'i 부분 복구: 읽히는데 못 지운 것이 확인되면 그때 "지우지 못했어요"', [s4.notice, t4.status]);
    ok(t4.card === null, 'i 부분 복구: 이 탭은 계속 지운 것으로 읽음');
    await p.evaluate(() => { window.failMode = 'off'; document.dispatchEvent(new Event('visibilitychange')); });
    await p.waitForTimeout(200);
    const d5 = await disk(p), t5 = await tabRead(p);
    ok(cleanDisk(d5) && !t5.status.removeFailed, 'i 다 되살아나면(보임 이벤트) 마저 지움', d5);
    ok(p.errors.length === 0, 'i 부분 복구 오류 없음', p.errors);
    await p.ctx.close();
  }

  if (ONLY.includes('j')) {
    for (const [size, dev] of [['1280x800', { viewport: { width: 1280, height: 800 } }], ['390x844', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]]) {
      const focusInfo = () => p.evaluate(() => {
        const a = document.activeElement, r = a.getBoundingClientRect();
        return { id: a.id || '', tag: a.tagName, menuOpen: !document.getElementById('menu').hidden, confirmOpen: !document.getElementById('confirm').hidden,
          shown: a.getClientRects().length > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth, ring: a.matches(':focus-visible') };
      });
      let p = await open({ [SETTINGS]: settings({ speed: 'fast' }), [PROGRESS]: progress(run), [PLAYER]: player }, null, dev);
      await p.click('#btn-continue'); await p.waitForTimeout(900);
      for (const item of ['btn-menu-wipe', 'btn-menu-restart']) {
        for (const how of ['button', 'Escape', 'click']) {
          const tag = `j ${size} ${item} → 취소(${how})`;
          // 키보드로 메뉴 → 항목(how=click은 마우스로 메뉴·항목·취소를 누름)
          if (how === 'click') { await p.click('#btn-menu'); await p.waitForTimeout(150); await p.click('#' + item); }
          else { await p.focus('#btn-menu'); await p.keyboard.press('Enter'); await p.waitForTimeout(150); await p.focus('#' + item); await p.keyboard.press('Enter'); }
          await p.waitForTimeout(150);
          let f = await focusInfo();
          ok(f.confirmOpen && !f.menuOpen && f.id === 'confirm-no', tag + ' (준비) 확인 창이 열리고 취소에 초점, 메뉴는 숨음', f);
          let stay = true; for (const k of ['Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) { await p.keyboard.press(k); stay = stay && (await focusInfo()).id.startsWith('confirm-'); }
          ok(stay, tag + ' 확인 창 안에서 Tab·Shift+Tab이 갇힘');
          if (how === 'Escape') await p.keyboard.press('Escape');
          else if (how === 'click') await p.click('#confirm-no');
          else { await p.focus('#confirm-no'); await p.keyboard.press('Enter'); }
          await p.waitForTimeout(150);
          f = await focusInfo();
          ok(!f.confirmOpen && f.menuOpen && f.id === item && f.shown && f.tag !== 'BODY', tag + ' → 메뉴가 다시 열리고 그 항목에 초점(보이는 자리, BODY 아님)', f);
          if (how !== 'click') ok(f.ring, tag + ' 키보드로 왔으면 초점 테두리(:focus-visible)', f);
          // 메뉴 안 Tab 가둠은 그대로
          let inMenu = true; for (const k of ['Tab', 'Tab', 'Shift+Tab']) { await p.keyboard.press(k); inMenu = inMenu && await p.evaluate(() => document.getElementById('menu').contains(document.activeElement)); }
          ok(inMenu, tag + ' 다시 열린 메뉴에서도 Tab이 메뉴 안에 머묾');
          await p.keyboard.press('Escape'); await p.waitForTimeout(150);
          f = await focusInfo();
          ok(!f.menuOpen && f.id === 'btn-menu' && f.shown, tag + ' → Escape 한 번 더 = 메뉴 닫힘, 초점은 메뉴 버튼', f);
        }
      }
      // 확인은 그대로: 처음부터 다시 하기 → 처음부터 → 게임이 다시 시작, 초점이 BODY가 아님
      await p.focus('#btn-menu'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
      await p.focus('#btn-menu-restart'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
      await p.focus('#confirm-yes'); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
      let f = await focusInfo(); const view = await p.evaluate(() => document.body.getAttribute('data-view'));
      ok(!f.menuOpen && !f.confirmOpen && view !== 'v-start' && f.tag !== 'BODY', `j ${size} 처음부터 다시 하기 확인 → 게임 시작, 메뉴 닫힘, 초점 BODY 아님`, [view, f]);
      // 확인은 그대로: 기록 지우기 → 지우기 → 시작 화면, 저장소 비움
      await p.click('#btn-menu'); await p.waitForTimeout(150); await p.click('#btn-menu-wipe'); await p.waitForTimeout(150); await p.click('#confirm-yes'); await p.waitForTimeout(500);
      f = await focusInfo(); const d = await disk(p);
      ok(!f.menuOpen && !f.confirmOpen && (await screen(p)).view === 'v-start' && f.tag !== 'BODY' && d[PROGRESS] === null, `j ${size} 기록 지우기 확인 → 시작 화면, 진행 지워짐, 초점 BODY 아님`, [f, d[PROGRESS]]);
      ok(p.errors.length === 0, `j ${size} 오류 없음`, p.errors);
      await p.ctx.close();

      // 이어서 묻는 확인 창(성찰 카드에 쓴 글이 있을 때): 메뉴 → 처음부터 다시 하기 → 처음부터 → "성찰 카드도 지울까요?" 취소 → 메뉴 · 처음부터 다시 하기에 초점
      p = await open({ [SETTINGS]: settings({ speed: 'fast' }), [PROGRESS]: progress(run), [CARD]: card, [PLAYER]: player }, null, dev);
      await p.click('#btn-continue'); await p.waitForTimeout(900);
      for (const how of ['button', 'Escape']) {
        const tag = `j ${size} 처음부터 → 성찰 카드 확인 → 취소(${how})`;
        await p.focus('#btn-menu'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
        await p.focus('#btn-menu-restart'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
        await p.focus('#confirm-yes'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
        const title = await p.evaluate(() => !document.getElementById('confirm').hidden && document.getElementById('confirm-title').textContent);
        ok(!!title && !/처음부터 다시 할까요/.test(title), tag + ' (준비) 두 번째 확인 창(성찰 카드)', title);
        if (how === 'Escape') await p.keyboard.press('Escape'); else { await p.focus('#confirm-no'); await p.keyboard.press('Enter'); }
        await p.waitForTimeout(150);
        f = await focusInfo();
        ok(!f.confirmOpen && f.menuOpen && f.id === 'btn-menu-restart' && f.shown, tag + ' → 메뉴가 다시 열리고 처음부터 다시 하기에 초점', f);
        ok(await p.evaluate(() => !!JSON.parse(window.rawGet('ethicity.privacy.card.v1') || 'null')), tag + ' 취소했으니 성찰 카드는 그대로');
        await p.keyboard.press('Escape'); await p.waitForTimeout(150);
      }
      ok(p.errors.length === 0, `j ${size} 이어지는 확인 창 오류 없음`, p.errors);
      // 시작 화면 「처음부터」(진행 중) → 처음부터 → 성찰 카드 확인 취소 → 초점은 시작 화면의 「처음부터」 버튼(숨은 '확인' 버튼이 아니라)
      await p.click('#btn-menu'); await p.waitForTimeout(150); await p.click('#btn-menu-home'); await p.waitForTimeout(400);
      await p.focus('#btn-new'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
      await p.focus('#confirm-yes'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
      await p.keyboard.press('Escape'); await p.waitForTimeout(150);
      f = await focusInfo();
      ok(!f.confirmOpen && f.id === 'btn-new' && f.shown, `j ${size} 시작 화면 처음부터 → 성찰 카드 확인 취소 → 처음부터 버튼으로`, f);
      ok(p.errors.length === 0, `j ${size} 시작 화면 오류 없음`, p.errors);
      await p.ctx.close();
    }
  }
} catch (e) { fails.push('검사 예외: ' + e.message.split('\n')[0]); console.log('  ✗ 검사 예외: ' + e.message.split('\n')[0]); }
finally { await browser.close(); server.close(); }
console.log(`\nreview-1113-browser: 통과 ${pass} · 실패 ${fails.length}`);
process.exitCode = fails.length ? 1 : 0;
