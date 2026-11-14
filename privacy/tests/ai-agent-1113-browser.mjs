// 2026-11-13 사건 5 「AI 도우미 루미」 확장 — 브라우저 확인: node privacy/tests/ai-agent-1113-browser.mjs
//   a 에이전트 장면: 선택 4개 · 「이 선택으로 엔딩이 바뀌지는 않아요.」가 선택 상자 안에 보임 · 가로 넘침 없음 (1280×800 · 390×844)
//   b give → 루미가 볼 수 있는 것 4줄 → 설정 화면 '연결된 계정' → 정리하면 "비밀번호를 바꿨습니다"
//   c 안내문(all) → 지호(anon) → 에이전트, 클릭으로 이어짐
//   e 성찰 카드 둘째 주제: 제목·설명·질문·'루미에게 맡긴 것' 줄
//   f 선택 경로 돌아보기: 지호 고민 상담·AI 에이전트 제안에 '✓ 내 선택'
//   h 장 카드(2장 → 3장): 사건 5 요약 = 안내문 결과 줄
//   i 옛 저장: c2_e5_a에서 jiho를 고른 직후 저장 → 지호 장면으로 이어짐 → 계속 = 에이전트 장면 → '이전 선택' = 안내문 장면 / 엔딩 본 옛 진행의 성찰 카드 답 그대로
//   ONLY=a,b,c,e,f,h,i · SIZE=d,m · 스크린샷 tests/_shot-1113-agent-*.png · 브라우저 검사는 한 번에 하나(D:/Works/.browser-test.lock은 실행하는 쪽에서)
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), Card = require('../js/card.js'), routes = require('./routes.js');
story.triggers = require('../js/world.js').triggers;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ONLY = (process.env.ONLY || 'a,b,c,e,f,h,i').split(',');
const ALL_SIZES = { d: { name: '1280x800', dev: { viewport: { width: 1280, height: 800 } } },
  m: { name: '390x844', dev: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } } };
const SIZES = (process.env.SIZE || 'd,m').split(',').map((k) => ALL_SIZES[k]);
const shot = (n) => path.join(HERE, `_shot-1113-agent-${n}.png`);
const NOTE = '이 선택으로 엔딩이 바뀌지는 않아요.';

// 노드에서 이야기를 걸어 상태 만들기: prefs[장면] 우선, 없으면 첫 선택. stop(s)가 참이면 거기서(기록 그대로)
function walk(prefs, stop) {
  let s = E.createState(story);
  for (let k = 0; k < 900; k++) {
    if (stop && stop(s)) return s;
    if (s.screen === 'ending') return s;
    if (s.screen === 'scene' && E.needsChoice(story, s)) {
      const cs = E.visibleChoices(story, story.scenes[s.scene], s);
      s = E.choose(story, s, (cs.find((c) => c.id === prefs[s.scene]) || cs[0]).id);
    }
    s = E.advance(story, s);
  }
  throw new Error('못 감');
}
const BASE = Object.fromEntries(routes.A.map((p) => p.split('#')));
const atScene = (id) => (s) => s.screen === 'scene' && s.scene === id && !s.reaction;

const server = await startServer(0), base = `http://127.0.0.1:${server.address().port}/privacy/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗ ' + m); } return !!c; };

async function open(run, dev, { card = null, speed = 'instant' } = {}) {
  const ctx = await browser.newContext(dev);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(([p, c, sp]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('ethicity.player', '{"character":"char_03","nickname":"반짝이는 고래"}');
    localStorage.setItem('ethicity.privacy.settings.v1', JSON.stringify({ speed: sp, reduceMotion: true, look: 'f' }));
    localStorage.setItem('ethicity.privacy.progress.v2', p);
    if (c) localStorage.setItem('ethicity.privacy.card.v1', c);
  }, [JSON.stringify({ v: 1, run, explored: {}, endingsSeen: [] }), card ? JSON.stringify(card) : null, speed]);
  await page.goto(base);
  if (run.screen !== 'ending') await page.click('#btn-continue'); // 엔딩 본 진행은 시작 화면의 성찰 카드·선택 경로 링크로
  await page.waitForTimeout(900);
  page.errors = errors; page.ctx = ctx;
  return page;
}
const sceneOf = (p) => p.evaluate(() => { const s = PrivacyApp.state(); return s ? (s.screen === 'scene' ? s.scene + (s.reaction ? '#' + s.reaction : '') : s.screen + ':' + (s.mapTarget || s.nextChapter || s.ending || '')) : null; });
// 선택지가 뜨거나(want 장면) 장면이 바뀔 때까지 넘긴다: 대화창 → 다음 줄, 넘기기 버튼 → 누름
async function pump(p, until, max = 80) {
  for (let k = 0; k < max; k++) {
    const st = await sceneOf(p);
    if (until(st) && await p.evaluate(() => document.querySelectorAll('#g-dock .choice').length > 0 || !PrivacyApp.state() || PrivacyApp.state().screen !== 'scene')) return st;
    const did = await p.evaluate(() => {
      if (window.PrivacyTalk && PrivacyTalk.isOpen()) { PrivacyTalk.next(); return 'talk'; }
      if (document.querySelectorAll('#g-dock .choice').length) return 'choice';
      const b = [...document.querySelectorAll('#g-next button, #g-dock button')].filter((x) => !x.disabled && x.offsetParent !== null).pop();
      if (b) { b.click(); return 'btn'; }
      return 'none';
    });
    if (did === 'choice' && !until(st)) return st;
    await p.waitForTimeout(did === 'none' ? 250 : 120);
  }
  return sceneOf(p);
}
const choose = async (p, id) => { await p.click(`#g-dock .choice[data-choice="${id}"]`); await p.waitForTimeout(400); };
async function readUntil(p, re, max = 30) {
  for (let k = 0; k < max; k++) {
    const t = await phoneText(p);
    if (re.test(t)) return t;
    await p.evaluate(() => { if (window.PrivacyTalk && PrivacyTalk.isOpen()) { PrivacyTalk.next(); return; } const b = [...document.querySelectorAll('#g-next button')].find((x) => /모두 보기/.test(x.textContent) && !x.disabled); if (b) b.click(); });
    await p.waitForTimeout(200);
  }
  return phoneText(p);
}
const phoneText = (p) => p.evaluate(() => (document.getElementById('g-phone') || document.body).textContent);
const noHScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

try {
  for (const sz of SIZES) {
    if (ONLY.includes('a') || ONLY.includes('b')) {
      const p = await open(walk(BASE, atScene('c2_e5_agent')), sz.dev);
      await pump(p, (st) => st === 'c2_e5_agent');
      const info = await p.evaluate(() => {
        const n = document.getElementById('g-prompt-note'), dock = document.getElementById('g-dock');
        return { n: document.querySelectorAll('#g-dock .choice').length, note: n && n.textContent, inDock: !!(n && dock.contains(n)), vis: !!(n && n.checkVisibility()),
          desc: (document.querySelector('#g-dock .choices') || {}).getAttribute && document.querySelector('#g-dock .choices').getAttribute('aria-describedby') };
      });
      ok(info.n === 4, `${sz.name} a 선택 4개 (${info.n})`);
      ok(info.note === NOTE && info.inDock && info.vis && info.desc === 'g-prompt-note', `${sz.name} a 엔딩 영향 없음 안내가 선택 상자 안에 보임 ${JSON.stringify(info)}`);
      ok(await noHScroll(p), `${sz.name} a 가로 넘침 없음`);
      const txt = await phoneText(p);
      ok(/2만 원까지/.test(txt) && /내일 자정까지/.test(txt) && !/\[\[/.test(txt), `${sz.name} a 제한 권한 3줄 보임`);
      await p.screenshot({ path: shot(`agent-${sz.name}`) });
      if (ONLY.includes('b')) {
        await choose(p, 'give');
        const t2 = await readUntil(p, /결제 내역/);
        ok(['등록된 카드', '메일함', '메신저 연락처', '결제 내역'].every((w) => t2.indexOf(w) >= 0), `${sz.name} b give → 볼 수 있는 것 4줄`);
        await p.screenshot({ path: shot(`give-${sz.name}`) });
        const st = await pump(p, (x) => x === 'c2_e5_b');
        ok(st === 'c2_e5_b', `${sz.name} b 설정 화면으로 (${st})`);
        const t3 = await phoneText(p);
        ok(/연결된 계정/.test(t3) && /아이디·비밀번호로 로그인됨/.test(t3), `${sz.name} b 연결된 계정 줄`);
        const fix = await p.evaluate(() => [...document.querySelectorAll('#g-dock .choice')].map((b) => b.getAttribute('data-choice')).find((x) => x !== 'close'));
        await choose(p, fix);
        const t4 = await readUntil(p, /비밀번호를 바꿨습니다/);
        ok(/솔빛포털 비밀번호를 바꿨습니다/.test(t4), `${sz.name} b ${fix} → 비밀번호를 바꿨습니다`);
        ok((await p.evaluate(() => PrivacyApp.state().flags.e5link)) === 'cut', `${sz.name} b e5link=cut`);
      }
      ok(p.errors.length === 0, `${sz.name} a·b 오류 ${p.errors}`);
      await p.ctx.close();
    }
    if (ONLY.includes('c')) {
      const p = await open(walk(BASE, atScene('c2_e5_a')), sz.dev);
      await pump(p, (st) => st === 'c2_e5_a');
      await choose(p, 'all');
      let st = await pump(p, (x) => x === 'c2_e5_j');
      ok(st === 'c2_e5_j', `${sz.name} c 안내문 → 지호 (${st})`);
      await choose(p, 'anon');
      st = await pump(p, (x) => x === 'c2_e5_agent');
      ok(st === 'c2_e5_agent', `${sz.name} c 지호 → 에이전트 (${st})`);
      const s = await p.evaluate(() => PrivacyApp.state());
      ok(s.flags.e5 === 'all' && s.flags.e5j === 'anon', `${sz.name} c 플래그 e5=all·e5j=anon`);
      ok(p.errors.length === 0, `${sz.name} c 오류 ${p.errors}`);
      await p.ctx.close();
    }
  }
  // 엔딩 본 진행(가장 신중한 경로 + 에이전트 scoped)
  const endRun = walk({ ...BASE, c2_e5_agent: 'scoped' });
  if (ONLY.includes('e') || ONLY.includes('f')) for (const sz of SIZES) {
    const p = await open(endRun, sz.dev);
    if (ONLY.includes('e')) {
      await p.click('#btn-start-card'); await p.waitForTimeout(500);
      const c = await p.evaluate(() => {
        const sec = document.querySelector('.rcard-topic[data-topic="ai"]');
        return sec && { h: sec.querySelector('h2').textContent, ex: (sec.querySelector('.rcard-explain') || {}).textContent, q: sec.querySelector('.rcard-q').textContent,
          items: [...sec.querySelectorAll('.rcard-out')].map((x) => x.textContent) };
      });
      const t = story.card.topics[1];
      ok(c && c.h.indexOf(t.title) >= 0 && c.ex === t.explain && c.q === t.q, `${sz.name} e 카드 둘째 제목·설명·질문 ${JSON.stringify(c && [c.h, c.q])}`);
      ok(c && c.items.some((x) => /^루미에게 맡긴 것: 예약 1건과 2만 원까지 결제/.test(x)), `${sz.name} e 맡긴 것 줄`);
      ok(await noHScroll(p), `${sz.name} e 가로 넘침 없음`);
      await p.screenshot({ path: shot(`card-${sz.name}`), fullPage: true });
      await p.click('#btn-card-back'); await p.waitForTimeout(400);
    }
    if (ONLY.includes('f')) {
      await p.click('#btn-start-path'); await p.waitForTimeout(500);
      const f = await p.evaluate(() => [...document.querySelectorAll('.path-step')].map((x) => [x.querySelector('.path-q').textContent, [...x.querySelectorAll('li.mine .opt-text')].map((y) => y.textContent)]));
      const row = (re) => f.find(([q]) => re.test(q));
      ok(row(/^지호 고민 상담/) && row(/^지호 고민 상담/)[1].length === 1, `${sz.name} f 지호 고민 상담 내 선택 ${JSON.stringify(row(/^지호 고민 상담/))}`);
      ok(row(/^AI 에이전트 제안/) && /필요한 만큼만/.test(row(/^AI 에이전트 제안/)[1][0] || ''), `${sz.name} f 에이전트 내 선택 ${JSON.stringify(row(/^AI 에이전트 제안/))}`);
    }
    ok(p.errors.length === 0, `${sz.name} e·f 오류 ${p.errors}`);
    await p.ctx.close();
  }
  if (ONLY.includes('h')) {
    const sz = SIZES[0];
    const ch = walk({ ...BASE, c2_e5_a: 'all', c2_e5_j: 'anon' }, (s) => s.screen === 'chapter' && s.nextChapter === 3);
    const p = await open(ch, sz.dev);
    await p.waitForTimeout(400);
    const sum = await p.evaluate(() => (document.getElementById('c-summary') || {}).textContent || '');
    ok(/통째로 입력했다/.test(sum) && !/루미에게 맡긴 것/.test(sum), `h 장 카드 사건 5 요약 = 안내문 줄 (${sum.slice(0, 160)})`);
    ok(p.errors.length === 0, `h 오류 ${p.errors}`);
    await p.ctx.close();
  }
  if (ONLY.includes('i')) {
    const sz = SIZES[0];
    // ① 옛 흐름: c2_e5_a에서 jiho를 고른 직후(반응 중)에 저장된 진행
    const before = walk(BASE, atScene('c2_e5_a'));
    const snapA = E.clone(before); delete snapA.history;
    const old1 = Object.assign(E.clone(before), { reaction: 'jiho', flags: Object.assign({}, before.flags, { e5: 'jiho' }),
      history: before.history.concat([{ scene: 'c2_e5_a', choice: 'jiho', snap: snapA }]) });
    let p = await open(old1, sz.dev);
    let s = await p.evaluate(() => PrivacyApp.state());
    ok(s && s.scene === 'c2_e5_j' && s.reaction === 'jiho' && s.flags.e5j === 'jiho' && !('e5' in s.flags), `i 옛 저장 → 지호 장면 반응 ${s && s.scene} ${JSON.stringify(s && s.flags.e5j)}`);
    const st = await pump(p, (x) => x === 'c2_e5_agent');
    ok(st === 'c2_e5_agent', `i 계속 → 에이전트 장면 (${st})`);
    await p.click('#btn-undo'); await p.waitForTimeout(300); await p.click('#confirm-yes'); await p.waitForTimeout(600);
    s = await p.evaluate(() => PrivacyApp.state());
    ok(s.scene === 'c2_e5_a' && !s.reaction && !('e5' in s.flags) && !('e5j' in s.flags), `i 이전 선택 → 안내문 장면 처음 (${s.scene})`);
    ok(p.errors.length === 0, `i① 오류 ${p.errors}`);
    await p.ctx.close();
    // ② 엔딩 본 옛 진행 + 성찰 카드 답: 새 흐름으로 끝낸 진행을 옛 모양으로 되돌려 만든다(c2_e5_a#min·c2_e5_agent 기록 빼고 c2_e5_j → c2_e5_a, e5j → e5)
    const fin = walk({ ...BASE, c2_e5_j: 'jiho' });
    const toOld = (f) => { const g = Object.assign({}, f); if (g.e5j) { g.e5 = g.e5j; delete g.e5j; } delete g.e5agent; delete g.e5link; return g; };
    const oldFin = E.clone(fin);
    oldFin.flags = toOld(oldFin.flags);
    oldFin.history = oldFin.history.filter((h) => !(h.scene === 'c2_e5_a' || h.scene === 'c2_e5_agent'))
      .map((h) => Object.assign({}, h, { scene: h.scene === 'c2_e5_j' ? 'c2_e5_a' : h.scene, snap: Object.assign({}, h.snap, { flags: toOld(h.snap.flags) }) }));
    const answers = ['첫 칸 답', '둘째 칸 옛 답(옛 질문에 쓴 것)', '셋째 칸 답'];
    const raw = { v: 1, ending: oldFin.ending, sig: Card.sig(oldFin), sid: '20315', name: '김온유', answers };
    p = await open(oldFin, sz.dev, { card: raw });
    await p.click('#btn-start-card'); await p.waitForTimeout(500);
    const got = await p.evaluate(() => [...document.querySelectorAll('.rcard-input')].map((x) => x.value));
    ok(JSON.stringify(got) === JSON.stringify(answers), `i② 엔딩 본 옛 진행의 카드 답 그대로 ${JSON.stringify(got)}`);
    ok(p.errors.length === 0, `i② 오류 ${p.errors}`);
    await p.ctx.close();
  }
} finally {
  await browser.close(); server.close();
}
console.log(`\nai-agent-1113-browser: 통과 ${pass} · 실패 ${fails.length}`);
if (fails.length) { fails.forEach((f) => console.log(' - ' + f)); process.exit(1); }
