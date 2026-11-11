// 2026-11-12 외부 검토 반영 확인(브라우저): node privacy/tests/review-1112-browser.mjs  (PLAYWRIGHT_PATH = playwright 모듈 경로)
//   a 주의 화면: Tab·Shift+Tab이 창 안에 머문다, 초점이 밖에 있어도 Tab이 안으로 데려온다, Enter로 시작(검토 7번)
//   b 시작 안내 문장이 실제 입력 칸(이름·성찰 카드)과 맞다, 기록 지우기 = 진행·결과·카드 + 이 게임에서 적은 이름(검토 6번)
//   c 지우기 실패: "지우지 못했어요" 안내, 이 화면에서는 지워진 상태(검토 2번)
//   d '모두 보기'를 누른 직후 '다음'은 잠깐(0.8초) 못 누른다 · 한 줄씩 넘겼으면 바로 누를 수 있다 · 못 누르는 동안에도 비치지 않는다
//   ONLY=a,b,c,d · 브라우저 검사는 한 번에 하나(D:/Works/.browser-test.lock은 실행하는 쪽에서 잡는다)
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;
const ONLY = (process.env.ONLY || 'a,b,c,d').split(',');
const PROGRESS = 'ethicity.privacy.progress.v2', SETTINGS = 'ethicity.privacy.settings.v1', CARD = 'ethicity.privacy.card.v1', RESULT = 'ethicity.result.privacy';

// 그 장면(선택 전)에 선 상태
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

// seed = { settings, progress(run), card, result } — 공통 플레이어 정보는 넣지 않는다(이름 칸이 보이게)
async function open(seed, dev = { viewport: { width: 1280, height: 800 } }) {
  const ctx = await browser.newContext(dev), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    for (const k in s) localStorage.setItem(k, s[k]);
  }, seed);
  await page.goto(base); await page.waitForTimeout(500);
  page.errors = errors; page.ctx = ctx;
  return page;
}
const settings = (o) => JSON.stringify(Object.assign({ speed: 'instant', reduceMotion: true, look: 'f', sound: false, soundSet: true }, o));
const progress = (run) => JSON.stringify({ v: 1, run, explored: {}, endingsSeen: [] });
const inWarning = (p) => p.evaluate(() => document.getElementById('warning').contains(document.activeElement));

try {
  if (ONLY.includes('a')) {
    console.log('a 주의 화면');
    const p = await open({ [SETTINGS]: settings({}) });
    await p.click('#btn-new'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => !document.getElementById('warning').hidden), '새로 시작 → 주의 화면');
    ok(await inWarning(p), '처음 초점이 주의 화면 안(확인 버튼)');
    let stay = true;
    for (const k of ['Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Tab']) { await p.keyboard.press(k); stay = stay && await inWarning(p); }
    ok(stay, 'Tab·Shift+Tab을 눌러도 초점이 주의 화면 안에 머묾');
    await p.evaluate(() => document.activeElement.blur());
    ok(!(await inWarning(p)), '(준비) 초점을 창 밖으로 뺌');
    await p.keyboard.press('Tab');
    ok(await inWarning(p), '초점이 밖에 있어도 Tab이 주의 화면 안으로 데려옴');
    ok(await p.evaluate(() => !document.getElementById('warning').hidden), '뒤 화면 버튼이 눌리지 않아 주의 화면이 그대로');
    await p.keyboard.press('Enter'); await p.waitForTimeout(900);
    const after = await p.evaluate(() => ({ hidden: document.getElementById('warning').hidden, view: document.body.getAttribute('data-view') }));
    ok(after.hidden && after.view !== 'v-start', 'Enter(확인했어요) → 주의 화면이 닫히고 게임 시작', after);
    ok(p.errors.length === 0, 'a 오류 없음', p.errors);
    await p.ctx.close();
  }

  if (ONLY.includes('b')) {
    console.log('b 시작 안내 · 기록 지우기');
    const run = makeRun('c1_e1_a');
    const p = await open({ [SETTINGS]: settings({ nickname: '테스트이름' }), [PROGRESS]: progress(run), [CARD]: JSON.stringify({ v: 1, ending: 'A', sig: 'x', sid: '20315', name: '김온유', answers: ['가', '나', '다'] }) });
    const facts = await p.evaluate(() => document.querySelector('.facts').textContent);
    ok(!/실제 개인정보를 입력하는 곳은 없어요/.test(facts) && /성찰 카드의 학번·이름/.test(facts) && /이 기기에만 저장/.test(facts) && /이 게임 기록 지우기/.test(facts), '시작 안내: 실제로 적는 곳(이름·성찰 카드)과 지우는 방법을 말함', facts.slice(0, 200));
    ok(await p.evaluate(() => document.getElementById('name-input').value) === '테스트이름', '(준비) 시작 화면 이름 칸에 저장된 이름');
    await p.click('#btn-continue'); await p.waitForTimeout(900);
    await p.click('#btn-menu'); await p.waitForTimeout(200);
    await p.click('#btn-menu-wipe'); await p.waitForTimeout(200);
    ok(/시작 화면에서 적은 이름/.test(await p.evaluate(() => document.getElementById('confirm').textContent)), '지우기 확인 창이 이름도 지운다고 알려 줌');
    await p.click('#confirm-yes'); await p.waitForTimeout(500);
    const st = await p.evaluate(([P, S, C, R]) => ({ view: document.body.getAttribute('data-view'), name: document.getElementById('name-input').value, nick: (JSON.parse(localStorage.getItem(S) || '{}')).nickname, look: (JSON.parse(localStorage.getItem(S) || '{}')).look,
      progress: localStorage.getItem(P), card: localStorage.getItem(C), result: localStorage.getItem(R), cont: document.getElementById('btn-continue').hidden, notice: document.getElementById('notice').textContent }), [PROGRESS, SETTINGS, CARD, RESULT]);
    ok(st.view === 'v-start' && st.cont, '지운 뒤 시작 화면, 이어 하기 없음', st);
    ok(st.name === '' && st.nick === '', '이 게임에서 적은 이름이 지워짐(칸·저장 모두)', st);
    ok(st.look === 'f', '주인공 모습 같은 설정은 남음', st.look);
    ok(st.progress === null && st.card === null && st.result === null, '진행·성찰 카드·결과가 저장소에서 지워짐', st);
    ok(!/지우지 못했어요/.test(st.notice), '정상일 때는 지우기 실패 안내가 없음', st.notice);
    ok(p.errors.length === 0, 'b 오류 없음', p.errors);
    await p.ctx.close();
  }

  if (ONLY.includes('c')) {
    console.log('c 지우기 실패');
    const run = makeRun('c1_e1_a');
    const p = await open({ [SETTINGS]: settings({}), [PROGRESS]: progress(run) });
    await p.click('#btn-continue'); await p.waitForTimeout(900);
    await p.evaluate(() => { Storage.prototype.removeItem = function () { throw new Error('denied'); }; });
    await p.click('#btn-menu'); await p.waitForTimeout(200);
    await p.click('#btn-menu-wipe'); await p.waitForTimeout(200);
    await p.click('#confirm-yes'); await p.waitForTimeout(500);
    const st = await p.evaluate((P) => ({ view: document.body.getAttribute('data-view'), cont: document.getElementById('btn-continue').hidden, disk: localStorage.getItem(P) !== null, notice: document.getElementById('notice').textContent, shown: !document.getElementById('notice').hidden }), PROGRESS);
    ok(st.disk, '(준비) 저장소에는 진행이 그대로 남음(지우기 실패)');
    ok(st.shown && /지우지 못했어요/.test(st.notice) && /기기에는 남아 있을 수 있어요/.test(st.notice), '지우지 못했다는 안내가 보임', st.notice);
    ok(st.view === 'v-start' && st.cont, '이 화면에서는 지워진 상태(이어 하기 없음)', st);
    ok(p.errors.length === 0, 'c 오류 없음', p.errors);
    await p.ctx.close();
  }

  if (ONLY.includes('d')) {
    console.log("d '모두 보기' 뒤 잠깐 멈춤");
    const run = makeRun('c1_e1_a');
    const seed = { [SETTINGS]: settings({ speed: 'normal', reduceMotion: false }), [PROGRESS]: progress(run) };
    const toChoices = async (p) => { for (let k = 0; k < 80; k++) { if (await p.evaluate(() => document.querySelectorAll('#g-dock .choice').length > 0)) return true; await p.evaluate(() => { const b = document.querySelector('.skip-btn'); if (b) b.click(); }); await p.waitForTimeout(100); } return false; };
    const nextState = (p) => p.evaluate(() => { const b = document.getElementById('btn-next'); if (!b) return null; const c = getComputedStyle(b); return { disabled: b.disabled, opacity: c.opacity, bg: c.backgroundColor }; });
    { // 모두 보기 → 다음
      const p = await open(seed);
      await p.click('#btn-continue'); await p.waitForTimeout(600);
      ok(await toChoices(p), '(준비) 선택지까지');
      const scene0 = await p.evaluate(() => PrivacyApp.state().scene);
      await p.evaluate(() => document.querySelector('#g-dock .choice').click());
      let skip = false; for (let k = 0; k < 60 && !skip; k++) { await p.waitForTimeout(100); skip = await p.evaluate(() => !!document.querySelector('#g-next .skip-btn, #g-dock .skip-btn')); }
      ok(skip, "반응 글자가 나오는 중 '모두 보기'");
      const sk = await p.evaluate(() => { const b = document.querySelector('.skip-btn'), c = getComputedStyle(b); return { bg: c.backgroundColor, op: c.opacity }; });
      ok(sk.bg !== 'rgba(0, 0, 0, 0)' && sk.op === '1', "'모두 보기' 버튼이 불투명", sk);
      await p.evaluate(() => document.querySelector('.skip-btn').click());
      const n0 = await nextState(p);
      ok(n0 && n0.disabled === true, "'모두 보기' 직후 '다음'은 못 누름", n0);
      ok(n0 && n0.opacity === '1' && n0.bg !== 'rgba(0, 0, 0, 0)', "못 누르는 '다음'도 비치지 않음(불투명)", n0);
      await p.evaluate(() => document.getElementById('btn-next').click()); await p.waitForTimeout(150);
      ok(await p.evaluate((s) => !!document.getElementById('btn-next') && PrivacyApp.state().scene === s, scene0), '멈춘 동안 눌러도 넘어가지 않음');
      await p.waitForTimeout(900);
      const n1 = await nextState(p);
      ok(n1 && n1.disabled === false, "0.8초 뒤 '다음'을 누를 수 있음", n1);
      ok(await p.evaluate(() => document.activeElement && document.activeElement.id === 'btn-next'), "풀린 '다음'에 초점(Enter로 넘길 수 있음)");
      await p.evaluate(() => document.getElementById('btn-next').click()); await p.waitForTimeout(500);
      ok(await p.evaluate((s) => PrivacyApp.state().scene !== s || !document.getElementById('btn-next'), scene0), "누르면 다음으로 넘어감");
      ok(p.errors.length === 0, 'd-1 오류 없음', p.errors);
      await p.ctx.close();
    }
    { // 한 줄씩 넘김 → 다음은 바로
      const p = await open(seed);
      await p.click('#btn-continue'); await p.waitForTimeout(600);
      await toChoices(p);
      await p.waitForTimeout(900); // 앞에서 누른 '모두 보기'의 멈춤이 지나가게
      await p.evaluate(() => document.querySelector('#g-dock .choice').click());
      let st = null;
      for (let k = 0; k < 200 && !st; k++) { await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('Space'); await p.waitForTimeout(120); st = await nextState(p); }
      ok(st && st.disabled === false, "한 줄씩(Space) 넘겨 끝까지 읽으면 '다음'을 바로 누를 수 있음", st);
      ok(p.errors.length === 0, 'd-2 오류 없음', p.errors);
      await p.ctx.close();
    }
  }
} catch (e) { fails.push('검사 예외: ' + e.message.split('\n')[0]); console.log('  ✗ 검사 예외: ' + e.message.split('\n')[0]); }
finally { await browser.close(); server.close(); }
console.log(`\nreview-1112-browser: 통과 ${pass} · 실패 ${fails.length}`);
process.exitCode = fails.length ? 1 : 0;
