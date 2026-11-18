// 2026-11-13 장 카드 재구성(교사 피드백: "중간 활동 보고서처럼 읽힌다 — 완료 안내 → 짧은 회고 → 다음 장 버튼") 브라우저 검사
//   node privacy/tests/chapter-card-1113.mjs   (PLAYWRIGHT_PATH = playwright 모듈 경로, 기본 token_economy · ONLY=a,b,c · 스크린샷 tests/_shot-1113-chapter-*.png)
//   a 장 카드 넷(1→특별 수업, 특별 수업→2, 2→3, 3→에필로그) × 1280×800 · 390×844:
//     윗줄 '{끝낸 장} 완료' · 제목 = 끝낸 장 제목 · 이번 장에서 달라진 것 = 사건마다 첫 결과 문장(특별 수업 뒤 = 우리 반이 정한 안) ·
//     '다음은 …' · 예고(이야기에 없으면 초안을 넣어 가장 긴 경우로) · 버튼 글자와 스크롤 없이 보임 · 자세히는 닫힌 채 → 열면 사건 카드·흐름·믿음,
//     열어도 누른 줄이 제자리 · 가로 넘침 없음 · 맨 위에서 시작 · 제목에 초점 · 무대 어둡게
//   b 첫 화면 버튼 보임: 1148×977 · 780×360(낮은 가로 화면) · 360×640(덤: 키 작은 휴대폰) — 장 카드 넷 + 맨 처음 카드(프롤로그 뒤)
//   c 맨 처음 카드 구성 · 예고가 없으면 예고 줄 자체가 없음(자리 표시 글 없음)
//   경로는 장마다 '요약 줄이 가장 긴' 무작위 경로(가장 빡빡한 경우). 브라우저 검사는 한 번에 하나(D:/Works/.browser-test.lock은 실행하는 쪽에서)
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js'), EM = require('../js/emph.js');
story.triggers = WORLD.triggers;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ONLY = (process.env.ONLY || 'a,b,c').split(',');
const shot = (n) => path.join(HERE, `_shot-1113-chapter-${n}.png`);
const DEV = {
  d: { name: '1280x800', dev: { viewport: { width: 1280, height: 800 } } },
  w: { name: '1148x977', dev: { viewport: { width: 1148, height: 977 } } },
  m: { name: '390x844', dev: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  l: { name: '780x360', dev: { viewport: { width: 780, height: 360 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  s: { name: '360x640', dev: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } } }; // s = 덤(키 작은 휴대폰)
// 예고 초안(이야기에 teaser가 아직 없을 때 화면 높이 검사용으로만 넣는다 — 리드가 story.js에 넣을 문장의 초안)
const DRAFT = {
  1: '축제까지 나흘. 단톡방이 하루 종일 울리는 사이, 첫 선택이 바로 와요.',
  sc: '5교시 정보 시간은 평소엔 못 들어가는 AI 실습실에서. 교실에 AI CCTV를 달지, 우리 반 의견을 내가 정리하게 돼요.',
  2: '축제 전날 저녁, 매점 앞에서 하늘이가 휴대폰을 내밀어요. 새봄이 얼굴이 나오는 영상이 벌써 다른 반까지 돌고 있대요.',
  3: '드디어 축제 당일. 부스 뒤 천막 그늘에서 하늘이가 ‘민준이 친구 만들어 주자’며 장난을 꺼내요. 다들 나를 봐요.',
  4: '축제가 끝나고 맞은 월요일. 선생님이 축제 준비 때 있었던 일을 다 같이 꺼내 보자고 해요.' };

const stageName = (n) => (n === 0 ? '프롤로그' : n === 'sc' ? '특별 수업' : n === 4 ? '에필로그' : n + '장');
// 사건마다 첫 결과 문장 + recap 표시 결과(2026-11-18 플레이테스트 P2: 사진을 올린 경로는 '28명에게 퍼졌다'도)
const firstLines = (s, ch) => story.chapters[ch].events.flatMap((e) => { const o = E.eventOutcomes(story, e, s), out = o[0] ? [o[0]] : []; story.events[e].outcomes.forEach((x) => { if (x.recap && E.evalCond(x.if, s) && !out.includes(x.text)) out.push(x.text); }); return out; }).map((t) => EM.plain(t));
// 장 카드에 선 상태: 무작위 경로 1,500개 중 그 카드의 요약(첫 결과 문장·특별 수업 안)이 가장 긴 것
function cardRuns() {
  let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const best = {};
  const size = (s) => (s.chapter === 'sc' ? E.specialClassRows(story, s).map((r) => r.text).join('').length : s.chapter === 0 ? 0 : firstLines(s, s.chapter).join('').length);
  for (let t = 0; t < 1500; t++) {
    let s = E.createState(story);
    for (let step = 0; step < 700 && s.screen !== 'ending'; step++) {
      if (s.screen === 'chapter') { const k = String(s.nextChapter), v = size(s); if (!best[k] || v > best[k].v) best[k] = { v, s: Object.assign(E.clone(s), { history: s.history.slice(-1) }) }; }
      if (s.screen === 'scene' && E.needsChoice(story, s)) { const cs = E.visibleChoices(story, story.scenes[s.scene], s); s = E.choose(story, s, cs[Math.floor(rnd() * cs.length)].id); s.history = s.history.slice(-1); }
      s = E.advance(story, s);
    }
  }
  return best;
}
const RUNS = cardRuns();
const CARDS = ['sc', '2', '3', '4'].map((k) => ({ key: k, run: RUNS[k].s, prev: RUNS[k].s.chapter, next: RUNS[k].s.nextChapter }));
const FIRST = { key: '1', run: RUNS['1'].s, prev: 0, next: 1 };

const server = await startServer(0), base = `http://127.0.0.1:${server.address().port}/privacy/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗ ' + m); } return !!c; };

// teaser: true = 이야기에 없으면 초안을 넣음 / false = 그대로
async function open(card, dev, teaser = true) {
  const ctx = await browser.newContext(dev), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((p) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1'); localStorage.clear();
    localStorage.setItem('ethicity.player', '{"character":"char_03","nickname":"반짝이는 고래"}');
    localStorage.setItem('ethicity.privacy.settings.v1', '{"speed":"instant","reduceMotion":true,"look":"f","helpFold":true,"helpPlaces":["a","b","c"]}');
    localStorage.setItem('ethicity.privacy.progress.v2', p);
  }, JSON.stringify({ v: 1, run: card.run, explored: {}, endingsSeen: [] }));
  await page.goto(base); await page.waitForTimeout(300);
  if (teaser) await page.evaluate((d) => { Object.keys(d).forEach((k) => { const c = PRIVACY_STORY.chapters[k]; if (c && !c.teaser) c.teaser = d[k]; }); }, DRAFT);
  await page.click('#btn-continue'); await page.waitForTimeout(700);
  page.errors = errors; page.ctx = ctx;
  return page;
}
// 지금 장 카드의 모양
const look = (p) => p.evaluate(() => {
  const $ = (id) => document.getElementById(id), card = document.querySelector('#v-chapter .chapter-card'), cr = card.getBoundingClientRect();
  const go = $('btn-chapter-go'), gr = go.getBoundingClientRect(), more = $('c-more'), sm = more.querySelector('summary');
  // 카드 안 스크롤 상자에서 잘리지 않고(테두리 3px 안쪽) 창 안에도 다 들어옴
  const vis = (r) => r.width > 0 && r.height > 0 && r.top >= cr.top + 2 && r.bottom <= Math.min(cr.bottom - 2, innerHeight) + 0.5 && r.left >= 0 && r.right <= innerWidth + 1;
  return {
    view: document.body.getAttribute('data-view'), eyebrow: $('c-eyebrow').textContent, title: $('c-title').textContent,
    label: (document.querySelector('#c-summary .c-label') || {}).textContent || '',
    recap: [...document.querySelectorAll('#c-summary .c-recap li')].map((li) => li.textContent),
    strong: document.querySelectorAll('#c-summary strong.em').length,
    plan: [...document.querySelectorAll('#c-summary .c-plan .class-row')].map((r) => r.querySelector('dt').textContent + '=' + r.querySelector('dd').textContent),
    intro: (document.querySelector('#c-summary .c-intro') || {}).textContent || '',
    nextLine: (document.querySelector('#c-next .c-next-line') || {}).textContent || '', teasers: [...document.querySelectorAll('#c-next .c-teaser')].map((t) => t.textContent),
    btn: go.textContent, btnVis: vis(gr), btnRect: [Math.round(gr.top), Math.round(gr.bottom), Math.round(cr.bottom), innerHeight],
    moreHidden: more.hidden, moreOpen: more.open, summaryText: sm.textContent, summaryVis: vis(sm.getBoundingClientRect()),
    scroll: { win: Math.round(scrollY), card: Math.round(card.scrollTop) },
    hOverflow: document.documentElement.scrollWidth > innerWidth || card.scrollWidth > card.clientWidth + 1,
    focus: document.activeElement && document.activeElement.id, dim: $('stage').classList.contains('dim') && !$('stage').hidden,
    detailShown: $('c-detail').checkVisibility(), // 닫힌 details 안은 content-visibility로 건너뜀(크기를 물으면 강제로 재므로 높이로는 못 봄)
    labelledby: $('v-chapter').getAttribute('aria-labelledby') };
});

try {
  if (ONLY.includes('a')) for (const key of ['d', 'm']) {
    const { name, dev } = DEV[key];
    console.log('── a ' + name);
    for (const c of CARDS) {
      const tag = `${name} ${stageName(c.prev)}→${stageName(c.next)}`;
      const p = await open(c, dev);
      const L = await look(p);
      ok(L.view === 'v-chapter', `${tag} 장 카드가 열림 (${L.view})`);
      ok(L.eyebrow === stageName(c.prev) + ' 완료', `${tag} 윗줄 = '${stageName(c.prev)} 완료' (${L.eyebrow})`);
      ok(L.title === story.chapters[c.prev].title, `${tag} 제목 = 끝낸 장 제목 (${L.title})`);
      if (c.prev === 'sc') {
        const want = E.specialClassRows(story, c.run).map((r) => r.label + '=' + r.text);
        ok(L.label === '우리 반이 정한 AI CCTV 안' && want.length >= 1 && JSON.stringify(L.plan) === JSON.stringify(want), `${tag} 달라진 것 = 우리 반이 정한 안 ${JSON.stringify(L.plan)}`);
      } else {
        const want = firstLines(c.run, c.prev);
        ok(L.label === '이번 장에서 달라진 것', `${tag} 소제목 '이번 장에서 달라진 것' (${L.label})`);
        ok(want.length >= 3 && JSON.stringify(L.recap) === JSON.stringify(want), `${tag} 요약 = 사건마다 첫 결과 문장(+recap) ${JSON.stringify(L.recap)}`);
        ok(L.strong <= 2, `${tag} 요약 강조 2개 이하 (${L.strong})`);
      }
      const nch = story.chapters[c.next];
      ok(L.nextLine === '다음은 ' + stageName(c.next) + (c.next === 4 ? ' · ' + nch.sub : ' · ' + nch.title), `${tag} 다음 줄 (${L.nextLine})`);
      ok(JSON.stringify(L.teasers) === JSON.stringify([nch.teaser || DRAFT[c.next]]), `${tag} 예고 한 줄 ${JSON.stringify(L.teasers)}`);
      ok(L.btn === (c.next === 4 ? '에필로그 보기 →' : stageName(c.next) + ' 시작하기 →'), `${tag} 버튼 글자 (${L.btn})`);
      ok(L.btnVis && L.scroll.win === 0 && L.scroll.card === 0, `${tag} 버튼이 스크롤 없이 보임 ${JSON.stringify([L.btnRect, L.scroll])}`);
      ok(!L.moreHidden && !L.moreOpen && L.summaryText === '내 선택 자세히 보기' && !L.detailShown, `${tag} 「내 선택 자세히 보기」 닫힌 채 시작 ${JSON.stringify([L.moreHidden, L.moreOpen, L.detailShown])}`);
      ok(!L.hOverflow, `${tag} 가로 넘침 없음`);
      ok(L.focus === 'c-title' && L.dim && L.labelledby === 'c-eyebrow c-title', `${tag} 제목에 초점 · 무대 어둡게 · 이름 = 윗줄+제목 ${JSON.stringify([L.focus, L.dim, L.labelledby])}`);
      if (c.key === 'sc') await p.screenshot({ path: shot(`sc-${name}`) });
      if (c.key === '2' && key === 'm') await p.screenshot({ path: shot(`ch2-${name}`) });
      // 자세히 열기: 누른 줄이 제자리(위로 밀리지 않음), 카드 스크롤 그대로, 안에 사건 카드·흐름·믿음
      const before = await p.evaluate(() => { const s = document.querySelector('#c-more > summary'); s.scrollIntoView({ block: 'nearest' }); return Math.round(s.getBoundingClientRect().top); });
      const sc0 = await p.evaluate(() => Math.round(document.querySelector('#v-chapter .chapter-card').scrollTop));
      await p.evaluate(() => document.querySelector('#c-more > summary').click()); await p.waitForTimeout(250);
      const O = await p.evaluate(() => {
        const card = document.querySelector('#v-chapter .chapter-card'), d = document.getElementById('c-detail');
        const shown = (q) => [...d.querySelectorAll(q)].filter((n) => n.getBoundingClientRect().height > 0).length;
        return { open: document.getElementById('c-more').open, top: Math.round(document.querySelector('#c-more > summary').getBoundingClientRect().top), cardScroll: Math.round(card.scrollTop),
          events: shown('.event-card'), eventLines: d.querySelectorAll('.event-card li').length, topics: d.querySelectorAll('.event-card .event-topic').length,
          stats: shown('.stat-list'), trust: shown('.trust-list li'), plan: shown('.class-plan'), planRows: d.querySelectorAll('.class-plan .class-row').length, qs: d.querySelectorAll('.class-plan .class-q').length,
          scrollable: card.scrollHeight > card.clientHeight, hOverflow: document.documentElement.scrollWidth > innerWidth || card.scrollWidth > card.clientWidth + 1 };
      });
      ok(O.open && Math.abs(O.top - before) <= 1 && O.cardScroll === sc0, `${tag} 자세히를 열어도 누른 줄이 제자리 ${JSON.stringify([before, O.top, sc0, O.cardScroll])}`);
      if (c.prev === 'sc') ok(O.plan === 1 && O.planRows === E.specialClassRows(story, c.run).length && O.qs >= 1, `${tag} 자세히 = 우리 반이 정한 안 전체 + 선생님 질문 ${JSON.stringify(O)}`);
      else {
        const all = story.chapters[c.prev].events.reduce((n, e) => n + E.eventOutcomes(story, e, c.run).length, 0);
        ok(O.events === 3 && O.topics === 3 && O.eventLines === all, `${tag} 자세히 = 사건 카드 3(주제·모든 결과 문장 ${all}) ${JSON.stringify(O)}`);
        ok(O.stats === 1 && O.trust === 4, `${tag} 자세히 = 이번 장의 흐름 + 친구들의 믿음 4명 ${JSON.stringify([O.stats, O.trust])}`);
      }
      ok(!O.hOverflow, `${tag} 연 뒤에도 가로 넘침 없음`);
      if (c.key === 'sc' && key === 'm') {
        await p.screenshot({ path: shot(`sc-open-${name}`) });
        await p.evaluate(() => { const c = document.querySelector('#v-chapter .chapter-card'); c.scrollTop = c.scrollHeight; }); await p.waitForTimeout(150);
        await p.screenshot({ path: shot(`sc-open-end-${name}`) });
      }
      ok(p.errors.length === 0, `${tag} 페이지 오류 ${p.errors.join(' | ')}`);
      await p.ctx.close();
    }
  }
  if (ONLY.includes('b')) for (const key of ['w', 'l', 's']) {
    const { name, dev } = DEV[key];
    console.log('── b ' + name);
    for (const c of [FIRST, ...CARDS]) {
      const tag = `${name} ${stageName(c.prev)}→${stageName(c.next)}`;
      const p = await open(c, dev);
      const L = await look(p);
      ok(L.view === 'v-chapter' && L.btnVis && L.scroll.win === 0 && L.scroll.card === 0, `${tag} 버튼이 스크롤 없이 보임 ${JSON.stringify([L.btnRect, L.scroll])}`);
      ok(!L.hOverflow, `${tag} 가로 넘침 없음`);
      if (key === 'l' && (c.key === 'sc' || c.key === '1')) await p.screenshot({ path: shot(`${c.key === '1' ? 'first' : 'sc'}-${name}`) });
      if (key === 'l' && c.key === '3') await p.screenshot({ path: shot(`ch3-${name}`) });
      ok(p.errors.length === 0, `${tag} 페이지 오류 ${p.errors.join(' | ')}`);
      await p.ctx.close();
    }
  }
  if (ONLY.includes('c')) {
    const { name, dev } = DEV.d;
    console.log('── c ' + name);
    // 맨 처음 카드(프롤로그 뒤, 1장 앞)
    const p = await open(FIRST, dev, false);
    const L = await look(p);
    ok(L.eyebrow === '프롤로그 완료' && L.title === '학급 축제 ‘레트로 사진관’을 준비하는 나흘' && /단톡방, SNS, AI 도우미, 공용 컴퓨터/.test(L.intro), `처음 카드 = 프롤로그 완료 · 소개 ${JSON.stringify([L.eyebrow, L.title, L.intro])}`);
    ok(L.nextLine === '다음은 1장 · ' + story.chapters[1].title && L.btn === '1장 시작하기 →' && L.btnVis, `처음 카드 다음 줄·버튼 ${JSON.stringify([L.nextLine, L.btn, L.btnRect])}`);
    ok(L.moreHidden && L.recap.length === 0, `처음 카드엔 자세히·요약 없음`);
    await p.screenshot({ path: shot(`first-${name}`) });
    ok(JSON.stringify(L.teasers) === JSON.stringify(story.chapters[1].teaser ? [story.chapters[1].teaser] : []), `처음 카드 예고 = 이야기 그대로(없으면 줄 없음) ${JSON.stringify(L.teasers)}`);
    await p.click('#btn-chapter-go'); await p.waitForTimeout(800);
    ok((await p.evaluate(() => PrivacyApp.state().chapter)) === 1, '처음 카드 버튼 → 1장');
    ok(p.errors.length === 0, `c 처음 카드 페이지 오류 ${p.errors.join(' | ')}`);
    await p.ctx.close();
    // 예고가 이야기에 없으면 예고 줄 자체가 없다(자리 표시 글 없음)
    const c = CARDS[1], q = await open(c, dev, false), Q = await look(q);
    const t = story.chapters[c.next].teaser;
    ok(JSON.stringify(Q.teasers) === JSON.stringify(t ? [t] : []) && Q.btnVis, `${stageName(c.prev)}→${stageName(c.next)} 예고 = 이야기 그대로(없으면 줄 없음) ${JSON.stringify(Q.teasers)}`);
    // 버튼 동작은 그대로: 다음 장으로
    await q.click('#btn-chapter-go'); await q.waitForTimeout(800);
    ok((await q.evaluate(() => PrivacyApp.state().chapter)) === c.next, `버튼 → ${stageName(c.next)}`);
    ok(q.errors.length === 0, `c 페이지 오류 ${q.errors.join(' | ')}`);
    await q.ctx.close();
  }
} finally { await browser.close(); server.close(); }
console.log(`\n통과 ${pass} · 실패 ${fails.length}`);
if (fails.length) { fails.forEach((f) => console.log(' - ' + f)); process.exit(1); }
