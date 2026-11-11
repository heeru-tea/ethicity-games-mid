// AI 프라이버시 반영(2026-11-10) 검사 — 브라우저 없이: node privacy/tests/ai-privacy.mjs
//   B 사건 4 「AI가 만든 가짜 춤 영상」: id·set·add·next·조건이 그대로인지(엔딩·수치 불변), 휴대폰 틀 그림은 선택 전에 내리는지, 옛 '합성' 글자가 남지 않았는지
//   C 성찰 카드(js/card.js 순수 로직): 자동으로 채우는 선택, 파일 이름, 저장 읽기·섞임 방지, 지우기 전 확인 조건
//   (특별 수업 A는 tests/special-class.mjs)
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js'), EM = require('../js/emph.js');
story.triggers = WORLD.triggers;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗ ' + m); } };
const run = (name, fn) => { try { fn(); } catch (e) { fails.push(name + ': ' + e.message); console.log('  ✗ ' + name + ': ' + e.message); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameKeys = (a, b) => { const ka = Object.keys(a).sort(), kb = Object.keys(b).sort(); return same(ka, kb) && ka.every((k) => a[k] === b[k]); }; // 칸 순서와 무관
const hasCg = (l) => typeof l === 'object' && l !== null && Object.prototype.hasOwnProperty.call(l, 'cg');
const norm = (l) => E.normLine(l, story);

// 엔진으로 끝(엔딩)까지 또는 stop(state)이 참일 때까지. prefs = 장면별 선택 id(없으면 첫 선택 또는 rnd)
function play(prefs, stop, rnd) {
  let s = E.createState(story);
  for (let step = 0; step < 800; step++) {
    if (stop && stop(s)) return s;
    if (s.screen === 'ending') return s;
    if (s.screen === 'scene' && E.needsChoice(story, s)) {
      const cs = E.visibleChoices(story, story.scenes[s.scene], s);
      const c = cs.find((x) => x.id === prefs[s.scene]) || (rnd ? cs[Math.floor(rnd() * cs.length)] : cs[0]);
      s = E.choose(story, s, c.id);
    }
    s = E.advance(story, s);
  }
  throw new Error('끝까지 못 감');
}

/* ───────── B. 사건 4: AI가 만든 가짜 춤 영상 ───────── */
run('e4Structure', () => {
  // 글자만 바꿨다 — 선택 id·플래그·수치·다음 장면·조건은 2026-11-10 이전과 같아야 한다(엔딩·다른 사건의 참조가 그대로 맞게)
  const WANT = {
    c2_e4_a: [
      { id: 'forward', set: { e4: 'forward' }, add: { spread: 2, serious: 1 }, next: 'c2_e4_b' },
      { id: 'refuse', set: { e4: 'refuse' }, add: { minimize: 1 }, next: 'c2_e4_b' },
      { id: 'ignore', set: { e4: 'ignore' }, next: 'c2_e4_b' }],
    c2_e4_b: [
      { id: 'ask', set: { e4b: 'ask' }, add: { consent: 1, help: 1, 'trust.saebom': 1 }, next: 'c2_e5_a' },
      { id: 'report', set: { e4b: 'report' }, add: { repair: 1 }, next: 'c2_e5_a' },
      { id: 'confess', if: 'e4=forward', set: { e4b: 'confess' }, add: { repair: 2, 'trust.saebom': -1 }, next: 'c2_e5_a' },
      { id: 'blame', set: { e4b: 'blame' }, add: { 'trust.saebom': -2 }, next: 'c2_e5_a' }]
  };
  for (const [id, want] of Object.entries(WANT)) {
    const got = story.scenes[id].choices.map((c) => { const o = { id: c.id }; for (const k of ['if', 'set', 'add', 'addV2', 'next']) if (c[k] !== undefined) o[k] = c[k]; return o; });
    ok(same(got, want), id + ' 선택 구조 그대로 ' + JSON.stringify(got));
    ok(story.scenes[id].event === 'e4' && story.scenes[id].chapter === 2, id + ' 사건·장 그대로');
  }
  ok(same(story.events.e4.outcomes.map((o) => o.if), ['e4=forward', 'e4=refuse', 'e4=ignore', 'e4b=ask', 'e4b=report', 'e4b=confess', 'e4b=blame']), '사건 결과 조건·순서 그대로');
  ok(same(story.scenes.c2_e4_a.lines.filter((l) => typeof l === 'object' && l.if).map((l) => l.if), ['e3=capture && e2post=group|story', 'e3=capture && e2post!=group|story', 'e3!=capture && e2post=group|story']), 'c2_e4_a 조건부 줄 조건 그대로');
  ok(same(story.scenes.c2_e4_b.lines.filter((l) => typeof l === 'object' && l.if).map((l) => l.if), ['e4=forward']), 'c2_e4_b 조건부 줄 조건 그대로');
  ok(story.scenes.c2_e4_a.view.type === 'place' && /매점 앞 · D-1 오후 6:05/.test(story.scenes.c2_e4_a.view.title) && story.scenes.c2_e4_b.view.type === 'dm' && story.scenes.c2_e4_b.view.title === '새봄', '장소·시간·등장 방식 그대로');
  ok(same(story.seriousSplit[1].items.filter((i) => /e4/.test(i.if)), [{ if: 'e4=forward', ch: 2 }]) && /e4=forward/.test(E.COMPUTED['hurt.saebom']) && /e4=forward/.test(E.COMPUTED.harmed_others), '다른 곳의 e4 참조 그대로');
});

run('e4Clip', () => {
  const a = story.scenes.c2_e4_a, lines = a.lines.map(norm);
  const cgs = lines.filter(hasCg).map((l) => l.cg);
  ok(same(cgs, ['saebom-selfie', 'saebom-dance', null]), '휴대폰 틀: 셀카 → 춤 영상 → 내리기 ' + JSON.stringify(cgs));
  ok(!a.view.cg, '장면 첫 화면은 그림 없이(매점 앞 무대)');
  ok(lines.filter(hasCg).every((l) => !l.if), '그림 줄은 조건 없는 줄(어느 경로에서나 같은 순서)');
  const iDown = lines.findIndex((l) => hasCg(l) && l.cg === null), iLastUp = lines.map((l, i) => (hasCg(l) && l.cg ? i : -1)).reduce((m, v) => Math.max(m, v), -1);
  ok(iDown > iLastUp && iDown < lines.length - 1, '선택지가 뜨기 전에 영상을 내린다(내린 뒤에도 대사가 이어짐) ' + iLastUp + ' < ' + iDown + ' < ' + (lines.length - 1));
  const upLines = lines.slice(lines.findIndex((l) => l.cg === 'saebom-dance'), iDown);
  ok(upLines.length >= 2 && upLines.length <= 5, '영상은 대사 몇 줄 동안만 ' + upLines.length + '줄');
  // 모든 장면에서: 휴대폰 틀 그림(story.clips)을 띄웠다면 그 장면 대사 안에서 반드시 내린다(선택 반응 줄에는 휴대폰 틀 금지)
  for (const [id, sc] of Object.entries(story.scenes)) {
    let up = false;
    (sc.lines || []).map(norm).forEach((l) => { if (hasCg(l)) up = !!(l.cg && story.clips[l.cg]); });
    ok(!up, id + ': 휴대폰 틀 그림을 내리지 않고 장면 대사가 끝남');
    for (const c of sc.choices || []) ok(!(c.react || []).map(norm).some((l) => hasCg(l) && l.cg && story.clips[l.cg]), id + '#' + c.id + ': 선택 반응 줄에 휴대폰 틀 그림');
    ok(!(sc.view && story.clips[sc.view.cg]), id + ': 장면 첫 그림(view.cg)에 휴대폰 틀 금지');
  }
  // 그림 파일
  const webp = fs.readFileSync(path.join(ROOT, 'js/webp-list.js'), 'utf8');
  ok(same(Object.keys(story.clips), ['saebom-selfie', 'saebom-dance']) && story.clips['saebom-selfie'].frames.length === 1 && story.clips['saebom-dance'].frames.length === 3, '셀카 1장 · 춤 장면 3장');
  for (const [k, c] of Object.entries(story.clips)) {
    for (const f of c.frames) ok(fs.existsSync(path.join(ROOT, f)) && fs.existsSync(path.join(ROOT, f.replace(/\.png$/, '.webp'))) && webp.includes('"' + f + '"'), k + ' 그림(png·webp·목록) ' + f);
    ok(typeof c.alt === 'string' && c.alt.length > 30 && typeof c.who === 'string' && c.who.length > 2, k + ' 대체 글·계정 줄');
  }
  ok(story.clips['saebom-dance'].video === true && !story.clips['saebom-selfie'].video, '춤 영상에만 재생 표시');
  ok(!/AI|딥페이크|가짜/.test(story.clips['saebom-dance'].who), '영상 위 계정 줄에는 "AI로 만든 영상" 표시를 붙이지 않는다(이야기 속에서는 아무 표시 없이 돈다)');
  ok(/AI/.test(story.clips['saebom-dance'].alt) && /춘 적 없는/.test(story.clips['saebom-dance'].alt), '화면 읽기 대체 글은 AI로 만든 가짜임을 말한다');
  // 무대 말풍선 기준 줄(world.js STAGES.c2_e4_a.bubbles)이 여전히 대사에 있다
  const all = lines.map((l) => EM.plain(l.text)).concat(a.choices.flatMap((c) => (c.react || []).map((l) => EM.plain(norm(l).text))));
  for (const b of WORLD.STAGES.c2_e4_a.bubbles) ok(all.some((t) => t.includes(b.on)), '무대 말풍선 기준 줄 "' + b.on + '"');
  // 프로브(emphasis)가 쓰는 첫 강조 줄
  const firstEm = lines.find((l) => EM.has(l.text));
  ok(!!firstEm && firstEm.who === 'haneul' && EM.parts(firstEm.text).filter((p) => p.strong).map((p) => p.text).join() === '다른 반 애들도', 'c2_e4_a 첫 강조 줄 = 하늘 “다른 반 애들도”');
});

run('e4Ethics', () => {
  // 대사가 담아야 할 것(설계 5.3) — 문장 자체는 교사 검수 대상, 여기서는 빠지지 않았는지만
  const a = story.scenes.c2_e4_a, b = story.scenes.c2_e4_b;
  const la = a.lines.map(norm).map((l) => EM.plain(l.text)).join('\n'), lb = b.lines.map(norm).filter((l) => l.who === 'saebom').map((l) => EM.plain(l.text)).join('\n');
  ok(/사진 한 장/.test(la) && /춘 적이 없다/.test(la), '사진 한 장으로 만들어졌고, 새봄은 이런 춤을 춘 적이 없다');
  ok(/딥페이크/.test(la) && /AI/.test(la), '단순 합성이 아니라 AI 딥페이크임을 말한다');
  ok(/진짜/.test(lb) && /춘 적 없어/.test(lb), '진짜처럼 보여서 본 사람들이 실제로 춘 줄 안다(새봄의 말)');
  const refuse = a.choices.find((c) => c.id === 'refuse'), fwd = a.choices.find((c) => c.id === 'forward');
  ok(/공개/.test(refuse.say) && /AI/.test(refuse.say) && /잘못 아니야/.test(refuse.say), '공개로 올린 사진이라도 AI의 재료로 써도 된다는 뜻은 아니다');
  ok(fwd.react.map((l) => EM.plain(norm(l).text)).some((t) => /옮긴 건 나/.test(t)), '전달하면 퍼뜨린 사람이 된다');
  // 옛 '합성' 글자가 이야기·화면 글자에 남아 있지 않다
  const texts = [];
  const push = (t) => { if (typeof t === 'string') texts.push(t); };
  for (const sc of Object.values(story.scenes)) {
    (sc.lines || []).forEach((l) => push(norm(l).text)); push(sc.label); push(sc.prompt);
    (sc.choices || []).forEach((c) => { push(c.text); push(c.say); (c.react || []).forEach((l) => push(norm(l).text)); });
  }
  for (const ev of Object.values(story.events)) { push(ev.title); push(ev.topic); ev.outcomes.forEach((o) => push(o.text)); }
  story.reflection.basic.concat(story.reflection.deep).forEach(push);
  for (const arr of Object.values(WORLD.idle)) (Array.isArray(arr) ? arr : []).forEach((l) => push(l.text));
  push(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, ''));
  const old = texts.filter((t) => /합성/.test(t));
  ok(texts.length > 500 && old.length === 0, '화면 글자 ' + texts.length + '개에 옛 "합성" 표현 없음 ' + old.map((t) => t.slice(0, 30)).join(' / '));
  // 조롱·성적 표현 금지 낱말(새봄을 깎아내리는 말)이 사건 4 글자에 없다
  const e4 = [a, b].flatMap((sc) => (sc.lines || []).map((l) => norm(l).text).concat((sc.choices || []).flatMap((c) => [c.text, c.say || ''].concat((c.react || []).map((l) => norm(l).text)))));
  ok(!e4.some((t) => /섹시|야한|몸매|노출|못생|흑역사|쪽팔/.test(t)), '사건 4에 성적·조롱 낱말 없음');
});

run('endingsSame', () => {
  // 사건 4의 글자를 바꿔도 수치·엔딩은 그대로: 대표 선택 조합마다 2026-11-10 이전에 기록해 둔 값과 같은지
  const cases = [
    [{ c2_e4_a: 'forward', c2_e4_b: 'confess' }, { e4: 'forward', e4b: 'confess' }, { spread: 2, serious: 1, repair: 2 }, -1],
    [{ c2_e4_a: 'forward', c2_e4_b: 'blame' }, { e4: 'forward', e4b: 'blame' }, { spread: 2, serious: 1 }, -2],
    [{ c2_e4_a: 'refuse', c2_e4_b: 'ask' }, { e4: 'refuse', e4b: 'ask' }, { minimize: 1, consent: 1, help: 1 }, 1],
    [{ c2_e4_a: 'ignore', c2_e4_b: 'report' }, { e4: 'ignore', e4b: 'report' }, { repair: 1 }, 0]
  ];
  for (const [prefs, flags, delta, trust] of cases) {
    const before = play(prefs, (s) => s.screen === 'scene' && s.scene === 'c2_e4_a');
    const after = play(prefs, (s) => s.screen === 'scene' && s.scene === 'c2_e5_a');
    const d = {}; for (const k of E.STAT_KEYS) if (after.stats[k] !== before.stats[k]) d[k] = after.stats[k] - before.stats[k];
    ok(sameKeys(d, delta) && after.flags.e4 === flags.e4 && after.flags.e4b === flags.e4b && after.trust.saebom - before.trust.saebom === trust, JSON.stringify(prefs) + ' 수치 변화 ' + JSON.stringify(d) + ' 새봄 믿음 ' + (after.trust.saebom - before.trust.saebom));
  }
});

/* ───────── C. 성찰 카드(js/card.js 순수 로직 + story.card 문구) ───────── */
const Card = require('../js/card.js');
const ROUTES = require('./routes.js');
const prefsOf = (route) => Object.fromEntries(route.map((x) => x.split('#')));
const noSc = (s) => Object.assign({}, s, { flags: Object.fromEntries(Object.entries(s.flags).filter(([k]) => !/^ccx/.test(k))) });

run('cardTopics', () => {
  const T1 = ['e1', 'e2', 'e3', 'e6', 'e7', 'e8', 'e9'];
  for (const code of ['A', 'B', 'C', 'D']) {
    const s = play(prefsOf(ROUTES[code]));
    ok(s.ending === code, '대표 경로 ' + code + ' 도착');
    const t = Card.topics(story, E, s);
    ok(t.length === 3 && same(t.map((x) => x.id), ['share', 'ai', 'cctv']) && same(t.map((x) => x.n), [1, 2, 3]), code + ' 토픽 세 개');
    ok(t.every((x) => x.title && x.q && x.label), code + ' 토픽 이름·물음·자동 칸 이름');
    // ① 사건 1·2·3·6·7·8·9: 사건마다 결과 문장을 pick[사건]줄까지 — 더 많으면 앞의 것들 + 마지막 한 줄(2026-11-12 외부 검토 3번: 첫 줄만으로는 올리기·수습·거절이 빠졌다)
    const PICK = story.card.topics[0].pick, pickOf = (outs, n) => (outs.length <= n ? outs : outs.slice(0, n - 1).concat(outs.slice(-1)));
    const exp1 = T1.flatMap((e) => pickOf(E.eventOutcomes(story, e, s), PICK[e] || 1).map((x, k) => ({ head: k ? '' : story.events[e].title, text: EM.plain(x) })));
    ok(same(t[0].items.map((i) => i.head), exp1.map((i) => i.head)) && same(t[0].items.map((i) => i.text), exp1.map((i) => i.text)) && T1.every((e) => t[0].items.some((i) => i.head === story.events[e].title)), code + ' ① 일곱 사건: 첫 행동부터 마지막 대응까지 ' + t[0].items.length + '줄');
    // ② 사건 4·5 결과 문장 모두
    const want2 = ['e4', 'e5'].flatMap((e) => E.eventOutcomes(story, e, s).map((x, k) => ({ head: k === 0 ? story.events[e].title : '', text: EM.plain(x) })));
    ok(same(t[1].items, want2) && want2.length >= 2, code + ' ② 사건 4·5 결과 문장 ' + want2.length + '줄');
    ok(t[1].items[0].head === 'AI가 만든 가짜 춤 영상', code + ' ② 첫 줄 = 가짜 춤 영상');
    // ③ 우리 반이 정한 AI CCTV 안
    const rows = E.specialClassRows(story, s);
    ok(same(t[2].items, rows.map((r) => ({ head: r.label, text: r.text }))) && t[2].items.length === (s.flags.ccx === 'none' ? 1 : 4) && t[2].empty === '', code + ' ③ 우리 반 안 ' + t[2].items.length + '줄');
    ok(t[2].label === '우리 반이 정한 AI CCTV 안' && t[0].label === '내 선택', code + ' 자동 칸 이름');
    // 특별 수업을 하지 않은 옛 진행
    const o = Card.topics(story, E, noSc(s));
    ok(o[2].items.length === 0 && o[2].empty === '이번 진행에는 특별 수업 기록이 없어요.' && !!o[2].q && same(o[0].items, t[0].items), code + ' 옛 진행: ③ 자동 칸은 안내 문구, 쓰는 칸은 그대로');
  }
  // 옛 알림 범위 값이 든 저장: 그 줄만 —
  const s = play(prefsOf(ROUTES.A)); s.flags.ccxPurpose = 'guide';
  const t = Card.topics(story, E, s);
  ok(t[2].items.length === 4 && t[2].items[1].text === '—', '옛 알림 범위 값 → 그 줄만 —');
  // 무작위 600회: 깨지지 않고, 줄 수가 한 장에 들어갈 범위
  let seed = 20261110; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let max = [0, 0, 0], bad = 0, marks = 0, praise = 0, longest = 0;
  for (let i = 0; i < 600; i++) {
    const r = play({}, null, rnd);
    let tt; try { tt = Card.topics(story, E, r); } catch (e) { bad++; continue; }
    tt.forEach((x, k) => { max[k] = Math.max(max[k], x.items.length); x.items.forEach((it) => { if (/\[\[|\]\]/.test(it.text)) marks++; if (/잘했|훌륭|정답|칭찬|점수|등급/.test(it.text)) praise++; longest = Math.max(longest, it.text.length); }); });
    if (tt[0].items.length < 7 || tt[0].items.length > 17) bad++;
  }
  ok(bad === 0, '무작위 600회: 토픽 만들기 실패·① 줄 수 어긋남 0 (' + bad + ')');
  ok(max[0] >= 7 && max[0] <= 17 && max[1] <= 5 && max[2] <= 4, '자동 칸 줄 수 최대 ' + max.join('·') + '(① 7~17 · ② ≤5 · ③ ≤4)');
  ok(marks === 0 && praise === 0, '자동 칸 글자에 강조 기호·평가 낱말 없음');
  ok(longest <= 70, '자동 칸 한 줄 최대 ' + longest + '자(≤ 70 — 인쇄 한 장 계산의 바탕)');
});

run('cardText', () => {
  const c = story.card;
  ok(c.wipeAsk === '성찰 카드에 쓴 글이 지워져요. PDF로 저장했나요?', '새로 시작 전 확인 문구(설계 11.5)');
  ok(c.deviceNote === '이 카드는 이 기기에만 저장돼요. 제출은 PDF로 저장해서 선생님이 알려 준 곳에 올려요.', '이 기기에만 저장 안내(설계 7.4)');
  ok(c.pdfNote.startsWith('PDF 저장은 컴퓨터의 크롬·엣지에서 가장 잘 돼요'), 'PDF 안내(설계 11.1)');
  ok(c.fileBase === '공유한순간_성찰카드' && c.none === '작성 안 함', '파일 이름 머리·빈 칸 문구');
  ok(same(c.topics.map((t) => t.title), ['내가 공유한 순간', 'AI가 만든 것, AI에 넘긴 것', 'AI가 지켜보는 교실']), '토픽 이름 셋');
  ok(same(c.topics[0].events, ['e1', 'e2', 'e3', 'e6', 'e7', 'e8', 'e9']) && c.topics[0].pick && c.topics[0].pick.e2 === 3 && !c.topics[0].first && same(c.topics[1].events, ['e4', 'e5']) && c.topics[2].plan === true, '토픽이 묶는 사건');
  ok(c.topics.flatMap((t) => t.events || []).slice().sort().join() === Object.keys(story.events).sort().join(), '아홉 사건이 빠짐없이 한 번씩');
  const all = [c.title, c.heading, c.intro, c.autoLabel, c.none, c.deviceNote, c.pdfNote, c.needNote, c.wipeAsk].concat(c.topics.flatMap((t) => [t.title, t.q, t.empty || '', t.label || '']));
  ok(!all.some((t) => /잘했|훌륭|정답|점수|등급/.test(t)), '카드 문구에 평가 낱말 없음');
});

run('cardFileName', () => {
  const B = story.card.fileBase;
  ok(Card.fileName(B, '20315', '김온유') === '공유한순간_성찰카드_20315_김온유', '기본');
  ok(Card.fileName(B, ' 2 03 15 ', ' 김 온유 ') === '공유한순간_성찰카드_2_03_15_김_온유', '공백 → _');
  ok(Card.fileName(B, '2/3:1*5?', 'a\\b"c<d>e|f') === '공유한순간_성찰카드_2_3_1_5_a_b_c_d_e_f', '파일 이름에 못 쓰는 글자 → _ : ' + Card.fileName(B, '2/3:1*5?', 'a\\b"c<d>e|f'));
  ok(Card.fileName(B, '', '') === '공유한순간_성찰카드' && Card.fileName(B, '', '김온유') === '공유한순간_성찰카드_김온유' && Card.fileName(B, '20315', '   ') === '공유한순간_성찰카드_20315', '비어 있는 칸은 건너뜀(막지 않음)');
  ok(Card.fileName(B, '..', '...김..') === '공유한순간_성찰카드_김', '앞뒤 점 떼기: ' + Card.fileName(B, '..', '...김..'));
  ok(Card.fileName(B, '1\n2\t3', '김\u0000온\u007f유') === '공유한순간_성찰카드_1_2_3_김_온_유', '제어 문자 → _');
  ok(Card.fileName(B, '1'.repeat(40), '가'.repeat(60)) === '공유한순간_성찰카드_' + '1'.repeat(12) + '_' + '가'.repeat(20), '길이 제한(학번 12 · 이름 20)');
  ok(Card.fileName(B, null, undefined) === '공유한순간_성찰카드' && Card.fileName(B, 20315, {}) === '공유한순간_성찰카드', '글자가 아닌 값');
  const bad = /[\\/:*?"<>|\s\u0000-\u001f]/;
  for (const [a, b] of [['<script>', '../../etc'], ['COM1', 'a b\tc'], ['😀 1', '이 름']]) ok(!bad.test(Card.fileName(B, a, b)), '금지 글자 없음: ' + Card.fileName(B, a, b));
});

run('cardStore', () => {
  const s = play(prefsOf(ROUTES.B)), s2 = play(prefsOf(ROUTES.A)), mid = play({}, (x) => x.screen === 'scene' && x.scene === 'c2_e4_a');
  const b = Card.blank(s);
  ok(b.v === 1 && b.ending === 'B' && typeof b.sig === 'string' && b.sig.length > 0 && b.sid === '' && b.name === '' && same(b.answers, ['', '', '']), '빈 카드 ' + JSON.stringify(b));
  ok(Card.KEY === 'ethicity.privacy.card.v1' && fs.readFileSync(path.join(ROOT, 'js/storage.js'), 'utf8').includes("card: '" + Card.KEY + "'"), '저장 키');
  ok(Card.finished(s) && !Card.finished(mid) && !Card.finished(null), '엔딩을 본 진행만');
  // 그대로 읽기
  const saved = Object.assign({}, b, { sid: '20315', name: '김온유', answers: ['첫째 답', '', '셋째\n답'] });
  const r = Card.read(JSON.parse(JSON.stringify(saved)), s);
  ok(!r.stale && r.found && same(r.card, saved), '저장한 그대로 읽힘');
  // 다른 진행의 글은 섞이지 않는다: 엔딩 코드가 다르거나, 같은 엔딩이라도 선택 경로가 다르면
  ok(Card.read(saved, s2).stale && same(Card.read(saved, s2).card.answers, ['', '', '']) && Card.read(saved, s2).card.name === '', '다른 엔딩의 진행 → 버림');
  const sameEnd = Object.assign({}, s, { history: s.history.slice(0, -1).concat([Object.assign({}, s.history[s.history.length - 1], { choice: 'x' })]) });
  ok(Card.sig(sameEnd) !== Card.sig(s) && Card.read(saved, sameEnd).stale, '같은 엔딩 코드라도 선택이 다른 진행 → 버림');
  ok(Card.sig(JSON.parse(JSON.stringify(s))) === Card.sig(s), '저장했다 불러온 같은 진행 → 같은 지문');
  ok(Card.read(saved, mid).stale && Card.read(saved, null).stale, '엔딩 전·진행 없음 → 쓰지 않음');
  // 손상된 값
  for (const raw of [null, undefined, 'x', 7, [], {}, { v: 2 }, { v: 1 }]) { let ok1 = true, c = null; try { c = Card.read(raw, s).card; } catch (e) { ok1 = false; } ok(ok1 && !!c && same(c.answers, ['', '', '']), '손상된 저장 ' + JSON.stringify(raw) + ' → 빈 카드'); }
  const odd = Card.read(Object.assign({}, b, { sid: 20315, name: ' 김\n온유 '.repeat(5), answers: ['가'.repeat(500), 5, null, '넷째'] }), s).card;
  ok(odd.sid === '' && odd.name.length <= Card.MAX_NAME && !/\n/.test(odd.name) && odd.answers.length === 3 && odd.answers[0].length === Card.MAX_TEXT && odd.answers[1] === '' && odd.answers[2] === '', '엉뚱한 칸은 다듬어 읽음 ' + JSON.stringify([odd.sid, odd.name]));
  // 새로 시작하기 전에 물을지
  ok(Card.hasText(saved) && !Card.hasText(b) && !Card.hasText(Object.assign({}, b, { sid: '20315', name: '김온유' })), '쓴 글이 있을 때만 묻는다(이름·학번만 있으면 묻지 않음)');
  ok(!Card.hasText(Object.assign({}, b, { answers: ['  ', '\n', ''] })) && !Card.hasText(null) && !Card.hasText({ answers: 'x' }) && Card.hasText({ answers: [null, 'a'] }), '공백만·손상된 값');
  // 인쇄용 답
  ok(Card.printText('  가나다  ') === '가나다' && Card.printText('') === '' && Card.printText('\n \n') === '', '앞뒤 공백·빈 값');
  ok(Card.printText('가\n\n\n나\n다\n라\n마\n바') === '가\n나\n다\n라 마 바' && Card.printText('\n'.repeat(200)) === '', '줄바꿈은 세 번까지(엔터만 쳐도 한 장을 넘지 않게)');
  ok(Card.cleanText('가\r\n나\u0000다').length === 4 && Card.cleanLine(' a \n b ', 20) === 'a b', '입력 다듬기');
  // 화면 연결
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  ok(html.indexOf('src="js/card.js"') > 0 && html.indexOf('src="js/card.js"') < html.indexOf('src="js/app.js"') &&/id="v-card"/.test(html) && /id="btn-end-card" class="btn primary"/.test(html), 'index.html: card.js가 app.js 앞, 카드 화면, 엔딩 화면의 으뜸 버튼');
  ok(!/KEYS\.player\s*,|writeJSON\(S\.KEYS\.(player|result)/.test(app.replace(/S\.saveResult/g, '')), 'app.js가 공통 키(ethicity.player·result)에 카드 내용을 쓰지 않음');
  ok(/@media print/.test(fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8')) && /size:\s*A4 portrait/.test(fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8')), '인쇄용 모양(A4 세로)');
});

console.log(`\n통과 ${pass} · 실패 ${fails.length}`);
process.exitCode = fails.length ? 1 : 0;
