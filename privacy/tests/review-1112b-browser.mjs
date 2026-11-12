// 2026-11-12 추가 검토 2건(브라우저): node privacy/tests/review-1112b-browser.mjs  (PLAYWRIGHT_PATH = playwright 모듈 경로)
//   e 시작할 때부터 쓰기만 실패(용량 초과 — 읽기·지우기는 됨): 「이 게임 기록 지우기」가 저장소에서 진행·성찰 카드·결과·이름을 실제로 지운다,
//     '지우지 못했어요' 안내는 없다(지워졌으니), 저장이 되살아난 뒤 새로 열어도 이름·학번·답이 되살아나지 않는다, 공통 키는 그대로
//   f 저장소 접근이 통째로 거부: 화면의 기록은 지우고, "남은 기록이 있는지 확인하지 못했어요"라고 말한다('지웠다'·'지우지 못했다'고 단정하지 않는다)
//   g 플레이 도중 쓰기·지우기가 함께 실패: '지우지 못했어요' 안내, 저장이 되살아나면 밀린 지우기를 마친다
//   h 메뉴 초점: 세 속도 어느 것을 골라도 Tab·Shift+Tab이 메뉴 안에서 돈다, 방향키로 바꾼 뒤에도, 열면 지금 고른 속도에 초점, Escape·닫기 뒤 메뉴 버튼으로 복귀, 휴대폰 폭에서도
//   ONLY=e,f,g,h · 브라우저 검사는 한 번에 하나(D:/Works/.browser-test.lock은 실행하는 쪽에서 잡는다)
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;
const ONLY = (process.env.ONLY || 'e,f,g,h').split(',');
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

// seed = 저장소에 미리 넣을 값. fail = 'write'(setItem만 던짐) | 'all'(읽기·쓰기·지우기 모두) | null — localStorage에만 건다.
//   sessionStorage 'fail' 값으로 새로 열 때의 조건을 바꾼다(off = 정상). 검사는 진짜 저장소를 raw*로 읽는다(고친 함수가 아니라 원래 함수)
async function open(seed, fail = null, dev = { viewport: { width: 1280, height: 800 } }) {
  const ctx = await browser.newContext(dev), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(([s, f]) => {
    const SP = Storage.prototype, get = SP.getItem, set = SP.setItem, del = SP.removeItem;
    window.rawGet = (k) => get.call(localStorage, k);
    if (!sessionStorage.getItem('seeded')) { set.call(sessionStorage, 'seeded', '1'); localStorage.clear(); for (const k in s) set.call(localStorage, k, s[k]); if (f) set.call(sessionStorage, 'fail', f); }
    window.failMode = sessionStorage.getItem('fail') || 'off';
    const mine = (x) => x === localStorage;
    SP.setItem = function (k, v) { if (mine(this) && (window.failMode === 'write' || window.failMode === 'all' || window.failMode === 'write+remove')) throw new DOMException('quota', 'QuotaExceededError'); return set.call(this, k, v); };
    SP.getItem = function (k) { if (mine(this) && window.failMode === 'all') throw new DOMException('denied', 'SecurityError'); return get.call(this, k); };
    SP.removeItem = function (k) { if (mine(this) && (window.failMode === 'all' || window.failMode === 'write+remove')) throw new DOMException('denied', 'SecurityError'); return del.call(this, k); };
    window.setFail = (m) => { window.failMode = m; set.call(sessionStorage, 'fail', m); };
  }, [seed, fail]);
  await page.goto(base); await page.waitForTimeout(500);
  page.errors = errors; page.ctx = ctx;
  return page;
}
const settings = (o) => JSON.stringify(Object.assign({ speed: 'instant', reduceMotion: true, look: 'f', sound: false, soundSet: true }, o));
const progress = (run) => JSON.stringify({ v: 1, run, explored: {}, endingsSeen: [] });
const card = JSON.stringify({ v: 1, ending: 'A', sig: 'x', sid: '00000', name: '검사용 가상 이름', answers: ['가상 답변 하나', '가상 답변 둘', ''] });
const player = JSON.stringify({ nickname: '', character: '' }); // 비어 있는 공통 정보(손상 취급 — 이름 칸이 보인다). 값이 그대로 남는지만 본다
const disk = (p) => p.evaluate((ks) => Object.fromEntries(ks.map((k) => [k, window.rawGet(k)])), [PROGRESS, SETTINGS, CARD, RESULT, PLAYER, OTHER]);
const screen = (p) => p.evaluate(() => ({ view: document.body.getAttribute('data-view'), cont: document.getElementById('btn-continue').hidden, name: document.getElementById('name-input').value,
  notice: document.getElementById('notice').hidden ? '' : document.getElementById('notice').textContent, cardLink: [...document.querySelectorAll('#v-start a, #v-start button')].filter((b) => /성찰 카드/.test(b.textContent) && b.getClientRects().length).length }));
const wipe = async (p) => { await p.click('#btn-menu'); await p.waitForTimeout(200); await p.click('#btn-menu-wipe'); await p.waitForTimeout(200); await p.click('#confirm-yes'); await p.waitForTimeout(500); };
const seedAll = (run) => ({ [SETTINGS]: settings({ nickname: '검사용 별명' }), [PROGRESS]: progress(run), [CARD]: card, [RESULT]: JSON.stringify({ game: 'privacy', completed: true, ending: 'A', card: '검사용 결과' }), [PLAYER]: player, [OTHER]: '{"game":"data"}' });

try {
  const run = makeRun('c1_e1_a');

  if (ONLY.includes('e')) {
    console.log('e 시작할 때부터 쓰기만 실패');
    const p = await open(seedAll(run), 'write');
    const s0 = await screen(p), d0 = await disk(p);
    ok(d0[CARD] && d0[PROGRESS] && /검사용 별명/.test(d0[SETTINGS]), '(준비) 저장소에 가상 이름·학번·답·진행이 들어 있음');
    ok(/저장할 수 없어요/.test(s0.notice), '시작할 때 저장할 수 없다는 안내', s0.notice);
    ok(!s0.cont && s0.name === '검사용 별명', '쓰기가 안 돼도 옛 진행·이름은 읽는다(이어 하기 보임)', s0);
    await p.click('#btn-continue'); await p.waitForTimeout(900);
    await wipe(p);
    const s1 = await screen(p), d1 = await disk(p);
    ok(s1.view === 'v-start' && s1.cont && s1.name === '', '지운 뒤 시작 화면 · 이어 하기 없음 · 이름 칸 빔', s1);
    ok(d1[CARD] === null && d1[PROGRESS] === null && d1[RESULT] === null, '저장소에서 성찰 카드·진행·결과가 실제로 지워짐', d1);
    ok(d1[SETTINGS] === null, '이름이 든 옛 설정도 저장소에서 지워짐(새 설정을 못 쓰니 옛 것을 지운다)', d1[SETTINGS]);
    ok(!/지우지 못했어요/.test(s1.notice) && !/확인하지 못했어요/.test(s1.notice), '실제로 지워졌으니 지우기 실패 안내는 없음', s1.notice);
    ok(d1[PLAYER] === player && d1[OTHER] === '{"game":"data"}', '공통 플레이어 정보·다른 게임 기록은 그대로', [d1[PLAYER], d1[OTHER]]);
    // 쓰기가 여전히 안 되는 채 새로 열기
    await p.reload(); await p.waitForTimeout(500);
    const s2 = await screen(p);
    ok(s2.cont && s2.name === '' && s2.cardLink === 0, '새로 열어도(쓰기 실패 그대로) 이름·진행·성찰 카드가 되살아나지 않음', s2);
    // 저장이 되살아난 뒤 새로 열기
    await p.evaluate(() => window.setFail('off')); await p.reload(); await p.waitForTimeout(500);
    const s3 = await screen(p), d3 = await disk(p);
    ok(s3.cont && s3.name === '' && s3.cardLink === 0 && d3[CARD] === null && d3[PROGRESS] === null, '저장이 되살아난 뒤 새로 열어도 되살아나지 않음', [s3, d3[CARD]]);
    ok(!/저장할 수 없어요/.test(s3.notice), '정상 조건에서는 저장 불가 안내 없음', s3.notice);
    ok(p.errors.length === 0, 'e 오류 없음', p.errors);
    await p.ctx.close();

    console.log('e-2 쓰기 실패로 시작 → 같은 탭에서 저장이 되살아남');
    const q = await open(seedAll(run), 'write');
    await q.click('#btn-continue'); await q.waitForTimeout(900);
    await wipe(q);
    await q.evaluate(() => { window.failMode = 'off'; });
    await q.click('.hero-card[data-look="m"]'); await q.waitForTimeout(300); // 설정을 바꾸면 저장한다 — 같은 탭에서 다시 써져야 한다
    const d4 = await disk(q);
    ok(d4[SETTINGS] !== null && JSON.parse(d4[SETTINGS]).look === 'm' && !JSON.parse(d4[SETTINGS]).nickname, '저장이 되살아나면 같은 탭에서 다시 써진다(이름 없는 새 설정)', d4[SETTINGS]);
    ok(d4[CARD] === null && d4[PROGRESS] === null, '되살아난 뒤에도 지운 기록은 없다');
    ok(q.errors.length === 0, 'e-2 오류 없음', q.errors);
    await q.ctx.close();
  }

  if (ONLY.includes('f')) {
    console.log('f 저장소 접근이 통째로 거부');
    const p = await open(seedAll(run), 'all');
    const s0 = await screen(p);
    ok(/저장할 수 없어요/.test(s0.notice) && s0.cont, '읽을 수 없으니 이어 하기 없음 + 저장할 수 없다는 안내', s0);
    await p.click('.hero-card[data-look="f"]'); await p.fill('#name-input', '막힌탭이름'); await p.click('#btn-new'); await p.waitForTimeout(300);
    await p.click('#btn-warning-ok'); await p.waitForTimeout(1200);
    ok(await p.evaluate(() => document.body.getAttribute('data-view')) !== 'v-start', '(준비) 저장소가 막혀도 게임이 시작됨');
    await wipe(p);
    const s1 = await screen(p), d1 = await disk(p);
    ok(s1.view === 'v-start' && s1.cont && s1.name === '', '화면의 기록은 지워짐(시작 화면 · 이름 칸 빔)', s1);
    ok(/확인하지 못했어요/.test(s1.notice) && /이 화면의 기록은 지웠어요/.test(s1.notice), '기기에 남은 것이 있는지 확인하지 못했다고 말함', s1.notice);
    ok(!/지우지 못했어요/.test(s1.notice), "'지우지 못했다'고 단정하지 않음(알 수 없으니)", s1.notice);
    ok(d1[CARD] === card && d1[PLAYER] === player, '(확인) 실제 저장소는 건드릴 수 없었음 — 안내가 사실과 맞음');
    ok(p.errors.length === 0, 'f 오류 없음', p.errors);
    await p.ctx.close();
  }

  if (ONLY.includes('g')) {
    console.log('g 플레이 도중 쓰기·지우기 실패 → 되살아남');
    const p = await open(seedAll(run));
    await p.click('#btn-continue'); await p.waitForTimeout(900);
    await p.evaluate(() => { window.failMode = 'write+remove'; });
    await wipe(p);
    const s1 = await screen(p), d1 = await disk(p);
    ok(s1.view === 'v-start' && s1.cont && s1.name === '', '이 화면에서는 지워진 상태', s1);
    ok(/지우지 못했어요/.test(s1.notice) && /기기에는 남아 있을 수 있어요/.test(s1.notice), '지우지 못했다는 안내', s1.notice);
    ok(d1[CARD] === card && /검사용 별명/.test(d1[SETTINGS]), '(확인) 저장소에는 실제로 남아 있음 — 안내가 사실과 맞음');
    await p.evaluate(() => { window.failMode = 'off'; });
    await p.click('.hero-card[data-look="m"]'); await p.waitForTimeout(300);
    const d2 = await disk(p);
    ok(d2[CARD] === null && d2[PROGRESS] === null && d2[RESULT] === null && d2[SETTINGS] !== null && !JSON.parse(d2[SETTINGS]).nickname, '저장이 되살아나면 밀린 지우기를 마치고 이름 없는 설정을 쓴다', d2);
    ok(d2[PLAYER] === player && d2[OTHER] === '{"game":"data"}', '공통 플레이어 정보·다른 게임 기록은 그대로');
    await p.reload(); await p.waitForTimeout(500);
    const s3 = await screen(p);
    ok(s3.cont && s3.name === '' && s3.cardLink === 0, '새로 열어도 이름·학번·답이 되살아나지 않음', s3);
    ok(p.errors.length === 0, 'g 오류 없음', p.errors);
    await p.ctx.close();
  }

  if (ONLY.includes('h')) {
    for (const [size, dev] of [['1280x800', { viewport: { width: 1280, height: 800 } }], ['390x844', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]]) {
      console.log('h 메뉴 초점 ' + size);
      const p = await open({ [SETTINGS]: settings({ speed: 'fast' }), [PROGRESS]: progress(run) }, null, dev);
      await p.click('#btn-continue'); await p.waitForTimeout(900);
      const at = () => p.evaluate(() => { const a = document.activeElement; return { inMenu: document.getElementById('menu').contains(a), id: a.id || '', val: a.name === 'speed' ? a.value : '', tag: a.tagName }; });
      const picked = () => p.evaluate(() => document.querySelector('input[name=speed]:checked').value);
      await p.focus('#btn-menu'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
      let a = await at();
      ok(a.inMenu && a.val === 'fast', size + ' 메뉴를 열면 지금 고른 속도(빠르게)에 초점', a);
      for (const v of ['normal', 'fast', 'instant']) {
        await p.click(`input[name=speed][value=${v}]`); await p.waitForTimeout(80);
        await p.keyboard.press('Shift+Tab'); a = await at();
        ok(a.inMenu && a.id === 'btn-menu-close', `${size} ${v}에서 Shift+Tab → 메뉴 안(닫기 버튼)`, a);
        await p.keyboard.press('Tab'); a = await at();
        ok(a.inMenu && a.val === v, `${size} 닫기에서 Tab → 고른 속도(${v})로 돌아옴`, a);
        // 한 바퀴: 메뉴 안에서만 돌고 제자리로
        const stops = await p.evaluate(() => [...document.querySelectorAll('#menu button, #menu input')].filter((n) => !n.disabled && n.getClientRects().length && (n.type !== 'radio' || n.checked)).length);
        let inside = true;
        for (let i = 0; i < stops; i++) { await p.keyboard.press('Tab'); inside = inside && (await at()).inMenu; }
        a = await at();
        ok(inside && a.val === v, `${size} ${v}: Tab ${stops}번 = 메뉴 안에서 한 바퀴 돌아 제자리`, a);
        inside = true;
        for (let i = 0; i < stops; i++) { await p.keyboard.press('Shift+Tab'); inside = inside && (await at()).inMenu; }
        a = await at();
        ok(inside && a.val === v, `${size} ${v}: Shift+Tab ${stops}번도 메뉴 안에서 한 바퀴`, a);
      }
      // 방향키로 바꾼 뒤
      await p.click('input[name=speed][value=normal]'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(80);
      ok(await picked() === 'fast', size + ' (준비) 방향키로 빠르게 선택');
      await p.keyboard.press('Shift+Tab'); a = await at();
      ok(a.inMenu && a.id === 'btn-menu-close', size + ' 방향키로 바꾼 뒤 Shift+Tab → 메뉴 안', a);
      await p.keyboard.press('Tab'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(80);
      ok(await picked() === 'instant', size + ' (준비) 방향키로 한 번에 선택');
      await p.keyboard.press('Shift+Tab'); a = await at();
      ok(a.inMenu && a.id === 'btn-menu-close', size + ' 한 번에로 바꾼 뒤에도 Shift+Tab → 메뉴 안', a);
      // 숨은 줄(넓은 화면의 조이스틱 줄, 좁은 화면의 '조작 안내 다시 보기')은 Tab에 걸리지 않는다
      const hiddenFocusable = await p.evaluate(() => [...document.querySelectorAll('#menu button, #menu input')].filter((n) => !n.getClientRects().length).map((n) => n.id));
      console.log('    ' + size + ' 메뉴에서 숨은 조작 요소: ' + (hiddenFocusable.join(', ') || '없음'));
      // 메뉴를 내려 본 채 닫고 다시 열면 맨 위부터(2026-11-12 사용자 결정)
      await p.evaluate(() => { const s = document.querySelector('#menu .sheet'); s.scrollTop = s.scrollHeight; });
      // Escape → 메뉴 버튼으로
      await p.keyboard.press('Escape'); await p.waitForTimeout(150); a = await at();
      ok(await p.evaluate(() => document.getElementById('menu').hidden) && a.id === 'btn-menu', size + ' Escape → 메뉴 닫힘, 초점은 메뉴 버튼', a);
      // 다시 열어 닫기 버튼 → 메뉴 버튼으로
      await p.keyboard.press('Enter'); await p.waitForTimeout(200); a = await at();
      ok(a.inMenu && a.val === 'instant', size + ' 다시 열면 지금 고른 속도(한 번에)에 초점', a);
      const sc = await p.evaluate(() => { const s = document.querySelector('#menu .sheet'); return { top: s.scrollTop, scrolls: s.scrollHeight > s.clientHeight + 1, titleIn: document.getElementById('menu-title').getBoundingClientRect().top >= s.getBoundingClientRect().top - 1 }; });
      ok(sc.top === 0 && sc.titleIn, size + ' 내려 본 채 닫았다 다시 열면 맨 위부터(메뉴 제목이 보임)' + (sc.scrolls ? '' : ' — 이 크기는 스크롤이 안 생김'), sc);
      await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Enter'); await p.waitForTimeout(150); a = await at();
      ok(await p.evaluate(() => document.getElementById('menu').hidden) && a.id === 'btn-menu', size + ' 닫기 → 초점은 메뉴 버튼', a);
      // 확인 창(기존 초점 제한 유지)
      await p.keyboard.press('Enter'); await p.waitForTimeout(200); await p.click('#btn-menu-wipe'); await p.waitForTimeout(200);
      let stay = true; const inConfirm = () => p.evaluate(() => document.getElementById('confirm').contains(document.activeElement));
      for (const k of ['Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) { await p.keyboard.press(k); stay = stay && await inConfirm(); }
      ok(stay, size + ' 확인 창: Tab·Shift+Tab이 창 안에 머묾');
      await p.keyboard.press('Escape'); await p.waitForTimeout(150);
      ok(await p.evaluate(() => document.getElementById('confirm').hidden), size + ' 확인 창 Escape = 취소');
      ok(p.errors.length === 0, size + ' h 오류 없음', p.errors);
      await p.ctx.close();
    }
  }
} catch (e) { fails.push('검사 예외: ' + e.message.split('\n')[0]); console.log('  ✗ 검사 예외: ' + e.message.split('\n')[0]); }
finally { await browser.close(); server.close(); }
console.log(`\nreview-1112b-browser: 통과 ${pass} · 실패 ${fails.length}`);
process.exitCode = fails.length ? 1 : 0;
